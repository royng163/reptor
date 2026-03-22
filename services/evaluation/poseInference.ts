import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import { LANDMARK_NAMES } from '@/lib/constant';
import { Keypoint } from '@royng163/reptor-core';

let DEBUG = false;
export function setPoseDebugMode(v: boolean) {
  DEBUG = v;
}
export function getPoseDebugMode() {
  return DEBUG;
}

// Singleton pattern to load and cache the pose model
let poseModel: TensorflowModel | null = null;
let poseModelPromise: Promise<TensorflowModel> | null = null;

export async function loadPoseModel(): Promise<TensorflowModel> {
  if (poseModel) return poseModel;

  if (!poseModelPromise) {
    poseModelPromise = loadTensorflowModel(
      require('@/assets/models/blazepose/blazepose_lite.tflite')
    )
      .then((m) => {
        poseModel = m;
        return m;
      })
      .catch((e) => {
        poseModelPromise = null;
        throw e;
      });
  }

  return poseModelPromise;
}

/**
 * Worklet-safe decode for BlazePose-style output:
 * expects first tensor shaped like [1, N*5] (x,y,z,visibility,presence)
 */
function sigmoid(x: number): number {
  'worklet';
  return 1 / (1 + Math.exp(-x));
}

export function decodePoseOutputs(outputs: unknown[]): Keypoint[] {
  'worklet';
  const out0 = outputs[0] as number[];
  const count = 33;
  const result: Keypoint[] = [];

  for (let i = 0; i < count; i++) {
    const base = i * 5;
    result.push({
      x: out0[base + 0],
      y: out0[base + 1],
      z: out0[base + 2] || 0,
      visibility: sigmoid(out0[base + 3]),
      presence: sigmoid(out0[base + 4]),
      name: LANDMARK_NAMES[i],
    });
  }
  return result;
}
