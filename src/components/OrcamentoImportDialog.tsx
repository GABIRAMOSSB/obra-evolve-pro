/**
 * Diálogo do Importador de Orçamento (Fase E).
 * Wizard: Upload → Mapeamento de colunas → Preview → Confirmar.
 */
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { criarOrcamentoVersaoDeImport } from "@/lib/orcamento.functions";
import {
  parseFile,
  detectMapping,
  applyMapping,
  computeTotais,
  type MappingHeuristic,
  type ColumnKey,
  type ParsedRow,
  type PreviewIssue,
  type ParseFileResult,
} from "@/lib/orcamento-import.parser";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  obraId: string;
  contratoId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (versaoId: string) => void;
};

const COLUMN_LABELS: Record<ColumnKey, string> = {
  item_codigo: "Código do item *",
  descricao: "Descrição *",
  unidade: "Unidade",
  qtd_contratada: "Quantidade *",
  valor_unitario: "Valor unitário *",
  sinapi_codigo: "Código SINAPI",
};

const REQUIRED: ColumnKey[] = ["item_codigo", "descricao", "qtd_contratada", "valor_unitario"];

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function OrcamentoImportDialog({ obraId, contratoId, open, onOpenChange, onImported }: Props) {
  const [step, setStep] = useState<"upload" | "map" | "preview" | "confirm">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseFileResult | null>(null);
  const [mapping, setMapping] = useState<MappingHeuristic | null>(null);
  const [descricaoVersao, setDescricaoVersao] = useState("");
  const [parsing, setParsing] = useState(false);

  const qc = useQueryClient();
  const criarFn = useServerFn(criarOrcamentoVersaoDeImport);
  const criarMut = useMutation({
    mutationFn: criarFn,
    onSuccess: (res) => {
      toast.success(
        `Versão ${res.numero_versao} criada em rascunho: ${res.total_itens} itens, ${formatBRL(res.valor_total_cents)}`,
      );
      qc.invalidateQueries();
      onImported?.(res.versao_id);
      handleClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const preview = useMemo(() => {
    if (!parseResult || !mapping) return null;
    const { parsed, issues } = applyMapping(parseResult.rows, mapping);
    const totais = computeTotais(parsed);
    return { parsed, issues, totais };
  }, [parseResult, mapping]);

  const missingRequired = useMemo(() => {
    if (!mapping) return REQUIRED;
    return REQUIRED.filter((k) => !mapping[k]);
  }, [mapping]);

  const errosCount = preview?.issues.filter((i) => i.nivel === "erro").length ?? 0;

  function handleClose() {
    setStep("upload");
    setFile(null);
    setParseResult(null);
    setMapping(null);
    setDescricaoVersao("");
    onOpenChange(false);
  }

  async function handleFile(f: File) {
    setParsing(true);
    try {
      const result = await parseFile(f);
      if (result.rows.length === 0) {
        toast.error("Arquivo vazio ou sem linhas de dados.");
        return;
      }
      setFile(f);
      setParseResult(result);
      setMapping(detectMapping(result.headers));
      setDescricaoVersao(`Importado de ${f.name}`);
      setStep("map");
    } catch (e) {
      toast.error(`Falha ao ler arquivo: ${(e as Error).message}`);
    } finally {
      setParsing(false);
    }
  }

  async function handleChangeSheet(sheet: string) {
    if (!file) return;
    setParsing(true);
    try {
      const result = await parseFile(file, sheet);
      setParseResult(result);
      setMapping(detectMapping(result.headers));
    } finally {
      setParsing(false);
    }
  }

  function handleConfirm() {
    if (!preview) return;
    if (errosCount > 0) {
      toast.error("Corrija os erros antes de importar.");
      return;
    }
    criarMut.mutate({
      data: {
        obra_id: obraId,
        contrato_id: contratoId ?? null,
        descricao: descricaoVersao.slice(0, 200),
        origem: "import_excel",
        origem_arquivo: file?.name?.slice(0, 200),
        itens: preview.parsed.map((r) => ({
          item_codigo: r.item_codigo,
          descricao: r.descricao,
          unidade: r.unidade,
          qtd_contratada: r.qtd_contratada,
          valor_unitario: r.valor_unitario,
          sinapi_codigo: r.sinapi_codigo,
        })),
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar orçamento (Excel/CSV)
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Selecione um arquivo XLSX, XLS ou CSV com os itens do orçamento."}
            {step === "map" && "Confirme o mapeamento das colunas do arquivo para os campos do orçamento."}
            {step === "preview" && "Revise os itens processados e as pendências antes de importar."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {step === "upload" && (
            <div className="flex flex-col items-center justify-center gap-4 py-12 border-2 border-dashed border-muted rounded-lg">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">Arraste um arquivo ou clique para selecionar</p>
                <p className="text-sm text-muted-foreground">.xlsx, .xls, .csv — até 20 MB</p>
              </div>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
                disabled={parsing}
                className="max-w-md"
              />
              {parsing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Processando arquivo…
                </div>
              )}
            </div>
          )}

          {step === "map" && parseResult && mapping && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="gap-1">
                  <FileSpreadsheet className="h-3 w-3" /> {file?.name}
                </Badge>
                <Badge variant="secondary">{parseResult.rows.length} linhas</Badge>
                {parseResult.sheetNames.length > 1 && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Aba:</Label>
                    <Select value={parseResult.activeSheet} onValueChange={handleChangeSheet}>
                      <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {parseResult.sheetNames.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((key) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      {COLUMN_LABELS[key]}
                      {REQUIRED.includes(key) && !mapping[key] && (
                        <span className="text-destructive">obrigatório</span>
                      )}
                    </Label>
                    <Select
                      value={mapping[key] ?? "__none__"}
                      onValueChange={(v) => setMapping({ ...mapping, [key]: v === "__none__" ? null : v })}
                    >
                      <SelectTrigger className="h-9"><SelectValue placeholder="— não mapear —" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— não mapear —</SelectItem>
                        {parseResult.headers.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                  Amostra (primeiras 5 linhas)
                </div>
                <div className="overflow-x-auto max-h-56">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {parseResult.headers.map((h) => (
                          <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parseResult.rows.slice(0, 5).map((row, i) => (
                        <TableRow key={i}>
                          {parseResult.headers.map((h) => (
                            <TableCell key={h} className="text-xs whitespace-nowrap max-w-[220px] truncate">
                              {String(row[h] ?? "")}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {step === "preview" && preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Linhas processadas</div>
                  <div className="text-2xl font-semibold">{preview.totais.linhas}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Itens mensuráveis</div>
                  <div className="text-2xl font-semibold">{preview.totais.itens}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Etapas/Grupos</div>
                  <div className="text-2xl font-semibold">{preview.totais.etapas}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Valor total</div>
                  <div className="text-2xl font-semibold text-primary">{formatBRL(preview.totais.totalCents)}</div>
                </div>
              </div>

              {preview.issues.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
                  <div className="px-3 py-2 flex items-center gap-2 border-b border-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium">
                      {errosCount} erro(s) · {preview.issues.length - errosCount} aviso(s)
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto p-2 space-y-1">
                    {preview.issues.slice(0, 50).map((iss, i) => (
                      <div key={i} className="text-xs flex items-center gap-2">
                        <Badge variant={iss.nivel === "erro" ? "destructive" : "outline"} className="text-[10px]">
                          {iss.nivel === "erro" ? "Erro" : "Aviso"}
                        </Badge>
                        <span className="text-muted-foreground">Linha {iss.linha} · {iss.campo}</span>
                        <span>{iss.mensagem}</span>
                      </div>
                    ))}
                    {preview.issues.length > 50 && (
                      <div className="text-xs text-muted-foreground italic">
                        …e mais {preview.issues.length - 50} pendências.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Descrição da versão</Label>
                <Input
                  value={descricaoVersao}
                  onChange={(e) => setDescricaoVersao(e.target.value)}
                  maxLength={200}
                  placeholder="Ex.: Orçamento base contrato 2025-01"
                />
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                  Preview dos primeiros itens
                </div>
                <div className="overflow-x-auto max-h-80">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Código</TableHead>
                        <TableHead className="text-xs">Descrição</TableHead>
                        <TableHead className="text-xs">Un.</TableHead>
                        <TableHead className="text-xs text-right">Qtd</TableHead>
                        <TableHead className="text-xs text-right">V. Unit</TableHead>
                        <TableHead className="text-xs text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.parsed.slice(0, 30).map((r, i) => {
                        const total = r.qtd_contratada * r.valor_unitario;
                        return (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-mono">{r.item_codigo}</TableCell>
                            <TableCell className="text-xs max-w-[320px] truncate">{r.descricao}</TableCell>
                            <TableCell className="text-xs">{r.unidade ?? "—"}</TableCell>
                            <TableCell className="text-xs text-right">
                              {r.qtd_contratada.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}
                            </TableCell>
                            <TableCell className="text-xs text-right">
                              {r.valor_unitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </TableCell>
                            <TableCell className="text-xs text-right font-medium">
                              {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-3">
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          )}
          {step === "map" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>Voltar</Button>
              <Button
                onClick={() => setStep("preview")}
                disabled={missingRequired.length > 0}
              >
                {missingRequired.length > 0
                  ? `Mapeie: ${missingRequired.map((k) => COLUMN_LABELS[k].replace(" *", "")).join(", ")}`
                  : "Continuar para preview"}
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("map")}>Voltar</Button>
              <Button
                onClick={handleConfirm}
                disabled={errosCount > 0 || criarMut.isPending || (preview?.parsed.length ?? 0) === 0}
              >
                {criarMut.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importando…</>
                ) : (
                  <><CheckCircle2 className="mr-2 h-4 w-4" />Criar versão (rascunho)</>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
