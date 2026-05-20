import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { KeyRound, Loader2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase coloca o token no hash da URL (#access_token=...&type=recovery)
    // O cliente já processa automaticamente; só esperamos a sessão.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Caso o evento já tenha rolado antes do listener:
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (password.length < 6) {
      toast.error("Senha precisa de pelo menos 6 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      setDone(true);
      toast.success("Senha atualizada");
      setTimeout(() => navigate({ to: "/" }), 1500);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-muted/40 to-background">
      <Card className="max-w-md w-full p-8 space-y-6 shadow-lg">
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold">Definir nova senha</h1>
          <p className="text-sm text-muted-foreground">
            Escolha uma nova senha para acessar sua conta.
          </p>
        </div>

        {done ? (
          <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2 py-4">
            <CheckCircle2 className="w-4 h-4 text-primary" /> Senha atualizada. Redirecionando...
          </div>
        ) : !ready ? (
          <div className="text-center text-sm text-muted-foreground py-6">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
            Validando link de recuperação...
            <p className="text-xs mt-3">
              Se demorar, o link pode ter expirado.{" "}
              <Link to="/login" className="text-primary underline">Voltar ao login</Link>
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <Label htmlFor="pwd">Nova senha</Label>
              <Input
                id="pwd"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <Label htmlFor="pwd2">Confirmar senha</Label>
              <Input
                id="pwd2"
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : "Salvar nova senha"}
            </Button>
          </form>
        )}
      </Card>
      <Toaster richColors position="top-right" />
    </div>
  );
}
