/**
 * Visão Executiva do Boletim de Medição — cards gerenciais,
 * curva S contratual × realizada, ranking de ofensores e projeção de encerramento.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getVisaoExecutivaMedicao } from "@/lib/boletim-medicao.functions";
import { fmtMoneyBR, fmtPctBR, computeItem, sanitizeDescricao, computePainelExecutivo, type IndicadorPainel } from "@/lib/boletim-medicao.calc";
import { Loader2, TrendingUp, AlertTriangle, Target, Calendar, TrendingDown, Minus, Gauge } from "lucide-react";

interface ItemLike {
  item_codigo: string;
  descricao: string;
  is_etapa: boolean;
  qtd_contratada: number;
  valor_unitario: number;
  qtd_acum_anterior: number;
  valor_acum_anterior: number;
  qtd_periodo: number;
}

export function VisaoExecutivaMedicao({
  medicaoId,
  itens,
  valorTotalContrato,
  valorMedicaoAtual,
  valorAcumulado,
  percentualExecutado,
}: {
  medicaoId: string;
  itens: ItemLike[];
  valorTotalContrato: number;
  valorMedicaoAtual: number;
  valorAcumulado: number;
  percentualExecutado: number;
}) {
  const get = useServerFn(getVisaoExecutivaMedicao);
  const { data, isLoading } = useQuery({
    queryKey: ["medicao-visao-exec", medicaoId],
    queryFn: () => get({ data: { id: medicaoId } }),
  });

  const saldoContratual = valorTotalContrato - valorAcumulado;
  const numBMsAprovados = useMemo(
    () => (data?.historico ?? []).filter((h: { status: string }) => h.status === "aprovada").length,
    [data],
  );

  // Curva S: pontos históricos (aprovados + esta em curso)
  const curva = useMemo(() => {
    const hist = (data?.historico ?? []) as Array<{
      id: string;
      numero: number;
      numero_bm: string | null;
      data_medicao: string | null;
      periodo_fim: string | null;
      valor_acumulado: number | string | null;
      status: string;
    }>;
    const pts: Array<{ label: string; acumulado: number; pct: number; data?: string | null }> = [];
    pts.push({ label: "Início", acumulado: 0, pct: 0 });
    for (const h of hist) {
      if (h.id === medicaoId) continue;
      const acum = Number(h.valor_acumulado ?? 0);
      pts.push({
        label: h.numero_bm ?? `BM ${String(h.numero).padStart(2, "0")}`,
        acumulado: acum,
        pct: valorTotalContrato > 0 ? acum / valorTotalContrato : 0,
        data: h.periodo_fim ?? h.data_medicao,
      });
    }
    pts.push({
      label: "Atual",
      acumulado: valorAcumulado,
      pct: percentualExecutado,
    });
    return pts;
  }, [data, medicaoId, valorAcumulado, valorTotalContrato, percentualExecutado]);

  // Curva contratual linear simples (planejado = distribuído em nº de BMs)
  const curvaPlanejada = useMemo(() => {
    const n = Math.max(curva.length - 1, 1);
    return curva.map((_, i) => ({
      pct: i / n,
      acumulado: (valorTotalContrato * i) / n,
    }));
  }, [curva, valorTotalContrato]);

  // Ranking de ofensores por saldo em R$
  const ofensores = useMemo(() => {
    return itens
      .filter((i) => !i.is_etapa)
      .map((i) => {
        const saldoQtd = i.qtd_contratada - (i.qtd_acum_anterior + i.qtd_periodo);
        const saldoValor = saldoQtd * i.valor_unitario;
        const c = computeItem(i);
        return {
          codigo: i.item_codigo,
          descricao: sanitizeDescricao(i.descricao),
          saldoValor,
          pct: c.pct_executado,
          totalContrato: i.qtd_contratada * i.valor_unitario,
        };
      })
      .filter((o) => o.saldoValor > 0.01)
      .sort((a, b) => b.saldoValor - a.saldoValor)
      .slice(0, 8);
  }, [itens]);

  // Projeção de encerramento (linear pela mediana de execução por BM)
  const projecao = useMemo(() => {
    if (percentualExecutado <= 0 || percentualExecutado >= 1) return null;
    const bmsFeitos = Math.max(numBMsAprovados + 1, 1);
    const ritmoPorBM = percentualExecutado / bmsFeitos;
    if (ritmoPorBM <= 0) return null;
    const bmsRestantes = Math.ceil((1 - percentualExecutado) / ritmoPorBM);
    return { bmsRestantes, ritmoPorBM };
  }, [percentualExecutado, numBMsAprovados]);

  if (isLoading) {
    return (
      <div className="p-8 text-sm text-[#69717D] flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando visão executiva…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs institucionais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ExecKpi icon={<Target className="w-4 h-4" />} label="Avanço físico-financeiro" value={fmtPctBR(percentualExecutado, 2)} accent />
        <ExecKpi icon={<TrendingUp className="w-4 h-4" />} label="Medido no período" value={fmtMoneyBR(valorMedicaoAtual)} />
        <ExecKpi icon={<Calendar className="w-4 h-4" />} label="Boletins aprovados" value={String(numBMsAprovados)} />
        <ExecKpi icon={<AlertTriangle className="w-4 h-4" />} label="Saldo contratual" value={fmtMoneyBR(saldoContratual)} />
      </div>

      {/* Curva S */}
      <div className="bg-white rounded-xl shadow-sm p-6 print:shadow-none">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#C8A66A] font-bold">Curva S</div>
            <div className="text-lg font-bold text-[#252A33]">Planejado × Realizado</div>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-[#69717D]">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-[#B0B7C1]" /> Planejado</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-[#C8A66A]" /> Realizado</span>
          </div>
        </div>
        <CurvaS curva={curva} planejada={curvaPlanejada} valorTotal={valorTotalContrato} />
      </div>

      {/* Projeção */}
      {projecao && (
        <div className="bg-gradient-to-br from-[#252A33] to-[#3B4250] text-white rounded-xl p-6 shadow-sm print:shadow-none">
          <div className="text-[10px] uppercase tracking-widest text-[#C8A66A] font-bold mb-2">Projeção de encerramento</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ProjItem label="Ritmo médio por BM" value={fmtPctBR(projecao.ritmoPorBM, 2)} />
            <ProjItem label="BMs restantes estimados" value={String(projecao.bmsRestantes)} accent />
            <ProjItem label="Encerramento em" value={`≈ ${projecao.bmsRestantes} boletins`} />
          </div>
          <div className="mt-4 text-[11px] text-white/70">
            Estimativa linear baseada no ritmo médio de execução dos boletins já registrados.
          </div>
        </div>
      )}

      {/* Top ofensores */}
      <div className="bg-white rounded-xl shadow-sm p-6 print:shadow-none">
        <div className="text-[10px] uppercase tracking-widest text-[#C8A66A] font-bold mb-1">Prioridades para encerrar o contrato</div>
        <div className="text-lg font-bold text-[#252A33] mb-4">Top 8 itens por saldo contratual</div>
        {ofensores.length === 0 ? (
          <div className="text-sm text-[#69717D]">Nenhum saldo relevante — contrato praticamente executado.</div>
        ) : (
          <div className="space-y-3">
            {ofensores.map((o) => {
              const share = o.totalContrato > 0 ? o.saldoValor / o.totalContrato : 0;
              return (
                <div key={o.codigo} className="flex items-center gap-3">
                  <div className="w-16 text-[11px] font-mono text-[#69717D]">{o.codigo}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-[#20242B] truncate" title={o.descricao}>{o.descricao}</div>
                    <div className="h-1.5 mt-1 bg-[#EEF0F2] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#C8A66A] to-[#E4D2AE]" style={{ width: `${Math.min(100, share * 100)}%` }} />
                    </div>
                  </div>
                  <div className="w-32 text-right">
                    <div className="text-[12px] font-bold text-[#252A33] tabular-nums">{fmtMoneyBR(o.saldoValor)}</div>
                    <div className="text-[10px] text-[#69717D]">{fmtPctBR(o.pct, 1)} executado</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ExecKpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl px-4 py-4 shadow-sm ${accent ? "bg-gradient-to-br from-[#C8A66A] to-[#B69354] text-white" : "bg-white"}`}>
      <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold ${accent ? "text-white/90" : "text-[#69717D]"}`}>
        {icon} {label}
      </div>
      <div className={`text-2xl font-bold mt-2 tabular-nums ${accent ? "text-white" : "text-[#252A33]"}`}>{value}</div>
    </div>
  );
}

function ProjItem({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-white/60 font-semibold">{label}</div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${accent ? "text-[#C8A66A]" : "text-white"}`}>{value}</div>
    </div>
  );
}

function CurvaS({
  curva,
  planejada,
  valorTotal,
}: {
  curva: Array<{ label: string; acumulado: number; pct: number }>;
  planejada: Array<{ pct: number; acumulado: number }>;
  valorTotal: number;
}) {
  const W = 800;
  const H = 260;
  const PAD_L = 60;
  const PAD_R = 20;
  const PAD_T = 20;
  const PAD_B = 40;
  const iw = W - PAD_L - PAD_R;
  const ih = H - PAD_T - PAD_B;
  const n = Math.max(curva.length - 1, 1);
  const maxY = Math.max(valorTotal, ...curva.map((c) => c.acumulado)) || 1;

  const x = (i: number) => PAD_L + (iw * i) / n;
  const y = (v: number) => PAD_T + ih - (ih * v) / maxY;

  const pathReal = curva.map((c, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(c.acumulado)}`).join(" ");
  const pathPlan = planejada.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.acumulado)}`).join(" ");
  const areaReal = `${pathReal} L ${x(n)} ${PAD_T + ih} L ${PAD_L} ${PAD_T + ih} Z`;

  const ticksY = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[260px]" preserveAspectRatio="xMidYMid meet">
        {ticksY.map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(maxY * t)} y2={y(maxY * t)} stroke="#EEF0F2" strokeWidth={1} />
            <text x={PAD_L - 8} y={y(maxY * t) + 4} textAnchor="end" fontSize={9} fill="#69717D">
              {(t * 100).toFixed(0)}%
            </text>
          </g>
        ))}
        <path d={areaReal} fill="#C8A66A" opacity={0.12} />
        <path d={pathPlan} fill="none" stroke="#B0B7C1" strokeWidth={2} strokeDasharray="6 4" />
        <path d={pathReal} fill="none" stroke="#C8A66A" strokeWidth={2.5} />
        {curva.map((c, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(c.acumulado)} r={4} fill="#C8A66A" stroke="#fff" strokeWidth={1.5} />
            <text x={x(i)} y={H - PAD_B + 16} textAnchor="middle" fontSize={9} fill="#69717D">
              {c.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
