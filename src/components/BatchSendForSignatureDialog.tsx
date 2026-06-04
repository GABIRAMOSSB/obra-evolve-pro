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
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plus,
  Trash2,
  PenTool,
  FileText,
  CheckCircle2,
  XCircle,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { sendBatchDocumentsForSignature } from "@/lib/zapsign-send.functions";
import { listSignatureTemplates } from "@/lib/zapsign-templates.functions";
import { useQuery } from "@tanstack/react-query";

interface SignerDraft {
  name: string;
  email: string;
  phone_country: string;
  phone_number: string;
  cpf: string;
  role: string;
  auth_mode: string;
}

export interface BatchDocument {
  path: string;
  name: string;
  folder: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obraId: string;
  documents: BatchDocument[];
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

export default function BatchSendForSignatureDialog({
  open,
  onOpenChange,
  obraId,
  documents,
  onSent,
}: Props) {
  const [signers, setSigners] = useState<SignerDraft[]>([emptySigner()]);
  const [expirationDays, setExpirationDays] = useState<string>("30");
  const [customMessage, setCustomMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [results, setResults] = useState<
    Array<{ documentName: string; ok: boolean; error?: string }> | null
  >(null);

  const templatesQ = useQuery({
    queryKey: ["zapsign", "templates"],
    queryFn: () => listSignatureTemplates(),
    enabled: open,
  });
  const templates = templatesQ.data?.templates ?? [];

  const reset = () => {
    setSigners([emptySigner()]);
    setExpirationDays("30");
    setCustomMessage("");
    setResults(null);
    setSelectedTemplateId("");
  };

  const applyTemplate = (id: string) => {
    setSelectedTemplateId(id);
    if (!id) return;
    const t: any = templates.find((x: any) => x.id === id);
    if (!t) return;
    const drafts: SignerDraft[] = (t.signers ?? []).map((s: any) => ({
      name: s.name ?? "",
      email: s.email ?? "",
      phone_country: s.phone_country ?? "55",
      phone_number: s.phone_number ?? "",
      cpf: s.cpf ?? "",
      role: s.role ?? "",
      auth_mode: s.auth_mode ?? "assinaturaTela",
    }));
    if (drafts.length > 0) setSigners(drafts);
    if (t.expiration_days) setExpirationDays(String(t.expiration_days));
    if (t.custom_message) setCustomMessage(t.custom_message);
    toast.success(`Template "${t.name}" aplicado`);
  };

  const update = (i: number, patch: Partial<SignerDraft>) => {
    setSigners((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };

  const validate = () => {
    if (documents.length === 0) {
      toast.error("Selecione ao menos um documento.");
      return false;
    }
    for (const [i, s] of signers.entries()) {
      if (!s.name.trim()) {
        toast.error(`Signatário ${i + 1}: nome é obrigatório`);
        return false;
      }
      if (!s.email.trim() && !s.phone_number.trim()) {
        toast.error(`Signatário ${i + 1}: informe e-mail ou WhatsApp`);
        return false;
      }
    }
    return true;
  };

  const submit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const t: any = selectedTemplateId
        ? templates.find((x: any) => x.id === selectedTemplateId)
        : null;
      const placements = t?.placements ?? undefined;

      const res = await sendBatchDocumentsForSignature({
        data: {
          obraId,
          documents: documents.map((d) => ({
            documentPath: d.path,
            documentName: d.name,
            documentFolder: d.folder,
          })),
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
          placements: placements && placements.length > 0 ? placements : undefined,
        },
      });
      setResults(
        res.results.map((r) => ({
          documentName: r.documentName,
          ok: r.ok,
          error: r.error,
        })),
      );
      if (res.successCount === res.total) {
        toast.success(`${res.successCount} documento(s) enviado(s).`);
      } else {
        toast.warning(
          `${res.successCount}/${res.total} enviados. ${res.failureCount} falha(s).`,
        );
      }
      onSent?.();
    } catch (e) {
      toast.error("Falha no envio em lote", { description: (e as Error).message });
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
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Envio em lote
          </DialogTitle>
          <DialogDescription>
            {documents.length} documento(s) selecionado(s). Os mesmos
            signatários serão aplicados a todos.
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <div className="space-y-3">
            <Card className="divide-y">
              {results.map((r, i) => (
                <div key={i} className="p-3 flex items-center gap-2">
                  {r.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {r.documentName}
                    </div>
                    {r.error ? (
                      <div className="text-xs text-destructive truncate">
                        {r.error}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </Card>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Concluir</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <Card className="p-3 space-y-1 max-h-40 overflow-y-auto">
              {documents.map((d) => (
                <div key={d.path} className="flex items-center gap-2 text-xs">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate flex-1">{d.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {d.folder}
                  </Badge>
                </div>
              ))}
            </Card>

            {templates.length > 0 ? (
              <div className="rounded-lg border bg-muted/30 p-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <Label className="text-xs whitespace-nowrap m-0">
                  Aplicar template:
                </Label>
                <Select value={selectedTemplateId} onValueChange={applyTemplate}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Escolha um template…" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.signers?.length ?? 0} sig.)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

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
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Signatários</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSigners((p) => [...p, emptySigner()])}
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
                          setSigners((p) => p.filter((_, idx) => idx !== i))
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
                        onChange={(e) => update(i, { name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">E-mail</Label>
                      <Input
                        type="email"
                        value={s.email}
                        onChange={(e) => update(i, { email: e.target.value })}
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
                        onChange={(e) => update(i, { role: e.target.value })}
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
                          <SelectItem value="tokenSms">Token por SMS</SelectItem>
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
              <Label className="text-xs">
                Mensagem para signatários (opcional)
              </Label>
              <Textarea
                rows={3}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
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
                Enviar {documents.length} documento(s)
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
