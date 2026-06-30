/**
 * Painel Análise Gerencial — V2 (refatorado: 6 abas + identidade SOLV).
 *
 * Lê somente de obra_atividades + obra_analise_snapshots + medicoes + aditivos.
 * Inclui novos cálculos: avanço planejado (baseline), SPI real, riscos 4D,
 * financeiro estendido e cobertura/qualidade de dados.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAnaliseV2 } from "@/lib/analise-v2.functions";
import { listDependencias, upsertDependencia, deleteDependencia } from "@/lib/analise-v2-deps.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, ReferenceLine,
} from "recharts";
import {
  Activity, AlertTriangle, TrendingUp, TrendingDown, Loader2, RefreshCw,
  Target, Calendar, ShieldAlert, Layers, Link2, CheckCircle2, Info,
  Wallet, BarChart3, Database, Briefcase, Plus, Trash2,
} from "lucide-react";

const fmtBRL = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number | null | undefined, d = 2) =>
  v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(d)}%`;
const fmtNum = (v: number | null | undefined, d = 2) =>
  v == null || !Number.isFinite(v) ? "—" : v.toFixed(d);
const fmtDt = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try { return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR"); }
  catch { return iso; }
};

const RISCO: Record<string, string> = {
  baixo: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  moderado: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  alto: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  muito_alto: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  critico: "bg-rose-600/20 text-rose-700 dark:text-rose-300 border-rose-600/40",
};
const IMPACTO: Record<string, string> = {
  critica: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  alta: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  media: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  baixa: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
};
const SITUACAO_ETAPA: Record<string, string> = {
  concluida: "bg-emerald-500/15 text-emerald-700",
  no_prazo: "bg-sky-500/15 text-sky-700",
  atencao: "bg-amber-500/15 text-amber-700",
  atrasada: "bg-orange-500/15 text-orange-700",
  bloqueada: "bg-rose-500/15 text-rose-700",
  nao_iniciada: "bg-slate-500/15 text-slate-700",
};

const SPI_CLASSE_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "neutro" }> = {
  no_prazo: { label: "Dentro/acima do planejado", tone: "ok" },
  atencao: { label: "Atenção", tone: "warn" },
  atraso_relevante: { label: "Atraso relevante", tone: "bad" },
  atraso_critico: { label: "Atraso crítico", tone: "bad" },
  nao_previsto: { label: "Sem baseline planejada", tone: "neutro" },
};

function Section({ icon: Icon, title, subtitle, children, action }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card className="p-5 space-y-4 rounded-2xl border-border/60 shadow-sm">
      <div className="flex items-start gap-3 border-b pb-3">
        <div className="rounded-lg bg-primary/10 p-2"><Icon className="w-4 h-4 text-primary" /></div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-base">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Kpi({ label, value, hint, tone, tooltip }: { label: string; value: string; hint?: string; tone?: "ok" | "warn" | "bad" | "neutro"; tooltip?: string }) {
  const toneCls = tone === "bad" ? "text-rose-600"
    : tone === "warn" ? "text-amber-600"
    : tone === "ok" ? "text-emerald-600"
    : tone === "neutro" ? "text-slate-600"
    : "";
  return (
    <div className="rounded-xl border bg-card p-3.5 space-y-1.5">
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
        {tooltip && (
          <TooltipProvider><Tooltip>
            <TooltipTrigger asChild><Info className="w-3 h-3 opacity-60 cursor-help" /></TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs leading-snug">{tooltip}</TooltipContent>
          </Tooltip></TooltipProvider>
        )}
      </div>
      <div className={`text-2xl font-semibold tabular-nums ${toneCls}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground leading-snug">{hint}</div>}
    </div>
  );
}

function HeroKpi({ label, value, hint, tone, tooltip, sub }: { label: string; value: string; hint?: string; tone?: "ok" | "warn" | "bad" | "neutro"; tooltip?: string; sub?: string }) {
  const toneBar = tone === "bad" ? "bg-rose-500"
    : tone === "warn" ? "bg-amber-500"
    : tone === "ok" ? "bg-emerald-500"
    : "bg-primary";
  return (
    <Card className="p-4 rounded-2xl border-border/60 shadow-sm relative overflow-hidden">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${toneBar}`} />
      <div className="pl-2 space-y-1">
        <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          {label}
          {tooltip && (
            <TooltipProvider><Tooltip>
              <TooltipTrigger asChild><Info className="w-3 h-3 opacity-60 cursor-help" /></TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs leading-snug">{tooltip}</TooltipContent>
            </Tooltip></TooltipProvider>
          )}
        </div>
        <div className="text-[26px] font-bold tabular-nums leading-tight">{value}</div>
        {sub && <div className="text-xs font-medium text-foreground/80">{sub}</div>}
        {hint && <div className="text-[11px] text-muted-foreground leading-snug">{hint}</div>}
      </div>
    </Card>
  );
}

function Insuficiente({ msg }: { msg?: string }) {
  return (
    <div className="rounded-md border border-dashed border-amber-400/50 bg-amber-50/40 dark:bg-amber-950/10 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <span>{msg ?? "Dados insuficientes para cálculo."}</span>
    </div>
  );
}

export function AnaliseGerencialV2({ legacyObraId }: { legacyObraId: string }) {
  const fn = useServerFn(getAnaliseV2);
  const qc = useQueryClient();
  const queryKey = useMemo(() => ["analise-v2", legacyObraId], [legacyObraId]);

  const q = useQuery({
    queryKey,
    queryFn: () => fn({ data: { legacyObraId } }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const obraId = q.data && q.data.initialized ? q.data.analise.obra_id : null;
  useEffect(() => {
    if (!obraId) return;
    const ch = supabase
      .channel(`analise-v2-${obraId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "obra_atividades", filter: `obra_id=eq.${obraId}` },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [obraId, qc, queryKey]);

  if (q.isLoading) {
    return (
      <Card className="p-6 flex items-center gap-2 text-muted-foreground rounded-2xl">
        <Loader2 className="w-4 h-4 animate-spin" /> Calculando análise gerencial…
      </Card>
    );
  }
  if (q.error) {
    return (
      <Card className="p-6 text-sm text-rose-600 rounded-2xl">
        Erro: {(q.error as Error).message}
        <Button size="sm" variant="outline" className="ml-3" onClick={() => q.refetch()}>Tentar novamente</Button>
      </Card>
    );
  }
  if (!q.data || !q.data.initialized) {
    return (
      <Card className="p-6 text-sm text-muted-foreground rounded-2xl">
        Esta obra ainda não está sincronizada com o banco gerencial. Abra a aba <strong>Atividades</strong> uma vez para inicializar e volte aqui.
      </Card>
    );
  }

  const a = q.data.analise;
  const i = a.indicadores;
  const r = a.ritmo;
  const plan = a.planejamento;
  const fin = a.financeiro;
  const cov = a.cobertura_dados;
  const dim = a.riscos_dimensoes;
  const score = a.risco.score;

  // tones derivados
  const desvioTone: "ok" | "warn" | "bad" | "neutro" =
    plan.desvio_planejado == null ? "neutro"
      : plan.desvio_planejado < -10 ? "bad"
      : plan.desvio_planejado < -3 ? "warn"
      : "ok";
  const spiClasse = SPI_CLASSE_LABEL[plan.spi_classe];

  return (
    <div className="space-y-5">
      {/* ===================== CABEÇALHO EXECUTIVO ===================== */}
      <Card className="p-5 rounded-2xl border-border/60 shadow-sm bg-gradient-to-br from-primary/[0.04] to-transparent">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold tracking-tight">{a.obra_nome}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className={`uppercase ${RISCO[a.risco.nivel]}`}>
                Risco {a.risco.nivel.replace("_", " ")} · {score.toFixed(0)}/100
              </Badge>
              <Badge variant="outline">Confiança dos dados: {cov.confianca}%</Badge>
              <Badge variant="outline">Método de avanço: {a.metodo_avanco}</Badge>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">Data-base: <strong className="text-foreground">{fmtDt(a.data_referencia)}</strong></span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => q.refetch()}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Recalcular
            </Button>
          </div>
        </div>

        {/* Diagnóstico em texto */}
        <div className="mt-4 grid md:grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border bg-card p-3 space-y-1.5">
            <div><span className="font-semibold text-foreground">Situação: </span><span className="text-muted-foreground">{a.diagnostico.situacao}</span></div>
            <div><span className="font-semibold text-foreground">Causa principal: </span><span className="text-muted-foreground">{a.diagnostico.causa}</span></div>
            <div><span className="font-semibold text-foreground">Consequência: </span><span className="text-muted-foreground">{a.diagnostico.consequencia}</span></div>
          </div>
          <div className="rounded-xl border bg-card p-3 space-y-1.5">
            <div><span className="font-semibold text-foreground">Recuperação: </span><span className="text-muted-foreground">{a.diagnostico.recuperacao}</span></div>
            <div><span className="font-semibold text-foreground">Decisão recomendada: </span><span className="text-muted-foreground">{a.diagnostico.decisao}</span></div>
          </div>
        </div>
      </Card>

      {/* ===================== 6 CARTÕES PRINCIPAIS ===================== */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <HeroKpi
          label="Avanço planejado"
          value={plan.avanco_planejado != null ? fmtPct(plan.avanco_planejado, 1) : "—"}
          hint={plan.atividades_com_baseline > 0
            ? `${plan.atividades_com_baseline} atividade(s) com baseline`
            : "Sem datas planejadas cadastradas"}
          tooltip="Avanço esperado até hoje pela curva planejada. Integra linearmente entre data prevista de início e fim de cada atividade, ponderado por valor (ou peso, se não houver valor)."
        />
        <HeroKpi
          label="Avanço realizado"
          value={fmtPct(i.avanco, 1)}
          hint={`${fmtBRL(i.valor_executado)} de ${fmtBRL(i.valor_total)}`}
          tooltip="Avanço ponderado pelo valor (ou peso) considerando o percentual real de cada atividade. Soma(percentual × valor) / Soma(valor)."
        />
        <HeroKpi
          label="Desvio do plano"
          value={plan.desvio_planejado != null
            ? `${plan.desvio_planejado > 0 ? "+" : ""}${plan.desvio_planejado.toFixed(2)} p.p.`
            : "—"}
          sub={plan.desvio_planejado == null ? "Sem baseline" : undefined}
          hint={plan.desvio_planejado != null
            ? "Realizado − Planejado (em pontos percentuais)"
            : "Cadastre datas previstas nas atividades para calcular."}
          tone={desvioTone}
          tooltip="Diferença em pontos percentuais entre o avanço realizado e o avanço planejado até hoje."
        />
        <HeroKpi
          label="SPI (Schedule Performance)"
          value={plan.spi != null ? plan.spi.toFixed(2) : "—"}
          sub={spiClasse.label}
          hint={plan.spi != null
            ? "Realizado / Planejado. Ideal ≥ 1,00"
            : "Sem baseline para cálculo"}
          tone={spiClasse.tone}
          tooltip="Schedule Performance Index. ≥1,00 dentro do prazo; 0,95–0,99 atenção; 0,85–0,94 atraso relevante; <0,85 crítico."
        />
        <HeroKpi
          label="Data projetada de conclusão"
          value={fmtDt(a.projecao.acumulado.data)}
          sub={a.projecao.acumulado.atraso_dias != null
            ? (a.projecao.acumulado.atraso_dias > 0
                ? `+${a.projecao.acumulado.atraso_dias}d`
                : `${a.projecao.acumulado.atraso_dias}d`)
            : undefined}
          hint={`Contratual: ${fmtDt(i.data_fim_prevista)}`}
          tone={a.projecao.acumulado.atraso_dias != null && a.projecao.acumulado.atraso_dias > 30 ? "bad"
            : a.projecao.acumulado.atraso_dias != null && a.projecao.acumulado.atraso_dias > 0 ? "warn"
            : "ok"}
          tooltip="Projeção pelo ritmo acumulado da obra (avanço total ÷ dias decorridos)."
        />
        <HeroKpi
          label="Disponível para medição"
          value={fmtBRL(fin.potencial_proxima_medicao)}
          hint={`Medido: ${fmtBRL(fin.valor_medido)} · Produção: ${fmtBRL(fin.valor_agregado_producao)}`}
          tone={fin.potencial_proxima_medicao > 0 ? "ok" : "neutro"}
          tooltip="Produção a preço de contrato ainda não levada a medição. Fórmula: valor agregado − valor já medido."
        />
      </div>

      {/* Alerta global de cobertura */}
      {cov.dados_insuficientes_avanco_valor && (
        <Card className="p-3 rounded-xl border-amber-400/50 bg-amber-50/40 dark:bg-amber-950/10 text-amber-800 dark:text-amber-300 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <strong>Avanço com confiança parcial.</strong>{" "}
            {cov.sem_valor} de {cov.total_atividades} atividade(s) sem valor cadastrado
            ({fmtPct(cov.cobertura_valor_pct, 1)} de cobertura). O avanço ponderado por valor só é totalmente confiável com 100% das atividades cobertas.
          </div>
        </Card>
      )}

      {/* ===================== ABAS ===================== */}
      <Tabs defaultValue="exec" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto rounded-xl">
          <TabsTrigger value="exec">Executivo</TabsTrigger>
          <TabsTrigger value="prazo">Prazo & Produção</TabsTrigger>
          <TabsTrigger value="fin">Financeiro</TabsTrigger>
          <TabsTrigger value="ativ">Atividades & Bloqueios</TabsTrigger>
          <TabsTrigger value="recup">Plano de Recuperação</TabsTrigger>
          <TabsTrigger value="qual">Qualidade dos Dados</TabsTrigger>
        </TabsList>

        {/* ====== EXECUTIVO ====== */}
        <TabsContent value="exec" className="space-y-5 mt-5">
          <Section icon={ShieldAlert} title="Riscos por dimensão" subtitle="Pontuação 0–100 por dimensão (não é probabilidade estatística)">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Kpi label="Prazo" value={`${dim.prazo}/100`} tone={dim.prazo >= 70 ? "bad" : dim.prazo >= 40 ? "warn" : "ok"} tooltip="SPI, desvio, projeção, fator de aceleração." />
              <Kpi label="Operacional" value={`${dim.operacional}/100`} tone={dim.operacional >= 70 ? "bad" : dim.operacional >= 40 ? "warn" : "ok"} tooltip="Ritmo recente, prontidão das frentes, impedimentos." />
              <Kpi label="Financeiro" value={`${dim.financeiro}/100`} tone={dim.financeiro >= 70 ? "bad" : dim.financeiro >= 40 ? "warn" : "ok"} tooltip="Executado não medido, medido não recebido, exposição em críticas." />
              <Kpi label="Gerencial" value={`${dim.gerencial}/100`} tone={dim.gerencial >= 70 ? "bad" : dim.gerencial >= 40 ? "warn" : "ok"} tooltip="Atividades sem responsável, sem planejamento ou sem valor." />
              <Kpi label="Consolidado" value={`${dim.consolidado}/100`} tone={dim.consolidado >= 70 ? "bad" : dim.consolidado >= 40 ? "warn" : "ok"} tooltip="Média ponderada das 4 dimensões. Faixa gerencial estimada, não estatística." />
            </div>
            <div className="text-[11px] text-muted-foreground italic">Faixa gerencial estimada, não estatística — útil para priorização, não para previsão probabilística.</div>
          </Section>

          {a.frase_resultado && (
            <Card className="p-4 rounded-2xl border-primary/30 bg-primary/[0.04] text-sm leading-relaxed">
              {a.frase_resultado}
            </Card>
          )}

          {a.decisoes.length > 0 && (
            <Section icon={AlertTriangle} title="O que precisa ser decidido hoje" subtitle={`${a.decisoes.length} decisão(ões) prioritária(s)`}>
              <div className="grid md:grid-cols-2 gap-3">
                {a.decisoes.slice(0, 5).map((d, idx) => (
                  <div key={idx} className="rounded-xl border p-3 space-y-1.5 text-sm bg-rose-500/[0.04] border-rose-500/30">
                    <div><strong>Problema:</strong> {d.problema}</div>
                    <div><strong>Impacto:</strong> <span className="text-muted-foreground">{d.impacto}</span></div>
                    <div><strong>Ação:</strong> {d.decisao}</div>
                    <div className="text-xs text-muted-foreground">Responsável: {d.responsavel} · Prazo: {d.prazo}</div>
                    <div className="text-xs text-muted-foreground">Esperado: {d.resultado_esperado}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {a.alertas.length > 0 && (
            <Section icon={AlertTriangle} title={`Alertas inteligentes (${a.alertas.length})`}>
              <ul className="space-y-1.5 text-sm">
                {a.alertas.map((al, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Badge variant="outline" className={`text-[10px] ${al.severidade === "alta" ? IMPACTO.critica : IMPACTO.media}`}>{al.severidade}</Badge>
                    <span>{al.mensagem}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </TabsContent>

        {/* ====== PRAZO & PRODUÇÃO ====== */}
        <TabsContent value="prazo" className="space-y-5 mt-5">
          <Section icon={Target} title="Planejado × realizado" subtitle="SPI real + índice linear complementar">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Avanço planejado" value={plan.avanco_planejado != null ? fmtPct(plan.avanco_planejado, 1) : "—"} hint={plan.atividades_sem_baseline > 0 ? `${plan.atividades_sem_baseline} sem datas previstas` : undefined} />
              <Kpi label="Avanço realizado" value={fmtPct(i.avanco, 1)} />
              <Kpi label="SPI" value={plan.spi != null ? plan.spi.toFixed(2) : "—"} hint={spiClasse.label} tone={spiClasse.tone} tooltip="Realizado ÷ Planejado." />
              <Kpi label="Índice linear simplificado" value={fmtNum(i.idp, 2)} hint="Realizado ÷ prazo consumido — indicador complementar." tooltip="Não confundir com SPI: usa apenas o tempo decorrido, ignorando a baseline." />
            </div>
            {plan.avanco_planejado == null && (
              <Insuficiente msg="Sem datas previstas cadastradas nas atividades. Adicione data prevista de início e fim para calcular SPI e desvio do plano." />
            )}
          </Section>

          {plan.curva_s && plan.curva_s.length > 1 && (
            <Section icon={BarChart3} title="Curva S — planejado × realizado" subtitle="Avanço acumulado ao longo do tempo. A linha vermelha marca a data de hoje.">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={plan.curva_s} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis
                      dataKey="data"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: string) => v.slice(5)}
                      minTickGap={28}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      domain={[0, 100]}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <RTooltip
                      formatter={(v) => {
                        const n = typeof v === "number" ? v : Number(v);
                        return Number.isFinite(n) ? `${n.toFixed(2)}%` : "—";
                      }}
                      labelFormatter={(l: string) => fmtDt(l)}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine x={a.data_referencia} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: "hoje", fontSize: 10, fill: "hsl(var(--destructive))" }} />
                    <Line type="monotone" dataKey="planejado" name="Planejado" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    <Line type="monotone" dataKey="realizado" name="Realizado" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Section>
          )}


          <Section icon={TrendingUp} title="Ritmo de produção" subtitle={r.frase ?? "Comparação realizado x necessário"}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Acumulado" value={fmtNum(r.acumulado, 3) + " %/dia"} />
              <Kpi label="Últimos 7 dias" value={r.ultimos_7d != null ? `${r.ultimos_7d.toFixed(3)} %/dia` : "—"} />
              <Kpi label="Últimos 15 dias" value={r.ultimos_15d != null ? `${r.ultimos_15d.toFixed(3)} %/dia` : "—"} />
              <Kpi label="Necessário" value={r.necessario != null ? `${r.necessario.toFixed(3)} %/dia` : "—"} hint={r.producao_financ_dia != null ? `${fmtBRL(r.producao_financ_dia)}/dia` : undefined} />
              <Kpi label="Fator de aceleração" value={r.fator_aceleracao != null ? `${r.fator_aceleracao.toFixed(2)}x` : "—"} hint={r.fator_classe ?? undefined} tone={r.fator_aceleracao != null && r.fator_aceleracao > 1.6 ? "bad" : r.fator_aceleracao != null && r.fator_aceleracao > 1.3 ? "warn" : "ok"} />
              <Kpi label="Meta semanal (%)" value={fmtPct(r.meta_semanal_pct, 2)} />
              <Kpi label="Meta semanal (R$)" value={fmtBRL(r.meta_semanal_valor)} />
              <Kpi label="Desempenho semana" value={a.produtividade.desempenho_semanal != null ? `${a.produtividade.desempenho_semanal.toFixed(0)}%` : "—"} tone={a.produtividade.desempenho_semanal != null && a.produtividade.desempenho_semanal < 75 ? "bad" : "ok"} />
            </div>
          </Section>

          <Section icon={Calendar} title="Projeção de conclusão" subtitle={`Tendência recente: ${a.projecao.tendencia_recente === "melhor" ? "melhor que a média" : a.projecao.tendencia_recente === "pior" ? "pior que a média histórica" : "estável"}`}>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="rounded-xl border p-3 space-y-1">
                <div className="text-xs uppercase text-muted-foreground">Cenário pelo ritmo acumulado</div>
                <div className="text-sm">Conclusão: <strong>{fmtDt(a.projecao.acumulado.data)}</strong></div>
                <div className="text-sm">Atraso: <strong>{a.projecao.acumulado.atraso_dias ?? "—"} dias</strong></div>
                <div className="text-sm">% no vencimento: <strong>{fmtPct(a.projecao.acumulado.pct_no_vencimento)}</strong></div>
              </div>
              <div className="rounded-xl border p-3 space-y-1">
                <div className="text-xs uppercase text-muted-foreground">Cenário pelo ritmo recente (7–14d)</div>
                <div className="text-sm">Conclusão: <strong>{fmtDt(a.projecao.recente.data)}</strong></div>
                <div className="text-sm">Atraso: <strong>{a.projecao.recente.atraso_dias ?? "—"} dias</strong></div>
                <div className="text-sm">% no vencimento: <strong>{fmtPct(a.projecao.recente.pct_no_vencimento)}</strong></div>
              </div>
            </div>
          </Section>

          <Section icon={Layers} title="Análise por etapa">
            <div className="overflow-auto rounded-xl border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="p-2">Etapa</th>
                    <th className="p-2 text-right">Valor</th>
                    <th className="p-2 text-right">Avanço</th>
                    <th className="p-2 text-right">Saldo</th>
                    <th className="p-2 text-right">Ativ.</th>
                    <th className="p-2 text-right">Atrasadas</th>
                    <th className="p-2 text-right">Críticas</th>
                    <th className="p-2">Responsável</th>
                    <th className="p-2">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {a.etapas.map((e) => (
                    <tr key={e.etapa} className="border-t">
                      <td className="p-2 font-medium">{e.etapa}</td>
                      <td className="p-2 text-right">{fmtBRL(e.valor)}</td>
                      <td className="p-2 text-right">{fmtPct(e.avanco, 1)}</td>
                      <td className="p-2 text-right">{fmtBRL(e.saldo)}</td>
                      <td className="p-2 text-right">{e.qtd}</td>
                      <td className="p-2 text-right">{e.atrasadas}</td>
                      <td className="p-2 text-right">{e.criticas}</td>
                      <td className="p-2">{e.responsavel ?? "—"}</td>
                      <td className="p-2"><Badge variant="outline" className={`text-[10px] ${SITUACAO_ETAPA[e.situacao]}`}>{e.situacao.replace("_", " ")}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </TabsContent>

        {/* ====== FINANCEIRO ====== */}
        <TabsContent value="fin" className="space-y-5 mt-5">
          <Section icon={Wallet} title="Contrato" subtitle="Original, aditivos, supressões e vigência">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Valor original" value={fmtBRL(fin.valor_contratado_original)} />
              <Kpi label="Aditivos vigentes" value={fmtBRL(fin.valor_aditivos)} tone={fin.valor_aditivos > 0 ? "warn" : "neutro"} />
              <Kpi label="Supressões vigentes" value={fmtBRL(fin.valor_supressoes)} tone={fin.valor_supressoes > 0 ? "warn" : "neutro"} />
              <Kpi label="Vigente" value={fmtBRL(fin.valor_vigente)} tooltip="Original + aditivos − supressões." />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Kpi
                label="Soma das atividades"
                value={fmtBRL(fin.valor_total_atividades)}
                hint={fin.pct_cobertura_contrato != null ? `${fmtPct(fin.pct_cobertura_contrato, 1)} do contrato vigente` : undefined}
              />
              <Kpi
                label="Divergência contrato × atividades"
                value={fmtBRL(fin.divergencia_contrato_atividades)}
                tone={fin.valor_vigente > 0 && Math.abs(fin.divergencia_contrato_atividades) > fin.valor_vigente * 0.05 ? "bad" : "neutro"}
                tooltip="Vigente − soma dos valores das atividades. Diferenças >5% indicam itens não cadastrados."
              />
              <Kpi label="Saldo contratual" value={fmtBRL(fin.saldo_contratual)} hint="Vigente − pago" />
            </div>
          </Section>

          <Section icon={BarChart3} title="Produção e medição">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Kpi label="Valor agregado (produção)" value={fmtBRL(fin.valor_agregado_producao)} tooltip="Produção física a preço de contrato." />
              <Kpi label="Valor medido" value={fmtBRL(fin.valor_medido)} hint="Medições aprovadas ou pagas" />
              <Kpi label="Valor pago/recebido" value={fmtBRL(fin.valor_pago)} hint="Medições com status 'paga'" />
              <Kpi label="Executado não medido" value={fmtBRL(fin.valor_executado_nao_medido)} tone={fin.valor_executado_nao_medido > 0 ? "warn" : "ok"} tooltip="Produção − Medido. Indica o potencial da próxima medição." />
              <Kpi label="Medido não recebido" value={fmtBRL(fin.valor_medido_nao_recebido)} tone={fin.valor_medido_nao_recebido > 0 ? "warn" : "ok"} tooltip="Medido − Pago. Atenção ao fluxo de caixa." />
              <Kpi label="Potencial próxima medição" value={fmtBRL(fin.potencial_proxima_medicao)} tone="ok" />
            </div>
            {fin.valor_medido === 0 && fin.valor_pago === 0 && (
              <Insuficiente msg="Não há medições cadastradas em Contratos → Medições. Os valores medido/faturado/recebido aparecerão após o registro das medições do contrato vinculado a esta obra." />
            )}
          </Section>

          <Section icon={ShieldAlert} title="Exposição financeira" subtitle="Onde o dinheiro está parado">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Kpi label="Não iniciadas" value={fmtBRL(a.exposicao.valor_nao_iniciadas)} />
              <Kpi label="Atrasadas" value={fmtBRL(a.exposicao.valor_atrasadas)} />
              <Kpi label="Em maior impacto" value={fmtBRL(a.exposicao.valor_criticas)} tone="bad" />
              <Kpi label="% contrato em 0%" value={fmtPct(a.exposicao.pct_contrato_zero)} />
              <Kpi label="% top 5 pendentes" value={fmtPct(a.exposicao.pct_top5)} />
            </div>
            {a.exposicao.top5.length > 0 && (
              <div className="text-xs text-muted-foreground">
                As 5 maiores pendentes: {a.exposicao.top5.map((t) => `${t.descricao} (${fmtBRL(t.valor_pendente)})`).join(" · ")}
              </div>
            )}
          </Section>
        </TabsContent>

        {/* ====== ATIVIDADES & BLOQUEIOS ====== */}
        <TabsContent value="ativ" className="space-y-5 mt-5">
          <Section icon={AlertTriangle} title={`Atividades de maior impacto gerencial (${a.criticas.length})`} subtitle="Ordenadas por índice de impacto. Não representa caminho crítico real — para isso é necessário cadastro de dependências e folgas.">
            <div className="overflow-auto max-h-[420px] rounded-xl border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 sticky top-0">
                  <tr className="text-left">
                    <th className="p-2">Atividade</th>
                    <th className="p-2">Etapa</th>
                    <th className="p-2 text-right">Valor pend.</th>
                    <th className="p-2 text-right">%</th>
                    <th className="p-2 text-right">Atraso</th>
                    <th className="p-2">Responsável</th>
                    <th className="p-2">Impacto</th>
                    <th className="p-2">Ação recomendada</th>
                  </tr>
                </thead>
                <tbody>
                  {a.criticas.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="p-2">{c.descricao}</td>
                      <td className="p-2">{c.etapa ?? "—"}</td>
                      <td className="p-2 text-right">{fmtBRL(c.valor_pendente)}</td>
                      <td className="p-2 text-right">{fmtPct(c.percentual_concluido, 0)}</td>
                      <td className="p-2 text-right">{c.dias_atraso ? `${c.dias_atraso}d` : "—"}</td>
                      <td className="p-2">{c.responsavel_nome ?? <span className="text-rose-600">não definido</span>}</td>
                      <td className="p-2"><Badge variant="outline" className={`text-[10px] ${IMPACTO[c.impact_nivel]}`}>{c.impact_nivel} · {c.impact_score.toFixed(0)}</Badge></td>
                      <td className="p-2 text-muted-foreground">{c.acao_recomendada}</td>
                    </tr>
                  ))}
                  {a.criticas.length === 0 && (
                    <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhuma atividade com impacto gerencial relevante.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section icon={Link2} title={`Bloqueios identificados (${a.bloqueios.length})`} subtitle={`${a.num_bloqueadas} atividade(s) bloqueada(s) · ${fmtBRL(a.valor_bloqueado)} em risco`}>
            {a.bloqueios.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhum bloqueio entre etapas detectado.</div>
            ) : (
              <div className="space-y-2">
                {a.bloqueios.map((b, idx) => (
                  <div key={idx} className="rounded-xl border p-3 text-sm flex flex-wrap gap-x-4 gap-y-1">
                    <span><strong>{b.bloqueadora}</strong> bloqueia <em>{b.bloqueadas.join(", ")}</em></span>
                    <span>Valor em risco: <strong>{fmtBRL(b.valor_bloqueado)}</strong></span>
                    <span>Atraso: {b.dias_bloqueio}d</span>
                    <span>Responsável: {b.responsavel ?? "não definido"}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {a.frentes.length > 0 && (
            <Section icon={CheckCircle2} title="Prontidão das frentes" subtitle="Critérios atendidos por frente (responsável, datas, impedimentos, etapa, prioridade)">
              <div className="overflow-auto max-h-[300px] rounded-xl border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr className="text-left">
                      <th className="p-2">Atividade</th>
                      <th className="p-2 text-right">Prontidão</th>
                      <th className="p-2">Pendências</th>
                      <th className="p-2">Responsável</th>
                      <th className="p-2">Início previsto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.frentes.slice(0, 15).map((f, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{f.atividade}</td>
                        <td className="p-2 text-right">
                          <Badge variant="outline" className={`text-[10px] ${f.pct < 50 ? IMPACTO.critica : f.pct < 75 ? IMPACTO.alta : f.pct < 100 ? IMPACTO.media : IMPACTO.baixa}`}>
                            {f.criterios_ok}/{f.criterios_total} · {f.pct}%
                          </Badge>
                        </td>
                        <td className="p-2 text-muted-foreground">{f.pendencias.join(", ") || "—"}</td>
                        <td className="p-2">{f.responsavel ?? <span className="text-rose-600">não definido</span>}</td>
                        <td className="p-2">{fmtDt(f.data_necessaria)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </TabsContent>

        {/* ====== RECUPERAÇÃO ====== */}
        <TabsContent value="recup" className="space-y-5 mt-5">
          <Section icon={Target} title="Metas de recuperação">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {a.metas.map((m) => (
                <div key={m.rotulo} className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">{m.rotulo} · {fmtDt(m.data)}</div>
                  <div className="text-base font-semibold mt-1">{fmtPct(m.pct_esperado)}</div>
                  <div className="text-xs text-muted-foreground">{fmtBRL(m.valor_esperado)}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section icon={TrendingDown} title="Cenários gerenciais">
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl border p-3 space-y-1">
                <div className="font-semibold">1 — Inercial (ritmo atual)</div>
                <div>Data: <strong>{fmtDt(a.cenarios.atual.data)}</strong></div>
                <div>Atraso: {a.cenarios.atual.atraso_dias ?? "—"}d</div>
                <div>% no vencimento: {fmtPct(a.cenarios.atual.pct_no_vencimento)}</div>
              </div>
              <div className="rounded-xl border p-3 space-y-1">
                <div className="font-semibold">2 — Recuperação viável (+30%)</div>
                <div>Data: <strong>{fmtDt(a.cenarios.reforco_30.data)}</strong></div>
                <div>Atraso: {a.cenarios.reforco_30.atraso_dias ?? "—"}d</div>
                <div className="text-xs text-muted-foreground">{a.cenarios.reforco_30.observacao}</div>
              </div>
              <div className="rounded-xl border p-3 space-y-1">
                <div className="font-semibold">3 — Recuperação necessária</div>
                <div>Meta diária: <strong>{a.cenarios.necessario.meta_diaria != null ? `${a.cenarios.necessario.meta_diaria.toFixed(3)} %/dia` : "—"}</strong></div>
                <div>Meta semanal: {fmtPct(a.cenarios.necessario.meta_semanal)}</div>
                <div>Fator: {a.cenarios.necessario.fator_aceleracao != null ? `${a.cenarios.necessario.fator_aceleracao.toFixed(2)}x` : "—"}</div>
                <div className="text-xs text-muted-foreground">{a.cenarios.necessario.observacao}</div>
              </div>
            </div>
          </Section>

          {a.plano_acao.length > 0 && (
            <Section icon={Target} title="Plano de ação">
              <div className="overflow-auto max-h-[420px] rounded-xl border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr className="text-left">
                      <th className="p-2">Prioridade</th>
                      <th className="p-2">Ação</th>
                      <th className="p-2">Atividade</th>
                      <th className="p-2">Responsável</th>
                      <th className="p-2">Prazo</th>
                      <th className="p-2">Impacto</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.plano_acao.map((p, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2"><Badge variant="outline" className={`text-[10px] ${IMPACTO[p.prioridade]}`}>{p.prioridade}</Badge></td>
                        <td className="p-2">{p.acao}</td>
                        <td className="p-2">{p.atividade}</td>
                        <td className="p-2">{p.responsavel}</td>
                        <td className="p-2">{fmtDt(p.prazo)}</td>
                        <td className="p-2 text-muted-foreground">{p.impacto}</td>
                        <td className="p-2">{p.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          <Section icon={TrendingUp} title="Tendência e evolução">
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              {(["ontem", "sete_dias", "analise_anterior"] as const).map((k) => {
                const t = a.tendencia[k];
                if (!t) return <div key={k} className="rounded-xl border p-3 text-muted-foreground text-xs">Sem snapshot para comparação ({k.replace("_", " ")}).</div>;
                return (
                  <div key={k} className="rounded-xl border p-3 space-y-1">
                    <div className="font-semibold text-xs uppercase text-muted-foreground">{t.referencia}</div>
                    <div>Δ avanço: <strong>{t.delta_avanco > 0 ? "+" : ""}{t.delta_avanco.toFixed(2)} p.p.</strong></div>
                    <div>Risco anterior: {t.risco_anterior}</div>
                    <div>Δ críticas: {t.delta_criticas > 0 ? "+" : ""}{t.delta_criticas}</div>
                    {t.delta_fator != null && <div>Δ fator aceleração: {t.delta_fator > 0 ? "+" : ""}{t.delta_fator.toFixed(2)}</div>}
                  </div>
                );
              })}
            </div>
          </Section>
        </TabsContent>

        {/* ====== QUALIDADE DOS DADOS ====== */}
        <TabsContent value="qual" className="space-y-5 mt-5">
          <Section icon={Database} title="Cobertura dos dados" subtitle={`Confiança geral: ${cov.confianca}%`}>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-48 text-xs text-muted-foreground">Cobertura por valor</div>
                <Progress value={cov.cobertura_valor_pct} className="h-2 flex-1" />
                <div className="w-20 text-right text-sm tabular-nums">{fmtPct(cov.cobertura_valor_pct, 1)}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-48 text-xs text-muted-foreground">Cobertura por peso</div>
                <Progress value={cov.cobertura_peso_pct} className="h-2 flex-1" />
                <div className="w-20 text-right text-sm tabular-nums">{fmtPct(cov.cobertura_peso_pct, 1)}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-48 text-xs text-muted-foreground">Cobertura de planejamento</div>
                <Progress value={cov.cobertura_planejamento_pct} className="h-2 flex-1" />
                <div className="w-20 text-right text-sm tabular-nums">{fmtPct(cov.cobertura_planejamento_pct, 1)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              <Kpi label="Sem valor" value={String(cov.sem_valor)} tone={cov.sem_valor > 0 ? "warn" : "ok"} />
              <Kpi label="Sem peso" value={String(cov.sem_peso)} tone={cov.sem_peso > 0 ? "neutro" : "ok"} />
              <Kpi label="Sem data de início" value={String(cov.sem_planejamento_inicio)} tone={cov.sem_planejamento_inicio > 0 ? "warn" : "ok"} />
              <Kpi label="Sem data de fim" value={String(cov.sem_planejamento_fim)} tone={cov.sem_planejamento_fim > 0 ? "warn" : "ok"} />
              <Kpi label="Sem responsável" value={String(cov.sem_responsavel)} tone={cov.sem_responsavel > 0 ? "warn" : "ok"} />
              <Kpi label="Sem etapa" value={String(cov.sem_etapa)} tone={cov.sem_etapa > 0 ? "warn" : "ok"} />
              <Kpi label="Total de atividades" value={String(cov.total_atividades)} />
              <Kpi label="Divergência contrato × atividades" value={fmtBRL(fin.divergencia_contrato_atividades)} tone={fin.valor_vigente > 0 && Math.abs(fin.divergencia_contrato_atividades) > fin.valor_vigente * 0.05 ? "bad" : "neutro"} />
            </div>
          </Section>

          {a.gaps_dados.length > 0 && (
            <Section icon={AlertTriangle} title={`Inconsistências detectadas (${a.gaps_dados.length})`} subtitle={`Confiabilidade qualitativa: ${a.confiabilidade}`}>
              <ul className="text-sm list-disc list-inside text-muted-foreground space-y-1">
                {a.gaps_dados.map((g) => (
                  <li key={g.campo}>{g.campo}: <strong>{g.qtd}</strong></li>
                ))}
              </ul>
            </Section>
          )}

          <Section icon={ShieldAlert} title="Pontuação consolidada de risco" subtitle="Decomposição dos fatores agregados (legado)">
            <div className="space-y-1">
              {a.risco.fatores.map((f) => (
                <div key={f.fator} className="flex items-center gap-2 text-xs">
                  <div className="w-48 shrink-0">{f.fator}</div>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${(f.contrib / f.peso) * 100}%` }} />
                  </div>
                  <div className="w-24 text-right tabular-nums">{f.contrib.toFixed(1)} / {f.peso}</div>
                </div>
              ))}
            </div>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
