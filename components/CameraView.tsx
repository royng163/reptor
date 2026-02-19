import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { Worklets } from 'react-native-worklets-core';
import {
  decodePoseOutputs,
  loadPoseModel,
  type PoseResult,
} from '@/services/evaluation/poseInference';
import { useNavigation } from 'expo-router';
import { useAppState } from '@react-native-community/hooks';

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

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (!model) return;

      const input = resize(frame, {
        scale: { width: 256, height: 256 },
        pixelFormat: 'rgb',
        dataType: 'float32',
      });

      const outputs = model.runSync([input]);
      const landmarks = decodePoseOutputs(outputs as unknown[]);

      onPoseJS({
        landmarks,
        timestamp: Date.now(),
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
        <Text className="text-sm text-zinc-400">No camera found</Text>
      </View>
    );
  }

  return (
    <View className="border-border flex-1 overflow-hidden rounded-xl border">
      <Camera
        style={{ flex: 1 }}
        device={device}
        format={format}
        fps={30}
        isActive={isActive}
        frameProcessor={frameProcessor}
      />
    </View>
  );
}
