/**
 * Fase 3 — Radar PNCP (server-only).
 *
 * Núcleo da coleta automática. Usado tanto pela server function
 * "coletarAgora" (acionada pelo botão na UI, escopo do usuário) quanto pelo
 * endpoint cron `/api/public/pncp-radar-cron` (escopo admin).
 *
 * NÃO importar deste módulo em código de cliente — o nome `.server.ts`
 * bloqueia esse arquivo do bundle do navegador.
 */

const PNCP_BASE = "https://pncp.gov.br/api/consulta/v1";

type AnyClient = any; // eslint-disable-line @typescript-eslint/no-explicit-any

interface FiltroRow {
  id: string;
  nome: string;
  palavras_chave: string[];
  ufs: string[];
  modalidades: string[]; // armazenamos como text[] de ids numéricos em string
  valor_min: number | null;
  valor_max: number | null;
  ativo: boolean;
}

interface ConfigRow {
  id: string;
  company_id: string;
  frequencia_coleta_horas: number;
  filtro_estado: string | null;
  filtro_modalidade: string | null;
  status: string;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

async function fetchPncpPage(args: {
  modalidadeId: number;
  uf?: string;
  dataFinal: string;
  pagina: number;
  tamanho: number;
}): Promise<{ data: Record<string, any>[]; totalPaginas: number; totalRegistros: number }> {
  const p = new URLSearchParams();
  p.set("dataFinal", args.dataFinal);
  p.set("codigoModalidadeContratacao", String(args.modalidadeId));
  if (args.uf) p.set("uf", args.uf);
  p.set("pagina", String(args.pagina));
  p.set("tamanhoPagina", String(args.tamanho));
  const r = await fetch(`${PNCP_BASE}/contratacoes/proposta?${p.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`PNCP ${r.status}`);
  const j = (await r.json()) as {
    data?: Record<string, any>[];
    totalPaginas?: number;
    totalRegistros?: number;
  };
  return {
    data: Array.isArray(j.data) ? j.data : [],
    totalPaginas: j.totalPaginas ?? 1,
    totalRegistros: j.totalRegistros ?? 0,
  };
}

function matchFiltro(it: Record<string, any>, f: FiltroRow): boolean {
  const objeto = String(it.objetoCompra ?? "").toLowerCase();
  const orgao = String(
    (it.orgaoEntidade as { razaoSocial?: string } | undefined)?.razaoSocial ?? "",
  ).toLowerCase();
  if (f.palavras_chave.length > 0) {
    const ok = f.palavras_chave.some((k) => {
      const kw = k.trim().toLowerCase();
      return kw && (objeto.includes(kw) || orgao.includes(kw));
    });
    if (!ok) return false;
  }
  const valor =
    typeof it.valorTotalEstimado === "number"
      ? (it.valorTotalEstimado as number)
      : it.valorTotalEstimado != null
        ? Number(it.valorTotalEstimado)
        : null;
  if (f.valor_min != null && (valor == null || valor < f.valor_min)) return false;
  if (f.valor_max != null && (valor == null || valor > f.valor_max)) return false;
  return true;
}

export interface RunCollectionResult {
  ok: boolean;
  totalEncontrados: number;
  totalNovos: number;
  totalAtualizados: number;
  novosAlertas: number;
  duracaoMs: number;
  erro?: string;
}

/**
 * Executa uma coleta para uma empresa. Lê filtros ativos; se não houver,
 * usa um filtro "padrão" baseado em filtro_estado/filtro_modalidade da config.
 * Limita o trabalho para não estourar a API: até 3 modalidades × até 1 UF
 * × até 2 páginas de 50.
 */
export async function runCollection(args: {
  client: AnyClient; // supabase (admin para cron, user para botão)
  companyId: string;
  config: ConfigRow | null;
}): Promise<RunCollectionResult> {
  const t0 = Date.now();
  const { client, companyId, config } = args;

  try {
    // Filtros ativos da empresa
    const { data: filtros } = await client
      .from("oportunidade_filtros")
      .select("id, nome, palavras_chave, ufs, modalidades, valor_min, valor_max, ativo")
      .eq("company_id", companyId)
      .eq("ativo", true);

    const filtrosAtivos: FiltroRow[] =
      (filtros as FiltroRow[] | null)?.length
        ? (filtros as FiltroRow[])
        : [
            {
              id: "default",
              nome: "Padrão",
              palavras_chave: [],
              ufs: config?.filtro_estado && config.filtro_estado !== "todos" ? [config.filtro_estado] : [],
              modalidades: config?.filtro_modalidade ? [config.filtro_modalidade] : ["6"],
              valor_min: null,
              valor_max: null,
              ativo: true,
            },
          ];

    const dataFinal = ymd(new Date(Date.now() + 60 * 86400000)); // 60 dias adiante
    let totalEncontrados = 0;
    let totalNovos = 0;
    let totalAtualizados = 0;
    let novosAlertas = 0;

    for (const f of filtrosAtivos) {
      const modalidades = (f.modalidades.length ? f.modalidades : ["6"]).slice(0, 3);
      const ufs = (f.ufs.length ? f.ufs : [undefined as unknown as string]).slice(0, 1);

      for (const modStr of modalidades) {
        const modId = Number(modStr);
        if (!Number.isFinite(modId) || modId < 1 || modId > 12) continue;
        for (const uf of ufs) {
          for (let pagina = 1; pagina <= 2; pagina++) {
            let page;
            try {
              page = await fetchPncpPage({
                modalidadeId: modId,
                uf: uf || undefined,
                dataFinal,
                pagina,
                tamanho: 50,
              });
            } catch (e) {
              // segue tentando próximos
              console.error("[radar] fetch error", (e as Error).message);
              break;
            }
            totalEncontrados += page.data.length;

            for (const it of page.data) {
              if (!matchFiltro(it, f)) continue;
              const pncpId = String(it.numeroControlePNCP ?? "");
              if (!pncpId) continue;

              const { data: existing } = await client
                .from("oportunidades")
                .select("id")
                .eq("company_id", companyId)
                .eq("pncp_id", pncpId)
                .maybeSingle();

              const payload = {
                company_id: companyId,
                pncp_id: pncpId,
                fonte: "pncp",
                numero_compra: (it.numeroCompra as string | null) ?? null,
                ano_compra: (it.anoCompra as number | null) ?? null,
                orgao_cnpj:
                  (it.orgaoEntidade as { cnpj?: string } | undefined)?.cnpj ?? null,
                orgao_nome:
                  (it.orgaoEntidade as { razaoSocial?: string } | undefined)?.razaoSocial ?? null,
                unidade_nome:
                  (it.unidadeOrgao as { nomeUnidade?: string } | undefined)?.nomeUnidade ?? null,
                uf: (it.unidadeOrgao as { ufSigla?: string } | undefined)?.ufSigla ?? null,
                municipio:
                  (it.unidadeOrgao as { municipioNome?: string } | undefined)?.municipioNome ?? null,
                modalidade: (it.modalidadeNome as string | null) ?? null,
                modo_disputa: (it.modoDisputaNome as string | null) ?? null,
                objeto: (it.objetoCompra as string | null) ?? null,
                valor_estimado:
                  typeof it.valorTotalEstimado === "number"
                    ? (it.valorTotalEstimado as number)
                    : it.valorTotalEstimado != null
                      ? Number(it.valorTotalEstimado)
                      : null,
                data_publicacao: (it.dataPublicacaoPncp as string | null) ?? null,
                data_abertura_propostas: (it.dataAberturaProposta as string | null) ?? null,
                data_encerramento_propostas:
                  (it.dataEncerramentoProposta as string | null) ?? null,
                link_sistema_origem: (it.linkSistemaOrigem as string | null) ?? null,
                raw: it,
              };

              if (existing?.id) {
                await client
                  .from("oportunidades")
                  .update({
                    valor_estimado: payload.valor_estimado,
                    data_encerramento_propostas: payload.data_encerramento_propostas,
                    raw: payload.raw,
                  })
                  .eq("id", existing.id);
                totalAtualizados++;
              } else {
                const { data: ins } = await client
                  .from("oportunidades")
                  .insert({ ...payload, situacao: "triagem" })
                  .select("id")
                  .single();
                totalNovos++;
                if (ins?.id) {
                  await client.from("oportunidade_alertas").insert({
                    company_id: companyId,
                    oportunidade_id: ins.id,
                    tipo: "nova_oportunidade",
                    titulo: `Nova oportunidade — ${payload.orgao_nome ?? "Órgão"}`,
                    descricao: payload.objeto ?? null,
                    urgencia: "media",
                  });
                  novosAlertas++;
                }
              }
            }

            if (page.data.length < 50) break; // sem mais páginas
          }
        }
      }
    }

    // Registrar histórico e atualizar config
    await client.from("pncp_coleta_historico").insert({
      company_id: companyId,
      total_encontrados: totalEncontrados,
      total_novos: totalNovos,
      total_atualizados: totalAtualizados,
      total_removidos: 0,
      novos_alertas: novosAlertas,
      status: "sucesso",
      tempo_execucao_ms: Date.now() - t0,
    });

    if (config) {
      const proxima = new Date(Date.now() + config.frequencia_coleta_horas * 3600 * 1000);
      await client
        .from("pncp_configuracoes")
        .update({
          ultima_coleta: new Date().toISOString(),
          proxima_coleta: proxima.toISOString(),
          status: "ativo",
        })
        .eq("id", config.id);
    }

    return {
      ok: true,
      totalEncontrados,
      totalNovos,
      totalAtualizados,
      novosAlertas,
      duracaoMs: Date.now() - t0,
    };
  } catch (e) {
    const msg = (e as Error).message;
    try {
      await client.from("pncp_coleta_historico").insert({
        company_id: companyId,
        total_encontrados: 0,
        total_novos: 0,
        total_atualizados: 0,
        total_removidos: 0,
        novos_alertas: 0,
        status: "erro",
        mensagem_erro: msg,
        tempo_execucao_ms: Date.now() - t0,
      });
    } catch {
      /* noop */
    }
    return {
      ok: false,
      totalEncontrados: 0,
      totalNovos: 0,
      totalAtualizados: 0,
      novosAlertas: 0,
      duracaoMs: Date.now() - t0,
      erro: msg,
    };
  }
}
