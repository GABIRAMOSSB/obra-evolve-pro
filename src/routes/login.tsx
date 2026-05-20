import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { HardHat } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const safeRedirect = redirect && redirect.startsWith("/") ? redirect : undefined;
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      if (safeRedirect) {
        window.location.href = safeRedirect;
      } else {
        navigate({ to: "/" });
      }
    }
  }, [user, loading, navigate, safeRedirect]);

  // Detecta erro de OAuth retornado pelo Google / broker
  useEffect(() => {
    const url = new URL(window.location.href);
    const err =
      url.searchParams.get("error_description") ||
      url.searchParams.get("error") ||
      url.hash.match(/error_description=([^&]+)/)?.[1];
    if (err) {
      const decoded = decodeURIComponent(err).replace(/\+/g, " ");
      const friendly = /exchange|code|expired|invalid_grant/i.test(decoded)
        ? "Falha na autenticação com o Google. O código expirou ou já foi usado. Tente novamente em uma aba anônima e não recarregue durante o redirecionamento."
        : decoded;
      toast.error(friendly, { duration: 8000 });
      const cleanUrl = new URL(window.location.origin + window.location.pathname);
      if (safeRedirect) {
        cleanUrl.searchParams.set("redirect", safeRedirect);
      }
      window.history.replaceState({}, "", cleanUrl.toString());
    }
  }, [safeRedirect]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Conta criada. Verifique seu e-mail para confirmar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    try {
      setBusy(true);
      const callbackUrl = new URL("/login", window.location.origin);
      if (safeRedirect) {
        callbackUrl.searchParams.set("redirect", safeRedirect);
      }

      const res = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: callbackUrl.toString(),
        extraParams: {
          prompt: "select_account",
          ...(email.trim() ? { login_hint: email.trim() } : {}),
        },
      });

      if (res.redirected) {
        return;
      }

      if (res.error) {
        toast.error(res.error.message ?? "Falha no login com Google");
        return;
      }

      if (safeRedirect) {
        window.location.href = safeRedirect;
      } else {
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no login com Google");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
            <HardHat className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold">Acompanhamento de Obras</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "Entre na sua conta" : "Crie sua conta"} para sincronizar suas obras na nuvem.
          </p>
        </div>

        <Button type="button" variant="outline" className="w-full" onClick={onGoogle} disabled={busy}>
          Continuar com Google
        </Button>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">ou</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "login" ? "Ainda não tem conta?" : "Já tem conta?"}{" "}
          <button
            type="button"
            className="text-primary underline"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Criar conta" : "Entrar"}
          </button>
        </p>
      </Card>
      <Toaster richColors position="top-right" />
    </div>
  );
}
