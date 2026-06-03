/**
 * ZapSign backend helper (server-only).
 * Reads credentials from process.env at request time.
 * Never import this file from client-side code.
 */

const DEFAULT_BASE = "https://sandbox.api.zapsign.com.br/api/v1";

export interface ZapSignConfig {
  token: string;
  baseUrl: string;
  webhookSecret?: string;
}

export class ZapSignConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZapSignConfigError";
  }
}

export function getZapSignConfig(): ZapSignConfig {
  const token = process.env.ZAPSIGN_API_TOKEN;
  if (!token) {
    throw new ZapSignConfigError(
      "ZAPSIGN_API_TOKEN não configurado. Adicione o token nos Secrets do projeto.",
    );
  }
  return {
    token,
    baseUrl: (process.env.ZAPSIGN_API_BASE_URL || DEFAULT_BASE).replace(/\/+$/, ""),
    webhookSecret: process.env.ZAPSIGN_WEBHOOK_SECRET,
  };
}

export function maskToken(token: string): string {
  if (!token || token.length < 8) return "••••••••";
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

export interface ZapSignRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  timeoutMs?: number;
}

export async function zapsignRequest<T = unknown>(
  opts: ZapSignRequestOptions,
): Promise<T> {
  const cfg = getZapSignConfig();
  const url = `${cfg.baseUrl}${opts.path.startsWith("/") ? opts.path : `/${opts.path}`}`;
  const ctl = new AbortController();
  const timeout = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 30000);
  try {
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctl.signal,
    });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    if (!res.ok) {
      const msg =
        (parsed && typeof parsed === "object" && "message" in parsed
          ? String((parsed as { message: unknown }).message)
          : null) ||
        (typeof parsed === "string" ? parsed : null) ||
        `ZapSign HTTP ${res.status}`;
      throw new Error(msg);
    }
    return parsed as T;
  } finally {
    clearTimeout(timeout);
  }
}
