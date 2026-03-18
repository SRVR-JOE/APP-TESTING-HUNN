import React from 'react';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Network,
} from 'lucide-react';

export interface DeployChange {
  id: string;
  field: string;
  category: 'IP' | 'Group' | 'Port' | 'PoE' | 'IGMP';
  port?: string;
  currentValue: string | null;
  newValue: string | null;
  changeType: 'added' | 'changed' | 'removed' | 'unchanged';
}

interface ExcelPreviewProps {
  switchName: string;
  switchIp?: string;
  matched: boolean;
  changes: DeployChange[];
  isExpanded: boolean;
  onToggle: () => void;
}

const categoryColors: Record<string, string> = {
  IP: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Group: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  Port: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  PoE: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  IGMP: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
};

const changeRowColor: Record<string, string> = {
  added: 'bg-green-500/5',
  changed: 'bg-yellow-500/5',
  removed: 'bg-red-500/5',
  unchanged: '',
};

const changeValueStyle: Record<string, string> = {
  added: 'text-green-400',
  changed: 'text-yellow-400',
  removed: 'text-red-400 line-through',
  unchanged: 'text-gray-400',
};

export const ExcelPreview: React.FC<ExcelPreviewProps> = ({
  switchName,
  switchIp,
  matched,
  changes,
  isExpanded,
  onToggle,
}) => {
  const addedCount = changes.filter((c) => c.changeType === 'added').length;
  const changedCount = changes.filter((c) => c.changeType === 'changed').length;
  const removedCount = changes.filter((c) => c.changeType === 'removed').length;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-750 transition-colors text-left"
        onClick={onToggle}
      >
        <span className="text-gray-400">
          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </span>

        <Network size={18} className="text-blue-400 flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-medium">{switchName}</span>
            {switchIp && (
              <span className="text-gray-400 text-sm font-mono">{switchIp}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {matched ? (
              <span className="inline-flex items-center gap-1 text-xs text-green-400">
                <CheckCircle2 size={12} />
                Matched to {switchIp}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-yellow-400">
                <XCircle size={12} />
                Not found on network
              </span>
            )}
          </div>
        </div>

        {/* Change count badges */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {addedCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-green-500/15 text-green-400 rounded-full">
              +{addedCount}
            </span>
          )}
          {changedCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-yellow-500/15 text-yellow-400 rounded-full">
              ~{changedCount}
            </span>
          )}
          {removedCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-red-500/15 text-red-400 rounded-full">
              -{removedCount}
            </span>
          )}
        </div>
      </button>

      {/* Expanded diff table */}
      {isExpanded && (
        <div className="border-t border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900/50 text-gray-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-2 text-left w-20">Type</th>
                <th className="px-4 py-2 text-left">Field</th>
                <th className="px-4 py-2 text-left">Port</th>
                <th className="px-4 py-2 text-left">Current</th>
                <th className="px-4 py-2 text-center w-10"></th>
                <th className="px-4 py-2 text-left">Incoming</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {changes
                .filter((c) => c.changeType !== 'unchanged')
                .map((change) => (
                  <tr key={change.id} className={changeRowColor[change.changeType]}>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block px-1.5 py-0.5 text-xs border rounded font-medium ${
                          categoryColors[change.category] || ''
                        }`}
                      >
                        {change.category}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-300 font-medium">
                      {change.field}
                    </td>
                    <td className="px-4 py-2 text-gray-400 font-mono text-xs">
                      {change.port || '—'}
                    </td>
                    <td className="px-4 py-2">
                      {change.currentValue !== null ? (
                        <span
                          className={`font-mono text-xs ${
                            change.changeType === 'removed'
                              ? 'text-red-400'
                              : change.changeType === 'changed'
                                ? 'text-gray-400'
                                : 'text-gray-500'
                          }`}
                        >
                          {change.currentValue}
                        </span>
                      ) : (
                        <span className="text-gray-600 text-xs">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center text-gray-600">
                      {change.changeType !== 'removed' ? '→' : ''}
                    </td>
                    <td className="px-4 py-2">
                      {change.newValue !== null ? (
                        <span
                          className={`font-mono text-xs ${changeValueStyle[change.changeType]}`}
                        >
                          {change.newValue}
                        </span>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {changes.filter((c) => c.changeType !== 'unchanged').length === 0 && (
            <div className="px-4 py-6 text-center text-gray-500 text-sm">
              No changes detected for this switch
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExcelPreview;
