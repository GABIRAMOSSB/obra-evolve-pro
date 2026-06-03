import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  getZapSignStatus,
  getOrCreateZapSignSettings,
  testZapSignConnection,
  updateZapSignSettings,
} from "@/lib/zapsign.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, PlugZap, Shield, Webhook } from "lucide-react";

export const Route = createFileRoute("/_app/configuracoes/zapsign")({
  head: () => ({
    meta: [
      { title: "Integração ZapSign — Configurações" },
      { name: "description", content: "Configuração da integração de assinatura eletrônica ZapSign." },
    ],
  }),
  component: ZapSignSettingsPage,
});

function ZapSignSettingsPage() {
  const qc = useQueryClient();
  const statusFn = useServerFn(getZapSignStatus);
  const settingsFn = useServerFn(getOrCreateZapSignSettings);
  const testFn = useServerFn(testZapSignConnection);
  const updateFn = useServerFn(updateZapSignSettings);

  const statusQ = useQuery({ queryKey: ["zapsign", "status"], queryFn: () => statusFn() });
  const settingsQ = useQuery({ queryKey: ["zapsign", "settings"], queryFn: () => settingsFn() });

  const testMut = useMutation({
    mutationFn: () => testFn(),
    onSuccess: (r) => {
      if (r.ok) toast.success("Conexão validada com sucesso.");
      else toast.error("Falha na conexão", { description: r.message });
      qc.invalidateQueries({ queryKey: ["zapsign"] });
    },
    onError: (e) => toast.error("Erro", { description: (e as Error).message }),
  });

  const updateMut = useMutation({
    mutationFn: (patch: Parameters<typeof updateFn>[0]["data"]) => updateFn({ data: patch }),
    onSuccess: () => {
      toast.success("Configuração salva.");
      qc.invalidateQueries({ queryKey: ["zapsign", "settings"] });
    },
    onError: (e) => toast.error("Erro ao salvar", { description: (e as Error).message }),
  });

  const status = statusQ.data;
  const settings = settingsQ.data;
  const isSandbox = settings?.environment !== "production";

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <header className="space-y-1">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Configurações</div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Integração ZapSign</h1>
        <p className="text-sm text-muted-foreground">
          Configuração do serviço de assinatura eletrônica. Token e segredos ficam armazenados de forma segura no backend.
        </p>
      </header>

      {isSandbox && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold text-amber-700 dark:text-amber-400">Ambiente de testes ativo</div>
            <div className="text-amber-700/80 dark:text-amber-400/80 text-xs mt-0.5">
              Documentos enviados neste ambiente <strong>não possuem validade jurídica</strong>. Use apenas para validação.
            </div>
          </div>
        </div>
      )}

      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <PlugZap className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold">Credenciais</h2>
        </div>

        {statusQ.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando…
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <Field icon={<KeyRound className="h-4 w-4" />} label="Token da API">
              {status?.configured ? (
                <div className="flex items-center gap-2">
                  <code className="font-mono text-xs px-2 py-1 rounded bg-muted">{status.tokenMask}</code>
                  <Badge variant="secondary" className="text-[10px]">Configurado</Badge>
                </div>
              ) : (
                <Badge variant="destructive" className="text-[10px]">Não configurado</Badge>
              )}
            </Field>
            <Field icon={<Shield className="h-4 w-4" />} label="Endpoint">
              <code className="font-mono text-[11px] text-muted-foreground break-all">
                {status?.baseUrl || "https://sandbox.api.zapsign.com.br/api/v1 (padrão)"}
              </code>
            </Field>
            <Field icon={<Webhook className="h-4 w-4" />} label="Segredo do Webhook">
              {status?.webhookSecretConfigured ? (
                <Badge variant="secondary" className="text-[10px]">Configurado</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">Pendente</Badge>
              )}
            </Field>
            <Field icon={<CheckCircle2 className="h-4 w-4" />} label="Último teste">
              {settings?.last_connection_test_at ? (
                <div className="space-y-0.5">
                  <div className="text-xs">{new Date(settings.last_connection_test_at).toLocaleString("pt-BR")}</div>
                  <Badge
                    variant={settings.last_connection_test_status === "success" ? "secondary" : "destructive"}
                    className="text-[10px]"
                  >
                    {settings.last_connection_test_status === "success" ? "Sucesso" : "Falhou"}
                  </Badge>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Nunca testado</span>
              )}
            </Field>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            onClick={() => testMut.mutate()}
            disabled={testMut.isPending || !status?.configured}
            size="sm"
          >
            {testMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlugZap className="h-4 w-4 mr-2" />}
            Testar conexão
          </Button>
          {!status?.configured && (
            <span className="text-xs text-muted-foreground self-center">
              Adicione <code className="font-mono">ZAPSIGN_API_TOKEN</code> nos Secrets para habilitar.
            </span>
          )}
        </div>
      </Card>

      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold">Preferências</h2>
        </div>

        {settingsQ.isLoading || !settings ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Ambiente</Label>
                <Select
                  value={settings.environment}
                  onValueChange={(v) => updateMut.mutate({ environment: v as "sandbox" | "production" })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
                    <SelectItem value="production">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Método de autenticação padrão</Label>
                <Select
                  value={settings.default_auth_mode}
                  onValueChange={(v) => updateMut.mutate({ default_auth_mode: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assinaturaTela">Assinatura na tela</SelectItem>
                    <SelectItem value="assinaturaTela-tokenEmail">Assinatura + token por e-mail</SelectItem>
                    <SelectItem value="assinaturaTela-tokenSms">Assinatura + token por SMS</SelectItem>
                    <SelectItem value="assinaturaTela-tokenWhatsapp">Assinatura + token por WhatsApp</SelectItem>
                    <SelectItem value="tokenEmail">Token por e-mail</SelectItem>
                    <SelectItem value="tokenSms">Token por SMS</SelectItem>
                    <SelectItem value="tokenWhatsapp">Token por WhatsApp</SelectItem>
                    <SelectItem value="certificadoDigital">Certificado digital</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Toggle
                label="Envio automático por e-mail"
                description="ZapSign envia o link de assinatura por e-mail."
                checked={settings.automatic_email}
                onChange={(v) => updateMut.mutate({ automatic_email: v })}
              />
              <Toggle
                label="Envio automático por WhatsApp"
                description="ZapSign envia o link via WhatsApp (quando suportado pelo plano)."
                checked={settings.automatic_whatsapp}
                onChange={(v) => updateMut.mutate({ automatic_whatsapp: v })}
              />
              <Toggle
                label="Compartilhamento manual por WhatsApp"
                description="Disponibiliza botão de copiar/abrir WhatsApp para cada signatário."
                checked={settings.manual_whatsapp_enabled}
                onChange={(v) => updateMut.mutate({ manual_whatsapp_enabled: v })}
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {icon} {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border bg-background/50 px-4 py-3">
      <div className="space-y-0.5">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
