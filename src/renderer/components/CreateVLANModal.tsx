import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { X, Plus, AlertCircle, Check, Eye } from 'lucide-react';

export interface DiscoveredSwitch {
  name: string;
  ip: string;
  model: string;
  portCount: number;
}

export interface NewVLANConfig {
  vlanId: number;
  name: string;
  color: string;
  targetSwitches: string[]; // IPs
  portAssignments: Record<string, number[]>; // switchIp -> ports
  igmpSnooping: boolean;
  igmpQuerier: boolean;
}

export interface CreateVLANModalProps {
  existingVlans: number[];
  switches: DiscoveredSwitch[];
  isOpen: boolean;
  onClose: () => void;
  onCreate: (config: NewVLANConfig) => void;
}

const PRESET_COLORS = [
  '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7',
  '#ec4899', '#14b8a6', '#06b6d4', '#6366f1', '#f97316',
  '#84cc16', '#0ea5e9',
];

const SUGGESTED_NAMES: Record<number, string> = {
  1: 'Management',
  10: 'D3 Net',
  20: 'D3 Control',
  30: 'NDI',
  40: 'Art-Net',
  50: 'Intercom',
  100: 'Control',
  1300: 'Dante Primary',
  1301: 'Dante Secondary',
};

export default function CreateVLANModal({
  existingVlans,
  switches,
  isOpen,
  onClose,
  onCreate,
}: CreateVLANModalProps) {
  const [vlanId, setVlanId] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [selectedSwitches, setSelectedSwitches] = useState<Set<string>>(new Set());
  const [portSelections, setPortSelections] = useState<Record<string, Set<number>>>({});
  const [igmpSnooping, setIgmpSnooping] = useState(false);
  const [igmpQuerier, setIgmpQuerier] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setVlanId('');
      setName('');
      setColor(PRESET_COLORS[0]);
      setSelectedSwitches(new Set());
      setPortSelections({});
      setIgmpSnooping(false);
      setIgmpQuerier(false);
      setShowPreview(false);
    }
  }, [isOpen]);

  const vlanIdNum = parseInt(vlanId, 10);

  const vlanIdError = useMemo(() => {
    if (!vlanId) return '';
    if (isNaN(vlanIdNum)) return 'Must be a number';
    if (vlanIdNum < 1 || vlanIdNum > 4094) return 'Must be between 1 and 4094';
    if (existingVlans.includes(vlanIdNum)) return `VLAN ${vlanIdNum} already exists`;
    return '';
  }, [vlanId, vlanIdNum, existingVlans]);

  // Auto-suggest name when ID matches known protocols
  useEffect(() => {
    if (vlanIdNum && SUGGESTED_NAMES[vlanIdNum] && !name) {
      setName(SUGGESTED_NAMES[vlanIdNum]);
    }
  }, [vlanIdNum, name]);

  const suggestion = useMemo(() => {
    if (vlanIdNum && SUGGESTED_NAMES[vlanIdNum]) {
      return SUGGESTED_NAMES[vlanIdNum];
    }
    return null;
  }, [vlanIdNum]);

  const toggleSwitch = useCallback((ip: string) => {
    setSelectedSwitches((prev) => {
      const next = new Set(prev);
      if (next.has(ip)) {
        next.delete(ip);
      } else {
        next.add(ip);
      }
      return next;
    });
  }, []);

  const togglePort = useCallback((switchIp: string, port: number) => {
    setPortSelections((prev) => {
      const current = new Set(prev[switchIp] ?? []);
      if (current.has(port)) {
        current.delete(port);
      } else {
        current.add(port);
      }
      return { ...prev, [switchIp]: current };
    });
  }, []);

  const selectAllPorts = useCallback((switchIp: string, portCount: number) => {
    setPortSelections((prev) => {
      const current = prev[switchIp] ?? new Set();
      const allSelected = current.size === portCount;
      if (allSelected) {
        return { ...prev, [switchIp]: new Set() };
      }
      return { ...prev, [switchIp]: new Set(Array.from({ length: portCount }, (_, i) => i + 1)) };
    });
  }, []);

  const isValid = useMemo(() => {
    return (
      vlanId &&
      !vlanIdError &&
      name.trim() &&
      selectedSwitches.size > 0
    );
  }, [vlanId, vlanIdError, name, selectedSwitches]);

  const handleCreate = useCallback(() => {
    if (!isValid) return;
    const portAssignments: Record<string, number[]> = {};
    selectedSwitches.forEach((ip) => {
      portAssignments[ip] = Array.from(portSelections[ip] ?? []).sort((a, b) => a - b);
    });
    onCreate({
      vlanId: vlanIdNum,
      name: name.trim(),
      color,
      targetSwitches: Array.from(selectedSwitches),
      portAssignments,
      igmpSnooping,
      igmpQuerier,
    });
    onClose();
  }, [isValid, vlanIdNum, name, color, selectedSwitches, portSelections, igmpSnooping, igmpQuerier, onCreate, onClose]);

  if (!isOpen) return null;

  const totalPorts = Array.from(selectedSwitches).reduce((sum, ip) => {
    return sum + (portSelections[ip]?.size ?? 0);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-gc-dark border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gc-accent/20 flex items-center justify-center">
              <Plus size={18} className="text-gc-accent" />
            </div>
            <h2 className="text-lg font-semibold text-white">Create VLAN</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6">
          {/* VLAN ID + Name row */}
          <div className="grid grid-cols-2 gap-4">
            {/* VLAN ID */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">VLAN ID</label>
              <input
                type="number"
                min={1}
                max={4094}
                value={vlanId}
                onChange={(e) => setVlanId(e.target.value)}
                placeholder="1-4094"
                className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gc-accent/50 ${
                  vlanIdError ? 'border-red-500' : 'border-gray-600'
                }`}
              />
              {vlanIdError && (
                <div className="flex items-center gap-1 mt-1 text-xs text-red-400">
                  <AlertCircle size={12} />
                  {vlanIdError}
                </div>
              )}
              {suggestion && !vlanIdError && vlanId && (
                <div className="mt-1 text-xs text-gc-accent">
                  Detected: {suggestion}
                </div>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VLAN name"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gc-accent/50"
              />
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Color</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    color === c ? 'border-white scale-110' : 'border-transparent hover:border-gray-500'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Target Switches */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Target Switches</label>
            <div className="space-y-2">
              {switches.map((sw) => (
                <div key={sw.ip} className="border border-gray-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSwitch(sw.ip)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                      selectedSwitches.has(sw.ip)
                        ? 'bg-gc-accent/10 border-gc-accent/30'
                        : 'hover:bg-gray-800'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        selectedSwitches.has(sw.ip)
                          ? 'bg-gc-accent border-gc-accent'
                          : 'border-gray-500'
                      }`}
                    >
                      {selectedSwitches.has(sw.ip) && <Check size={12} className="text-white" />}
                    </div>
                    <div className="flex-1">
                      <span className="text-sm text-gray-200">{sw.name}</span>
                      <span className="text-xs text-gray-500 ml-2">{sw.ip}</span>
                      <span className="text-xs text-gray-500 ml-2">({sw.portCount} ports)</span>
                    </div>
                  </button>

                  {/* Port selection when switch is selected */}
                  {selectedSwitches.has(sw.ip) && (
                    <div className="px-3 py-2 bg-gray-800/50 border-t border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400">Select ports:</span>
                        <button
                          onClick={() => selectAllPorts(sw.ip, sw.portCount)}
                          className="text-xs text-gc-accent hover:text-gc-accent/80 transition-colors"
                        >
                          {(portSelections[sw.ip]?.size ?? 0) === sw.portCount
                            ? 'Deselect All'
                            : 'Select All'}
                        </button>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {Array.from({ length: sw.portCount }, (_, i) => i + 1).map((port) => {
                          const isSelected = portSelections[sw.ip]?.has(port) ?? false;
                          return (
                            <button
                              key={port}
                              onClick={() => togglePort(sw.ip, port)}
                              className={`w-7 h-7 rounded text-[10px] font-mono flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'text-white'
                                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                              }`}
                              style={isSelected ? { backgroundColor: color } : undefined}
                            >
                              {port}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* IGMP Settings */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">IGMP Settings</label>
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
              <div>
                <div className="text-sm text-gray-200">IGMP Snooping</div>
                <div className="text-xs text-gray-500">Filter multicast traffic on this VLAN</div>
              </div>
              <button
                onClick={() => setIgmpSnooping(!igmpSnooping)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  igmpSnooping ? 'bg-gc-accent' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    igmpSnooping ? 'translate-x-[18px]' : 'translate-x-[3px]'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
              <div>
                <div className="text-sm text-gray-200">IGMP Querier</div>
                <div className="text-xs text-gray-500">Enable querier on primary switch</div>
              </div>
              <button
                onClick={() => setIgmpQuerier(!igmpQuerier)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  igmpQuerier ? 'bg-gc-accent' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    igmpQuerier ? 'translate-x-[18px]' : 'translate-x-[3px]'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Preview */}
          {showPreview && isValid && (
            <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg space-y-2">
              <h4 className="text-sm font-medium text-gray-200">Preview</h4>
              <div className="text-xs text-gray-400 space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full inline-block"
                    style={{ backgroundColor: color }}
                  />
                  <span>VLAN {vlanId} &mdash; {name}</span>
                </div>
                <div>{selectedSwitches.size} switch{selectedSwitches.size !== 1 ? 'es' : ''}</div>
                <div>{totalPorts} port{totalPorts !== 1 ? 's' : ''} assigned</div>
                <div>IGMP Snooping: {igmpSnooping ? 'Enabled' : 'Disabled'}</div>
                <div>IGMP Querier: {igmpQuerier ? 'Enabled' : 'Disabled'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700">
          <button
            onClick={() => setShowPreview(!showPreview)}
            disabled={!isValid}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Eye size={14} />
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-300 hover:text-white border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!isValid}
              className="px-4 py-2 text-sm font-medium text-white bg-gc-accent rounded-lg hover:bg-gc-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Create VLAN
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
