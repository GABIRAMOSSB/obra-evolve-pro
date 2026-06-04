import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Trash2, ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export type FieldType =
  | "signature"
  | "visto"
  | "name"
  | "date"
  | "cpf"
  | "email"
  | "text";

export interface Placement {
  signerIndex: number;
  page: number; // 1-based
  type: FieldType;
  // percentages 0..1 relative to page top-left
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  pdfUrl: string;
  signers: Array<{ name: string }>;
  value: Placement[];
  onChange: (p: Placement[]) => void;
}

const SIGNER_COLORS = [
  "rgba(59,130,246,0.35)", // blue
  "rgba(16,185,129,0.35)", // emerald
  "rgba(244,114,182,0.35)", // pink
  "rgba(234,179,8,0.35)", // amber
  "rgba(168,85,247,0.35)", // purple
  "rgba(248,113,113,0.35)", // red
];
const SIGNER_BORDERS = [
  "rgb(37,99,235)",
  "rgb(5,150,105)",
  "rgb(219,39,119)",
  "rgb(202,138,4)",
  "rgb(147,51,234)",
  "rgb(220,38,38)",
];

const DEFAULT_SIZE: Record<FieldType, { w: number; h: number }> = {
  signature: { w: 0.22, h: 0.05 },
  visto: { w: 0.08, h: 0.05 },
  name: { w: 0.22, h: 0.03 },
  date: { w: 0.14, h: 0.03 },
  cpf: { w: 0.14, h: 0.03 },
  email: { w: 0.22, h: 0.03 },
  text: { w: 0.22, h: 0.03 },
};

const TYPE_LABEL: Record<FieldType, string> = {
  signature: "Assinatura",
  visto: "Rubrica",
  name: "Nome",
  date: "Data",
  cpf: "CPF",
  email: "E-mail",
  text: "Texto",
};

export default function PdfFieldPlacer({
  pdfUrl,
  signers,
  value,
  onChange,
}: Props) {
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [activeSigner, setActiveSigner] = useState(0);
  const [activeType, setActiveType] = useState<FieldType>("signature");
  const [width, setWidth] = useState(720);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = () => {
      if (wrapRef.current) {
        setWidth(Math.min(wrapRef.current.clientWidth - 16, 900));
      }
    };
    handle();
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  const placementsThisPage = useMemo(
    () => value.filter((p) => p.page === page),
    [value, page],
  );

  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (signers.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const size = DEFAULT_SIZE[activeType];
    const newP: Placement = {
      signerIndex: activeSigner,
      page,
      type: activeType,
      x: Math.max(0, Math.min(1 - size.w, x - size.w / 2)),
      y: Math.max(0, Math.min(1 - size.h, y - size.h / 2)),
      w: size.w,
      h: size.h,
    };
    onChange([...value, newP]);
  };

  const remove = (idx: number) => {
    const flatIdx = value.findIndex((p) => p === placementsThisPage[idx]);
    if (flatIdx >= 0) {
      onChange(value.filter((_, i) => i !== flatIdx));
    }
  };

  return (
    <div className="space-y-3">
      <Card className="p-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[180px]">
          <Label className="text-xs">Signatário ativo</Label>
          <Select
            value={String(activeSigner)}
            onValueChange={(v) => setActiveSigner(Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {signers.map((s, i) => (
                <SelectItem key={i} value={String(i)}>
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
                    style={{
                      background:
                        SIGNER_BORDERS[i % SIGNER_BORDERS.length],
                    }}
                  />
                  {s.name || `Signatário ${i + 1}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[160px]">
          <Label className="text-xs">Tipo de campo</Label>
          <Select
            value={activeType}
            onValueChange={(v) => setActiveType(v as FieldType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TYPE_LABEL) as FieldType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {page} / {numPages || "…"}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => Math.min(numPages || p, p + 1))}
            disabled={!numPages || page >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        Clique no PDF para inserir um campo do signatário/tipo selecionado.
        Clique no <Trash2 className="inline h-3 w-3" /> de um campo para
        remover.
      </p>

      <div
        ref={wrapRef}
        className="w-full overflow-auto border rounded-lg bg-muted/30 p-2 flex justify-center"
      >
        <Document
          file={pdfUrl}
          onLoadSuccess={(d) => setNumPages(d.numPages)}
          loading={
            <div className="p-10 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando PDF…
            </div>
          }
          error={
            <div className="p-10 text-sm text-destructive">
              Não foi possível carregar o PDF.
            </div>
          }
        >
          <div
            className="relative inline-block shadow-md"
            onClick={handlePageClick}
            style={{ cursor: "crosshair" }}
          >
            <Page
              pageNumber={page}
              width={width}
              renderAnnotationLayer={false}
              renderTextLayer={false}
            />
            {placementsThisPage.map((p, idx) => {
              const bg =
                SIGNER_COLORS[p.signerIndex % SIGNER_COLORS.length];
              const border =
                SIGNER_BORDERS[p.signerIndex % SIGNER_BORDERS.length];
              return (
                <div
                  key={idx}
                  className="absolute flex items-center justify-between gap-1 px-1 text-[10px] font-medium rounded-sm"
                  style={{
                    left: `${p.x * 100}%`,
                    top: `${p.y * 100}%`,
                    width: `${p.w * 100}%`,
                    height: `${p.h * 100}%`,
                    background: bg,
                    border: `1.5px solid ${border}`,
                    color: border,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <span className="truncate">{TYPE_LABEL[p.type]}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(idx);
                    }}
                    className="shrink-0 hover:text-destructive"
                    aria-label="Remover campo"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </Document>
      </div>
    </div>
  );
}
