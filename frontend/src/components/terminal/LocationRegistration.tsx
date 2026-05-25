import { useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LocationRegistrationProps {
  onConfirm: (location: string) => void;
}

const LOCATIONS = [
  { id: "setor-a", name: "Setor A - Produção", description: "Área de máquinas pesadas" },
  { id: "setor-b", name: "Setor B - Logística", description: "Docas e armazenamento" },
  { id: "setor-c", name: "Setor C - Almoxarifado", description: "Estoque de materiais" },
  { id: "externo", name: "Área Externa", description: "Pátio e carregamento" },
  { id: "manutencao", name: "Oficina de Manutenção", description: "Reparos e ferramentas" },
];

export function LocationRegistration({ onConfirm }: LocationRegistrationProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-6 py-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Onde você vai trabalhar?</h2>
        <p className="text-muted-foreground">
          Registre sua localização para monitoramento em tempo real.
        </p>
      </div>

      <div className="grid gap-3">
        {LOCATIONS.map((loc) => (
          <button
            key={loc.id}
            onClick={() => setSelected(loc.name)}
            className={`flex items-center gap-4 p-5 rounded-xl border-2 text-left transition-all ${
              selected === loc.name
                ? "border-primary bg-primary/10 shadow-md"
                : "border-border bg-card hover:border-primary/30"
            }`}
          >
            <div
              className={`p-3 rounded-lg ${selected === loc.name ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}
            >
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-lg">{loc.name}</p>
              <p className="text-sm text-muted-foreground">{loc.description}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-center pt-6">
        <Button
          size="lg"
          className="px-12 gap-2 h-14 text-lg"
          disabled={!selected}
          onClick={() => selected && onConfirm(selected)}
        >
          <Navigation className="h-5 w-5" />
          Finalizar Registro
        </Button>
      </div>
    </div>
  );
}
