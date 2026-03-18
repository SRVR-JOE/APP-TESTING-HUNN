import React, { useState, useMemo } from 'react';
import { GripVertical, ArrowUpDown } from 'lucide-react';
import type { DiscoveredSwitch } from '@shared/types';

export interface NamingAssignment {
  switchId: string;
  currentName: string;
  newName: string;
}

export interface SequentialNamingProps {
  switches: DiscoveredSwitch[];
  onPreview: (assignments: NamingAssignment[]) => void;
  onApply: (assignments: NamingAssignment[]) => void;
  previewReviewed: boolean;
}

export const SequentialNaming: React.FC<SequentialNamingProps> = ({
  switches,
  onPreview,
  onApply,
  previewReviewed,
}) => {
  const [baseName, setBaseName] = useState('FOH-SW-');
  const [startNumber, setStartNumber] = useState(1);
  const [padding, setPadding] = useState(2);
  const [order, setOrder] = useState<string[]>(switches.map((s) => s.id));
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  // Keep order in sync when switches change
  useMemo(() => {
    const currentIds = new Set(order);
    const newIds = switches.map((s) => s.id);
    const hasNew = newIds.some((id) => !currentIds.has(id));
    if (hasNew || order.length !== newIds.length) {
      setOrder(newIds);
    }
  }, [switches.map((s) => s.id).join(',')]);

  const assignments = useMemo(() => {
    return order
      .map((id, idx) => {
        const sw = switches.find((s) => s.id === id);
        if (!sw) return null;
        const num = (startNumber + idx).toString().padStart(padding, '0');
        return {
          switchId: id,
          currentName: sw.name,
          newName: `${baseName}${num}`,
        };
      })
      .filter(Boolean) as NamingAssignment[];
  }, [order, switches, baseName, startNumber, padding]);

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    const next = [...order];
    const [removed] = next.splice(draggedIdx, 1);
    next.splice(idx, 0, removed);
    setOrder(next);
    setDraggedIdx(idx);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
  };

  const sortByIP = () => {
    const sorted = [...order].sort((a, b) => {
      const swA = switches.find((s) => s.id === a);
      const swB = switches.find((s) => s.id === b);
      if (!swA || !swB) return 0;
      const partsA = swA.ip.split('.').map(Number);
      const partsB = swB.ip.split('.').map(Number);
      for (let i = 0; i < 4; i++) {
        if (partsA[i] !== partsB[i]) return partsA[i] - partsB[i];
      }
      return 0;
    });
    setOrder(sorted);
  };

  const sortByName = () => {
    const sorted = [...order].sort((a, b) => {
      const swA = switches.find((s) => s.id === a);
      const swB = switches.find((s) => s.id === b);
      if (!swA || !swB) return 0;
      return swA.name.localeCompare(swB.name);
    });
    setOrder(sorted);
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-white">Sequential Naming</h4>
        <p className="text-xs text-gray-400 mt-0.5">
          Assign sequential names to selected switches. Drag to reorder.
        </p>
      </div>

      {/* Configuration */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Base Name</label>
          <input
            type="text"
            value={baseName}
            onChange={(e) => setBaseName(e.target.value)}
            placeholder="FOH-SW-"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gc-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Start Number</label>
          <input
            type="number"
            value={startNumber}
            onChange={(e) => setStartNumber(parseInt(e.target.value) || 1)}
            min={0}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gc-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Zero-Padding Digits</label>
          <select
            value={padding}
            onChange={(e) => setPadding(parseInt(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gc-accent"
          >
            <option value={1}>1 digit (1, 2, 3...)</option>
            <option value={2}>2 digits (01, 02, 03...)</option>
            <option value={3}>3 digits (001, 002, 003...)</option>
          </select>
        </div>
      </div>

      {/* Sort buttons */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Sort by:</span>
        <button
          onClick={sortByIP}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gc-accent transition-colors px-2 py-1 bg-gray-800 rounded border border-gray-700"
        >
          <ArrowUpDown className="w-3 h-3" /> IP Address
        </button>
        <button
          onClick={sortByName}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gc-accent transition-colors px-2 py-1 bg-gray-800 rounded border border-gray-700"
        >
          <ArrowUpDown className="w-3 h-3" /> Current Name
        </button>
      </div>

      {/* Preview list */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 divide-y divide-gray-700/50 max-h-80 overflow-y-auto">
        {assignments.map((a, idx) => (
          <div
            key={a.switchId}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-3 px-3 py-2 transition-colors cursor-grab active:cursor-grabbing ${
              draggedIdx === idx ? 'bg-gc-accent/10' : 'hover:bg-gray-800'
            }`}
          >
            <GripVertical className="w-4 h-4 text-gray-600 flex-shrink-0" />
            <span className="text-xs text-gray-500 w-6 text-center">{idx + 1}</span>
            <div className="flex-1 min-w-0">
              <span className="text-sm text-gray-400">{a.currentName}</span>
            </div>
            <span className="text-gray-600 text-xs">&rarr;</span>
            <div className="flex-1 min-w-0">
              <span className="text-sm text-white font-medium">{a.newName}</span>
            </div>
          </div>
        ))}
        {assignments.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            No switches selected
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-gray-700">
        <button
          onClick={() => onPreview(assignments)}
          className="px-4 py-2 text-sm font-medium bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          Preview Changes
        </button>
        <button
          onClick={() => onApply(assignments)}
          disabled={!previewReviewed}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            previewReviewed
              ? 'bg-gc-accent text-white hover:bg-gc-accent/80'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Apply Names
        </button>
        {!previewReviewed && (
          <span className="text-xs text-gray-500">Preview changes first</span>
        )}
      </div>
    </div>
  );
};

export default SequentialNaming;
