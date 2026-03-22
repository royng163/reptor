import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { Worklets } from 'react-native-worklets-core';
import { decodePoseOutputs, loadPoseModel } from '@/services/evaluation/poseInference';
import { type Keypoint, type PoseResult } from '@royng163/reptor-core';
import { useNavigation } from 'expo-router';
import { useAppState } from '@react-native-community/hooks';
import { Canvas, Circle } from '@shopify/react-native-skia';
import { arms, BODY_PART_COLORS, feet, head, legs, MODEL_SIZE, torso } from '@/lib/constant';
function getBodyPartColor(name: string | undefined): string {
  if (!name) return '#ff3b30';

  if (head.includes(name)) return BODY_PART_COLORS.head;
  if (torso.includes(name)) return BODY_PART_COLORS.torso;
  if (arms.includes(name)) return BODY_PART_COLORS.arms;
  if (legs.includes(name)) return BODY_PART_COLORS.legs;
  if (feet.includes(name)) return BODY_PART_COLORS.feet;

  return '#ff3b30';
}

export default function CameraView({ onPose }: { onPose: (payload: PoseResult) => void }) {
  const device = useCameraDevice('front');
  const format = useCameraFormat(device, [{ fps: 30 }]);
  const { hasPermission, requestPermission } = useCameraPermission();
  const { resize } = useResizePlugin();

  // Pause camera when nagivated to another screen or app in background
  const isFocused = useNavigation().isFocused();
  const inForeground = useAppState() === 'active';
  const isActive = isFocused && inForeground;

  const [model, setModel] = useState<any>(null);
  const [overlayLandmarks, setOverlayLandmarks] = useState<Keypoint[]>([]);
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 });
  const [srcDims, setSrcDims] = useState({ width: 1920, height: 1080 });
  const [debugKeypoint, setDebugKeypoint] = useState<Keypoint | null>(null);
  const [showDebug, setShowDebug] = useState(true);

  useEffect(() => {
    if (format?.videoWidth && format?.videoHeight) {
      setSrcDims({ width: format.videoWidth, height: format.videoHeight });
    }
  }, [format]);

  // Check and request camera permission on mount
  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  // Load pose model on mount
  useEffect(() => {
    let mounted = true;
    loadPoseModel().then((m) => {
      if (mounted) setModel(m);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const onPoseJS = useMemo(() => Worklets.createRunOnJS(onPose), [onPose]);

  const onOverlayJS = useMemo(
    () =>
      Worklets.createRunOnJS((keypoints: Keypoint[]) => {
        setOverlayLandmarks(keypoints);
        if (keypoints.length > 0) setDebugKeypoint(keypoints[0]);
      }),
    []
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (!model) return;

      // Prepare the input tensor
      const input = resize(frame, {
        scale: { width: MODEL_SIZE, height: MODEL_SIZE },
        mirror: true,
        rotation: '270deg',
        pixelFormat: 'rgb',
        dataType: 'float32',
      });

      const outputs = model.runSync([input]);
      const keypoints = decodePoseOutputs(outputs as unknown[]);

      onPoseJS({ keypoints, timestamp: Date.now() });
      onOverlayJS(keypoints);
    },
    [model, onPoseJS, onOverlayJS, resize]
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
        frameProcessor={frameProcessor}
      />

      {/* Debug overlay */}
      {showDebug && debugKeypoint && (
        <View className="absolute top-1 left-1 z-15 max-w-2xl rounded bg-black/70 p-2">
          <Text className="font-bold text-white">Keypoint Debug</Text>
          <Text className="text-zinc-400">
            src={srcDims.width}x{srcDims.height}
          </Text>
          {(() => {
            const srcW = srcDims.width; // 1280
            const srcH = srcDims.height; // 720

            // After 90° CW rotation: 720x1280
            const rotatedW = srcH; // 720
            const rotatedH = srcW; // 1280

            // Scale factor: crop → MODEL_SIZE
            const scaleX = rotatedW / MODEL_SIZE; // 720/256 = 2.8125
            const scaleY = rotatedH / MODEL_SIZE; // 1280/256 = 5.0

            const rawX = debugKeypoint.x; // Model output (0-256)
            const rawY = debugKeypoint.y;

            // Model output → crop space (720x720)
            const rotatedX = rawX * scaleX;
            const rotatedY = rawY * scaleY;

            // Normalized in source space
            const normX = rotatedX / rotatedW;
            const normY = rotatedY / rotatedH;

            const cx = normX * viewSize.width;
            const cy = normY * viewSize.height;

            return (
              <>
                <Text style={{ color: '#0f0', fontSize: 9 }}>
                  raw: ({rawX.toFixed(1)}, {rawY.toFixed(1)}) - {debugKeypoint.name ?? 'nose'}
                </Text>
                <Text style={{ color: '#f90', fontSize: 9 }}>
                  rot: ({rotatedX.toFixed(0)}, {rotatedY.toFixed(0)})
                </Text>
                <Text style={{ color: '#f0f', fontSize: 9 }}>
                  norm: ({normX.toFixed(3)}, {normY.toFixed(3)})
                </Text>
                <Text style={{ color: '#f00', fontSize: 9 }}>
                  view: ({cx.toFixed(0)}, {cy.toFixed(0)})
                </Text>
                <Text style={{ color: '#aaa', fontSize: 9 }}>
                  display: ({viewSize.width.toFixed(0)}, {viewSize.height.toFixed(0)})
                </Text>
                <Text style={{ color: '#aaa', fontSize: 9 }}>
                  vis: {debugKeypoint.visibility.toFixed(2)}
                </Text>
                <Text style={{ color: '#aaa', fontSize: 9 }}>
                  pres: {(debugKeypoint.presence ?? 0).toFixed(2)}
                </Text>
              </>
            );
          })()}
        </View>
      )}

      {/* Overlay landmarks */}
      <View className="absolute inset-0">
        <Canvas style={StyleSheet.absoluteFill}>
          {(() => {
            const srcW = srcDims.width;
            const srcH = srcDims.height;

            // After 90° CW rotation: 720x1280
            const rotatedW = srcH;
            const rotatedH = srcW;

            // Scale factor: crop → MODEL_SIZE
            const scaleX = rotatedW / MODEL_SIZE;
            const scaleY = rotatedH / MODEL_SIZE;

            return overlayLandmarks.map((lm, i) => {
              if (!lm.presence || lm.presence < 0.5 || !lm.visibility || lm.visibility < 0.7)
                return null;

              // Model output (0-256) → crop space (720x720)
              const cropX = lm.x * scaleX;
              const cropY = lm.y * scaleY;

              // Normalized in source space
              const normX = cropX / rotatedW;
              const normY = cropY / rotatedH;

              // View coordinates
              const cx = normX * viewSize.width;
              const cy = normY * viewSize.height;

              return (
                <Circle
                  key={`${lm.name ?? 'lm'}_${i}`}
                  cx={cx}
                  cy={cy}
                  r={3}
                  color={getBodyPartColor(lm.name)}
                />
              );
            });
          })()}
        </Canvas>
      </View>
    </View>
  );
}
