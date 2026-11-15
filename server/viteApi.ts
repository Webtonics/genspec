/**
 * Serves the /api functions inside `vite` (dev) and `vite preview`, so the app
 * runs locally exactly as it does on Vercel: same handler files, same env names.
 * Reads OPENAI_API_KEY and friends from .env / .env.local. Nothing here ships to the browser.
 */
import { existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { type Connect, type Plugin, loadEnv } from 'vite';

const ENV_KEYS = ['OPENAI_API_KEY', 'OPENAI_MODEL', 'OPENAI_REASONING_EFFORT', 'GENSPEC_ACCESS_CODE'];
const ROUTE = /^\/api\/([a-z0-9-]+)\/?(?:\?.*)?$/;
const MAX_BODY = 6_000_000;

type Module = Record<string, unknown>;
type Handler = (request: Request) => Response | Promise<Response>;

/**
 * Copy the AI settings from the env files into process.env, where the handlers read
 * them (as on Vercel). Vite restarts the server when an env file changes, so values
 * set here on a previous start are cleared first; real shell variables always win.
 */
function applyEnv(mode: string, envDir: string) {
  const g = globalThis as { __genspecEnvFromFile?: Set<string> };
  const fromFile = (g.__genspecEnvFromFile ??= new Set());
  for (const key of fromFile) delete process.env[key];
  fromFile.clear();
  const env = loadEnv(mode, envDir, ['OPENAI_', 'GENSPEC_']);
  for (const key of ENV_KEYS) {
    if (env[key] === undefined || process.env[key] !== undefined) continue;
    process.env[key] = env[key];
    fromFile.add(key);
  }
}

async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('Request body too large');
    chunks.push(chunk);
  }
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  return new Request(url, { method, headers, body: method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks) });
}

async function send(res: ServerResponse, response: Response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function middleware(root: string, load: (file: string) => Promise<Module>): Connect.NextHandleFunction {
  return (req, res, next) => {
    const match = ROUTE.exec(req.url ?? '');
    if (!match) return next();
    const file = path.join(root, 'api', `${match[1]}.ts`);
    if (!existsSync(file)) return sendJson(res, 404, { error: `No API route /api/${match[1]}` });
    (async () => {
      const mod = await load(file);
      const handler = mod[req.method ?? 'GET'];
      if (typeof handler !== 'function') return sendJson(res, 405, { error: 'Method not allowed' });
      await send(res, await (handler as Handler)(await toRequest(req)));
    })().catch((err: unknown) => {
      console.error('[api]', err);
      if (!res.headersSent) sendJson(res, 500, { error: 'The API route failed.' });
    });
  };
}

/** For `vite preview`, which has no module graph: compile the handler with tsx, once per file. */
const previewModules = new Map<string, Promise<Module>>();
function loadWithTsx(file: string): Promise<Module> {
  let mod = previewModules.get(file);
  if (!mod) {
    mod = import('tsx/esm/api').then(({ tsImport }) => tsImport(pathToFileURL(file).href, import.meta.url) as Promise<Module>);
    previewModules.set(file, mod);
  }
  return mod;
}

export function apiPlugin(): Plugin {
  let root = process.cwd();
  return {
    name: 'genspec-api',
    configResolved(config) {
      root = config.root;
      applyEnv(config.mode, typeof config.envDir === 'string' ? config.envDir : root);
    },
    configureServer(server) {
      // Loaded through Vite on every request, so edits to the handlers apply without a restart.
      server.middlewares.use(middleware(root, (file) => server.ssrLoadModule(file)));
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(root, loadWithTsx));
    },
  };
}
