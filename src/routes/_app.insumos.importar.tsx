import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "@/hooks/use-auth";
import { useCompany } from "@/hooks/use-company";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
 Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_app/insumos/importar")({
 component: ImportarSinapiPage,
 head: () => ({
 meta: [
 { title: "Importação SINAPI — Insumos" },
 { name: "description", content: "Importação em lote da base SINAPI com UPSERT por código." },
 ],
 }),
});

interface SinapiRow {
 sinapi_codigo: string;
 descricao: string;
 unidade?: string;
 ncm?: string;
 normas_tecnicas?: string;
 especificacao_tecnica?: string;
 imagem_url?: string;
 categoria?: string;
}

interface HistoricoRow {
 id: string;
 arquivo: string | null;
 versao_sinapi: string | null;
 data_importacao: string;
 total_registros: number;
 novos_registros: number;
 registros_atualizados: number;
 registros_ignorados: number;
 registros_com_erro: number;
 status: string;
}

const BATCH_SIZE = 500;

const HEADER_ALIASES: Record<string, keyof SinapiRow> = {
 codigo: "sinapi_codigo",
 "codigo sinapi": "sinapi_codigo",
 "código sinapi": "sinapi_codigo",
 "cod sinapi": "sinapi_codigo",
 sinapi: "sinapi_codigo",
 descricao: "descricao",
 descrição: "descricao",
 "descricao basica": "descricao",
 "descrição básica": "descricao",
 unidade: "unidade",
 und: "unidade",
 un: "unidade",
 ncm: "ncm",
 normas: "normas_tecnicas",
 "normas tecnicas": "normas_tecnicas",
 "normas técnicas": "normas_tecnicas",
 especificacao: "especificacao_tecnica",
 "especificacao tecnica": "especificacao_tecnica",
 "especificação técnica": "especificacao_tecnica",
 imagem: "imagem_url",
 "imagem url": "imagem_url",
 categoria: "categoria",
};

function normalizeHeader(h: string) {
 return String(h ?? "")
 .toLowerCase()
 .normalize("NFD")
 .replace(/[\u0300-\u036f]/g, "")
 .replace(/\s+/g, " ")
 .trim();
}

function parseSheet(file: File): Promise<SinapiRow[]> {
 return new Promise((resolve, reject) => {
 const reader = new FileReader();
 reader.onload = () => {
 try {
 const wb = XLSX.read(reader.result, { type: "binary" });
 const sheet = wb.Sheets[wb.SheetNames[0]];
 const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
 const out: SinapiRow[] = [];
 for (const r of raw) {
 const mapped: Partial<SinapiRow> = {};
 for (const [k, v] of Object.entries(r)) {
 const key = HEADER_ALIASES[normalizeHeader(k)];
 if (key) mapped[key] = String(v ?? "").trim() as never;
 }
 if (mapped.sinapi_codigo && mapped.descricao) {
 out.push(mapped as SinapiRow);
 }
 }
 resolve(out);
 } catch (e) { reject(e); }
 };
 reader.onerror = () => reject(reader.error);
 reader.readAsBinaryString(file);
 });
}

function ImportarSinapiPage() {
 const { user, loading: authLoading } = useAuth();
 const { company, loading: companyLoading } = useCompany();
 const navigate = useNavigate();

 const isAdmin = company?.role === "admin";

 const [file, setFile] = useState<File | null>(null);
 const [versao, setVersao] = useState("");
 const [parsing, setParsing] = useState(false);
 const [preview, setPreview] = useState<SinapiRow[]>([]);
 const [importing, setImporting] = useState(false);
 const [progress, setProgress] = useState(0);
 const [result, setResult] = useState<{
 novos: number; atualizados: number; ignorados: number; erros: number;
 } | null>(null);

 const [historico, setHistorico] = useState<HistoricoRow[]>([]);

 useEffect(() => { if (!authLoading && !user) navigate({ to: "/login" }); }, [authLoading, user, navigate]);

 const loadHistorico = useCallback(async () => {
 if (!company) return;
 const { data, error } = await supabase
 .from("historico_importacoes_sinapi")
 .select("*")
 .eq("company_id", company.id)
 .order("data_importacao", { ascending: false })
 .limit(50);
 if (!error) setHistorico((data as HistoricoRow[]) ?? []);
 }, [company]);

 useEffect(() => { if (company) loadHistorico(); }, [company, loadHistorico]);

 const handleFile = async (f: File) => {
 setFile(f);
 setParsing(true);
 setPreview([]);
 setResult(null);
 try {
 const rows = await parseSheet(f);
 if (rows.length === 0) {
 toast.error("Nenhum registro válido encontrado. Verifique se há colunas 'Código SINAPI' e 'Descrição'.");
 } else {
 toast.success(`${rows.length.toLocaleString("pt-BR")} registro(s) lidos do arquivo`);
 }
 setPreview(rows);
 } catch (e: unknown) {
 const msg = e instanceof Error ? e.message : "Falha ao ler arquivo";
 toast.error(msg);
 } finally {
 setParsing(false);
 }
 };

 const startImport = async () => {
 if (!company || !preview.length) return;
 if (!versao.trim()) { toast.error("Informe a versão do SINAPI (ex: 2025-04)"); return; }

 setImporting(true);
 setProgress(0);
 setResult(null);

 let novos = 0, atualizados = 0, ignorados = 0, erros = 0;
 try {
 for (let i = 0; i < preview.length; i += BATCH_SIZE) {
 const batch = preview.slice(i, i + BATCH_SIZE);
 const { data, error } = await supabase.rpc("import_sinapi_batch", {
 _company: company.id,
 _versao: versao.trim(),
 _rows: batch as never,
 });
 if (error) throw error;
 const r = data as { novos: number; atualizados: number; ignorados: number; erros: number };
 novos += r.novos ?? 0;
 atualizados += r.atualizados ?? 0;
 ignorados += r.ignorados ?? 0;
 erros += r.erros ?? 0;
 setProgress(Math.round(((i + batch.length) / preview.length) * 100));
 }

 await supabase.from("historico_importacoes_sinapi").insert({
 company_id: company.id,
 arquivo: file?.name ?? null,
 versao_sinapi: versao.trim(),
 usuario_id: user?.id,
 total_registros: preview.length,
 novos_registros: novos,
 registros_atualizados: atualizados,
 registros_ignorados: ignorados,
 registros_com_erro: erros,
 status: erros > 0 ? "concluido_com_erros" : "concluido",
 });

 setResult({ novos, atualizados, ignorados, erros });
 toast.success(`Importação concluída: ${novos} novos, ${atualizados} atualizados`);
 loadHistorico();
 } catch (e: unknown) {
 const msg = e instanceof Error ? e.message : "Falha na importação";
 toast.error(msg);
 } finally {
 setImporting(false);
 }
 };

 if (authLoading || companyLoading) {
 return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Carregando...</div>;
 }
 if (!company) {
 return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Sem empresa vinculada.</div>;
 }
 if (!isAdmin) {
 return (
 <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
 <AlertCircle className="w-8 h-8" />
 Apenas administradores podem importar a base SINAPI.
 <Button asChild variant="outline" size="sm"><Link to="/insumos">Voltar</Link></Button>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-background">
 <header className="border-b bg-card">
 <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
 <Button asChild variant="ghost" size="sm">
 <Link to="/insumos"><ArrowLeft className="w-4 h-4 mr-1" /> Insumos</Link>
 </Button>
 <FileSpreadsheet className="w-5 h-5 text-primary" />
 <h1 className="text-base font-semibold">Importação SINAPI</h1>
 <Badge variant="outline">{company.name}</Badge>
 </div>
 </header>

 <main className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
 <Tabs defaultValue="importar">
 <TabsList>
 <TabsTrigger value="importar">Importar</TabsTrigger>
 <TabsTrigger value="historico">Histórico ({historico.length})</TabsTrigger>
 </TabsList>

 <TabsContent value="importar" className="mt-4 space-y-4">
 <Card className="p-4 space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
 <div className="md:col-span-2">
 <Label>Arquivo (XLSX ou CSV)</Label>
 <Input
 type="file"
 accept=".xlsx,.xls,.csv"
 onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
 disabled={importing || parsing}
 />
 <p className="text-xs text-muted-foreground mt-1">
 Colunas reconhecidas: <span className="font-mono">Código SINAPI, Descrição, Unidade, NCM, Normas Técnicas, Especificação Técnica, Imagem, Categoria</span>
 </p>
 </div>
 <div>
 <Label>Versão SINAPI *</Label>
 <Input
 value={versao}
 onChange={(e) => setVersao(e.target.value)}
 placeholder="ex: 2025-04"
 disabled={importing}
 />
 </div>
 </div>

 {parsing && <p className="text-sm text-muted-foreground">Lendo arquivo...</p>}

 {preview.length > 0 && (
 <div className="space-y-3">
 <div className="flex items-center justify-between flex-wrap gap-2">
 <span className="text-sm">
 <strong>{preview.length.toLocaleString("pt-BR")}</strong> registro(s) prontos para importar
 </span>
 <Button onClick={startImport} disabled={importing || !versao.trim()}>
 <Upload className="w-4 h-4 mr-1" />
 {importing ? "Importando..." : "Iniciar importação"}
 </Button>
 </div>

 {importing && (
 <div className="space-y-1">
 <Progress value={progress} />
 <p className="text-xs text-muted-foreground">{progress}% concluído</p>
 </div>
 )}

 <div className="border rounded-md overflow-x-auto max-h-64">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead className="w-[110px]">SINAPI</TableHead>
 <TableHead>Descrição</TableHead>
 <TableHead className="w-[80px]">Un.</TableHead>
 <TableHead className="w-[110px]">NCM</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {preview.slice(0, 50).map((r, idx) => (
 <TableRow key={idx}>
 <TableCell className="font-mono text-xs">{r.sinapi_codigo}</TableCell>
 <TableCell className="text-xs">{r.descricao}</TableCell>
 <TableCell className="font-mono text-xs">{r.unidade ?? "—"}</TableCell>
 <TableCell className="font-mono text-xs">{r.ncm ?? "—"}</TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 {preview.length > 50 && (
 <p className="text-xs text-muted-foreground text-center py-2">
 ...e mais {(preview.length - 50).toLocaleString("pt-BR")} registro(s)
 </p>
 )}
 </div>
 </div>
 )}

 {result && (
 <Card className="p-4 bg-muted/30">
 <div className="flex items-center gap-2 mb-2">
 <CheckCircle2 className="w-5 h-5 text-success" />
 <h3 className="font-semibold">Importação concluída</h3>
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
 <Stat label="Novos" value={result.novos} />
 <Stat label="Atualizados" value={result.atualizados} />
 <Stat label="Ignorados" value={result.ignorados} />
 <Stat label="Erros" value={result.erros} highlight={result.erros > 0} />
 </div>
 </Card>
 )}
 </Card>
 </TabsContent>

 <TabsContent value="historico" className="mt-4">
 <Card className="p-4">
 <div className="border rounded-md overflow-x-auto">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Data</TableHead>
 <TableHead>Arquivo</TableHead>
 <TableHead>Versão</TableHead>
 <TableHead className="text-right">Total</TableHead>
 <TableHead className="text-right">Novos</TableHead>
 <TableHead className="text-right">Atualizados</TableHead>
 <TableHead className="text-right">Erros</TableHead>
 <TableHead>Status</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {historico.length === 0 && (
 <TableRow>
 <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
 Nenhuma importação registrada.
 </TableCell>
 </TableRow>
 )}
 {historico.map((h) => (
 <TableRow key={h.id}>
 <TableCell className="text-xs">{new Date(h.data_importacao).toLocaleString("pt-BR")}</TableCell>
 <TableCell className="text-xs">{h.arquivo ?? "—"}</TableCell>
 <TableCell className="text-xs">{h.versao_sinapi ?? "—"}</TableCell>
 <TableCell className="text-right font-mono text-xs">{h.total_registros}</TableCell>
 <TableCell className="text-right font-mono text-xs">{h.novos_registros}</TableCell>
 <TableCell className="text-right font-mono text-xs">{h.registros_atualizados}</TableCell>
 <TableCell className="text-right font-mono text-xs">{h.registros_com_erro}</TableCell>
 <TableCell>
 <Badge variant={h.status === "concluido" ? "secondary" : "destructive"}>
 {h.status}
 </Badge>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 </Card>
 </TabsContent>
 </Tabs>
 </main>
 </div>
 );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
 return (
 <div className={`rounded border p-3 ${highlight ? "border-destructive text-destructive" : ""}`}>
 <div className="text-xs text-muted-foreground">{label}</div>
 <div className="text-2xl font-semibold">{value.toLocaleString("pt-BR")}</div>
 </div>
 );
}
