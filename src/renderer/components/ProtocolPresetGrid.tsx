import React, { useState, useMemo, useCallback } from 'react';
import {
  Settings,
  Music,
  Radio,
  Lightbulb,
  Zap,
  Sliders,
  Video,
  Tv,
  Waves,
  Headphones,
  Monitor,
  Wifi,
  Check,
  Layers,
} from 'lucide-react';
import { PROTOCOL_VLAN_PRESETS } from '@shared/constants';
import type { ProtocolVlanPreset } from '@shared/types';

// ─── Icon mapper ─────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
  Settings:    <Settings size={20} />,
  Music:       <Music size={20} />,
  Radio:       <Radio size={20} />,
  Lightbulb:   <Lightbulb size={20} />,
  Zap:         <Zap size={20} />,
  Sliders:     <Sliders size={20} />,
  Video:       <Video size={20} />,
  Tv:          <Tv size={20} />,
  Waves:       <Waves size={20} />,
  Headphones:  <Headphones size={20} />,
  Monitor:     <Monitor size={20} />,
  Wifi:        <Wifi size={20} />,
};

// ─── Protocol type color categories ──────────────────────────────────────────

function protocolCategory(protocol: string): string {
  if (['dante-primary', 'dante-secondary', 'aes67', 'avb'].includes(protocol)) return 'Audio';
  if (['sacn', 'artnet', 'ma-net'].includes(protocol)) return 'Lighting';
  if (['ndi', 'st2110', 'video'].includes(protocol)) return 'Video';
  return 'Infrastructure';
}

const CATEGORY_BORDER: Record<string, string> = {
  Audio:          'border-l-red-500',
  Lighting:       'border-l-yellow-500',
  Video:          'border-l-blue-500',
  Infrastructure: 'border-l-gray-500',
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ProtocolPresetGrid() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState(false);

  const togglePreset = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setApplied(false);
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(PROTOCOL_VLAN_PRESETS.map((p) => p.id)));
    setApplied(false);
  }, []);

  const selectNone = useCallback(() => {
    setSelectedIds(new Set());
    setApplied(false);
  }, []);

  const handleApply = useCallback(() => {
    // In a real app, this would create VLANs from selected presets
    setApplied(true);
    setTimeout(() => setApplied(false), 3000);
  }, []);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, ProtocolVlanPreset[]> = {};
    PROTOCOL_VLAN_PRESETS.forEach((p) => {
      const cat = protocolCategory(p.protocol);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return groups;
  }, []);

  const selectedCount = selectedIds.size;

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers size={22} className="text-gc-accent" />
          <div>
            <h2 className="text-lg font-bold">Protocol VLAN Presets</h2>
            <p className="text-xs text-gray-400">
              {PROTOCOL_VLAN_PRESETS.length} presets available — {selectedCount} selected
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-600 text-gray-300 hover:text-white transition"
            onClick={selectAll}
          >
            Select All
          </button>
          <button
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-600 text-gray-300 hover:text-white transition"
            onClick={selectNone}
          >
            Clear
          </button>
          <button
            className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg font-medium transition disabled:opacity-40 ${
              applied
                ? 'bg-green-500 text-white'
                : 'bg-gc-accent text-gray-900 hover:bg-gc-accent/90'
            }`}
            disabled={selectedCount === 0}
            onClick={handleApply}
          >
            {applied ? (
              <>
                <Check size={14} />
                Applied!
              </>
            ) : (
              <>
                <Layers size={14} />
                Apply Selected ({selectedCount})
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── Grouped Grid ────────────────────────────────────────────── */}
      {Object.entries(grouped).map(([category, presets]) => (
        <div key={category}>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            {category}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {presets.map((preset) => {
              const isSelected = selectedIds.has(preset.id);
              return (
                <button
                  key={preset.id}
                  className={`text-left border-l-4 rounded-xl p-4 transition ${CATEGORY_BORDER[category]} ${
                    isSelected
                      ? 'bg-gray-800/80 border border-l-4 border-gc-accent/40 ring-1 ring-gc-accent/20'
                      : 'bg-gray-800/30 border border-l-4 border-gray-700 hover:border-gray-600'
                  }`}
                  onClick={() => togglePreset(preset.id)}
                >
                  {/* Top row: icon + name + toggle */}
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: preset.color + '20', color: preset.color }}
                    >
                      {ICON_MAP[preset.icon] || <Settings size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{preset.name}</div>
                      <div className="text-[10px] text-gray-500">{preset.description}</div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                        isSelected
                          ? 'bg-gc-accent border-gc-accent'
                          : 'border-gray-600'
                      }`}
                    >
                      {isSelected && <Check size={12} className="text-gray-900" />}
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">VLAN ID</span>
                      <span className="font-mono font-semibold" style={{ color: preset.color }}>
                        {preset.vlanId}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Subnet</span>
                      <span className="font-mono text-gray-300">{preset.subnet}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">IGMP Snoop</span>
                      <span className={preset.igmpSnooping ? 'text-green-400' : 'text-gray-600'}>
                        {preset.igmpSnooping ? 'On' : 'Off'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">IGMP Querier</span>
                      <span className={preset.igmpQuerier ? 'text-green-400' : 'text-gray-600'}>
                        {preset.igmpQuerier ? 'On' : 'Off'}
                      </span>
                    </div>
                    {preset.qosDscp !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">QoS DSCP</span>
                        <span className="font-mono text-gray-300">{preset.qosDscp}</span>
                      </div>
                    )}
                    {preset.priority !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Priority</span>
                        <span className="font-mono text-gray-300">{preset.priority}</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
