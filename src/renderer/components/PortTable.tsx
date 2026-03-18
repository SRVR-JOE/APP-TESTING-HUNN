import React, { useState, useMemo, useCallback } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil, Check, X } from 'lucide-react';
import type { PortInfo } from '../types';

// ─── Extended Port Type ──────────────────────────────────────────────────────

export interface PortInfoExtended extends PortInfo {
  connectedDevice?: string;
  duplex?: string;
  vlanMode?: string;
  txBytes?: number;
  rxBytes?: number;
  errors?: number;
}

export interface PortTableProps {
  ports: PortInfoExtended[];
  onPortUpdate: (port: number, updates: Partial<PortInfoExtended>) => void;
  onPortToggle: (port: number, enabled: boolean) => void;
  onPortSelect?: (port: number) => void;
  selectedPorts?: number[];
}

// ─── Sort Helper ─────────────────────────────────────────────────────────────

type SortKey = 'port' | 'label' | 'adminStatus' | 'operStatus' | 'speed' | 'duplex' | 'groupId' | 'vlanMode' | 'connectedDevice' | 'txBytes' | 'rxBytes' | 'errors';
type SortDir = 'asc' | 'desc';

function sortPorts(ports: PortInfoExtended[], key: SortKey, dir: SortDir): PortInfoExtended[] {
  return [...ports].sort((a, b) => {
    const aVal = a[key as keyof PortInfoExtended] ?? '';
    const bVal = b[key as keyof PortInfoExtended] ?? '';
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return dir === 'asc' ? aVal - bVal : bVal - aVal;
    }
    const strA = String(aVal).toLowerCase();
    const strB = String(bVal).toLowerCase();
    return dir === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
  });
}

function formatBytes(bytes: number | undefined): string {
  if (bytes == null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ─── Toggle ──────────────────────────────────────────────────────────────────

const Toggle: React.FC<{ enabled: boolean; onChange: (val: boolean) => void }> = ({ enabled, onChange }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onChange(!enabled); }}
    className={`relative w-8 h-4.5 rounded-full transition-colors duration-200 ${enabled ? 'bg-gc-accent' : 'bg-gray-600'}`}
    style={{ width: 32, height: 18 }}
  >
    <span
      className={`absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform duration-200`}
      style={{ width: 14, height: 14, transform: enabled ? 'translateX(14px)' : 'translateX(0)' }}
    />
  </button>
);

// ─── Editable Label Cell ─────────────────────────────────────────────────────

const EditableLabel: React.FC<{
  value: string;
  onSave: (val: string) => void;
}> = ({ value, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(value);

  const save = () => {
    if (editVal !== value) onSave(editVal);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={editVal}
          onChange={(e) => setEditVal(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') { setEditVal(value); setEditing(false); }
          }}
          className="bg-gray-700 border border-gc-accent/50 rounded px-1.5 py-0.5 text-xs text-white outline-none w-24"
        />
      </div>
    );
  }

  return (
    <span
      className="group flex items-center gap-1 cursor-pointer"
      onClick={(e) => { e.stopPropagation(); setEditVal(value); setEditing(true); }}
    >
      <span className="text-sm text-gray-300">{value}</span>
      <Pencil size={10} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
    </span>
  );
};

// ─── Group Dropdown ──────────────────────────────────────────────────────────

const GROUP_OPTIONS = [
  { id: 1, name: 'Mgmt' },
  { id: 10, name: 'D3-Net' },
  { id: 20, name: 'D3-Ctrl' },
  { id: 30, name: 'NDI' },
  { id: 40, name: 'Art-Net' },
  { id: 50, name: 'Intercom' },
  { id: 100, name: 'Control' },
  { id: 1300, name: 'Dante-Pri' },
  { id: 1301, name: 'Dante-Sec' },
];

const GroupDropdown: React.FC<{
  value: number | undefined;
  onChange: (id: number) => void;
}> = ({ value, onChange }) => (
  <select
    value={value ?? ''}
    onChange={(e) => { e.stopPropagation(); onChange(Number(e.target.value)); }}
    onClick={(e) => e.stopPropagation()}
    className="bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-white outline-none cursor-pointer hover:border-gray-500"
  >
    <option value="">None</option>
    {GROUP_OPTIONS.map((g) => (
      <option key={g.id} value={g.id}>{g.name} ({g.id})</option>
    ))}
  </select>
);

// ─── Sort Header ─────────────────────────────────────────────────────────────

const SortHeader: React.FC<{
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
}> = ({ label, sortKey, currentSort, currentDir, onSort }) => (
  <th
    onClick={() => onSort(sortKey)}
    className="px-3 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 select-none"
  >
    <div className="flex items-center gap-1">
      {label}
      {currentSort === sortKey ? (
        currentDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
      ) : (
        <ArrowUpDown size={10} className="text-gray-600" />
      )}
    </div>
  </th>
);

// ─── Status Badge ────────────────────────────────────────────────────────────

const OperBadge: React.FC<{ status: 'up' | 'down' }> = ({ status }) => (
  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${
    status === 'up'
      ? 'bg-green-500/20 text-green-400 border-green-500/30'
      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }`}>
    {status === 'up' ? 'Up' : 'Down'}
  </span>
);

// ─── Main Component ──────────────────────────────────────────────────────────

export const PortTable: React.FC<PortTableProps> = ({
  ports,
  onPortUpdate,
  onPortToggle,
  onPortSelect,
  selectedPorts = [],
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('port');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }, [sortKey]);

  const sorted = useMemo(() => sortPorts(ports, sortKey, sortDir), [ports, sortKey, sortDir]);

  return (
    <div className="space-y-3">
      {/* Bulk actions */}
      {selectedPorts.length > 1 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-gc-accent/10 border border-gc-accent/30 rounded-lg">
          <span className="text-sm text-gc-accent font-medium">{selectedPorts.length} ports selected</span>
          <button
            onClick={() => selectedPorts.forEach((p) => onPortToggle(p, true))}
            className="px-3 py-1 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30 transition-colors"
          >
            Enable All
          </button>
          <button
            onClick={() => selectedPorts.forEach((p) => onPortToggle(p, false))}
            className="px-3 py-1 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30 transition-colors"
          >
            Disable All
          </button>
        </div>
      )}

      <div className="bg-gc-panel rounded-lg border border-gray-700 overflow-x-auto">
        <table className="w-full text-left min-w-[900px]">
          <thead>
            <tr className="bg-gray-800/60 border-b border-gray-700">
              <SortHeader label="Port" sortKey="port" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="Label" sortKey="label" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <th className="px-3 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Admin</th>
              <SortHeader label="Oper" sortKey="operStatus" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="Speed" sortKey="speed" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="Duplex" sortKey="duplex" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="Group" sortKey="groupId" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="VLAN Mode" sortKey="vlanMode" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="Device" sortKey="connectedDevice" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="TX" sortKey="txBytes" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="RX" sortKey="rxBytes" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="Errors" sortKey="errors" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((port) => {
              const isSelected = selectedPorts.includes(port.port);
              return (
                <tr
                  key={port.port}
                  onClick={() => onPortSelect?.(port.port)}
                  className={`
                    border-t border-gray-700/50 cursor-pointer transition-colors
                    ${isSelected ? 'bg-gc-accent/10' : 'hover:bg-gray-800/30'}
                  `}
                >
                  <td className="px-3 py-2 text-sm font-mono text-white">{port.port}</td>
                  <td className="px-3 py-2">
                    <EditableLabel
                      value={port.label}
                      onSave={(val) => onPortUpdate(port.port, { label: val })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Toggle
                      enabled={port.adminStatus === 'up'}
                      onChange={(val) => onPortToggle(port.port, val)}
                    />
                  </td>
                  <td className="px-3 py-2"><OperBadge status={port.operStatus} /></td>
                  <td className="px-3 py-2 text-sm text-gray-300">{port.speed || '-'}</td>
                  <td className="px-3 py-2 text-sm text-gray-300">{port.duplex || 'Full'}</td>
                  <td className="px-3 py-2">
                    <GroupDropdown
                      value={port.groupId}
                      onChange={(id) => onPortUpdate(port.port, { groupId: id })}
                    />
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-300">{port.vlanMode || 'Access'}</td>
                  <td className="px-3 py-2 text-sm text-gray-400 max-w-[140px] truncate">
                    {port.connectedDevice || '-'}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-400 font-mono">{formatBytes(port.txBytes)}</td>
                  <td className="px-3 py-2 text-xs text-gray-400 font-mono">{formatBytes(port.rxBytes)}</td>
                  <td className="px-3 py-2 text-xs font-mono">
                    <span className={(port.errors ?? 0) > 0 ? 'text-red-400' : 'text-gray-500'}>
                      {port.errors ?? 0}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PortTable;
