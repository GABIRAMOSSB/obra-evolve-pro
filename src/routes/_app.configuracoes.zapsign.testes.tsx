import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  testConnection,
  testDocumentReady,
  testPlacements,
  testMultipleSigners,
  testWhatsApp,
  testWebhook,
  testFinalPdf,
  testResponsive,
  testSecurity,
  type DiagnosticResult,
  type TestStatus,
} from "@/lib/zapsign-tests.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  HandMetal,
  Loader2,
  PlayCircle,
  RefreshCw,
  XCircle,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/_app/configuracoes/zapsign/testes")({
  head: () => ({
    meta: [
      { title: "Roteiro de Testes Sandbox — ZapSign" },
      {
        name: "description",
        content:
          "Roteiro guiado de validação da integração ZapSign em ambiente sandbox.",
      },
    ],
  }),
  component: SandboxTestsPage,
});

interface TestDef {
  id: string;
  title: string;
  description: string;
  run: () => Promise<DiagnosticResult>;
}

const TESTS: TestDef[] = [
  {
    id: "connection",
    title: "1. Conexão com ZapSign",
    description: "Valida token e endpoint configurados nos Secrets.",
    run: () => testConnection(),
  },
  {
    id: "document",
    title: "2. Preparação de documento",
    description: "Verifica preferências de assinatura e modo de autenticação.",
    run: () => testDocumentReady(),
  },
  {
    id: "placements",
    title: "3. Posicionamento de campos",
    description: "Confirma envios com rubricas/áreas de assinatura aplicadas.",
    run: () => testPlacements(),
  },
  {
    id: "multi-signers",
    title: "4. Múltiplos signatários",
    description: "Garante que o fluxo com 2+ assinantes está operacional.",
    run: () => testMultipleSigners(),
  },
  {
    id: "whatsapp",
    title: "5. Envio por WhatsApp",
    description: "Checa preferências de WhatsApp e signatários com telefone.",
    run: () => testWhatsApp(),
  },
  {
    id: "webhook",
    title: "6. Webhook ativo",
    description: "Valida segredo e recepção recente de eventos.",
    run: () => testWebhook(),
  },
  {
    id: "final-pdf",
    title: "7. PDF final assinado",
    description: "Verifica existência de documentos concluídos.",
    run: () => testFinalPdf(),
  },
  {
    id: "responsive",
    title: "8. Responsividade",
    description: "Checklist manual de UI em mobile, tablet e desktop.",
    run: () => testResponsive(),
  },
  {
    id: "security",
    title: "9. Segurança",
    description: "Confere secrets, ambiente sandbox e proteção das tabelas.",
    run: () => testSecurity(),
  },
];

function SandboxTestsPage() {
  const [results, setResults] = useState<Record<string, DiagnosticResult>>({});
  const [runningAll, setRunningAll] = useState(false);

  const runOne = async (t: TestDef) => {
    try {
      const r = await t.run();
      setResults((p) => ({ ...p, [t.id]: r }));
      return r;
    } catch (e) {
      const r: DiagnosticResult = {
        id: t.id,
        status: "fail",
        message: (e as Error).message,
      };
      setResults((p) => ({ ...p, [t.id]: r }));
      return r;
    }
  };

  const runAll = async () => {
    setRunningAll(true);
    for (const t of TESTS) {
      await runOne(t);
    }
    setRunningAll(false);
  };

  const passCount = Object.values(results).filter((r) => r.status === "pass").length;
  const failCount = Object.values(results).filter((r) => r.status === "fail").length;
  const warnCount = Object.values(results).filter((r) => r.status === "warn").length;

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link to="/configuracoes/zapsign">
            <ArrowLeft className="h-4 w-4 mr-1" /> Configurações ZapSign
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <header className="space-y-1">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Validação
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Roteiro de Testes Sandbox
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Execute os 9 testes guiados antes de migrar para produção. Cada teste
              registra o resultado abaixo do botão.
            </p>
          </header>
          <Button onClick={runAll} disabled={runningAll}>
            {runningAll ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4 mr-2" />
            )}
            Executar todos
          </Button>
        </div>
      </div>

      {Object.keys(results).length > 0 && (
        <Card className="p-4 flex flex-wrap items-center gap-3 text-sm">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          <span className="font-medium">Resumo:</span>
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3" /> {passCount} ok
          </Badge>
          {warnCount > 0 && (
            <Badge variant="outline" className="gap-1 border-warning/40">
              <AlertTriangle className="h-3 w-3" /> {warnCount} atenção
            </Badge>
          )}
          {failCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" /> {failCount} falhou
            </Badge>
          )}
        </Card>
      )}

      <div className="space-y-3">
        {TESTS.map((t) => (
          <TestRow key={t.id} test={t} result={results[t.id]} onRun={runOne} />
        ))}
      </div>
    </div>
  );
}

function TestRow({
  test,
  result,
  onRun,
}: {
  test: TestDef;
  result?: DiagnosticResult;
  onRun: (t: TestDef) => Promise<DiagnosticResult>;
}) {
  const mut = useMutation({ mutationFn: () => onRun(test) });
  const status = result?.status;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">{test.title}</h3>
            {status && <StatusBadge status={status} />}
          </div>
          <p className="text-xs text-muted-foreground">{test.description}</p>
          {result && (
            <div className="mt-2 text-xs rounded-md border bg-muted/30 px-3 py-2">
              {result.message}
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant={status === "pass" ? "outline" : "default"}
          onClick={() => mut.mutate()}
          disabled={mut.isPending}
          className="shrink-0"
        >
          {mut.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : status ? (
            <RefreshCw className="h-4 w-4 mr-2" />
          ) : (
            <PlayCircle className="h-4 w-4 mr-2" />
          )}
          {status ? "Reexecutar" : "Executar"}
        </Button>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: TestStatus }) {
  if (status === "pass")
    return (
      <Badge variant="secondary" className="gap-1 text-[10px]">
        <CheckCircle2 className="h-3 w-3" /> OK
      </Badge>
    );
  if (status === "fail")
    return (
      <Badge variant="destructive" className="gap-1 text-[10px]">
        <XCircle className="h-3 w-3" /> Falhou
      </Badge>
    );
  if (status === "warn")
    return (
      <Badge variant="outline" className="gap-1 text-[10px] border-warning/40">
        <AlertTriangle className="h-3 w-3" /> Atenção
      </Badge>
    );
  return (
    <Badge variant="outline" className="gap-1 text-[10px]">
      <HandMetal className="h-3 w-3" /> Manual
    </Badge>
  );
}
