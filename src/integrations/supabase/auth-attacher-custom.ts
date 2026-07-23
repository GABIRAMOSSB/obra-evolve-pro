import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

// Project-specific replacement for the generated attachSupabaseAuth.
// Difference: if the current token is expired and refresh fails, we DO NOT
// fall back to the stale token (which causes "JWT has expired" 500s on the
// server). We sign out locally so the auth listener redirects to /login.
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    let token = data.session?.access_token;
    const expiresAt = data.session?.expires_at ?? 0;
    const nowSec = Math.floor(Date.now() / 1000);
    const expiredOrSoon = !!token && expiresAt > 0 && expiresAt - nowSec < 30;

    if (expiredOrSoon) {
      const { data: refreshed, error } = await supabase.auth.refreshSession();
      const newToken = refreshed.session?.access_token;
      if (error || !newToken) {
        // Refresh failed; don't send an expired token.
        try {
          await supabase.auth.signOut();
        } catch {
          /* ignore */
        }
        token = undefined;
      } else {
        token = newToken;
      }
    }

    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
