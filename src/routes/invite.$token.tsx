import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Mail, Users, CheckCircle2, XCircle, Shield, HardHat, Loader2 } from "lucide-react";

export const Route = createFileRoute("/invite/$token")({
  component: InvitePage,
});

interface InviteInfo {
  company_id: string;
  company_name: string;
  email: string;
  role: "admin" | "editor" | "member";
  expires_at: string;
  accepted: boolean;
}

const roleLabel = (r: InviteInfo["role"]) =>
  r === "admin" ? "Administrador" : r === "editor" ? "Editor" : "Membro";

function InvitePage() {
  const { token } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form state for inline signup/login
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [password, setPassword] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("get_invite_info", { _token: token });
      if (error) {
        setError("Convite inválido");
      } else if (!data || (data as unknown[]).length === 0) {
        setError("Convite não encontrado");
      } else {
        const row = (data as unknown as InviteInfo[])[0];
        setInfo(row);
      }
      setLoading(false);
    })();
  }, [token]);

  async function acceptInvite() {
    setBusy(true);
    const { error } = await supabase.rpc("accept_company_invite", { _token: token });
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Tudo certo! Bem-vindo à equipe.");
      navigate({ to: "/" });
    }
  }

  // If already logged in with the right email, auto-accept once info loads
  useEffect(() => {
    if (!info || authLoading || !user) return;
    if (user.email?.toLowerCase() === info.email.toLowerCase() && !info.accepted) {
      void acceptInvite();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, user, authLoading]);

  async function submitAuth(e: FormEvent) {
    e.preventDefault();
    if (!info || busy) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: info.email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/invite/${token}` },
        });
        if (error) throw error;
        toast.success("Conta criada. Entrando...");
        // try immediate sign-in (works if email confirmation is off)
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: info.email,
          password,
        });
        if (signInErr) {
          toast.message("Verifique seu e-mail para confirmar a conta e volte a este link.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: info.email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    if (!info || busy) return;
    try {
      setBusy(true);
      const res = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/invite/${token}`,
        extraParams: { login_hint: info.email, prompt: "select_account" },
      });
      if (res.redirected) return;
      if (res.error) toast.error(res.error.message);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    if (!info) return;
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(info.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success(`Enviamos um link de recuperação para ${info.email}.`);
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando convite...
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <XCircle className="w-12 h-12 mx-auto text-destructive" />
          <h1 className="text-xl font-bold">Convite inválido</h1>
          <p className="text-sm text-muted-foreground">{error ?? "Não foi possível carregar esse convite."}</p>
          <Button asChild className="w-full"><Link to="/">Ir para o app</Link></Button>
        </Card>
      </div>
    );
  }

  const expired = new Date(info.expires_at) < new Date();
  const wrongAccount = user && user.email?.toLowerCase() !== info.email.toLowerCase();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-muted/40 to-background">
      <Card className="max-w-md w-full p-8 space-y-6 shadow-lg">
        <div className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
            <HardHat className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Convite de equipe</p>
            <h1 className="text-2xl font-bold leading-tight">{info.company_name}</h1>
            <p className="text-sm text-muted-foreground">
              Você foi convidado como{" "}
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                {info.role === "admin" && <Shield className="w-3.5 h-3.5" />}
                {roleLabel(info.role)}
              </span>
            </p>
          </div>
        </div>

        <div className="text-sm bg-muted rounded-md p-3 flex items-center gap-2">
          <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="truncate">Convite para <strong>{info.email}</strong></span>
        </div>

        {info.accepted ? (
          <div className="space-y-3">
            <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" /> Este convite já foi aceito.
            </div>
            <Button asChild className="w-full"><Link to="/">Ir para o app</Link></Button>
          </div>
        ) : expired ? (
          <div className="text-center text-sm text-destructive py-2">
            Este convite expirou. Peça um novo para o administrador.
          </div>
        ) : user && !wrongAccount ? (
          <Button className="w-full" size="lg" onClick={acceptInvite} disabled={busy}>
            {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Entrando...</> : <><Users className="w-4 h-4 mr-2" /> Aceitar e entrar na empresa</>}
          </Button>
        ) : wrongAccount ? (
          <div className="space-y-2">
            <p className="text-xs text-center text-destructive">
              Você está logado como <strong>{user!.email}</strong>, mas este convite é para <strong>{info.email}</strong>.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => { await supabase.auth.signOut(); }}
            >
              Trocar de conta
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex bg-muted rounded-md p-1 text-sm">
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`flex-1 py-1.5 rounded-sm transition-colors ${mode === "signup" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
              >
                Criar conta
              </button>
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`flex-1 py-1.5 rounded-sm transition-colors ${mode === "login" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
              >
                Já tenho conta
              </button>
            </div>

            <Button type="button" variant="outline" className="w-full" onClick={onGoogle} disabled={busy}>
              Continuar com Google
            </Button>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">ou com senha</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <form onSubmit={submitAuth} className="space-y-3">
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={info.email} disabled readOnly />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={forgotPassword}
                      className="text-xs text-primary hover:underline"
                      disabled={busy}
                    >
                      Esqueci minha senha
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder={mode === "signup" ? "Crie uma senha (mín. 6 caracteres)" : "Sua senha"}
                />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={busy}>
                {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Aguarde...</> : mode === "signup" ? "Criar conta e entrar" : "Entrar"}
              </Button>
            </form>

            <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
              Ao continuar, você entra automaticamente na empresa <strong>{info.company_name}</strong>.
            </p>
          </div>
        )}
      </Card>
      <Toaster richColors position="top-right" />
    </div>
  );
}
