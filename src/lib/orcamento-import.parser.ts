/**
 * Parser cliente para importação de orçamento (XLSX/XLS/CSV).
 *
 * Recursos:
 *  - Localiza o cabeçalho automaticamente nas primeiras 30 linhas
 *    (não exige que ele esteja na linha 1).
 *  - Aceita ampla lista de sinônimos (SINAPI, SICRO, ORSE, TCPO,
 *    planilhas próprias de construtoras).
 *  - Ignora linhas vazias, mescladas, títulos de categoria e cabeçalhos
 *    repetidos.
 *  - Suporta fórmulas Excel (usa o valor calculado, não a fórmula).
 *  - Calcula TOTAL = Qtd × V.Unit (× (1 + BDI/100)) quando a coluna Total
 *    não existir.
 *  - Permite ao usuário reajustar o mapeamento antes de importar.
 */
import * as XLSX from "xlsx";

export type ColumnKey =
  | "item_codigo"
  | "descricao"
  | "unidade"
  | "qtd_contratada"
  | "valor_unitario"
  | "total"
  | "bdi"
  | "sinapi_codigo";

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

// Ordem importa: sinônimos mais específicos primeiro (ex.: "codigo sinapi"
// antes de "codigo"), assim colunas dedicadas não são engolidas pela genérica.
const SYNONYMS: Record<ColumnKey, string[]> = {
  sinapi_codigo: ["codigo sinapi", "cod sinapi", "sinapi"],
  bdi: ["percentual bdi", "% bdi", "bdi"],
  total: [
    "custo total com bdi",
    "valor total com bdi",
    "preco total com bdi",
    "total geral",
    "custo total",
    "valor total",
    "preco total",
    "subtotal",
    "total",
  ],
  valor_unitario: [
    "preco unitario com bdi",
    "valor unitario com bdi",
    "valor unit c bdi",
    "valor unit bdi",
    "custo unitario",
    "preco unitario",
    "valor unitario",
    "vlr unitario",
    "vlr unit",
    "v unit",
    "vunit",
    "unitario",
    "preco",
    "pu",
    "p u",
  ],
  qtd_contratada: [
    "quantidade contratada",
    "qtd contratada",
    "quantidade",
    "quant",
    "qtde",
    "qtd",
    "qte",
    "qt",
  ],
  unidade: ["unidade", "unid", "und", "un", "medida", "um"],
  descricao: [
    "descricao do servico",
    "descricao do item",
    "item descrito",
    "servico orcado",
    "discriminacao",
    "descricao",
    "servico",
    "atividade",
    "insumo",
  ],
  item_codigo: [
    "codigo servico",
    "codigo do servico",
    "codigo do item",
    "codigo orse",
    "codigo sicro",
    "codigo",
    "cod",
    "item",
    "ref",
    "id",
    "numero",
    "num",
    "no",
    "n",
  ],
};

// Palavras que caracterizam títulos de categoria (linhas informativas).
const TITLE_KEYWORDS = [
  "servicos preliminares",
  "servicos complementares",
  "servicos finais",
  "servicos tecnicos",
  "servicos gerais",
  "demolicoes",
  "cobertura",
  "coberturas",
  "pintura",
  "pinturas",
  "instalacoes",
  "hidraulica",
  "hidraulicas",
  "eletrica",
  "eletricas",
  "acabamento",
  "acabamentos",
  "infraestrutura",
  "superestrutura",
  "movimento de terra",
  "fundacoes",
  "fundacao",
  "estrutura",
  "estruturas",
  "revestimento",
  "revestimentos",
  "esquadrias",
  "loucas e metais",
];

function normalize(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let s = String(v).trim();
  if (!s) return 0;
  s = s.replace(/[R$\s%]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  // Parênteses = negativo (formato contábil).
  const neg = /^\(.*\)$/.test(s);
  if (neg) s = s.slice(1, -1);
  const n = Number(s);
  if (!isFinite(n)) return 0;
  return neg ? -n : n;
}

function matchColumn(headerNormalized: string): ColumnKey | null {
  if (!headerNormalized) return null;
  for (const key of Object.keys(SYNONYMS) as ColumnKey[]) {
    for (const syn of SYNONYMS[key]) {
      const n = normalize(syn);
      if (!n) continue;
      // Match exato ou como token (evita "id" casar com "unidade").
      if (headerNormalized === n) return key;
      const re = new RegExp(`(^|\\s)${n.replace(/\s+/g, "\\s+")}(\\s|$)`);
      if (re.test(headerNormalized)) return key;
    }
  }
  return null;
}

function emptyMapping(): MappingHeuristic {
  return {
    item_codigo: null,
    descricao: null,
    unidade: null,
    qtd_contratada: null,
    valor_unitario: null,
    total: null,
    bdi: null,
    sinapi_codigo: null,
  };
}

/**
 * Varre até as primeiras 30 linhas em busca da linha de cabeçalho.
 * Escolhe a linha que reconhecer mais colunas conhecidas (mínimo 3).
 */
function detectHeaderRow(matrix: unknown[][]): {
  row: number;
  headers: string[];
  mapping: MappingHeuristic;
  score: number;
} {
  const limit = Math.min(30, matrix.length);
  let best = { row: 0, headers: [] as string[], mapping: emptyMapping(), score: 0 };
  for (let i = 0; i < limit; i++) {
    const raw = (matrix[i] ?? []).map((c) => String(c ?? "").trim());
    // Considera também mesclagem com a linha seguinte (cabeçalhos em 2 níveis).
    const candidates: string[][] = [raw];
    const next = (matrix[i + 1] ?? []).map((c) => String(c ?? "").trim());
    if (next.some(Boolean)) {
      const merged: string[] = [];
      const len = Math.max(raw.length, next.length);
      for (let k = 0; k < len; k++) merged.push(`${raw[k] ?? ""} ${next[k] ?? ""}`.trim());
      candidates.push(merged);
    }
    for (const cand of candidates) {
      const mapping = emptyMapping();
      let score = 0;
      cand.forEach((h) => {
        if (!h) return;
        const key = matchColumn(normalize(h));
        if (key && !mapping[key]) {
          mapping[key] = h;
          score += key === "item_codigo" || key === "descricao" ? 2 : 1;
        }
      });
      if (score > best.score) best = { row: i, headers: cand, mapping, score };
    }
    if (best.score >= 8) break;
  }
  return best;
}

export type ParseFileResult = {
  headers: string[]; // nomes únicos (posição = coluna)
  rows: Array<Record<string, unknown>>;
  sheetNames: string[];
  activeSheet: string;
  detectedMapping: MappingHeuristic;
  headerRowIndex: number; // 0-based
  headerScore: number;
};

/**
 * Lê o arquivo, identifica o cabeçalho e devolve linhas de dados com
 * chaves = nomes das colunas (para o wizard exibir).
 */
export async function parseFile(file: File, sheetName?: string): Promise<ParseFileResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const sheetNames = wb.SheetNames;
  const active = sheetName && sheetNames.includes(sheetName) ? sheetName : sheetNames[0];
  const ws = wb.Sheets[active];
  // header:1 devolve matriz crua; raw:true garante valores calculados de fórmulas.
  const matrix: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: false,
  });
  const det = detectHeaderRow(matrix);
  // Garante headers únicos (preenche vazios e desambigua duplicados).
  const seen = new Map<string, number>();
  const headers = det.headers.map((h, idx) => {
    const base = String(h ?? "").trim() || `Coluna ${idx + 1}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base} (${n + 1})`;
  });
  const rows: Array<Record<string, unknown>> = [];
  for (let i = det.row + 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    if ((row as unknown[]).every((c) => c === "" || c === null || c === undefined)) continue;
    const rec: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      rec[h] = (row as unknown[])[idx] ?? "";
    });
    rows.push(rec);
  }
  // Remapeia com os nomes finais das colunas (posições preservadas).
  const mapping = detectMapping(headers);
  return {
    headers,
    rows,
    sheetNames,
    activeSheet: active,
    detectedMapping: mapping,
    headerRowIndex: det.row,
    headerScore: det.score,
  };
}

export function detectMapping(headers: string[]): MappingHeuristic {
  const map = emptyMapping();
  headers.forEach((h) => {
    const key = matchColumn(normalize(h));
    if (key && !map[key]) map[key] = h;
  });
  return map;
}

/**
 * Aplica o mapeamento e produz linhas validadas.
 * - Ignora títulos/etapas (linha sem código + descrição em lista de títulos
 *   OU sem qtd/valor).
 * - Calcula TOTAL quando ausente: Qtd × V.Unit × (1 + BDI/100).
 * - Se apenas TOTAL vier preenchido, deriva V.Unit = Total / Qtd.
 */
export function applyMapping(
  rows: Array<Record<string, unknown>>,
  mapping: MappingHeuristic,
): { parsed: ParsedRow[]; issues: PreviewIssue[] } {
  const parsed: ParsedRow[] = [];
  const issues: PreviewIssue[] = [];
  const seen = new Set<string>();

  const get = (row: Record<string, unknown>, k: ColumnKey) =>
    mapping[k] ? row[mapping[k] as string] : "";

  rows.forEach((row, idx) => {
    const linha = idx + 2; // +1 header, +1 base 1
    const codigo = String(get(row, "item_codigo") ?? "").trim();
    const descricao = String(get(row, "descricao") ?? "").trim();

    if (!codigo && !descricao) return;

    const qtd = parseNumber(get(row, "qtd_contratada"));
    const vuRaw = parseNumber(get(row, "valor_unitario"));
    const totalRaw = parseNumber(get(row, "total"));
    const bdi = parseNumber(get(row, "bdi"));
    const unidade = String(get(row, "unidade") ?? "").trim() || null;
    const sinapi = String(get(row, "sinapi_codigo") ?? "").trim() || null;

    // Cabeçalho repetido no meio da planilha.
    const nDesc = normalize(descricao);
    if (nDesc === "descricao" || normalize(codigo) === "codigo") {
      issues.push({ linha, campo: "linha", mensagem: "Cabeçalho repetido ignorado", nivel: "aviso" });
      return;
    }

    // Título/etapa: sem código, sem quantidade e sem valor,
    // ou descrição bate com uma palavra-chave de categoria.
    const looksLikeTitle =
      !codigo &&
      qtd === 0 &&
      vuRaw === 0 &&
      totalRaw === 0 &&
      (!!descricao || TITLE_KEYWORDS.some((k) => nDesc.includes(k)));
    if (looksLikeTitle) {
      issues.push({
        linha,
        campo: "linha",
        mensagem: descricao ? `Título/etapa ignorada: "${descricao.slice(0, 60)}"` : "Linha vazia",
        nivel: "aviso",
      });
      return;
    }

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

    // Deriva valores faltantes.
    const bdiMult = bdi > 0 ? 1 + bdi / 100 : 1;
    let vu = vuRaw;
    let total = totalRaw;
    if (total <= 0 && qtd > 0 && vu > 0) total = qtd * vu * bdiMult;
    if (vu <= 0 && total > 0 && qtd > 0) vu = total / qtd;

    if (qtd < 0) issues.push({ linha, campo: "qtd_contratada", mensagem: "Quantidade negativa", nivel: "erro" });
    if (vu < 0) issues.push({ linha, campo: "valor_unitario", mensagem: "Valor unitário negativo", nivel: "erro" });
    if (descricao.length < 5) issues.push({ linha, campo: "descricao", mensagem: "Descrição muito curta", nivel: "aviso" });

    parsed.push({
      item_codigo: codigo,
      descricao,
      unidade,
      qtd_contratada: qtd,
      valor_unitario: vu,
      sinapi_codigo: sinapi,
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
