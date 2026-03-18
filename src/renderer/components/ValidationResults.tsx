import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react';

export interface ValidationItem {
  id: string;
  type: 'pass' | 'warning' | 'error';
  sheet?: string;
  row?: number;
  message: string;
  details?: string;
}

export interface ValidationResult {
  items: ValidationItem[];
  errorCount: number;
  warningCount: number;
  passCount: number;
}

interface ValidationResultsProps {
  results: ValidationResult;
  isValidating: boolean;
}

const ValidationItemRow: React.FC<{ item: ValidationItem }> = ({ item }) => {
  const [expanded, setExpanded] = useState(false);

  const icon =
    item.type === 'pass' ? (
      <CheckCircle2 size={18} className="text-green-400 flex-shrink-0" />
    ) : item.type === 'warning' ? (
      <AlertTriangle size={18} className="text-yellow-400 flex-shrink-0" />
    ) : (
      <XCircle size={18} className="text-red-400 flex-shrink-0" />
    );

  const bgColor =
    item.type === 'pass'
      ? 'bg-green-500/5'
      : item.type === 'warning'
        ? 'bg-yellow-500/5'
        : 'bg-red-500/5';

  const borderColor =
    item.type === 'pass'
      ? 'border-green-500/20'
      : item.type === 'warning'
        ? 'border-yellow-500/20'
        : 'border-red-500/20';

  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg`}>
      <div
        className={`flex items-center gap-3 px-4 py-3 ${item.details ? 'cursor-pointer' : ''}`}
        onClick={() => item.details && setExpanded(!expanded)}
      >
        {icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {item.sheet && (
              <span className="px-1.5 py-0.5 text-xs bg-gray-700 text-gray-300 rounded font-mono">
                {item.sheet}
              </span>
            )}
            {item.row !== undefined && (
              <span className="px-1.5 py-0.5 text-xs bg-gray-700 text-gray-400 rounded font-mono">
                Row {item.row}
              </span>
            )}
            <span className="text-sm text-gray-200">{item.message}</span>
          </div>
        </div>
        {item.details && (
          <span className="text-gray-500">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
        )}
      </div>
      {expanded && item.details && (
        <div className="px-4 pb-3 pt-0 ml-9">
          <p className="text-xs text-gray-400 font-mono bg-gray-800/50 rounded p-2">
            {item.details}
          </p>
        </div>
      )}
    </div>
  );
};

export const ValidationResults: React.FC<ValidationResultsProps> = ({
  results,
  isValidating,
}) => {
  if (isValidating) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 size={40} className="text-blue-400 animate-spin" />
        <p className="text-gray-300 text-lg font-medium">Validating spreadsheet...</p>
        <p className="text-gray-500 text-sm">Checking IP addresses, port assignments, and groups</p>
      </div>
    );
  }

  const errors = results.items.filter((i) => i.type === 'error');
  const warnings = results.items.filter((i) => i.type === 'warning');
  const passes = results.items.filter((i) => i.type === 'pass');

  return (
    <div className="space-y-6">
      {/* Summary badges */}
      <div className="flex items-center gap-3 flex-wrap">
        {results.errorCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-red-500/15 text-red-400 border border-red-500/30 rounded-full">
            <XCircle size={14} />
            {results.errorCount} error{results.errorCount !== 1 ? 's' : ''}
          </span>
        )}
        {results.warningCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded-full">
            <AlertTriangle size={14} />
            {results.warningCount} warning{results.warningCount !== 1 ? 's' : ''}
          </span>
        )}
        {results.passCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-500/15 text-green-400 border border-green-500/30 rounded-full">
            <CheckCircle2 size={14} />
            {results.passCount} passed
          </span>
        )}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-red-400 uppercase tracking-wider">Errors</h4>
          {errors.map((item) => (
            <ValidationItemRow key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider">Warnings</h4>
          {warnings.map((item) => (
            <ValidationItemRow key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Passed */}
      {passes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-green-400 uppercase tracking-wider">Passed Checks</h4>
          {passes.map((item) => (
            <ValidationItemRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ValidationResults;
