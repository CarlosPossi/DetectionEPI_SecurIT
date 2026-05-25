import { createFileRoute } from "@tanstack/react-router";
import {
  ShieldCheck,
  CircleDot,
  AlertTriangle,
  Cpu,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";

import WebcamDetection from "@/components/WebcamDetection";
import { EpiDatasetDrawer } from "@/components/EpiDatasetDrawer";
import { useState } from "react";

type Detection = {
  label: string;
  box: number[];
  conf: number;
};

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [detections, setDetections] = useState<Detection[]>([]);

  // 🧠 normalizador (evita erro de texto do YOLO)
  const norm = (text: string) => text.toLowerCase();

  // 🪖 CAPACETE
  const hasHelmet = detections.some(d => {
    const label = d.label.toLowerCase();

    const isHelmet =
      label.includes("capacete") ||
      label.includes("helmet") ||
      label.includes("hardhat");

  
    const isNoHelmet =
      label.includes("no_helmet") ||
      label.includes("without_helmet");

    return isHelmet && !isNoHelmet;
  });

  // 🦺 COLETE
  const hasVest = detections.some(d => {
    const label = norm(d.label);
    return (
      label.includes("macacao") ||
      label.includes("vest")
    );
  });

  const hasMask = detections.some(d => {
    const label = norm(d.label);
    return (
      label.includes("mascara") ||
      label.includes("mask")
    );
  });

  const hasGlasses = detections.some(d => {
    const label = norm(d.label);
    return (
      label.includes("oculos") ||
      label.includes("glasses")
    );
  });

  const hasGloves = detections.some(d => {
    const label = norm(d.label);
    return (
      label.includes("luva") ||
      label.includes("glove")
    );
  });

  const hasBoots = detections.some(d => {
    const label = norm(d.label);
    return (
      label.includes("bota") ||
      label.includes("boot")
    );
  });

  
  const allOk =
    hasHelmet &&
    hasVest &&
    hasMask &&
    hasGlasses &&
    hasGloves &&
    hasBoots;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-6">

        {/* HEADER (igual ao seu design original) */}
        <div className="rounded-2xl border border-border bg-panel shadow-2xl overflow-hidden">

          <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/40">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>

              <div>
                <div className="text-sm font-semibold tracking-wide">
                  Secur<span className="text-primary">IT</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Módulo Terminal · Fiscalização EPI
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary border border-border text-muted-foreground">
                <Cpu className="h-3.5 w-3.5" />
                Status do sistema
              </span>

              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-success/15 border border-success/30 text-success">
                <CircleDot className="h-3.5 w-3.5 animate-pulse" />
                Online
              </span>

              <EpiDatasetDrawer
                trigger={(open) => (
                  <button onClick={open}>
                    <SlidersHorizontal className="h-4 w-4" />
                  </button>
                )}
              />
            </div>
          </header>

          {/* BODY */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr]">

            {/* CAMERA */}
            <section className="relative p-6 border-b lg:border-b-0 lg:border-r border-border">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-black">

                <WebcamDetection onDetections={setDetections} />

              </div>
            </section>

            {/* SIDEBAR (dinâmico) */}
            <aside className="p-6 space-y-5">

              <div className={`rounded-xl border p-5 ${
                allOk
                  ? "bg-success/10 border-success/40"
                  : "bg-danger/10 border-danger/40"
              }`}>
                <div className={`flex items-center gap-2 font-bold text-lg ${
                  allOk ? "text-success" : "text-danger"
                }`}>
                  <AlertTriangle className="h-5 w-5" />

                  {allOk ? "ACESSO LIBERADO" : "ACESSO NEGADO"}
                </div>

                <p className="mt-2 text-sm">
                  {allOk
                    ? "Funcionário autorizado"
                    : "Falta de EPI detectada"
                  }
                </p>
              </div>

              <ul className="space-y-2">

                <li className="flex justify-between bg-card p-2 rounded">
                  <span>Capacete</span>
                  <span className={hasHelmet ? "text-success" : "text-danger"}>
                    {hasHelmet ? "OK" : "Faltando"}
                  </span>
                </li>

                <li className="flex justify-between bg-card p-2 rounded">
                  <span>Colete</span>
                  <span className={hasVest ? "text-success" : "text-danger"}>
                    {hasVest ? "OK" : "Faltando"}
                  </span>
                </li>

                <li className="flex justify-between bg-card p-2 rounded">
                  <span>Máscara</span>
                  <span className={hasMask ? "text-success" : "text-danger"}>
                    {hasMask ? "OK" : "Faltando"}
                  </span>
                </li>

                <li className="flex justify-between bg-card p-2 rounded">
                  <span>Óculos</span>
                  <span className={hasGlasses ? "text-success" : "text-danger"}>
                    {hasGlasses ? "OK" : "Faltando"}
                  </span>
                </li>

                <li className="flex justify-between bg-card p-2 rounded">
                  <span>Luva</span>
                  <span className={hasGloves ? "text-success" : "text-danger"}>
                    {hasGloves ? "OK" : "Faltando"}
                  </span>
                </li>

                <li className="flex justify-between bg-card p-2 rounded">
                  <span>Bota</span>
                  <span className={hasBoots ? "text-success" : "text-danger"}>
                    {hasBoots ? "OK" : "Faltando"}
                  </span>
                </li>

              </ul>

            </aside>
          </div>

          {/* FOOTER */}
          <footer className="flex justify-between px-6 py-4 border-t border-border">
            <button className="flex items-center gap-2 text-sm">
              <RotateCcw className="h-4 w-4" />
              Reiniciar
            </button>
          </footer>

        </div>
      </div>
    </div>
  );
}