/**
 * Server-side OpenAI access for the AI endpoints. The key is read from the
 * environment and never leaves the server. Uses the REST API directly with fetch
 * (Node 20+ and Vercel both provide it), asking for strict JSON-schema output.
 */

/**
 * Used when OPENAI_MODEL is not set. Must read images and support structured outputs.
 * Scored against the sample P&ID's known contents (valves, types, instruments, lines,
 * design data, test limits, PSV blinds), on the vector PDF and a degraded scan:
 * gpt-6-astra was perfect on every run in 30 to 40 s; gpt-5.5 scored 56 to 58 of 58
 * in about 18 s; the gpt-5.6, gpt-6 sol and luna, and gpt-6.1 models often missed the
 * test limit valves or the relief valve blinds.
 */
export const DEFAULT_MODEL = 'gpt-6-astra';

export type AiConfig = { key?: string; model: string; effort?: string; accessCode?: string };

export function aiConfig(): AiConfig {
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const configured = process.env.OPENAI_REASONING_EFFORT?.trim();
  return {
    key: process.env.OPENAI_API_KEY?.trim() || undefined,
    model,
    // Reasoning models think before answering; low effort keeps reading a drawing to seconds, not minutes.
    effort: configured || (/^(o\d|gpt-[5-9])/.test(model) ? 'low' : undefined),
    accessCode: process.env.GENSPEC_ACCESS_CODE?.trim() || undefined,
  };
}

export class AiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** Turn an error into the JSON response the app shows to the user. */
export function errorResponse(err: unknown): Response {
  if (err instanceof AiError) return json(err.status, { error: err.message });
  console.error(err);
  return json(500, { error: 'The AI request failed unexpectedly.' });
}

/** Refuse when AI is not configured, or when an access code is set and the request does not carry it. */
export function guard(request: Request, config: AiConfig): void {
  if (!config.key) throw new AiError(503, 'AI is not set up on this server. Add OPENAI_API_KEY to enable it.');
  if (config.accessCode && request.headers.get('x-genspec-access-code') !== config.accessCode) {
    throw new AiError(401, 'This server needs an access code for the AI features.');
  }
}

export async function readJson<T>(request: Request, maxBytes: number): Promise<T> {
  const text = await request.text();
  if (text.length > maxBytes) throw new AiError(413, 'The request is too large.');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AiError(400, 'The request body is not valid JSON.');
  }
}

type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail: 'high' | 'low' | 'auto' } };

function explainOpenAiError(status: number, body: string, model: string): string {
  let message = '';
  try {
    message = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? '';
  } catch {
    message = body.slice(0, 200);
  }
  if (status === 401) return 'OpenAI rejected the API key. Check OPENAI_API_KEY.';
  if (status === 404 || /model/i.test(message)) return `The model "${model}" is not available for this key. Set OPENAI_MODEL. (${message})`;
  if (status === 429) return 'OpenAI rate limit or quota reached. Try again shortly, or check the billing limits.';
  return `OpenAI error ${status}: ${message || 'no details'}`;
}

/** One chat completion constrained to a JSON schema. Returns the parsed object. */
export async function structuredCompletion<T>(
  config: AiConfig,
  o: { name: string; schema: object; system: string; content: ContentPart[]; maxTokens: number; timeoutMs: number },
): Promise<T> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages: [
      { role: 'system', content: o.system },
      { role: 'user', content: o.content },
    ],
    response_format: { type: 'json_schema', json_schema: { name: o.name, schema: o.schema, strict: true } },
    max_completion_tokens: o.maxTokens,
  };
  if (config.effort) body.reasoning_effort = config.effort;

  const payload = JSON.stringify(body);
  const deadline = Date.now() + o.timeoutMs;
  let res: Response | undefined;
  // One retry when the connection drops before an answer (a reused connection the
  // other side had closed). Never for a timeout or an error answer from OpenAI.
  for (let attempt = 1; !res; attempt++) {
    try {
      res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${config.key}`, 'content-type': 'application/json' },
        body: payload,
        signal: AbortSignal.timeout(Math.max(1000, deadline - Date.now())),
      });
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
      if (timedOut) throw new AiError(504, 'OpenAI took too long to answer. Try again.');
      if (attempt >= 2 || deadline - Date.now() < 5000) throw new AiError(502, 'Could not reach OpenAI. Try again.');
    }
  }
  if (!res.ok) throw new AiError(502, explainOpenAiError(res.status, await res.text(), config.model));

  const data = (await res.json()) as {
    choices?: { finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }[];
  };
  const choice = data.choices?.[0];
  if (choice?.message?.refusal) throw new AiError(422, `The model declined: ${choice.message.refusal}`);
  if (choice?.finish_reason === 'length') throw new AiError(502, 'The answer was cut off before it finished. Try again.');
  const content = choice?.message?.content;
  if (!content) throw new AiError(502, 'OpenAI returned an empty answer.');
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new AiError(502, 'OpenAI returned an answer that was not valid JSON.');
  }
}
