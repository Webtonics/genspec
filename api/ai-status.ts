import type { AiStatus } from '../src/ai/types';
import { aiConfig, json } from './_lib/openai.js';

/** GET /api/ai-status: whether the AI features are available, without revealing the key. */
export function GET(): Response {
  const config = aiConfig();
  const status: AiStatus = { enabled: Boolean(config.key), model: config.key ? config.model : null, accessCode: Boolean(config.accessCode) };
  return json(200, status);
}
