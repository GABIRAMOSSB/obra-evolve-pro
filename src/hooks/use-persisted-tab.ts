import { useEffect, useState } from "react";

/**
 * Persiste a aba ativa em localStorage para que ao navegar entre páginas
 * e voltar, ou ao trocar de aba do navegador, a aba selecionada seja mantida.
 */
export function usePersistedTab(key: string, defaultValue: string) {
  const storageKey = `tab:${key}`;
  const [value, setValue] = useState<string>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      return window.localStorage.getItem(storageKey) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, value);
    } catch {
      // ignore
    }
  }, [storageKey, value]);
  return [value, setValue] as const;
}
