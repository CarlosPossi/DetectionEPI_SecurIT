import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from "react";
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

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:5001";
export const socket = io(BACKEND_URL);

type Props = {
  onDetections?: (detections: Detection[]) => void;
};

export type WebcamDetectionHandle = {
  getScreenshot: () => string | null | undefined;
};

const WebcamDetection = forwardRef<WebcamDetectionHandle, Props>(({ onDetections }, ref) => {
  const webcamRef = useRef<Webcam | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useImperativeHandle(ref, () => ({
    getScreenshot: () => webcamRef.current?.getScreenshot(),
  }));

  const [detections, setDetections] = useState<Detection[]>([]);
  const [frameSize, setFrameSize] = useState({ width: 1, height: 1 });

  useEffect(() => {
    const handler = (data: DetectionResponse) => {
      setDetections(data.detections);

      onDetections?.(data.detections); // 🔥 envia pro pai

      setFrameSize({
        width: data.width,
        height: data.height,
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

    const blob = await fetch(img).then((r) => r.blob());
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

          // Prepare to draw mirrored boxes
          ctx.save();
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);

          if (frameSize.width > 1 && frameSize.height > 1) {
            const scaleX = canvas.width / frameSize.width;
            const scaleY = canvas.height / frameSize.height;

            detections.forEach((d) => {
              let [x1, y1, x2, y2] = d.box;

              x1 *= scaleX;
              x2 *= scaleX;
              y1 *= scaleY;
              y2 *= scaleY;

              const isMissing = d.label.toLowerCase().includes("no");

              ctx.strokeStyle = isMissing ? "red" : "lime";
              ctx.lineWidth = 2;

              ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

              // To keep text readable (not mirrored), we'd need more complex logic, 
              // but flipping the whole context is the cleanest way to sync boxes.
              // Let's un-mirror just for text.
              ctx.save();
              ctx.translate(x1, y1);
              ctx.scale(-1, 1);
              ctx.fillStyle = ctx.strokeStyle;
              ctx.font = "16px Arial";
              ctx.fillText(d.label, - (ctx.measureText(d.label).width), -5);
              ctx.restore();
            });
          }
          ctx.restore();
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
        mirrored={true}
        screenshotFormat="image/jpeg"
        videoConstraints={{
          width: 640,
          height: 640,
          facingMode: "user",
        }}
        className="absolute w-full h-full object-cover"
      />

      <canvas ref={canvasRef} className="absolute w-full h-full scale-x-[-1]" />
    </div>
  );
});

export default WebcamDetection;
