import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import CameraView from '@/components/CameraView';
import { setPoseDebugMode } from '@/services/evaluation/poseInference';
import {
  Keypoint,
  PhaseType,
  PoseResult,
  RuleEngine,
  RepDetector,
  FrameData,
} from '@royng163/reptor-core';
import ruleConfigJson from '@/assets/config/rule_config.json';
import featureConfigJson from '@/assets/config/feature_config.json';
import { FpsNormalizer } from '@/lib/fps';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircleIcon } from 'lucide-react-native';

function normalizeExerciseId(raw?: string | string[]) {
  const value = Array.isArray(raw) ? raw[0] : raw || 'squat';
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function normalizeExerciseName(raw?: string | string[]) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value || 'Evaluation';
}

function toMap(keypoints: Keypoint[]) {
  const map = new Map<string, Keypoint>();
  keypoints.forEach((kp) => {
    if (kp.name) map.set(kp.name, kp);
  });
  return map;
}

function extractAggFeatures(keypoints: Keypoint[]): Record<string, number> {
  const byName = toMap(keypoints);
  const lk = byName.get('left_knee');
  const rk = byName.get('right_knee');
  const lh = byName.get('left_hip');
  const rh = byName.get('right_hip');
  const ls = byName.get('left_shoulder');
  const rs = byName.get('right_shoulder');
  const le = byName.get('left_elbow');
  const lw = byName.get('left_wrist');

  const safe = (v: number | undefined, fallback = 0) =>
    Number.isFinite(v) ? (v as number) : fallback;

  return {
    knee_flexion_left: safe(lk?.y) - 0.62,
    elbow_flexion_left: 0.42 - safe(le?.y),
    knee_joint_center_x_offset: Math.abs(safe(lk?.x, 0.5) - safe(rk?.x, 0.5)),
    stance_width_normalized: Math.abs(safe(lk?.x, 0.45) - safe(rk?.x, 0.55)) - 0.3,
    trunk_angle: Math.abs((safe(ls?.x) + safe(rs?.x)) / 2 - (safe(lh?.x) + safe(rh?.x)) / 2),
    hip_flexion_symmetry: Math.abs(safe(lh?.y, 0.5) - safe(rh?.y, 0.5)),
    elbow_to_shoulder_y_left: safe(le?.y, 0.4) - safe(ls?.y, 0.35),
    torso_tilt: Math.abs((safe(ls?.x) + safe(rs?.x)) / 2 - (safe(lh?.x) + safe(rh?.x)) / 2),
    wrist_to_shoulder_y_left: safe(lw?.y, 0.5) - safe(ls?.y, 0.35),
    wrist_to_shoulder_y_right: safe(byName.get('right_wrist')?.y, 0.5) - safe(rs?.y, 0.35),
  };
}

function formatFeatureValue(v: number | undefined) {
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(3) : '--';
}

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

function getPhaseFromRepDetector(
  detector: RepDetector | null,
  frame: Record<string, number>
): PhaseType {
  if (!detector) return 'IDLE';

  const d = detector as any;

  const result =
    (typeof d.update === 'function' && d.update(frame)) ||
    (typeof d.processFrame === 'function' && d.processFrame(frame)) ||
    (typeof d.detect === 'function' && d.detect(frame));

  const phase = (typeof result === 'string' ? result : (result?.phase ?? result?.currentPhase)) as
    | PhaseType
    | undefined;

  return phase === 'CONCENTRIC' || phase === 'ECCENTRIC' || phase === 'IDLE' ? phase : 'IDLE';
}

export default function EvaluationScreen() {
  const params = useLocalSearchParams<{ exerciseId?: string | string[] }>();
  const exerciseName = normalizeExerciseName(params.exerciseId);
  const exerciseId = normalizeExerciseId(params.exerciseId);

  const [lastEval, setLastEval] = useState<{ errors: string[]; quality: number } | null>(null);
  const [featureStats, setFeatureStats] = useState<Record<string, number>>({});
  const inFlightRef = useRef(false);

  const featureOrder = useMemo(() => featureConfigJson.feature_names ?? [], []);
  const snapPoints = useMemo(() => ['10%', '35%', '55%', '90%'], []);
  const triggeredErrors = useMemo(() => new Set(lastEval?.errors ?? []), [lastEval?.errors]);

  const normalizerRef = useRef(new FpsNormalizer(30));
  const ruleEngineRef = useRef<RuleEngine | null>(null);
  const repDetectorRef = useRef<RepDetector | null>(null);
  const [rawKeypoints, setRawKeypoints] = useState<Keypoint[]>([]);

  // Debug logging
  const [fps, setFps] = useState(30);
  const [normalizedFps, setNormalizedFps] = useState(0);

  const ruleConfigRoot = useMemo(
    () =>
      ruleConfigJson as {
        version: number;
        exercises: Array<{ id: string; rules: any[] }>;
      },
    []
  );

  const activeExercise = useMemo(() => {
    const found = ruleConfigRoot.exercises.find((e) => String(e.id).toLowerCase() === exerciseId);
    if (!found) {
      console.warn(`[RuleEngine] No exercise found for id: "${exerciseId}"`);
      return null;
    }
    return found;
  }, [ruleConfigRoot, exerciseId]);

  const activeRules = activeExercise?.rules ?? [];

  useEffect(() => {
    normalizerRef.current.reset();

    if (!activeExercise) {
      ruleEngineRef.current = null;
      repDetectorRef.current = null;
      return;
    }

    // Guard: ensure rules is always an array
    const safeExercise = {
      ...activeExercise,
      rules: Array.isArray(activeExercise.rules) ? activeExercise.rules : [],
    };

    ruleEngineRef.current = new RuleEngine(safeExercise as any, { view: 'front' });
    repDetectorRef.current = new RepDetector();
  }, [activeExercise]);
  useEffect(() => {
    setPoseDebugMode(__DEV__);
  }, []);

  const handlePose = useCallback(
    async ({ keypoints, timestamp }: PoseResult) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const normalizedSamples = normalizerRef.current.push(keypoints, timestamp);

        // RuleEngine always sees normalized 30 FPS stream
        for (const sample of normalizedSamples) {
          const aggFeatures = extractAggFeatures(sample.keypoints);

          const phase = getPhaseFromRepDetector(repDetectorRef.current, aggFeatures);
          const result = evaluateFromRuleEngine(ruleEngineRef.current, aggFeatures, phase);

          setFeatureStats(aggFeatures);
          setLastEval(result);
        }

        setRawKeypoints(keypoints);
        setFps(normalizerRef.current.getInputFps());
        setNormalizedFps(normalizerRef.current.getNormalizedFps());
      } finally {
        inFlightRef.current = false;
      }
    },
    [exerciseId]
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: exerciseName }} />

      {false ? (
        <View className="absolute top-10 right-3 left-3 z-10">
          <Alert variant="destructive" icon={AlertCircleIcon}>
            <AlertTitle>Minimum Hardware Requirement Not Met</AlertTitle>
            <AlertDescription>
              Your device is running at {fps.toFixed(0)} FPS, which is below the minimum requirement
            </AlertDescription>
          </Alert>
        </View>
      ) : null}

      <View className="flex-1">
        <CameraView onPose={handlePose} />
      </View>

      <BottomSheet
        snapPoints={snapPoints}
        enableContentPanningGesture={false}
        backgroundStyle={{ backgroundColor: 'transparent' }}
        handleIndicatorStyle={{ backgroundColor: '#71717a' }}>
        <View className="border-border bg-card flex-1 rounded-t-2xl border px-4 pt-2">
          <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <View className="border-border bg-background mb-3 flex-row items-center justify-between rounded-md border px-3 py-2">
              <Text className="text-muted-foreground text-xs">FPS: {fps.toFixed(1)}</Text>
              <Text className="text-muted-foreground text-xs">
                Normalized FPS: {normalizedFps.toFixed(1)}
              </Text>
            </View>

            <Text className="text-foreground text-sm font-semibold">
              Rule Triggers ({activeRules.length})
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
                    <Text className="text-foreground text-xs">{r.error_type}</Text>
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

            {/* Raw keypoints debug section */}
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
