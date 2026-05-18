import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Mail, Users, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/invite/$token")({
  component: InvitePage,
});

interface InviteInfo {
  company_id: string;
  company_name: string;
  email: string;
  role: "admin" | "member";
  expires_at: string;
  accepted: boolean;
}

function InvitePage() {
  const { token } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("get_invite_info", { _token: token });
      if (error) {
        setError("Convite inválido");
      } else if (!data || (data as unknown[]).length === 0) {
        setError("Convite não encontrado");
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = (data as any[])[0];
        setInfo({
          company_id: row.company_id,
          company_name: row.company_name,
          email: row.email,
          role: row.role,
          expires_at: row.expires_at,
          accepted: row.accepted,
        });
      }
      setLoading(false);
    })();
  }, [token]);

  async function accept() {
    if (!user) {
      navigate({ to: "/login", search: { redirect: `/invite/${token}` } as never });
      return;
    }
    if (info && user.email && user.email.toLowerCase() !== info.email.toLowerCase()) {
      toast.error(`Este convite é para ${info.email}. Faça login com esse e-mail.`);
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("accept_company_invite", { _token: token });
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Você entrou na empresa!");
      navigate({ to: "/" });
    }
  }

  if (loading || authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Carregando...</div>;
  }

  if (error || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <XCircle className="w-12 h-12 mx-auto text-destructive" />
          <h1 className="text-xl font-bold">Convite inválido</h1>
          <p className="text-sm text-muted-foreground">{error ?? "Não foi possível carregar esse convite."}</p>
          <Button asChild><Link to="/">Ir para o app</Link></Button>
        </Card>
      </div>
    );
  }

  const expired = new Date(info.expires_at) < new Date();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="max-w-md w-full p-8 space-y-5">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
          <Users className="w-7 h-7" />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold">Convite para {info.company_name}</h1>
          <p className="text-sm text-muted-foreground">
            Você foi convidado como <strong>{info.role === "admin" ? "Admin" : "Membro"}</strong>.
          </p>
        </div>
        <div className="text-sm bg-muted rounded-md p-3 flex items-center gap-2">
          <Mail className="w-4 h-4 text-muted-foreground" />
          <span>Para o e-mail <strong>{info.email}</strong></span>
        </div>

        {info.accepted ? (
          <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" /> Este convite já foi aceito.
          </div>
        ) : expired ? (
          <div className="text-center text-sm text-destructive">Este convite expirou.</div>
        ) : !user ? (
          <div className="space-y-2">
            <p className="text-xs text-center text-muted-foreground">
              Faça login (ou cadastre-se) com o e-mail <strong>{info.email}</strong> para entrar.
            </p>
            <Button className="w-full" onClick={() => navigate({ to: "/login", search: { redirect: `/invite/${token}` } as never })}>
              Entrar / Cadastrar
            </Button>
          </div>
        ) : user.email?.toLowerCase() !== info.email.toLowerCase() ? (
          <div className="space-y-2">
            <p className="text-xs text-center text-destructive">
              Você está logado como {user.email}, mas este convite é para {info.email}.
            </p>
            <Button variant="outline" className="w-full" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login", search: { redirect: `/invite/${token}` } as never }); }}>
              Trocar de conta
            </Button>
          </div>
        ) : (
          <Button className="w-full" onClick={accept} disabled={busy}>
            Aceitar e entrar na empresa
          </Button>
        )}
      </Card>
    </div>
  );
}
