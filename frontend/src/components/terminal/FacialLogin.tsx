import { useState, useEffect } from "react";
import { Camera, UserCheck, Loader2 } from "lucide-react";
import WebcamDetection from "@/components/WebcamDetection";

interface FacialLoginProps {
  onSuccess: () => void;
}

export function FacialLogin({ onSuccess }: FacialLoginProps) {
  const [isIdentifying, setIsIdentifying] = useState(true);
  const [status, setStatus] = useState("Escaneando rosto...");

  // Simulação de detecção facial para o protótipo
  useEffect(() => {
    const timer = setTimeout(() => {
      setStatus("Rosto Identificado!");
      setIsIdentifying(false);

      // Simula um pequeno delay após identificar para mostrar o feedback
      setTimeout(() => {
        onSuccess();
      }, 1500);
    }, 4000);

    return () => clearTimeout(timer);
  }, [onSuccess]);


  return (
    <div className="flex flex-col items-center justify-center space-y-6 py-10">
      <div className="relative h-64 w-64 overflow-hidden rounded-full border-4 border-primary/30 bg-black">
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          {/* Overlay de scan */}
          {isIdentifying && (
            <div className="absolute top-0 left-0 w-full h-1 bg-primary animate-scan-line shadow-[0_0_15px_rgba(var(--primary),0.8)]" />
          )}
        </div>
        <WebcamDetection onDetections={() => {}} />
      </div>

      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-xl font-bold">
          {isIdentifying ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>{status}</span>
            </>
          ) : (
            <>
              <UserCheck className="h-6 w-6 text-success" />
              <span className="text-success">{status}</span>
            </>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Posicione seu rosto centralizado na câmera para autenticação facial.
        </p>
      </div>
    </div>
  );
}
