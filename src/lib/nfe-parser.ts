// Parser de XML NF-e (modelo 55) — usa DOMParser nativo do browser

export type NFeItemParsed = {
  numero_item: number;
  codigo_produto: string | null;
  descricao: string;
  ncm: string | null;
  cfop: string | null;
  unidade: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  valor_desconto: number;
  valor_frete: number;
};

export type NFeParsed = {
  chave_acesso: string;
  numero: string;
  serie: string | null;
  modelo: string | null;
  natureza_operacao: string | null;
  data_emissao: string | null;
  emitente_cnpj: string | null;
  emitente_nome: string | null;
  emitente_ie: string | null;
  emitente_uf: string | null;
  destinatario_cnpj: string | null;
  destinatario_nome: string | null;
  valor_produtos: number;
  valor_frete: number;
  valor_desconto: number;
  valor_outras: number;
  valor_icms: number;
  valor_ipi: number;
  valor_total: number;
  itens: NFeItemParsed[];
  xml_content: string;
};

function getText(parent: Element | null, tag: string): string | null {
  if (!parent) return null;
  const el = parent.getElementsByTagName(tag)[0];
  return el?.textContent?.trim() || null;
}

function getNumber(parent: Element | null, tag: string): number {
  const t = getText(parent, tag);
  if (!t) return 0;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function findInfNFe(xml: Document): Element | null {
  return (
    xml.getElementsByTagName("infNFe")[0] ||
    xml.getElementsByTagName("infCFe")[0] ||
    null
  );
}

function extractChave(infNFe: Element | null, xml: Document): string {
  const id = infNFe?.getAttribute("Id") || "";
  const fromId = id.replace(/^NFe/i, "").replace(/\D/g, "");
  if (fromId.length === 44) return fromId;
  const chNFe = xml.getElementsByTagName("chNFe")[0]?.textContent?.trim();
  if (chNFe && chNFe.length === 44) return chNFe;
  return "";
}

export function parseNFeXml(xmlText: string): NFeParsed {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "text/xml");
  const parseError = xml.getElementsByTagName("parsererror")[0];
  if (parseError) throw new Error("XML inválido");

  const infNFe = findInfNFe(xml);
  if (!infNFe) throw new Error("Tag infNFe não encontrada — não é uma NF-e válida");

  const ide = infNFe.getElementsByTagName("ide")[0] || null;
  const emit = infNFe.getElementsByTagName("emit")[0] || null;
  const dest = infNFe.getElementsByTagName("dest")[0] || null;
  const total = infNFe.getElementsByTagName("ICMSTot")[0] || null;

  const chave = extractChave(infNFe, xml);
  if (!chave) throw new Error("Chave de acesso não encontrada");

  const enderEmit = emit?.getElementsByTagName("enderEmit")[0] || null;

  const dets = Array.from(infNFe.getElementsByTagName("det"));
  const itens: NFeItemParsed[] = dets.map((det, idx) => {
    const prod = det.getElementsByTagName("prod")[0] || null;
    const nItem = Number(det.getAttribute("nItem")) || idx + 1;
    return {
      numero_item: nItem,
      codigo_produto: getText(prod, "cProd"),
      descricao: getText(prod, "xProd") || "(sem descrição)",
      ncm: getText(prod, "NCM"),
      cfop: getText(prod, "CFOP"),
      unidade: getText(prod, "uCom") || getText(prod, "uTrib"),
      quantidade: getNumber(prod, "qCom") || getNumber(prod, "qTrib"),
      valor_unitario: getNumber(prod, "vUnCom") || getNumber(prod, "vUnTrib"),
      valor_total: getNumber(prod, "vProd"),
      valor_desconto: getNumber(prod, "vDesc"),
      valor_frete: getNumber(prod, "vFrete"),
    };
  });

  return {
    chave_acesso: chave,
    numero: getText(ide, "nNF") || "",
    serie: getText(ide, "serie"),
    modelo: getText(ide, "mod"),
    natureza_operacao: getText(ide, "natOp"),
    data_emissao: getText(ide, "dhEmi") || getText(ide, "dEmi"),
    emitente_cnpj: getText(emit, "CNPJ") || getText(emit, "CPF"),
    emitente_nome: getText(emit, "xNome"),
    emitente_ie: getText(emit, "IE"),
    emitente_uf: getText(enderEmit, "UF"),
    destinatario_cnpj: getText(dest, "CNPJ") || getText(dest, "CPF"),
    destinatario_nome: getText(dest, "xNome"),
    valor_produtos: getNumber(total, "vProd"),
    valor_frete: getNumber(total, "vFrete"),
    valor_desconto: getNumber(total, "vDesc"),
    valor_outras: getNumber(total, "vOutro"),
    valor_icms: getNumber(total, "vICMS"),
    valor_ipi: getNumber(total, "vIPI"),
    valor_total: getNumber(total, "vNF"),
    itens,
    xml_content: xmlText,
  };
}

export function formatCnpj(cnpj: string | null | undefined): string {
  if (!cnpj) return "—";
  const d = cnpj.replace(/\D/g, "");
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  return cnpj;
}

export function formatMoney(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
