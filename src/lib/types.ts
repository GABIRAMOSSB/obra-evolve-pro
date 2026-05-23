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
  /** Número da medição atualmente em aberto (global, 1-based). */
  currentMeasurement?: number;
  /** Auditoria de fechamento/reabertura de medições. */
  measurementLog?: MeasurementAuditEntry[];
}

export interface Workspace {
  obras: ProjectData[];
  activeId: string | null;
}
