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

export type InsumoOpt = {
  id: string;
  codigo: string | null;
  descricao: string;
};

type Props = {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  insumos: InsumoOpt[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function InsumoSelect({
  value,
  onChange,
  insumos,
  placeholder = "Insumo…",
  className,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);

  const current = useMemo(
    () => insumos.find((i) => i.id === value),
    [insumos, value],
  );
  const label = current
    ? `${current.codigo ? `[${current.codigo}] ` : ""}${current.descricao}`
    : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate text-left">{label || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command
          filter={(val, search) => {
            if (!search) return 1;
            return val.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Buscar por código ou descrição…" />
          <CommandList>
            <CommandEmpty>Nenhum insumo encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="(não vinculado)"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    !value ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="text-muted-foreground">(não vinculado)</span>
              </CommandItem>
              {insumos.map((ins) => {
                const text = `${ins.codigo ?? ""} ${ins.descricao}`;
                return (
                  <CommandItem
                    key={ins.id}
                    value={text}
                    onSelect={() => {
                      onChange(ins.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === ins.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="flex-1 truncate">
                      {ins.codigo && (
                        <span className="font-mono text-xs mr-2 text-muted-foreground">
                          [{ins.codigo}]
                        </span>
                      )}
                      {ins.descricao}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
