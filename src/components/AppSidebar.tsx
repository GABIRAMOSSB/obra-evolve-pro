import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3, FileText, Package, HardHat, Wrench, Users, Database, LogOut,
  Calculator, FolderTree, PenTool, ShieldCheck, Building2, Radar, Library,
  FileSignature, FileEdit, Wallet, ClipboardList, NotebookPen, FilePlus2,
  TrendingUp, LineChart, Calendar, KeyRound, FolderKanban, Globe2,
  ChevronDown, Gavel, Hammer, Briefcase, Landmark, Boxes, ShieldAlert, Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useCompany } from "@/hooks/use-company";

type NavItem = { to: string; icon: typeof HardHat; label: string };
type NavSection = { id: string; label: string; icon: typeof HardHat; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    id: "licitacoes", label: "Licitações", icon: Gavel,
    items: [
      { to: "/oportunidades", icon: Radar, label: "Radar PNCP" },
      { to: "/editais", icon: FileText, label: "Editais (IA)" },
      { to: "/propostas", icon: FileEdit, label: "Propostas (IA)" },
      { to: "/portais", icon: Globe2, label: "Portais de Licitação" },
      { to: "/biblioteca", icon: Library, label: "Biblioteca Técnica" },
    ],
  },
  {
    id: "obra", label: "Execução de Obra", icon: Hammer,
    items: [
      { to: "/obras", icon: Building2, label: "Obras" },
      { to: "/medicoes", icon: ClipboardList, label: "Medições (BM)" },
      { to: "/rdo", icon: NotebookPen, label: "RDO" },
      { to: "/cronogramas", icon: Calendar, label: "Cronograma / Curva S" },
      { to: "/realizado", icon: TrendingUp, label: "Previsto × Realizado" },
      { to: "/comparativo-composicao", icon: Calculator, label: "Comparativo Composição" },
    ],
  },
  {
    id: "contratos", label: "Contratos", icon: Briefcase,
    items: [
      { to: "/contratos", icon: FileSignature, label: "Contratos" },
      { to: "/aditivos", icon: FilePlus2, label: "Aditivos" },
      { to: "/reajustes", icon: TrendingUp, label: "Reajustes" },
      { to: "/indices", icon: LineChart, label: "Índices Econômicos" },
      { to: "/assinaturas", icon: PenTool, label: "Assinaturas" },
    ],
  },
  {
    id: "financeiro", label: "Financeiro", icon: Landmark,
    items: [
      { to: "/financeiro", icon: Wallet, label: "Financeiro de Obra" },
      { to: "/notas-fiscais", icon: FileText, label: "Notas Fiscais" },
      { to: "/estoque", icon: Package, label: "Estoque" },
    ],
  },
  {
    id: "recursos", label: "Recursos", icon: Boxes,
    items: [
      { to: "/mao-de-obra", icon: HardHat, label: "Mão de obra" },
      { to: "/equipamentos", icon: Wrench, label: "Equipamentos" },
      { to: "/insumos", icon: Package, label: "Insumos" },
      { to: "/composicoes", icon: Package, label: "Composições" },
      { to: "/centros-custo", icon: FolderTree, label: "Centros de Custo" },
    ],
  },
  {
    id: "governanca", label: "Governança", icon: ShieldAlert,
    items: [
      { to: "/compliance", icon: ShieldCheck, label: "Central de Certidões" },
      { to: "/poderes", icon: KeyRound, label: "Matriz de Poderes" },
      { to: "/declaracoes", icon: FileSignature, label: "Declarações" },
      { to: "/dossies", icon: FolderKanban, label: "Dossiês e Templates" },
    ],
  },
  {
    id: "admin", label: "Administração", icon: Settings2,
    items: [
      { to: "/equipe", icon: Users, label: "Equipe" },
      { to: "/parametros-financeiros", icon: Calculator, label: "Parâmetros Financeiros" },
      { to: "/backup", icon: Database, label: "Backup" },
      { to: "/configuracoes/zapsign", icon: PenTool, label: "Config. ZapSign" },
    ],
  },
];

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const { company } = useCompany();
  const userEmail = user?.email ?? "";
  const companyName = company?.name ?? "";
  const isAdmin = company?.role === "admin" || company?.role === "editor";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const activeSection = SECTIONS.find((s) =>
    s.items.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`))
  )?.id;

  const [openId, setOpenId] = useState<string | null>(activeSection ?? "licitacoes");

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

      <div className="relative px-3 mt-2 flex-1 overflow-y-auto pb-4">
        <SidebarLink to="/" icon={BarChart3} label="Visão geral" exact pathname={pathname} />

        <div className="mt-3 space-y-0.5">
          {SECTIONS.map((section) => {
            const isOpen = openId === section.id;
            const hasActive = section.items.some(
              (i) => pathname === i.to || pathname.startsWith(`${i.to}/`)
            );
            return (
              <div key={section.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : section.id)}
                  className={`w-full group flex items-center gap-3 px-3 py-2 rounded-lg text-[11px] font-semibold uppercase tracking-[0.14em] transition-all ${
                    hasActive
                      ? "text-sidebar-foreground"
                      : "text-sidebar-foreground/55 hover:text-sidebar-foreground/85"
                  }`}
                >
                  <section.icon className={`w-3.5 h-3.5 shrink-0 ${hasActive ? "text-primary-glow" : "text-sidebar-foreground/45"}`} />
                  <span className="flex-1 text-left truncate">{section.label}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}
                  />
                </button>
                {isOpen && (
                  <div className="pl-2 pb-1 space-y-0.5">
                    {section.items.map((item) => (
                      <SidebarLink key={item.to} {...item} pathname={pathname} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
  pathname,
}: {
  to: string;
  icon: typeof HardHat;
  label: string;
  exact?: boolean;
  pathname: string;
}) {
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
