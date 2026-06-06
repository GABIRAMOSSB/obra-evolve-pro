import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  registrarManifestacao, limparManifestacao, MANIFESTACAO_LABELS,
} from "@/lib/nfe-manifestacao.functions";

type Tipo = "ciencia" | "confirmacao" | "desconhecimento" | "nao_realizada";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nota: {
    id: string;
    numero: string;
    emitente_nome: string | null;
    manifestacao_tipo: string | null;
    manifestacao_data: string | null;
    manifestacao_justificativa: string | null;
  } | null;
  onSaved: () => void;
};

export function NfeManifestacaoDialog({ open, onOpenChange, nota, onSaved }: Props) {
  const registrar = useServerFn(registrarManifestacao);
  const limpar = useServerFn(limparManifestacao);
  const [tipo, setTipo] = useState<Tipo>("ciencia");
  const [justificativa, setJustificativa] = useState("");
  const [saving, setSaving] = useState(false);

  if (!nota) return null;

  const requiresJust = tipo === "desconhecimento" || tipo === "nao_realizada";

  const handleSave = async () => {
    if (requiresJust && justificativa.trim().length < 15) {
      toast.error("Justificativa de no mínimo 15 caracteres é obrigatória.");
      return;
    }
    setSaving(true);
    try {
      await registrar({ data: { nota_id: nota.id, tipo, justificativa: justificativa.trim() || null } });
      toast.success("Manifestação registrada.");
      setJustificativa("");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao registrar.");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await limpar({ data: { nota_id: nota.id } });
      toast.success("Manifestação removida.");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manifestação do Destinatário</DialogTitle>
          <DialogDescription>
            NF-e nº {nota.numero} — {nota.emitente_nome ?? "—"}
          </DialogDescription>
        </DialogHeader>

        {nota.manifestacao_tipo && (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <Badge variant="secondary">{MANIFESTACAO_LABELS[nota.manifestacao_tipo] ?? nota.manifestacao_tipo}</Badge>
                <span className="ml-2 text-muted-foreground text-xs">
                  {nota.manifestacao_data ? new Date(nota.manifestacao_data).toLocaleString("pt-BR") : ""}
                </span>
              </div>
              <Button size="sm" variant="ghost" disabled={saving} onClick={handleClear}>
                Limpar
              </Button>
            </div>
            {nota.manifestacao_justificativa && (
              <div className="mt-1 text-xs text-muted-foreground">
                {nota.manifestacao_justificativa}
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <Label className="mb-2 block">Tipo</Label>
            <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as Tipo)} className="space-y-2">
              {(["ciencia", "confirmacao", "desconhecimento", "nao_realizada"] as Tipo[]).map((t) => (
                <div key={t} className="flex items-center space-x-2">
                  <RadioGroupItem value={t} id={`m-${t}`} />
                  <Label htmlFor={`m-${t}`} className="cursor-pointer font-normal">
                    {MANIFESTACAO_LABELS[t]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="just">
              Justificativa {requiresJust && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="just"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder={requiresJust ? "Mínimo 15 caracteres" : "Opcional"}
              rows={3}
              maxLength={2000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
