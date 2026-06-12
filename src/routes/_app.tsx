import { createFileRoute, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useRef } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { AppTopbar } from "@/components/AppTopbar";
import { useAuth } from "@/hooks/use-auth";
import { useSignatureNotifications } from "@/hooks/use-signature-notifications";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname + s.location.searchStr });
  const redirectPathRef = useRef("/");
  if (!pathname.startsWith("/login")) {
    redirectPathRef.current = pathname;
  }
  useSignatureNotifications();

  if (!loading && !user) {
    return <Navigate to="/login" search={{ redirect: redirectPathRef.current }} replace />;
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen app-canvas flex items-center justify-center">
        <div className="glass-card shadow-card rounded-xl px-5 py-4 text-sm text-muted-foreground">
          Carregando...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex w-full app-canvas">
      <AppSidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="lg:hidden">
          <AppTopbar />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
