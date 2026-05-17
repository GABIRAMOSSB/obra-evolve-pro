import { useEffect, useState } from "react";
import type { ObraInfo } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  nome: string;
  info?: ObraInfo;
  onSave: (nome: string, info: ObraInfo) => void;
}

export function ObraInfoDialog({ nome, info, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(nome);
  const [data, setData] = useState<ObraInfo>(info ?? {});

  useEffect(() => {
    if (open) {
      setN(nome);
      setData(info ?? {});
    }
  }, [open, nome, info]);

  function save() {
    if (!n.trim()) {
      toast.error("Nome da obra é obrigatório");
      return;
    }
    onSave(n.trim(), data);
    setOpen(false);
    toast.success("Dados da obra atualizados");
  }

  function field(key: keyof ObraInfo, label: string, placeholder?: string) {
    return (
      <div>
        <Label className="text-xs">{label}</Label>
        <Input
          value={data[key] ?? ""}
          onChange={(e) => setData({ ...data, [key]: e.target.value })}
          placeholder={placeholder}
        />
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Building2 className="w-4 h-4 mr-1" /> Dados da obra
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Identificação da obra</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label className="text-xs">Nome da obra</Label>
            <Input value={n} onChange={(e) => setN(e.target.value)} />
          </div>
          {field("cliente", "Cliente")}
          {field("empresaExecutora", "Empresa executora")}
          <div className="sm:col-span-2">{field("endereco", "Endereço")}</div>
          {field("responsavelTecnico", "Responsável técnico")}
          {field("artRrt", "ART / RRT", "Nº ART ou RRT")}
          {field("numeroContrato", "Número do contrato")}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
