'use client';

import type { PasoStepper } from '@/types';

interface StepperProps {
  pasoActual: PasoStepper;
}

const PASOS = [
  { numero: 1, label: 'Subir archivo' },
  { numero: 2, label: 'Revisar extracción' },
  { numero: 3, label: 'Validar matching' },
  { numero: 4, label: 'Cargar en Contabilium' },
] as const;

export function Stepper({ pasoActual }: StepperProps) {
  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between">
        {PASOS.map((paso, idx) => {
          const isCompleted = paso.numero < pasoActual;
          const isActive = paso.numero === pasoActual;
          const isPending = paso.numero > pasoActual;

          return (
            <div key={paso.numero} className="flex items-center flex-1">
              {/* Círculo del paso */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                    transition-all duration-300
                    ${isCompleted
                      ? 'bg-green-600 text-white'
                      : isActive
                        ? 'bg-blue-600 text-white ring-4 ring-blue-200'
                        : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                    }
                  `}
                >
                  {isCompleted ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    paso.numero
                  )}
                </div>
                <span
                  className={`text-xs font-medium whitespace-nowrap ${
                    isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                  }`}
                >
                  {paso.label}
                </span>
              </div>

              {/* Línea conectora (no después del último) */}
              {idx < PASOS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-3 mt-[-1.25rem] transition-colors duration-300 ${
                    isCompleted ? 'bg-green-400' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
