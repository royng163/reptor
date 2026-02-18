import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import CameraView from '@/components/CameraView';
import {
  PosePayload,
  setPoseDebugMode,
  type Landmark,
} from '@/services/evaluation/inferenceService';
import { evaluateRules, loadRuleConfig, type RuleConfig } from '@/services/evaluation/RuleEngine';
import ruleConfigJson from '@/assets/config/rule_config.json';
import featureConfigJson from '@/assets/config/feature_config.json';

type FeatureConfig = { feature_names: string[] };

function normalizeExerciseId(raw?: string | string[]) {
  const value = Array.isArray(raw) ? raw[0] : raw || 'squat';
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function normalizeExerciseName(raw?: string | string[]) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value || 'Evaluation';
}

function toMap(landmarks: Landmark[]) {
  const map = new Map<string, Landmark>();
  landmarks.forEach((lm) => {
    if (lm.name) map.set(lm.name, lm);
  });
  return map;
}

function extractAggFeatures(landmarks: Landmark[]): Record<string, number> {
  const byName = toMap(landmarks);
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

export default function EvaluationScreen() {
  const params = useLocalSearchParams<{ exerciseId?: string | string[] }>();
  const exerciseName = normalizeExerciseName(params.exerciseId);
  const exerciseId = normalizeExerciseId(params.exerciseId);

  const [lastEval, setLastEval] = useState<{ errors: string[]; quality: number } | null>(null);
  const [featureStats, setFeatureStats] = useState<Record<string, number>>({});
  const inFlightRef = useRef(false);

  const ruleConfig = useMemo(() => loadRuleConfig(ruleConfigJson as RuleConfig), []);
  const featureOrder = useMemo(() => (featureConfigJson as FeatureConfig).feature_names ?? [], []);
  const snapPoints = useMemo(() => ['10%', '55%', '90%'], []);

  const activeExercise = useMemo(
    () => ruleConfig.exercises.find((e) => e.id === exerciseId),
    [exerciseId, ruleConfig.exercises]
  );
  const activeRules = activeExercise?.rules ?? [];
  const triggeredErrors = useMemo(() => new Set(lastEval?.errors ?? []), [lastEval?.errors]);

  // Debug logging
  const [frameCount, setFrameCount] = useState(0);
  const [inferenceLatencyMs, setInferenceLatencyMs] = useState(0);
  const [fps, setFps] = useState(0);

  const fpsStartTsRef = useRef<number | null>(null);

  useEffect(() => {
    setPoseDebugMode(__DEV__);
  }, []);

  const handlePose = useCallback(
    async ({ landmarks, timestamp, frameCount, inferenceMs }: PosePayload) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const aggFeatures = extractAggFeatures(landmarks);
        const result = evaluateRules(ruleConfig, exerciseId, aggFeatures);
        setFeatureStats(aggFeatures);
        setLastEval(result);

        setFrameCount(frameCount);
        setInferenceLatencyMs(inferenceMs);

        if (fpsStartTsRef.current == null) fpsStartTsRef.current = timestamp;
        const elapsedSec = (timestamp - fpsStartTsRef.current) / 1000;
        if (elapsedSec > 0) setFps(frameCount / elapsedSec);
      } finally {
        inFlightRef.current = false;
      }
    },
    [exerciseId, ruleConfig]
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: exerciseName }} />

      <View className="flex-1">
        <CameraView onPose={handlePose} />
      </View>

      <BottomSheet
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        backgroundStyle={{ backgroundColor: 'transparent' }}
        handleIndicatorStyle={{ backgroundColor: '#71717a' }}>
        <View className="border-border bg-card flex-1 rounded-t-2xl border px-4 pt-2">
          <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <Text className="text-foreground text-sm font-semibold">Inference Stats</Text>
            <View className="mt-2 gap-1">
              <View className="border-border bg-background flex-row items-center justify-between rounded-md border px-3 py-2">
                <Text className="text-foreground text-xs">FPS</Text>
                <Text className="text-muted-foreground text-xs">{fps.toFixed(1)}</Text>
              </View>
              <View className="border-border bg-background flex-row items-center justify-between rounded-md border px-3 py-2">
                <Text className="text-foreground text-xs">Latency</Text>
                <Text className="text-muted-foreground text-xs">
                  {inferenceLatencyMs.toFixed(1)} ms
                </Text>
              </View>
              <View className="border-border bg-background flex-row items-center justify-between rounded-md border px-3 py-2">
                <Text className="text-foreground text-xs">Frame Count</Text>
                <Text className="text-muted-foreground text-xs">{frameCount}</Text>
              </View>
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
          </BottomSheetScrollView>
        </View>
      </BottomSheet>
    </View>
  );
}
