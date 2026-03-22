export const MODEL_SIZE = 256;

export const LANDMARK_NAMES = [
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

export const BODY_PART_COLORS = {
  head: '#FFD700', // Gold
  torso: '#00CED1', // Dark Cyan
  arms: '#FF6347', // Tomato
  legs: '#32CD32', // Lime Green
  feet: '#9370DB', // Medium Purple
};

export const head = [
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
];

export const torso = ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'];

export const arms = [
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
];

export const legs = ['left_knee', 'right_knee', 'left_ankle', 'right_ankle'];

export const feet = ['left_heel', 'right_heel', 'left_foot_index', 'right_foot_index'];
