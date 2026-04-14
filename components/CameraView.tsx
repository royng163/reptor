import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, Platform } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
} from 'react-native-vision-camera';
import { useNavigation } from 'expo-router';
import { useAppState } from '@react-native-community/hooks';
import {
  usePoseDetection,
  RunningMode,
  Delegate,
  type PoseDetectionResultBundle,
} from 'react-native-mediapipe-posedetection';
import { type Keypoint, type PoseResult } from '@royng163/reptor-core';
import { LANDMARK_NAMES, OVERLAY_LANDMARKS } from '@/lib/constant';
import { Canvas, Circle } from '@shopify/react-native-skia';
import type { ModelOption, CameraOption } from '@/lib/store';

interface PoseResultWithInference extends PoseResult {
  inferenceFps?: number;
}

const MODEL_FILES: Record<ModelOption, string> = {
  lite: 'pose_landmarker_lite.task',
  full: 'pose_landmarker_full.task',
  heavy: 'pose_landmarker_heavy.task',
};

export default function CameraView({
  onPose,
  model = 'lite',
  camera = 'front',
}: {
  onPose: (payload: PoseResultWithInference) => void;
  model?: ModelOption;
  camera?: CameraOption;
}) {
  const device = useCameraDevice(camera, {
    physicalDevices: camera === 'back' ? ['wide-angle-camera'] : undefined,
  });
  const format = useCameraFormat(device, [{ fps: 30 }]);
  const { hasPermission, requestPermission } = useCameraPermission();

  const isFocused = useNavigation().isFocused();
  const inForeground = useAppState() === 'active';
  const isActive = isFocused && inForeground;

  const [overlayLandmarks, setOverlayLandmarks] = useState<Keypoint[]>([]);
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 });

  const statsRef = useRef({ frameCount: 0, sessionStart: 0, lastUpdate: 0, fps: 0 });

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  const poseDetection = usePoseDetection(
    {
      onResults: (result: PoseDetectionResultBundle) => {
        const now = Date.now();

        if (result.results.length === 0 || !result.results[0].landmarks[0]) {
          return;
        }

        if (statsRef.current.frameCount === 0) {
          statsRef.current.sessionStart = now;
        }
        statsRef.current.frameCount++;

        if (now - statsRef.current.lastUpdate > 500) {
          const elapsed = (now - statsRef.current.sessionStart) / 1000;
          statsRef.current.fps = statsRef.current.frameCount / Math.max(1, elapsed);
          statsRef.current.lastUpdate = now;
        }

        const poseLandmarks = result.results[0].landmarks[0];

        const keypoints: Keypoint[] = poseLandmarks.map((lm, index) => ({
          name: LANDMARK_NAMES[index] ?? `landmark_${index}`,
          x: (1 - lm.y) * viewSize.width,
          y: (1 - lm.x) * viewSize.height,
          visibility: lm.visibility ?? 0,
        }));

        setOverlayLandmarks(keypoints);
        onPose({ keypoints, timestamp: now, inferenceFps: statsRef.current.fps });
      },
      onError: (err) => {
        console.error('[CameraView] Pose detection error:', err.message);
      },
    },
    RunningMode.LIVE_STREAM,
    MODEL_FILES[model],
    {
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      delegate: Delegate.GPU,
      mirrorMode: 'no-mirror',
    }
  );

  if (!hasPermission) {
    return (
      <View className="border-border flex-1 items-center justify-center rounded-xl border bg-black">
        <Text className="text-sm text-zinc-400">Camera permission required</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View className="border-border flex-1 items-center justify-center rounded-xl border bg-black">
        <Text className="text-sm text-zinc-400">No camera found</Text>
      </View>
    );
  }

  return (
    <View
      className="border-border flex-1 overflow-hidden rounded-xl border"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setViewSize({ width, height });
      }}>
      {/* Camera preview*/}
      <Camera
        style={{ flex: 1 }}
        device={device}
        format={format}
        fps={30}
        isActive={isActive}
        frameProcessor={poseDetection.frameProcessor}
        pixelFormat="rgb"
      />

      <View className="absolute inset-0">
        <Canvas style={StyleSheet.absoluteFill}>
          {overlayLandmarks
            .filter(
              (lm) =>
                lm.name && OVERLAY_LANDMARKS.includes(lm.name as (typeof OVERLAY_LANDMARKS)[number])
            )
            .map((lm, i) => {
              if (!lm.visibility || lm.visibility < 0.5) return null;
              return (
                <Circle key={`${lm.name ?? 'lm'}_${i}`} cx={lm.x} cy={lm.y} r={3} color="#00FF00" />
              );
            })}
        </Canvas>
      </View>
    </View>
  );
}
