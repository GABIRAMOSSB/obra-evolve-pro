/**
 * Painel V2 da Análise Gerencial da Obra.
 *
 * Lê exclusivamente de obra_atividades (read-only). Renderiza os 21 blocos
 * de indicadores e atualiza automaticamente quando as atividades mudam
 * (via realtime + invalidação de query).
 */
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAnaliseV2 } from "@/lib/analise-v2.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Activity, AlertTriangle, TrendingUp, TrendingDown, Loader2, RefreshCw,
  Target, Calendar, ShieldAlert, Layers, Link2, CheckCircle2,
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

function Section({ icon: Icon, title, subtitle, children }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start gap-2 border-b pb-2">
        <Icon className="w-4 h-4 mt-1 text-primary" />
        <div className="flex-1">
          <div className="font-semibold text-sm">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
      {children}
    </Card>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "ok" | "warn" | "bad" }) {
  const toneCls = tone === "bad" ? "text-rose-600" : tone === "warn" ? "text-amber-600" : tone === "ok" ? "text-emerald-600" : "";
  return (
    <div className="rounded-md border bg-card/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold mt-1 ${toneCls}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{hint}</div>}
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
      <Card className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Calculando análise gerencial…
      </Card>
    );
  }
  if (q.error) {
    return (
      <Card className="p-6 text-sm text-rose-600">
        Erro: {(q.error as Error).message}
        <Button size="sm" variant="outline" className="ml-3" onClick={() => q.refetch()}>Tentar novamente</Button>
      </Card>
    );
  }
  if (!q.data || !q.data.initialized) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Esta obra ainda não está sincronizada com o banco gerencial. Abra a aba <strong>Atividades</strong> uma vez para inicializar e volte aqui.
      </Card>
    );
  }

  const a = q.data.analise;
  const i = a.indicadores;
  const r = a.ritmo;
  const score = a.risco.score;

  return (
    <div className="space-y-4">
      {/* CABEÇALHO + RISCO + DIAGNÓSTICO */}
      <Card className="p-4 space-y-3 border-primary/30">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">Análise Gerencial — {a.obra_nome}</h2>
            <Badge variant="outline" className={`uppercase text-xs ${RISCO[a.risco.nivel]}`}>
              Risco {a.risco.nivel.replace("_", " ")} · {score.toFixed(0)}/100
            </Badge>
            <Badge variant="outline" className="text-xs">Confiabilidade {a.confiabilidade}</Badge>
            <Badge variant="outline" className="text-xs">Método: {a.metodo_avanco}</Badge>
          </div>
          <Button size="sm" variant="outline" onClick={() => q.refetch()}>
            <RefreshCw className="w-3 h-3 mr-1" /> Recalcular
          </Button>
        </div>
        <Progress value={score} className="h-2" />
        <div className="grid md:grid-cols-5 gap-3 text-sm">
          <div className="md:col-span-2 space-y-2">
            <div><span className="font-semibold">Situação: </span>{a.diagnostico.situacao}</div>
            <div><span className="font-semibold">Causa principal: </span>{a.diagnostico.causa}</div>
          </div>
          <div className="md:col-span-3 space-y-2">
            <div><span className="font-semibold">Consequência: </span>{a.diagnostico.consequencia}</div>
            <div><span className="font-semibold">Recuperação: </span>{a.diagnostico.recuperacao}</div>
            <div><span className="font-semibold">Decisão: </span>{a.diagnostico.decisao}</div>
          </div>
        </div>
        {a.frase_resultado && (
          <div className="text-sm rounded-md bg-primary/5 border border-primary/20 p-3 leading-relaxed">
            {a.frase_resultado}
          </div>
        )}
      </Card>

      {/* 1. INDICADORES PRINCIPAIS */}
      <Section icon={Target} title="Indicadores principais" subtitle="Prazo, avanço e desempenho">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Prazo consumido" value={fmtPct(i.prazo_consumido)} hint={`${i.dias_decorridos ?? "—"} / ${i.prazo_total ?? "—"} dias · restam ${i.dias_restantes ?? "—"}`} />
          <Kpi label="Avanço ponderado" value={fmtPct(i.avanco)} hint={`Executado ${fmtBRL(i.valor_executado)} de ${fmtBRL(i.valor_total)}`} />
          <Kpi label="Desvio" value={i.desvio != null ? `${i.desvio > 0 ? "+" : ""}${i.desvio.toFixed(2)} p.p.` : "—"} hint={i.desvio_classe ?? undefined} tone={i.desvio != null && i.desvio < -10 ? "bad" : i.desvio != null && i.desvio < -5 ? "warn" : "ok"} />
          <Kpi label="Índice de desempenho" value={fmtNum(i.idp, 2)} hint={i.idp != null ? `A cada 1% de prazo, ${(i.idp * 100).toFixed(0)}% de avanço` : undefined} tone={i.idp != null && i.idp < 0.75 ? "bad" : i.idp != null && i.idp < 0.9 ? "warn" : "ok"} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Data contratual" value={fmtDt(i.data_fim_prevista)} />
          <Kpi label="Valor contratado" value={fmtBRL(i.valor_total)} />
          <Kpi label="Saldo a executar" value={fmtBRL(i.saldo_executar)} />
          <Kpi label="Início" value={fmtDt(i.data_inicio)} />
        </div>
      </Section>

      {/* 2. RITMO */}
      <Section icon={TrendingUp} title="Ritmo de produção" subtitle={r.frase ?? "Comparação realizado x necessário"}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Ritmo acumulado" value={fmtNum(r.acumulado, 3) + " %/dia"} />
          <Kpi label="Últimos 7 dias" value={r.ultimos_7d != null ? `${r.ultimos_7d.toFixed(3)} %/dia` : "—"} />
          <Kpi label="Últimos 15 dias" value={r.ultimos_15d != null ? `${r.ultimos_15d.toFixed(3)} %/dia` : "—"} />
          <Kpi label="Necessário" value={r.necessario != null ? `${r.necessario.toFixed(3)} %/dia` : "—"} hint={r.producao_financ_dia != null ? `${fmtBRL(r.producao_financ_dia)}/dia` : undefined} />
          <Kpi label="Fator de aceleração" value={r.fator_aceleracao != null ? `${r.fator_aceleracao.toFixed(2)}x` : "—"} hint={r.fator_classe} tone={r.fator_aceleracao != null && r.fator_aceleracao > 1.6 ? "bad" : r.fator_aceleracao != null && r.fator_aceleracao > 1.3 ? "warn" : "ok"} />
          <Kpi label="Meta semanal (%)" value={fmtPct(r.meta_semanal_pct, 2)} />
          <Kpi label="Meta semanal (R$)" value={fmtBRL(r.meta_semanal_valor)} />
          <Kpi label="Desempenho semana atual" value={a.produtividade.desempenho_semanal != null ? `${a.produtividade.desempenho_semanal.toFixed(0)}%` : "—"} tone={a.produtividade.desempenho_semanal != null && a.produtividade.desempenho_semanal < 75 ? "bad" : "ok"} />
        </div>
      </Section>

      {/* 3. PROJEÇÃO */}
      <Section icon={Calendar} title="Projeção de conclusão" subtitle={`Tendência recente: ${a.projecao.tendencia_recente === "melhor" ? "melhor que a média" : a.projecao.tendencia_recente === "pior" ? "pior que a média histórica" : "estável"}`}>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-md border p-3 space-y-1">
            <div className="text-xs uppercase text-muted-foreground">Cenário pelo ritmo acumulado</div>
            <div className="text-sm">Conclusão projetada: <strong>{fmtDt(a.projecao.acumulado.data)}</strong></div>
            <div className="text-sm">Atraso projetado: <strong>{a.projecao.acumulado.atraso_dias ?? "—"} dias</strong></div>
            <div className="text-sm">% no vencimento: <strong>{fmtPct(a.projecao.acumulado.pct_no_vencimento)}</strong></div>
          </div>
          <div className="rounded-md border p-3 space-y-1">
            <div className="text-xs uppercase text-muted-foreground">Cenário pelo ritmo recente (7–14d)</div>
            <div className="text-sm">Conclusão projetada: <strong>{fmtDt(a.projecao.recente.data)}</strong></div>
            <div className="text-sm">Atraso projetado: <strong>{a.projecao.recente.atraso_dias ?? "—"} dias</strong></div>
            <div className="text-sm">% no vencimento: <strong>{fmtPct(a.projecao.recente.pct_no_vencimento)}</strong></div>
          </div>
        </div>
      </Section>

      {/* 4. ATIVIDADES CRÍTICAS */}
      <Section icon={AlertTriangle} title={`Atividades críticas (${a.criticas.length})`} subtitle="Ordenadas por índice de impacto">
        <div className="overflow-auto max-h-[420px] rounded-md border">
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
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhuma atividade crítica identificada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 5. EXPOSIÇÃO FINANCEIRA */}
      <Section icon={ShieldAlert} title="Exposição financeira" subtitle="Onde o dinheiro está parado">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi label="Não iniciadas" value={fmtBRL(a.exposicao.valor_nao_iniciadas)} />
          <Kpi label="Atrasadas" value={fmtBRL(a.exposicao.valor_atrasadas)} />
          <Kpi label="Críticas" value={fmtBRL(a.exposicao.valor_criticas)} tone="bad" />
          <Kpi label="% contrato com 0%" value={fmtPct(a.exposicao.pct_contrato_zero)} />
          <Kpi label="% top 5 pendentes" value={fmtPct(a.exposicao.pct_top5)} />
        </div>
        {a.exposicao.top5.length > 0 && (
          <div className="text-xs text-muted-foreground">
            As 5 maiores pendentes: {a.exposicao.top5.map((t) => `${t.descricao} (${fmtBRL(t.valor_pendente)})`).join(" · ")}
          </div>
        )}
      </Section>

      {/* 6. POR ETAPA */}
      <Section icon={Layers} title="Análise por etapa">
        <div className="overflow-auto rounded-md border">
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

      {/* 7. DEPENDÊNCIAS E BLOQUEIOS */}
      <Section icon={Link2} title={`Bloqueios identificados (${a.bloqueios.length})`} subtitle={`${a.num_bloqueadas} atividade(s) bloqueada(s) · ${fmtBRL(a.valor_bloqueado)} em risco`}>
        {a.bloqueios.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhum bloqueio entre etapas detectado.</div>
        ) : (
          <div className="space-y-2">
            {a.bloqueios.map((b, idx) => (
              <div key={idx} className="rounded-md border p-3 text-sm flex flex-wrap gap-x-4 gap-y-1">
                <span><strong>{b.bloqueadora}</strong> bloqueia <em>{b.bloqueadas.join(", ")}</em></span>
                <span>Valor em risco: <strong>{fmtBRL(b.valor_bloqueado)}</strong></span>
                <span>Atraso: {b.dias_bloqueio}d</span>
                <span>Responsável: {b.responsavel ?? "não definido"}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 8. PRONTIDÃO DAS FRENTES */}
      {a.frentes.length > 0 && (
        <Section icon={CheckCircle2} title="Prontidão das frentes">
          <div className="overflow-auto max-h-[300px] rounded-md border">
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
                        {f.pct}%
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

      {/* 10. METAS DE RECUPERAÇÃO */}
      <Section icon={Target} title="Metas de recuperação">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {a.metas.map((m) => (
            <div key={m.rotulo} className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">{m.rotulo} · {fmtDt(m.data)}</div>
              <div className="text-sm font-semibold mt-1">{fmtPct(m.pct_esperado)}</div>
              <div className="text-xs text-muted-foreground">{fmtBRL(m.valor_esperado)}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* 11. CENÁRIOS */}
      <Section icon={TrendingDown} title="Cenários gerenciais">
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-md border p-3 space-y-1">
            <div className="font-semibold">1 — Ritmo atual</div>
            <div>Data: {fmtDt(a.cenarios.atual.data)}</div>
            <div>Atraso: {a.cenarios.atual.atraso_dias ?? "—"}d</div>
            <div>% no vencimento: {fmtPct(a.cenarios.atual.pct_no_vencimento)}</div>
          </div>
          <div className="rounded-md border p-3 space-y-1">
            <div className="font-semibold">2 — Reforço de 30%</div>
            <div>Data: {fmtDt(a.cenarios.reforco_30.data)}</div>
            <div>Atraso: {a.cenarios.reforco_30.atraso_dias ?? "—"}d</div>
            <div className="text-xs text-muted-foreground">{a.cenarios.reforco_30.observacao}</div>
          </div>
          <div className="rounded-md border p-3 space-y-1">
            <div className="font-semibold">3 — Ritmo necessário</div>
            <div>Meta diária: {a.cenarios.necessario.meta_diaria != null ? `${a.cenarios.necessario.meta_diaria.toFixed(3)} %/dia` : "—"}</div>
            <div>Meta semanal: {fmtPct(a.cenarios.necessario.meta_semanal)}</div>
            <div>Fator: {a.cenarios.necessario.fator_aceleracao != null ? `${a.cenarios.necessario.fator_aceleracao.toFixed(2)}x` : "—"}</div>
            <div className="text-xs text-muted-foreground">{a.cenarios.necessario.observacao}</div>
          </div>
        </div>
      </Section>

      {/* 12. PONTUAÇÃO DO RISCO */}
      <Section icon={ShieldAlert} title={`Pontuação de risco: ${score.toFixed(0)}/100`} subtitle={`Nível: ${a.risco.nivel.replace("_", " ")}`}>
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

      {/* 13. CONFIABILIDADE */}
      {a.gaps_dados.length > 0 && (
        <Section icon={AlertTriangle} title={`Confiabilidade: ${a.confiabilidade}`} subtitle="Dados ausentes que reduzem a precisão">
          <ul className="text-sm list-disc list-inside text-muted-foreground">
            {a.gaps_dados.map((g) => (
              <li key={g.campo}>{g.campo}: <strong>{g.qtd}</strong></li>
            ))}
          </ul>
        </Section>
      )}

      {/* 15. DECISÕES NECESSÁRIAS AGORA */}
      {a.decisoes.length > 0 && (
        <Section icon={AlertTriangle} title={`Decisões necessárias agora (${a.decisoes.length})`}>
          <div className="grid md:grid-cols-2 gap-3">
            {a.decisoes.map((d, idx) => (
              <div key={idx} className="rounded-md border p-3 space-y-1 text-sm bg-rose-500/5 border-rose-500/20">
                <div><strong>Problema:</strong> {d.problema}</div>
                <div><strong>Impacto:</strong> {d.impacto}</div>
                <div><strong>Decisão:</strong> {d.decisao}</div>
                <div className="text-xs text-muted-foreground">Responsável: {d.responsavel} · Prazo: {d.prazo}</div>
                <div className="text-xs text-muted-foreground">Esperado: {d.resultado_esperado}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 16. PLANO DE AÇÃO */}
      {a.plano_acao.length > 0 && (
        <Section icon={Target} title="Plano de ação">
          <div className="overflow-auto max-h-[420px] rounded-md border">
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

      {/* 17. TENDÊNCIA */}
      <Section icon={TrendingUp} title="Tendência e evolução">
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          {(["ontem", "sete_dias", "analise_anterior"] as const).map((k) => {
            const t = a.tendencia[k];
            if (!t) return <div key={k} className="rounded-md border p-3 text-muted-foreground text-xs">Sem snapshot para comparação ({k.replace("_", " ")}).</div>;
            return (
              <div key={k} className="rounded-md border p-3 space-y-1">
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

      {/* 18. ALERTAS */}
      {a.alertas.length > 0 && (
        <Section icon={AlertTriangle} title={`Alertas inteligentes (${a.alertas.length})`}>
          <ul className="space-y-1 text-sm">
            {a.alertas.map((al, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <Badge variant="outline" className={`text-[10px] ${al.severidade === "alta" ? IMPACTO.critica : IMPACTO.media}`}>{al.severidade}</Badge>
                <span>{al.mensagem}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
