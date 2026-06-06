import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCertificateScopeOptions,
  linkCertificateScope,
} from "@/lib/compliance-scope.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  certId: string;
  obraId: string | null;
  contratoId: string | null;
  onChanged?: () => void;
}

export function CertificateScopeCell({ certId, obraId, contratoId, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [obra, setObra] = useState<string | null>(obraId);
  const [contrato, setContrato] = useState<string | null>(contratoId);

  const optionsFn = useServerFn(listCertificateScopeOptions);
  const linkFn = useServerFn(linkCertificateScope);
  const qc = useQueryClient();

  const { data: opts, isLoading } = useQuery({
    queryKey: ["cert-scope-options"],
    queryFn: () => optionsFn(),
    enabled: open,
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: () =>
      linkFn({
        data: {
          company_certificate_id: certId,
          obra_id: obra,
          contrato_id: contrato,
        },
      }),
    onSuccess: () => {
      toast.success("Vínculo atualizado");
      qc.invalidateQueries({ queryKey: ["certificates"] });
      onChanged?.();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const obraLabel = obraId
    ? opts?.obras.find((o) => o.id === obraId)?.nome
    : null;
  const contratoLabel = contratoId
    ? opts?.contratos.find((c) => c.id === contratoId)?.numero
    : null;

  const filteredContratos = obra
    ? (opts?.contratos ?? []).filter((c) => c.obra_id === obra || c.obra_id == null)
    : opts?.contratos ?? [];

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 gap-1.5 text-xs"
        onClick={() => {
          setObra(obraId);
          setContrato(contratoId);
          setOpen(true);
        }}
      >
        <Link2 className="w-3 h-3" />
        {obraId || contratoId ? (
          <span className="truncate max-w-[140px]">
            {obraLabel ?? "Obra"}{contratoLabel ? ` · ${contratoLabel}` : ""}
          </span>
        ) : (
          <span className="text-muted-foreground">Vincular</span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular certidão a obra/contrato</DialogTitle>
          </DialogHeader>
          {isLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Obra</Label>
                <Select
                  value={obra ?? "__none"}
                  onValueChange={(v) => {
                    setObra(v === "__none" ? null : v);
                    setContrato(null);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Sem vínculo —</SelectItem>
                    {(opts?.obras ?? []).map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.nome}{o.codigo ? ` (${o.codigo})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Contrato</Label>
                <Select
                  value={contrato ?? "__none"}
                  onValueChange={(v) => setContrato(v === "__none" ? null : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Sem vínculo —</SelectItem>
                    {filteredContratos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.numero}{c.objeto ? ` — ${c.objeto.slice(0, 40)}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {opts && opts.contratos.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum contrato cadastrado.
                  </p>
                )}
              </div>

              <Badge variant="outline" className="text-[10px]">
                A certidão pode permanecer sem vínculo (escopo da empresa).
              </Badge>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
