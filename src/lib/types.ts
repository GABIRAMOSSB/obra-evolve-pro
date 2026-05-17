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

export interface Evolution {
  quantExec: number;
  dataExec: string;
  observacoes: string;
}

export interface DiaryEntry {
  id: string;
  itemKey: string;
  data: string;
  clima: string;
  equipe: string;
  equipamentos: string;
  observacoes: string;
  quantExec: number;
  etapa: string;
  atividade: string;
  texto: string;
  createdAt: string;
}

export interface ProjectData {
  id: string;
  nome: string;
  fileName: string;
  importedAt: string;
  rows: BudgetRow[];
  evolutions: Record<string, Evolution>;
  diaries: DiaryEntry[];
}

export interface Workspace {
  obras: ProjectData[];
  activeId: string | null;
}
