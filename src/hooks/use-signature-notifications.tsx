import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/hooks/use-company";

const STATUS_MESSAGES: Record<string, { title: string; type: "success" | "warning" | "error" }> = {
  signed: { title: "Documento assinado", type: "success" },
  partially_signed: { title: "Assinatura parcial recebida", type: "success" },
  refused: { title: "Documento recusado", type: "error" },
  expired: { title: "Documento expirou", type: "warning" },
  canceled: { title: "Pedido cancelado", type: "warning" },
  error: { title: "Erro no documento", type: "error" },
};

/**
 * Escuta mudanças de status nos pedidos de assinatura da empresa e mostra
 * notificações in-app quando algo importante muda (via Supabase Realtime).
 */
export function useSignatureNotifications() {
  const qc = useQueryClient();
  const { company } = useCompany();
  const seen = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!company?.id) return;

    const channel = supabase
      .channel(`signature-notifications:${company.id}`, {
        config: { private: true },
      })
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "signature_requests",
          filter: `company_id=eq.${company.id}`,
        },
        (payload) => {
          const next = payload.new as { id: string; status: string; document_name: string };
          const prev = payload.old as { status?: string };
          if (!next?.id || !next?.status) return;
          if (prev?.status === next.status) return;
          const lastSeen = seen.current.get(next.id);
          if (lastSeen === next.status) return;
          seen.current.set(next.id, next.status);

          const cfg = STATUS_MESSAGES[next.status];
          if (cfg) {
            const fn =
              cfg.type === "success"
                ? toast.success
                : cfg.type === "error"
                  ? toast.error
                  : toast.warning;
            fn(cfg.title, { description: next.document_name });
          }
          qc.invalidateQueries({ queryKey: ["signature-requests"] });
          qc.invalidateQueries({ queryKey: ["signature-request"] });
          qc.invalidateQueries({ queryKey: ["signature-report"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id, qc]);
}
