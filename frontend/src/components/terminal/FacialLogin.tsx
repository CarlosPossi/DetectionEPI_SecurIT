import { useState, useEffect, useRef } from "react";
import { Camera, UserCheck, Loader2, UserPlus, Search } from "lucide-react";
import WebcamDetection, { socket, WebcamDetectionHandle } from "@/components/WebcamDetection";
import { Button } from "@/components/ui/button";

interface FacialLoginProps {
  onSuccess: (user?: { id: string, name: string, requiredEPIs?: string[] }) => void;
}

export function FacialLogin({ onSuccess }: FacialLoginProps) {
  const [isIdentifying, setIsIdentifying] = useState(true);
  const [status, setStatus] = useState("Escaneando rosto...");
  const webcamRef = useRef<WebcamDetectionHandle>(null);
  const [attempts, setAttempts] = useState(0);
  const [isUnknown, setIsUnknown] = useState(false);
  const [guidance, setGuidance] = useState("Centralize seu rosto");

  useEffect(() => {
    const handleResult = (data: { status: string, user?: { id: string, name: string, requiredEPIs?: string[] }, message?: string }) => {
      console.log("Identification result:", data);
      
      if (data.status === "no_face") {
        setGuidance(data.message || "Aproxime-se da câmera");
        setStatus("Detectando...");
      } else if (data.status === "unknown") {
        setGuidance("Mantenha o rosto parado...");
        setAttempts(prev => prev + 1);
        if (attempts > 15) {
          setStatus("Não reconhecido");
          setIsUnknown(true);
        }
      } else if (data.status === "success" && data.user) {
        setGuidance("Identidade Confirmada!");
        setStatus(`Bem-vindo, ${data.user.name}!`);
        setIsIdentifying(false);
        setTimeout(() => onSuccess(data.user), 1500);
      }
    };

    socket.on("identification_result", handleResult);

    const interval = setInterval(async () => {
      if (!isIdentifying || isUnknown) return;

      const img = webcamRef.current?.getScreenshot();
      if (img) {
        const blob = await fetch(img).then(r => r.blob());
        socket.emit("identify_face", blob);
      }
    }, 2000);

    return () => {
      socket.off("identification_result", handleResult);
      clearInterval(interval);
    };
  }, [onSuccess, isIdentifying, attempts, isUnknown]);


  return (
    <div className="flex flex-col items-center justify-center space-y-6 py-10">
      <div className="relative h-64 w-64 overflow-hidden rounded-full border-4 border-primary/30 bg-black shadow-[0_0_30px_rgba(var(--primary),0.2)]">
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          {isIdentifying && !isUnknown && (
            <div className="absolute top-0 left-0 w-full h-1 bg-primary animate-scan-line shadow-[0_0_15px_rgba(var(--primary),0.8)]" />
          )}
        </div>
        <WebcamDetection ref={webcamRef} onDetections={() => {}} />
      </div>

      <div className="text-center space-y-4 w-full max-w-sm">
        <div className="flex flex-col items-center justify-center gap-1">
          <div className="flex items-center gap-2 text-xl font-bold">
            {isIdentifying && !isUnknown ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span>{status}</span>
              </>
            ) : isUnknown ? (
              <span className="text-warning">Não reconhecido</span>
            ) : (
              <>
                <UserCheck className="h-6 w-6 text-success" />
                <span className="text-success">{status}</span>
              </>
            )}
          </div>
          <div className="text-primary font-mono text-xs uppercase tracking-widest animate-pulse">
            {guidance}
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground">
          {isUnknown 
            ? "Não conseguimos te identificar. Se for sua primeira vez, selecione seu perfil para cadastrar sua face."
            : "Posicione seu rosto centralizado na câmera para autenticação facial."}
        </p>

        <div className="flex flex-col gap-3 pt-4">
          {isUnknown && (
            <Button 
              variant="outline"
              onClick={() => {
                setIsUnknown(false);
                setAttempts(0);
                setStatus("Escaneando rosto...");
              }}
              className="w-full py-6 text-lg font-bold rounded-xl border-2 border-primary/20 hover:bg-primary/5 text-foreground bg-card"
            >
              Tentar novamente
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
