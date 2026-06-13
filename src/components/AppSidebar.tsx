import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3, FileText, Package, HardHat, Wrench, Users, Database, LogOut,
  Calculator, FolderTree, PenTool, ShieldCheck, Building2, Radar, Library,
  FileSignature, FileEdit, Wallet, ClipboardList, NotebookPen, FilePlus2,
  TrendingUp, LineChart, Calendar, KeyRound, FolderKanban, Globe2,
  ChevronDown, Gavel, Hammer, Briefcase, Landmark, Boxes, ShieldAlert, Settings2, Bot,
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
      { to: "/automacoes", icon: Bot, label: "IA e Automacoes" },
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
    <aside className="hidden lg:flex flex-col w-[264px] shrink-0 bg-gradient-sidebar text-sidebar-foreground sticky top-0 h-screen border-r border-sidebar-border/60 relative overflow-hidden shadow-[18px_0_48px_-38px_oklch(0.19_0.01_230_/_0.55)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-glow/60 to-transparent" />
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,oklch(1_0_0_/_0.035)_1px,transparent_1px),linear-gradient(180deg,oklch(1_0_0_/_0.025)_1px,transparent_1px)] bg-[size:28px_28px]" />

      <div className="relative px-5 pt-5 pb-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow ring-1 ring-white/10">
          <HardHat className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <div className="font-display font-bold text-[15px] leading-tight tracking-tight">SOLV Gestão</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-primary-glow/75 truncate">{companyName || "controle executivo"}</div>
        </div>
      </div>

      <div className="relative mx-3 mb-2 rounded-lg border border-sidebar-border/50 bg-sidebar-accent/20 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/50">Workspace</span>
          <span className="h-1.5 w-1.5 rounded-full bg-primary-glow shadow-[0_0_10px_oklch(0.79_0.11_152_/_0.7)]" />
        </div>
        <div className="mt-1 text-xs font-medium truncate">{companyName || "Empresa ativa"}</div>
      </div>

      <div className="relative px-3 mt-1 flex-1 overflow-y-auto pb-4">
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
                  className={`w-full group flex items-center gap-3 px-3 py-2 rounded-md text-[10px] font-semibold uppercase tracking-[0.16em] transition-all ${
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
      className={`group relative flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-all duration-200 ${
        active
          ? "bg-white/[0.075] text-sidebar-foreground shadow-[inset_0_1px_0_oklch(1_0_0_/_0.08),0_8px_22px_-18px_oklch(0.79_0.11_152_/_0.65)]"
          : "text-sidebar-foreground/64 hover:text-sidebar-foreground hover:bg-white/[0.045]"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-gradient-to-b from-primary-glow to-primary shadow-[0_0_12px_oklch(0.79_0.11_152_/_0.55)]" />
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
