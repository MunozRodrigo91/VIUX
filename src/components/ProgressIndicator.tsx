import React from "react";

interface ProgressIndicatorProps {
  currentStep: number;
}

export default function ProgressIndicator({ currentStep }: ProgressIndicatorProps) {
  const steps = [
    { num: 1, label: "Unidades y Fecha" },
    { num: 2, label: "Elegir Turno" },
    { num: 3, label: "Tus Datos" },
    { num: 4, label: "Pagar Seña" },
    { num: 5, label: "Tu Ticket" },
  ];

  return (
    <div className="w-full bg-black/50 backdrop-blur-md border-b border-white/5 py-4 px-4 sticky top-[65px] z-40 text-white">
      <div className="max-w-md mx-auto">
        <div className="flex justify-between items-center mb-2.5">
          <span className="text-[10px] uppercase tracking-widest text-[#FF5500] font-black neon-orange-text">
            Reserva de Monopatines
          </span>
          <span className="text-[10px] font-mono font-bold text-[#FF5500] bg-[#FF5500]/10 px-2.5 py-1 rounded-md border border-[#FF5500]/20">
            Paso {currentStep} de 5
          </span>
        </div>

        {/* Progress bar */}
        <div className="relative w-full h-1 bg-white/5 rounded-full overflow-hidden">
          <div 
            className="absolute top-0 left-0 h-full bg-[#FF5500] transition-all duration-300 ease-out shadow-[0_0_8px_#FF5500]"
            style={{ width: `${((currentStep) / 5) * 100}%` }}
          />
        </div>

        {/* Labels */}
        <div className="flex justify-between items-center mt-3 overflow-x-auto no-scrollbar whitespace-nowrap space-x-2">
          {steps.map((s) => {
            const isActive = currentStep >= s.num;
            const isCurrent = currentStep === s.num;

            return (
              <div 
                key={s.num} 
                className="flex items-center space-x-1 shrink-0"
              >
                <span 
                  className={`text-[9px] font-bold tracking-tight transition-colors ${
                    isCurrent 
                      ? "text-[#FF5500] neon-orange-text" 
                      : isActive 
                        ? "text-white" 
                        : "text-zinc-500"
                  }`}
                >
                  {s.label}
                </span>
                {s.num < 5 && (
                  <span className="text-[9px] text-zinc-600 font-light px-0.5">/</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
