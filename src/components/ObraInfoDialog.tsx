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

  function field(key: keyof ObraInfo, label: string, placeholder?: string, type: "text" | "number" | "date" = "text") {
    return (
      <div>
        <Label className="text-xs">{label}</Label>
        <Input
          type={type}
          value={(data[key] as string | number | undefined) ?? ""}
          onChange={(e) =>
            setData({
              ...data,
              [key]: type === "number" ? (e.target.value === "" ? undefined : Number(e.target.value)) : e.target.value,
            })
          }
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Identificação da obra</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2">Identificação</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs">Nome da obra *</Label>
                <Input value={n} onChange={(e) => setN(e.target.value)} />
              </div>
              {field("cliente", "Licitador")}
              {field("contratante", "Contratante")}
              {field("cnpjContratante", "CNPJ contratante", "00.000.000/0000-00")}
              {field("empresaExecutora", "Empresa executora")}
              {field("cnpj", "CNPJ executora", "00.000.000/0000-00")}
            </div>
          </section>

          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2">Localização</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">{field("endereco", "Endereço da obra")}</div>
              {field("municipio", "Município")}
              {field("estado", "Estado (UF)", "Ex.: SP")}
            </div>
          </section>

          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2">Contrato</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {field("numeroContrato", "Número do contrato")}
              {field("numeroLicitacao", "Número da licitação")}
              {field("processoAdministrativo", "Processo administrativo")}
              {field("dataInicioObra", "Data de início da obra", undefined, "date")}
              {field("prazoContratualDias", "Prazo contratual (dias)", "Ex.: 180", "number")}
              <div className="sm:col-span-2">
                <Label className="text-xs">Objeto do contrato</Label>
                <textarea
                  className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={data.objetoContrato ?? ""}
                  onChange={(e) => setData({ ...data, objetoContrato: e.target.value })}
                  placeholder="Descrição do objeto contratado (obra/serviço)…"
                />
              </div>
            </div>
          </section>


          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2">Responsáveis da obra</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {field("responsavelTecnico", "Responsável técnico / Engenheiro")}
              {field("crea", "CREA / CAU")}
              {field("cargoResponsavel", "Cargo / Função do engenheiro")}
              {field("artRrt", "ART / RRT")}
              {field("fiscal", "Fiscal da obra")}
              {field("creaFiscal", "CREA/CAU do fiscal")}
              {field("cargoFiscal", "Cargo / Função do fiscal")}
            </div>
          </section>

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
