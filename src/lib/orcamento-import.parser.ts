/**
 * Parser cliente para importação de orçamento (XLSX/CSV).
 * Auto-detecta colunas por sinônimos comuns e valida linhas.
 */
import * as XLSX from "xlsx";

export type ColumnKey = "item_codigo" | "descricao" | "unidade" | "qtd_contratada" | "valor_unitario" | "sinapi_codigo";

export type MappingHeuristic = Record<ColumnKey, string | null>;

export type ParsedRow = {
  item_codigo: string;
  descricao: string;
  unidade: string | null;
  qtd_contratada: number;
  valor_unitario: number;
  sinapi_codigo: string | null;
};

export type PreviewIssue = {
  linha: number;
  campo: string;
  mensagem: string;
  nivel: "erro" | "aviso";
};

const SYNONYMS: Record<ColumnKey, string[]> = {
  item_codigo: ["item", "código", "codigo", "cod", "cód", "n°", "no", "num", "número", "numero"],
  descricao: ["descrição", "descricao", "serviço", "servico", "insumo", "atividade", "discriminação"],
  unidade: ["un", "und", "unid", "unidade", "medida", "um"],
  qtd_contratada: ["qtd", "quant", "quantidade", "qtd. contratada", "qtde"],
  valor_unitario: ["valor unitário", "valor unitario", "vlr unit", "unitário", "unitario", "p.u", "pu", "custo unitário"],
  sinapi_codigo: ["sinapi", "cód sinapi", "codigo sinapi", "cod. sinapi"],
};

function normalize(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function parseNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let s = String(v).trim();
  if (!s) return 0;
  // Remove símbolos monetários
  s = s.replace(/[R$\s]/g, "");
  // Se tem vírgula E ponto, ponto é milhar e vírgula é decimal
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

export function detectMapping(headers: string[]): MappingHeuristic {
  const map: MappingHeuristic = {
    item_codigo: null,
    descricao: null,
    unidade: null,
    qtd_contratada: null,
    valor_unitario: null,
    sinapi_codigo: null,
  };
  const normHeaders = headers.map((h) => normalize(h));
  for (const key of Object.keys(SYNONYMS) as ColumnKey[]) {
    for (const syn of SYNONYMS[key]) {
      const idx = normHeaders.findIndex((h) => h === normalize(syn) || h.includes(normalize(syn)));
      if (idx >= 0) {
        map[key] = headers[idx];
        break;
      }
    }
  }
  return map;
}

export type ParseFileResult = {
  headers: string[];
  rows: Array<Record<string, unknown>>;
  sheetNames: string[];
  activeSheet: string;
};

export async function parseFile(file: File, sheetName?: string): Promise<ParseFileResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const sheetNames = wb.SheetNames;
  const active = sheetName && sheetNames.includes(sheetName) ? sheetName : sheetNames[0];
  const ws = wb.Sheets[active];
  const json: Array<Record<string, unknown>> = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
  const headers = json.length > 0 ? Object.keys(json[0]) : [];
  return { headers, rows: json, sheetNames, activeSheet: active };
}

export function applyMapping(
  rows: Array<Record<string, unknown>>,
  mapping: MappingHeuristic,
): { parsed: ParsedRow[]; issues: PreviewIssue[] } {
  const parsed: ParsedRow[] = [];
  const issues: PreviewIssue[] = [];
  const seen = new Set<string>();

  rows.forEach((row, idx) => {
    const linha = idx + 2; // +1 header, +1 index
    const codigoRaw = mapping.item_codigo ? row[mapping.item_codigo] : "";
    const descRaw = mapping.descricao ? row[mapping.descricao] : "";
    const unidRaw = mapping.unidade ? row[mapping.unidade] : "";
    const qtdRaw = mapping.qtd_contratada ? row[mapping.qtd_contratada] : 0;
    const vuRaw = mapping.valor_unitario ? row[mapping.valor_unitario] : 0;
    const sinapiRaw = mapping.sinapi_codigo ? row[mapping.sinapi_codigo] : "";

    const codigo = String(codigoRaw ?? "").trim();
    const descricao = String(descRaw ?? "").trim();

    // Ignora linhas totalmente vazias
    if (!codigo && !descricao) return;

    if (!codigo) {
      issues.push({ linha, campo: "item_codigo", mensagem: "Código do item vazio", nivel: "erro" });
      return;
    }
    if (!descricao) {
      issues.push({ linha, campo: "descricao", mensagem: "Descrição vazia", nivel: "erro" });
      return;
    }
    if (seen.has(codigo)) {
      issues.push({ linha, campo: "item_codigo", mensagem: `Código duplicado: ${codigo}`, nivel: "aviso" });
    }
    seen.add(codigo);

    const qtd = parseNumber(qtdRaw);
    const vu = parseNumber(vuRaw);
    const unidade = String(unidRaw ?? "").trim() || null;

    if (qtd < 0) issues.push({ linha, campo: "qtd_contratada", mensagem: "Quantidade negativa", nivel: "erro" });
    if (vu < 0) issues.push({ linha, campo: "valor_unitario", mensagem: "Valor unitário negativo", nivel: "erro" });
    if (descricao.length < 5) issues.push({ linha, campo: "descricao", mensagem: "Descrição muito curta", nivel: "aviso" });

    parsed.push({
      item_codigo: codigo,
      descricao,
      unidade,
      qtd_contratada: qtd,
      valor_unitario: vu,
      sinapi_codigo: String(sinapiRaw ?? "").trim() || null,
    });
  });

  return { parsed, issues };
}

export function computeTotais(rows: ParsedRow[]) {
  let totalCents = 0;
  let itens = 0;
  let etapas = 0;
  for (const r of rows) {
    const cents = Math.round(r.qtd_contratada * Math.round(r.valor_unitario * 100));
    if (r.qtd_contratada > 0 && r.valor_unitario > 0) {
      totalCents += cents;
      itens += 1;
    } else {
      etapas += 1;
    }
  }
  return { totalCents, itens, etapas, linhas: rows.length };
}
