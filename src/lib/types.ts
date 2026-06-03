export type ModeloImportacao = "modelo_antigo" | "modelo_orcamento_sintetico";

export interface BudgetRow {
  item: string;
  codigo: string;
  banco: string;
  descricao: string;
  und: string;
  quantidade: number;
  valorUnit: number;
  valorUnitBDI: number;
  total: number;
  peso: number;
  isGroup: boolean;
  level: number;
  // ----- Campos do modelo "Orçamento Sintético" (opcionais) -----
  modelo?: ModeloImportacao;
  valorUnitMO?: number;
  valorUnitMaterial?: number;
  totalMO?: number;
  totalMaterial?: number;
  /** Igual a `total` no sintético; mantido para rastreabilidade. */
  precoVendaTotal?: number;
  /** Snapshots calculados no momento da importação (recalculáveis). */
  impostosNota?: number;
  lucroPlanejado?: number;
  custoMeta?: number;
  itemPai?: string;
  nivelHierarquico?: number;
  tipoLinha?: "etapa" | "composicao";
  // ----- Fase 8: preparação para apropriação (estrutural, sem lógica) -----
  moRealizada?: number;
  materialConsumido?: number;
  equipamentoApropriado?: number;
  terceirosRealizados?: number;
  freteRealizado?: number;
  realizadoTotal?: number;
  // ----- Fase 9: preparação para centro de custo -----
  centroCustoId?: string | null;
  subcentroCustoId?: string | null;
  // ----- Fase 10: preparação para custo meta -----
  precoVenda?: number;
  saldoMeta?: number;
  lucroAtual?: number;
  margemAtual?: number;
  // ----- Fase 11: preparação para MRP -----
  quantidadeComprada?: number;
  quantidadeConsumida?: number;
  estoqueAtual?: number;
  necessidadeCompra?: number;
  // ----- Fase 12: vínculos futuros (insumo mestre, fornecedor) -----
  insumoMestreId?: string | null;
  fornecedorId?: string | null;
}

export interface Measurement {
  id: string;
  number: number;
  quantExec: number;
  dataExec: string;
  observacoes: string;
  closed: boolean;
  closedAt?: string;
}

export interface Evolution {
  measurements?: Measurement[];
  // Campos legados (formato anterior) — mantidos para leitura/migração.
  quantExec?: number;
  dataExec?: string;
  observacoes?: string;
}

export interface DiaryPhoto {
  id: string;
  url: string;
  path: string; // storage path for deletion
  legenda: string;
  hora: string; // HH:MM
  tipo?: "antes" | "depois" | "geral" | "video";
}

export interface MaoObraLinha {
  id: string;
  funcaoId?: string;
  funcaoNome: string;
  quantidade: number;
  horas: number;
  custoHora: number;
  itemCodigo?: string;
  itemDescricao?: string;
}

export interface EquipamentoLinha {
  id: string;
  equipamentoId?: string;
  equipamentoNome: string;
  quantidade: number;
  horas: number;
  custoHora: number;
  itemCodigo?: string;
  itemDescricao?: string;
}

export interface DiaryEntry {
  id: string;
  itemKey: string;
  data: string;
  horaInicio?: string;
  horaFim?: string;
  statusDia?: "Normal" | "Chuva" | "Paralisação" | "Atraso" | "Feriado";
  clima: string;
  equipe: string;
  equipamentos: string;
  pendencias?: string;
  observacoes: string;
  quantExec: number;
  etapa: string;
  atividade: string;
  texto: string;
  fotos?: DiaryPhoto[];
  maoObraLinhas?: MaoObraLinha[];
  equipamentoLinhas?: EquipamentoLinha[];
  createdAt: string;
}

export interface ObraInfo {
  cliente?: string;
  contratante?: string;
  endereco?: string;
  municipio?: string;
  estado?: string;
  responsavelTecnico?: string;
  crea?: string;
  cargoResponsavel?: string;
  fiscal?: string;
  cpfFiscal?: string;
  creaFiscal?: string;
  cargoFiscal?: string;
  artRrt?: string;
  empresaExecutora?: string;
  cnpj?: string;
  numeroContrato?: string;
  numeroLicitacao?: string;
  dataInicioObra?: string; // yyyy-mm-dd
  prazoContratualDias?: number;
}


export interface MeasurementAuditEntry {
  number: number;
  action: "closed" | "reopened";
  userId: string;
  userEmail?: string;
  at: string; // ISO
  reason?: string;
}

export interface ProjectData {
  id: string;
  nome: string;
  fileName: string;
  importedAt: string;
  rows: BudgetRow[];
  evolutions: Record<string, Evolution>;
  diaries: DiaryEntry[];
  info?: ObraInfo;
  /** Modelo de planilha detectado na importação. */
  modelo?: ModeloImportacao;
  /** Nome da aba importada na planilha (informativo). */
  nomeAba?: string;
  /** Número da medição atualmente em aberto (global, 1-based). */
  currentMeasurement?: number;
  /** Auditoria de fechamento/reabertura de medições. */
  measurementLog?: MeasurementAuditEntry[];
}

export interface Workspace {
  obras: ProjectData[];
  activeId: string | null;
}
