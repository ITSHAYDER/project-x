// Minimal Gemini REST client with typed errors, timeouts and safe handling of blocked/empty output.
// The model name is configurable because model names are retired over time: run
// `npm run ai:diagnose` to list the models your key can use.
export type AiErrorCode = 'AI_NOT_CONFIGURED' | 'AI_RATE_LIMITED' | 'AI_BLOCKED' | 'AI_TIMEOUT' | 'AI_BAD_OUTPUT' | 'AI_HTTP_ERROR';

export class AiError extends Error {
  code: AiErrorCode;
  status?: number;
  constructor(code: AiErrorCode, message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const AI_MESSAGES: Record<AiErrorCode, string> = {
  AI_NOT_CONFIGURED: 'AI wording is not set up. Everything here still works without it.',
  AI_RATE_LIMITED: 'The AI service is busy right now. The summary below is shown without AI wording.',
  AI_BLOCKED: 'The AI service declined to process this content. The summary below is shown without AI wording.',
  AI_TIMEOUT: 'The AI service took too long. The summary below is shown without AI wording.',
  AI_BAD_OUTPUT: 'The AI wording did not pass our safety checks, so it was not used.',
  AI_HTTP_ERROR: 'The AI service returned an error. The summary below is shown without AI wording.',
};

export function aiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export async function generateJson(system: string, userJson: unknown, timeoutMs = 20000): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AiError('AI_NOT_CONFIGURED', 'GEMINI_API_KEY is not set');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      signal: ctrl.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(userJson) }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
    });
    if (res.status === 429) throw new AiError('AI_RATE_LIMITED', 'rate limited', 429);
    if (!res.ok) throw new AiError('AI_HTTP_ERROR', `HTTP ${res.status}`, res.status); // never log the body
    const body = (await res.json()) as {
      promptFeedback?: { blockReason?: string };
      candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>;
    };
    if (body.promptFeedback?.blockReason) throw new AiError('AI_BLOCKED', 'prompt blocked');
    const cand = body.candidates?.[0];
    if (!cand || cand.finishReason === 'SAFETY') throw new AiError('AI_BLOCKED', 'response blocked');
    const text = cand.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) throw new AiError('AI_BAD_OUTPUT', 'empty output');
    try {
      return JSON.parse(text);
    } catch {
      throw new AiError('AI_BAD_OUTPUT', 'not json');
    }
  } catch (e) {
    if (e instanceof AiError) throw e;
    if ((e as { name?: string }).name === 'AbortError') throw new AiError('AI_TIMEOUT', 'timeout');
    throw new AiError('AI_HTTP_ERROR', 'network error');
  } finally {
    clearTimeout(timer);
  }
}
