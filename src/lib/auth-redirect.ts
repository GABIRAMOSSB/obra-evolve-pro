export const GOOGLE_REDIRECT_STORAGE_KEY = "obra-google-redirect";

export function normalizeRedirect(value?: string | null) {
  if (!value || !value.startsWith("/")) return undefined;

  const path = value.split(/[?#]/, 1)[0];
  if (path === "/login" || path === "/reset-password") return undefined;

  return value;
}

export function getStoredRedirect() {
  if (typeof window === "undefined") return undefined;
  return normalizeRedirect(window.localStorage.getItem(GOOGLE_REDIRECT_STORAGE_KEY));
}

export function setStoredRedirect(value?: string) {
  if (typeof window === "undefined") return;

  if (value) {
    window.localStorage.setItem(GOOGLE_REDIRECT_STORAGE_KEY, value);
    return;
  }

  window.localStorage.removeItem(GOOGLE_REDIRECT_STORAGE_KEY);
}

export function popStoredRedirect() {
  const value = getStoredRedirect();
  setStoredRedirect(undefined);
  return value;
}

export function isIframePreview() {
  if (typeof window === "undefined") return false;

  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function formatGoogleAuthError(message?: string | null) {
  const text = (message ?? "").trim();

  if (/failed to exchange authorization code|exchange|invalid_grant|expired|already used|code/i.test(text)) {
    return "Falha na autenticação com o Google. Vou usar o fluxo seguro de redirecionamento para evitar reutilização ou expiração do código.";
  }

  if (/popup was blocked/i.test(text)) {
    return "O navegador bloqueou a janela do Google. Libere pop-ups e tente novamente.";
  }

  if (/cancelled/i.test(text)) {
    return "O login com Google foi cancelado.";
  }

  if (/legacy_flow/i.test(text)) {
    return "Este preview precisa concluir o login em uma nova aba.";
  }

  return text || "Falha no login com Google";
}
