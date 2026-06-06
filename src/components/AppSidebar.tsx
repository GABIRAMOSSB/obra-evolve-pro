import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, FileText, Package, HardHat, Wrench, Users, Database, LogOut, Calculator, FolderTree, PenTool, ShieldCheck, Building2, Radar, Library, FileSignature, FileEdit, Wallet, ClipboardList, NotebookPen, FilePlus2, TrendingUp, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useCompany } from "@/hooks/use-company";

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const { company } = useCompany();
  const userEmail = user?.email ?? "";
  const companyName = company?.name ?? "";
  const isAdmin = company?.role === "admin" || company?.role === "editor";

  return (
    <aside className="hidden lg:flex flex-col w-[240px] shrink-0 bg-gradient-sidebar text-sidebar-foreground sticky top-0 h-screen border-r border-sidebar-border/40 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-glow/50 to-transparent" />
      <div className="absolute -top-32 -left-20 w-64 h-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-64 h-64 rounded-full bg-primary-glow/15 blur-3xl pointer-events-none" />

      <div className="relative px-5 pt-6 pb-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
          <HardHat className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <div className="font-display font-bold text-[15px] leading-tight tracking-tight">SOLV Gestão</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/50 truncate">{companyName}</div>
        </div>
      </div>

      <div className="relative px-3 mt-2 flex-1 overflow-y-auto">
        <SidebarLink to="/" icon={BarChart3} label="Visão geral" exact />

        <SectionLabel>Licitações</SectionLabel>
        <SidebarLink to="/oportunidades" icon={Radar} label="Radar PNCP" />
        <SidebarLink to="/editais" icon={FileText} label="Editais (IA)" />
        <SidebarLink to="/propostas" icon={FileEdit} label="Propostas (IA)" />
        <SidebarLink to="/biblioteca" icon={Library} label="Biblioteca Técnica" />

        <SectionLabel>Execução de Obra</SectionLabel>
        <SidebarLink to="/obras" icon={Building2} label="Obras" />
        <SidebarLink to="/medicoes" icon={ClipboardList} label="Medições (BM)" />
        <SidebarLink to="/rdo" icon={NotebookPen} label="RDO" />
        <SidebarLink to="/cronogramas" icon={Calendar} label="Cronograma / Curva S" />
        <SidebarLink to="/realizado" icon={TrendingUp} label="Previsto × Realizado" />
        <SidebarLink to="/comparativo-composicao" icon={Calculator} label="Comparativo Composição" />

        <SectionLabel>Contratos</SectionLabel>
        <SidebarLink to="/contratos" icon={FileSignature} label="Contratos" />
        <SidebarLink to="/aditivos" icon={FilePlus2} label="Aditivos" />
        <SidebarLink to="/reajustes" icon={TrendingUp} label="Reajustes" />
        <SidebarLink to="/indices" icon={LineChart} label="Índices Econômicos" />
        <SidebarLink to="/assinaturas" icon={PenTool} label="Assinaturas" />

        <SectionLabel>Financeiro</SectionLabel>
        <SidebarLink to="/financeiro" icon={Wallet} label="Financeiro de Obra" />
        <SidebarLink to="/notas-fiscais" icon={FileText} label="Notas Fiscais" />
        <SidebarLink to="/estoque" icon={Package} label="Estoque" />

        <SectionLabel>Recursos</SectionLabel>
        <SidebarLink to="/mao-de-obra" icon={HardHat} label="Mão de obra" />
        <SidebarLink to="/equipamentos" icon={Wrench} label="Equipamentos" />
        <SidebarLink to="/insumos" icon={Package} label="Insumos" />
        <SidebarLink to="/composicoes" icon={Package} label="Composições" />
        <SidebarLink to="/centros-custo" icon={FolderTree} label="Centros de Custo" />

        <SectionLabel>Governança</SectionLabel>
        <SidebarLink to="/compliance" icon={ShieldCheck} label="Central de Certidões" />

        <SectionLabel>Administração</SectionLabel>
        <SidebarLink to="/equipe" icon={Users} label="Equipe" />
        <SidebarLink to="/parametros-financeiros" icon={Calculator} label="Parâmetros Financeiros" />
        <SidebarLink to="/backup" icon={Database} label="Backup" />
        <SidebarLink to="/configuracoes/zapsign" icon={PenTool} label="Config. ZapSign" />
      </div>

      <div className="relative px-3 py-3 border-t border-sidebar-border/40 bg-sidebar/40">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-[11px] font-bold text-primary-foreground shadow-sm shrink-0">
            {(userEmail || "U").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium truncate">{userEmail}</div>
            <div className="text-[10px] text-sidebar-foreground/50 truncate uppercase tracking-wider">{isAdmin ? "Administrador" : "Leitor"}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { void signOut(); }}
            className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/30"
            title="Sair"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({
  to,
  icon: Icon,
  label,
  exact,
}: {
  to: string;
  icon: typeof HardHat;
  label: string;
  exact?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
  return (
    <Link
      to={to}
      className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 ${
        active
          ? "bg-sidebar-accent/40 text-sidebar-foreground shadow-[inset_0_1px_0_oklch(1_0_0_/_0.06)]"
          : "text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/20"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-gradient-to-b from-primary-glow to-primary shadow-[0_0_12px_oklch(0.65_0.22_285_/_0.6)]" />
      )}
      <Icon
        className={`w-4 h-4 shrink-0 transition-colors ${
          active ? "text-primary-glow" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"
        }`}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="px-3 pt-5 pb-1 text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/40">{children}</div>;
}
