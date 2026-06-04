/**
 * Server-only helpers for the Governança e Compliance module.
 *
 * This file MUST stay server-only (filename ends with `.server.ts` to be
 * blocked from the client bundle). It hosts:
 *   - The InfoSimples adapter (currently sandbox-only).
 *   - Sandbox payload generation for realistic test responses.
 *
 * IMPORTANT:
 *   - The real InfoSimples token (INFOSIMPLES_TOKEN) is read here from
 *     process.env at call time. It is NEVER returned to the frontend.
 *   - While integration_settings.sandbox_mode = true the adapter does NOT
 *     call any external HTTP endpoint, no matter what.
 *   - Real InfoSimples endpoint paths must be filled in by an admin via
 *     certificate_types.provider_service_key once the production
 *     documentation for the account is confirmed.
 */

export interface InfosimplesNormalizedResponse {
  ok: boolean;
  execution_mode: "sandbox" | "production";
  status: string;
  status_message: string;
  issue_date: string | null;
  expiration_date: string | null;
  certificate_number: string | null;
  authentication_code: string | null;
  pdf_base64: string | null;
  raw: unknown;
  error_code?: string;
  error_message?: string;
  http_status?: number;
}

export interface InfosimplesQueryInput {
  cnpj: string;
  state?: string | null;
  city?: string | null;
  provider_service_key: string | null;
  sandbox: boolean;
  production_enabled: boolean;
}

function isoDateOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function randomNumber(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) out += Math.floor(Math.random() * 10).toString();
  return out;
}

/**
 * Returns a realistic-but-fake response for a given certidão type.
 * The mapping below matches the seeded `certificate_types.code` values.
 */
export function buildSandboxResponse(
  code: string,
): InfosimplesNormalizedResponse {
  const base = {
    ok: true as const,
    execution_mode: "sandbox" as const,
    pdf_base64: null,
    raw: { sandbox: true, simulated_at: new Date().toISOString() },
  };
  switch (code) {
    case "cnd-federal":
      return {
        ...base,
        status: "valid",
        status_message: "Certidão válida — nada consta",
        issue_date: isoDateOffset(-12),
        expiration_date: isoDateOffset(168),
        certificate_number: randomNumber(20),
        authentication_code: randomNumber(8),
      };
    case "sefaz-rs":
      return {
        ...base,
        status: "valid",
        status_message: "Situação fiscal regular",
        issue_date: isoDateOffset(-7),
        expiration_date: isoDateOffset(83),
        certificate_number: `RS-${randomNumber(10)}`,
        authentication_code: randomNumber(6),
      };
    case "crf-fgts":
      return {
        ...base,
        status: "expiring_15",
        status_message: "CRF válido — atenção para a renovação",
        issue_date: isoDateOffset(-22),
        expiration_date: isoDateOffset(8),
        certificate_number: `FGTS-${randomNumber(12)}`,
        authentication_code: randomNumber(8),
      };
    case "cndt":
      return {
        ...base,
        status: "valid",
        status_message: "Negativa — nada consta",
        issue_date: isoDateOffset(-3),
        expiration_date: isoDateOffset(177),
        certificate_number: randomNumber(18),
        authentication_code: randomNumber(8),
      };
    case "cadin-cfil-rs":
      return {
        ...base,
        status: "valid",
        status_message: "Nada consta no CADIN/CFIL-RS",
        issue_date: isoDateOffset(-5),
        expiration_date: isoDateOffset(85),
        certificate_number: `CADIN-${randomNumber(10)}`,
        authentication_code: randomNumber(6),
      };
    case "cgu-correcional":
      return {
        ...base,
        status: "valid",
        status_message: "Sem registros correcionais",
        issue_date: isoDateOffset(-2),
        expiration_date: isoDateOffset(178),
        certificate_number: `CGU-${randomNumber(12)}`,
        authentication_code: randomNumber(8),
      };
    default:
      return {
        ...base,
        status: "unavailable",
        status_message: "Sandbox: tipo não simulado",
        issue_date: null,
        expiration_date: null,
        certificate_number: null,
        authentication_code: null,
      };
  }
}

/**
 * Adapter — currently always returns sandbox data while sandbox=true.
 *
 * Production path is intentionally left as a no-op error until an admin
 * (1) cadastra INFOSIMPLES_TOKEN nos Secrets, (2) flag production_enabled=true,
 * (3) flag sandbox_mode=false. The real HTTP call must be implemented here
 * mapping certificate_types.provider_service_key → InfoSimples endpoint.
 */
export async function callInfosimples(
  code: string,
  input: InfosimplesQueryInput,
): Promise<InfosimplesNormalizedResponse> {
  if (input.sandbox || !input.production_enabled) {
    return buildSandboxResponse(code);
  }

  const token = process.env.INFOSIMPLES_TOKEN;
  if (!token) {
    return {
      ok: false,
      execution_mode: "production",
      status: "api_not_configured",
      status_message: "Token da InfoSimples não cadastrado em Secrets",
      issue_date: null,
      expiration_date: null,
      certificate_number: null,
      authentication_code: null,
      pdf_base64: null,
      raw: null,
      error_code: "TOKEN_MISSING",
      error_message: "INFOSIMPLES_TOKEN ausente nos Secrets",
    };
  }

  // ATENÇÃO: implementação real fica aqui.
  // Mapear input.provider_service_key para o endpoint correto da
  // InfoSimples e enviar payload com input.cnpj / input.state.
  // Por segurança, retornamos erro controlado enquanto a integração
  // real não foi homologada pelo admin.
  return {
    ok: false,
    execution_mode: "production",
    status: "api_not_configured",
    status_message:
      "Integração de produção ainda não habilitada para este tipo de certidão.",
    issue_date: null,
    expiration_date: null,
    certificate_number: null,
    authentication_code: null,
    pdf_base64: null,
    raw: null,
    error_code: "PRODUCTION_NOT_WIRED",
    error_message:
      "Mapear endpoint real da InfoSimples para provider_service_key=" +
      (input.provider_service_key ?? "<none>"),
  };
}

/**
 * Classifies the expiration date into one of our visual status buckets.
 */
export function classifyExpiration(
  expirationDate: string | null,
): string {
  if (!expirationDate) return "unavailable";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expirationDate);
  exp.setHours(0, 0, 0, 0);
  const diff = Math.round((exp.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return "expired";
  if (diff <= 7) return "expiring_7";
  if (diff <= 15) return "expiring_15";
  if (diff <= 30) return "expiring_30";
  return "valid";
}

export function maskSecret(value: string | undefined): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••";
  return value.slice(0, 4) + "••••" + value.slice(-4);
}
