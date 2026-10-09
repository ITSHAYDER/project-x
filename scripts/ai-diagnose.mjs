// Diagnoses the AI pipeline stage by stage. Run: npm run ai:diagnose
// Reads GEMINI_API_KEY / GEMINI_MODEL from the environment (or a .env.local file in this folder).
// Never prints the key, request bodies or any response content.
import { readFileSync, existsSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  if (existsSync(f)) {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
const key = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const results = [];
const step = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };

step('1. GEMINI_API_KEY is set (server-side env)', !!key, key ? `length ${key.length}` : 'Set it in .env.local, and in your host\'s environment for Production/Preview, then redeploy.');
if (!key) process.exit(1);

let models = [];
try {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } });
  if (r.status === 400 || r.status === 403) { step('2. Key accepted by the API', false, `HTTP ${r.status}: key invalid, restricted, or API not enabled for this project/region`); process.exit(1); }
  if (r.status === 429) { step('2. Key accepted by the API', false, 'HTTP 429: quota or rate limit'); process.exit(1); }
  if (!r.ok) { step('2. Key accepted by the API', false, `HTTP ${r.status}`); process.exit(1); }
  const body = await r.json();
  models = (body.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace(/^models\//, ''));
  step('2. Key accepted by the API', true, `${models.length} models can generateContent`);
} catch (e) { step('2. Key accepted by the API', false, 'network error: ' + (e?.message || 'unknown') + ' (offline, proxy or firewall?)'); process.exit(1); }

const found = models.includes(model);
step(`3. Configured model "${model}" exists for this key`, found, found ? '' : `Model names get retired. Try one of: ${models.filter((m) => /flash|pro/.test(m)).slice(0, 8).join(', ')}`);

if (found) {
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Return JSON: {"ok": true}' }] }], generationConfig: { responseMimeType: 'application/json' } }),
    });
    if (r.status === 429) step('4. Test generation', false, 'HTTP 429 rate limited / quota');
    else if (!r.ok) step('4. Test generation', false, `HTTP ${r.status}`);
    else {
      const b = await r.json();
      const c = b.candidates?.[0];
      if (b.promptFeedback?.blockReason) step('4. Test generation', false, `blocked: ${b.promptFeedback.blockReason}`);
      else if (!c || c.finishReason === 'SAFETY') step('4. Test generation', false, 'response blocked by safety filter');
      else {
        const text = c.content?.parts?.map((p) => p.text || '').join('') || '';
        try { JSON.parse(text); step('4. Test generation returns valid JSON', true); } catch { step('4. Test generation returns valid JSON', false, 'output was not JSON'); }
      }
    }
  } catch (e) { step('4. Test generation', false, 'network error'); }
}
console.log('\nIn-app failure modes are mapped to typed errors (AI_NOT_CONFIGURED, AI_RATE_LIMITED, AI_BLOCKED, AI_TIMEOUT, AI_BAD_OUTPUT, AI_HTTP_ERROR) and shown to the user; the product keeps working without AI.');
process.exit(results.every((r) => r.ok) ? 0 : 1);
