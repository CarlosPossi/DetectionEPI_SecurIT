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
  XCircle,
  BadgeCheck
} from "lucide-react";

import { useState, useEffect, useCallback, useRef } from "react";
import { TerminalEntry } from "@/components/terminal/TerminalEntry";
import { FacialLogin } from "@/components/terminal/FacialLogin";
import { EmployeeSelection } from "@/components/terminal/EmployeeSelection";
import { FaceRegistration } from "@/components/terminal/FaceRegistration";
import { EpiSelection } from "@/components/terminal/EpiSelection";
import { LocationRegistration } from "@/components/terminal/LocationRegistration";
import WebcamDetection, { WebcamDetectionHandle } from "@/components/WebcamDetection";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

type Detection = {
  label: string;
  box: number[];
  conf: number;
};

type TerminalStep = "entry" | "login" | "employee-select" | "face-registration" | "epi-setup" | "location" | "monitoring";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [step, setStep] = useState<TerminalStep>("entry");
  const [detections, setDetections] = useState<Detection[]>([]);
  const [userData, setUserData] = useState({ id: "", name: "" });
  const [isManualSelection, setIsManualSelection] = useState(false);
  const [selectedEpis, setSelectedEpis] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [checkInTime, setCheckInTime] = useState("");

  const webcamHandleRef = useRef<WebcamDetectionHandle>(null);
  const violationSnapshotRef = useRef<string | null>(null);

  // Lógica de Média de 1 Minuto
  const [monitoringProgress, setMonitoringProgress] = useState(0);
  const [history, setHistory] = useState<Record<string, boolean>[]>([]);
  const [totalSeconds, setTotalSeconds] = useState(0);

  const SPI_API_URL = import.meta.env.VITE_SPI_API_URL || "http://localhost:5001";

  const restart = async () => {
    // 🔥 Se houver um usuário logado, envia o logout automático antes de reiniciar
    if (userData.name) {
      try {
        await fetch(`${SPI_API_URL}/api/detection`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeName: userData.name,
            status: "offline",
            location: "Pendente",
            alerts: [],
            images: [],
          }),
        });
      } catch (error) {
        console.error("Erro ao deslogar automaticamente no restart:", error);
      }
    }

    setStep("entry");
    setUserData({ id: "", name: "" });
    setSelectedEpis([]);
    setLocation("");
    setMonitoringProgress(0);
    setHistory([]);
    setTotalSeconds(0);
    violationSnapshotRef.current = null;
  };

  // Verificação de conformidade em tempo real
  const norm = (text: string) => text.toLowerCase();
  const getEpiStatus = useCallback(
    (id: string) => {
      return detections.some((d) => {
        const label = norm(d.label);
        const hasNo = label.includes("no_") || label.includes("sem_");
        
        if (id === "helmet")
          return (label.includes("capacete") || label.includes("helmet")) && !hasNo;
        if (id === "vest") 
          return (label.includes("macacao") || label.includes("vest") || label.includes("colete")) && !hasNo;
        if (id === "mask") 
          return (label.includes("mascara") || label.includes("mask")) && !hasNo;
        if (id === "glasses") 
          return (label.includes("oculos") || label.includes("glasses")) && !hasNo;
        if (id === "gloves") 
          return (label.includes("luva") || label.includes("glove")) && !hasNo;
        if (id === "boots") 
          return (label.includes("bota") || label.includes("boot") || label.includes("sapato")) && !hasNo;
        return false;
      });
    },
    [detections],
  );

  const calculateFinalAverage = useCallback(async () => {
    if (history.length === 0) return;

    // Calcula média individual por EPI
    const epiAverages: Record<string, number> = {};
    selectedEpis.forEach(epi => {
      const okCount = history.filter(h => h[epi]).length;
      epiAverages[epi] = okCount / history.length;
    });

    const overallCompliance = history.filter(h => Object.values(h).every(v => v)).length / history.length;
    const isRiskArea = location.includes("Perigo");
    const isCompliant = overallCompliance >= 0.5 && !isRiskArea;

    const episOk = selectedEpis.filter(epi => epiAverages[epi] >= 0.5);
    const episMissing = selectedEpis.filter(epi => epiAverages[epi] < 0.5);

    const alerts = [];
    if (overallCompliance < 0.5) alerts.push(`Baixa conformidade detectada (${Math.round(overallCompliance * 100)}%)`);
    if (isRiskArea) alerts.push("🚨 ACESSO NÃO AUTORIZADO: Área de Alto Risco!");
    episMissing.forEach(epi => alerts.push(`Uso insuficiente de ${epi}`));

    try {
      await fetch(`${SPI_API_URL}/api/detection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeName: userData.name,
          location: location,
          status: isCompliant ? 'ok' : 'danger',
          compliance: overallCompliance * 100,
          episOk,
          episMissing,
          alerts: alerts,
          images: !isCompliant && violationSnapshotRef.current ? [violationSnapshotRef.current] : []
        })
      });

      if (isCompliant) {
        toast.success("Monitoramento concluído: Seguro!", { description: "Dados detalhados enviados." });
      } else {
        toast.error("Alerta Crítico Enviado!", { description: "Violação de segurança detectada." });
      }
    } catch (error) {
      console.error("Erro ao enviar:", error);
    }

    setMonitoringProgress(0);
    setHistory([]);
    violationSnapshotRef.current = null;
  }, [history, userData.name, location, selectedEpis, SPI_API_URL]);

  useEffect(() => {
    if (step === "monitoring") {
      const interval = setInterval(() => {
        setMonitoringProgress((prev) => {
          if (prev >= 100) return 100; // Mantém em 100 para o useEffect capturar
          return prev + 1.66;
        });
        setTotalSeconds(prev => prev + 1);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [step]);

  const formatTotalTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
  };

  useEffect(() => {
    if (monitoringProgress >= 100) {
      setMonitoringProgress(0); // Reseta IMEDIATAMENTE para evitar disparos duplicados em re-renders
      calculateFinalAverage();
    }
  }, [monitoringProgress, calculateFinalAverage]);

  const handleLoginStart = () => {
    setStep("login");
  };

  const handleRegisterStart = () => {
    setStep("face-registration");
  };

  const handleLoginSuccess = (user?: { id: string, name: string, requiredEPIs?: string[] }) => {
    if (user) {
      setUserData({ id: user.id, name: user.name });
      
      if (user.requiredEPIs && user.requiredEPIs.length > 0) {
        setSelectedEpis(user.requiredEPIs);
        setStep("location");
        toast.success(`Acesso identificado: ${user.name}`);
        toast.info(`EPIs configurados automaticamente.`);
      } else {
        setStep("epi-setup");
        toast.success(`Acesso identificado: ${user.name}`);
      }
    } else {
      toast.error("Rosto não reconhecido. Por favor, realize o cadastro.");
      setStep("entry");
    }
  };

  const handleRegistrationFaceCaptured = (imageBlob: Blob) => {
    // We store the captured face blob temporarily and move to employee selection
    (window as any).tempFaceBlob = imageBlob;
    setStep("employee-select");
    toast.info("Agora selecione seu perfil para vincular o cadastro.");
  };

  const handleEmployeeSelect = async (emp: { id: string, name: string, requiredEPIs?: string[] }) => {
    setUserData({ id: emp.id, name: emp.name });
    
    const faceBlob = (window as any).tempFaceBlob;
    if (faceBlob) {
      // Perform the actual linking now
      toast.loading("Vinculando biometria ao perfil...");
      try {
        const { socket } = await import("@/components/WebcamDetection");
        
        const registrationPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject("Tempo esgotado"), 10000);
          socket.once("registration_result", (data: any) => {
            clearTimeout(timeout);
            if (data.status === "success") resolve(data);
            else reject(data.message || "Erro no servidor");
          });
        });

        socket.emit("register_face", { image: faceBlob, employeeId: emp.id });
        await registrationPromise;
        
        toast.dismiss();
        toast.success(`Cadastro facial concluído para ${emp.name}`);
        delete (window as any).tempFaceBlob;
      } catch (error) {
        toast.dismiss();
        toast.error(`Erro ao salvar cadastro: ${error}`);
      }
    }

    if (emp.requiredEPIs && emp.requiredEPIs.length > 0) {
        setSelectedEpis(emp.requiredEPIs);
        setStep("location");
        toast.info(`EPIs configurados automaticamente.`);
    } else {
        setStep("epi-setup");
    }
  };

  const handleEpiConfirm = (epis: string[]) => {
    setSelectedEpis(epis);
    setStep("location");
  };

  const handleLocationConfirm = async (loc: string) => {
    setLocation(loc);
    const now = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    setCheckInTime(now);
    setStep("monitoring");
    toast.info("Iniciando monitoramento de 1 minuto...");

    // 🔥 Envio imediato do Check-in para o Dashboard
    console.log("📤 Enviando Check-in:", { employeeName: userData.name, location: loc, checkIn: now });
    try {
      await fetch(`${SPI_API_URL}/api/detection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeName: userData.name,
          location: loc,
          status: 'ok', 
          compliance: 100, 
          checkIn: now,
          alerts: [],
          images: []
        })
      });
      console.log("✅ Check-in enviado com sucesso");
    } catch (error) {
      console.error("❌ Falha ao enviar Check-in:", error);
    }
  };

  const handleEndSession = async () => {
    try {
      await fetch(`${SPI_API_URL}/api/detection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeName: userData.name,
          status: 'offline', 
          location: "Pendente",
          alerts: [],
          images: []
        })
      });
      toast.success("Sessão encerrada com sucesso.");
      restart();
    } catch (error) {
      console.error("Erro ao encerrar sessão:", error);
    }
  };

  // Registra histórico para a média e captura snapshot de erro
  useEffect(() => {
    if (step === "monitoring" && selectedEpis.length > 0) {
      const currentEpiStatus: Record<string, boolean> = {};
      selectedEpis.forEach(epi => {
        currentEpiStatus[epi] = getEpiStatus(epi);
      });

      setHistory((prev) => [...prev, currentEpiStatus]);

      const isOk = Object.values(currentEpiStatus).every(v => v);
      // Sempre captura o snapshot mais recente da violação para garantir que a imagem enviada seja a correta
      if (!isOk) {
        const snap = webcamHandleRef.current?.getScreenshot();
        if (snap) violationSnapshotRef.current = snap;
      }
    }
  }, [step, selectedEpis, getEpiStatus, detections]);

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
            {step === "entry" && (
              <TerminalEntry onLogin={handleLoginStart} onRegister={handleRegisterStart} />
            )}

            {step === "login" && <FacialLogin onSuccess={handleLoginSuccess} />}

            {step === "employee-select" && (
              <EmployeeSelection onSelect={handleEmployeeSelect} />
            )}

            {step === "face-registration" && (
              <FaceRegistration 
                employeeId={userData.id} 
                employeeName={userData.name} 
                onComplete={handleRegistrationFaceCaptured} 
              />
            )}

            {step === "epi-setup" && (
              <EpiSelection userName={userData.name} onConfirm={handleEpiConfirm} />
            )}

            {step === "location" && <LocationRegistration onConfirm={handleLocationConfirm} />}

            {step === "monitoring" && (
              <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8">
                {/* Visualização da Câmera */}
                <div className="space-y-4">
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border-4 border-border bg-black shadow-inner">
                    <WebcamDetection ref={webcamHandleRef} onDetections={setDetections} />
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
                            {id === "helmet" ? "Capacete" : id === "vest" ? "Colete" : id === "gloves" ? "Luvas" : id === "glasses" ? "Óculos" : id === "boots" ? "Botas" : id}
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
                      <p className="font-bold">{formatTotalTime(totalSeconds)}</p>
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
            <div className="flex gap-4">
              {step === "monitoring" && (
                <button
                  onClick={handleEndSession}
                  className="flex items-center gap-2 text-sm font-bold text-danger hover:opacity-80 transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                  Encerrar Sessão
                </button>
              )}
              <button
                onClick={restart}
                className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                Reiniciar
              </button>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
