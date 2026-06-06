import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listBiblioteca,
  uploadDocumento,
  updateDocumento,
  deleteDocumento,
  getDocumentoUrl,
  type DocumentoRow,
} from "@/lib/biblioteca.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Library, Loader2, Plus, Trash2, Download, Upload, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/biblioteca")({
  component: BibliotecaPage,
  head: () => ({ meta: [{ title: "Biblioteca de documentos — SOLV Gestão" }] }),
});

const CATEGORIAS = [
  { id: "habilitacao_juridica", label: "Habilitação Jurídica" },
  { id: "regularidade_fiscal", label: "Regularidade Fiscal e Trabalhista" },
  { id: "qualificacao_tecnica", label: "Qualificação Técnica" },
  { id: "qualificacao_economica", label: "Qualificação Econômico-Financeira" },
  { id: "documentos_proposta", label: "Documentos da Proposta" },
  { id: "outros", label: "Outros" },
] as const;

const CAT_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIAS.map((c) => [c.id, c.label]),
);

function fmtDate(v: string | null): string {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("pt-BR");
  } catch {
    return v;
  }
}
function fmtBytes(b: number | null): string {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}
function validadeTone(v: string | null): string {
  if (!v) return "bg-muted/40 text-foreground border-border";
  const d = new Date(v).getTime();
  const now = Date.now();
  const days = Math.floor((d - now) / (1000 * 60 * 60 * 24));
  if (days < 0) return "bg-red-500/15 text-red-400 border-red-500/30";
  if (days < 30) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
}

function BibliotecaPage() {
  const list = useServerFn(listBiblioteca);
  const del = useServerFn(deleteDocumento);
  const url = useServerFn(getDocumentoUrl);
  const qc = useQueryClient();

  const [cat, setCat] = useState<string>("");
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["biblioteca", cat, q],
    queryFn: () =>
      list({
        data: {
          categoria: (cat || undefined) as
            | "habilitacao_juridica"
            | "regularidade_fiscal"
            | "qualificacao_tecnica"
            | "qualificacao_economica"
            | "documentos_proposta"
            | "outros"
            | undefined,
          q: q || undefined,
        },
      }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Documento removido");
      qc.invalidateQueries({ queryKey: ["biblioteca"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const download = useMutation({
    mutationFn: async (id: string) => {
      const r = await url({ data: { id } });
      window.open(r.url, "_blank");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  // agrupar por categoria
  const grouped: Record<string, DocumentoRow[]> = {};
  for (const d of data ?? []) {
    (grouped[d.categoria] ??= []).push(d);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Library className="w-6 h-6 text-primary" />
            Biblioteca de documentos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Documentos reutilizáveis da empresa (contrato social, atestados, balanços, certidões).
            Podem ser vinculados automaticamente aos itens de checklist dos editais.
          </p>
        </div>
        <UploadDialog onCreated={() => qc.invalidateQueries({ queryKey: ["biblioteca"] })} />
      </div>

      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Label>Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="nome, emissor, número…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="w-[260px]">
          <Label>Categoria</Label>
          <Select value={cat || "all"} onValueChange={(v) => setCat(v === "all" ? "" : v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading && (
        <Card className="p-8 text-center text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
          Carregando…
        </Card>
      )}

      {!isLoading && (data?.length ?? 0) === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          Nenhum documento cadastrado ainda. Clique em "Adicionar documento".
        </Card>
      )}

      {Object.entries(grouped).map(([catId, docs]) => (
        <Card key={catId} className="overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 border-b border-border font-medium flex items-center gap-2">
            {CAT_LABEL[catId] ?? catId}
            <span className="text-xs text-muted-foreground">({docs.length})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/20 border-b border-border/40">
                <tr className="text-left">
                  <th className="px-4 py-2 font-medium">Documento</th>
                  <th className="px-4 py-2 font-medium">Emissor / Nº</th>
                  <th className="px-4 py-2 font-medium">Emissão</th>
                  <th className="px-4 py-2 font-medium">Validade</th>
                  <th className="px-4 py-2 font-medium">Arquivo</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-b border-border/40 hover:bg-muted/10">
                    <td className="px-4 py-2">
                      <div className="font-medium">{d.nome}</div>
                      {d.descricao && (
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {d.descricao}
                        </div>
                      )}
                      {d.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {d.tags.map((t) => (
                            <Badge key={t} variant="outline" className="text-[10px] py-0">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      <div>{d.emissor ?? "—"}</div>
                      {d.numero_documento && (
                        <div className="text-xs">nº {d.numero_documento}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 tabular-nums">{fmtDate(d.data_emissao)}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={validadeTone(d.data_validade)}>
                        {fmtDate(d.data_validade)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {d.nome_arquivo}
                      <div>{fmtBytes(d.tamanho_bytes)}</div>
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => download.mutate(d.id)}
                        disabled={download.isPending}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Remover "${d.nome}"?`)) remove.mutate(d.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ============ UPLOAD DIALOG ============ */

function UploadDialog({ onCreated }: { onCreated: () => void }) {
  const up = useServerFn(uploadDocumento);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [categoria, setCategoria] = useState<string>("habilitacao_juridica");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tags, setTags] = useState("");
  const [emissor, setEmissor] = useState("");
  const [numero, setNumero] = useState("");
  const [dataEmissao, setDataEmissao] = useState("");
  const [dataValidade, setDataValidade] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione um arquivo.");
      const buf = await file.arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const b64 = btoa(bin);
      return up({
        data: {
          categoria: categoria as
            | "habilitacao_juridica"
            | "regularidade_fiscal"
            | "qualificacao_tecnica"
            | "qualificacao_economica"
            | "documentos_proposta"
            | "outros",
          nome: nome || file.name,
          descricao: descricao || null,
          tags: tags
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          nome_arquivo: file.name,
          mime_type: file.type || "application/octet-stream",
          emissor: emissor || null,
          numero_documento: numero || null,
          data_emissao: dataEmissao || null,
          data_validade: dataValidade || null,
          base64: b64,
        },
      });
    },
    onSuccess: () => {
      toast.success("Documento adicionado");
      setOpen(false);
      setFile(null);
      setNome("");
      setDescricao("");
      setTags("");
      setEmissor("");
      setNumero("");
      setDataEmissao("");
      setDataValidade("");
      onCreated();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Adicionar documento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar documento à biblioteca</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Arquivo *</Label>
            <Input
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !nome) setNome(f.name.replace(/\.[^.]+$/, ""));
              }}
            />
            {file && (
              <p className="text-xs text-muted-foreground mt-1">
                {fmtBytes(file.size)} · {file.type || "tipo desconhecido"}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria *</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <Label>Emissor</Label>
              <Input value={emissor} onChange={(e) => setEmissor(e.target.value)} />
            </div>
            <div>
              <Label>Nº do documento</Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div>
              <Label>Data de emissão</Label>
              <Input
                type="date"
                value={dataEmissao}
                onChange={(e) => setDataEmissao(e.target.value)}
              />
            </div>
            <div>
              <Label>Data de validade</Label>
              <Input
                type="date"
                value={dataValidade}
                onChange={(e) => setDataValidade(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Label>Tags (separadas por vírgula)</Label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="atestado, pavimentação, 2024"
              />
            </div>
            <div className="col-span-2">
              <Label>Descrição</Label>
              <Textarea
                rows={2}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Detalhes adicionais (objeto, escopo, etc.)"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!file || !nome || mut.isPending}>
            {mut.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Export para uso opcional pelo updateDocumento futuro
export { updateDocumento };
