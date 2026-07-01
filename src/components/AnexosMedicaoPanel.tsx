/**
 * Fase G — Anexos do Boletim de Medição
 * Fotos, memórias de cálculo, ARTs, planilhas e documentos vinculados à medição.
 * Upload direto para o bucket privado `boletim-anexos` + registro em `boletim_anexos`.
 */
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listarAnexosMedicao,
  registrarAnexoMedicao,
  removerAnexoMedicao,
  getUrlAnexoMedicao,
} from "@/lib/boletim-medicao.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Loader2, Upload, Trash2, Download, Paperclip, Image as ImageIcon, FileText, FileSpreadsheet, FileSignature, File as FileIcon } from "lucide-react";
import { toast } from "sonner";

type Categoria = "foto" | "memoria_calculo" | "art" | "planilha" | "documento" | "outro";

const CATEGORIAS: { value: Categoria; label: string }[] = [
  { value: "foto", label: "Foto" },
  { value: "memoria_calculo", label: "Memória de cálculo" },
  { value: "art", label: "ART / RRT" },
  { value: "planilha", label: "Planilha" },
  { value: "documento", label: "Documento" },
  { value: "outro", label: "Outro" },
];

interface Anexo {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  mime_type: string | null;
  tamanho_bytes: number | null;
  storage_path: string;
  created_at: string;
}

function iconFor(categoria: string | null, mime: string | null) {
  if (categoria === "foto" || (mime ?? "").startsWith("image/")) return ImageIcon;
  if (categoria === "planilha" || (mime ?? "").includes("sheet") || (mime ?? "").includes("excel")) return FileSpreadsheet;
  if (categoria === "art") return FileSignature;
  if (categoria === "memoria_calculo") return FileText;
  if ((mime ?? "").includes("pdf")) return FileText;
  return FileIcon;
}

function fmtBytes(n: number | null): string {
  if (!n || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 180);
}

export interface AnexosMedicaoPanelProps {
  medicaoId: string;
  companyId: string;
  readOnly?: boolean;
}

export function AnexosMedicaoPanel({ medicaoId, companyId, readOnly = false }: AnexosMedicaoPanelProps) {
  const qc = useQueryClient();
  const listar = useServerFn(listarAnexosMedicao);
  const registrar = useServerFn(registrarAnexoMedicao);
  const remover = useServerFn(removerAnexoMedicao);
  const obterUrl = useServerFn(getUrlAnexoMedicao);

  const [categoria, setCategoria] = useState<Categoria>("documento");
  const [descricao, setDescricao] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const anexosQuery = useQuery({
    queryKey: ["boletim-anexos", medicaoId],
    queryFn: () => listar({ data: { medicao_id: medicaoId } }),
  });
  const anexos: Anexo[] = useMemo(() => (anexosQuery.data ?? []) as Anexo[], [anexosQuery.data]);

  const mutRemover = useMutation({
    mutationFn: async (id: string) => remover({ data: { id } }),
    onSuccess: () => {
      toast.success("Anexo removido.");
      qc.invalidateQueries({ queryKey: ["boletim-anexos", medicaoId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    let ok = 0, fail = 0;
    for (const file of Array.from(files)) {
      try {
        const safe = sanitizeFilename(file.name);
        const path = `${companyId}/${medicaoId}/${Date.now()}_${safe}`;
        const up = await supabase.storage.from("boletim-anexos").upload(path, file, {
          upsert: false,
          contentType: file.type || undefined,
        });
        if (up.error) throw new Error(up.error.message);
        await registrar({
          data: {
            medicao_id: medicaoId,
            storage_path: path,
            nome: file.name,
            descricao: descricao.trim() || undefined,
            categoria,
            mime_type: file.type || undefined,
            tamanho_bytes: file.size,
          },
        });
        ok++;
      } catch (e) {
        fail++;
        toast.error(`Falha ao enviar ${file.name}: ${(e as Error).message}`);
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    setDescricao("");
    if (ok > 0) toast.success(`${ok} arquivo(s) enviado(s).`);
    if (ok > 0 || fail > 0) qc.invalidateQueries({ queryKey: ["boletim-anexos", medicaoId] });
  }

  async function handleDownload(a: Anexo) {
    try {
      const { url } = await obterUrl({ data: { id: a.id } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <section className="rounded-xl border border-[#E7E9EE] bg-white shadow-sm">
      <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#EDEFF3]">
        <div className="flex items-center gap-2.5">
          <Paperclip className="w-4 h-4 text-[#C8A66A]" />
          <div>
            <div className="text-[11px] uppercase tracking-widest text-[#C8A66A] font-bold">Fase G</div>
            <h3 className="text-[15px] font-bold text-[#252A33]">Anexos do boletim</h3>
          </div>
        </div>
        <div className="text-xs text-[#69717D]">
          {anexos.length} arquivo{anexos.length === 1 ? "" : "s"}
        </div>
      </header>

      {!readOnly && (
        <div className="px-5 py-4 border-b border-[#EDEFF3] bg-[#FBFAF7]">
          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-2.5 items-end">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#69717D] font-semibold">Categoria</label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as Categoria)}>
                <SelectTrigger className="h-9 border-[#D9DDE3]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#69717D] font-semibold">Descrição (opcional)</label>
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: memória de cálculo do item 4.2.1"
                className="h-9 border-[#D9DDE3] focus-visible:border-[#C8A66A] focus-visible:ring-[#C8A66A]/40"
                maxLength={1000}
              />
            </div>
            <div>
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Button
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="h-9 bg-[#C8A66A] hover:bg-[#B69354] text-[#252A33] font-semibold"
              >
                {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                Enviar arquivos
              </Button>
            </div>
          </div>
          <div className="text-[11px] text-[#69717D] mt-2">
            Arquivos ficam no armazenamento privado da empresa. Apenas membros autorizados podem visualizar ou baixar.
          </div>
        </div>
      )}

      <div className="p-3">
        {anexosQuery.isLoading ? (
          <div className="p-6 text-center text-[#69717D] text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando anexos…
          </div>
        ) : anexos.length === 0 ? (
          <div className="p-8 text-center text-[#69717D] text-sm">
            Nenhum anexo enviado ainda. Anexe fotos, memórias de cálculo, ARTs e planilhas para deixar a medição auditável.
          </div>
        ) : (
          <ul className="divide-y divide-[#EDEFF3]">
            {anexos.map((a) => {
              const Icon = iconFor(a.categoria, a.mime_type);
              return (
                <li key={a.id} className="flex items-center gap-3 px-2 py-2.5 hover:bg-[#FBFAF7] rounded-md">
                  <div className="w-9 h-9 rounded-md bg-[#F5EEDD] text-[#8A6D2E] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[#252A33] truncate">{a.nome}</div>
                    <div className="text-[11px] text-[#69717D] flex flex-wrap gap-2">
                      <span className="uppercase tracking-wider">
                        {CATEGORIAS.find((c) => c.value === a.categoria)?.label ?? a.categoria ?? "—"}
                      </span>
                      <span>· {fmtBytes(a.tamanho_bytes)}</span>
                      <span>· {new Date(a.created_at).toLocaleString("pt-BR")}</span>
                      {a.descricao && <span className="italic truncate">— {a.descricao}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleDownload(a)} title="Baixar">
                      <Download className="w-4 h-4" />
                    </Button>
                    {!readOnly && (
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => {
                          if (confirm(`Remover o anexo "${a.nome}"?`)) mutRemover.mutate(a.id);
                        }}
                        disabled={mutRemover.isPending}
                        title="Remover"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
