import React from 'react';
import { Check } from 'lucide-react';

interface StepWizardProps {
  steps: { label: string; icon: React.ReactNode }[];
  currentStep: number;
  children: React.ReactNode;
}

export const StepWizard: React.FC<StepWizardProps> = ({ steps, currentStep, children }) => {
  return (
    <div className="flex flex-col h-full">
      {/* Step indicator bar */}
      <div className="flex items-center justify-center px-8 py-6">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isFuture = index > currentStep;

          return (
            <React.Fragment key={index}>
              {/* Step circle + label */}
              <div className="flex flex-col items-center relative">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    border-2 transition-all duration-300
                    ${isCompleted
                      ? 'bg-green-500 border-green-500 text-white'
                      : isCurrent
                        ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30'
                        : 'bg-gray-800 border-gray-600 text-gray-500'
                    }
                  `}
                >
                  {isCompleted ? (
                    <Check size={18} strokeWidth={3} />
                  ) : (
                    <span className="text-sm">{step.icon}</span>
                  )}
                </div>
                <span
                  className={`
                    mt-2 text-xs font-medium whitespace-nowrap
                    ${isCompleted
                      ? 'text-green-400'
                      : isCurrent
                        ? 'text-blue-400'
                        : 'text-gray-500'
                    }
                  `}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={`
                    flex-1 h-0.5 mx-3 mt-[-1.25rem] min-w-[60px] max-w-[120px]
                    transition-colors duration-300
                    ${index < currentStep ? 'bg-green-500' : 'bg-gray-700'}
                  `}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto px-2">
        {children}
      </div>
    </div>
  );
};

export default StepWizard;
