import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCompany } from "@/hooks/use-company";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
 Dialog,
 DialogContent,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from "@/components/ui/dialog";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Pencil, Trash2, FolderTree, Sparkles, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useCentrosCusto, type CentroCusto, type CentroCustoNode, type CentroCustoTipo } from "@/hooks/use-centros-custo";

export const Route = createFileRoute("/_app/centros-custo")({
 component: CentrosCustoPage,
 head: () => ({
 meta: [
 { title: "Centros de Custo" },
 { name: "description", content: "Cadastro hierárquico de centros de custo da obra." },
 ],
 }),
});

const TIPOS: { value: CentroCustoTipo; label: string }[] = [
 { value: "administracao", label: "Administração" },
 { value: "mao_obra", label: "Mão de Obra" },
 { value: "materiais", label: "Materiais" },
 { value: "equipamentos", label: "Equipamentos" },
 { value: "terceiros", label: "Terceiros" },
 { value: "indiretos", label: "Indiretos" },
 { value: "outros", label: "Outros" },
];

const TIPO_COLORS: Record<CentroCustoTipo, string> = {
 administracao: "bg-primary/10 text-primary ",
 mao_obra: "bg-warning/10 text-warning-foreground ",
 materiais: "bg-success/10 text-success ",
 equipamentos: "bg-measure/10 text-measure ",
 terceiros: "bg-pink-500/10 text-pink-700 dark:text-pink-300",
 indiretos: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
 outros: "bg-muted text-muted-foreground",
};

interface FormState {
 id: string | null;
 parent_id: string | null;
 nome: string;
 codigo: string;
 tipo: CentroCustoTipo;
 descricao: string;
 ativo: boolean;
}

const EMPTY_FORM: FormState = {
 id: null,
 parent_id: null,
 nome: "",
 codigo: "",
 tipo: "outros",
 descricao: "",
 ativo: true,
};

function CentrosCustoPage() {
 const { user, loading: authLoading } = useAuth();
 const { company, loading: companyLoading } = useCompany();
 const navigate = useNavigate();
 const isEditor = company?.role === "admin" || company?.role === "editor";
 const isAdmin = company?.role === "admin";

 const { items, tree, refresh, loading } = useCentrosCusto();
 const [seeding, setSeeding] = useState(false);
 const [dialogOpen, setDialogOpen] = useState(false);
 const [form, setForm] = useState<FormState>(EMPTY_FORM);
 const [saving, setSaving] = useState(false);
 const [expanded, setExpanded] = useState<Set<string>>(new Set());

 useEffect(() => {
 if (!authLoading && !user) navigate({ to: "/login" });
 }, [authLoading, user, navigate]);

 // Auto-expand roots on first load
 useEffect(() => {
 if (tree.length && expanded.size === 0) {
 setExpanded(new Set(tree.map((n) => n.id)));
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [tree.length]);

 const parentOptions = useMemo(
 () => items.filter((i) => !i.parent_id),
 [items],
 );

 const openCreate = (parent?: CentroCusto) => {
 setForm({
 ...EMPTY_FORM,
 parent_id: parent?.id ?? null,
 tipo: parent?.tipo ?? "outros",
 });
 setDialogOpen(true);
 };

 const openEdit = (c: CentroCusto) => {
 setForm({
 id: c.id,
 parent_id: c.parent_id,
 nome: c.nome,
 codigo: c.codigo ?? "",
 tipo: c.tipo,
 descricao: c.descricao ?? "",
 ativo: c.ativo,
 });
 setDialogOpen(true);
 };

 const save = async () => {
 if (!company) return;
 if (!form.nome.trim()) {
 toast.error("Informe o nome");
 return;
 }
 setSaving(true);
 const payload = {
 company_id: company.id,
 parent_id: form.parent_id,
 nome: form.nome.trim(),
 codigo: form.codigo.trim() || null,
 tipo: form.tipo,
 descricao: form.descricao.trim() || null,
 ativo: form.ativo,
 };
 const { error } = form.id
 ? await supabase.from("centros_custo").update(payload).eq("id", form.id)
 : await supabase.from("centros_custo").insert(payload);
 setSaving(false);
 if (error) {
 toast.error(error.message);
 return;
 }
 toast.success(form.id ? "Centro atualizado" : "Centro criado");
 setDialogOpen(false);
 void refresh();
 };

 const remove = async (c: CentroCusto) => {
 if (!confirm(`Excluir "${c.nome}" e todos os seus subgrupos?`)) return;
 const { error } = await supabase.from("centros_custo").delete().eq("id", c.id);
 if (error) toast.error(error.message);
 else {
 toast.success("Centro removido");
 void refresh();
 }
 };

 const seedDefaults = async () => {
 if (!company) return;
 if (items.length > 0) {
 toast.error("A empresa já possui centros cadastrados.");
 return;
 }
 setSeeding(true);
 const { error } = await supabase.rpc("seed_centros_custo_base", { _company: company.id });
 setSeeding(false);
 if (error) toast.error(error.message);
 else {
 toast.success("Estrutura padrão carregada");
 void refresh();
 }
 };

 const toggle = (id: string) => {
 setExpanded((p) => {
 const n = new Set(p);
 if (n.has(id)) n.delete(id);
 else n.add(id);
 return n;
 });
 };

 if (authLoading || companyLoading) {
 return <div className="p-6 text-muted-foreground">Carregando…</div>;
 }
 if (!company) {
 return <div className="p-6">Empresa não encontrada.</div>;
 }

 return (
 <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
 <div className="flex items-center justify-between gap-3 flex-wrap">
 <div className="flex items-center gap-3">
 <Link to="/" className="text-muted-foreground hover:text-foreground">
 <ArrowLeft className="w-5 h-5" />
 </Link>
 <div>
 <h1 className="text-2xl font-bold flex items-center gap-2">
 <FolderTree className="w-6 h-6 text-primary" /> Centros de Custo
 </h1>
 <p className="text-sm text-muted-foreground">
 Estrutura hierárquica usada para classificar todos os lançamentos da obra.
 </p>
 </div>
 </div>
 {isEditor && (
 <div className="flex gap-2">
 {items.length === 0 && (
 <Button variant="outline" onClick={seedDefaults} disabled={seeding}>
 <Sparkles className="w-4 h-4 mr-2" />
 {seeding ? "Carregando…" : "Carregar estrutura padrão"}
 </Button>
 )}
 <Button onClick={() => openCreate()}>
 <Plus className="w-4 h-4 mr-2" /> Novo grupo
 </Button>
 </div>
 )}
 </div>

 <Card className="p-4">
 {loading ? (
 <p className="text-sm text-muted-foreground p-6 text-center">Carregando…</p>
 ) : tree.length === 0 ? (
 <div className="text-center p-10 space-y-3">
 <FolderTree className="w-12 h-12 mx-auto text-muted-foreground/50" />
 <p className="text-muted-foreground">
 Nenhum centro de custo cadastrado. Clique em "Carregar estrutura padrão" para começar.
 </p>
 </div>
 ) : (
 <ul className="space-y-1">
 {tree.map((node) => (
 <CentroNode
 key={node.id}
 node={node}
 level={0}
 expanded={expanded}
 onToggle={toggle}
 onEdit={openEdit}
 onRemove={remove}
 onAddChild={openCreate}
 canEdit={isEditor}
 canDelete={isAdmin}
 />
 ))}
 </ul>
 )}
 </Card>

 <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>{form.id ? "Editar centro de custo" : "Novo centro de custo"}</DialogTitle>
 </DialogHeader>
 <div className="space-y-3">
 <div>
 <Label>Nome *</Label>
 <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <Label>Código (opcional)</Label>
 <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
 </div>
 <div>
 <Label>Tipo</Label>
 <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as CentroCustoTipo })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 </div>
 <div>
 <Label>Grupo pai (vazio = grupo raiz)</Label>
 <Select
 value={form.parent_id ?? "none"}
 onValueChange={(v) => setForm({ ...form, parent_id: v === "none" ? null : v })}
 >
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="none">— Raiz —</SelectItem>
 {parentOptions
 .filter((o) => o.id !== form.id)
 .map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label>Descrição</Label>
 <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
 </div>
 <label className="flex items-center gap-2 text-sm">
 <input
 type="checkbox"
 checked={form.ativo}
 onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
 />
 Ativo
 </label>
 </div>
 <DialogFooter>
 <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
 <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}

function CentroNode({
 node,
 level,
 expanded,
 onToggle,
 onEdit,
 onRemove,
 onAddChild,
 canEdit,
 canDelete,
}: {
 node: CentroCustoNode;
 level: number;
 expanded: Set<string>;
 onToggle: (id: string) => void;
 onEdit: (c: CentroCusto) => void;
 onRemove: (c: CentroCusto) => void;
 onAddChild: (parent: CentroCusto) => void;
 canEdit: boolean;
 canDelete: boolean;
}) {
 const open = expanded.has(node.id);
 const hasChildren = node.children.length > 0;
 return (
 <li>
 <div
 className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
 style={{ paddingLeft: `${level * 20 + 8}px` }}
 >
 <button
 type="button"
 onClick={() => hasChildren && onToggle(node.id)}
 className="w-5 h-5 flex items-center justify-center shrink-0 text-muted-foreground"
 >
 {hasChildren ? (open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />) : null}
 </button>
 <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-medium ${TIPO_COLORS[node.tipo]}`}>
 {TIPOS.find((t) => t.value === node.tipo)?.label}
 </span>
 <span className={`text-sm flex-1 truncate ${!node.ativo ? "line-through text-muted-foreground" : ""}`}>
 {node.nome}
 </span>
 {node.codigo && <span className="text-[10px] font-mono text-muted-foreground">{node.codigo}</span>}
 {canEdit && (
 <div className="flex gap-1">
 <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onAddChild(node)} title="Adicionar subgrupo">
 <Plus className="w-3.5 h-3.5" />
 </Button>
 <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(node)} title="Editar">
 <Pencil className="w-3.5 h-3.5" />
 </Button>
 {canDelete && (
 <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onRemove(node)} title="Excluir">
 <Trash2 className="w-3.5 h-3.5 text-destructive" />
 </Button>
 )}
 </div>
 )}
 </div>
 {open && hasChildren && (
 <ul className="space-y-1">
 {node.children.map((c) => (
 <CentroNode
 key={c.id}
 node={c}
 level={level + 1}
 expanded={expanded}
 onToggle={onToggle}
 onEdit={onEdit}
 onRemove={onRemove}
 onAddChild={onAddChild}
 canEdit={canEdit}
 canDelete={canDelete}
 />
 ))}
 </ul>
 )}
 </li>
 );
}
