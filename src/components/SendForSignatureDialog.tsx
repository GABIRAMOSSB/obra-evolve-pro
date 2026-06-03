import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Loader2, Plus, Trash2, PenTool, ExternalLink, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { sendDocumentForSignature, createDocumentPreviewUrl } from "@/lib/zapsign-send.functions";
import PdfFieldPlacer, { type Placement } from "@/components/PdfFieldPlacer";

interface SignerDraft {
  name: string;
  email: string;
  phone_country: string;
  phone_number: string;
  cpf: string;
  role: string;
  auth_mode: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obraId: string;
  documentPath: string;
  documentName: string;
  documentFolder: string;
  onSent?: () => void;
}

function emptySigner(): SignerDraft {
  return {
    name: "",
    email: "",
    phone_country: "55",
    phone_number: "",
    cpf: "",
    role: "",
    auth_mode: "assinaturaTela",
  };
}

export default function SendForSignatureDialog({
  open,
  onOpenChange,
  obraId,
  documentPath,
  documentName,
  documentFolder,
  onSent,
}: Props) {
  const [signers, setSigners] = useState<SignerDraft[]>([emptySigner()]);
  const [expirationDays, setExpirationDays] = useState<string>("30");
  const [customMessage, setCustomMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"signers" | "placements">("signers");
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [result, setResult] = useState<{
    signers: Array<{ name?: string; email?: string; signUrl?: string }>;
  } | null>(null);

  const reset = () => {
    setSigners([emptySigner()]);
    setExpirationDays("30");
    setCustomMessage("");
    setResult(null);
    setStep("signers");
    setPlacements([]);
    setPdfUrl(null);
  };

  const update = (i: number, patch: Partial<SignerDraft>) => {
    setSigners((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    );
  };

  const validateSigners = () => {
    for (const [i, s] of signers.entries()) {
      if (!s.name.trim()) {
        toast.error(`Signatário ${i + 1}: nome é obrigatório`);
        return false;
      }
      if (!s.email.trim() && !s.phone_number.trim()) {
        toast.error(
          `Signatário ${i + 1}: informe e-mail ou WhatsApp para envio`,
        );
        return false;
      }
    }
    return true;
  };

  const goToPlacements = async () => {
    if (!validateSigners()) return;
    setLoadingPdf(true);
    try {
      const res = await createDocumentPreviewUrl({ data: { documentPath } });
      setPdfUrl(res.url);
      setStep("placements");
    } catch (e) {
      toast.error("Não foi possível carregar o PDF", {
        description: (e as Error).message,
      });
    } finally {
      setLoadingPdf(false);
    }
  };

  const submit = async () => {
    if (!validateSigners()) return;
    setSubmitting(true);
    try {
      const res = await sendDocumentForSignature({
        data: {
          documentPath,
          documentName,
          documentFolder,
          obraId,
          customMessage: customMessage || undefined,
          expirationDays: expirationDays ? Number(expirationDays) : undefined,
          signers: signers.map((s) => ({
            name: s.name.trim(),
            email: s.email.trim() || undefined,
            phone_country: s.phone_country.trim() || undefined,
            phone_number: s.phone_number.trim() || undefined,
            cpf: s.cpf.trim() || undefined,
            role: s.role.trim() || undefined,
            auth_mode: s.auth_mode,
          })),
          placements: placements.length > 0 ? placements : undefined,
        },
      });
      toast.success("Documento enviado para assinatura");
      setResult({ signers: res.signers });
      onSent?.();
    } catch (e) {
      toast.error("Falha no envio", {
        description: (e as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        {step === "signers" && !result ? (
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-primary">1. Signatários</span>
            <ArrowRight className="h-3 w-3" />
            <span>2. Posicionar campos</span>
          </div>
        ) : null}
        {step === "placements" && !result ? (
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>1. Signatários</span>
            <ArrowRight className="h-3 w-3" />
            <span className="font-semibold text-primary">2. Posicionar campos</span>
          </div>
        ) : null}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-primary" />
            Enviar para assinatura
          </DialogTitle>
          <DialogDescription className="truncate">
            {documentName}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Documento criado na ZapSign. Cada signatário receberá automaticamente o link por e-mail/WhatsApp informado. Você também pode copiar/compartilhar os links abaixo:
            </p>
            <Card className="divide-y">
              {result.signers.map((s, i) => (
                <div
                  key={i}
                  className="p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {s.name || `Signatário ${i + 1}`}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {s.email || "—"}
                    </div>
                  </div>
                  {s.signUrl ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(s.signUrl!);
                        toast("Link copiado");
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      Copiar link
                    </Button>
                  ) : null}
                </div>
              ))}
            </Card>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Concluir</Button>
            </DialogFooter>
          </div>
        ) : step === "signers" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Validade (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(e.target.value)}
                />
              </div>
              <div>
                <Label>Pasta de origem</Label>
                <Input value={documentFolder} disabled />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Signatários</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSigners((p) => [...p, emptySigner()])
                  }
                  disabled={signers.length >= 10}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Adicionar
                </Button>
              </div>

              {signers.map((s, i) => (
                <Card key={i} className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Signatário {i + 1}
                    </span>
                    {signers.length > 1 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() =>
                          setSigners((p) =>
                            p.filter((_, idx) => idx !== i),
                          )
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs">Nome completo *</Label>
                      <Input
                        value={s.name}
                        onChange={(e) =>
                          update(i, { name: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">E-mail</Label>
                      <Input
                        type="email"
                        value={s.email}
                        onChange={(e) =>
                          update(i, { email: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">CPF</Label>
                      <Input
                        value={s.cpf}
                        onChange={(e) => update(i, { cpf: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">DDI</Label>
                      <Input
                        value={s.phone_country}
                        onChange={(e) =>
                          update(i, { phone_country: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">WhatsApp</Label>
                      <Input
                        value={s.phone_number}
                        onChange={(e) =>
                          update(i, { phone_number: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Cargo / Função</Label>
                      <Input
                        value={s.role}
                        onChange={(e) =>
                          update(i, { role: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Autenticação</Label>
                      <Select
                        value={s.auth_mode}
                        onValueChange={(v) => update(i, { auth_mode: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="assinaturaTela">
                            Assinatura em tela
                          </SelectItem>
                          <SelectItem value="tokenEmail">
                            Token por e-mail
                          </SelectItem>
                          <SelectItem value="tokenSms">
                            Token por SMS
                          </SelectItem>
                          <SelectItem value="certificadoDigital">
                            Certificado digital
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div>
              <Label className="text-xs">Mensagem para signatários (opcional)</Label>
              <Textarea
                rows={3}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Olá, segue o documento para sua assinatura."
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <PenTool className="h-4 w-4 mr-1" />
                )}
                Enviar para assinatura
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
