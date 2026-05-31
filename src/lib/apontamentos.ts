// Sincroniza apontamentos de Mão de Obra e Equipamento gerados a partir do
// Diário de Obra. Cada DiaryEntry gera N linhas em `apontamentos_mao_obra`
// (recurso_tipo = 'mao_obra' | 'equipamento'), vinculadas via diary_entry_id.
// Ao editar ou apagar a entrada do diário, removemos e reinserimos os registros
// — assim o módulo Realizado reflete exatamente o que existe no diário.

import { supabase } from "@/integrations/supabase/client";
import type { DiaryEntry } from "./types";

const JORNADA_PADRAO = 8;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function deleteDiaryApontamentos(diaryId: string) {
  await db.from("apontamentos_mao_obra").delete().eq("diary_entry_id", diaryId);
}

export async function syncDiaryApontamentos(
  companyId: string,
  obraId: string,
  entry: DiaryEntry,
) {
  // Apaga sempre antes — comportamento idempotente.
  await deleteDiaryApontamentos(entry.id);

  const mo = entry.maoObraLinhas ?? [];
  const eq = entry.equipamentoLinhas ?? [];
  if (mo.length === 0 && eq.length === 0) return;

  const rows = [
    ...mo.map((l) => {
      const horasNormais = Math.min(l.horas, JORNADA_PADRAO) * l.quantidade;
      const horasExtras = Math.max(0, l.horas - JORNADA_PADRAO) * l.quantidade;
      const custoTotal = horasNormais * l.custoHora + horasExtras * l.custoHora * 1.5;
      return {
        company_id: companyId,
        obra_id: obraId,
        diary_entry_id: entry.id,
        recurso_tipo: "mao_obra",
        recurso_nome: l.funcaoNome,
        funcao_id: l.funcaoId ?? null,
        quantidade_pessoas: l.quantidade,
        jornada_horas: JORNADA_PADRAO,
        horas_normais: horasNormais,
        horas_extras: horasExtras,
        custo_hora: l.custoHora,
        custo_total: custoTotal,
        data: entry.data,
        item_codigo: l.itemCodigo ?? entry.itemKey,
        item_descricao: l.itemDescricao ?? entry.atividade,
        item_key: entry.itemKey,
        observacoes: `Diário ${entry.data} — ${entry.atividade}`,
      };
    }),
    ...eq.map((l) => {
      const horasNormais = Math.min(l.horas, JORNADA_PADRAO) * l.quantidade;
      const horasExtras = Math.max(0, l.horas - JORNADA_PADRAO) * l.quantidade;
      const custoTotal = horasNormais * l.custoHora + horasExtras * l.custoHora * 1.5;
      return {
        company_id: companyId,
        obra_id: obraId,
        diary_entry_id: entry.id,
        recurso_tipo: "equipamento",
        recurso_nome: l.equipamentoNome,
        equipamento_id: l.equipamentoId ?? null,
        quantidade_pessoas: l.quantidade,
        jornada_horas: JORNADA_PADRAO,
        horas_normais: horasNormais,
        horas_extras: horasExtras,
        custo_hora: l.custoHora,
        custo_total: custoTotal,
        data: entry.data,
        item_codigo: l.itemCodigo ?? entry.itemKey,
        item_descricao: l.itemDescricao ?? entry.atividade,
        item_key: entry.itemKey,
        observacoes: `Diário ${entry.data} — Equip: ${l.equipamentoNome}`,
      };
    }),
  ];

  const { error } = await db.from("apontamentos_mao_obra").insert(rows);
  if (error) throw error;
}
