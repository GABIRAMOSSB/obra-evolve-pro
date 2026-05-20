import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCompany } from "@/hooks/use-company";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Copy, Trash2, UserPlus, LogOut, Shield, Users } from "lucide-react";

export const Route = createFileRoute("/equipe")({
  component: EquipePage,
});

type Role = "admin" | "editor" | "member";

interface Member {
  user_id: string;
  role: Role;
  joined_at: string;
  email: string | null;
}

interface Invite {
  id: string;
  email: string;
  role: Role;
  token: string;
  created_at: string;
  expires_at: string;
}

function EquipePage() {
  const { user, loading: authLoading } = useAuth();
  const { company, loading: companyLoading, refresh: refreshCompany } = useCompany();
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busy, setBusy] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("member");
  const [editingName, setEditingName] = useState(false);
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (company) setCompanyName(company.name);
  }, [company]);

  const reload = useCallback(async () => {
    if (!company) return;
    const { data: m } = await supabase
      .from("company_members")
      .select("user_id, role, joined_at")
      .eq("company_id", company.id);

    const { data: emails } = await supabase
      .rpc("get_company_member_emails", { _company: company.id });
    const emailMap = new Map<string, string>(
      (emails ?? []).map((e: { user_id: string; email: string }) => [e.user_id, e.email]),
    );

    const memberList: Member[] = (m ?? []).map((x) => ({
      user_id: x.user_id,
      role: x.role as Role,
      joined_at: x.joined_at,
      email: emailMap.get(x.user_id) ?? null,
    }));
    setMembers(memberList);

    if (company.role === "admin") {
      const { data: inv } = await supabase
        .from("company_invites")
        .select("id, email, role, token, created_at, expires_at")
        .eq("company_id", company.id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      setInvites(
        (inv ?? []).map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role as Role,
          token: i.token,
          created_at: i.created_at,
          expires_at: i.expires_at,
        })),
      );
    }
  }, [company]);

  useEffect(() => {
    if (company) reload();
  }, [company, reload]);

  if (authLoading || companyLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Carregando...</div>;
  }
  if (!user || !company) return null;

  const isAdmin = company.role === "admin";
  const adminCount = members.filter((m) => m.role === "admin").length;
  const isLastAdmin = isAdmin && adminCount === 1;

  async function saveName() {
    if (!company || !companyName.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from("companies")
      .update({ name: companyName.trim() })
      .eq("id", company.id);
    setBusy(false);
    if (error) {
      toast.error("Falha ao salvar");
    } else {
      toast.success("Nome atualizado");
      setEditingName(false);
      refreshCompany();
    }
  }

  async function sendInvite() {
    if (!company || !user) return;
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("Informe um e-mail válido");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("company_invites").insert({
      company_id: company.id,
      email,
      role: newRole,
      invited_by: user.id,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Convite criado. Compartilhe o link com a pessoa.");
      setNewEmail("");
      setNewRole("member");
      reload();
    }
  }

  async function cancelInvite(id: string) {
    setBusy(true);
    await supabase.from("company_invites").delete().eq("id", id);
    setBusy(false);
    reload();
  }

  async function copyInviteLink(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.message(url);
    }
  }

  async function changeRole(userId: string, role: Role) {
    if (!company) return;
    setBusy(true);
    const { error } = await supabase
      .from("company_members")
      .update({ role })
      .eq("company_id", company.id)
      .eq("user_id", userId);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Papel atualizado");
      reload();
    }
  }

  async function removeMember(userId: string) {
    if (!company) return;
    if (!confirm("Remover este membro da empresa?")) return;
    setBusy(true);
    const { error } = await supabase
      .from("company_members")
      .delete()
      .eq("company_id", company.id)
      .eq("user_id", userId);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Membro removido");
      reload();
    }
  }

  async function leaveCompany() {
    if (!company || !user) return;
    if (isLastAdmin) {
      toast.error("Promova outro membro a admin antes de sair");
      return;
    }
    if (!confirm("Tem certeza que quer sair desta empresa?")) return;
    setBusy(true);
    await supabase.from("company_members").delete().eq("user_id", user.id);
    setBusy(false);
    toast.success("Você saiu da empresa");
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" /> Obras</Link>
          </Button>
          <div className="text-xs text-muted-foreground">{user.email}</div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" /> Equipe
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Todos os membros da empresa veem e editam as mesmas obras e diários.
          </p>
        </div>

        <Card className="p-5 space-y-3">
          <Label className="text-xs uppercase text-muted-foreground">Empresa</Label>
          {editingName && isAdmin ? (
            <div className="flex gap-2">
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              <Button onClick={saveName} disabled={busy}>Salvar</Button>
              <Button variant="ghost" onClick={() => { setCompanyName(company.name); setEditingName(false); }}>Cancelar</Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">{company.name}</div>
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => setEditingName(true)}>Renomear</Button>
              )}
            </div>
          )}
        </Card>

        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Membros ({members.length})</h2>
          </div>
          <div className="divide-y">
            {members.map((m) => (
              <div key={m.user_id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                    {m.user_id.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {m.email ?? m.user_id.slice(0, 8)}
                      {m.user_id === user.id ? " (você)" : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Desde {new Date(m.joined_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && m.user_id !== user.id ? (
                    <Select value={m.role} onValueChange={(v) => changeRole(m.user_id, v as Role)}>
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="member">Membro</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={m.role === "admin" ? "default" : "secondary"}>
                      {m.role === "admin" ? <><Shield className="w-3 h-3 mr-1" /> Admin</> : m.role === "editor" ? "Editor" : "Membro"}
                    </Badge>
                  )}
                  {isAdmin && m.user_id !== user.id && (
                    <Button variant="ghost" size="sm" onClick={() => removeMember(m.user_id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {isAdmin && (
          <Card className="p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Convidar pessoa
            </h2>
            <div className="grid sm:grid-cols-[1fr,140px,auto] gap-2">
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
              <Select value={newRole} onValueChange={(v) => setNewRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membro (somente leitura)</SelectItem>
                  <SelectItem value="editor">Editor (edita conteúdo)</SelectItem>
                  <SelectItem value="admin">Admin (edita e gerencia equipe)</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={sendInvite} disabled={busy}>Convidar</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              O convite gera um link único — compartilhe com a pessoa para ela entrar na empresa.
            </p>

            {invites.length > 0 && (
              <div className="border-t pt-4 space-y-2">
                <div className="text-xs uppercase text-muted-foreground">Convites pendentes</div>
                {invites.map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-2 text-sm border rounded-md p-2">
                    <div className="min-w-0">
                      <div className="truncate">{i.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {i.role === "admin" ? "Admin" : i.role === "editor" ? "Editor" : "Membro"} • expira em {new Date(i.expires_at).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => copyInviteLink(i.token)}>
                        <Copy className="w-3.5 h-3.5 mr-1" /> Copiar link
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => cancelInvite(i.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {!isLastAdmin && (
          <Card className="p-5">
            <Button variant="outline" onClick={leaveCompany} className="w-full">
              <LogOut className="w-4 h-4 mr-1" /> Sair da empresa
            </Button>
          </Card>
        )}
      </main>
    </div>
  );
}
