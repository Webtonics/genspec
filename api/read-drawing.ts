import type { DrawingRegister, ReadDrawingRequest, ReadDrawingResponse } from '../src/ai/types.js';
import { AiError, aiConfig, errorResponse, guard, json, readJson, structuredCompletion } from './_lib/openai.js';
import { READ_DRAWING_PROMPT, REGISTER_SCHEMA } from './_lib/schemas.js';
import { textLayerSummary } from './_lib/textLayer.js';

const MAX_BODY = 4_200_000; // Vercel accepts request bodies up to about 4.5 MB
const MAX_IMAGES = 5;
const IMAGE_URL = /^data:image\/(png|jpeg|webp);base64,/;

/** POST /api/read-drawing: a P&ID page (images and text layer) in, a drawing register out. */
export async function POST(request: Request): Promise<Response> {
  try {
    const config = aiConfig();
    guard(request, config);
    const req = await readJson<ReadDrawingRequest>(request, MAX_BODY);
    const images = Array.isArray(req.images) ? req.images.slice(0, MAX_IMAGES) : [];
    if (!images.length || images.some((img) => typeof img?.url !== 'string' || !IMAGE_URL.test(img.url))) {
      throw new AiError(400, 'Send the drawing page as PNG, JPEG or WebP data URLs.');
    }
    const layer = textLayerSummary(Array.isArray(req.texts) ? req.texts : []);
    const intro = [
      `Page size: ${Math.round(req.page?.width ?? 0)} x ${Math.round(req.page?.height ?? 0)} points, origin top left.`,
      `Job: ${req.context?.medium ?? 'unknown medium'}, ${req.context?.code ?? 'unknown code'}, test sections ${(req.context?.sections ?? []).join(', ') || 'none yet'}.`,
      layer
        ? `Text found in the PDF, with positions in points:\n${layer}`
        : 'This page has no text layer (probably a scan). Read everything from the images.',
    ].join('\n\n');

    const register = await structuredCompletion<DrawingRegister>(config, {
      name: 'drawing_register',
      schema: REGISTER_SCHEMA,
      system: READ_DRAWING_PROMPT,
      content: [
        { type: 'text', text: intro },
        ...images.flatMap((img) => [
          { type: 'text' as const, text: String(img.label ?? 'Drawing image').slice(0, 80) },
          { type: 'image_url' as const, image_url: { url: img.url, detail: 'high' as const } },
        ]),
      ],
      maxTokens: 16_000,
      timeoutMs: 115_000,
    });
    const body: ReadDrawingResponse = { register, model: config.model };
    return json(200, body);
  } catch (err) {
    return errorResponse(err);
  }
}
