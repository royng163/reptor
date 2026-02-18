export type Landmark = {
  name: string;
  x: number;
  y: number;
  z: number;
  visibility?: number;
};

export type PoseInferenceResult = {
  landmarks: Landmark[];
  timestamp: number;
};

export type PosePayload = {
  landmarks: Landmark[];
  timestamp: number;
  frameCount: number;
  inferenceMs: number;
};

const LANDMARK_NAMES = [
  'nose',
  'left_eye_inner',
  'left_eye',
  'left_eye_outer',
  'right_eye_inner',
  'right_eye',
  'right_eye_outer',
  'left_ear',
  'right_ear',
  'mouth_left',
  'mouth_right',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_pinky',
  'right_pinky',
  'left_index',
  'right_index',
  'left_thumb',
  'right_thumb',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
  'left_heel',
  'right_heel',
  'left_foot_index',
  'right_foot_index',
] as const;

let DEBUG = false;
export function setPoseDebugMode(v: boolean) {
  DEBUG = v;
}
export function getPoseDebugMode() {
  return DEBUG;
}

/**
 * Worklet-safe decode for BlazePose-style output:
 * expects first tensor shaped like [1, N*5] (x,y,z,visibility,presence)
 */
export function decodePoseOutputs(outputs: unknown[]): Landmark[] {
  'worklet';
  const out0 = outputs?.[0] as ArrayLike<number> | undefined;
  if (!out0 || typeof out0.length !== 'number') return [];

  const dimsPerLm = 5;
  const count = Math.min(LANDMARK_NAMES.length, Math.floor(out0.length / dimsPerLm));
  const result: Landmark[] = [];

  for (let i = 0; i < count; i++) {
    const base = i * dimsPerLm;
    result.push({
      name: LANDMARK_NAMES[i],
      x: Number(out0[base + 0] ?? 0),
      y: Number(out0[base + 1] ?? 0),
      z: Number(out0[base + 2] ?? 0),
      visibility: Number(out0[base + 3] ?? 0),
    });
  }
  return result;
}

/**
 * Legacy API kept for compatibility with old imports.
 */
export async function loadModel(_path?: string) {
  return true;
}
export async function inferFromFrame(_frame: unknown): Promise<PoseInferenceResult> {
  return { landmarks: [], timestamp: Date.now() };
}
