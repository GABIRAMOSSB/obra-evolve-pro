import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listMedicoes,
  gerarMedicao,
  atualizarStatusMedicao,
  excluirMedicao,
} from "@/lib/medicoes.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/medicoes")({
  component: MedicoesPage,
});

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aprovada: "Aprovada",
  paga: "Paga",
  rejeitada: "Rejeitada",
};

const fmtMoney = (n: number | string | null | undefined) =>
  Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function MedicoesPage() {
  const list = useServerFn(listMedicoes);
  const gerar = useServerFn(gerarMedicao);
  const status = useServerFn(atualizarStatusMedicao);
  const excluir = useServerFn(excluirMedicao);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["medicoes"], queryFn: () => list() });

  const [open, setOpen] = useState(false);
  const [contratoId, setContratoId] = useState("");
  const [inicio, setInicio] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [fim, setFim] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  });
  const [obs, setObs] = useState("");

  const mutGerar = useMutation({
    mutationFn: () => gerar({ data: { contrato_id: contratoId, periodo_inicio: inicio, periodo_fim: fim, observacoes: obs || undefined } }),
    onSuccess: (r) => {
      toast.success(`Medição gerada: ${fmtMoney(r.valor_executado)} no período`);
      setOpen(false);
      setContratoId("");
      setObs("");
      qc.invalidateQueries({ queryKey: ["medicoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutStatus = useMutation({
    mutationFn: (v: { id: string; status: "rascunho" | "enviada" | "aprovada" | "paga" | "rejeitada" }) => status({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medicoes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const mutDel = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Medição excluída");
      qc.invalidateQueries({ queryKey: ["medicoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  type Contrato = { id: string; numero: string; objeto: string | null };
  type Medicao = { id: string; contrato_id: string; numero: number; periodo_inicio: string; periodo_fim: string; valor_executado: number | string; valor_acumulado: number | string; percentual_fisico: number | string; status: string };
  const contratos = (data?.contratos ?? []) as Contrato[];
  const medicoes = (data?.medicoes ?? []) as Medicao[];

  const totais = useMemo(() => {
    const totalExec = medicoes.reduce((s: number, m: Medicao) => s + Number(m.valor_executado || 0), 0);
    const aprovadas = medicoes.filter((m: Medicao) => m.status === "aprovada" || m.status === "paga");
    const totalAprov = aprovadas.reduce((s: number, m: Medicao) => s + Number(m.valor_executado || 0), 0);
    return { totalExec, totalAprov, qtde: medicoes.length };
  }, [medicoes]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            Medições / Boletins
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gere boletins mensais por contrato a partir do realizado (NFe + mão de obra) da obra vinculada.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nova medição</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gerar nova medição</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Contrato</Label>
                <Select value={contratoId} onValueChange={setContratoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um contrato" /></SelectTrigger>
                  <SelectContent>
                    {contratos.map((c: Contrato) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.numero} — {c.objeto?.slice(0, 50) ?? "sem objeto"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Período início</Label>
                  <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
                </div>
                <div>
                  <Label>Período fim</Label>
                  <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Observações (opcional)</Label>
                <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => mutGerar.mutate()} disabled={!contratoId || mutGerar.isPending}>
                {mutGerar.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Gerar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Total executado</div>
          <div className="text-2xl font-bold mt-1">{fmtMoney(totais.totalExec)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Aprovado / Pago</div>
          <div className="text-2xl font-bold mt-1">{fmtMoney(totais.totalAprov)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Boletins emitidos</div>
          <div className="text-2xl font-bold mt-1">{totais.qtde}</div>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : medicoes.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          Nenhuma medição emitida ainda. Clique em <strong>Nova medição</strong> para gerar a primeira.
        </Card>
      ) : (
        <Card className="divide-y">
          {medicoes.map((m: Medicao) => {
            const contrato = contratos.find((c: Contrato) => c.id === m.contrato_id);
            return (
              <div key={m.id} className="p-4 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[240px]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Medição #{m.numero}</span>
                    <Badge variant="outline">{contrato?.numero ?? "—"}</Badge>
                    <Badge>{STATUS_LABEL[m.status]}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {m.periodo_inicio} → {m.periodo_fim}
                    {contrato?.objeto ? ` · ${contrato.objeto.slice(0, 60)}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase text-muted-foreground">Período</div>
                  <div className="font-semibold">{fmtMoney(m.valor_executado)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase text-muted-foreground">Acumulado</div>
                  <div className="font-semibold">{fmtMoney(m.valor_acumulado)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase text-muted-foreground">% Físico</div>
                  <div className="font-semibold">{Number(m.percentual_fisico).toFixed(2)}%</div>
                </div>
                <Select value={m.status} onValueChange={(v) => mutStatus.mutate({ id: m.id, status: v as "rascunho" | "enviada" | "aprovada" | "paga" | "rejeitada" })}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir esta medição?")) mutDel.mutate(m.id); }}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
