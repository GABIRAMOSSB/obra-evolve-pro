import { createFileRoute, redirect } from "@tanstack/react-router";
import { ObraApp } from "@/components/ObraApp";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login" });
    }
  },
  ssr: false,
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
  return (
    <>
      <ObraApp />
      <Toaster richColors position="top-right" />
    </>
  );
}
