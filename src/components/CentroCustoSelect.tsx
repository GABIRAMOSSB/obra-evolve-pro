import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useCentrosCusto } from "@/hooks/use-centros-custo";

type Props = {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  /** Restringir a um tipo (administracao, materiais, etc) */
  tipo?: string;
  /** Mostrar apenas folhas (subgrupos), padrão true */
  onlyLeaves?: boolean;
};

export function CentroCustoSelect({
  value,
  onChange,
  placeholder = "Centro de custo…",
  className,
  disabled,
  required,
  tipo,
  onlyLeaves = false,
}: Props) {
  const { flatWithPath, byId, loading } = useCentrosCusto();
  const [open, setOpen] = useState(false);

  const options = useMemo(() => {
    return flatWithPath.filter((n) => {
      if (!n.ativo) return false;
      if (tipo && n.tipo !== tipo) return false;
      if (onlyLeaves && n.children.length > 0) return false;
      return true;
    });
  }, [flatWithPath, tipo, onlyLeaves]);

  const current = value ? byId.get(value) : undefined;
  const currentLabel = current
    ? (flatWithPath.find((n) => n.id === current.id)?.pathLabel ?? current.nome)
    : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          className={cn(
            "w-full justify-between font-normal",
            !value && (required ? "text-destructive/80" : "text-muted-foreground"),
            className,
          )}
        >
          <span className="truncate text-left">{currentLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar centro…" />
          <CommandList>
            <CommandEmpty>Nenhum centro encontrado.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={`${opt.pathLabel} ${opt.codigo ?? ""}`}
                  onSelect={() => {
                    onChange(opt.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === opt.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex-1 truncate">{opt.pathLabel}</span>
                  {opt.codigo && (
                    <span className="ml-2 text-[10px] font-mono text-muted-foreground">
                      {opt.codigo}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
