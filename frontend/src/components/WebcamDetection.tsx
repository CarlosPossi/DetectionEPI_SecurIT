import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import { io } from "socket.io-client";

type Detection = {
  label: string;
  box: number[];
  conf: number;
};

type DetectionResponse = {
  detections: Detection[];
  width: number;
  height: number;
};

const socket = io("http://127.0.0.1:5001");

type Props = {
  onDetections?: (detections: Detection[]) => void;
};

export default function WebcamDetection({ onDetections }: Props) {
  const webcamRef = useRef<Webcam | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [detections, setDetections] = useState<Detection[]>([]);
  const [frameSize, setFrameSize] = useState({ width: 1, height: 1 });

  useEffect(() => {
    const handler = (data: DetectionResponse) => {
      setDetections(data.detections);

      onDetections?.(data.detections); // 🔥 envia pro pai

      setFrameSize({
        width: data.width,
        height: data.height
      });
    };

    socket.on("detections", handler);

    return () => {
      socket.off("detections", handler);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!socket.connected) return;
      capture();
    }, 300);

    return () => clearInterval(interval);
  }, []);

  const capture = async () => {
    const img = webcamRef.current?.getScreenshot();
    if (!img) return;

    const blob = await fetch(img).then(r => r.blob());
    socket.emit("frame", blob);
  };

  useEffect(() => {
    let running = true;

    const draw = () => {
      if (!running) return;

      const canvas = canvasRef.current;
      const video = webcamRef.current?.video;

      if (canvas && video) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (frameSize.width > 1 && frameSize.height > 1) {
            const scaleX = canvas.width / frameSize.width;
            const scaleY = canvas.height / frameSize.height;

            detections.forEach(d => {
              let [x1, y1, x2, y2] = d.box;

              x1 *= scaleX;
              x2 *= scaleX;
              y1 *= scaleY;
              y2 *= scaleY;

              const isMissing = d.label.toLowerCase().includes("no");

              ctx.strokeStyle = isMissing ? "red" : "lime";
              ctx.lineWidth = 2;

              ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

              ctx.fillStyle = ctx.strokeStyle;
              ctx.font = "16px Arial";
              ctx.fillText(d.label, x1, y1 - 5);
            });
          }
        }
      }

      requestAnimationFrame(draw);
    };

    requestAnimationFrame(draw);

    return () => {
      running = false;
    };
  }, [detections, frameSize]);

  return (
    <div className="relative w-full h-full">
      <Webcam
        ref={webcamRef}
        audio={false}
        screenshotFormat="image/jpeg"
        videoConstraints={{
          width: 640,
          height: 640,
          facingMode: "user",
        }}
        className="absolute w-full h-full object-cover"
      />

      <canvas ref={canvasRef} className="absolute w-full h-full" />
    </div>
  );
}