import { useEffect, useState } from "react";

/**
 * Watchdog dev-only que detecta sinais clássicos de build SSR/HMR inconsistente
 * (cache podre do Vite/esbuild, módulo virtual sumido, transform falhando) e
 * mostra um banner orientando a reiniciar o dev server.
 *
 * Não renderiza nada em produção.
 */
const PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /virtual:tanstack-start/i,
  /Transform failed with/i,
  /Switched to client rendering because the server rendering errored/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
];

function isSuspicious(msg: unknown): boolean {
  const s = typeof msg === "string" ? msg : (msg as Error)?.message ?? String(msg ?? "");
  return PATTERNS.some((re) => re.test(s));
}

export function DevWatchdog() {
  const [tripped, setTripped] = useState<string | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const onError = (e: ErrorEvent) => {
      if (isSuspicious(e.message) || isSuspicious(e.error)) {
        setTripped(e.message || String(e.error));
      }
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isSuspicious(e.reason)) {
        setTripped((e.reason as Error)?.message ?? String(e.reason));
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  if (!import.meta.env.DEV || !tripped) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 z-[9999] max-w-sm rounded-lg border border-destructive/40 bg-background/95 p-4 shadow-elevated backdrop-blur"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-destructive" />
        <div className="flex-1 space-y-2">
          <p className="text-sm font-semibold text-foreground">
            Build do dev server inconsistente
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Detectei um erro típico de cache do Vite/esbuild. Peça ao Lovable
            <span className="font-medium text-foreground"> "reinicie o dev server"</span>
            {" "}ou recarregue a página.
          </p>
          <p className="text-[10px] font-mono text-muted-foreground/70 break-all line-clamp-2">
            {tripped}
          </p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Recarregar
            </button>
            <button
              onClick={() => setTripped(null)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Dispensar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
