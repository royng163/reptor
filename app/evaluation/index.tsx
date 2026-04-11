import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as Speech from 'expo-speech';
import CameraView from '@/components/CameraView';
import {
  Keypoint,
  PhaseType,
  PoseResult,
  RuleEngine,
  RepDetector,
  FeatureAggregator,
  FpsNormalizer,
  FrameData,
  ExerciseId,
  ExerciseConfig,
} from '@royng163/reptor-core';
import featureConfigJson from '@/assets/config/feature_config.json';
import distilledRuleConfig from '@/assets/config/distilled.json';
import { generateHint } from '@/lib/hint';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircleIcon } from 'lucide-react-native';

const EXERCISE_CONFIGS = distilledRuleConfig as ExerciseConfig[];

function loadExerciseConfig(exerciseId: string): any {
  const config = EXERCISE_CONFIGS.find((e: any) => e.exercise_id === exerciseId);
  if (!config) {
    console.warn(`[RuleEngine] No config found for exercise: "${exerciseId}"`);
    return null;
  }
  return config;
}

/**
 * Normalizes exercise ID to display name.
 * e.g., "bicep_curl" -> "Bicep Curl"
 */
function normalizeExerciseName(value: string) {
  if (!value) return 'Evaluation';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Converts keypoint array to Map for O(1) lookup by name.
 */
function toMap(keypoints: Keypoint[]) {
  const map = new Map<string, Keypoint>();
  keypoints.forEach((kp) => {
    if (kp.name) map.set(kp.name, kp);
  });
  return map;
}

/**
 * Formats feature value for display. Returns '--' for undefined/invalid values.
 */
function formatFeatureValue(v: number | undefined) {
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(3) : '--';
}

/**
 * Evaluates frame-level rules and returns structured result.
 */
function evaluateFromRuleEngine(
  engine: RuleEngine | null,
  features: Record<string, number>,
  phase: PhaseType = 'IDLE'
) {
  if (!engine) return { errors: [] as string[], quality: 1 };

  let feedbacks: ReturnType<RuleEngine['evaluateFrame']> = [];
  try {
    feedbacks = engine.evaluateFrame(features as FrameData, phase);
  } catch (e) {
    console.warn('[RuleEngine] evaluateFrame error:', e);
    return { errors: [] as string[], quality: 1 };
  }

  const errors = feedbacks.filter((f) => !f.passed).map((f) => f.errorType);
  const totalWeight = feedbacks.reduce((s, f) => s + (f.weight ?? 1), 0);
  const failedWeight = feedbacks.filter((f) => !f.passed).reduce((s, f) => s + (f.weight ?? 1), 0);
  const quality = totalWeight > 0 ? Math.max(0, 1 - failedWeight / totalWeight) : 1;

  return { errors, quality };
}

export default function EvaluationScreen() {
  const params = useLocalSearchParams<{ exerciseId: string }>();
  const exerciseId = params.exerciseId as ExerciseId;
  const exerciseName = normalizeExerciseName(exerciseId);

  const [lastEval, setLastEval] = useState<{ errors: string[]; quality: number } | null>(null);
  const [featureStats, setFeatureStats] = useState<Record<string, number>>({});
  const [currentPhase, setCurrentPhase] = useState<string>('IDLE');
  const [feedbackKey, setFeedbackKey] = useState(0);
  const inFlightRef = useRef(false);
  const frameIdxRef = useRef(0);
  const lastFeedbackRef = useRef<string | null>(null);

  const activeExerciseConfig: any = useMemo(() => {
    const config = loadExerciseConfig(exerciseId);
    if (!config) return null;
    return {
      version: config.version || 2,
      exercise_id: config.exercise_id || 0,
      exercise_name: config.exercise_name || exerciseId,
      rules: config.rules ?? [],
    };
  }, [exerciseId]);

  const activeRules = activeExerciseConfig?.rules ?? [];

  const feedbackHint = useMemo(() => {
    if (!lastEval || lastEval.errors.length === 0) return undefined;
    const firstError = activeRules.find((r: any) => r.error_type === lastEval.errors[0]);
    if (!firstError) return undefined;
    const feature = 'feature' in firstError ? firstError.feature : undefined;
    const val = feature ? featureStats[feature] : undefined;
    return generateHint(firstError, val);
  }, [lastEval, activeRules, featureStats]);

  useEffect(() => {
    if (feedbackHint && feedbackHint !== lastFeedbackRef.current) {
      lastFeedbackRef.current = feedbackHint;
      setFeedbackKey((k) => k + 1);

      Speech.speak(feedbackHint, {
        language: 'en',
        pitch: 1.0,
        rate: 1.2,
        onError: (error) => console.warn('[Speech] Error:', error),
      });
    } else if (!feedbackHint && lastFeedbackRef.current) {
      lastFeedbackRef.current = null;
    }
  }, [feedbackHint]);

  const featureOrder = useMemo(() => featureConfigJson.feature_names ?? [], []);
  const snapPoints = useMemo(() => ['10%', '35%', '55%', '90%'], []);

  const fpsNormalizerRef = useRef(new FpsNormalizer(30));
  const ruleEngineRef = useRef<RuleEngine | null>(null);
  const repDetectorRef = useRef<RepDetector | null>(null);
  const aggregatorRef = useRef<FeatureAggregator | null>(null);

  // Debug logging
  const [fps, setFps] = useState(30);
  const [rawKeypoints, setRawKeypoints] = useState<Keypoint[]>([]);
  const triggeredErrors = useMemo(() => new Set(lastEval?.errors ?? []), [lastEval?.errors]);

  useEffect(() => {
    fpsNormalizerRef.current.reset();

    if (!activeExerciseConfig) {
      ruleEngineRef.current = null;
      repDetectorRef.current = null;
      aggregatorRef.current = null;
      return;
    }

    ruleEngineRef.current = new RuleEngine(activeExerciseConfig, { view: 'front' });
    repDetectorRef.current = new RepDetector(exerciseId as any);
    aggregatorRef.current = new FeatureAggregator();
  }, [activeExerciseConfig]);

  const handlePose = useCallback(
    async ({ keypoints, timestamp }: PoseResult) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        // 1. Normalize input frames to fixed FPS
        const normalizedSamples = fpsNormalizerRef.current.push(keypoints, timestamp);

        for (const sample of normalizedSamples) {
          const keypointMap = toMap(sample.keypoints);
          // 2. Extract Instant Features
          const aggFeatures = aggregatorRef.current!.extractFeatures(keypointMap, exerciseId);

          // 3. Detect Phase
          const { state, isRepFinished, velocity } = repDetectorRef.current!.detect(
            {
              knee_flexion_left: aggFeatures.knee_flexion_left,
              knee_flexion_right: aggFeatures.knee_flexion_right,
              elbow_flexion_left: aggFeatures.elbow_flexion_left,
              elbow_flexion_right: aggFeatures.elbow_flexion_right,
            },
            frameIdxRef.current
          );
          setCurrentPhase(state);

          // 4. Update aggregator phase
          aggregatorRef.current?.setPhase(state);

          // 5. Evaluate Frame-level rules for instant feedback
          const result = evaluateFromRuleEngine(ruleEngineRef.current, aggFeatures, state);

          setFeatureStats(aggFeatures);
          setLastEval(result);
          frameIdxRef.current++;

          if (isRepFinished) {
            const repAggregates = aggregatorRef.current?.getRepAggregates();
            const phaseAggregates = aggregatorRef.current?.getPhaseAggregates();

            if (repAggregates && ruleEngineRef.current) {
              const phaseFeedbacks = ruleEngineRef.current.evaluateWithPhases(
                repAggregates,
                phaseAggregates
              );
              // Convert to same format as evaluateFromRuleEngine
              const errors = phaseFeedbacks.filter((f) => !f.passed).map((f) => f.errorType);
              const totalWeight = phaseFeedbacks.reduce((s, f) => s + (f.weight ?? 1), 0);
              const failedWeight = phaseFeedbacks
                .filter((f) => !f.passed)
                .reduce((s, f) => s + (f.weight ?? 1), 0);
              const quality = totalWeight > 0 ? Math.max(0, 1 - failedWeight / totalWeight) : 1;
              setLastEval({ errors, quality });
            }

            aggregatorRef.current?.reset();
            ruleEngineRef.current?.reset();
          }
        }

        setRawKeypoints(keypoints);
        setFps(fpsNormalizerRef.current.getInputFps());
      } finally {
        inFlightRef.current = false;
      }
    },
    [exerciseId]
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: exerciseName }} />

      {/* Feedback hint */}
      {false ? (
        <View className="absolute top-10 right-3 left-3 z-10">
          <Alert variant="destructive" icon={AlertCircleIcon}>
            <AlertTitle>Minimum Hardware Requirement Not Met</AlertTitle>
            <AlertDescription>
              Your device is running at {fps.toFixed(0)} FPS, which is below the minimum requirement
            </AlertDescription>
          </Alert>
        </View>
      ) : feedbackHint ? (
        <View key={feedbackKey} className="absolute top-10 right-3 left-3 z-10">
          <View className="rounded-lg bg-black/70 px-4 py-3">
            <Text className="text-center text-2xl font-bold text-white">{feedbackHint}</Text>
          </View>
        </View>
      ) : null}
      {/* Camera View with Pose Detection */}
      <View className="flex-1">
        <CameraView onPose={handlePose} />
      </View>

      {/* Bottom Sheet for Evaluation Debug */}
      <BottomSheet
        snapPoints={snapPoints}
        enableContentPanningGesture={false}
        backgroundStyle={{ backgroundColor: 'transparent' }}
        handleIndicatorStyle={{ backgroundColor: '#71717a' }}>
        <View className="border-border bg-card flex-1 rounded-t-2xl border p-2 pb-6">
          <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Current Phase and FPS */}
            <View className="border-border bg-background mb-3 flex-row items-center justify-between rounded-md border px-3 py-2">
              <Text className="text-muted-foreground text-xs">Phase: {currentPhase}</Text>
              <Text className="text-muted-foreground text-xs">FPS: {fps.toFixed(1)}</Text>
            </View>

            {/* Rules Triggered */}
            <Text className="text-foreground text-sm font-semibold">
              Corrections ({activeRules.length})
            </Text>
            <View className="mt-2 gap-1">
              {activeRules.map((r: (typeof activeRules)[number], i: number) => {
                const triggered = triggeredErrors.has(r.error_type);
                const featureA = 'feature' in r ? r.feature : undefined;
                const featureL = 'feature_left' in r ? r.feature_left : undefined;
                const featureR = 'feature_right' in r ? r.feature_right : undefined;

                const valueText = featureA
                  ? formatFeatureValue(featureStats[featureA])
                  : featureL && featureR
                    ? `${formatFeatureValue(featureStats[featureL])} | ${formatFeatureValue(featureStats[featureR])}`
                    : '--';

                return (
                  <View
                    key={`${r.error_type}_${i}`}
                    className="border-border bg-background flex-row items-center justify-between rounded-md border px-3 py-2">
                    <View className="flex-1 pr-2">
                      <Text className="text-foreground text-xs font-semibold">
                        {r.description || r.error_type}
                      </Text>
                    </View>
                    <Text
                      className={
                        triggered
                          ? 'text-xs font-semibold text-red-500'
                          : 'text-xs font-semibold text-emerald-600'
                      }>
                      {valueText}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Feature stats*/}
            <Text className="text-foreground mt-4 text-sm font-semibold">
              Feature Stats ({featureOrder.length})
            </Text>
            <View className="mt-2 gap-1">
              {featureOrder.map((name) => (
                <View
                  key={name}
                  className="border-border bg-background flex-row items-center justify-between rounded-md border px-3 py-2">
                  <Text className="text-foreground text-xs">{name}</Text>
                  <Text className="text-muted-foreground text-xs">
                    {formatFeatureValue(featureStats[name])}
                  </Text>
                </View>
              ))}
            </View>

            {/* Raw keypoints */}
            <View className="mt-4">
              <Text className="text-foreground text-sm font-semibold">
                Raw Keypoints ({rawKeypoints.length})
              </Text>
              <View className="border-border bg-background mt-1 rounded-md border px-3 py-2">
                {rawKeypoints.map((kp, i) => (
                  <View
                    key={`${kp.name ?? 'kp'}_${i}`}
                    className="border-border border-b py-1 last:border-b-0">
                    <Text className="text-foreground text-xs font-medium">
                      {kp.name ?? `kp_${i}`}
                    </Text>
                    <Text className="text-muted-foreground font-mono text-xs">
                      x: {kp.x.toFixed(4)}
                      {'  '}
                      y: {kp.y.toFixed(4)}
                      {'  '}
                      {kp.z !== undefined ? `z: ${kp.z.toFixed(4)}  ` : ''}
                      {kp.visibility !== undefined ? `vis: ${kp.visibility.toFixed(2)}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </BottomSheetScrollView>
        </View>
      </BottomSheet>
    </View>
  );
}
