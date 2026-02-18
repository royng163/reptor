export type Rule = {
  id: string;
  type: 'range' | 'symmetry' | 'stability';
  feature: string;
  threshold: number;
  direction: 'min' | 'max';
};

export type RuleConfig = {
  exercises: Record<string, { rules: Rule[] }>;
  global?: {
    quality_weighting?: Partial<Record<Rule['type'], number>>;
  };
};

export function loadRuleConfig(json: RuleConfig) {
  return json;
}

/**
 * Evaluate aggregated features for one rep.
 * aggFeatures: { [featureName]: number }
 */
export function evaluateRules(
  ruleConfig: RuleConfig,
  exerciseId: string,
  aggFeatures: Record<string, number>
) {
  const out = { errors: [] as string[], quality: 1.0 };
  const ex = ruleConfig.exercises[exerciseId];
  if (!ex) return { ...out, quality: 0.5 }; // unknown exercise: conservative

  const weights = ruleConfig.global?.quality_weighting;
  let score = 1.0;

  ex.rules.forEach((r) => {
    const val = aggFeatures[r.feature];
    if (val == null) return;

    let violated = false;
    if (r.direction === 'min' && val < r.threshold) violated = true;
    if (r.direction === 'max' && val > r.threshold) violated = true;

    if (violated) {
      out.errors.push(r.id);
      const weightedPenalty = weights?.[r.type] ?? 0.1; // replace with distilled scorer model later
      score -= weightedPenalty;
    }
  });

  out.quality = Math.max(0, Math.min(1, Number(score.toFixed(3))));
  return out;
}
