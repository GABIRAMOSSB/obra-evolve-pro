import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, ArrowDownToLine, ArrowUpFromLine, Package, RefreshCw, FileDown } from "lucide-react";
import { toast } from "sonner";
import type { BudgetRow, ProjectData } from "@/lib/types";

export const Route = createFileRoute("/estoque")({ component: EstoquePage });

type Insumo = { id: string; codigo: string | null; descricao: string; unidade_id: string | null };
type Unidade = { id: string; sigla: string };
type Movimento = {
  id: string;
  data_movimento: string;
  tipo: "entrada" | "saida" | "ajuste" | "transferencia";
  origem: string;
  nota_fiscal_item_id?: string | null;
  insumo_id: string;
  obra_id: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  item_descricao: string | null;
  observacoes: string | null;
  nota_fiscal_id: string | null;
};
type Nota = { id: string; numero: string; emitente_nome: string | null; data_emissao: string | null; obra_id: string | null };
type NotaItemResumo = { id: string; nota_fiscal_id: string; insumo_id: string | null };
type NotaElegivel = Nota & { itens_vinculados: number };

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function EstoquePage() {
  const { company } = useCompany();
  const companyId = company?.id;
  const canEdit = company?.role === "admin" || company?.role === "editor";
  const [tab, setTab] = useState("saldos");
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [notaItens, setNotaItens] = useState<NotaItemResumo[]>([]);
  const [notasElegiveis, setNotasElegiveis] = useState<NotaElegivel[]>([]);
  const [obras, setObras] = useState<{ id: string; nome: string; rows: BudgetRow[] }[]>([]);
  const [filtroObra, setFiltroObra] = useState<string>("todas");
  const [filtroBusca, setFiltroBusca] = useState("");
  const [loading, setLoading] = useState(false);

  // dialogs
  const [openEntradaNFe, setOpenEntradaNFe] = useState(false);
  const [openSaida, setOpenSaida] = useState(false);
  const [openAjuste, setOpenAjuste] = useState(false);

  // entrada NFe
  const [notaSelecionada, setNotaSelecionada] = useState<string>("");
  const [obraEntrada, setObraEntrada] = useState<string>("");

  // saída/ajuste form
  const [formInsumo, setFormInsumo] = useState("");
  const [formObra, setFormObra] = useState<string>("");
  const [formItemCodigo, setFormItemCodigo] = useState<string>("");
  const [formQtd, setFormQtd] = useState("");
  const [formValor, setFormValor] = useState("");
  const [formObs, setFormObs] = useState("");

  async function loadAll() {
    if (!companyId) return;
    setLoading(true);
    try {
      const [insRes, uniRes, movRes, notRes, wsRes, itensRes] = await Promise.all([
        supabase.from("insumos_mestre").select("id,codigo,descricao,unidade_id").eq("company_id", companyId).eq("ativo", true).order("descricao"),
        supabase.from("unidades_medida").select("id,sigla").eq("company_id", companyId),
        supabase.from("estoque_movimentos").select("*").eq("company_id", companyId).order("data_movimento", { ascending: false }).limit(1000),
        supabase.from("notas_fiscais").select("id,numero,emitente_nome,data_emissao,obra_id").eq("company_id", companyId).order("data_emissao", { ascending: false }),
        supabase.from("company_workspaces").select("workspace").eq("company_id", companyId).maybeSingle(),
        supabase.from("nota_fiscal_itens").select("id,nota_fiscal_id,insumo_id").eq("company_id", companyId),
      ]);
      if (insRes.data) setInsumos(insRes.data as Insumo[]);
      if (uniRes.data) setUnidades(uniRes.data as Unidade[]);
      if (movRes.data) setMovimentos(movRes.data as Movimento[]);
      if (notRes.data) setNotas(notRes.data as Nota[]);
      if (itensRes.data) setNotaItens(itensRes.data as NotaItemResumo[]);
      const ws = wsRes.data?.workspace as { obras?: ProjectData[] } | undefined;
      setObras((ws?.obras ?? []).map(o => ({ id: o.id, nome: o.nome || o.id, rows: o.rows ?? [] })));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, [companyId]);

  const unidadePorInsumo = useMemo(() => {
    const map: Record<string, string> = {};
    insumos.forEach(i => {
      const u = unidades.find(x => x.id === i.unidade_id);
      map[i.id] = u?.sigla ?? "";
    });
    return map;
  }, [insumos, unidades]);

  const insumoMap = useMemo(() => {
    const m: Record<string, Insumo> = {};
    insumos.forEach(i => { m[i.id] = i; });
    return m;
  }, [insumos]);

  useEffect(() => {
    const itensJaLancados = new Set(
      movimentos
        .filter((m) => m.tipo === "entrada" && m.nota_fiscal_item_id)
        .map((m) => m.nota_fiscal_item_id as string),
    );

    const itensPendentesPorNota = new Map<string, number>();
    notaItens.forEach((item) => {
      if (!item.insumo_id || itensJaLancados.has(item.id)) return;
      itensPendentesPorNota.set(item.nota_fiscal_id, (itensPendentesPorNota.get(item.nota_fiscal_id) ?? 0) + 1);
    });

    setNotasElegiveis(
      notas
        .map((nota) => ({ ...nota, itens_vinculados: itensPendentesPorNota.get(nota.id) ?? 0 }))
        .filter((nota) => nota.itens_vinculados > 0),
    );
  }, [notaItens, notas, movimentos]);

  // Saldos agregados por insumo (e obra se filtro)
  const saldos = useMemo(() => {
    const map = new Map<string, { insumo_id: string; entrada_qtd: number; saida_qtd: number; entrada_valor: number; saldo: number; ultimo: string }>();
    movimentos
      .filter(m => filtroObra === "todas" ? true : m.obra_id === filtroObra)
      .forEach(m => {
        const key = m.insumo_id;
        const cur = map.get(key) ?? { insumo_id: key, entrada_qtd: 0, saida_qtd: 0, entrada_valor: 0, saldo: 0, ultimo: m.data_movimento };
        if (m.tipo === "entrada" || m.tipo === "ajuste") cur.saldo += Number(m.quantidade);
        else cur.saldo -= Number(m.quantidade);
        if (m.tipo === "entrada") {
          cur.entrada_qtd += Number(m.quantidade);
          cur.entrada_valor += Number(m.valor_total);
        }
        if (m.tipo === "saida") cur.saida_qtd += Number(m.quantidade);
        if (m.data_movimento > cur.ultimo) cur.ultimo = m.data_movimento;
        map.set(key, cur);
      });
    return Array.from(map.values())
      .filter(s => {
        if (!filtroBusca) return true;
        const ins = insumoMap[s.insumo_id];
        const t = `${ins?.codigo ?? ""} ${ins?.descricao ?? ""}`.toLowerCase();
        return t.includes(filtroBusca.toLowerCase());
      })
      .sort((a, b) => (insumoMap[a.insumo_id]?.descricao ?? "").localeCompare(insumoMap[b.insumo_id]?.descricao ?? ""));
  }, [movimentos, filtroObra, filtroBusca, insumoMap]);

  const totalEstoque = useMemo(() => {
    return saldos.reduce((acc, s) => {
      const valorMedio = s.entrada_qtd > 0 ? s.entrada_valor / s.entrada_qtd : 0;
      return acc + s.saldo * valorMedio;
    }, 0);
  }, [saldos]);

  // Ações
  async function handleEntradaNFe() {
    if (!canEdit) { toast.error("Você não tem permissão para lançar entradas."); return; }
    if (!notaSelecionada) { toast.error("Selecione uma nota fiscal"); return; }
    const { data, error } = await supabase.rpc("registrar_entrada_nfe", {
      _nota_id: notaSelecionada,
      _obra_id: obraEntrada || undefined,
    });
    if (error) { toast.error(`Erro: ${error.message}`); return; }
    if ((data ?? 0) === 0) { toast.error("Essa NF-e não possui itens vinculados pendentes para entrada."); return; }
    toast.success(`${data ?? 0} item(ns) lançado(s) no estoque`);
    setOpenEntradaNFe(false);
    setNotaSelecionada(""); setObraEntrada("");
    loadAll();
  }

  async function handleSaida() {
    if (!companyId || !formInsumo || !formQtd) { toast.error("Preencha insumo e quantidade"); return; }
    const qtd = Number(formQtd);
    if (qtd <= 0) { toast.error("Quantidade inválida"); return; }
    const { error } = await supabase.from("estoque_movimentos").insert({
      company_id: companyId,
      obra_id: formObra || null,
      insumo_id: formInsumo,
      tipo: "saida",
      origem: "manual",
      quantidade: qtd,
      valor_unitario: Number(formValor) || 0,
      valor_total: qtd * (Number(formValor) || 0),
      item_descricao: insumoMap[formInsumo]?.descricao ?? null,
      observacoes: formObs || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Saída registrada");
    setOpenSaida(false);
    setFormInsumo(""); setFormObra(""); setFormQtd(""); setFormValor(""); setFormObs("");
    loadAll();
  }

  async function handleAjuste() {
    if (!companyId || !formInsumo || !formQtd) { toast.error("Preencha insumo e quantidade"); return; }
    const qtd = Number(formQtd);
    const { error } = await supabase.from("estoque_movimentos").insert({
      company_id: companyId,
      obra_id: formObra || null,
      insumo_id: formInsumo,
      tipo: "ajuste",
      origem: "inventario",
      quantidade: qtd,
      valor_unitario: 0,
      valor_total: 0,
      item_descricao: insumoMap[formInsumo]?.descricao ?? null,
      observacoes: formObs || "Ajuste de inventário",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Ajuste registrado");
    setOpenAjuste(false);
    setFormInsumo(""); setFormObra(""); setFormQtd(""); setFormObs("");
    loadAll();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Link>
            </Button>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Package className="w-5 h-5" /> Controle de Estoque
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
            <Dialog open={openEntradaNFe} onOpenChange={setOpenEntradaNFe}>
              <DialogTrigger asChild>
                <Button size="sm" variant="default">
                  <ArrowDownToLine className="w-4 h-4 mr-1" /> Entrada por NF-e
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Entrada de Estoque via NF-e</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Nota Fiscal</Label>
                    <Select value={notaSelecionada} onValueChange={setNotaSelecionada}>
                      <SelectTrigger><SelectValue placeholder="Selecione a NF-e" /></SelectTrigger>
                      <SelectContent>
                        {notasElegiveis.map(n => (
                          <SelectItem key={n.id} value={n.id}>
                            NF {n.numero} — {n.emitente_nome ?? "—"} · {n.itens_vinculados} item(ns)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Somente itens com insumo vinculado serão lançados. Itens já lançados anteriormente são ignorados.
                    </p>
                    {notasElegiveis.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Nenhuma NF-e está pronta para entrada. Primeiro vincule os itens da nota a um insumo na tela de NF-e.
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Obra (opcional — sobrescreve a da nota)</Label>
                    <Select value={obraEntrada} onValueChange={setObraEntrada}>
                      <SelectTrigger><SelectValue placeholder="Manter obra da nota" /></SelectTrigger>
                      <SelectContent>
                        {obras.map(o => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenEntradaNFe(false)}>Cancelar</Button>
                  <Button onClick={handleEntradaNFe}>Lançar Entrada</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={openSaida} onOpenChange={setOpenSaida}>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  <ArrowUpFromLine className="w-4 h-4 mr-1" /> Saída
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Saída de Estoque (consumo)</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Insumo</Label>
                    <Select value={formInsumo} onValueChange={setFormInsumo}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {insumos.map(i => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.codigo ? `[${i.codigo}] ` : ""}{i.descricao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Obra</Label>
                    <Select value={formObra} onValueChange={setFormObra}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {obras.map(o => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Quantidade</Label>
                      <Input type="number" step="0.01" value={formQtd} onChange={e => setFormQtd(e.target.value)} />
                    </div>
                    <div>
                      <Label>Valor unitário (opcional)</Label>
                      <Input type="number" step="0.01" value={formValor} onChange={e => setFormValor(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Textarea value={formObs} onChange={e => setFormObs(e.target.value)} rows={2} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenSaida(false)}>Cancelar</Button>
                  <Button onClick={handleSaida}>Registrar Saída</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={openAjuste} onOpenChange={setOpenAjuste}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">Ajuste</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Ajuste de Inventário</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Insumo</Label>
                    <Select value={formInsumo} onValueChange={setFormInsumo}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {insumos.map(i => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.codigo ? `[${i.codigo}] ` : ""}{i.descricao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Obra</Label>
                    <Select value={formObra} onValueChange={setFormObra}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {obras.map(o => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Quantidade (use valor negativo para reduzir)</Label>
                    <Input type="number" step="0.01" value={formQtd} onChange={e => setFormQtd(e.target.value)} />
                  </div>
                  <div>
                    <Label>Motivo</Label>
                    <Textarea value={formObs} onChange={e => setFormObs(e.target.value)} rows={2} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenAjuste(false)}>Cancelar</Button>
                  <Button onClick={handleAjuste}>Salvar Ajuste</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Itens em estoque</div>
            <div className="text-2xl font-bold">{saldos.filter(s => s.saldo > 0).length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Valor total (médio)</div>
            <div className="text-2xl font-bold">{brl(totalEstoque)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Movimentos (90 dias)</div>
            <div className="text-2xl font-bold">{movimentos.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Itens com saldo negativo</div>
            <div className="text-2xl font-bold text-destructive">{saldos.filter(s => s.saldo < 0).length}</div>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="p-3 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <Label className="text-xs">Buscar</Label>
            <Input placeholder="Código ou descrição" value={filtroBusca} onChange={e => setFiltroBusca(e.target.value)} />
          </div>
          <div className="min-w-[220px]">
            <Label className="text-xs">Obra</Label>
            <Select value={filtroObra} onValueChange={setFiltroObra}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as obras</SelectItem>
                {obras.map(o => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="saldos">Saldos atuais</TabsTrigger>
            <TabsTrigger value="movimentos">Movimentos</TabsTrigger>
          </TabsList>

          <TabsContent value="saldos">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3">Código</th>
                      <th className="text-left p-3">Descrição</th>
                      <th className="text-right p-3">Unid.</th>
                      <th className="text-right p-3">Entradas</th>
                      <th className="text-right p-3">Saídas</th>
                      <th className="text-right p-3">Saldo</th>
                      <th className="text-right p-3">Valor médio</th>
                      <th className="text-right p-3">Valor em estoque</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saldos.length === 0 && (
                      <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhum movimento de estoque registrado.</td></tr>
                    )}
                    {saldos.map(s => {
                      const ins = insumoMap[s.insumo_id];
                      const vm = s.entrada_qtd > 0 ? s.entrada_valor / s.entrada_qtd : 0;
                      return (
                        <tr key={s.insumo_id} className="border-t hover:bg-muted/30">
                          <td className="p-3 font-mono text-xs">{ins?.codigo ?? "—"}</td>
                          <td className="p-3">{ins?.descricao ?? s.insumo_id}</td>
                          <td className="p-3 text-right">{unidadePorInsumo[s.insumo_id]}</td>
                          <td className="p-3 text-right">{fmt(s.entrada_qtd)}</td>
                          <td className="p-3 text-right">{fmt(s.saida_qtd)}</td>
                          <td className={`p-3 text-right font-semibold ${s.saldo < 0 ? "text-destructive" : s.saldo === 0 ? "text-muted-foreground" : ""}`}>
                            {fmt(s.saldo)}
                          </td>
                          <td className="p-3 text-right">{brl(vm)}</td>
                          <td className="p-3 text-right">{brl(s.saldo * vm)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="movimentos">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3">Data</th>
                      <th className="text-left p-3">Tipo</th>
                      <th className="text-left p-3">Origem</th>
                      <th className="text-left p-3">Insumo</th>
                      <th className="text-left p-3">Obra</th>
                      <th className="text-right p-3">Qtd</th>
                      <th className="text-right p-3">Valor unit.</th>
                      <th className="text-right p-3">Valor total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimentos
                      .filter(m => filtroObra === "todas" ? true : m.obra_id === filtroObra)
                      .filter(m => {
                        if (!filtroBusca) return true;
                        const ins = insumoMap[m.insumo_id];
                        return `${ins?.codigo ?? ""} ${ins?.descricao ?? ""} ${m.item_descricao ?? ""}`.toLowerCase().includes(filtroBusca.toLowerCase());
                      })
                      .map(m => {
                        const ins = insumoMap[m.insumo_id];
                        const obraNome = obras.find(o => o.id === m.obra_id)?.nome ?? (m.obra_id ?? "—");
                        return (
                          <tr key={m.id} className="border-t hover:bg-muted/30">
                            <td className="p-3 whitespace-nowrap">{new Date(m.data_movimento).toLocaleDateString("pt-BR")}</td>
                            <td className="p-3">
                              <Badge variant={m.tipo === "entrada" ? "default" : m.tipo === "saida" ? "secondary" : "outline"}>
                                {m.tipo}
                              </Badge>
                            </td>
                            <td className="p-3 text-xs uppercase text-muted-foreground">{m.origem}</td>
                            <td className="p-3">{ins?.descricao ?? m.item_descricao ?? "—"}</td>
                            <td className="p-3">{obraNome}</td>
                            <td className="p-3 text-right">{fmt(Number(m.quantidade))}</td>
                            <td className="p-3 text-right">{brl(Number(m.valor_unitario))}</td>
                            <td className="p-3 text-right">{brl(Number(m.valor_total))}</td>
                          </tr>
                        );
                      })}
                    {movimentos.length === 0 && (
                      <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Sem movimentos.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
