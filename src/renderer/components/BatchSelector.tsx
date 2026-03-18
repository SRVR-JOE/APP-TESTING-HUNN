import React, { useState, useMemo } from 'react';
import {
  Search,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  Filter,
  Minus,
} from 'lucide-react';
import type { DiscoveredSwitch, HealthStatus } from '@shared/types';

export interface BatchSelectorProps {
  switches: DiscoveredSwitch[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  groupBy?: 'model' | 'rack' | 'none';
}

const healthDotColor: Record<HealthStatus, string> = {
  healthy: 'bg-green-400',
  warning: 'bg-yellow-400',
  critical: 'bg-red-400',
  offline: 'bg-gray-500',
};

const modelBadgeColor: Record<string, string> = {
  'GC-30i': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'GC-16t': 'bg-green-500/20 text-green-400 border-green-500/30',
  'GC-10i': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'GC-14R': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'GC-12t': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

function getModelBadge(model: string): string {
  for (const [key, cls] of Object.entries(modelBadgeColor)) {
    if (model.includes(key)) return cls;
  }
  return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
}

export const BatchSelector: React.FC<BatchSelectorProps> = ({
  switches,
  selectedIds,
  onSelectionChange,
  groupBy = 'none',
}) => {
  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [filterModel, setFilterModel] = useState<string>('all');
  const [filterRack, setFilterRack] = useState<string>('all');
  const [filterHealth, setFilterHealth] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const models = useMemo(
    () => Array.from(new Set(switches.map((s) => s.model))).sort(),
    [switches]
  );
  const racks = useMemo(
    () =>
      Array.from(new Set(switches.map((s) => s.rackGroup).filter(Boolean) as string[])).sort(),
    [switches]
  );

  const filtered = useMemo(() => {
    return switches.filter((s) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !s.name.toLowerCase().includes(q) &&
          !s.ip.toLowerCase().includes(q) &&
          !s.model.toLowerCase().includes(q)
        )
          return false;
      }
      if (filterModel !== 'all' && s.model !== filterModel) return false;
      if (filterRack !== 'all' && s.rackGroup !== filterRack) return false;
      if (filterHealth !== 'all' && s.healthStatus !== filterHealth) return false;
      return true;
    });
  }, [switches, search, filterModel, filterRack, filterHealth]);

  const groups = useMemo(() => {
    if (groupBy === 'none') return { All: filtered };
    const map: Record<string, DiscoveredSwitch[]> = {};
    for (const sw of filtered) {
      const key = groupBy === 'model' ? sw.model : sw.rackGroup || 'Unassigned';
      if (!map[key]) map[key] = [];
      map[key].push(sw);
    }
    return map;
  }, [filtered, groupBy]);

  const toggleSwitch = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const selectAll = () => {
    const next = new Set(selectedIds);
    filtered.forEach((s) => next.add(s.id));
    onSelectionChange(next);
  };

  const deselectAll = () => {
    const next = new Set(selectedIds);
    filtered.forEach((s) => next.delete(s.id));
    onSelectionChange(next);
  };

  const toggleGroup = (groupKey: string) => {
    const next = new Set(collapsedGroups);
    if (next.has(groupKey)) next.delete(groupKey);
    else next.add(groupKey);
    setCollapsedGroups(next);
  };

  const toggleGroupSelection = (groupSwitches: DiscoveredSwitch[]) => {
    const ids = groupSwitches.map((s) => s.id);
    const allSelected = ids.every((id) => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allSelected) {
      ids.forEach((id) => next.delete(id));
    } else {
      ids.forEach((id) => next.add(id));
    }
    onSelectionChange(next);
  };

  const filteredSelectedCount = filtered.filter((s) => selectedIds.has(s.id)).length;

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search switches..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gc-accent"
        />
      </div>

      {/* Filter toggle */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="flex items-center gap-2 text-xs text-gray-400 hover:text-white mb-2 transition-colors"
      >
        <Filter className="w-3.5 h-3.5" />
        Filters
        <ChevronDown
          className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Filters */}
      {showFilters && (
        <div className="space-y-2 mb-3 p-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
          <select
            value={filterModel}
            onChange={(e) => setFilterModel(e.target.value)}
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 focus:outline-none focus:border-gc-accent"
          >
            <option value="all">All Models</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={filterRack}
            onChange={(e) => setFilterRack(e.target.value)}
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 focus:outline-none focus:border-gc-accent"
          >
            <option value="all">All Rack Groups</option>
            {racks.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={filterHealth}
            onChange={(e) => setFilterHealth(e.target.value)}
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 focus:outline-none focus:border-gc-accent"
          >
            <option value="all">All Health</option>
            <option value="healthy">Healthy</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
            <option value="offline">Offline</option>
          </select>
        </div>
      )}

      {/* Select All / Deselect All + count */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={selectAll}
            className="text-xs text-gc-accent hover:text-white transition-colors"
          >
            Select All
          </button>
          <span className="text-gray-600">|</span>
          <button
            onClick={deselectAll}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Deselect All
          </button>
        </div>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gc-accent/20 text-gc-accent">
          {filteredSelectedCount} of {filtered.length}
        </span>
      </div>

      {/* Group quick-select buttons */}
      {racks.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {racks.map((rack) => {
            const rackSwitches = switches.filter((s) => s.rackGroup === rack);
            const allSel = rackSwitches.every((s) => selectedIds.has(s.id));
            return (
              <button
                key={rack}
                onClick={() => toggleGroupSelection(rackSwitches)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  allSel
                    ? 'bg-gc-accent/20 border-gc-accent/40 text-gc-accent'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {rack}
              </button>
            );
          })}
          {models.map((model) => {
            const modelSwitches = switches.filter((s) => s.model === model);
            const allSel = modelSwitches.every((s) => selectedIds.has(s.id));
            return (
              <button
                key={model}
                onClick={() => toggleGroupSelection(modelSwitches)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  allSel
                    ? 'bg-gc-accent/20 border-gc-accent/40 text-gc-accent'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                All {model}
              </button>
            );
          })}
        </div>
      )}

      {/* Switch list */}
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {Object.entries(groups).map(([groupKey, groupSwitches]) => {
          const isCollapsed = collapsedGroups.has(groupKey);
          const groupSelected = groupSwitches.every((s) => selectedIds.has(s.id));
          const groupPartial =
            !groupSelected && groupSwitches.some((s) => selectedIds.has(s.id));

          return (
            <div key={groupKey}>
              {/* Group header */}
              {groupBy !== 'none' && (
                <div
                  className="flex items-center gap-2 py-1.5 px-2 bg-gray-800/50 rounded cursor-pointer hover:bg-gray-800 transition-colors mb-1"
                  onClick={() => toggleGroup(groupKey)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGroupSelection(groupSwitches);
                    }}
                    className="text-gray-400 hover:text-white"
                  >
                    {groupSelected ? (
                      <CheckSquare className="w-4 h-4 text-gc-accent" />
                    ) : groupPartial ? (
                      <Minus className="w-4 h-4 text-gc-accent/60" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                  )}
                  <span className="text-xs font-medium text-gray-300">{groupKey}</span>
                  <span className="text-xs text-gray-500 ml-auto">
                    {groupSwitches.length}
                  </span>
                </div>
              )}

              {/* Switch items */}
              {!isCollapsed &&
                groupSwitches.map((sw) => {
                  const isSelected = selectedIds.has(sw.id);
                  return (
                    <div
                      key={sw.id}
                      onClick={() => toggleSwitch(sw.id)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-gc-accent/10 border border-gc-accent/30'
                          : 'hover:bg-gray-800 border border-transparent'
                      }`}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-gc-accent flex-shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white font-medium truncate">
                            {sw.name}
                          </span>
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              healthDotColor[sw.healthStatus]
                            }`}
                          />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-xs text-gray-500">{sw.ip}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full border ${getModelBadge(
                              sw.model
                            )}`}
                          >
                            {sw.model}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BatchSelector;
