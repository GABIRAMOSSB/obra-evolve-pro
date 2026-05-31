import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";

const ObraApp = lazy(() =>
  import("@/components/ObraApp").then((m) => ({ default: m.ObraApp }))
);

export const Route = createFileRoute("/_app/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Acompanhamento de Obras" },
      {
        name: "description",
        content:
          "Sistema de acompanhamento físico-financeiro de obras a partir de planilha orçamentária Excel.",
      },
    ],
  }),
});

function LoadingScreen() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-sm text-muted-foreground">Carregando...</div>
    </div>
  );
}

function Index() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ObraApp />
      <Toaster richColors position="top-right" />
    </Suspense>
  );
}
