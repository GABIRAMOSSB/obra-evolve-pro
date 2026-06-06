import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Globe2, Plus, Trash2, Sparkles, Send, Download, ExternalLink, AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import {
  listPortais, upsertPortal, excluirPortal, seedPortaisSugeridos,
  simularEnvioProposta, listProtocolos, upsertProtocolo, excluirProtocolo,
} from "@/lib/portais.functions";
import { listPropostas } from "@/lib/propostas.functions";

export const Route = createFileRoute("/_app/portais")({ component: PortaisPage });

type Portal = {
  id: string; nome: string; codigo: string | null; formato_preferido: string;
  separador_decimal: string; separador_milhar: string;
  casas_decimais_qtd: number; casas_decimais_preco: number;
  encoding: string; max_chars_descricao: number | null;
  exige_assinatura_digital: boolean; exige_planilha_modelo: boolean;
  url_portal: string | null; observacoes: string | null; ativo: boolean;
};

type Protocolo = {
  id: string; portal_id: string | null; proposta_id: string | null;
  numero_protocolo: string | null; data_envio: string; status: string;
  observacoes: string | null;
};

const STATUS_COLOR: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  rascunho: "outline", enviado: "secondary", aceito: "default", recusado: "destructive", cancelado: "outline",
};

function PortaisPage() {
  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Globe2 className="w-6 h-6 text-primary" />
          Portais de Licitação
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastre regras de envio por plataforma, simule a formatação da proposta e mantenha histórico de protocolos.
        </p>
      </div>
      <Tabs defaultValue="perfis">
        <TabsList>
          <TabsTrigger value="perfis">Perfis de Portal</TabsTrigger>
          <TabsTrigger value="simulador">Simulador de envio</TabsTrigger>
          <TabsTrigger value="protocolos">Protocolos</TabsTrigger>
        </TabsList>
        <TabsContent value="perfis" className="mt-4"><PerfisTab /></TabsContent>
        <TabsContent value="simulador" className="mt-4"><SimuladorTab /></TabsContent>
        <TabsContent value="protocolos" className="mt-4"><ProtocolosTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================== Perfis ============================== */

function PerfisTab() {
  const listFn = useServerFn(listPortais);
  const seedFn = useServerFn(seedPortaisSugeridos);
  const delFn = useServerFn(excluirPortal);
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | "novo" | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["portais"],
    queryFn: () => listFn({ data: {} }),
  });

  const seedMut = useMutation({
    mutationFn: async () => seedFn({}),
    onSuccess: (r) => { toast.success(`${r.inseridos} portal(is) padrão cadastrado(s).`); qc.invalidateQueries({ queryKey: ["portais"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: async (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["portais"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (data?.rows ?? []) as Portal[];

  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-2">
        <Button variant="outline" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
          <Download className="w-4 h-4 mr-1" />
          {seedMut.isPending ? "Cadastrando…" : "Cadastrar portais padrão"}
        </Button>
        <Button onClick={() => setEditId("novo")}><Plus className="w-4 h-4 mr-1" />Novo portal</Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhum portal cadastrado. Use <strong>Cadastrar portais padrão</strong> para começar com Comprasnet, PNCP, BEC e outros.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{p.nome}</CardTitle>
                    <div className="text-xs text-muted-foreground mt-0.5 flex gap-2 items-center flex-wrap">
                      <Badge variant="outline" className="text-[10px] uppercase">{p.formato_preferido}</Badge>
                      <span>{p.encoding}</span>
                      {!p.ativo && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <div>Decimal: <code className="px-1 bg-muted rounded">{p.separador_decimal}</code></div>
                  <div>Milhar: <code className="px-1 bg-muted rounded">{p.separador_milhar || "—"}</code></div>
                  <div>Casas qtd: <strong>{p.casas_decimais_qtd}</strong></div>
                  <div>Casas preço: <strong>{p.casas_decimais_preco}</strong></div>
                  {p.max_chars_descricao && <div className="col-span-2">Máx. descrição: <strong>{p.max_chars_descricao}</strong> chars</div>}
                </div>
                {p.observacoes && <p className="text-muted-foreground mt-2">{p.observacoes}</p>}
                <div className="flex gap-2 pt-2">
                  {p.url_portal && (
                    <a href={p.url_portal} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                      <ExternalLink className="w-3 h-3" /> Acessar portal
                    </a>
                  )}
                  <Button size="sm" variant="outline" className="ml-auto" onClick={() => setEditId(p.id)}>Editar</Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8"
                    onClick={() => { if (confirm(`Excluir "${p.nome}"?`)) delMut.mutate(p.id); }}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editId && (
        <PortalEditorDialog
          id={editId === "novo" ? undefined : editId}
          current={editId === "novo" ? undefined : rows.find((r) => r.id === editId)}
          onClose={() => setEditId(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["portais"] }); setEditId(null); }}
        />
      )}
    </div>
  );
}

function PortalEditorDialog({
  id, current, onClose, onSaved,
}: { id?: string; current?: Portal; onClose: () => void; onSaved: () => void }) {
  const saveFn = useServerFn(upsertPortal);
  const [nome, setNome] = useState(current?.nome ?? "");
  const [codigo, setCodigo] = useState(current?.codigo ?? "");
  const [formato, setFormato] = useState<string>(current?.formato_preferido ?? "xlsx");
  const [sepDec, setSepDec] = useState<string>(current?.separador_decimal ?? ",");
  const [sepMil, setSepMil] = useState<string>(current?.separador_milhar ?? ".");
  const [casasQtd, setCasasQtd] = useState(current?.casas_decimais_qtd ?? 4);
  const [casasPreco, setCasasPreco] = useState(current?.casas_decimais_preco ?? 2);
  const [encoding, setEncoding] = useState(current?.encoding ?? "UTF-8");
  const [maxDesc, setMaxDesc] = useState(current?.max_chars_descricao?.toString() ?? "");
  const [exigeSign, setExigeSign] = useState(current?.exige_assinatura_digital ?? false);
  const [exigePlanilha, setExigePlanilha] = useState(current?.exige_planilha_modelo ?? false);
  const [url, setUrl] = useState(current?.url_portal ?? "");
  const [obs, setObs] = useState(current?.observacoes ?? "");
  const [ativo, setAtivo] = useState(current?.ativo ?? true);

  const mut = useMutation({
    mutationFn: async () => saveFn({
      data: {
        id, nome, codigo: codigo || undefined,
        formato_preferido: formato as "xlsx",
        separador_decimal: sepDec as ",", separador_milhar: sepMil as ".",
        casas_decimais_qtd: casasQtd, casas_decimais_preco: casasPreco,
        encoding,
        max_chars_descricao: maxDesc ? Number(maxDesc) : null,
        exige_assinatura_digital: exigeSign, exige_planilha_modelo: exigePlanilha,
        url_portal: url || null, observacoes: obs || null, ativo,
      },
    }),
    onSuccess: () => { toast.success("Portal salvo."); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{id ? "Editar portal" : "Novo portal"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div><Label>Código interno</Label><Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="compras-gov" /></div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label>Formato</Label>
              <Select value={formato} onValueChange={setFormato}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["xlsx","csv","pdf","txt","json","outro"].map((v) => <SelectItem key={v} value={v}>{v.toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sep. decimal</Label>
              <Select value={sepDec} onValueChange={setSepDec}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value=",">,</SelectItem><SelectItem value=".">.</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sep. milhar</Label>
              <Select value={sepMil} onValueChange={setSepMil}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value=".">.</SelectItem><SelectItem value=",">,</SelectItem><SelectItem value="">(nenhum)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Encoding</Label><Input value={encoding} onChange={(e) => setEncoding(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Casas qtd</Label><Input type="number" min={0} max={8} value={casasQtd} onChange={(e) => setCasasQtd(Number(e.target.value))} /></div>
            <div><Label>Casas preço</Label><Input type="number" min={0} max={8} value={casasPreco} onChange={(e) => setCasasPreco(Number(e.target.value))} /></div>
            <div><Label>Máx. chars descrição</Label><Input type="number" value={maxDesc} onChange={(e) => setMaxDesc(e.target.value)} placeholder="ex.: 1024" /></div>
          </div>
          <div><Label>URL do portal</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} /></div>
          <div><Label>Observações</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} /></div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={exigeSign} onChange={(e) => setExigeSign(e.target.checked)} /> Exige assinatura digital</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={exigePlanilha} onChange={(e) => setExigePlanilha(e.target.checked)} /> Exige planilha modelo</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Ativo</label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!nome || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================== Simulador ============================== */

function SimuladorTab() {
  const listPortFn = useServerFn(listPortais);
  const listPropFn = useServerFn(listPropostas);
  const simFn = useServerFn(simularEnvioProposta);

  const { data: portais } = useQuery({ queryKey: ["portais"], queryFn: () => listPortFn({ data: {} }) });
  const { data: propostas } = useQuery({ queryKey: ["propostas-min"], queryFn: () => listPropFn({ data: {} }) });

  const [portalId, setPortalId] = useState<string>("");
  const [propostaId, setPropostaId] = useState<string>("");

  const simMut = useMutation({
    mutationFn: async () => simFn({ data: { portal_id: portalId, proposta_id: propostaId } }),
    onError: (e: Error) => toast.error(e.message),
  });

  const portRows = (portais?.rows ?? []) as Portal[];
  const propRows = ((propostas?.rows ?? propostas ?? []) as Array<{ id: string; nome: string }>);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Simular envio</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Portal</Label>
              <Select value={portalId} onValueChange={setPortalId}>
                <SelectTrigger><SelectValue placeholder="Selecione um portal" /></SelectTrigger>
                <SelectContent>
                  {portRows.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Proposta</Label>
              <Select value={propostaId} onValueChange={setPropostaId}>
                <SelectTrigger><SelectValue placeholder="Selecione uma proposta" /></SelectTrigger>
                <SelectContent>
                  {propRows.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button disabled={!portalId || !propostaId || simMut.isPending} onClick={() => simMut.mutate()}>
            <Sparkles className="w-4 h-4 mr-1" />
            {simMut.isPending ? "Simulando…" : "Simular formatação"}
          </Button>
        </CardContent>
      </Card>

      {simMut.data && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">Resultado — {simMut.data.portal.nome}</CardTitle>
              <Badge variant="outline" className="uppercase">{simMut.data.portal.formato_preferido}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <Kpi label="Itens" value={simMut.data.linhas_total} />
              <Kpi label="Total geral" value={simMut.data.total_geral} />
              <Kpi label="Encoding" value={simMut.data.portal.encoding} />
              <Kpi label="Casas (qtd/preço)" value={`${simMut.data.portal.regras.casas_decimais_qtd} / ${simMut.data.portal.regras.casas_decimais_preco}`} />
            </div>

            {simMut.data.alertas.length > 0 && (
              <div className="border rounded p-3 bg-yellow-500/5 border-yellow-500/30">
                <div className="text-sm font-semibold flex items-center gap-1 text-yellow-700 dark:text-yellow-300 mb-2">
                  <AlertTriangle className="w-4 h-4" /> {simMut.data.alertas.length} alerta(s)
                </div>
                <ul className="text-xs space-y-1 list-disc list-inside">
                  {simMut.data.alertas.slice(0, 10).map((a, i) => (
                    <li key={i}><Badge variant="outline" className="text-[10px] mr-1">{a.tipo}</Badge>{a.mensagem}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <Label className="text-xs">Preview (até 20 itens)</Label>
              <div className="overflow-auto rounded border max-h-80">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr><th className="p-1 text-left">#</th><th className="p-1 text-left">Código</th><th className="p-1 text-left">Descrição</th><th className="p-1">Un.</th><th className="p-1 text-right">Qtd</th><th className="p-1 text-right">Preço</th><th className="p-1 text-right">Total</th></tr>
                  </thead>
                  <tbody>
                    {simMut.data.linhas_preview.map((l, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-1">{l.ordem}</td><td className="p-1">{l.codigo}</td>
                        <td className="p-1 max-w-md truncate">{l.descricao}</td>
                        <td className="p-1">{l.unidade}</td>
                        <td className="p-1 text-right font-mono">{l.quantidade}</td>
                        <td className="p-1 text-right font-mono">{l.preco_unitario}</td>
                        <td className="p-1 text-right font-mono">{l.valor_total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <Label className="text-xs">CSV pronto para colar (preview)</Label>
              <Textarea readOnly value={simMut.data.preview_csv} rows={8} className="font-mono text-[11px]" />
              <Button
                variant="outline" size="sm" className="mt-2"
                onClick={() => { void navigator.clipboard.writeText(simMut.data!.preview_csv); toast.success("CSV copiado."); }}
              >
                <Download className="w-3.5 h-3.5 mr-1" />Copiar CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border rounded p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

/* ============================== Protocolos ============================== */

function ProtocolosTab() {
  const listFn = useServerFn(listProtocolos);
  const upFn = useServerFn(upsertProtocolo);
  const delFn = useServerFn(excluirProtocolo);
  const listPortFn = useServerFn(listPortais);
  const listPropFn = useServerFn(listPropostas);
  const qc = useQueryClient();
  const [novoOpen, setNovoOpen] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["protocolos"], queryFn: () => listFn({ data: {} }) });
  const { data: portais } = useQuery({ queryKey: ["portais"], queryFn: () => listPortFn({ data: {} }) });
  const { data: propostas } = useQuery({ queryKey: ["propostas-min"], queryFn: () => listPropFn({ data: {} }) });

  const upMut = useMutation({
    mutationFn: async (p: Parameters<typeof upFn>[0]) => upFn(p),
    onSuccess: () => { toast.success("Protocolo registrado."); qc.invalidateQueries({ queryKey: ["protocolos"] }); setNovoOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: async (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["protocolos"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const portRows = (portais?.rows ?? []) as Portal[];
  const propRows = ((propostas?.rows ?? propostas ?? []) as Array<{ id: string; nome: string }>);
  const rows = (data?.rows ?? []) as Protocolo[];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-1" />Registrar envio</Button>
          </DialogTrigger>
          <NovoProtocoloDialog
            portais={portRows} propostas={propRows}
            onSubmit={(p) => upMut.mutate({ data: p })} pending={upMut.isPending}
          />
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhum protocolo. Registre o envio de uma proposta para começar.
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase">
                  <tr>
                    <th className="p-2 text-left">Data</th>
                    <th className="p-2 text-left">Portal</th>
                    <th className="p-2 text-left">Proposta</th>
                    <th className="p-2 text-left">Protocolo</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const portalNome = portRows.find((p) => p.id === r.portal_id)?.nome ?? "—";
                    const propNome = propRows.find((p) => p.id === r.proposta_id)?.nome ?? "—";
                    return (
                      <tr key={r.id} className="border-t hover:bg-muted/20">
                        <td className="p-2 text-xs">{new Date(r.data_envio).toLocaleString("pt-BR")}</td>
                        <td className="p-2">{portalNome}</td>
                        <td className="p-2">{propNome}</td>
                        <td className="p-2 font-mono text-xs">{r.numero_protocolo ?? "—"}</td>
                        <td className="p-2"><Badge variant={STATUS_COLOR[r.status] ?? "outline"} className="uppercase text-[10px]">{r.status}</Badge></td>
                        <td className="p-2">
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => { if (confirm("Excluir protocolo?")) delMut.mutate(r.id); }}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function NovoProtocoloDialog({
  portais, propostas, onSubmit, pending,
}: {
  portais: Portal[]; propostas: Array<{ id: string; nome: string }>;
  onSubmit: (p: { portal_id?: string; proposta_id?: string; numero_protocolo?: string; status: "enviado"; observacoes?: string }) => void;
  pending: boolean;
}) {
  const [portalId, setPortalId] = useState<string>("");
  const [propostaId, setPropostaId] = useState<string>("");
  const [numero, setNumero] = useState("");
  const [obs, setObs] = useState("");

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Registrar envio</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Portal</Label>
          <Select value={portalId} onValueChange={setPortalId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {portais.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Proposta</Label>
          <Select value={propostaId} onValueChange={setPropostaId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {propostas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Número do protocolo</Label>
          <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="ex.: PRG-2026-00123" />
        </div>
        <div>
          <Label>Observações</Label>
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
        </div>
      </div>
      <DialogFooter>
        <Button disabled={pending}
          onClick={() => onSubmit({
            portal_id: portalId || undefined,
            proposta_id: propostaId || undefined,
            numero_protocolo: numero || undefined,
            status: "enviado",
            observacoes: obs || undefined,
          })}
        >
          <Send className="w-4 h-4 mr-1" />{pending ? "Salvando…" : "Registrar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
