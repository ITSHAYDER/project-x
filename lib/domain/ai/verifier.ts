// Deterministic verifier for any AI-worded statement. AI output is never trusted by default.
export interface CandidateStatement {
  type: 'REPORTED' | 'OBSERVED' | 'TOPIC';
  text: string;
  sourceRefs: string[];
}

export interface VerifyContext {
  allowedSourceRefs: Set<string>;
  /** numbers that appear in the deterministic statement(s) this candidate was derived from */
  allowedNumbers: Set<string>;
}

export interface VerifyResult {
  ok: boolean;
  failures: string[];
}

const DIAGNOSTIC = /\b(depress(ed|ion|ive)|bipolar|adhd|ptsd|schizo\w*|borderline|ocd|disorder|diagnos\w*|psychosis|mania|manic|anorexi\w*|bulimi\w*|panic attack)\b/i;
const CAUSAL = /\b(cause[sd]?|causing|because of|due to|leads? to|led to|results? in|resulted in|makes? you|triggered by|is why)\b/i;
const DIRECTIVE = /\b(you should|you must|you need to|you have to|try to|make sure you|i recommend|we recommend|consider taking)\b/i;
const MEDICATION = /\b(medicat\w*|dose|dosage|antidepress\w*|prescri\w*|ssri|benzo\w*|mg)\b/i;
const PREDICTION = /\b(will relapse|likely to (relapse|get worse)|going to (get worse|relapse)|you will|is going to)\b/i;
const CERTAINTY = /\b(definitely|clearly proves?|proves?|certainly|undoubtedly)\b/i;

export function numbersIn(text: string): string[] {
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).map((n) => String(Number(n)));
}

export function verifyStatement(c: CandidateStatement, ctx: VerifyContext): VerifyResult {
  const failures: string[] = [];
  if (!c.sourceRefs || c.sourceRefs.length === 0) failures.push('missing_source_refs');
  for (const r of c.sourceRefs ?? []) if (!ctx.allowedSourceRefs.has(r)) failures.push(`unknown_source_ref:${r}`);
  for (const n of numbersIn(c.text)) if (!ctx.allowedNumbers.has(n)) failures.push(`unsupported_number:${n}`);
  if (DIAGNOSTIC.test(c.text)) failures.push('diagnostic_language');
  if (CAUSAL.test(c.text)) failures.push('causal_language');
  if (DIRECTIVE.test(c.text)) failures.push('directive_language');
  if (MEDICATION.test(c.text)) failures.push('medication_language');
  if (PREDICTION.test(c.text)) failures.push('prediction_language');
  if (CERTAINTY.test(c.text)) failures.push('certainty_language');
  if (c.type === 'TOPIC' && !/(\?|\bmay\b|\bmight\b|\bpossible\b|\bcould\b|\bworth\b)/i.test(c.text)) failures.push('topic_not_phrased_as_possibility');
  if (c.type === 'OBSERVED' && /\b(know|knows|fact)\b/i.test(c.text)) failures.push('observation_phrased_as_fact');
  return { ok: failures.length === 0, failures };
}

export function verifyAll(cs: CandidateStatement[], ctx: VerifyContext): VerifyResult {
  const failures: string[] = [];
  cs.forEach((c, i) => {
    const r = verifyStatement(c, ctx);
    r.failures.forEach((f) => failures.push(`#${i}:${f}`));
  });
  return { ok: failures.length === 0, failures };
}
