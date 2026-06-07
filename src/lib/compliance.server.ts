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
 * Adapter — chama a InfoSimples em produção via FormData POST.
 *
 * Endpoint: https://api.infosimples.com/api/v2/consultas/{slug}
 *   slug = certificate_types.provider_service_key
 *
 * Em sandbox (integration_settings.sandbox_mode=true OU production_enabled=false)
 * retorna dados fictícios sem consumir créditos da API.
 */
const INFOSIMPLES_BASE = "https://api.infosimples.com/api/v2/consultas";

function parseBRDate(v: unknown): string | null {
  if (!v || typeof v !== "string") return null;
  const s = v.trim();
  // dd/mm/yyyy
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function pick(obj: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export async function callInfosimples(
  code: string,
  input: InfosimplesQueryInput,
): Promise<InfosimplesNormalizedResponse> {
  if (input.sandbox || !input.production_enabled) {
    return buildSandboxResponse(code);
  }

  const token = process.env.INFOSIMPLES_TOKEN;
  const slug = input.provider_service_key;
  if (!token) {
    return {
      ok: false, execution_mode: "production", status: "api_not_configured",
      status_message: "Token da InfoSimples não cadastrado",
      issue_date: null, expiration_date: null, certificate_number: null,
      authentication_code: null, pdf_base64: null, raw: null,
      error_code: "TOKEN_MISSING", error_message: "INFOSIMPLES_TOKEN ausente",
    };
  }
  if (!slug) {
    return {
      ok: false, execution_mode: "production", status: "api_not_configured",
      status_message: "Slug InfoSimples não configurado para esta certidão",
      issue_date: null, expiration_date: null, certificate_number: null,
      authentication_code: null, pdf_base64: null, raw: null,
      error_code: "SLUG_MISSING", error_message: `provider_service_key ausente para ${code}`,
    };
  }

  try {
    const form = new FormData();
    form.append("token", token);
    form.append("timeout", "300");
    if (input.cnpj) form.append("cnpj", input.cnpj.replace(/\D/g, ""));
    if (input.state) form.append("uf", input.state);
    if (input.city) form.append("municipio", input.city);

    const res = await fetch(`${INFOSIMPLES_BASE}/${slug}`, { method: "POST", body: form });
    const json = await res.json().catch(() => ({} as Record<string, unknown>));
    const httpStatus = res.status;
    const apiCode = typeof (json as { code?: number }).code === "number" ? (json as { code: number }).code : null;
    const dataArr = Array.isArray((json as { data?: unknown[] }).data) ? (json as { data: Record<string, unknown>[] }).data : [];
    const first = (dataArr[0] ?? null) as Record<string, unknown> | null;
    const receipts = Array.isArray((json as { site_receipts?: unknown[] }).site_receipts)
      ? (json as { site_receipts: string[] }).site_receipts : [];

    // 200 = sucesso InfoSimples. Demais códigos = erro lógico (sem créditos consumidos em alguns casos).
    const ok = res.ok && apiCode === 200 && !!first;
    if (!ok) {
      return {
        ok: false, execution_mode: "production",
        status: apiCode === 612 ? "certificate_not_found" : "provider_error",
        status_message: (json as { code_message?: string }).code_message ?? `InfoSimples HTTP ${httpStatus} code=${apiCode}`,
        issue_date: null, expiration_date: null, certificate_number: null,
        authentication_code: null, pdf_base64: null, raw: json,
        http_status: httpStatus,
        error_code: apiCode ? String(apiCode) : "HTTP_" + httpStatus,
        error_message: (json as { code_message?: string }).code_message ?? "Falha na consulta",
      };
    }

    const issue = parseBRDate(pick(first, ["data_emissao", "emissao", "data_consulta", "expedicao"]));
    const expiration = parseBRDate(pick(first, ["data_validade", "validade", "data_expiracao", "vencimento"]));
    const number = pick(first, ["numero_certidao", "numero", "codigo_controle", "numero_documento"]);
    const auth = pick(first, ["codigo_autenticacao", "codigo_controle", "autenticidade", "hash"]);
    const statusMsg = pick(first, ["situacao", "status", "resultado", "mensagem"]) ?? "Consulta realizada com sucesso";

    return {
      ok: true, execution_mode: "production",
      status: classifyExpiration(expiration),
      status_message: statusMsg,
      issue_date: issue,
      expiration_date: expiration,
      certificate_number: number,
      authentication_code: auth,
      pdf_base64: null,
      raw: { ...json, site_receipts: receipts },
      http_status: httpStatus,
    };
  } catch (e) {
    return {
      ok: false, execution_mode: "production", status: "provider_error",
      status_message: (e as Error).message,
      issue_date: null, expiration_date: null, certificate_number: null,
      authentication_code: null, pdf_base64: null, raw: null,
      error_code: "NETWORK_ERROR", error_message: (e as Error).message,
    };
  }
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
