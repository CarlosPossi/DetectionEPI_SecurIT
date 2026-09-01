import React from "react";
import { AlertTriangle, ShieldAlert, Clock } from "lucide-react";

export interface EpiViolationInfo {
  seconds: number;
  isMissing: boolean;
}

interface EpiMannequinAlertProps {
  selectedEpis: string[];
  violationSeconds: Record<string, number>;
  alertEpis: string[]; // EPIs ausentes há >= 10s
  compact?: boolean;
  className?: string;
}

const EPI_INFO_MAP: Record<string, { label: string; icon: string; bodyPart: string }> = {
  helmet: { label: "Capacete", icon: "🪖", bodyPart: "Cabeça" },
  glasses: { label: "Óculos de Proteção", icon: "🥽", bodyPart: "Olhos" },
  mask: { label: "Máscara", icon: "😷", bodyPart: "Rosto" },
  vest: { label: "Colete Refletivo", icon: "🦺", bodyPart: "Tronco" },
  gloves: { label: "Luvas", icon: "🧤", bodyPart: "Mãos" },
  boots: { label: "Botas de Segurança", icon: "🥾", bodyPart: "Pés" },
};

export function EpiMannequinAlert({
  selectedEpis,
  violationSeconds,
  alertEpis,
  compact = false,
  className = "",
}: EpiMannequinAlertProps) {
  const hasAlert = alertEpis.length > 0;

  if (!hasAlert) return null;

  const isAlert = (id: string) => alertEpis.includes(id);
  const isSelected = (id: string) => selectedEpis.includes(id);

  const getPartColor = (id: string) => {
    if (!isSelected(id)) {
      return {
        fill: "rgba(100, 116, 139, 0.05)",
        stroke: "rgba(100, 116, 139, 0.2)",
        strokeWidth: 1,
        className: "",
      };
    }
    if (isAlert(id)) {
      return {
        fill: "rgba(239, 68, 68, 0.85)",
        stroke: "#dc2626",
        strokeWidth: 2.5,
        className: "animate-alert-blink",
      };
    }
    // Conforme ou pendente < 10s
    const sec = violationSeconds[id] || 0;
    if (sec > 0) {
      return {
        fill: "rgba(245, 158, 11, 0.25)",
        stroke: "#f59e0b",
        strokeWidth: 1.5,
        className: "",
      };
    }
    return {
      fill: "rgba(34, 197, 94, 0.35)",
      stroke: "#22c55e",
      strokeWidth: 1.5,
      className: "",
    };
  };

  const helmetStyle = getPartColor("helmet");
  const glassesStyle = getPartColor("glasses");
  const maskStyle = getPartColor("mask");
  const vestStyle = getPartColor("vest");
  const glovesStyle = getPartColor("gloves");
  const bootsStyle = getPartColor("boots");

  if (compact) {
    return (
      <div
        className={`bg-danger/15 border-2 border-danger rounded-xl p-3 shadow-lg flex items-center gap-3 backdrop-blur-md animate-in fade-in zoom-in-95 duration-300 ${className}`}
      >
        <div className="relative w-14 h-24 flex-shrink-0">
          <svg viewBox="0 0 200 300" className="w-full h-full drop-shadow-md">
            {/* Silhueta Base */}
            <ellipse cx="100" cy="46" rx="16" ry="20" className="fill-muted-foreground/20 stroke-muted-foreground/40" strokeWidth="1" />
            <rect x="94" y="64" width="12" height="12" rx="2" className="fill-muted-foreground/20 stroke-muted-foreground/40" strokeWidth="1" />
            <path d="M 70 76 Q 100 72 130 76 L 124 154 Q 100 158 76 154 Z" className="fill-muted-foreground/20 stroke-muted-foreground/40" strokeWidth="1" />
            <path d="M 70 76 L 52 118 L 46 150" className="stroke-muted-foreground/30" strokeWidth="7" strokeLinecap="round" fill="none" />
            <path d="M 130 76 L 148 118 L 154 150" className="stroke-muted-foreground/30" strokeWidth="7" strokeLinecap="round" fill="none" />
            <path d="M 82 168 L 80 244" className="stroke-muted-foreground/30" strokeWidth="10" strokeLinecap="round" fill="none" />
            <path d="M 118 168 L 120 244" className="stroke-muted-foreground/30" strokeWidth="10" strokeLinecap="round" fill="none" />

            {/* EPIs com destaque */}
            {/* Capacete */}
            {isSelected("helmet") && (
              <path
                d="M 72 44 C 72 24 128 24 128 44 L 134 48 C 134 52 128 54 126 54 L 74 54 C 72 54 66 52 66 48 Z"
                fill={helmetStyle.fill}
                stroke={helmetStyle.stroke}
                strokeWidth={helmetStyle.strokeWidth}
                className={helmetStyle.className}
              />
            )}
            {/* Óculos */}
            {isSelected("glasses") && (
              <path
                d="M 81 44 Q 90 40 100 44 Q 110 40 119 44 L 118 51 Q 110 54 100 52 Q 90 54 82 51 Z"
                fill={glassesStyle.fill}
                stroke={glassesStyle.stroke}
                strokeWidth={glassesStyle.strokeWidth}
                className={glassesStyle.className}
              />
            )}
            {/* Máscara */}
            {isSelected("mask") && (
              <path
                d="M 86 53 Q 100 50 114 53 L 112 66 Q 100 71 88 66 Z"
                fill={maskStyle.fill}
                stroke={maskStyle.stroke}
                strokeWidth={maskStyle.strokeWidth}
                className={maskStyle.className}
              />
            )}
            {/* Colete */}
            {isSelected("vest") && (
              <path
                d="M 70 76 L 86 76 L 100 102 L 114 76 L 130 76 L 124 154 L 76 154 Z"
                fill={vestStyle.fill}
                stroke={vestStyle.stroke}
                strokeWidth={vestStyle.strokeWidth}
                className={vestStyle.className}
              />
            )}
            {/* Luvas */}
            {isSelected("gloves") && (
              <>
                <rect x="36" y="148" width="16" height="22" rx="4" fill={glovesStyle.fill} stroke={glovesStyle.stroke} strokeWidth={glovesStyle.strokeWidth} className={glovesStyle.className} />
                <rect x="148" y="148" width="16" height="22" rx="4" fill={glovesStyle.fill} stroke={glovesStyle.stroke} strokeWidth={glovesStyle.strokeWidth} className={glovesStyle.className} />
              </>
            )}
            {/* Botas */}
            {isSelected("boots") && (
              <>
                <path d="M 66 242 L 92 242 L 92 268 L 60 268 Q 58 258 66 242 Z" fill={bootsStyle.fill} stroke={bootsStyle.stroke} strokeWidth={bootsStyle.strokeWidth} className={bootsStyle.className} />
                <path d="M 108 242 L 134 242 Q 142 258 140 268 L 108 268 Z" fill={bootsStyle.fill} stroke={bootsStyle.stroke} strokeWidth={bootsStyle.strokeWidth} className={bootsStyle.className} />
              </>
            )}
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-danger font-bold text-xs uppercase tracking-wider">
            <AlertTriangle className="h-4 w-4 animate-bounce" />
            <span>Alerta de EPI (&gt;10s)</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {alertEpis.map((epi) => (
              <span
                key={epi}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-danger text-white text-[10px] font-bold animate-pulse"
              >
                {EPI_INFO_MAP[epi]?.icon} {EPI_INFO_MAP[epi]?.label} ({violationSeconds[epi] || 10}s)
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border-2 border-danger bg-danger/10 p-5 shadow-2xl relative overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${className}`}
      style={{
        boxShadow: "0 0 25px -5px rgba(239, 68, 68, 0.4)",
      }}
    >
      {/* Glow de fundo */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-danger/20 rounded-full blur-2xl pointer-events-none" />

      {/* Cabeçalho do Card */}
      <div className="flex items-center justify-between border-b border-danger/30 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-danger flex items-center justify-center text-white shadow-md animate-pulse">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-danger uppercase tracking-wider flex items-center gap-1.5">
              <span>Alerta: EPI Ausente</span>
              <span className="text-[10px] bg-danger text-white px-1.5 py-0.2 rounded-full font-mono">
                &gt;10s
              </span>
            </h4>
            <p className="text-xs text-muted-foreground">
              Ajuste o equipamento indicado em vermelho
            </p>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal: Boneco SVG + Lista de EPIs Violados */}
      <div className="grid grid-cols-[110px_1fr] sm:grid-cols-[130px_1fr] gap-4 items-center">
        {/* Boneco Manequim Ilustrado */}
        <div className="relative bg-card/60 rounded-xl p-2 border border-danger/20 flex items-center justify-center">
          <svg
            viewBox="0 0 200 300"
            className="w-full h-48 drop-shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
          >
            {/* Silhueta Base Humana */}
            {/* Cabeça */}
            <ellipse
              cx="100"
              cy="46"
              rx="18"
              ry="22"
              className="fill-muted-foreground/15 stroke-muted-foreground/30"
              strokeWidth="1.5"
            />
            {/* Pescoço */}
            <rect
              x="94"
              y="66"
              width="12"
              height="12"
              rx="2"
              className="fill-muted-foreground/15 stroke-muted-foreground/30"
              strokeWidth="1"
            />
            {/* Ombros e Tronco */}
            <path
              d="M 68 78 Q 100 74 132 78 L 126 156 Q 100 160 74 156 Z"
              className="fill-muted-foreground/15 stroke-muted-foreground/30"
              strokeWidth="1.5"
            />
            {/* Braço Esquerdo */}
            <path
              d="M 68 78 L 52 120 L 46 155"
              className="stroke-muted-foreground/25"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {/* Braço Direito */}
            <path
              d="M 132 78 L 148 120 L 154 155"
              className="stroke-muted-foreground/25"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {/* Mão Esquerda Base */}
            <circle
              cx="44"
              cy="164"
              r="6"
              className="fill-muted-foreground/20 stroke-muted-foreground/30"
              strokeWidth="1"
            />
            {/* Mão Direita Base */}
            <circle
              cx="156"
              cy="164"
              r="6"
              className="fill-muted-foreground/20 stroke-muted-foreground/30"
              strokeWidth="1"
            />
            {/* Cintura */}
            <path
              d="M 74 156 L 126 156 L 122 178 L 78 178 Z"
              className="fill-muted-foreground/15 stroke-muted-foreground/30"
              strokeWidth="1"
            />
            {/* Perna Esquerda */}
            <path
              d="M 82 178 L 80 248"
              className="stroke-muted-foreground/25"
              strokeWidth="12"
              strokeLinecap="round"
              fill="none"
            />
            {/* Perna Direita */}
            <path
              d="M 118 178 L 120 248"
              className="stroke-muted-foreground/25"
              strokeWidth="12"
              strokeLinecap="round"
              fill="none"
            />
            {/* Pé Esquerdo Base */}
            <path
              d="M 72 250 L 90 250 L 90 268 L 68 268 Z"
              className="fill-muted-foreground/20 stroke-muted-foreground/30"
              strokeWidth="1"
            />
            {/* Pé Direito Base */}
            <path
              d="M 110 250 L 128 250 L 132 268 L 110 268 Z"
              className="fill-muted-foreground/20 stroke-muted-foreground/30"
              strokeWidth="1"
            />

            {/* === CAMADAS DE EPI COM DESTAQUE === */}

            {/* 1. CAPACETE (Helmet) */}
            {isSelected("helmet") && (
              <g>
                <path
                  d="M 72 44 C 72 22 128 22 128 44 L 134 47 C 134 51 128 53 126 53 L 74 53 C 72 53 66 51 66 47 Z"
                  fill={helmetStyle.fill}
                  stroke={helmetStyle.stroke}
                  strokeWidth={helmetStyle.strokeWidth}
                  className={helmetStyle.className}
                />
                <path
                  d="M 100 24 L 100 48"
                  stroke={helmetStyle.stroke}
                  strokeWidth="2"
                  strokeLinecap="round"
                  className={helmetStyle.className}
                />
                {isAlert("helmet") && (
                  <circle cx="100" cy="38" r="4" className="fill-white animate-ping" />
                )}
              </g>
            )}

            {/* 2. ÓCULOS (Glasses) */}
            {isSelected("glasses") && (
              <g>
                <path
                  d="M 81 44 Q 90 40 100 44 Q 110 40 119 44 L 118 51 Q 110 54 100 52 Q 90 54 82 51 Z"
                  fill={glassesStyle.fill}
                  stroke={glassesStyle.stroke}
                  strokeWidth={glassesStyle.strokeWidth}
                  className={glassesStyle.className}
                />
                <rect
                  x="83"
                  y="44"
                  width="14"
                  height="7"
                  rx="2"
                  fill={glassesStyle.fill}
                  stroke={glassesStyle.stroke}
                  strokeWidth="1"
                  className={glassesStyle.className}
                />
                <rect
                  x="103"
                  y="44"
                  width="14"
                  height="7"
                  rx="2"
                  fill={glassesStyle.fill}
                  stroke={glassesStyle.stroke}
                  strokeWidth="1"
                  className={glassesStyle.className}
                />
                {isAlert("glasses") && (
                  <circle cx="100" cy="47" r="3" className="fill-white animate-ping" />
                )}
              </g>
            )}

            {/* 3. MÁSCARA (Mask) */}
            {isSelected("mask") && (
              <g>
                <path
                  d="M 86 53 Q 100 50 114 53 L 112 66 Q 100 71 88 66 Z"
                  fill={maskStyle.fill}
                  stroke={maskStyle.stroke}
                  strokeWidth={maskStyle.strokeWidth}
                  className={maskStyle.className}
                />
                <path
                  d="M 86 56 L 78 52 M 86 63 L 78 66 M 114 56 L 122 52 M 114 63 L 122 66"
                  stroke={maskStyle.stroke}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className={maskStyle.className}
                />
                {isAlert("mask") && (
                  <circle cx="100" cy="60" r="3" className="fill-white animate-ping" />
                )}
              </g>
            )}

            {/* 4. COLETE (Vest) */}
            {isSelected("vest") && (
              <g>
                <path
                  d="M 70 78 L 86 78 L 100 104 L 114 78 L 130 78 L 126 156 L 74 156 Z"
                  fill={vestStyle.fill}
                  stroke={vestStyle.stroke}
                  strokeWidth={vestStyle.strokeWidth}
                  className={vestStyle.className}
                />
                {/* Listras refletivas do colete */}
                <line
                  x1="74"
                  y1="130"
                  x2="126"
                  y2="130"
                  stroke={isAlert("vest") ? "#fee2e2" : "#fef08a"}
                  strokeWidth="3.5"
                  strokeDasharray="4 2"
                  className={vestStyle.className}
                />
                <line
                  x1="75"
                  y1="144"
                  x2="125"
                  y2="144"
                  stroke={isAlert("vest") ? "#fee2e2" : "#fef08a"}
                  strokeWidth="3.5"
                  strokeDasharray="4 2"
                  className={vestStyle.className}
                />
                {isAlert("vest") && (
                  <circle cx="100" cy="120" r="4" className="fill-white animate-ping" />
                )}
              </g>
            )}

            {/* 5. LUVAS (Gloves) */}
            {isSelected("gloves") && (
              <g>
                {/* Luva Esquerda */}
                <rect
                  x="36"
                  y="150"
                  width="16"
                  height="24"
                  rx="4"
                  fill={glovesStyle.fill}
                  stroke={glovesStyle.stroke}
                  strokeWidth={glovesStyle.strokeWidth}
                  className={glovesStyle.className}
                />
                {/* Luva Direita */}
                <rect
                  x="148"
                  y="150"
                  width="16"
                  height="24"
                  rx="4"
                  fill={glovesStyle.fill}
                  stroke={glovesStyle.stroke}
                  strokeWidth={glovesStyle.strokeWidth}
                  className={glovesStyle.className}
                />
                {isAlert("gloves") && (
                  <>
                    <circle cx="44" cy="162" r="3" className="fill-white animate-ping" />
                    <circle cx="156" cy="162" r="3" className="fill-white animate-ping" />
                  </>
                )}
              </g>
            )}

            {/* 6. BOTAS (Boots) */}
            {isSelected("boots") && (
              <g>
                {/* Bota Esquerda */}
                <path
                  d="M 66 244 L 92 244 L 92 272 L 60 272 Q 58 260 66 244 Z"
                  fill={bootsStyle.fill}
                  stroke={bootsStyle.stroke}
                  strokeWidth={bootsStyle.strokeWidth}
                  className={bootsStyle.className}
                />
                <rect
                  x="59"
                  y="269"
                  width="34"
                  height="4"
                  rx="1"
                  fill={bootsStyle.stroke}
                  className={bootsStyle.className}
                />
                {/* Bota Direita */}
                <path
                  d="M 108 244 L 134 244 Q 142 260 140 272 L 108 272 Z"
                  fill={bootsStyle.fill}
                  stroke={bootsStyle.stroke}
                  strokeWidth={bootsStyle.strokeWidth}
                  className={bootsStyle.className}
                />
                <rect
                  x="107"
                  y="269"
                  width="34"
                  height="4"
                  rx="1"
                  fill={bootsStyle.stroke}
                  className={bootsStyle.className}
                />
                {isAlert("boots") && (
                  <>
                    <circle cx="75" cy="258" r="3" className="fill-white animate-ping" />
                    <circle cx="125" cy="258" r="3" className="fill-white animate-ping" />
                  </>
                )}
              </g>
            )}
          </svg>
        </div>

        {/* Lista de Violações com Tempo Contínuo */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-danger uppercase tracking-wider mb-1 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>Itens Irregulares:</span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {alertEpis.map((epiId) => {
              const info = EPI_INFO_MAP[epiId] || {
                label: epiId,
                icon: "⚠️",
                bodyPart: "Geral",
              };
              const secs = violationSeconds[epiId] || 10;

              return (
                <div
                  key={epiId}
                  className="flex items-center justify-between p-2 rounded-lg bg-card/80 border border-danger/30 text-xs shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{info.icon}</span>
                    <div>
                      <p className="font-bold text-foreground leading-none">{info.label}</p>
                      <p className="text-[10px] text-muted-foreground">{info.bodyPart}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-danger text-white font-mono font-bold text-[11px] animate-pulse">
                    {secs}s sem EPI
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-danger/90 font-medium leading-tight pt-1">
            Coloque o(s) EPI(s) para normalizar a conformidade e desativar o alarme.
          </p>
        </div>
      </div>
    </div>
  );
}

export default EpiMannequinAlert;
