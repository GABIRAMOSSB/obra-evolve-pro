import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/diagnostico")({
  component: DiagnosticoPage,
  head: () => ({
    meta: [
      { title: "Diagnóstico de Conexão — SOLV Gestão" },
      { name: "description", content: "Verifique DNS, CORS e conectividade com o backend." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type CheckStatus = "pending" | "running" | "pass" | "fail";

interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  message?: string;
  detail?: string;
  durationMs?: number;
}

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  "https://lxpdktwkdcsxhejuylsm.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

function classifyError(e: unknown): { message: string; detail: string } {
  if (e instanceof Error) {
    const msg = e.message || e.name;
    const lower = msg.toLowerCase();
    let hint = "";
    if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("load failed")) {
      hint =
        "Falha de rede: provavelmente o domínio supabase.co está bloqueado por firewall, proxy corporativo, VPN, extensão do navegador (ad-blocker) ou DNS. Teste em outra rede (ex.: 4G/celular).";
    } else if (lower.includes("cors")) {
      hint = "Bloqueio CORS: a origem atual não é permitida pelo servidor.";
    } else if (lower.includes("aborted") || lower.includes("timeout")) {
      hint = "A requisição excedeu o tempo limite (DNS lento ou rede instável).";
    } else if (lower.includes("certificate") || lower.includes("ssl") || lower.includes("tls")) {
      hint = "Problema de certificado TLS/SSL — inspeção de tráfego corporativo pode estar interferindo.";
    }
    return { message: msg, detail: [hint, e.stack].filter(Boolean).join("\n\n") };
  }
  return { message: String(e), detail: "" };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await promise;
  } finally {
    clearTimeout(timer);
  }
}

function DiagnosticoPage() {
  const [checks, setChecks] = useState<Check[]>([
    { id: "internet", label: "Conectividade geral (internet)", status: "pending" },
    { id: "dns", label: "Resolução DNS do backend (supabase.co)", status: "pending" },
    { id: "cors", label: "Preflight CORS do backend", status: "pending" },
    { id: "rest", label: "Data API (REST) responde", status: "pending" },
    { id: "auth", label: "Auth API responde", status: "pending" },
    { id: "realtime", label: "Realtime (WebSocket)", status: "pending" },
  ]);
  const [running, setRunning] = useState(false);
  const [env, setEnv] = useState<Record<string, string>>({});

  const update = (id: string, patch: Partial<Check>) =>
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const run = async () => {
    setRunning(true);
    setEnv({
      "URL do backend": SUPABASE_URL,
      Origem: typeof window !== "undefined" ? window.location.origin : "-",
      "User-Agent": typeof navigator !== "undefined" ? navigator.userAgent : "-",
      Online: typeof navigator !== "undefined" ? String(navigator.onLine) : "-",
      Idioma: typeof navigator !== "undefined" ? navigator.language : "-",
      "Chave publicável": SUPABASE_KEY ? "presente" : "ausente",
    });

    // 1. Internet
    update("internet", { status: "running" });
    {
      const t0 = performance.now();
      try {
        await fetch("https://www.google.com/generate_204", { mode: "no-cors", cache: "no-store" });
        update("internet", {
          status: "pass",
          message: "Internet OK",
          durationMs: Math.round(performance.now() - t0),
        });
      } catch (e) {
        const { message, detail } = classifyError(e);
        update("internet", {
          status: "fail",
          message,
          detail: `${detail}\n\nSem internet ou navegador em modo offline.`,
          durationMs: Math.round(performance.now() - t0),
        });
      }
    }

    // 2. DNS (heurístico via HEAD/opaque)
    update("dns", { status: "running" });
    {
      const t0 = performance.now();
      try {
        await withTimeout(
          fetch(`${SUPABASE_URL}/favicon.ico`, { mode: "no-cors", cache: "no-store" }),
          8000,
        );
        update("dns", {
          status: "pass",
          message: `Host ${new URL(SUPABASE_URL).hostname} alcançável`,
          durationMs: Math.round(performance.now() - t0),
        });
      } catch (e) {
        const { message, detail } = classifyError(e);
        update("dns", {
          status: "fail",
          message,
          detail: `${detail}\n\nO domínio ${SUPABASE_URL} não respondeu. Causa comum: bloqueio de rede/firewall corporativo, VPN, DNS ou extensão do navegador.`,
          durationMs: Math.round(performance.now() - t0),
        });
      }
    }

    // 3. CORS preflight (via GET simples ao REST)
    update("cors", { status: "running" });
    {
      const t0 = performance.now();
      try {
        const res = await withTimeout(
          fetch(`${SUPABASE_URL}/rest/v1/`, {
            method: "GET",
            headers: SUPABASE_KEY
              ? { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
              : {},
          }),
          8000,
        );
        const allow = res.headers.get("access-control-allow-origin");
        update("cors", {
          status: "pass",
          message: `CORS OK (status ${res.status}${allow ? `, allow-origin: ${allow}` : ""})`,
          durationMs: Math.round(performance.now() - t0),
        });
      } catch (e) {
        const { message, detail } = classifyError(e);
        update("cors", {
          status: "fail",
          message,
          detail,
          durationMs: Math.round(performance.now() - t0),
        });
      }
    }

    // 4. REST
    update("rest", { status: "running" });
    {
      const t0 = performance.now();
      try {
        const res = await withTimeout(
          fetch(`${SUPABASE_URL}/rest/v1/?select=1`, {
            headers: SUPABASE_KEY
              ? { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
              : {},
          }),
          10000,
        );
        update("rest", {
          status: res.ok || res.status < 500 ? "pass" : "fail",
          message: `HTTP ${res.status} ${res.statusText}`,
          durationMs: Math.round(performance.now() - t0),
        });
      } catch (e) {
        const { message, detail } = classifyError(e);
        update("rest", { status: "fail", message, detail, durationMs: Math.round(performance.now() - t0) });
      }
    }

    // 5. Auth
    update("auth", { status: "running" });
    {
      const t0 = performance.now();
      try {
        const res = await withTimeout(
          fetch(`${SUPABASE_URL}/auth/v1/health`, {
            headers: SUPABASE_KEY ? { apikey: SUPABASE_KEY } : {},
          }),
          8000,
        );
        update("auth", {
          status: res.ok ? "pass" : "fail",
          message: `HTTP ${res.status} ${res.statusText}`,
          durationMs: Math.round(performance.now() - t0),
        });
      } catch (e) {
        const { message, detail } = classifyError(e);
        update("auth", { status: "fail", message, detail, durationMs: Math.round(performance.now() - t0) });
      }
    }

    // 6. Realtime WS
    update("realtime", { status: "running" });
    await new Promise<void>((resolve) => {
      const t0 = performance.now();
      const wsUrl = `${SUPABASE_URL.replace(/^http/, "ws")}/realtime/v1/websocket${
        SUPABASE_KEY ? `?apikey=${encodeURIComponent(SUPABASE_KEY)}&vsn=1.0.0` : ""
      }`;
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch (e) {
        const { message, detail } = classifyError(e);
        update("realtime", { status: "fail", message, detail });
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        try { ws.close(); } catch { /* noop */ }
        update("realtime", {
          status: "fail",
          message: "Timeout ao abrir WebSocket",
          detail: "Muitos firewalls/proxies bloqueiam WebSockets (wss://).",
          durationMs: Math.round(performance.now() - t0),
        });
        resolve();
      }, 8000);
      ws.onopen = () => {
        clearTimeout(timer);
        try { ws.close(); } catch { /* noop */ }
        update("realtime", {
          status: "pass",
          message: "WebSocket conectado",
          durationMs: Math.round(performance.now() - t0),
        });
        resolve();
      };
      ws.onerror = (ev) => {
        clearTimeout(timer);
        update("realtime", {
          status: "fail",
          message: "Erro no WebSocket",
          detail: `Evento: ${(ev as Event).type}. Verifique bloqueio de wss:// no firewall/proxy.`,
          durationMs: Math.round(performance.now() - t0),
        });
        resolve();
      };
    });

    setRunning(false);
  };

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const report = () => {
    const lines: string[] = [];
    lines.push("=== Diagnóstico SOLV Gestão ===");
    lines.push(new Date().toISOString());
    lines.push("");
    for (const [k, v] of Object.entries(env)) lines.push(`${k}: ${v}`);
    lines.push("");
    for (const c of checks) {
      lines.push(`[${c.status.toUpperCase()}] ${c.label}${c.durationMs != null ? ` (${c.durationMs}ms)` : ""}`);
      if (c.message) lines.push(`  → ${c.message}`);
      if (c.detail) lines.push(c.detail.split("\n").map((l) => `    ${l}`).join("\n"));
    }
    return lines.join("\n");
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report());
      alert("Relatório copiado para a área de transferência.");
    } catch {
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(`<pre style="font:12px/1.4 monospace;padding:16px">${report().replace(/</g, "&lt;")}</pre>`);
      }
    }
  };

  const badge = (s: CheckStatus) => {
    const map: Record<CheckStatus, string> = {
      pending: "bg-gray-200 text-gray-700",
      running: "bg-blue-100 text-blue-700 animate-pulse",
      pass: "bg-emerald-100 text-emerald-700",
      fail: "bg-red-100 text-red-700",
    };
    const label = { pending: "AGUARDANDO", running: "TESTANDO…", pass: "OK", fail: "FALHOU" }[s];
    return <span className={`text-[10px] font-bold px-2 py-1 rounded ${map[s]}`}>{label}</span>;
  };

  const anyFail = checks.some((c) => c.status === "fail");

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Diagnóstico de Conexão</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verifica DNS, CORS, HTTPS e WebSocket até o backend. Use esta página quando o app não
            carregar ou aparecer "domínio bloqueado".
          </p>
        </header>

        <section className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold mb-2">Ambiente</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {Object.entries(env).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="text-muted-foreground">{k}:</dt>
                <dd className="font-mono break-all">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="space-y-2">
          {checks.map((c) => (
            <div key={c.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-sm">{c.label}</div>
                <div className="flex items-center gap-2">
                  {c.durationMs != null && (
                    <span className="text-[10px] text-muted-foreground">{c.durationMs}ms</span>
                  )}
                  {badge(c.status)}
                </div>
              </div>
              {c.message && (
                <p
                  className={`mt-2 text-xs font-mono ${
                    c.status === "fail" ? "text-red-700" : "text-muted-foreground"
                  }`}
                >
                  {c.message}
                </p>
              )}
              {c.detail && (
                <pre className="mt-2 text-[11px] whitespace-pre-wrap bg-muted/50 rounded p-2 max-h-48 overflow-auto">
                  {c.detail}
                </pre>
              )}
            </div>
          ))}
        </section>

        {anyFail && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <strong>Provável bloqueio de rede.</strong> Se você vê "supabase.co está bloqueado",
            geralmente é um firewall corporativo, VPN, proxy, DNS interno ou extensão do navegador
            (ad-blocker/anti-tracking) filtrando o domínio. Teste em outra rede (ex.: 4G) e/ou
            desative extensões. Envie o relatório abaixo para o suporte.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void run()}
            disabled={running}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {running ? "Executando…" : "Rodar novamente"}
          </button>
          <button
            onClick={copyReport}
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium"
          >
            Copiar relatório
          </button>
          <a
            href="/"
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}
