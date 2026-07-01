/**
 * Fase H — Painel de aditivos e reajustes contratuais.
 * Mostra o impacto financeiro e de prazo no contrato vigente,
 * comparando valor original x valor ajustado (base + aditivos + reajustes aplicados).
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getContratoImpactos } from "@/lib/boletim-medicao.functions";
import { fmtMoneyBR } from "@/lib/boletim-medicao.calc";
import { Badge } from "@/components/ui/badge";
import { FileSignature, TrendingUp, TrendingDown, Calendar, Loader2, Info } from "lucide-react";

interface Props {
  medicaoId: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    aplicado: "bg-emerald-50 text-emerald-700 border-emerald-200",
    aprovado: "bg-[#F5EEDD] text-[#8A6D2E] border-[#E4D2AE]",
    pendente: "bg-slate-100 text-slate-600 border-slate-200",
    rascunho: "bg-slate-100 text-slate-500 border-slate-200",
    cancelado: "bg-red-50 text-red-700 border-red-200",
  };
  const cls = map[status] ?? "bg-slate-100 text-slate-600 border-slate-200";
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}>{status}</span>;
}

export function ContratoImpactosPanel({ medicaoId }: Props) {
  const fetchImpactos = useServerFn(getContratoImpactos);
  const { data, isLoading } = useQuery({
    queryKey: ["contrato-impactos", medicaoId],
    queryFn: () => fetchImpactos({ data: { medicao_id: medicaoId } }),
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-2 text-sm text-[#69717D]">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando impactos contratuais…
      </div>
    );
  }
  if (!data) return null;
  const { resumo, aditivos, reajustes, contrato } = data;

  const deltaFinanceiro = resumo.valor_aditivos + resumo.valor_reajustes;
  const deltaPct = resumo.valor_original > 0 ? (deltaFinanceiro / resumo.valor_original) * 100 : 0;
  const isAumento = deltaFinanceiro >= 0;

  return (
    <section className="bg-white rounded-xl shadow-sm overflow-hidden print:shadow-none">
      {/* Header institucional */}
      <div className="bg-gradient-to-br from-[#252A33] to-[#3B4250] text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[#C8A66A] font-bold flex items-center gap-1.5">
            <FileSignature className="w-3.5 h-3.5" /> Fase H — Aditivos & reajustes
          </div>
          <div className="text-lg font-bold mt-0.5">Impactos no contrato {contrato?.numero ?? ""}</div>
          <div className="text-[11px] text-white/70 mt-0.5">Base contratual ajustada pelos aditivos e reajustes formalmente aplicados.</div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <div className="flex flex-col items-end">
            <span className="text-white/60 uppercase tracking-wider text-[9px]">Valor original</span>
            <span className="font-mono font-semibold text-white">{fmtMoneyBR(resumo.valor_original)}</span>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="flex flex-col items-end">
            <span className="text-[#C8A66A] uppercase tracking-wider text-[9px]">Valor ajustado</span>
            <span className="font-mono font-bold text-[#C8A66A] text-base">{fmtMoneyBR(resumo.valor_ajustado)}</span>
          </div>
        </div>
      </div>

      {/* Resumo cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-[#F7F8FA]">
        <ResumoCard
          label="Aditivos aplicados"
          value={fmtMoneyBR(resumo.valor_aditivos)}
          detail={`${resumo.qtd_aditivos_aplicados} aplicado(s) • ${resumo.qtd_aditivos_pendentes} pendente(s)`}
          positive={resumo.valor_aditivos >= 0}
        />
        <ResumoCard
          label="Reajustes aplicados"
          value={fmtMoneyBR(resumo.valor_reajustes)}
          detail={`${resumo.qtd_reajustes_aplicados} aplicado(s) • ${resumo.qtd_reajustes_pendentes} pendente(s)`}
          positive={resumo.valor_reajustes >= 0}
        />
        <ResumoCard
          label="Variação total"
          value={`${isAumento ? "+" : ""}${fmtMoneyBR(deltaFinanceiro)}`}
          detail={`${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(2)}% sobre o original`}
          positive={isAumento}
          icon={isAumento ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        />
        <ResumoCard
          label="Prazo ajustado"
          value={`${resumo.prazo_ajustado_dias} dias`}
          detail={`${resumo.prazo_delta_dias >= 0 ? "+" : ""}${resumo.prazo_delta_dias} dias vs. original`}
          positive={resumo.prazo_delta_dias >= 0}
          icon={<Calendar className="w-3 h-3" />}
        />
      </div>

      {/* Tabelas */}
      <div className="p-4 space-y-6">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#785F44] mb-2">Aditivos contratuais</h3>
          {aditivos.length === 0 ? (
            <div className="text-xs text-[#69717D] italic flex items-center gap-1.5 py-3 px-4 bg-[#F7F8FA] rounded-md">
              <Info className="w-3.5 h-3.5" /> Nenhum aditivo registrado para este contrato.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-[#EEF0F2]">
              <table className="w-full text-xs">
                <thead className="bg-[#F7F8FA] text-[#69717D]">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Nº</th>
                    <th className="text-left px-3 py-2 font-semibold">Tipo</th>
                    <th className="text-right px-3 py-2 font-semibold">Valor</th>
                    <th className="text-right px-3 py-2 font-semibold">Prazo (d)</th>
                    <th className="text-left px-3 py-2 font-semibold">Assinatura</th>
                    <th className="text-left px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {aditivos.map((a) => (
                    <tr key={a.id} className="border-t border-[#EEF0F2]">
                      <td className="px-3 py-2 font-mono font-semibold text-[#252A33]">#{a.numero}</td>
                      <td className="px-3 py-2 capitalize">{a.tipo}</td>
                      <td className={`px-3 py-2 text-right font-mono ${a.valor_delta >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {a.valor_delta >= 0 ? "+" : ""}{fmtMoneyBR(a.valor_delta)}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono ${a.prazo_dias_delta >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {a.prazo_dias_delta >= 0 ? "+" : ""}{a.prazo_dias_delta}
                      </td>
                      <td className="px-3 py-2 text-[#69717D]">{a.data_assinatura ? new Date(a.data_assinatura).toLocaleDateString("pt-BR") : "—"}</td>
                      <td className="px-3 py-2"><StatusBadge status={a.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#785F44] mb-2">Reajustes contratuais</h3>
          {reajustes.length === 0 ? (
            <div className="text-xs text-[#69717D] italic flex items-center gap-1.5 py-3 px-4 bg-[#F7F8FA] rounded-md">
              <Info className="w-3.5 h-3.5" /> Nenhum reajuste registrado para este contrato.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-[#EEF0F2]">
              <table className="w-full text-xs">
                <thead className="bg-[#F7F8FA] text-[#69717D]">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Nº</th>
                    <th className="text-left px-3 py-2 font-semibold">Índice</th>
                    <th className="text-left px-3 py-2 font-semibold">Período</th>
                    <th className="text-right px-3 py-2 font-semibold">%</th>
                    <th className="text-right px-3 py-2 font-semibold">Valor reajuste</th>
                    <th className="text-left px-3 py-2 font-semibold">Aplicação</th>
                    <th className="text-left px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reajustes.map((r) => (
                    <tr key={r.id} className="border-t border-[#EEF0F2]">
                      <td className="px-3 py-2 font-mono font-semibold text-[#252A33]">#{r.numero}</td>
                      <td className="px-3 py-2 font-semibold">{r.indice}</td>
                      <td className="px-3 py-2 text-[#69717D]">
                        {new Date(r.periodo_inicio).toLocaleDateString("pt-BR")} → {new Date(r.periodo_fim).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{Number(r.percentual_acumulado).toFixed(4)}%</td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-700">+{fmtMoneyBR(r.valor_reajuste)}</td>
                      <td className="px-3 py-2 text-[#69717D]">{r.data_aplicacao ? new Date(r.data_aplicacao).toLocaleDateString("pt-BR") : "—"}</td>
                      <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="text-[10px] text-[#69717D] italic border-t border-[#EEF0F2] pt-3">
          <Badge variant="outline" className="text-[9px] mr-1">Cálculo</Badge>
          Valor ajustado = Valor original + Σ aditivos (aplicados) + Σ reajustes (aplicados). Somente instrumentos com status "aplicado" impactam o saldo contratual do boletim.
        </div>
      </div>
    </section>
  );
}

function ResumoCard({
  label,
  value,
  detail,
  positive,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  positive: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-md border border-[#EEF0F2] px-3 py-2.5">
      <div className="text-[9px] uppercase tracking-widest text-[#69717D] font-semibold flex items-center gap-1">
        {icon} {label}
      </div>
      <div className={`text-sm font-bold font-mono mt-0.5 ${positive ? "text-emerald-700" : "text-red-700"}`}>{value}</div>
      <div className="text-[10px] text-[#69717D] mt-0.5">{detail}</div>
    </div>
  );
}
