import type { JobExtraction, ParseJobRequest, ParseJobResponse } from '../src/ai/types.js';
import { AiError, aiConfig, errorResponse, guard, json, readJson, structuredCompletion } from './_lib/openai.js';
import { JOB_SCHEMA, PARSE_JOB_PROMPT } from './_lib/schemas.js';

const MAX_CHARS = 4000;

/** POST /api/parse-job: plain-English job description in, extracted job data out. Never saves anything. */
export async function POST(request: Request): Promise<Response> {
  try {
    const config = aiConfig();
    guard(request, config);
    const { text } = await readJson<ParseJobRequest>(request, 20_000);
    const description = typeof text === 'string' ? text.trim() : '';
    if (!description) throw new AiError(400, 'Describe the job first.');
    if (description.length > MAX_CHARS) throw new AiError(413, `Keep the description under ${MAX_CHARS} characters.`);

    const extraction = await structuredCompletion<JobExtraction>(config, {
      name: 'job_extraction',
      schema: JOB_SCHEMA,
      system: PARSE_JOB_PROMPT,
      content: [{ type: 'text', text: description }],
      maxTokens: 6000,
      timeoutMs: 55_000,
    });
    const body: ParseJobResponse = { extraction, model: config.model };
    return json(200, body);
  } catch (err) {
    return errorResponse(err);
  }
}
