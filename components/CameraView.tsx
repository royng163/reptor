import React, { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { Worklets } from 'react-native-worklets-core';
import { decodePoseOutputs, type PosePayload } from '@/services/evaluation/inferenceService';

export default function CameraView({ onPose }: { onPose: (payload: PosePayload) => void }) {
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const { resize } = useResizePlugin();
  let workletFrameCount = 0;

  const modelState = useTensorflowModel(
    require('@/assets/models//blazepose/blazepose_lite.tflite')
  );
  const model = modelState.state === 'loaded' ? modelState.model : undefined;

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  const onPoseJS = useMemo(() => Worklets.createRunOnJS(onPose), [onPose]);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (!model) return;

      const input = resize(frame, {
        scale: { width: 256, height: 256 },
        pixelFormat: 'rgb',
        dataType: 'float32',
      });

      const t0 = global.performance?.now?.() ?? Date.now();
      const outputs = model.runSync([input]);
      const t1 = global.performance?.now?.() ?? Date.now();

      const landmarks = decodePoseOutputs(outputs as unknown[]);
      workletFrameCount += 1;

      onPoseJS({
        landmarks,
        timestamp: Date.now(),
        frameCount: workletFrameCount,
        inferenceMs: t1 - t0,
      });
    },
    [model, onPoseJS, resize]
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
        <Text className="text-sm text-zinc-400">No camera device</Text>
      </View>
    );
  }

  return (
    <View className="border-border flex-1 overflow-hidden rounded-xl border">
      <Camera
        style={{ flex: 1 }}
        device={device}
        isActive
        pixelFormat="yuv"
        frameProcessor={frameProcessor}
        frameProcessorFps={10}
      />
    </View>
  );
}
