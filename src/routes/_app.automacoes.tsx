import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Activity,
  BellRing,
  Bot,
  CheckCircle2,
  Cpu,
  FileSearch,
  FileSignature,
  Gauge,
  Play,
  Radar,
  RefreshCw,
  Route as RouteIcon,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  generateAutomationPlan,
  getAutomationSnapshot,
  type AutomationSnapshot,
} from "@/lib/automacoes.functions";

export const Route = createFileRoute("/_app/automacoes")({
  component: AutomacoesPage,
  head: () => ({
    meta: [
      { title: "IA e Automacoes - SOLV Gestao" },
      {
        name: "description",
        content: "Central de inteligencia, automacoes e integracoes do SOLV Gestao.",
      },
    ],
  }),
});

type AutomationStatus = "online" | "manual" | "ready";
type Automation = {
  id: string;
  title: string;
  area: string;
  status: AutomationStatus;
  score: number;
  route: string;
  icon: typeof Bot;
  impact: string;
  nextAction: string;
};

const AUTOMATIONS: Automation[] = [
  {
    id: "pncp",
    title: "Radar PNCP com triagem inteligente",
    area: "Licitacoes",
    status: "online",
    score: 86,
    route: "/oportunidades",
    icon: Radar,
    impact: "Busca oportunidades, organiza pipeline e reduz trabalho manual de captura.",
    nextAction: "Adicionar ranking automatico por aderencia da empresa.",
  },
  {
    id: "editais",
    title: "Analise de editais e sugestao de atestados",
    area: "Propostas",
    status: "online",
    score: 78,
    route: "/biblioteca",
    icon: FileSearch,
    impact: "Cruza editais com biblioteca tecnica para acelerar qualificacao.",
    nextAction: "Plugar leitura semantica de PDF e matriz de risco por clausula.",
  },
  {
    id: "zapsign",
    title: "Assinaturas digitais com eventos em tempo real",
    area: "Contratos",
    status: "online",
    score: 82,
    route: "/assinaturas",
    icon: FileSignature,
    impact: "Envia documentos, recebe webhooks e notifica mudancas de assinatura.",
    nextAction: "Criar cobranca automatica por prazo e signatario atrasado.",
  },
  {
    id: "compliance",
    title: "Central de certidoes e alertas",
    area: "Governanca",
    status: "online",
    score: 74,
    route: "/compliance",
    icon: ShieldCheck,
    impact: "Monitora validade, historico e alertas de conformidade.",
    nextAction: "Ativar robos de renovacao e score de risco por obra/contrato.",
  },
  {
    id: "nfe",
    title: "NF-e com apropriacao automatizada",
    area: "Financeiro",
    status: "ready",
    score: 68,
    route: "/notas-fiscais",
    icon: Cpu,
    impact: "Relaciona notas, itens, obras, composicoes e centros de custo.",
    nextAction: "Sugerir rateio por historico de compras e composicoes usadas.",
  },
  {
    id: "rdo",
    title: "RDO com fotos, evidencias e resumo operacional",
    area: "Execucao",
    status: "manual",
    score: 61,
    route: "/rdo",
    icon: Activity,
    impact: "Concentra diarios, fotos de campo e acompanhamento da execucao.",
    nextAction: "Gerar resumo diario automatico com pendencias e riscos.",
  },
];

const STATUS_LABEL: Record<AutomationStatus, string> = {
  online: "Ativo",
  ready: "Pronto para API",
  manual: "Manual assistido",
};

const STATUS_CLASS: Record<AutomationStatus, string> = {
  online: "border-primary/30 bg-primary/10 text-primary",
  ready: "border-blue-500/30 bg-blue-500/10 text-blue-500",
  manual: "border-amber-500/30 bg-amber-500/10 text-amber-600",
};

function AutomacoesPage() {
  const [selected, setSelected] = useState<string>("pncp");
  const [foco, setFoco] = useState<"licitacoes" | "obra" | "financeiro" | "governanca" | "geral">("geral");
  const [objetivo, setObjetivo] = useState("");

  const snapshotFn = useServerFn(getAutomationSnapshot);
  const planFn = useServerFn(generateAutomationPlan);
  const snapshotQ = useQuery({
    queryKey: ["automation-snapshot"],
    queryFn: () => snapshotFn(),
  });
  const planMut = useMutation({
    mutationFn: () => planFn({ data: { foco, objetivo: objetivo.trim() || undefined } }),
  });

  const selectedAutomation = AUTOMATIONS.find((item) => item.id === selected) ?? AUTOMATIONS[0];
  const avgScore = useMemo(
    () => Math.round(AUTOMATIONS.reduce((sum, item) => sum + item.score, 0) / AUTOMATIONS.length),
    [],
  );
  const onlineCount = AUTOMATIONS.filter((item) => item.status === "online").length;
  const readyCount = AUTOMATIONS.filter((item) => item.status === "ready").length;
  const manualCount = AUTOMATIONS.filter((item) => item.status === "manual").length;

  async function runDiagnostic() {
    await snapshotQ.refetch();
  }

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
      <section className="relative overflow-hidden rounded-lg border border-border/70 bg-card/75 shadow-[var(--shadow-card)]">
        <div className="absolute inset-0 opacity-[0.045] pointer-events-none bg-[linear-gradient(90deg,var(--foreground)_1px,transparent_1px),linear-gradient(180deg,var(--foreground)_1px,transparent_1px)] bg-[size:30px_30px]" />
        <div className="relative p-5 sm:p-7 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-md border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              <Sparkles className="w-3.5 h-3.5" />
              Centro inteligente
            </div>
            <h1 className="mt-4 font-display text-3xl sm:text-4xl font-bold tracking-tight">
              IA e automacoes operacionais
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
              Painel para coordenar APIs, webhooks, alertas, analises assistidas e proximas automacoes do SOLV Gestao.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-full xl:min-w-[520px]">
            <Metric label="Score" value={`${avgScore}%`} icon={Gauge} />
            <Metric label="Ativas" value={String(onlineCount)} icon={CheckCircle2} />
            <Metric label="API ready" value={String(readyCount)} icon={Zap} />
            <Metric label="Assistidas" value={String(manualCount)} icon={Bot} />
          </div>
        </div>
      </section>

      <Tabs defaultValue="mapa" className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <TabsList className="w-full md:w-auto justify-start overflow-x-auto">
            <TabsTrigger value="mapa">Mapa</TabsTrigger>
            <TabsTrigger value="diagnostico">Diagnostico</TabsTrigger>
            <TabsTrigger value="apis">APIs</TabsTrigger>
          </TabsList>
          <Button onClick={() => void runDiagnostic()} disabled={snapshotQ.isFetching} className="gap-2">
            {snapshotQ.isFetching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Rodar diagnostico
          </Button>
        </div>

        <TabsContent value="mapa" className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AUTOMATIONS.map((item) => (
                <AutomationCard
                  key={item.id}
                  item={item}
                  active={selected === item.id}
                  onSelect={() => setSelected(item.id)}
                />
              ))}
            </div>
            <Card className="glass-card p-5 border-border/70 h-fit">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Prioridade selecionada</div>
                  <h2 className="mt-2 text-xl font-display font-bold leading-tight">{selectedAutomation.title}</h2>
                </div>
                <selectedAutomation.icon className="w-6 h-6 text-primary shrink-0" />
              </div>
              <div className="mt-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-muted-foreground">Maturidade</span>
                    <span className="font-semibold">{selectedAutomation.score}%</span>
                  </div>
                  <Progress value={selectedAutomation.score} className="h-2" />
                </div>
                <div className="rounded-md border border-border/70 bg-background/70 p-3">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Impacto</div>
                  <p className="mt-1 text-sm">{selectedAutomation.impact}</p>
                </div>
                <div className="rounded-md border border-primary/25 bg-primary/10 p-3">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Proxima automacao</div>
                  <p className="mt-1 text-sm font-medium">{selectedAutomation.nextAction}</p>
                </div>
                <Button asChild variant="outline" className="w-full bg-background/60">
                  <Link to={selectedAutomation.route}>
                    <RouteIcon className="w-4 h-4 mr-2" />
                    Abrir modulo
                  </Link>
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="diagnostico">
          <Card className="glass-card p-5 border-border/70">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-xl font-display font-bold">Diagnostico operacional</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Varredura de pontos onde IA, regras e webhooks podem reduzir trabalho repetitivo.
                </p>
              </div>
              <Badge variant="outline" className="w-fit">
                {snapshotQ.data ? `Ultima execucao: ${formatDateTime(snapshotQ.data.generatedAt)}` : "Aguardando execucao"}
              </Badge>
            </div>
            {snapshotQ.error && (
              <div className="mt-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {(snapshotQ.error as Error).message}
              </div>
            )}
            <SnapshotPanel snapshot={snapshotQ.data} loading={snapshotQ.isLoading} />
            <div className="mt-5 space-y-2">
              {(snapshotQ.data?.recommendations.map((item) => item.reason) ?? [
                "Conectar assistente de IA por modulo, com contexto da empresa e permissao por usuario.",
                "Criar fila de automacoes para PNCP, compliance, ZapSign e alertas financeiros.",
                "Registrar auditoria de cada acao automatica para rastreabilidade.",
                "Adicionar estados de carregamento, falha e retry nos modulos com APIs externas.",
              ]).map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-md border border-border/70 bg-background/60 px-3 py-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="apis">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ApiCard title="Supabase" status="Base, Auth, Storage e Realtime" connected={snapshotQ.data?.integrations.supabase} />
            <ApiCard title="PNCP" status="Busca e radar de oportunidades" connected />
            <ApiCard title="ZapSign" status="Assinaturas, templates e webhooks" connected={snapshotQ.data?.integrations.zapsignWebhook} />
            <ApiCard title="InfoSimples" status="Certidoes e compliance regulatorio" connected={snapshotQ.data?.integrations.infosimples} />
            <ApiCard title="IA generativa" status="Lovable AI Gateway para analises e planos" connected={snapshotQ.data?.integrations.lovableAi} />
            <ApiCard title="Rotinas agendadas" status="CRON_SECRET para automacoes recorrentes" connected={snapshotQ.data?.integrations.cronSecret} />
          </div>
          <Card className="glass-card mt-4 p-5 border-border/70">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <h2 className="text-xl font-display font-bold">Gerador de plano inteligente</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Usa IA quando configurada; caso contrario gera um plano local seguro.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["geral", "licitacoes", "obra", "financeiro", "governanca"] as const).map((item) => (
                  <Button
                    key={item}
                    size="sm"
                    variant={foco === item ? "default" : "outline"}
                    onClick={() => setFoco(item)}
                  >
                    {item}
                  </Button>
                ))}
              </div>
            </div>
            <Textarea
              className="mt-4 min-h-20 bg-background/70"
              value={objetivo}
              onChange={(event) => setObjetivo(event.target.value)}
              placeholder="Ex.: quero reduzir tempo de proposta, automatizar RDO ou priorizar alertas financeiros..."
            />
            <div className="mt-3 flex justify-end">
              <Button onClick={() => planMut.mutate()} disabled={planMut.isPending} className="gap-2">
                {planMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Gerar plano
              </Button>
            </div>
            {(planMut.data || planMut.error) && (
              <div className="mt-4 rounded-md border border-border/70 bg-background/75 p-4">
                {planMut.error ? (
                  <p className="text-sm text-destructive">{(planMut.error as Error).message}</p>
                ) : (
                  <>
                    <Badge variant="outline" className="mb-3">{planMut.data?.model}</Badge>
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{planMut.data?.plan}</pre>
                  </>
                )}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Bot }) {
  return (
    <div className="rounded-md border border-border/70 bg-background/75 px-3 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
        <Icon className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function AutomationCard({ item, active, onSelect }: { item: Automation; active: boolean; onSelect: () => void }) {
  const Icon = item.icon;
  return (
    <button type="button" onClick={onSelect} className="text-left">
      <Card
        className={`h-full p-4 border-border/70 transition-all hover:shadow-md ${
          active ? "glass-card ring-1 ring-primary/35" : "bg-card/80"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{item.area}</div>
              <h3 className="mt-1 font-semibold leading-tight">{item.title}</h3>
            </div>
          </div>
          <Badge variant="outline" className={STATUS_CLASS[item.status]}>
            {STATUS_LABEL[item.status]}
          </Badge>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{item.impact}</p>
        <div className="mt-4 flex items-center gap-3">
          <Progress value={item.score} className="h-1.5 flex-1" />
          <span className="text-xs font-semibold">{item.score}%</span>
        </div>
      </Card>
    </button>
  );
}

function Insight({ title, value, tone }: { title: string; value: string; tone: "primary" | "success" | "warning" }) {
  const cls =
    tone === "primary"
      ? "border-primary/25 bg-primary/10"
      : tone === "success"
        ? "border-success/25 bg-success/10"
        : "border-warning/30 bg-warning/10";
  return (
    <div className={`rounded-md border p-4 ${cls}`}>
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{title}</div>
      <div className="mt-2 text-sm font-semibold">{value}</div>
    </div>
  );
}

function ApiCard({ title, status, connected }: { title: string; status: string; connected?: boolean }) {
  return (
    <Card className="glass-card p-4 border-border/70">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{status}</p>
        </div>
        <Badge variant="outline" className={connected ? "border-primary/30 bg-primary/10 text-primary" : "border-amber-500/30 bg-amber-500/10 text-amber-600"}>
          {connected ? "Conectado" : "Configurar"}
        </Badge>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        {connected ? <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> : <BellRing className="w-3.5 h-3.5" />}
        <span>{connected ? "Disponivel no app" : "Requer variavel segura no servidor"}</span>
      </div>
    </Card>
  );
}

function SnapshotPanel({ snapshot, loading }: { snapshot?: AutomationSnapshot; loading: boolean }) {
  if (loading) {
    return (
      <div className="mt-5 rounded-md border border-border/70 bg-background/60 px-3 py-4 text-sm text-muted-foreground">
        Carregando diagnostico...
      </div>
    );
  }

  const counts = snapshot?.counts;
  return (
    <div className="mt-5 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <CountTile label="Obras" value={counts?.obras} />
        <CountTile label="Oportunidades" value={counts?.oportunidades} />
        <CountTile label="Editais" value={counts?.editais} />
        <CountTile label="Propostas" value={counts?.propostas} />
        <CountTile label="RDO" value={counts?.rdo} />
        <CountTile label="NF-e" value={counts?.notas} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(snapshot?.recommendations ?? [
          {
            id: "pagination",
            priority: "alta" as const,
            title: "Paginar todas as buscas grandes",
            reason: "Evita telas lentas quando o volume de dados crescer.",
            route: "/automacoes",
          },
          {
            id: "webhooks",
            priority: "media" as const,
            title: "Automacoes por webhook",
            reason: "Eventos externos precisam acionar alertas e atualizacoes.",
            route: "/assinaturas",
          },
          {
            id: "ia",
            priority: "alta" as const,
            title: "IA para documentos",
            reason: "Editais, RDOs e contratos podem gerar resumo e matriz de risco.",
            route: "/editais",
          },
        ]).slice(0, 3).map((item) => (
          <Link key={item.id} to={item.route}>
            <Insight
              title={item.priority === "alta" ? "Alta prioridade" : item.priority === "media" ? "Prioridade media" : "Proximo passo"}
              value={item.title}
              tone={item.priority === "alta" ? "warning" : item.priority === "media" ? "primary" : "success"}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

function CountTile({ label, value }: { label: string; value?: number | null }) {
  return (
    <div className="rounded-md border border-border/70 bg-background/70 px-3 py-3">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value == null ? "-" : value}</div>
    </div>
  );
}

function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
}
