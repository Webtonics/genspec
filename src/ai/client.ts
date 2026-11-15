/**
 * Browser side of the AI features. Talks only to this app's own /api routes;
 * the OpenAI key stays on the server.
 */
import { useEffect, useState } from 'react';
import { useAiStore } from './aiStore';
import type { AiStatus, ParseJobResponse, ReadDrawingRequest, ReadDrawingResponse } from './types';

export class AiRequestError extends Error {
  /** HTTP status; 0 when the server could not be reached. 401 means an access code is needed. */
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const code = useAiStore.getState().accessCode;
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(code ? { 'x-genspec-access-code': code } : {}) },
      signal: init.timeoutMs ? AbortSignal.timeout(init.timeoutMs) : undefined,
    });
  } catch (err) {
    const timedOut = err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError');
    throw new AiRequestError(0, timedOut ? 'The AI took too long to answer. Try again.' : 'Could not reach the server.');
  }
  // Static hosting without the /api functions answers with the app's index.html.
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) {
    throw new AiRequestError(404, 'The AI service is not available on this server.');
  }
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new AiRequestError(res.status, body.error ?? `The AI request failed (${res.status}).`);
  return body;
}

export function parseJob(text: string): Promise<ParseJobResponse> {
  return call('/api/parse-job', { method: 'POST', body: JSON.stringify({ text }), timeoutMs: 70_000 });
}

export function readDrawing(req: ReadDrawingRequest): Promise<ReadDrawingResponse> {
  return call('/api/read-drawing', { method: 'POST', body: JSON.stringify(req), timeoutMs: 130_000 });
}

const OFF: AiStatus = { enabled: false, model: null, accessCode: false };
let statusPromise: Promise<AiStatus> | null = null;

/** Whether this server has AI switched on. Asked once per session. */
export function fetchAiStatus(): Promise<AiStatus> {
  statusPromise ??= call<AiStatus>('/api/ai-status', { timeoutMs: 10_000 }).catch(() => OFF);
  return statusPromise;
}

/** AI availability, or null while checking. */
export function useAiStatus(): AiStatus | null {
  const [status, setStatus] = useState<AiStatus | null>(null);
  useEffect(() => {
    let live = true;
    fetchAiStatus().then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, []);
  return status;
}
