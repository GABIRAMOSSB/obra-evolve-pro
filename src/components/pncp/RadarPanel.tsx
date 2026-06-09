/**
 * Radar PNCP — painel de automação.
 * - Configuração (frequência, filtros padrão, canais de alerta)
 * - Filtros salvos
 * - Botão "Coletar agora"
 * - Histórico de coletas
 * - Alertas recentes
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Play,
  Save,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  History,
  Bell,
} from "lucide-react";
import {
  getPncpConfig,
  upsertPncpConfig,
  listPncpFiltros,
  upsertPncpFiltro,
  deletePncpFiltro,
  listColetaHistorico,
  listOportunidadeAlertas,
  markAlertaLido,
  coletarAgora,
  type PncpFiltro,
} from "@/lib/pncp-radar.functions";
import { MODALIDADES_PNCP } from "@/lib/oportunidades.functions";

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

function fmtDateTime(v: string | null): string {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("pt-BR");
  } catch {
    return v;
  }
}

export function RadarPanel() {
  const qc = useQueryClient();
  const getCfg = useServerFn(getPncpConfig);
  const saveCfg = useServerFn(upsertPncpConfig);
  const collectFn = useServerFn(coletarAgora);

  const { data: cfg, isLoading } = useQuery({
    queryKey: ["pncp-config"],
    queryFn: () => getCfg(),
  });

  const [freq, setFreq] = useState<number>(6);
  const [estado, setEstado] = useState<string>("todos");
  const [modal, setModal] = useState<string>("6");
  const [email, setEmail] = useState<boolean>(true);
  const [wpp, setWpp] = useState<boolean>(false);
  const [emails, setEmails] = useState<string>("");
  const [obs, setObs] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);

  if (cfg && !hydrated) {
    setFreq(cfg.frequencia_coleta_horas);
    setEstado(cfg.filtro_estado ?? "todos");
    setModal(cfg.filtro_modalidade ?? "6");
    setEmail(cfg.alertar_via_email);
    setWpp(cfg.alertar_via_whatsapp);
    setEmails(cfg.emails_alerta ?? "");
    setObs(cfg.observacoes ?? "");
    setHydrated(true);
  }

  const save = useMutation({
    mutationFn: (ativar: boolean) =>
      saveCfg({
        data: {
          frequencia_coleta_horas: freq,
          filtro_estado: estado,
          filtro_modalidade: modal || null,
          alertar_via_email: email,
          alertar_via_whatsapp: wpp,
          emails_alerta: emails || null,
          observacoes: obs || null,
          ativar,
        },
      }),
    onSuccess: () => {
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: ["pncp-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const coletar = useMutation({
    mutationFn: () => collectFn(),
    onSuccess: (r) => {
      toast.success(`Coleta finalizada: ${r.totalNovos} novas / ${r.totalAtualizados} atualizadas`);
      qc.invalidateQueries({ queryKey: ["pncp-config"] });
      qc.invalidateQueries({ queryKey: ["pncp-historico"] });
      qc.invalidateQueries({ queryKey: ["pncp-alertas"] });
      qc.invalidateQueries({ queryKey: ["oportunidades"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="p-10 text-center">
        <Loader2 className="w-5 h-5 animate-spin inline" />
      </div>
    );
  }

  const statusTone =
    cfg?.status === "ativo"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : cfg?.status === "configurado"
        ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
        : "bg-muted/40 text-muted-foreground border-border";

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Configuração do Radar</h2>
              <Badge variant="outline" className={statusTone}>
                {cfg?.status ?? "nao_configurado"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Última coleta: {fmtDateTime(cfg?.ultima_coleta ?? null)} · Próxima:{" "}
              {fmtDateTime(cfg?.proxima_coleta ?? null)}
            </p>
          </div>
          <Button
            onClick={() => coletar.mutate()}
            disabled={coletar.isPending}
            className="gap-2"
          >
            {coletar.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Coletar agora
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Frequência (horas)</Label>
            <Input
              type="number"
              min={1}
              max={168}
              value={freq}
              onChange={(e) => setFreq(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">UF padrão</Label>
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {UFS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Modalidade padrão</Label>
            <Select value={modal} onValueChange={setModal}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODALIDADES_PNCP.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div className="flex items-center justify-between gap-3 p-3 rounded-md border border-border">
            <div>
              <Label className="text-sm">Alertar por e-mail</Label>
            </div>
            <Switch checked={email} onCheckedChange={setEmail} />
          </div>
          <div className="flex items-center justify-between gap-3 p-3 rounded-md border border-border">
            <div>
              <Label className="text-sm">Alertar por WhatsApp</Label>
            </div>
            <Switch checked={wpp} onCheckedChange={setWpp} />
          </div>
          <div className="space-y-1.5 md:col-span-1">
            <Label className="text-xs">E-mails (separados por vírgula)</Label>
            <Input
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="financeiro@solv.com.br"
            />
          </div>
        </div>

        <div className="space-y-1.5 mt-4">
          <Label className="text-xs">Observações</Label>
          <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
        </div>

        <div className="flex items-center justify-end gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => save.mutate(false)}
            disabled={save.isPending}
            className="gap-2"
          >
            <Save className="w-4 h-4" /> Salvar
          </Button>
          <Button onClick={() => save.mutate(true)} disabled={save.isPending} className="gap-2">
            <CheckCircle2 className="w-4 h-4" /> Salvar e ativar
          </Button>
        </div>
      </Card>

      <FiltrosCard />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HistoricoCard />
        <AlertasCard />
      </div>
    </div>
  );
}

/* -------------------------- Filtros salvos -------------------------- */

function FiltrosCard() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPncpFiltros);
  const saveFn = useServerFn(upsertPncpFiltro);
  const delFn = useServerFn(deletePncpFiltro);

  const { data: filtros = [], isLoading } = useQuery({
    queryKey: ["pncp-filtros"],
    queryFn: () => listFn(),
  });

  const [editing, setEditing] = useState<PncpFiltro | null>(null);

  const save = useMutation({
    mutationFn: (f: PncpFiltro) =>
      saveFn({
        data: {
          id: f.id === "new" ? null : f.id,
          nome: f.nome,
          palavras_chave: f.palavras_chave,
          ufs: f.ufs,
          modalidades: f.modalidades,
          valor_min: f.valor_min,
          valor_max: f.valor_max,
          ativo: f.ativo,
        },
      }),
    onSuccess: () => {
      toast.success("Filtro salvo");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["pncp-filtros"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Filtro removido");
      qc.invalidateQueries({ queryKey: ["pncp-filtros"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Filtros salvos</h2>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={() =>
            setEditing({
              id: "new",
              nome: "",
              palavras_chave: [],
              ufs: [],
              modalidades: ["6"],
              valor_min: null,
              valor_max: null,
              ativo: true,
            })
          }
        >
          <Plus className="w-4 h-4" /> Novo filtro
        </Button>
      </div>

      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : filtros.length === 0 && !editing ? (
        <p className="text-sm text-muted-foreground">
          Sem filtros salvos — a coleta usará as preferências padrão acima.
        </p>
      ) : (
        <div className="space-y-2">
          {filtros.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between p-2.5 border border-border rounded-md"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{f.nome}</span>
                  {!f.ativo && (
                    <Badge variant="outline" className="text-[10px]">
                      inativo
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {f.palavras_chave.length > 0 && <>kw: {f.palavras_chave.join(", ")} · </>}
                  {f.ufs.length > 0 && <>UF: {f.ufs.join("/")} · </>}
                  mod: {f.modalidades.join("/") || "—"}
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => setEditing(f)}>
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => del.mutate(f.id)}
                  disabled={del.isPending}
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="mt-4 p-3 border border-primary/30 rounded-md space-y-3 bg-muted/10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input
                value={editing.nome}
                onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Palavras-chave (vírgula)</Label>
              <Input
                value={editing.palavras_chave.join(", ")}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    palavras_chave: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="pavimentação, escola, drenagem"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">UFs (vírgula)</Label>
              <Input
                value={editing.ufs.join(", ")}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    ufs: e.target.value
                      .split(",")
                      .map((s) => s.trim().toUpperCase())
                      .filter((s) => s.length === 2),
                  })
                }
                placeholder="RS, SC"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Modalidades (ids, vírgula)</Label>
              <Input
                value={editing.modalidades.join(", ")}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    modalidades: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="6, 4"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor mínimo</Label>
              <Input
                type="number"
                value={editing.valor_min ?? ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    valor_min: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor máximo</Label>
              <Input
                type="number"
                value={editing.valor_max ?? ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    valor_max: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={editing.ativo}
              onCheckedChange={(v) => setEditing({ ...editing, ativo: v })}
            />
            <Label className="text-sm">Ativo</Label>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={save.isPending || !editing.nome}
                onClick={() => save.mutate(editing)}
              >
                Salvar filtro
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/* -------------------------- Histórico -------------------------- */

function HistoricoCard() {
  const fn = useServerFn(listColetaHistorico);
  const { data = [], isLoading } = useQuery({
    queryKey: ["pncp-historico"],
    queryFn: () => fn(),
  });
  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
        <History className="w-4 h-4" /> Histórico de coletas
      </h2>
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma coleta registrada ainda.</p>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {data.map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between text-xs p-2 border border-border/60 rounded"
            >
              <div className="min-w-0">
                <div className="font-medium">{fmtDateTime(h.data_coleta)}</div>
                <div className="text-muted-foreground">
                  {h.total_encontrados} encontrados · {h.total_novos} novos ·{" "}
                  {h.total_atualizados} atualizados
                  {h.mensagem_erro && (
                    <span className="text-red-400"> · {h.mensagem_erro}</span>
                  )}
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  h.status === "sucesso"
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : h.status === "parcial"
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      : "bg-red-500/15 text-red-400 border-red-500/30"
                }
              >
                {h.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* -------------------------- Alertas -------------------------- */

function AlertasCard() {
  const qc = useQueryClient();
  const fn = useServerFn(listOportunidadeAlertas);
  const markFn = useServerFn(markAlertaLido);
  const { data = [], isLoading } = useQuery({
    queryKey: ["pncp-alertas"],
    queryFn: () => fn(),
  });
  const mark = useMutation({
    mutationFn: (id: string) => markFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pncp-alertas"] }),
  });
  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
        <Bell className="w-4 h-4" /> Alertas
      </h2>
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem alertas no momento.</p>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {data.map((a) => (
            <div
              key={a.id}
              className={`flex items-start gap-2 p-2 border rounded text-xs ${
                a.status === "aberto" ? "border-primary/40 bg-primary/5" : "border-border/60"
              }`}
            >
              <AlertCircle
                className={`w-3.5 h-3.5 mt-0.5 ${
                  a.urgencia === "critica" || a.urgencia === "alta"
                    ? "text-red-400"
                    : "text-amber-400"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{a.titulo}</div>
                {a.descricao && (
                  <div className="text-muted-foreground line-clamp-2">{a.descricao}</div>
                )}
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {fmtDateTime(a.created_at)}
                </div>
              </div>
              {a.status === "aberto" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2"
                  onClick={() => mark.mutate(a.id)}
                >
                  ok
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
