import { useState } from "react";
import { Cpu, ArrowLeft, Navigation, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Machine } from "@/components/terminal/LocationRegistration";

interface MachineSelectionProps {
  sectorName: string;
  machines: Machine[];
  onConfirm: (machineName: string) => void;
  onBack: () => void;
}

export function MachineSelection({
  sectorName,
  machines,
  onConfirm,
  onBack,
}: MachineSelectionProps) {
  const [selectedMachine, setSelectedMachine] = useState<string>("");

  const hasMachines = machines && machines.length > 0;
  const canConfirm = !hasMachines || Boolean(selectedMachine);

  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm(selectedMachine);
    }
  };

  return (
    <div className="space-y-6 py-4 animate-in fade-in-50 duration-200">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Em qual máquina você vai trabalhar?</h2>
        <p className="text-muted-foreground">
          Selecione o equipamento que você irá operar em{" "}
          <strong className="text-foreground">{sectorName}</strong>.
        </p>
      </div>

      {hasMachines ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-2">
          {machines.map((m) => {
            const isSelected = selectedMachine === m.name;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMachine(m.name)}
                className={`flex items-center gap-4 p-5 rounded-xl border-2 text-left transition-all ${
                  isSelected
                    ? "border-primary bg-primary/10 shadow-md"
                    : "border-border bg-card hover:border-primary/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                <div
                  className={`p-3 rounded-lg shrink-0 ${
                    isSelected ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Cpu className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-lg text-foreground truncate">{m.name}</p>
                  <p className="text-xs text-muted-foreground">Posto de operação</p>
                </div>
                {isSelected && (
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 animate-in zoom-in-50" />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-10 border-2 border-dashed rounded-xl space-y-3 bg-muted/20">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Nenhuma máquina cadastrada para este setor.</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
              Você pode finalizar o registro sem vincular máquina ou cadastrar novas máquinas pelo painel SPI_Challenge.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-4 pt-4">
        <Button
          type="button"
          size="lg"
          className="px-8 h-14 text-base gap-2 bg-card text-foreground border-2 border-border hover:bg-muted hover:text-foreground transition-all shadow-sm"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
          Voltar
        </Button>

        <Button
          type="button"
          size="lg"
          className="px-10 h-14 text-lg gap-2"
          disabled={!canConfirm}
          onClick={handleConfirm}
        >
          <Navigation className="h-5 w-5" />
          Finalizar Registro
        </Button>
      </div>
    </div>
  );
}

export default MachineSelection;
