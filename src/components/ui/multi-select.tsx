import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  className?: string;
  emptyLabel?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Selecionar...",
  searchable = false,
  className,
  emptyLabel = "Nenhuma opção",
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const label =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? (options.find((o) => o.value === value[0])?.label ?? value[0])
        : `${value.length} selecionados`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            value.length === 0 && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{label}</span>
          <span className="flex items-center gap-1 shrink-0">
            {value.length > 0 && (
              <X
                className="w-3.5 h-3.5 opacity-60 hover:opacity-100"
                onClick={clear}
              />
            )}
            <ChevronDown className="w-4 h-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[220px]" align="start">
        {searchable && (
          <div className="p-2 border-b">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="h-8"
            />
          </div>
        )}
        <div className="max-h-64 overflow-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">{emptyLabel}</div>
          ) : (
            filtered.map((o) => {
              const checked = value.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggle(o.value)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent text-left"
                >
                  <span
                    className={cn(
                      "w-4 h-4 rounded-sm border border-primary grid place-content-center shrink-0",
                      checked && "bg-primary text-primary-foreground",
                    )}
                  >
                    {checked && <Check className="w-3 h-3" />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })
          )}
        </div>
        {value.length > 0 && (
          <div className="border-t p-1.5 flex justify-between">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
              onClick={() => onChange([])}
            >
              Limpar
            </button>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
              onClick={() => setOpen(false)}
            >
              Fechar
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
