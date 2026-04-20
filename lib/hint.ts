import { ExerciseId, RuleConfig } from '@royng163/reptor-core';

export function generateHint(
  rule: RuleConfig,
  featureValue: number | undefined,
  exerciseId?: ExerciseId
): string {
  const { error_type, feature, type, targetPhase } = rule;

  if (error_type === 'INSUFFICIENT_RANGE') {
    if (exerciseId === 'squat') {
      return 'Go lower';
    }
    if (exerciseId === 'bicep_curl') {
      if (rule.targetPhase === 'ECCENTRIC') return 'Lower fully';
      return 'Squeeze at the top';
    }
    if (exerciseId === 'bench_press') {
      return 'Touch the chest';
    }
    if (exerciseId === 'lat_pulldown') {
      return 'Pull to upper chest';
    }
    if (exerciseId === 'shoulder_press') {
      return 'Lock out overhead';
    }
    return 'Go deeper';
  }

  if (error_type === 'BAD_SETUP') {
    if (feature === 'stance_width_normalized') {
      if (featureValue !== undefined && featureValue > 0) return 'Stand narrower';
      if (featureValue !== undefined && featureValue < 0) return 'Stand wider';
    }
    return 'Adjust your setup';
  }

  if (error_type === 'BAD_ALIGNMENT') {
    if (exerciseId === 'squat' && feature === 'knee_joint_center_x_offset')
      return 'Keep knees over toes';
    if (exerciseId === 'squat' && feature === 'trunk_angle') return 'Keep chest up';
    if (exerciseId === 'bicep_curl' && feature === 'torso_tilt') return 'Stay upright';
    if (exerciseId === 'bench_press' && feature === 'trunk_angle') return 'Keep back arched';
    if (exerciseId === 'lat_pulldown' && feature === 'torso_tilt') return 'Lean back slightly';
    return 'Fix your form';
  }

  if (error_type === 'INSTABILITY') {
    if (exerciseId === 'squat') return 'Control the squat';
    return 'Control the movement';
  }

  if (error_type === 'BAD_TEMPO') {
    if (exerciseId === 'squat') return 'Slow down your descent';
    if (exerciseId === 'bench_press') return 'Slow down the descent';
    return 'Slow down the movement';
  }

  if (error_type === 'MOMENTUM_CHEAT') {
    if (exerciseId === 'bicep_curl') return "Don't swing";
    if (exerciseId === 'squat') return "Don't hip drive";
    return 'Use controlled motion';
  }

  if (error_type === 'ASYMMETRY') {
    if (exerciseId === 'bench_press') return 'Even the bar path';
    if (exerciseId === 'lat_pulldown') return 'Use both arms';
    return 'Keep balanced';
  }

  return rule.description || error_type;
}
