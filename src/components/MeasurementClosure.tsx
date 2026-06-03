import { useMemo, useState } from "react";
import type { ProjectData, MeasurementAuditEntry, Evolution } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Lock, LockOpen, FileText, History } from "lucide-react";
import { toast } from "sonner";
import { buildMeasurementPdfBlob } from "@/lib/pdf";
import { uploadDocumentBlob } from "@/lib/documents";
import { activityMetrics, projectMetrics, fmtBRL, fmtNum } from "@/lib/calc";

interface Props {
  data: ProjectData;
  setData: (d: ProjectData) => void;
  companyId: string;
  userId: string;
  userEmail: string;
  isAdmin: boolean;
  variant?: "card" | "inline";
}

function currentNumber(p: ProjectData): number {
  if (p.currentMeasurement && p.currentMeasurement > 0) return p.currentMeasurement;
  let maxClosed = 0;
  for (const evo of Object.values(p.evolutions || {})) {
    for (const m of evo?.measurements ?? []) {
      if (m.closed && m.number > maxClosed) maxClosed = m.number;
    }
  }
  return maxClosed + 1;
}

export function MeasurementClosure({
  data,
  setData,
  companyId,
  userId,
  userEmail,
  isAdmin,
  variant = "card",
}: Props) {
  const current = currentNumber(data);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Summary of current measurement — considers all OPEN measurements and
  // legacy entries (top-level quantExec). Closed measurements are ignored.
  const summary = useMemo(() => {
    let itensLancados = 0;
    let valorPeriodo = 0;
    let qtdPeriodo = 0;
    for (const r of data.rows) {
      if (r.isGroup) continue;
      const evo = data.evolutions[r.item];
      if (!evo) continue;
      const list = evo.measurements ?? [];
      let qPeriodo = 0;
      for (const m of list) {
        if (!m.closed) qPeriodo += m.quantExec || 0;
      }
      // Legacy format: quantExec at top level with no measurements array
      if (list.length === 0 && (evo.quantExec || 0) > 0) {
        qPeriodo += evo.quantExec || 0;
      }
      if (qPeriodo <= 0) continue;
      itensLancados++;
      qtdPeriodo += qPeriodo;
      if (r.quantidade > 0) {
        valorPeriodo += (qPeriodo / r.quantidade) * (r.total || 0);
      }
    }
    const m = projectMetrics(data.rows, data.evolutions);
    return { itensLancados, valorPeriodo, qtdPeriodo, percentGeral: m.percent, execTotal: m.exec };
  }, [data, current]);

  const log: MeasurementAuditEntry[] = data.measurementLog ?? [];

  async function handleClose() {
    if (summary.itensLancados === 0) {
      toast.error("Nenhum item executado nesta medição.", {
        description: "Lance ao menos uma quantidade antes de fechar.",
      });
      return;
    }
    // Validação dos campos obrigatórios da obra
    const info = data.info ?? {};
    const required: Array<[keyof typeof info, string]> = [
      ["cliente", "Licitador"],
      ["contratante", "Contratante"],
      ["empresaExecutora", "Empresa executora"],
      ["cnpj", "CNPJ"],
      ["endereco", "Endereço"],
      ["municipio", "Município"],
      ["estado", "UF"],
      ["numeroContrato", "Nº contrato"],
      ["responsavelTecnico", "Responsável técnico"],
      ["crea", "CREA/CAU"],
      ["dataInicioObra", "Data de início"],
    ];
    const missing = required.filter(([k]) => !info[k] || String(info[k]).trim() === "");
    if (missing.length > 0) {
      toast.error("Cadastro da obra incompleto.", {
        description: `Preencha em Dados da obra: ${missing.map(([, l]) => l).join(", ")}.`,
      });
      return;
    }
    setBusy(true);
    try {
      const closedAt = new Date();
      const closedAtIso = closedAt.toISOString();
      const today = closedAtIso.slice(0, 10);
      // Consolidate all OPEN measurements + legacy quantExec into a single
      // closed measurement numbered `current` for each item.
      const newEvolutions: Record<string, Evolution> = {};
      for (const [k, evo] of Object.entries(data.evolutions)) {
        const list = evo?.measurements ?? [];
        const closedOnes = list.filter((m) => m.closed);
        const openOnes = list.filter((m) => !m.closed);
        const legacyQty =
          list.length === 0 ? (evo?.quantExec || 0) : 0;
        const periodoQty =
          openOnes.reduce((s, m) => s + (m.quantExec || 0), 0) + legacyQty;
        if (periodoQty > 0) {
          const baseOpen = openOnes[0];
          const consolidated = {
            id: baseOpen?.id ?? crypto.randomUUID(),
            number: current,
            quantExec: periodoQty,
            dataExec: baseOpen?.dataExec || evo?.dataExec || today,
            observacoes:
              baseOpen?.observacoes ||
              openOnes.map((m) => m.observacoes).filter(Boolean).join(" | ") ||
              evo?.observacoes ||
              "",
            closed: true,
            closedAt: closedAtIso,
          };
          newEvolutions[k] = { measurements: [...closedOnes, consolidated] };
        } else {
          newEvolutions[k] = { measurements: closedOnes };
        }
      }

      // Generate PDF snapshot
      try {
        const blob = buildMeasurementPdfBlob(
          data.rows,
          newEvolutions,
          current,
          data.nome,
          closedAt,
          data.info ?? {},
        );

        await uploadDocumentBlob(
          companyId,
          data.id,
          "Medições da Obra",
          `medicao-${String(current).padStart(2, "0")}-${data.nome}.pdf`,
          blob,
          "application/pdf",
          {
            replaceMatching: (name) =>
              name.toLowerCase().startsWith(`medicao-${String(current).padStart(2, "0")}-`),
          },
        );
      } catch (e) {
        console.error("Falha ao salvar PDF da medição:", e);
        toast.warning("Medição fechada, mas o PDF não pôde ser arquivado.");
      }

      const entry: MeasurementAuditEntry = {
        number: current,
        action: "closed",
        userId,
        userEmail,
        at: closedAt.toISOString(),
      };

      setData({
        ...data,
        evolutions: newEvolutions,
        currentMeasurement: current + 1,
        measurementLog: [...log, entry],
      });
      toast.success(`Medição ${current} encerrada.`, {
        description: `Nova medição ${current + 1} aberta automaticamente.`,
      });
      setConfirmOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao fechar medição.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReopen() {
    if (!isAdmin) return;
    const reason = reopenReason.trim();
    if (!reason) {
      toast.error("Informe o motivo da reabertura.");
      return;
    }
    const previous = current - 1;
    if (previous < 1) {
      toast.error("Não há medição anterior para reabrir.");
      return;
    }
    setBusy(true);
    try {
      const newEvolutions: Record<string, Evolution> = {};
      for (const [k, evo] of Object.entries(data.evolutions)) {
        const list = evo?.measurements ?? [];
        newEvolutions[k] = {
          ...evo,
          measurements: list.map((m) =>
            m.number === previous && m.closed
              ? { ...m, closed: false, closedAt: undefined }
              : m,
          ),
        };
      }
      const entry: MeasurementAuditEntry = {
        number: previous,
        action: "reopened",
        userId,
        userEmail,
        at: new Date().toISOString(),
        reason,
      };
      setData({
        ...data,
        evolutions: newEvolutions,
        currentMeasurement: previous,
        measurementLog: [...log, entry],
      });
      toast.success(`Medição ${previous} reaberta.`);
      setReopenOpen(false);
      setReopenReason("");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao reabrir medição.");
    } finally {
      setBusy(false);
    }
  }

  const actions = (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setHistoryOpen(true)}
        title="Histórico de medições"
      >
        <History className="w-4 h-4 mr-1" /> Histórico ({log.length})
      </Button>
      {isAdmin && current > 1 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setReopenOpen(true)}
          title="Reabrir medição anterior"
        >
          <LockOpen className="w-4 h-4 mr-1" /> Reabrir M{current - 1}
        </Button>
      )}
      <Button
        variant="default"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        disabled={busy}
      >
        <Lock className="w-4 h-4 mr-1" /> Fechar Medição M{current}
      </Button>
    </div>
  );

  const dialogs = (
    <>
      {/* Confirm close */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechar Medição M{current}?</DialogTitle>
            <DialogDescription>
              Esta ação é definitiva. Após o fechamento:
            </DialogDescription>
          </DialogHeader>
          <ul className="text-sm space-y-1 list-disc pl-5 text-muted-foreground">
            <li>Os lançamentos desta medição ficarão bloqueados.</li>
            <li>O sistema abrirá automaticamente a próxima medição (M{current + 1}).</li>
            <li>Um PDF da medição será arquivado em <strong>Documentos → Medições da Obra</strong>.</li>
            <li>A ação ficará registrada no histórico ({userEmail}).</li>
          </ul>
          <div className="rounded-md border bg-muted/50 p-3 text-sm">
            <div><strong>{summary.itensLancados}</strong> item(ns) lançado(s)</div>
            <div>Valor do período: <strong>{fmtBRL(summary.valorPeriodo)}</strong></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={handleClose} disabled={busy}>
              {busy ? "Fechando..." : `Confirmar fechamento M${current}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen */}
      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir Medição M{current - 1}?</DialogTitle>
            <DialogDescription>
              A medição voltará ao estado de aberta e poderá ser editada novamente.
              Esta ação ficará registrada no histórico de auditoria.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reopen-reason">Motivo da reabertura *</Label>
            <Textarea
              id="reopen-reason"
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Ex.: correção de quantidade lançada incorretamente em..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReopenOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={handleReopen} disabled={busy || !reopenReason.trim()}>
              {busy ? "Reabrindo..." : "Confirmar reabertura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Medições — {data.nome}</DialogTitle>
            <DialogDescription>
              Registro de todos os fechamentos e reaberturas de medições.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {log.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhuma medição encerrada ainda.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b sticky top-0 bg-background">
                  <tr className="text-left">
                    <th className="py-2 pr-2">Medição</th>
                    <th className="py-2 pr-2">Ação</th>
                    <th className="py-2 pr-2">Usuário</th>
                    <th className="py-2 pr-2">Data/Hora</th>
                    <th className="py-2">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {[...log].reverse().map((e, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-2 font-medium">M{e.number}</td>
                      <td className="py-2 pr-2">
                        {e.action === "closed" ? (
                          <Badge variant="default">Fechada</Badge>
                        ) : (
                          <Badge variant="outline">Reaberta</Badge>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">{e.userEmail || e.userId}</td>
                      <td className="py-2 pr-2 text-muted-foreground">
                        {new Date(e.at).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-2 text-muted-foreground">{e.reason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setHistoryOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (variant === "inline") {
    return (
      <>
        {actions}
        {dialogs}
      </>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">
                Medição atual: M{current}
              </h3>
              <Badge variant="secondary">Em aberto</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {summary.itensLancados} item(ns) lançado(s) no período • Valor do período:{" "}
              <strong className="text-foreground">{fmtBRL(summary.valorPeriodo)}</strong> •
              Acumulado da obra: <strong className="text-foreground">{fmtNum(summary.percentGeral)}%</strong>
            </p>
          </div>
        </div>
        {actions}
      </div>
      {dialogs}
    </Card>
  );
}

export default MeasurementClosure;
