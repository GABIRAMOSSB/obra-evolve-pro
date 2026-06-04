import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Copy,
} from "lucide-react";

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
  "rgba(59,130,246,0.35)",
  "rgba(16,185,129,0.35)",
  "rgba(244,114,182,0.35)",
  "rgba(234,179,8,0.35)",
  "rgba(168,85,247,0.35)",
  "rgba(248,113,113,0.35)",
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

const GRID = 0.01; // 1% snap
const snap = (n: number, enabled: boolean) =>
  enabled ? Math.round(n / GRID) * GRID : n;
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

type DragMode =
  | { kind: "move"; index: number; startX: number; startY: number; origX: number; origY: number }
  | { kind: "resize"; index: number; startX: number; startY: number; origW: number; origH: number; origX: number; origY: number };

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
  const [baseWidth, setBaseWidth] = useState(720);
  const [zoom, setZoom] = useState(1);
  const [snapOn, setSnapOn] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragMode | null>(null);
  const width = Math.round(baseWidth * zoom);

  useEffect(() => {
    const handle = () => {
      if (wrapRef.current) {
        setBaseWidth(Math.max(400, wrapRef.current.clientWidth - 16));
      }
    };
    handle();
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  // global pointer move/up for drag/resize
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || !pageRef.current) return;
      const rect = pageRef.current.getBoundingClientRect();
      const dx = (e.clientX - d.startX) / rect.width;
      const dy = (e.clientY - d.startY) / rect.height;
      const next = value.slice();
      const p = next[d.index];
      if (!p) return;
      if (d.kind === "move") {
        next[d.index] = {
          ...p,
          x: snap(clamp(d.origX + dx, 0, 1 - p.w), snapOn),
          y: snap(clamp(d.origY + dy, 0, 1 - p.h), snapOn),
        };
      } else {
        const w = snap(clamp(d.origW + dx, 0.02, 1 - d.origX), snapOn);
        const h = snap(clamp(d.origH + dy, 0.02, 1 - d.origY), snapOn);
        next[d.index] = { ...p, w, h };
      }
      onChange(next);
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [value, onChange, snapOn]);

  // keyboard: delete / arrows
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (selected == null) return;
      const target = e.target as HTMLElement;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const p = value[selected];
      if (!p) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onChange(value.filter((_, i) => i !== selected));
        setSelected(null);
        return;
      }
      const step = e.shiftKey ? 0.01 : 0.002;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else return;
      e.preventDefault();
      const next = value.slice();
      next[selected] = {
        ...p,
        x: clamp(p.x + dx, 0, 1 - p.w),
        y: clamp(p.y + dy, 0, 1 - p.h),
      };
      onChange(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, value, onChange]);

  const placementsThisPage = useMemo(
    () =>
      value
        .map((p, i) => ({ p, i }))
        .filter((x) => x.p.page === page),
    [value, page],
  );

  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (signers.length === 0) return;
    if (dragRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const size = DEFAULT_SIZE[activeType];
    const newP: Placement = {
      signerIndex: activeSigner,
      page,
      type: activeType,
      x: snap(clamp(x - size.w / 2, 0, 1 - size.w), snapOn),
      y: snap(clamp(y - size.h / 2, 0, 1 - size.h), snapOn),
      w: size.w,
      h: size.h,
    };
    onChange([...value, newP]);
    setSelected(value.length);
  };

  const startDrag = useCallback(
    (e: React.PointerEvent, index: number, mode: "move" | "resize") => {
      e.stopPropagation();
      e.preventDefault();
      const p = value[index];
      if (!p) return;
      setSelected(index);
      dragRef.current =
        mode === "move"
          ? {
              kind: "move",
              index,
              startX: e.clientX,
              startY: e.clientY,
              origX: p.x,
              origY: p.y,
            }
          : {
              kind: "resize",
              index,
              startX: e.clientX,
              startY: e.clientY,
              origW: p.w,
              origH: p.h,
              origX: p.x,
              origY: p.y,
            };
    },
    [value],
  );

  const duplicate = (index: number) => {
    const p = value[index];
    if (!p) return;
    const dup: Placement = {
      ...p,
      x: clamp(p.x + 0.02, 0, 1 - p.w),
      y: clamp(p.y + 0.02, 0, 1 - p.h),
    };
    onChange([...value, dup]);
    setSelected(value.length);
  };

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
    if (selected === index) setSelected(null);
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
                      background: SIGNER_BORDERS[i % SIGNER_BORDERS.length],
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
        <div className="flex items-center gap-2">
          <Switch
            id="snap-grid"
            checked={snapOn}
            onCheckedChange={setSnapOn}
          />
          <Label htmlFor="snap-grid" className="text-xs cursor-pointer">
            Grade
          </Label>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            disabled={zoom <= 0.5}
            title="Diminuir zoom"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            disabled={zoom >= 3}
            title="Aumentar zoom"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setZoom(1)}
            title="Ajustar à largura"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
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
        Clique no PDF para inserir um campo. Arraste para mover, use a alça
        inferior direita para redimensionar. Selecione um campo e use as
        setas do teclado para ajuste fino (Shift = passo maior),{" "}
        <kbd className="px-1 border rounded">Delete</kbd> para remover.
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
            ref={pageRef}
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
            {placementsThisPage.map(({ p, i }) => {
              const bg = SIGNER_COLORS[p.signerIndex % SIGNER_COLORS.length];
              const border =
                SIGNER_BORDERS[p.signerIndex % SIGNER_BORDERS.length];
              const isSelected = selected === i;
              return (
                <div
                  key={i}
                  className="absolute flex items-center justify-between gap-1 px-1 text-[10px] font-medium rounded-sm select-none"
                  style={{
                    left: `${p.x * 100}%`,
                    top: `${p.y * 100}%`,
                    width: `${p.w * 100}%`,
                    height: `${p.h * 100}%`,
                    background: bg,
                    border: `${isSelected ? 2 : 1.5}px solid ${border}`,
                    boxShadow: isSelected
                      ? `0 0 0 2px ${border}33`
                      : undefined,
                    color: border,
                    cursor: "move",
                    touchAction: "none",
                  }}
                  onPointerDown={(e) => startDrag(e, i, "move")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(i);
                  }}
                >
                  <span className="truncate pointer-events-none">
                    {TYPE_LABEL[p.type]}
                  </span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicate(i);
                      }}
                      className="hover:text-foreground"
                      aria-label="Duplicar campo"
                      title="Duplicar"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(i);
                      }}
                      className="hover:text-destructive"
                      aria-label="Remover campo"
                      title="Remover"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  {/* resize handle */}
                  <div
                    onPointerDown={(e) => startDrag(e, i, "resize")}
                    className="absolute -right-1 -bottom-1 h-3 w-3 rounded-sm border bg-background"
                    style={{
                      borderColor: border,
                      cursor: "nwse-resize",
                      touchAction: "none",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </Document>
      </div>
    </div>
  );
}
