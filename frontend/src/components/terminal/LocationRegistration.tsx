import { useState, useEffect } from "react";
import { MapPin, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Machine {
  id: string;
  name: string;
  sectorId?: string;
}

export interface Sector {
  id: string;
  name: string;
  description?: string;
  requiredEPIs: string[];
  machines?: Machine[];
}

interface LocationRegistrationProps {
  onConfirm: (sector: Sector) => void;
}

export function LocationRegistration({ onConfirm }: LocationRegistrationProps) {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [selected, setSelected] = useState<Sector | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadSectors() {
      setLoading(true);
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001";
      const SPI_URL = "http://localhost:3000";

      // 1. Tenta buscar da API do DetectionEPI (Flask 5001)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const res = await fetch(`${BACKEND_URL}/api/sectors`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            if (isMounted) {
              setSectors(data);
              setLoading(false);
            }
            return;
          }
        }
      } catch (err) {
        console.warn("Aviso ao buscar setores do backend Flask (tentando SPI_Challenge):", err);
      }

      // 2. Fallback de consulta direta para a API do SPI_Challenge (Next.js 3000)
      try {
        const res = await fetch(`${SPI_URL}/api/sectors`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && isMounted) {
            setSectors(data);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error("Falha ao buscar setores do SPI_Challenge:", err);
      }

      if (isMounted) {
        setLoading(false);
      }
    }

    loadSectors();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p>Carregando setores disponíveis...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4 animate-in fade-in-50 duration-200">
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
              type="button"
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
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg truncate">{loc.name}</p>
                <p className="text-sm text-muted-foreground truncate">{loc.description}</p>
              </div>
              <div className="text-xs font-medium bg-muted px-2.5 py-1 rounded-md shrink-0">
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
          <span>Continuar</span>
          <ArrowRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

export default LocationRegistration;
