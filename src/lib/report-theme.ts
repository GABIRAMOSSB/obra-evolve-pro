/**
 * Tema centralizado de cores para relatórios e boletins.
 *
 * Mantém PARIDADE VISUAL entre a tela (Atividades / Medição) e os arquivos
 * exportados (PDF, XLSX, impressão). Sempre que uma cor da UI mudar em
 * `src/styles.css`, atualize aqui também — ambos devem ficar em sintonia.
 *
 * Paleta Solv:
 *  - primary  marrom/dourado #b19777
 *  - measure  laranja medição #c94b16
 *  - success  verde positivo  #21bd5c
 */

export type RGB = [number, number, number];

/** Hex sem `#` (para xlsx-js-style). */
export const REPORT_HEX = {
  primary: "B19777",         // dourado do logo SOLV
  primaryDark: "3E4A5C",     // navy institucional (sidebar solvconstrutora.com)
  primarySoft: "DFCFBC",
  primarySofter: "EFE8DC",
  groupBg: "EFE8DC",
  subGroupBg: "F5EFE5",
  headerBg: "EAE1D2",
  measure: "C94B16",
  measureSoft: "FDEBDC",
  success: "21BD5C",
  successSoft: "DCFCE7",
  border: "D9CFBE",
  textOnDark: "FFFFFF",
  textOnLight: "1F2937",
  navyBM: "3E4A5C",
  cardBg: "FCFAF6",            // creme claro para cartões / KPIs neutros
  labelMuted: "6E5F48",        // rótulos pequenos (uppercase) sobre creme
  subtitleOnDark: "E6DCC8",    // subtítulos sobre banda navy
  tableLine: "C8CFDB",         // linhas finas da tabela
  tableHeadLine: "B4BBC8",     // linhas do cabeçalho da tabela
  signLine: "504434",          // linha de assinatura (marrom escuro)
  signFooter: "968A76",        // texto "assinatura digital ou física"
  footerText: "8C8C8C",        // rodapé de página (cinza neutro)
} as const;

/** RGB triplets (para jsPDF / autoTable). */
export const REPORT_RGB: Record<keyof typeof REPORT_HEX, RGB> = {
  primary: [177, 151, 119],
  primaryDark: [62, 74, 92],
  primarySoft: [223, 207, 188],
  primarySofter: [239, 232, 220],
  groupBg: [239, 232, 220],
  subGroupBg: [245, 239, 229],
  headerBg: [234, 225, 210],
  measure: [201, 75, 22],
  measureSoft: [253, 235, 220],
  success: [33, 189, 92],
  successSoft: [220, 252, 231],
  border: [217, 207, 190],
  textOnDark: [255, 255, 255],
  textOnLight: [31, 41, 55],
  navyBM: [62, 74, 92],
  cardBg: [252, 250, 246],
  labelMuted: [110, 95, 72],
  subtitleOnDark: [230, 220, 200],
  tableLine: [200, 207, 219],
  tableHeadLine: [180, 187, 200],
  signLine: [80, 68, 52],
  signFooter: [150, 138, 118],
  footerText: [140, 140, 140],
};


