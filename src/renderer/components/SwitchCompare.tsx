// =============================================================================
// GigaCore Command — Side-by-Side Switch Comparison View
// =============================================================================

import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Server,
  Equal,
  AlertTriangle,
} from 'lucide-react';
import type { CompareResult, CompareSection, CompareDiff } from '../../main/troubleshoot/quick-compare';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SwitchCompareProps {
  result: CompareResult;
  onSync: (field: string, direction: 'AtoB' | 'BtoA') => void;
}

// ---------------------------------------------------------------------------
// Section component
// ---------------------------------------------------------------------------

const SectionBlock: React.FC<{
  section: CompareSection;
  onSync: (field: string, direction: 'AtoB' | 'BtoA') => void;
}> = ({ section, onSync }) => {
  const [expanded, setExpanded] = useState(true);
  const diffCount = section.differences.filter((d) => !d.match).length;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-700/50">
      {/* Section header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between bg-gray-800/80 px-4 py-2.5 text-left hover:bg-gray-800"
      >
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-gray-200">{section.name}</h4>
          {section.isIdentical ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
              <Equal className="h-3 w-3" />
              Identical
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
              <AlertTriangle className="h-3 w-3" />
              {diffCount} difference{diffCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>

      {/* Diff table */}
      {expanded && (
        <div className="divide-y divide-gray-700/30">
          {section.differences.map((diff, idx) => (
            <DiffRow key={idx} diff={diff} onSync={onSync} />
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Diff row
// ---------------------------------------------------------------------------

const DiffRow: React.FC<{
  diff: CompareDiff;
  onSync: (field: string, direction: 'AtoB' | 'BtoA') => void;
}> = ({ diff, onSync }) => {
  const rowBg = diff.match ? 'bg-gray-900/30' : 'bg-yellow-500/5';
  const valueBg = diff.match ? '' : 'bg-yellow-500/10 rounded px-1';

  return (
    <div className={`grid grid-cols-[1fr_2fr_auto_2fr_auto] items-center gap-2 px-4 py-2 text-xs ${rowBg}`}>
      {/* Field name */}
      <span className="font-medium text-gray-400 truncate" title={diff.field}>
        {diff.field}
      </span>

      {/* Value A */}
      <span className={`font-mono text-gray-200 truncate ${valueBg}`} title={diff.valueA}>
        {diff.valueA}
      </span>

      {/* Sync buttons (only for differing rows) */}
      {!diff.match ? (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onSync(diff.field, 'AtoB')}
            className="rounded p-1 text-gray-500 hover:bg-blue-500/20 hover:text-blue-400"
            title={`Sync A \u2192 B`}
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onSync(diff.field, 'BtoA')}
            className="rounded p-1 text-gray-500 hover:bg-blue-500/20 hover:text-blue-400"
            title={`Sync B \u2192 A`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center">
          <Equal className="h-3 w-3 text-gray-600" />
        </div>
      )}

      {/* Value B */}
      <span className={`font-mono text-gray-200 truncate ${valueBg}`} title={diff.valueB}>
        {diff.valueB}
      </span>

      {/* Match indicator */}
      <div className="w-2">
        {!diff.match && <div className="h-2 w-2 rounded-full bg-yellow-500" />}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const SwitchCompare: React.FC<SwitchCompareProps> = ({ result, onSync }) => {
  const totalDiffs = result.sections.reduce(
    (sum, s) => sum + s.differences.filter((d) => !d.match).length,
    0,
  );

  return (
    <div className="space-y-4">
      {/* Column headers */}
      <div className="grid grid-cols-2 gap-4">
        {/* Switch A */}
        <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
          <Server className="h-5 w-5 flex-shrink-0 text-blue-400" />
          <div>
            <p className="text-sm font-bold text-gray-100">{result.switchA.name}</p>
            <p className="text-xs text-gray-400">
              {result.switchA.model} &mdash; {result.switchA.ip}
            </p>
          </div>
          <span className="ml-auto rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-400">
            A
          </span>
        </div>

        {/* Switch B */}
        <div className="flex items-center gap-3 rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
          <Server className="h-5 w-5 flex-shrink-0 text-purple-400" />
          <div>
            <p className="text-sm font-bold text-gray-100">{result.switchB.name}</p>
            <p className="text-xs text-gray-400">
              {result.switchB.model} &mdash; {result.switchB.ip}
            </p>
          </div>
          <span className="ml-auto rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-medium text-purple-400">
            B
          </span>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        {totalDiffs === 0 ? (
          <span className="text-emerald-400">Switches are identical across all sections.</span>
        ) : (
          <span className="text-yellow-400">{totalDiffs} total difference{totalDiffs !== 1 ? 's' : ''} found.</span>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {result.sections.map((section) => (
          <SectionBlock key={section.name} section={section} onSync={onSync} />
        ))}
      </div>
    </div>
  );
};

export default SwitchCompare;
