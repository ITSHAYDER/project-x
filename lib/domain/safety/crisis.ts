// Deterministic crisis screen. No LLM is involved in this path, ever.
// This is a coarse keyword screen intended to trigger a static, supportive message with resources.
// It WILL miss some phrasing and will over-trigger on some; have a qualified clinician review and
// extend it before any real use. It is a safety net, not a risk assessment.
const PATTERNS: RegExp[] = [
  /\bsuicid/i,
  /\bkill (myself|me)\b/i,
  /\bend (my|it all|my own) life\b/i,
  /\bwant(ed)? to die\b/i,
  /\bdon'?t want to (be here|live|wake up)\b/i,
  /\bbetter off (dead|without me)\b/i,
  /\b(hurt|harm|cut) (myself|my self)\b/i,
  /\bself[- ]?harm/i,
  /\bno reason to live\b/i,
];

export function crisisScreen(text: string): boolean {
  if (!text) return false;
  return PATTERNS.some((p) => p.test(text));
}
