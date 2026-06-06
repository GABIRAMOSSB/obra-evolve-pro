import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  searchPncp,
  importOportunidade,
  listOportunidades,
  updateOportunidadeSituacao,
  MODALIDADES_PNCP,
  type PncpSearchResult,
  type OportunidadeRow,
} from "@/lib/oportunidades.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Radar, Loader2, ExternalLink, Plus, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/oportunidades")({
  component: OportunidadesPage,
  head: () => ({ meta: [{ title: "Radar PNCP — SOLV Gestão" }] }),
});

const UFS = ["", "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const SITUACOES: Array<{ id: OportunidadeRow["situacao"] extends string ? string : never; label: string; tone: string }> = [
  { id: "triagem", label: "Triagem", tone: "bg-muted/40 text-foreground border-border" },
  { id: "analise", label: "Em análise", tone: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  { id: "preparando_proposta", label: "Preparando proposta", tone: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  { id: "enviada", label: "Enviada", tone: "bg-primary/15 text-primary-glow border-primary/30" },
  { id: "resultado_aguardando", label: "Aguardando resultado", tone: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  { id: "ganha", label: "Ganha", tone: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  { id: "perdida", label: "Perdida", tone: "bg-red-500/15 text-red-400 border-red-500/30" },
  { id: "arquivada", label: "Arquivada", tone: "bg-muted/30 text-muted-foreground border-border" },
];

function fmtCurrency(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(v: string | null): string {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString("pt-BR"); } catch { return v; }
}
function todayYmd(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function OportunidadesPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Radar className="w-6 h-6 text-primary" /> Radar PNCP
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Triagem de licitações públicas (somente leitura). O envio da proposta segue manual nos portais específicos.
        </p>
      </div>

      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="buscar">Buscar no PNCP</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline"><PipelinePanel /></TabsContent>
        <TabsContent value="buscar"><BuscaPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------------------- BUSCA -------------------------------- */

function BuscaPanel() {
  const [modalidade, setModalidade] = useState<string>("6"); // pregão eletrônico
  const [uf, setUf] = useState<string>("");
  const [dataFinal, setDataFinal] = useState<string>(todayYmd(30));
  const [palavra, setPalavra] = useState<string>("");
  const [resultado, setResultado] = useState<PncpSearchResult | null>(null);

  const searchFn = useServerFn(searchPncp);
  const importFn = useServerFn(importOportunidade);
  const qc = useQueryClient();

  const buscar = useMutation({
    mutationFn: () =>
      searchFn({
        data: {
          codigoModalidadeContratacao: Number(modalidade),
          dataFinal,
          uf: (uf || undefined) as never,
          palavraChave: palavra.trim() || undefined,
          pagina: 1,
          tamanhoPagina: 50,
        },
      }),
    onSuccess: (r) => {
      setResultado(r);
      toast.success(`${r.items.length} oportunidades retornadas`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importar = useMutation({
    mutationFn: (it: PncpSearchResult["items"][number]) =>
      importFn({
        data: {
          numeroControlePNCP: it.numeroControlePNCP,
          numeroCompra: it.numeroCompra,
          anoCompra: it.anoCompra,
          orgaoCnpj: it.orgaoEntidade.cnpj,
          orgaoNome: it.orgaoEntidade.razaoSocial,
          unidadeNome: it.unidadeOrgao.nomeUnidade,
          uf: it.unidadeOrgao.ufSigla,
          municipio: it.unidadeOrgao.municipioNome,
          modalidade: it.modalidadeNome,
          modoDisputa: it.modoDisputaNome,
          objeto: it.objetoCompra,
          valorEstimado: it.valorTotalEstimado,
          dataPublicacao: it.dataPublicacaoPncp,
          dataAberturaPropostas: it.dataAberturaProposta,
          dataEncerramentoPropostas: it.dataEncerramentoProposta,
          linkSistemaOrigem: it.linkSistemaOrigem,
          raw: it.raw,
        },
      }),
    onSuccess: (r) => {
      toast.success(r.created ? "Adicionada ao pipeline" : "Já estava no pipeline");
      qc.invalidateQueries({ queryKey: ["oportunidades"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Modalidade</Label>
            <Select value={modalidade} onValueChange={setModalidade}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODALIDADES_PNCP.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">UF</Label>
            <Select value={uf || "__all"} onValueChange={(v) => setUf(v === "__all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas</SelectItem>
                {UFS.filter(Boolean).map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data limite (encerramento) — AAAAMMDD</Label>
            <Input value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} maxLength={8} />
          </div>
          <div className="space-y-1.5 md:col-span-1">
            <Label className="text-xs">Palavra-chave</Label>
            <Input value={palavra} onChange={(e) => setPalavra(e.target.value)} placeholder="pavimentação, escola…" />
          </div>
          <Button onClick={() => buscar.mutate()} disabled={buscar.isPending} className="gap-2">
            {buscar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          API pública do PNCP. Retorna até 50 itens por página, filtra propostas em aberto até a data informada.
        </p>
      </Card>

      {resultado && (
        <Card className="overflow-hidden">
          <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/30 border-b border-border">
            {resultado.items.length} de {resultado.total} resultados
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/20 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Órgão / Unidade</th>
                  <th className="px-3 py-2 text-left">Objeto</th>
                  <th className="px-3 py-2 text-left">UF / Município</th>
                  <th className="px-3 py-2 text-right">Estimado</th>
                  <th className="px-3 py-2 text-left">Encerra</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {resultado.items.map((it) => (
                  <tr key={it.numeroControlePNCP} className="hover:bg-muted/10">
                    <td className="px-3 py-2.5">
                      <div className="font-medium truncate max-w-[260px]">{it.orgaoEntidade.razaoSocial ?? "—"}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[260px]">{it.unidadeOrgao.nomeUnidade ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs max-w-[360px]">
                      <div className="line-clamp-3">{it.objetoCompra ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">{it.modalidadeNome}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {it.unidadeOrgao.ufSigla ?? "—"} / {it.unidadeOrgao.municipioNome ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtCurrency(it.valorTotalEstimado)}</td>
                    <td className="px-3 py-2.5 text-xs">{fmtDate(it.dataEncerramentoProposta)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex gap-1.5">
                        {it.linkSistemaOrigem && (
                          <a href={it.linkSistemaOrigem} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost" title="Abrir no portal">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </a>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={importar.isPending}
                          onClick={() => importar.mutate(it)}
                          className="gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Pipeline
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {resultado.items.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum resultado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------- PIPELINE ------------------------------- */

function PipelinePanel() {
  const [situacao, setSituacao] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const listFn = useServerFn(listOportunidades);
  const updateSit = useServerFn(updateOportunidadeSituacao);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["oportunidades", situacao, q],
    queryFn: () =>
      listFn({
        data: {
          situacao: (situacao || undefined) as never,
          q: q.trim() || undefined,
        },
      }),
  });

  const change = useMutation({
    mutationFn: (p: { id: string; situacao: string }) =>
      updateSit({ data: { id: p.id, situacao: p.situacao as never } }),
    onSuccess: () => {
      toast.success("Situação atualizada");
      qc.invalidateQueries({ queryKey: ["oportunidades"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of data ?? []) m.set(it.situacao, (m.get(it.situacao) ?? 0) + 1);
    return m;
  }, [data]);

  return (
    <div className="space-y-4">
      <Card className="p-3 flex flex-wrap gap-2 items-center">
        <Button
          size="sm"
          variant={situacao === "" ? "default" : "outline"}
          onClick={() => setSituacao("")}
        >
          Todas {(data?.length ?? 0) > 0 && <span className="ml-1 text-xs opacity-70">({data?.length})</span>}
        </Button>
        {SITUACOES.map((s) => (
          <Button
            key={s.id}
            size="sm"
            variant={situacao === s.id ? "default" : "outline"}
            onClick={() => setSituacao(s.id)}
          >
            {s.label}
            {(counts.get(s.id) ?? 0) > 0 && (
              <span className="ml-1.5 text-xs opacity-70">({counts.get(s.id)})</span>
            )}
          </Button>
        ))}
        <div className="ml-auto">
          <Input
            placeholder="Buscar objeto/órgão…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-64"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
        ) : (data?.length ?? 0) === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            Nenhuma oportunidade. Use a aba <strong>Buscar no PNCP</strong>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/20 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Órgão</th>
                  <th className="px-3 py-2 text-left">Objeto</th>
                  <th className="px-3 py-2 text-left">Local</th>
                  <th className="px-3 py-2 text-right">Estimado</th>
                  <th className="px-3 py-2 text-left">Encerra</th>
                  <th className="px-3 py-2 text-left">Situação</th>
                  <th className="px-3 py-2 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {(data ?? []).map((it) => {
                  const meta = SITUACOES.find((s) => s.id === it.situacao);
                  return (
                    <tr key={it.id} className="hover:bg-muted/10">
                      <td className="px-3 py-2.5">
                        <div className="font-medium truncate max-w-[220px]">{it.orgao_nome ?? "—"}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[220px]">{it.unidade_nome ?? ""}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs max-w-[340px]">
                        <div className="line-clamp-2">{it.objeto ?? "—"}</div>
                        <div className="text-[10px] text-muted-foreground mt-1">{it.modalidade}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {it.uf ?? "—"} / {it.municipio ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmtCurrency(it.valor_estimado)}</td>
                      <td className="px-3 py-2.5 text-xs">{fmtDate(it.data_encerramento_propostas)}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline" className={`text-[10px] ${meta?.tone ?? ""}`}>
                          {meta?.label ?? it.situacao}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="inline-flex gap-1.5 items-center">
                          {it.link_sistema_origem && (
                            <a href={it.link_sistema_origem} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="ghost"><ExternalLink className="w-3.5 h-3.5" /></Button>
                            </a>
                          )}
                          <Select
                            value={it.situacao}
                            onValueChange={(v) => change.mutate({ id: it.id, situacao: v })}
                          >
                            <SelectTrigger className="h-7 w-[170px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {SITUACOES.map((s) => (
                                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
