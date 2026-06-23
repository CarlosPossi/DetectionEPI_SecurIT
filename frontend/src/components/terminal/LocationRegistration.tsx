import { useState, useEffect } from "react";
import { MapPin, Navigation, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Sector {
  id: string;
  name: string;
  description?: string;
  requiredEPIs: string[];
}

interface LocationRegistrationProps {
  onConfirm: (sector: Sector) => void;
}

export function LocationRegistration({ onConfirm }: LocationRegistrationProps) {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [selected, setSelected] = useState<Sector | null>(null);
  const [loading, setLoading] = useState(true);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001";

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/sectors`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSectors(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Erro ao carregar setores:", err);
        setLoading(false);
      });
  }, [BACKEND_URL]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p>Carregando setores disponíveis...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Onde você vai trabalhar?</h2>
        <p className="text-muted-foreground">
          Selecione o setor para configurar os EPIs automaticamente.
        </p>
      </div>

      <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2">
        {sectors.length > 0 ? (
          sectors.map((loc) => (
            <button
              key={loc.id}
              onClick={() => setSelected(loc)}
              className={`flex items-center gap-4 p-5 rounded-xl border-2 text-left transition-all ${
                selected?.id === loc.id
                  ? "border-primary bg-primary/10 shadow-md"
                  : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <div
                className={`p-3 rounded-lg ${selected?.id === loc.id ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}
              >
                <MapPin className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-lg">{loc.name}</p>
                <p className="text-sm text-muted-foreground">{loc.description}</p>
              </div>
              <div className="text-xs font-medium bg-muted px-2 py-1 rounded">
                {loc.requiredEPIs.length} EPIs
              </div>
            </button>
          ))
        ) : (
          <div className="text-center py-8 border-2 border-dashed rounded-xl">
            <p className="text-muted-foreground">Nenhum setor encontrado.</p>
          </div>
        )}
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
