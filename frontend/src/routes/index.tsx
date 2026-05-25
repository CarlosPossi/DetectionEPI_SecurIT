import { createFileRoute } from "@tanstack/react-router";
import {
  ShieldCheck,
  CircleDot,
  RotateCcw,
  User,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Timer,
} from "lucide-react";

import { useState, useEffect, useCallback } from "react";
import { FacialLogin } from "@/components/terminal/FacialLogin";
import { EpiSelection } from "@/components/terminal/EpiSelection";
import { LocationRegistration } from "@/components/terminal/LocationRegistration";
import WebcamDetection from "@/components/WebcamDetection";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

type Detection = {
  label: string;
  box: number[];
  conf: number;
};

type TerminalStep = "login" | "epi-setup" | "location" | "monitoring";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [step, setStep] = useState<TerminalStep>("login");
  const [detections, setDetections] = useState<Detection[]>([]);
  const [userData, setUserData] = useState({ id: "", name: "" });
  const [selectedEpis, setSelectedEpis] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [checkInTime, setCheckInTime] = useState("");

  // Lógica de Média de 1 Minuto
  const [monitoringProgress, setMonitoringProgress] = useState(0);
  const [history, setHistory] = useState<boolean[]>([]);

  const calculateFinalAverage = useCallback(() => {
    const complianceRate = history.filter((v) => v).length / history.length;
    const isCompliant = complianceRate > 0.8; // 80% de presença

    if (isCompliant) {
      toast.success("Média de 1 min concluída: Conformidade OK!", {
        description: "Dados enviados para o SPI_Challenge.",
      });
    } else {
      toast.error("Alerta Crítico!", {
        description: "Baixa conformidade detectada na média do último minuto.",
      });
    }
    // Reinicia o ciclo de monitoramento
    setMonitoringProgress(0);
    setHistory([]);
  }, [history]);

  useEffect(() => {
    if (step === "monitoring") {
      const interval = setInterval(() => {
        setMonitoringProgress((prev) => {
          if (prev >= 100) {
            calculateFinalAverage();
            return 100;
          }
          return prev + 1.66; // Simula 60 segundos (100 / 60)
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [step, calculateFinalAverage]);

  const handleLoginSuccess = (id: string, name: string) => {
    setUserData({ id, name });
    setCheckInTime(
      new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
    setStep("epi-setup");
    toast.success(`Acesso identificado: ${name}`);
  };

  const handleEpiConfirm = (epis: string[]) => {
    setSelectedEpis(epis);
    setStep("location");
  };

  const handleLocationConfirm = (loc: string) => {
    setLocation(loc);
    setStep("monitoring");
    toast.info("Iniciando monitoramento de 1 minuto...");
  };

  const restart = () => {
    setStep("login");
    setUserData({ id: "", name: "" });
    setSelectedEpis([]);
    setLocation("");
    setMonitoringProgress(0);
    setHistory([]);
  };

  // Verificação de conformidade em tempo real
  const norm = (text: string) => text.toLowerCase();
  const getEpiStatus = useCallback(
    (id: string) => {
      return detections.some((d) => {
        const label = norm(d.label);
        if (id === "helmet")
          return (label.includes("capacete") || label.includes("helmet")) && !label.includes("no_");
        if (id === "vest") return label.includes("macacao") || label.includes("vest");
        if (id === "mask") return label.includes("mascara") || label.includes("mask");
        if (id === "glasses") return label.includes("oculos") || label.includes("glasses");
        if (id === "gloves") return label.includes("luva") || label.includes("glove");
        if (id === "boots") return label.includes("bota") || label.includes("boot");
        return false;
      });
    },
    [detections],
  );

  // Registra histórico para a média
  useEffect(() => {
    if (step === "monitoring" && selectedEpis.length > 0) {
      const isOk = selectedEpis.every((epi) => getEpiStatus(epi));
      setHistory((prev) => [...prev, isOk]);
    }
  }, [step, selectedEpis, getEpiStatus]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="rounded-2xl border border-border bg-panel shadow-2xl overflow-hidden transition-all">
          {/* HEADER */}
          <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/40">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold tracking-wide">
                  Secur<span className="text-primary">IT</span>
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-tighter">
                  Módulo Terminal · {step.replace("-", " ")}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {userData.name && (
                <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-full text-xs font-medium">
                  <User className="h-3 w-3" /> {userData.name}
                </div>
              )}
              {location && (
                <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium border border-primary/20">
                  <MapPin className="h-3 w-3" /> {location}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-success/15 border border-success/30 text-success uppercase font-bold">
                <CircleDot className="h-3.5 w-3.5 animate-pulse" />
                Sistema Online
              </span>
            </div>
          </header>

          {/* MAIN CONTENT AREA */}
          <div className="p-8 min-h-[500px]">
            {step === "login" && <FacialLogin onSuccess={handleLoginSuccess} />}

            {step === "epi-setup" && (
              <EpiSelection userName={userData.name} onConfirm={handleEpiConfirm} />
            )}

            {step === "location" && <LocationRegistration onConfirm={handleLocationConfirm} />}

            {step === "monitoring" && (
              <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8">
                {/* Visualização da Câmera */}
                <div className="space-y-4">
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border-4 border-border bg-black shadow-inner">
                    <WebcamDetection onDetections={setDetections} />
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border">
                    <Timer className="h-5 w-5 text-primary" />
                    <div className="flex-1 space-y-1.5">
                      <div className="flex justify-between text-xs font-bold uppercase">
                        <span>Ciclo de Média (1 min)</span>
                        <span>{Math.round(monitoringProgress)}%</span>
                      </div>
                      <Progress value={monitoringProgress} className="h-2" />
                    </div>
                  </div>
                </div>

                {/* Status Lateral */}
                <div className="space-y-6">
                  <div
                    className={`p-6 rounded-2xl border-2 flex flex-col items-center text-center gap-3 ${
                      selectedEpis.every((e) => getEpiStatus(e))
                        ? "bg-success/5 border-success/20"
                        : "bg-danger/5 border-danger/20"
                    }`}
                  >
                    {selectedEpis.every((e) => getEpiStatus(e)) ? (
                      <CheckCircle2 className="h-12 w-12 text-success" />
                    ) : (
                      <AlertCircle className="h-12 w-12 text-danger" />
                    )}
                    <h3
                      className={`text-2xl font-black uppercase ${
                        selectedEpis.every((e) => getEpiStatus(e)) ? "text-success" : "text-danger"
                      }`}
                    >
                      {selectedEpis.every((e) => getEpiStatus(e)) ? "Seguro" : "Violação"}
                    </h3>
                  </div>

                  <div className="bg-card rounded-2xl border p-6 space-y-4">
                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                      EPIs Verificados
                    </h4>
                    <div className="space-y-3">
                      {selectedEpis.map((id) => (
                        <div
                          key={id}
                          className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border"
                        >
                          <span className="font-semibold capitalize">
                            {id === "helmet" ? "Capacete" : id === "vest" ? "Colete" : id}
                          </span>
                          {getEpiStatus(id) ? (
                            <BadgeCheck className="h-5 w-5 text-success" />
                          ) : (
                            <XCircle className="h-5 w-5 text-danger" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-muted/20 rounded-xl border border-border text-center">
                      <Clock className="h-4 w-4 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-[10px] uppercase text-muted-foreground">Check-in</p>
                      <p className="font-bold">{checkInTime}</p>
                    </div>
                    <div className="p-4 bg-muted/20 rounded-xl border border-border text-center">
                      <Timer className="h-4 w-4 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-[10px] uppercase text-muted-foreground">Tempo Total</p>
                      <p className="font-bold">00:02:15</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* FOOTER */}
          <footer className="flex items-center justify-between px-8 py-4 border-t border-border bg-card/20">
            <div className="text-xs text-muted-foreground">
              ID Terminal: <span className="font-mono">T-SA-04-26</span>
            </div>
            <button
              onClick={restart}
              className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Reiniciar Sessão
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}

// Subcomponente de Badge pra simplificar
function BadgeCheck({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success/10 border border-success/30 text-success text-[10px] font-black uppercase ${className}`}
    >
      <CheckCircle2 className="h-3 w-3" /> OK
    </div>
  );
}

function XCircle({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-danger/10 border border-danger/30 text-danger text-[10px] font-black uppercase ${className}`}
    >
      <AlertCircle className="h-3 w-3" /> Ausente
    </div>
  );
}
