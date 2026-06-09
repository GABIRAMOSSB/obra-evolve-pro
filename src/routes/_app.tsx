import { createFileRoute, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useRef } from "react";
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppTopbar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
