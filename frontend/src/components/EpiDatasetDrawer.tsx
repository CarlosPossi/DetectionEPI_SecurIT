import { useEffect, useState } from "react";
import {
  X,
  HardHat,
  Shield,
  Glasses,
  Shirt,
  Footprints,
  Hand,
  Ear,
  Eye,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

type EpiItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const EPI_CATALOG: EpiItem[] = [
  { id: "helmet", label: "Capacete", icon: HardHat },
  { id: "vest", label: "Colete refletivo", icon: Shirt },
  { id: "glasses", label: "Óculos de proteção", icon: Glasses },
  { id: "gloves", label: "Luvas", icon: Hand },
  { id: "boots", label: "Botas de segurança", icon: Footprints },
  { id: "earplug", label: "Protetor auricular", icon: Ear },
  { id: "mask", label: "Máscara facial", icon: Shield },
  { id: "faceshield", label: "Protetor facial", icon: Eye },
];

type Props = {
  trigger?: (open: () => void) => React.ReactNode;
};

export function EpiDatasetDrawer({ trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(["helmet", "vest", "boots"]));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openFn = () => setOpen(true);

  // Trava a tela principal: bloqueia scroll do body e tecla ESC para fechar
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {trigger ? (
        trigger(openFn)
      ) : (
        <button
          type="button"
          onClick={openFn}
          aria-label="Configurar dataset de EPIs"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card text-sm text-foreground hover:bg-accent transition-colors"
        >
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          Ativar EPIs
        </button>
      )}

      {/* Modal */}
      <div
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
          "w-[min(92vw,440px)] max-h-[85vh] flex flex-col",
          "bg-card text-card-foreground rounded-2xl border border-border shadow-2xl",
          "transition-all duration-200",
          open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none",
        )}
      >
        <header className="flex items-start justify-between px-6 py-5 border-b border-border">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              <Shield className="h-3.5 w-3.5 text-primary" />
              Configuração
            </div>
            <h2 className="mt-1 text-lg font-semibold">Dataset de EPIs</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Selecione os equipamentos que a visão computacional deve fiscalizar.
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {EPI_CATALOG.map((item) => {
            const Icon = item.icon;
            const active = selected.has(item.id);
            return (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all",
                  active
                    ? "bg-danger-soft border-primary/40 text-foreground"
                    : "bg-card border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-md border",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary border-border",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1 text-sm font-medium">{item.label}</span>
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full",
                    active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {active ? "Ativo" : "Inativo"}
                </span>
              </button>
            );
          })}

          <button className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <Plus className="h-4 w-4" />
            <span className="text-sm">Adicionar EPI customizado</span>
          </button>
        </div>

        <footer className="px-6 py-4 border-t border-border bg-secondary/40 rounded-b-2xl">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">EPIs ativos</span>
            <span className="font-semibold text-foreground">
              {selected.size} / {EPI_CATALOG.length}
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="mt-3 w-full py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Salvar dataset
          </button>
        </footer>
      </div>
    </>
  );
}
