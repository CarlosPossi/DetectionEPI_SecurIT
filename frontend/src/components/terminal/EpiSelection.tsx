import { useState } from "react";
import { CheckCircle2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EpiSelectionProps {
  onConfirm: (epis: string[]) => void;
  userName: string;
}

const EPI_LIST = [
  { id: "helmet", label: "Capacete", icon: "🪖" },
  { id: "vest", label: "Colete Refletivo", icon: "🦺" },
  { id: "mask", label: "Máscara", icon: "😷" },
  { id: "glasses", label: "Óculos de Proteção", icon: "🥽" },
  { id: "gloves", label: "Luvas", icon: "🧤" },
  { id: "boots", label: "Botas de Segurança", icon: "🥾" },
];

export function EpiSelection({ onConfirm, userName }: EpiSelectionProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggleEpi = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-6 py-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Olá, {userName}!</h2>
        <p className="text-muted-foreground">
          Selecione os EPIs obrigatórios para sua tarefa hoje.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {EPI_LIST.map((epi) => (
          <button
            key={epi.id}
            onClick={() => toggleEpi(epi.id)}
            className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all ${
              selected.includes(epi.id)
                ? "border-primary bg-primary/10 shadow-lg scale-105"
                : "border-border bg-card hover:border-primary/50"
            }`}
          >
            <span className="text-4xl">{epi.icon}</span>
            <span className="font-semibold">{epi.label}</span>
            {selected.includes(epi.id) && <CheckCircle2 className="h-5 w-5 text-primary" />}
          </button>
        ))}
      </div>

      <div className="flex justify-center pt-6">
        <Button
          size="lg"
          className="px-12 gap-2 h-14 text-lg"
          disabled={selected.length === 0}
          onClick={() => onConfirm(selected)}
        >
          <Shield className="h-5 w-5" />
          Confirmar e Prosseguir
        </Button>
      </div>
    </div>
  );
}
