/**
 * Fase 7 — Detalhe de proposta: itens, readequação, carta proposta.
 */
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft, FileText, Plus, Trash2, Sparkles, Copy, GitBranch, RefreshCcw,
} from "lucide-react";
import {
  getPropostaDetail, updatePropostaHeader,
  listPropostaItens, savePropostaItem, deletePropostaItem,
  criarPropostaReadequada, computarResiduosReadequacao, listResiduos,
  listCartas, gerarCartaPropostaIA, salvarCartaManual, deleteCarta,
} from "@/lib/propostas-itens.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_app/propostas/$id")({ component: PropostaDetailPage });

const brl = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));

function PropostaDetailPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();

  const fetchDetail = useServerFn(getPropostaDetail);
  const { data: prop, isLoading } = useQuery({
    queryKey: ["proposta-detail", id],
    queryFn: () => fetchDetail({ data: { id } }),
  });

  if (isLoading || !prop) {
    return <div className="p-6 text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/propostas" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" /> Propostas
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2 mt-1">
            <FileText className="w-6 h-6 text-primary" /> {prop.titulo}
          </h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <Badge variant={prop.tipo === "readequada" ? "secondary" : "default"}>
              {prop.tipo === "readequada" ? "Readequada" : "Original"}
            </Badge>
            <Badge variant="outline">{prop.status}</Badge>
            {prop.edital_titulo && <span>· Edital: {prop.edital_titulo}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Itens (subtotal)</div><div className="text-xl font-semibold">{brl(prop.valor_itens)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">BDI</div><div className="text-xl font-semibold">{prop.bdi_percent ?? 0}%</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total c/ BDI</div><div className="text-xl font-semibold text-primary">{brl(prop.valor_total)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Prazo</div><div className="text-xl font-semibold">{prop.prazo_execucao_dias ?? "—"} dias</div></CardContent></Card>
      </div>

      <Tabs defaultValue="itens">
        <TabsList>
          <TabsTrigger value="itens">Itens</TabsTrigger>
          <TabsTrigger value="readequacao">Readequação</TabsTrigger>
          <TabsTrigger value="carta">Carta Proposta</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="itens"><ItensTab propostaId={id} /></TabsContent>
        <TabsContent value="readequacao"><ReadequacaoTab proposta={prop} onCreated={() => router.invalidate()} /></TabsContent>
        <TabsContent value="carta"><CartaTab propostaId={id} /></TabsContent>
        <TabsContent value="config"><ConfigTab proposta={prop} onSaved={() => qc.invalidateQueries({ queryKey: ["proposta-detail", id] })} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Itens Tab ---------------- */

function ItensTab({ propostaId }: { propostaId: string }) {
  const qc = useQueryClient();
  const fetchItens = useServerFn(listPropostaItens);
  const saveFn = useServerFn(savePropostaItem);
  const delFn = useServerFn(deletePropostaItem);

  const { data: itens = [] } = useQuery({
    queryKey: ["proposta-itens", propostaId],
    queryFn: () => fetchItens({ data: { proposta_id: propostaId } }),
  });

  const [open, setOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editing, setEditing] = useState<any | null>(null);

  const save = useMutation({
    mutationFn: (input: Parameters<typeof saveFn>[0]["data"]) => saveFn({ data: input }),
    onSuccess: () => {
      toast.success("Item salvo");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["proposta-itens", propostaId] });
      qc.invalidateQueries({ queryKey: ["proposta-detail", propostaId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (itemId: string) => delFn({ data: { id: itemId, proposta_id: propostaId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposta-itens", propostaId] });
      qc.invalidateQueries({ queryKey: ["proposta-detail", propostaId] });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Planilha orçamentária</CardTitle>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Novo item
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Un.</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right">P.Unit</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum item.</TableCell></TableRow>
            )}
            {itens.map((it, idx) => (
              <TableRow key={it.id} className="cursor-pointer" onClick={() => { setEditing(it); setOpen(true); }}>
                <TableCell>{idx + 1}</TableCell>
                <TableCell>{it.codigo ?? "—"}</TableCell>
                <TableCell className="max-w-md truncate">{it.descricao}</TableCell>
                <TableCell>{it.unidade ?? "—"}</TableCell>
                <TableCell className="text-right">{Number(it.quantidade).toLocaleString("pt-BR")}</TableCell>
                <TableCell className="text-right">{brl(it.preco_unitario)}</TableCell>
                <TableCell className="text-right font-medium">{brl(it.preco_total)}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); if (confirm("Excluir item?")) del.mutate(it.id); }}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <ItemDialog
        open={open} onOpenChange={setOpen} editing={editing} propostaId={propostaId}
        nextOrdem={itens.length}
        onSubmit={(payload) => save.mutate(payload)}
        saving={save.isPending}
      />
    </Card>
  );
}

function ItemDialog({
  open, onOpenChange, editing, propostaId, nextOrdem, onSubmit, saving,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editing: any | null;
  propostaId: string; nextOrdem: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSubmit: (p: any) => void;
  saving: boolean;
}) {
  const [codigo, setCodigo] = useState(editing?.codigo ?? "");
  const [descricao, setDescricao] = useState(editing?.descricao ?? "");
  const [unidade, setUnidade] = useState(editing?.unidade ?? "");
  const [qtd, setQtd] = useState<string>(editing?.quantidade?.toString() ?? "1");
  const [pu, setPu] = useState<string>(editing?.preco_unitario?.toString() ?? "0");

  // Reset when editing changes
  if (open && editing && editing.id !== undefined && descricao === "" && editing.descricao) {
    setCodigo(editing.codigo ?? ""); setDescricao(editing.descricao);
    setUnidade(editing.unidade ?? ""); setQtd(editing.quantidade.toString()); setPu(editing.preco_unitario.toString());
  }

  return (
    <Dialog open={open} onOpenChange={(v) => {
      onOpenChange(v);
      if (!v) { setCodigo(""); setDescricao(""); setUnidade(""); setQtd("1"); setPu("0"); }
    }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Código</Label><Input value={codigo} onChange={(e) => setCodigo(e.target.value)} /></div>
            <div className="col-span-2"><Label>Unidade</Label><Input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="m², m³, un, h..." /></div>
          </div>
          <div><Label>Descrição *</Label><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Quantidade</Label><Input type="number" step="0.0001" value={qtd} onChange={(e) => setQtd(e.target.value)} /></div>
            <div><Label>Preço unitário (R$)</Label><Input type="number" step="0.01" value={pu} onChange={(e) => setPu(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={saving || !descricao} onClick={() => onSubmit({
            id: editing?.id,
            proposta_id: propostaId,
            ordem: editing?.ordem ?? nextOrdem,
            codigo: codigo || null,
            descricao,
            unidade: unidade || null,
            quantidade: Number(qtd) || 0,
            preco_unitario: Number(pu) || 0,
          })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Readequação ---------------- */

function ReadequacaoTab({ proposta, onCreated }: { proposta: { id: string; tipo: string; titulo: string; proposta_origem_id: string | null }; onCreated: () => void }) {
  const qc = useQueryClient();
  const criarFn = useServerFn(criarPropostaReadequada);
  const recomputarFn = useServerFn(computarResiduosReadequacao);
  const listFn = useServerFn(listResiduos);

  const isReadequada = proposta.tipo === "readequada";
  const targetId = isReadequada ? proposta.id : null;

  const { data: residuos = [], refetch } = useQuery({
    queryKey: ["residuos", targetId],
    queryFn: () => targetId ? listFn({ data: { proposta_readequada_id: targetId } }) : Promise.resolve([]),
    enabled: !!targetId,
  });

  const criar = useMutation({
    mutationFn: () => criarFn({ data: { proposta_origem_id: proposta.id, titulo: `${proposta.titulo} — Readequada` } }),
    onSuccess: (r) => { toast.success("Proposta readequada criada"); window.location.href = `/propostas/${r.id}`; onCreated(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const recomputar = useMutation({
    mutationFn: () => recomputarFn({ data: { proposta_readequada_id: proposta.id } }),
    onSuccess: () => { toast.success("Resíduos atualizados"); refetch(); qc.invalidateQueries({ queryKey: ["residuos", targetId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isReadequada) {
    return (
      <Card>
        <CardHeader><CardTitle>Criar versão readequada</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Cria uma cópia desta proposta com tipo "readequada", herdando todos os itens. Em seguida você poderá ajustar quantidades/preços e gerar o comparativo de resíduos.
          </p>
          <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
            <GitBranch className="w-4 h-4 mr-2" /> Criar proposta readequada
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totalDelta = residuos.reduce((s, r) => s + Number(r.delta_valor), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Comparativo de resíduos (origem × readequada)</CardTitle>
        <Button size="sm" variant="outline" onClick={() => recomputar.mutate()} disabled={recomputar.isPending}>
          <RefreshCcw className="w-4 h-4 mr-1" /> Recalcular
        </Button>
      </CardHeader>
      <CardContent>
        {proposta.proposta_origem_id && (
          <Link to="/propostas/$id" params={{ id: proposta.proposta_origem_id }} className="text-sm text-primary hover:underline">
            Ver proposta de origem →
          </Link>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Qtd origem</TableHead>
              <TableHead className="text-right">Qtd readequada</TableHead>
              <TableHead className="text-right">P.Unit origem</TableHead>
              <TableHead className="text-right">P.Unit readequada</TableHead>
              <TableHead className="text-right">Δ valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {residuos.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Clique em "Recalcular" para gerar.</TableCell></TableRow>
            )}
            {residuos.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="max-w-sm">
                  <div className="text-xs text-muted-foreground">{r.codigo ?? "—"}</div>
                  <div className="truncate">{r.descricao}</div>
                </TableCell>
                <TableCell className="text-right">{Number(r.qtd_origem).toLocaleString("pt-BR")}</TableCell>
                <TableCell className="text-right">{Number(r.qtd_readequada).toLocaleString("pt-BR")}</TableCell>
                <TableCell className="text-right">{brl(r.preco_origem)}</TableCell>
                <TableCell className="text-right">{brl(r.preco_readequado)}</TableCell>
                <TableCell className={`text-right font-medium ${Number(r.delta_valor) < 0 ? "text-destructive" : Number(r.delta_valor) > 0 ? "text-emerald-600" : ""}`}>
                  {brl(r.delta_valor)}
                </TableCell>
              </TableRow>
            ))}
            {residuos.length > 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-right font-semibold">Δ total</TableCell>
                <TableCell className={`text-right font-bold ${totalDelta < 0 ? "text-destructive" : "text-emerald-600"}`}>{brl(totalDelta)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ---------------- Carta Proposta ---------------- */

function CartaTab({ propostaId }: { propostaId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listCartas);
  const gerarFn = useServerFn(gerarCartaPropostaIA);
  const salvarFn = useServerFn(salvarCartaManual);
  const delFn = useServerFn(deleteCarta);

  const { data: cartas = [] } = useQuery({
    queryKey: ["cartas-proposta", propostaId],
    queryFn: () => listFn({ data: { proposta_id: propostaId } }),
  });

  const [conteudo, setConteudo] = useState("");
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [instrucoes, setInstrucoes] = useState("");

  const gerar = useMutation({
    mutationFn: () => gerarFn({ data: { proposta_id: propostaId, instrucoes_extra: instrucoes || null } }),
    onSuccess: () => { toast.success("Carta gerada pela IA"); qc.invalidateQueries({ queryKey: ["cartas-proposta", propostaId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const salvar = useMutation({
    mutationFn: () => salvarFn({ data: { id: selecionada ?? undefined, proposta_id: propostaId, conteudo_md: conteudo } }),
    onSuccess: () => { toast.success("Carta salva"); qc.invalidateQueries({ queryKey: ["cartas-proposta", propostaId] }); setSelecionada(null); setConteudo(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cartas-proposta", propostaId] }),
  });

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card className="md:col-span-1">
        <CardHeader><CardTitle className="text-base">Versões</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {cartas.length === 0 && <div className="text-sm text-muted-foreground">Nenhuma carta ainda.</div>}
          {cartas.map((c) => (
            <div key={c.id}
              className={`p-2 rounded border cursor-pointer hover:bg-accent ${selecionada === c.id ? "bg-accent border-primary" : ""}`}
              onClick={() => { setSelecionada(c.id); setConteudo(c.conteudo_md); }}>
              <div className="flex justify-between items-center">
                <div className="font-medium text-sm">v{c.versao}</div>
                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); if (confirm("Excluir versão?")) del.mutate(c.id); }}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR")}</div>
              {c.hash_sha256 && <div className="text-[10px] font-mono text-muted-foreground truncate">{c.hash_sha256.slice(0, 16)}…</div>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Editor</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setSelecionada(null); setConteudo(""); }}>
              <Plus className="w-4 h-4 mr-1" /> Nova
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(conteudo)} disabled={!conteudo}>
              <Copy className="w-4 h-4 mr-1" /> Copiar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 p-3 rounded border bg-muted/30">
            <Label className="text-xs">Instruções extras para a IA (opcional)</Label>
            <Textarea value={instrucoes} onChange={(e) => setInstrucoes(e.target.value)} rows={2}
              placeholder="Ex.: enfatizar prazo curto, mencionar atestado X..." />
            <Button size="sm" onClick={() => gerar.mutate()} disabled={gerar.isPending}>
              <Sparkles className="w-4 h-4 mr-1" /> {gerar.isPending ? "Gerando..." : "Gerar carta com IA"}
            </Button>
          </div>
          <Textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} rows={20}
            placeholder="Conteúdo da carta proposta em markdown…" className="font-mono text-sm" />
          <div className="flex justify-end">
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || !conteudo}>
              {selecionada ? "Atualizar versão" : "Salvar nova versão"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Config Tab ---------------- */

function ConfigTab({ proposta, onSaved }: { proposta: { id: string; bdi_percent: number | null; encargos_percent: number | null; data_referencia: string | null }; onSaved: () => void }) {
  const updateFn = useServerFn(updatePropostaHeader);
  const [bdi, setBdi] = useState<string>((proposta.bdi_percent ?? 0).toString());
  const [enc, setEnc] = useState<string>((proposta.encargos_percent ?? 0).toString());
  const [data, setData] = useState<string>(proposta.data_referencia ?? "");

  const m = useMutation({
    mutationFn: () => updateFn({ data: {
      id: proposta.id,
      bdi_percent: Number(bdi),
      encargos_percent: Number(enc),
      data_referencia: data || null,
    } }),
    onSuccess: () => { toast.success("Configurações salvas"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle>Parâmetros</CardTitle></CardHeader>
      <CardContent className="space-y-3 max-w-md">
        <div><Label>BDI (%)</Label><Input type="number" step="0.01" value={bdi} onChange={(e) => setBdi(e.target.value)} /></div>
        <div><Label>Encargos sociais (%)</Label><Input type="number" step="0.01" value={enc} onChange={(e) => setEnc(e.target.value)} /></div>
        <div><Label>Data de referência</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
        <Button onClick={() => m.mutate()} disabled={m.isPending}>Salvar</Button>
      </CardContent>
    </Card>
  );
}
