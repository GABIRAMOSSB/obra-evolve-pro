import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ObraApp } from "@/components/ObraApp";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
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

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <>
      <ObraApp />
      <Toaster richColors position="top-right" />
    </>
  );
}
