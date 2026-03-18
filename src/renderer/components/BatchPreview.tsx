import React, { useState } from 'react';
import {
  X,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Check,
} from 'lucide-react';

export interface BatchOperationChange {
  field: string;
  currentValue: string;
  newValue: string;
  type: 'add' | 'change' | 'remove';
}

export interface BatchOperationPreview {
  switchName: string;
  switchIp: string;
  changes: BatchOperationChange[];
}

export interface BatchPreviewProps {
  operations: BatchOperationPreview[];
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
  operationLabel?: string;
}

const typeIcon: Record<string, React.ReactNode> = {
  add: <Plus className="w-3.5 h-3.5 text-green-400" />,
  change: <Pencil className="w-3.5 h-3.5 text-yellow-400" />,
  remove: <Trash2 className="w-3.5 h-3.5 text-red-400" />,
};

const typeBgClass: Record<string, string> = {
  add: 'bg-green-500/10 border-green-500/20',
  change: 'bg-yellow-500/10 border-yellow-500/20',
  remove: 'bg-red-500/10 border-red-500/20',
};

export const BatchPreview: React.FC<BatchPreviewProps> = ({
  operations,
  onConfirm,
  onCancel,
  isDestructive = false,
  operationLabel = 'Batch Operation',
}) => {
  const [expandedSwitches, setExpandedSwitches] = useState<Set<string>>(
    new Set(operations.map((o) => o.switchName))
  );

  const toggleExpanded = (name: string) => {
    const next = new Set(expandedSwitches);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setExpandedSwitches(next);
  };

  const totalChanges = operations.reduce((sum, o) => sum + o.changes.length, 0);
  const addCount = operations.reduce(
    (sum, o) => sum + o.changes.filter((c) => c.type === 'add').length,
    0
  );
  const changeCount = operations.reduce(
    (sum, o) => sum + o.changes.filter((c) => c.type === 'change').length,
    0
  );
  const removeCount = operations.reduce(
    (sum, o) => sum + o.changes.filter((c) => c.type === 'remove').length,
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-white">Preview Changes</h3>
            <p className="text-sm text-gray-400 mt-0.5">
              {operationLabel} &mdash; {operations.length} switches, {totalChanges} total
              changes
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Destructive warning */}
        {isDestructive && (
          <div className="mx-6 mt-4 flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-400">Destructive Operation</p>
              <p className="text-xs text-red-400/80 mt-0.5">
                This operation cannot be undone. Please review all changes carefully before
                confirming.
              </p>
            </div>
          </div>
        )}

        {/* Change summary badges */}
        <div className="flex items-center gap-3 px-6 py-3">
          {addCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
              <Plus className="w-3 h-3" /> {addCount} additions
            </span>
          )}
          {changeCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
              <Pencil className="w-3 h-3" /> {changeCount} changes
            </span>
          )}
          {removeCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
              <Trash2 className="w-3 h-3" /> {removeCount} removals
            </span>
          )}
        </div>

        {/* Per-switch sections */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-2">
          {operations.map((op) => {
            const expanded = expandedSwitches.has(op.switchName);
            return (
              <div
                key={op.switchName}
                className="border border-gray-700 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleExpanded(op.switchName)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800/50 hover:bg-gray-800 transition-colors"
                >
                  {expanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                  <span className="text-sm font-medium text-white">{op.switchName}</span>
                  <span className="font-mono text-xs text-gray-500">{op.switchIp}</span>
                  <span className="ml-auto text-xs text-gray-400">
                    {op.changes.length} change{op.changes.length !== 1 ? 's' : ''}
                  </span>
                </button>

                {expanded && (
                  <div className="divide-y divide-gray-700/50">
                    {op.changes.map((change, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-3 px-4 py-2.5 border-l-2 ${typeBgClass[change.type]}`}
                      >
                        {typeIcon[change.type]}
                        <span className="text-xs font-medium text-gray-300 w-40 flex-shrink-0">
                          {change.field}
                        </span>
                        {change.type === 'add' ? (
                          <span className="text-xs text-green-400 font-mono">
                            {change.newValue}
                          </span>
                        ) : change.type === 'remove' ? (
                          <span className="text-xs text-red-400 font-mono line-through">
                            {change.currentValue}
                          </span>
                        ) : (
                          <div className="flex items-center gap-2 text-xs font-mono">
                            <span className="text-gray-500">{change.currentValue}</span>
                            <span className="text-gray-600">&rarr;</span>
                            <span className="text-yellow-400">{change.newValue}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-gc-accent hover:bg-gc-accent/80 text-white'
            }`}
          >
            <Check className="w-4 h-4" />
            Confirm &amp; Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchPreview;
