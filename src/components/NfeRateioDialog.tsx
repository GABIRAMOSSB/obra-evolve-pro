import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/nfe-parser";
import type { BudgetRow } from "@/lib/types";

export type RateioItem = {
  id: string;
  descricao: string;
  unidade: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  insumo_id: string | null;
};

export type RateioNota = {
  id: string;
  numero: string;
  emitente_nome: string | null;
};

type ObraOpt = { id: string; nome: string; rows: BudgetRow[] };

type RateioRow = {
  key: string;
  id: string | null; // db id, if existing
  obra_id: string;
  item_codigo: string;
  centro_custo: string;
  frente_servico: string;
  quantidade: number;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  item: RateioItem | null;
  nota: RateioNota | null;
  obras: ObraOpt[];
  onSaved?: () => void;
};

export function NfeRateioDialog({ open, onOpenChange, companyId, item, nota, obras, onSaved }: Props) {
  const [rows, setRows] = useState<RateioRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    setLoading(true);
    supabase
      .from("nfe_item_apropriacoes")
      .select("id,obra_id,item_codigo,centro_custo,frente_servico,quantidade")
      .eq("nota_fiscal_item_id", item.id)
      .then(({ data, error }) => {
        if (error) {
          toast.error(error.message);
          setLoading(false);
          return;
        }
        const existing: RateioRow[] = (data ?? []).map((r) => ({
          key: r.id,
          id: r.id,
          obra_id: r.obra_id ?? "",
          item_codigo: r.item_codigo ?? "",
          centro_custo: r.centro_custo ?? "",
          frente_servico: r.frente_servico ?? "",
          quantidade: Number(r.quantidade ?? 0),
        }));
        if (existing.length === 0) {
          existing.push({
            key: crypto.randomUUID(),
            id: null,
            obra_id: "",
            item_codigo: "",
            centro_custo: "",
            frente_servico: "",
            quantidade: item.quantidade,
          });
        }
        setRows(existing);
        setLoading(false);
      });
  }, [open, item]);

  if (!item || !nota) return null;

  const totalQtd = rows.reduce((s, r) => s + (Number(r.quantidade) || 0), 0);
  const restante = item.quantidade - totalQtd;
  const valorUnit = item.valor_unitario;

  const addRow = () => {
    setRows((p) => [
      ...p,
      {
        key: crypto.randomUUID(),
        id: null,
        obra_id: "",
        item_codigo: "",
        centro_custo: "",
        frente_servico: "",
        quantidade: Math.max(0, restante),
      },
    ]);
  };

  const removeRow = (key: string) => {
    setRows((p) => p.filter((r) => r.key !== key));
  };

  const updateRow = (key: string, patch: Partial<RateioRow>) => {
    setRows((p) => p.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const distribuirIgual = () => {
    if (rows.length === 0) return;
    const cada = +(item.quantidade / rows.length).toFixed(4);
    setRows((p) => p.map((r, i) => ({ ...r, quantidade: i === p.length - 1 ? +(item.quantidade - cada * (p.length - 1)).toFixed(4) : cada })));
  };

  const save = async () => {
    if (rows.length === 0) {
      toast.error("Inclua ao menos uma apropriação");
      return;
    }
    const invalid = rows.find((r) => !r.obra_id || !r.item_codigo || !r.quantidade);
    if (invalid) {
      toast.error("Preencha obra, composição e quantidade em todas as linhas");
      return;
    }
    if (totalQtd > item.quantidade + 0.001) {
      toast.error(`Quantidade total (${totalQtd}) ultrapassa o item (${item.quantidade})`);
      return;
    }
    setSaving(true);

    // delete all existing for this item then re-insert
    const { error: delErr } = await supabase
      .from("nfe_item_apropriacoes")
      .delete()
      .eq("nota_fiscal_item_id", item.id);
    if (delErr) {
      toast.error(delErr.message);
      setSaving(false);
      return;
    }

    const payload = rows.map((r) => {
      const obra = obras.find((o) => o.id === r.obra_id);
      const comp = obra?.rows.find((b) => b.codigo === r.item_codigo && !b.isGroup);
      const valor_total = +(r.quantidade * valorUnit).toFixed(2);
      return {
        company_id: companyId,
        nota_fiscal_id: nota.id,
        nota_fiscal_item_id: item.id,
        obra_id: r.obra_id,
        item_codigo: r.item_codigo,
        item_descricao: comp?.descricao ?? null,
        insumo_id: item.insumo_id,
        descricao_insumo: item.descricao,
        unidade: item.unidade,
        quantidade: r.quantidade,
        valor_unitario: valorUnit,
        valor_total,
        centro_custo: r.centro_custo || null,
        frente_servico: r.frente_servico || null,
      };
    });

    const { error: insErr } = await supabase.from("nfe_item_apropriacoes").insert(payload);
    if (insErr) {
      toast.error(insErr.message);
      setSaving(false);
      return;
    }
    toast.success(`${payload.length} apropriação(ões) salvas`);
    setSaving(false);
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Apropriar com rateio — {item.descricao}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3 text-sm">
            <Info label="NF-e" value={`${nota.numero} • ${nota.emitente_nome ?? ""}`} />
            <Info label="Quantidade total" value={`${item.quantidade.toLocaleString("pt-BR")} ${item.unidade ?? ""}`} />
            <Info label="Valor unitário" value={formatMoney(item.valor_unitario)} />
            <Info label="Valor total" value={formatMoney(item.valor_total)} />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="text-sm">
              <span className="text-muted-foreground mr-2">Restante:</span>
              <span className={Math.abs(restante) < 0.001 ? "text-emerald-600 font-medium" : restante < 0 ? "text-destructive font-medium" : "text-amber-600 font-medium"}>
                {restante.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} {item.unidade ?? ""}
              </span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={distribuirIgual} disabled={rows.length < 2}>
                Distribuir igualmente
              </Button>
              <Button size="sm" variant="outline" onClick={addRow}>
                <Plus className="w-4 h-4 mr-1" /> Linha
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground p-6 text-center">Carregando…</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Obra</TableHead>
                    <TableHead>Composição</TableHead>
                    <TableHead>Centro de custo</TableHead>
                    <TableHead>Frente de serviço</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const obra = obras.find((o) => o.id === r.obra_id);
                    const compRows = (obra?.rows ?? []).filter((b) => !b.isGroup && b.codigo);
                    return (
                      <TableRow key={r.key}>
                        <TableCell>
                          <Select value={r.obra_id} onValueChange={(v) => updateRow(r.key, { obra_id: v, item_codigo: "" })}>
                            <SelectTrigger className="w-full min-w-[10rem]"><SelectValue placeholder="Obra…" /></SelectTrigger>
                            <SelectContent>
                              {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select value={r.item_codigo} onValueChange={(v) => updateRow(r.key, { item_codigo: v })} disabled={!r.obra_id}>
                            <SelectTrigger className="w-full min-w-[14rem]"><SelectValue placeholder={r.obra_id ? "Composição…" : "Defina obra"} /></SelectTrigger>
                            <SelectContent>
                              {compRows.map((b) => (
                                <SelectItem key={b.codigo} value={b.codigo}>
                                  <span className="font-mono mr-2">{b.codigo}</span>{b.descricao}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Centro custo"
                            value={r.centro_custo}
                            onChange={(e) => updateRow(r.key, { centro_custo: e.target.value })}
                            className="w-full min-w-[7rem]"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Frente"
                            value={r.frente_servico}
                            onChange={(e) => updateRow(r.key, { frente_servico: e.target.value })}
                            className="w-full min-w-[7rem]"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.001"
                            value={r.quantidade}
                            onChange={(e) => updateRow(r.key, { quantidade: Number(e.target.value) || 0 })}
                            className="w-full min-w-[6rem] text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {formatMoney(r.quantidade * valorUnit)}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => removeRow(r.key)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving || loading}>
              {saving ? "Salvando…" : "Salvar rateio"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium truncate">{value}</div>
    </div>
  );
}
