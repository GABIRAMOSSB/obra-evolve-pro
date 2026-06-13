import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, FileText, Package, HardHat, Wrench, Users, Database, LogOut, PenTool, Settings, Building2, Radar, Sparkles, BookOpen, FileSignature, Wallet, ShieldCheck, ClipboardList, FilePlus2, TrendingUp, NotebookPen, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useCompany } from "@/hooks/use-company";

const NAV_ITEMS: { to: string; icon: typeof HardHat; label: string; exact?: boolean }[] = [
  { to: "/", icon: BarChart3, label: "Visão", exact: true },
  { to: "/automacoes", icon: Bot, label: "IA" },
  { to: "/obras", icon: Building2, label: "Obras" },
  { to: "/oportunidades", icon: Radar, label: "Radar PNCP" },
  { to: "/editais", icon: Sparkles, label: "Editais IA" },
  { to: "/propostas", icon: Sparkles, label: "Propostas IA" },
  { to: "/biblioteca", icon: BookOpen, label: "Biblioteca" },
  { to: "/contratos", icon: FileSignature, label: "Contratos" },
  { to: "/aditivos", icon: FilePlus2, label: "Aditivos" },
  { to: "/reajustes", icon: TrendingUp, label: "Reajustes" },
  { to: "/indices", icon: TrendingUp, label: "Índices" },
  { to: "/medicoes", icon: ClipboardList, label: "Medições" },
  { to: "/rdo", icon: NotebookPen, label: "RDO" },
  { to: "/financeiro", icon: Wallet, label: "Financeiro" },
  { to: "/realizado", icon: BarChart3, label: "Realizado" },
  { to: "/notas-fiscais", icon: FileText, label: "Notas" },
  { to: "/estoque", icon: Package, label: "Estoque" },
  { to: "/assinaturas", icon: PenTool, label: "Assinaturas" },
  { to: "/compliance", icon: ShieldCheck, label: "Certidões" },
  { to: "/mao-de-obra", icon: HardHat, label: "Mão obra" },
  { to: "/equipamentos", icon: Wrench, label: "Equip." },
  { to: "/insumos", icon: Package, label: "Insumos" },
  { to: "/composicoes", icon: Package, label: "Comp." },
  { to: "/equipe", icon: Users, label: "Equipe" },
  { to: "/backup", icon: Database, label: "Backup" },
  { to: "/configuracoes/zapsign", icon: Settings, label: "ZapSign" },
];



export function AppTopbar() {
  const { user, signOut } = useAuth();
  const { company } = useCompany();
  const userEmail = user?.email ?? "";
  const companyName = company?.name ?? "";
  const isAdmin = company?.role === "admin" || company?.role === "editor";

  return (
    <header className="sticky top-0 z-40 bg-gradient-sidebar text-sidebar-foreground border-b border-sidebar-border/60 shadow-[0_16px_40px_-34px_oklch(0.19_0.01_230_/_0.7)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-glow/60 to-transparent pointer-events-none" />
      <div className="flex items-center gap-3 px-4 h-[60px]">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 pr-2">
          <div className="w-8 h-8 rounded-md bg-gradient-primary flex items-center justify-center shadow-glow ring-1 ring-white/10">
            <HardHat className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="hidden sm:block min-w-0">
            <div className="font-display font-bold text-[13px] leading-tight tracking-tight">SOLV Gestão</div>
            <div className="text-[9px] uppercase tracking-[0.18em] text-primary-glow/75 truncate max-w-[140px]">{companyName || "controle executivo"}</div>
          </div>
        </Link>

        {/* Nav (scroll horizontal em telas estreitas) */}
        <nav className="flex-1 min-w-0 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </div>
        </nav>

        {/* User */}
        <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-sidebar-border/40">
          <div className="w-7 h-7 rounded-full bg-gradient-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground shadow-sm">
            {(userEmail || "U").slice(0, 1).toUpperCase()}
          </div>
          <div className="hidden md:block min-w-0 max-w-[160px]">
            <div className="text-[11px] font-medium truncate">{userEmail}</div>
            <div className="text-[9px] text-sidebar-foreground/50 truncate uppercase tracking-wider">{isAdmin ? "Administrador" : "Leitor"}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { void signOut(); }}
          className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-white/[0.06]"
            title="Sair"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function NavItem({
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
      className={`group relative flex items-center gap-1 px-2.5 h-9 rounded-md text-[11px] font-medium whitespace-nowrap transition-all duration-200 ${
        active
          ? "bg-white/[0.075] text-sidebar-foreground"
          : "text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-white/[0.045]"
      }`}

    >
      <Icon
        className={`w-3.5 h-3.5 shrink-0 transition-colors ${
          active ? "text-primary-glow" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"
        }`}
      />
      <span>{label}</span>
      {active && (
        <span className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-gradient-to-r from-primary-glow to-primary shadow-[0_0_10px_oklch(0.79_0.11_152_/_0.55)]" />
      )}
    </Link>
  );
}
