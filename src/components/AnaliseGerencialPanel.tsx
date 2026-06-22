/**
 * Painel de Análise Gerencial da Obra.
 *
 * Renderiza dentro da aba "Atividades" da obra ativa. Sincroniza
 * automaticamente as atividades locais (BudgetRow) com a tabela
 * `obra_atividades` do banco e calcula todos os indicadores no servidor.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ensureAnalise, atualizarAtividade, type AnaliseGerencialPayload } from "@/lib/analise-gerencial.functions";
import type { ProjectData, BudgetRow } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  Activity,
  Calendar,
  Target,
  FileText,
  AlertCircle,
  CheckCircle2,
  Minus,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";

function fmtBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtPct(v: number | null | undefined, dec = 2) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(dec)}%`;
}
function fmtNum(v: number | null | undefined, dec = 2) {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(dec);
}
function fmtDataBR(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

const RISCO_COLORS: Record<string, string> = {
  baixo: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  moderado: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  alto: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  critico: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
};

function rowsFromProject(data: ProjectData) {
  return (data.rows || [])
    .filter((r) => r.codigo)
    .map((r: BudgetRow, idx) => ({
      item_codigo: r.codigo,
      descricao: r.descricao || r.codigo,
      etapa: r.item || null,
      unidade: r.und || null,
      quantidade: Number(r.quantidade) || 0,
      peso: Number(r.peso) || 0,
      valor: Number(r.total) || 0,
      is_group: !!r.isGroup,
      ordem: idx,
    }));
}

function parseInfoDates(data: ProjectData): {
  data_inicio: string | null;
  data_fim_prevista: string | null;
  valor_contratado: number | null;
} {
  const info = data.info || {};
  const inicio = info.dataInicioObra || null;
  const prazo = info.prazoContratualDias || null;
  let fim: string | null = null;
  if (inicio && prazo) {
    const d = new Date(inicio + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + Number(prazo));
    fim = d.toISOString().slice(0, 10);
  }
  // valor contratual: soma dos totais como fallback
  const total = (data.rows || []).filter((r) => !r.isGroup).reduce((s, r) => s + (Number(r.total) || 0), 0);
  return { data_inicio: inicio, data_fim_prevista: fim, valor_contratado: total > 0 ? total : null };
}

export function AnaliseGerencialPanel({ data }: { data: ProjectData }) {
  const ensure = useServerFn(ensureAnalise);
  const atualizar = useServerFn(atualizarAtividade);
  const qc = useQueryClient();
  const [open, setOpen] = useState(true);

  const queryKey = useMemo(() => ["analise-gerencial", data.id], [data.id]);
  const payload = useMemo(() => {
    const datas = parseInfoDates(data);
    return {
      legacyObraId: data.id,
      obraInfo: {
        nome: data.nome || data.info?.cliente || "Obra",
        codigo: data.info?.numeroContrato ?? null,
        cliente: data.info?.contratante ?? data.info?.cliente ?? null,
        cidade: data.info?.municipio ?? null,
        uf: data.info?.estado ?? null,
        ...datas,
      },
      rows: rowsFromProject(data),
    };
  }, [data]);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const r = await ensure({ data: payload });
      return r;
    },
    staleTime: 30_000,
  });

  // Realtime: refetch quando alguém da empresa editar atividades desta obra
  useEffect(() => {
    if (!query.data?.obraId) return;
    const channel = supabase
      .channel(`obra-ativ-${query.data.obraId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "obra_atividades", filter: `obra_id=eq.${query.data.obraId}` },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [query.data?.obraId, qc, queryKey]);

  const atualizarMut = useMutation({
    mutationFn: (vars: { id: string; patch: Record<string, unknown> }) => atualizar({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) {
    return (
      <Card className="p-6 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Calculando análise gerencial…
      </Card>
    );
  }
  if (query.error || !query.data) {
    return (
      <Card className="p-6 text-sm text-rose-600 dark:text-rose-300">
        Erro ao calcular análise: {(query.error as Error)?.message || "desconhecido"}
        <Button size="sm" variant="outline" className="ml-3" onClick={() => qc.invalidateQueries({ queryKey })}>
          Tentar novamente
        </Button>
      </Card>
    );
  }

  const a: AnaliseGerencialPayload = query.data.analise;
  const ativMap = new Map(query.data.atividades.map((x) => [x.item_codigo, x.id]));

  return (
    <Card className="overflow-hidden border-primary/30">
      <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-b">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 font-semibold text-base"
        >
          <Activity className="w-5 h-5 text-primary" />
          Análise Gerencial da Obra
          <Badge variant="outline" className={`uppercase ${RISCO_COLORS[a.risco.nivel]}`}>
            Risco {a.risco.nivel}
          </Badge>
          {a.confiabilidade !== "alta" && (
            <Badge variant="outline" className="text-xs">
              Confiabilidade {a.confiabilidade}
            </Badge>
          )}
        </button>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => qc.invalidateQueries({ queryKey })}
            disabled={query.isFetching}
            className="gap-2"
          >
            {query.isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Atualizar análise agora
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={async () => {
              const mod = await import("@/lib/analise-gerencial-pdf");
              await mod.gerarRelatorioGerencialPdf(a);
            }}
          >
            <FileText className="w-3.5 h-3.5" /> Gerar relatório gerencial
          </Button>
        </div>
      </div>

      {open && (
        <div className="p-4 space-y-6">
          {/* Avisos */}
          {a.avisos.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300 space-y-1">
              {a.avisos.map((m, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{m}</span>
                </div>
              ))}
            </div>
          )}

          {/* Diagnóstico */}
          <div className="rounded-md border bg-muted/30 p-4 text-sm leading-relaxed">{a.diagnostico}</div>

          {/* Indicadores agrupados */}
          <div className="space-y-4">
            <KpiGroup title="Situação geral" accent="primary">
              <KpiCard label="Risco atual" value={a.risco.nivel.toUpperCase()} hint={`Faixa estimada ${a.risco.faixa_min}%–${a.risco.faixa_max}%`} variant={a.risco.nivel} icon={<AlertTriangle className="w-4 h-4" />} />
              <KpiCard label="Avanço da obra" value={fmtPct(a.indicadores.avanco)} hint={`Método: ${a.metodo_avanco}`} icon={<TrendingUp className="w-4 h-4" />} />
              <KpiCard
                label="Desvio"
                value={a.indicadores.desvio !== null ? `${a.indicadores.desvio >= 0 ? "+" : ""}${a.indicadores.desvio.toFixed(2)} p.p.` : "—"}
                hint={(a.indicadores.desvio ?? 0) >= 0 ? "Acima do planejado" : "Abaixo do planejado"}
                icon={(a.indicadores.desvio ?? 0) >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <TrendingDown className="w-4 h-4 text-rose-500" />}
                variant={(a.indicadores.desvio ?? 0) <= -15 ? "critico" : (a.indicadores.desvio ?? 0) < -5 ? "alto" : undefined}
              />
              <KpiCard label="Atividades críticas" value={String(a.criticas.length)} hint={a.criticas.length > 0 ? "Exigem atenção imediata" : "Nenhuma frente crítica"} variant={a.criticas.length > 3 ? "alto" : undefined} icon={<AlertTriangle className="w-4 h-4" />} />
            </KpiGroup>

            <KpiGroup title="Prazo & financeiro">
              <KpiCard label="Prazo consumido" value={fmtPct(a.indicadores.prazo_consumido)} icon={<Calendar className="w-4 h-4" />} />
              <KpiCard label="Dias restantes" value={a.indicadores.dias_restantes != null ? String(a.indicadores.dias_restantes) : "—"} hint={a.indicadores.dias_atraso > 0 ? `${a.indicadores.dias_atraso} dia(s) de atraso` : "No prazo"} icon={<Calendar className="w-4 h-4" />} />
              <KpiCard label="Saldo a executar" value={fmtBRL(a.indicadores.saldo_executar)} hint="Valor restante" />
              <KpiCard label="Meta semanal" value={a.indicadores.meta_semanal != null ? fmtBRL(a.indicadores.meta_semanal) : "—"} hint="Produção mínima por semana" />
            </KpiGroup>

            <KpiGroup title="Ritmo & projeção">
              <KpiCard label="Ritmo atual" value={fmtNum(a.indicadores.ritmo_atual, 3) + " %/dia"} icon={<TrendingUp className="w-4 h-4" />} />
              <KpiCard label="Ritmo necessário" value={fmtNum(a.indicadores.ritmo_necessario, 3) + " %/dia"} icon={<Target className="w-4 h-4" />} />
              <KpiCard label="Fator de aceleração" value={fmtNum(a.indicadores.fator_aceleracao, 2) + "×"} hint={(a.indicadores.fator_aceleracao ?? 0) > 1.6 ? "Aceleração crítica" : (a.indicadores.fator_aceleracao ?? 0) > 1 ? "Acima do ritmo atual" : "Dentro do ritmo"} variant={(a.indicadores.fator_aceleracao ?? 0) > 1.6 ? "alto" : undefined} />
              <KpiCard label="Data projetada" value={fmtDataBR(a.indicadores.data_projetada)} hint={a.indicadores.dias_atraso_projetado != null && a.indicadores.dias_atraso_projetado < 0 ? `${-a.indicadores.dias_atraso_projetado} dia(s) de atraso projetado` : "Dentro do prazo"} icon={<Target className="w-4 h-4" />} variant={a.indicadores.dias_atraso_projetado != null && a.indicadores.dias_atraso_projetado < -30 ? "alto" : undefined} />
            </KpiGroup>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="p-3">
              <div className="text-xs font-semibold mb-2 text-muted-foreground">Prazo × Execução</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={[{ k: "Prazo consumido", v: a.indicadores.prazo_consumido ?? 0 }, { k: "Avanço", v: a.indicadores.avanco }]}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="k" fontSize={11} />
                  <YAxis fontSize={11} unit="%" />
                  <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
                  <Bar dataKey="v" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-3">
              <div className="text-xs font-semibold mb-2 text-muted-foreground">Ritmo atual vs necessário (%/dia)</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={[{ k: "Atual", v: a.indicadores.ritmo_atual ?? 0 }, { k: "Necessário", v: a.indicadores.ritmo_necessario ?? 0 }]}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="k" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(3)} %/dia`} />
                  <Bar dataKey="v" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-3">
              <div className="text-xs font-semibold mb-2 text-muted-foreground">Evolução do avanço (últimos snapshots)</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={[...a.historico].reverse().map((h) => ({ d: h.data_snapshot.slice(5), avanco: Number(h.avanco), criticas: Number(h.num_criticas) }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="d" fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line dataKey="avanco" stroke="hsl(var(--primary))" name="Avanço %" dot={false} strokeWidth={2} />
                  <Line dataKey="criticas" stroke="#f59e0b" name="Críticas" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Tendência */}
          {(a.tendencia.d1 || a.tendencia.d7 || a.tendencia.medicao_anterior) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[a.tendencia.d1, a.tendencia.d7, a.tendencia.medicao_anterior].map((t, i) =>
                t ? (
                  <Card key={i} className="p-3 text-sm">
                    <div className="text-xs text-muted-foreground mb-1">{t.referencia}</div>
                    <div className="flex items-center gap-2">
                      {t.delta_avanco > 0 ? (
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                      ) : t.delta_avanco < 0 ? (
                        <TrendingDown className="w-4 h-4 text-rose-500" />
                      ) : (
                        <Minus className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="font-semibold">
                        {t.delta_avanco > 0 ? "+" : ""}
                        {t.delta_avanco.toFixed(2)} p.p. avanço
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Risco anterior: <strong>{t.risco_anterior}</strong>
                      {t.delta_fator !== null && <> · ΔFator: {t.delta_fator > 0 ? "+" : ""}{t.delta_fator.toFixed(2)}×</>}
                      {" · "}ΔCríticas: {t.delta_criticas > 0 ? "+" : ""}{t.delta_criticas}
                    </div>
                  </Card>
                ) : null,
              )}
            </div>
          )}

          {/* Críticas */}
          {a.criticas.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Atividades críticas ({a.criticas.length})
              </h3>
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="p-2">Atividade</th>
                      <th className="p-2">Etapa</th>
                      <th className="p-2 text-right">Valor</th>
                      <th className="p-2 text-center">%</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Prioridade</th>
                      <th className="p-2">Responsável</th>
                      <th className="p-2">Motivo</th>
                      <th className="p-2">Ação</th>
                      <th className="p-2 w-44">Editar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {a.criticas.map((c) => {
                      const id = ativMap.get(c.item_codigo);
                      return (
                        <tr key={c.id} className="align-top hover:bg-muted/30">
                          <td className="p-2">
                            <div className="font-medium">{c.descricao}</div>
                            <div className="text-muted-foreground">{c.item_codigo}</div>
                          </td>
                          <td className="p-2 text-muted-foreground">{c.etapa || "—"}</td>
                          <td className="p-2 text-right tabular-nums">{fmtBRL(c.valor)}</td>
                          <td className="p-2 text-center tabular-nums">{c.percentual_concluido.toFixed(0)}%</td>
                          <td className="p-2">{c.status}</td>
                          <td className="p-2">
                            <Badge variant="outline" className="text-[10px]">{c.prioridade}</Badge>
                          </td>
                          <td className="p-2">{c.responsavel_nome || <em className="text-muted-foreground">indefinido</em>}</td>
                          <td className="p-2 text-muted-foreground">{c.motivo}</td>
                          <td className="p-2">{c.acao_recomendada}</td>
                          <td className="p-2">
                            {id && (
                              <InlineEdit id={id} c={c} onPatch={(p) => atualizarMut.mutate({ id, patch: p })} disabled={atualizarMut.isPending} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Ações recomendadas */}
          {a.acoes.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-2">Ações recomendadas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {a.acoes.map((ac, i) => (
                  <Card key={i} className="p-3 text-sm">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="font-medium">{ac.acao}</div>
                      <Badge variant="outline" className="text-[10px]">{ac.prioridade}</Badge>
                    </div>
                    {ac.atividade && <div className="text-xs text-muted-foreground">Atividade: {ac.atividade}</div>}
                    <div className="text-xs text-muted-foreground">Motivo: {ac.motivo}</div>
                    <div className="text-xs mt-1">
                      <strong>Prazo:</strong> {ac.prazo_recomendado} · <strong>Impacto:</strong> {ac.impacto}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Plano de recuperação */}
          {a.plano && (
            <div>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Plano de recuperação
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Meta — 7 dias</div>
                  <div className="font-semibold text-lg">{a.plano.meta_7_dias.toFixed(2)} %</div>
                </Card>
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Meta — 15 dias</div>
                  <div className="font-semibold text-lg">{a.plano.meta_15_dias.toFixed(2)} %</div>
                </Card>
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Meta — 30 dias</div>
                  <div className="font-semibold text-lg">{a.plano.meta_30_dias.toFixed(2)} %</div>
                </Card>
              </div>
              {a.plano.atividades_iniciar_imediato.length > 0 && (
                <PlanoList title="Iniciar imediatamente" items={a.plano.atividades_iniciar_imediato} />
              )}
              {a.plano.atividades_paralelo.length > 0 && (
                <PlanoList title="Podem rodar em paralelo" items={a.plano.atividades_paralelo} />
              )}
              {a.plano.impedimentos_resolver.length > 0 && (
                <PlanoList title="Impedimentos a resolver" items={a.plano.impedimentos_resolver} />
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon,
  variant,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  variant?: string;
}) {
  return (
    <Card className={`p-3 ${variant && RISCO_COLORS[variant] ? RISCO_COLORS[variant] : ""}`}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className="font-semibold text-lg mt-1 tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

function PlanoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-3">
      <div className="text-xs font-semibold text-muted-foreground mb-1">{title}</div>
      <ul className="list-disc list-inside text-sm space-y-0.5">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function InlineEdit({
  id: _id,
  c,
  onPatch,
  disabled,
}: {
  id: string;
  c: { percentual_concluido: number; status: string; prioridade: string };
  onPatch: (p: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  const [pct, setPct] = useState<string>(String(c.percentual_concluido ?? 0));
  return (
    <div className="flex flex-col gap-1">
      <Input
        type="number"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => setPct(e.target.value)}
        onBlur={() => {
          const n = Math.max(0, Math.min(100, Number(pct) || 0));
          if (n !== c.percentual_concluido) onPatch({ percentual_concluido: n });
        }}
        className="h-7 text-xs"
        disabled={disabled}
      />
      <Select
        value={c.status}
        onValueChange={(v) => onPatch({ status: v })}
      >
        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="nao_iniciada">Não iniciada</SelectItem>
          <SelectItem value="em_andamento">Em andamento</SelectItem>
          <SelectItem value="concluida">Concluída</SelectItem>
          <SelectItem value="paralisada">Paralisada</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
