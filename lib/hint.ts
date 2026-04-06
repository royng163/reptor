import { RuleConfig } from '@royng163/reptor-core';

export function generateHint(rule: RuleConfig, featureValue: number | undefined): string {
  const { error_type, feature } = rule;

  if (error_type === 'BAD_SETUP' && feature === 'stance_width_normalized') {
    if (featureValue !== undefined && featureValue > 0) return 'Stand narrower';
    if (featureValue !== undefined && featureValue < 0) return 'Stand wider';
    return 'Adjust your stance width';
  }

  if (error_type === 'INSUFFICIENT_RANGE') return 'Go deeper';

  if (error_type === 'BAD_ALIGNMENT') {
    if (feature === 'knee_joint_center_x_offset') return 'Keep knees in line with toes';
    return 'Improve your alignment';
  }

  if (error_type === 'INSTABILITY') return 'Control your movement';
  if (error_type === 'BAD_TEMPO') return 'Slow down your descent';
  if (error_type === 'MOMENTUM_CHEAT') return 'Use less momentum';

  return rule.description || error_type;
}
