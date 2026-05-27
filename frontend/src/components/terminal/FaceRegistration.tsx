import { useState, useEffect, useRef } from "react";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import WebcamDetection, { socket, WebcamDetectionHandle } from "@/components/WebcamDetection";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FaceRegistrationProps {
  employeeId?: string;
  employeeName?: string;
  onComplete: (image: Blob) => void;
}

export function FaceRegistration({ employeeId, employeeName, onComplete }: FaceRegistrationProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [status, setStatus] = useState("Posicione seu rosto para o cadastro");
  const webcamRef = useRef<WebcamDetectionHandle>(null);

  const handleCapture = async () => {
    setIsRegistering(true);
    setStatus("Capturando e processando...");
    
    const img = webcamRef.current?.getScreenshot();
    if (img) {
      const blob = await fetch(img).then(r => r.blob());
      setStatus("Face capturada com sucesso!");
      setTimeout(() => onComplete(blob), 1000);
    } else {
      toast.error("Erro ao capturar imagem da câmera.");
      setIsRegistering(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-6 py-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black uppercase tracking-tighter">Cadastro Facial</h2>
        <p className="text-muted-foreground">Posicione seu rosto para iniciarmos o processo de biometria.</p>
      </div>

      <div className="relative h-72 w-72 overflow-hidden rounded-full border-4 border-primary/30 bg-black shadow-2xl">
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          {!isRegistering && (
            <div className="absolute top-0 left-0 w-full h-1 bg-primary animate-scan-line shadow-[0_0_15px_rgba(var(--primary),0.8)]" />
          )}
        </div>
        <WebcamDetection ref={webcamRef} onDetections={() => {}} />
      </div>

      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2 text-lg font-bold">
          {isRegistering ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <Camera className="h-5 w-5 text-primary" />
          )}
          <span className={status.includes("sucesso") ? "text-success" : ""}>{status}</span>
        </div>
        
        {!isRegistering && (
          <Button onClick={handleCapture} className="px-10 py-8 text-xl font-black rounded-2xl shadow-xl hover:scale-105 transition-all uppercase tracking-widest">
            Capturar Biometria
          </Button>
        )}
      </div>
    </div>
  );
}
