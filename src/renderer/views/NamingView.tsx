import React, { useState, useMemo, useCallback } from 'react';
import {
  Type, Check, CheckSquare, Square, ChevronRight, Plus,
  PanelRightClose, PanelRightOpen, ArrowUpDown, Zap,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useNamingStore } from '../store/useNamingStore';
import { useRackMapStore } from '../store/useRackMapStore';
import { LOCATION_TYPE_CONFIG } from '@shared/constants';
import { extractVariables } from '../lib/naming-engine';
import type { LocationType, DiscoveredSwitch, NamingTemplate } from '@shared/types';
import { LocationTypeBadge } from '../components/LocationTypeBadge';
import { NamingConflictBanner } from '../components/NamingConflictBanner';
import { NamingTemplateEditor } from '../components/NamingTemplateEditor';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const healthColors: Record<string, string> = {
  healthy: '#22c55e', warning: '#f59e0b', critical: '#ef4444', offline: '#6b7280',
};

function groupSwitchesByRack(
  switches: DiscoveredSwitch[],
  assignments: Record<string, string>,
  groups: { id: string; name: string; locationType?: LocationType }[],
) {
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const result: { key: string; groupName: string; locationType: LocationType | 'unassigned'; switches: DiscoveredSwitch[] }[] = [];
  const buckets = new Map<string, DiscoveredSwitch[]>();

  for (const sw of switches) {
    const groupId = assignments[sw.id];
    const key = groupId ?? 'unassigned';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(sw);
  }

  for (const [key, sws] of buckets) {
    const group = groupMap.get(key);
    result.push({
      key,
      groupName: group?.name ?? 'Unassigned',
      locationType: (group?.locationType as LocationType) ?? 'unassigned',
      switches: sws,
    });
  }

  const order: Record<string, number> = { truss: 0, rack: 1, floor: 2, unassigned: 3 };
  result.sort((a, b) => (order[a.locationType] ?? 3) - (order[b.locationType] ?? 3));
  return result;
}

// ─── NamingView ──────────────────────────────────────────────────────────────

export default function NamingView() {
  const switches = useAppStore((s) => s.switches);
  const rackGroups = useRackMapStore((s) => s.rackGroups);
  const switchAssignments = useRackMapStore((s) => s.switchAssignments);
  const allRackSwitches = useRackMapStore((s) => s.allSwitches);

  // Merge: use discovered switches, fall back to rack switches for grouping
  const allSwitches = useMemo(() => {
    if (switches.length > 0) return switches;
    // Map rack switches to minimal DiscoveredSwitch shape for display
    return allRackSwitches.map((rs) => ({
      id: rs.id, name: rs.name, model: rs.model, ip: rs.ip,
      mac: '', firmware: '', generation: 1 as const, lastSeen: '', firstSeen: '',
      isOnline: rs.healthStatus !== 'offline', portCount: rs.portCount, portsUp: rs.portsUp,
      healthStatus: rs.healthStatus as any,
    }));
  }, [switches, allRackSwitches]);

  const rackGroupsWithType = useMemo(
    () => rackGroups.map((g) => ({ id: g.id, name: g.name, locationType: undefined as LocationType | undefined })),
    [rackGroups],
  );

  const {
    templates, selectedSwitchIds, selectedTemplateId, variableOverrides,
    startNumber, numberPadding,
    toggleSwitchSelection, setSelectedSwitchIds, clearSelection,
    setSelectedTemplate, setVariableOverrides, setStartNumber, setNumberPadding,
    getPreviewNames, getConflicts, applyNames,
    addTemplate, updateTemplate, deleteTemplate,
  } = useNamingStore();

  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NamingTemplate | null>(null);
  const [filterLocationType, setFilterLocationType] = useState<LocationType | 'all'>('all');

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const previewNames = useMemo(() => getPreviewNames(), [selectedSwitchIds, selectedTemplateId, variableOverrides, startNumber, numberPadding, templates]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const conflicts = useMemo(() => getConflicts(), [previewNames]);

  const switchGroups = useMemo(
    () => groupSwitchesByRack(allSwitches as DiscoveredSwitch[], switchAssignments, rackGroupsWithType),
    [allSwitches, switchAssignments, rackGroupsWithType],
  );

  const filteredTemplates = useMemo(
    () => filterLocationType === 'all' ? templates : templates.filter((t) => t.locationType === filterLocationType),
    [templates, filterLocationType],
  );

  const previewMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of previewNames) m.set(p.switchId, p.name);
    return m;
  }, [previewNames]);

  const extractedVars = useMemo(
    () => selectedTemplate ? extractVariables(selectedTemplate.pattern) : [],
    [selectedTemplate],
  );

  const handleSelectGroup = useCallback((groupSwitches: DiscoveredSwitch[]) => {
    const ids = groupSwitches.map((s) => s.id);
    const allSelected = ids.every((id) => selectedSwitchIds.includes(id));
    if (allSelected) {
      setSelectedSwitchIds(selectedSwitchIds.filter((id) => !ids.includes(id)));
    } else {
      const merged = Array.from(new Set([...selectedSwitchIds, ...ids]));
      setSelectedSwitchIds(merged);
    }
  }, [selectedSwitchIds, setSelectedSwitchIds]);

  const handleApply = useCallback(() => {
    if (conflicts.length > 0) return;
    applyNames();
  }, [conflicts, applyNames]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Type size={18} className="text-gc-accent" />
          <span className="text-[10px] tracking-[0.3em] uppercase text-gc-accent">Naming System</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Device Naming</h1>
        <p className="text-xs text-gray-400 mt-1">Select switches, choose a template, preview and apply names</p>
      </div>

      {/* Three-panel layout */}
      <div className={`grid gap-4 ${showEditor ? 'grid-cols-[1fr_1fr_320px]' : 'grid-cols-2'}`}>
        {/* LEFT — Switch selection */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 max-h-[calc(100vh-240px)] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
              Switches
              <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                {selectedSwitchIds.length}/{allSwitches.length}
              </span>
            </h2>
            <div className="flex gap-1.5">
              <button onClick={() => setSelectedSwitchIds(allSwitches.map((s) => s.id))} className="text-[10px] text-gray-400 hover:text-white px-2 py-1 bg-gray-800 rounded border border-gray-700 transition-colors">Select All</button>
              <button onClick={clearSelection} className="text-[10px] text-gray-400 hover:text-white px-2 py-1 bg-gray-800 rounded border border-gray-700 transition-colors">Clear</button>
            </div>
          </div>

          {switchGroups.map((group) => {
            const allSelected = group.switches.every((s) => selectedSwitchIds.includes(s.id));
            const someSelected = group.switches.some((s) => selectedSwitchIds.includes(s.id));
            return (
              <div key={group.key} className="mb-3">
                <button
                  onClick={() => handleSelectGroup(group.switches)}
                  className="flex items-center gap-2 w-full text-left px-1 py-1.5 border-b border-gray-700/50"
                >
                  {allSelected ? <CheckSquare size={14} className="text-gc-accent" />
                    : someSelected ? <CheckSquare size={14} className="text-gc-accent/40" />
                    : <Square size={14} className="text-gray-600" />}
                  {group.locationType !== 'unassigned' && <LocationTypeBadge type={group.locationType as LocationType} size="sm" />}
                  <span className="text-xs font-semibold text-gray-300">{group.groupName}</span>
                  <span className="ml-auto text-[10px] text-gray-500 bg-gray-800 px-1.5 rounded-full">{group.switches.length}</span>
                </button>

                {group.switches.map((sw) => {
                  const isSelected = selectedSwitchIds.includes(sw.id);
                  const previewName = previewMap.get(sw.id);
                  return (
                    <button
                      key={sw.id}
                      onClick={() => toggleSwitchSelection(sw.id)}
                      className={`flex items-center gap-2 w-full text-left pl-6 pr-2 py-1 transition-colors ${
                        isSelected ? 'bg-gc-accent/5 border-l-2 border-gc-accent' : 'border-l-2 border-transparent hover:bg-gray-800'
                      }`}
                    >
                      {isSelected ? <Check size={12} className="text-gc-accent flex-shrink-0" /> : <div className="w-3 flex-shrink-0" />}
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: healthColors[sw.healthStatus] ?? '#6b7280' }} />
                      <span className="text-xs text-gray-300 flex-1 truncate">{sw.name}</span>
                      {previewName && (
                        <>
                          <ChevronRight size={10} className="text-gray-600 flex-shrink-0" />
                          <span className="text-[10px] text-gc-accent font-semibold truncate max-w-[120px]">{previewName}</span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* CENTER — Template selector + preview */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex flex-col gap-4 max-h-[calc(100vh-240px)] overflow-y-auto">
          {/* Template selector header */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Templates</h2>
              <div className="flex gap-1.5 items-center">
                <select
                  value={filterLocationType}
                  onChange={(e) => setFilterLocationType(e.target.value as LocationType | 'all')}
                  className="text-[10px] text-gray-300 bg-gray-800 border border-gray-700 rounded px-2 py-1 focus:outline-none"
                >
                  <option value="all">All Types</option>
                  <option value="truss">Truss</option>
                  <option value="rack">Rack</option>
                  <option value="floor">Floor</option>
                </select>
                <button
                  onClick={() => { setEditingTemplate(null); setShowEditor(true); }}
                  className="flex items-center gap-1 text-[10px] text-gc-accent px-2 py-1 bg-gray-800 rounded border border-gray-700 hover:bg-gray-700 transition-colors"
                >
                  <Plus size={12} /> New
                </button>
                <button
                  onClick={() => setShowEditor(!showEditor)}
                  className="text-gray-400 hover:text-white px-1.5 py-1 bg-gray-800 rounded border border-gray-700 transition-colors"
                  title={showEditor ? 'Hide editor' : 'Show editor'}
                >
                  {showEditor ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
                </button>
              </div>
            </div>

            {/* Template grid */}
            <div className="grid grid-cols-2 gap-2">
              {filteredTemplates.map((tpl) => {
                const isActive = tpl.id === selectedTemplateId;
                const ltColor = LOCATION_TYPE_CONFIG[tpl.locationType].color;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => setSelectedTemplate(tpl.id)}
                    onDoubleClick={() => { setEditingTemplate(tpl); setShowEditor(true); }}
                    className={`flex flex-col gap-1 p-2.5 rounded-lg text-left transition-all border ${
                      isActive ? 'border-gc-accent/40 bg-gc-accent/5' : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <LocationTypeBadge type={tpl.locationType} size="sm" />
                      {tpl.isBuiltIn && <span className="text-[8px] text-gray-500">PRESET</span>}
                    </div>
                    <span className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-gray-400'}`}>{tpl.name}</span>
                    <span className="text-[10px] text-gray-500 font-mono">{tpl.pattern}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Variable config */}
          {selectedTemplate && extractedVars.length > 0 && (
            <div>
              <h3 className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-2">Variables</h3>
              <div className="flex flex-wrap gap-2">
                {extractedVars.map((v) => (
                  <div key={v} className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-500 font-mono">{`{${v}}`}</span>
                    {v === 'number' ? (
                      <div className="flex items-center gap-1">
                        <label className="text-[9px] text-gray-500">start:</label>
                        <input type="number" value={startNumber} onChange={(e) => setStartNumber(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-12 bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-gc-accent" />
                        <label className="text-[9px] text-gray-500">pad:</label>
                        <input type="number" value={numberPadding} onChange={(e) => setNumberPadding(Math.max(1, Math.min(4, parseInt(e.target.value) || 2)))}
                          className="w-9 bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-gc-accent" />
                      </div>
                    ) : (
                      <input type="text" value={variableOverrides[v] ?? selectedTemplate.variables[v] ?? ''}
                        onChange={(e) => setVariableOverrides({ ...variableOverrides, [v]: e.target.value })}
                        className="w-20 bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-gc-accent" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <NamingConflictBanner conflicts={conflicts} />

          {/* Preview table */}
          {previewNames.length > 0 && (
            <div>
              <h3 className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-2 flex items-center gap-2">
                Preview <span className="text-gray-500 bg-gray-800 px-1.5 rounded-full">{previewNames.length}</span>
              </h3>
              <div className="border border-gray-700 rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_24px_1fr] px-3 py-1.5 bg-gray-800/80 border-b border-gray-700">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wide">Current Name</span>
                  <span />
                  <span className="text-[9px] text-gray-500 uppercase tracking-wide">New Name</span>
                </div>
                {previewNames.map(({ switchId, name }) => {
                  const sw = allSwitches.find((s) => s.id === switchId);
                  if (!sw) return null;
                  const hasConflict = conflicts.some((c) => c.newSwitchId === switchId);
                  return (
                    <div key={switchId} className={`grid grid-cols-[1fr_24px_1fr] items-center px-3 py-1 border-b border-gray-700/30 ${hasConflict ? 'bg-red-500/5' : ''}`}>
                      <span className="text-xs text-gray-400 truncate">{sw.name}</span>
                      <ChevronRight size={12} className="text-gray-600" />
                      <span className={`text-xs font-semibold truncate ${hasConflict ? 'text-red-400' : 'text-gc-accent'}`}>{name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Apply button */}
          {previewNames.length > 0 && (
            <button
              onClick={handleApply}
              disabled={conflicts.length > 0}
              className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-bold tracking-wide transition-all ${
                conflicts.length > 0
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-gc-accent text-white hover:bg-gc-accent/80'
              }`}
            >
              <Zap size={14} />
              APPLY {previewNames.length} NAME{previewNames.length !== 1 ? 'S' : ''}
            </button>
          )}

          {/* Empty state */}
          {selectedSwitchIds.length === 0 && (
            <div className="text-center py-10">
              <ArrowUpDown size={24} className="text-gray-700 mx-auto mb-3" />
              <p className="text-xs text-gray-500">Select switches from the left panel, then pick a template</p>
            </div>
          )}
        </div>

        {/* RIGHT — Template editor (collapsible) */}
        {showEditor && (
          <div>
            <NamingTemplateEditor
              template={editingTemplate}
              onSave={(data) => {
                if (editingTemplate && !editingTemplate.isBuiltIn) {
                  updateTemplate(editingTemplate.id, data);
                } else {
                  const id = addTemplate(data);
                  setSelectedTemplate(id);
                }
                setEditingTemplate(null);
                setShowEditor(false);
              }}
              onDelete={editingTemplate && !editingTemplate.isBuiltIn ? () => {
                deleteTemplate(editingTemplate.id);
                setEditingTemplate(null);
                setShowEditor(false);
              } : undefined}
              onClose={() => { setEditingTemplate(null); setShowEditor(false); }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
