import { createFileRoute } from "@tanstack/react-router";
import { ObraApp } from "@/components/ObraApp";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Acompanhamento de Obras" },
      {
        name: "description",
        content:
          "Sistema local de acompanhamento físico-financeiro de obras a partir de planilha orçamentária Excel.",
      },
    ],
  }),
});

function Index() {
  return (
    <>
      <ObraApp />
      <Toaster richColors position="top-right" />
    </>
  );
}
