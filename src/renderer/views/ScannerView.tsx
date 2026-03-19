import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  RefreshCw,
  Wifi,
  WifiOff,
  ChevronDown,
  Loader2,
  Server,
  Plus,
  X,
} from 'lucide-react';
import type { SwitchInfo, FilterDefinition, SortOption } from '../types';
import { useDiscovery, useElectronAPI } from '../hooks/useElectronAPI';
import { SwitchCard } from '../components/SwitchCard';
import { SearchFilter } from '../components/SearchFilter';
import { EmptyState } from '../components/EmptyState';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** GigaCore default subnets that are always available as options. */
const GIGACORE_DEFAULT_SUBNETS = ['2.0.0.0/24', '192.168.0.0/24'];

const CUSTOM_SUBNETS_STORAGE_KEY = 'luminex-custom-subnets';

// ---------------------------------------------------------------------------
// Filter & sort configuration
// ---------------------------------------------------------------------------

const MODEL_OPTIONS = [
  { value: 'GC-30i', label: 'GC-30i' },
  { value: 'GC-16t', label: 'GC-16t' },
  { value: 'GC-10i', label: 'GC-10i' },
  { value: 'GC-14R', label: 'GC-14R' },
  { value: 'GC-12t', label: 'GC-12t' },
];

const STATUS_OPTIONS = [
  { value: 'healthy', label: 'Online' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
  { value: 'offline', label: 'Offline' },
];

const FILTERS: FilterDefinition[] = [
  { key: 'model', label: 'Model', options: MODEL_OPTIONS },
  { key: 'status', label: 'Status', options: STATUS_OPTIONS },
];

const SORT_OPTIONS: SortOption[] = [
  { value: 'name', label: 'Name' },
  { value: 'ip', label: 'IP Address' },
  { value: 'model', label: 'Model' },
  { value: 'status', label: 'Health' },
  { value: 'lastSeen', label: 'Last Seen' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchesSearch(sw: SwitchInfo, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    sw.name.toLowerCase().includes(q) ||
    sw.ip.includes(q) ||
    sw.model.toLowerCase().includes(q) ||
    (sw.rackGroup?.toLowerCase().includes(q) ?? false)
  );
}

function matchesFilters(
  sw: SwitchInfo,
  filters: Record<string, string>,
): boolean {
  for (const [key, value] of Object.entries(filters)) {
    if (!value) continue;
    if (key === 'model' && !sw.model.includes(value)) return false;
    if (key === 'status' && sw.status !== value) return false;
    if (key === 'rackGroup' && sw.rackGroup !== value) return false;
  }
  return true;
}

const statusOrder: Record<string, number> = {
  critical: 0,
  warning: 1,
  healthy: 2,
  offline: 3,
};

function compareSwitches(
  a: SwitchInfo,
  b: SwitchInfo,
  sort: string,
  dir: 'asc' | 'desc',
): number {
  let cmp = 0;
  switch (sort) {
    case 'name':
      cmp = a.name.localeCompare(b.name);
      break;
    case 'ip':
      cmp = a.ip.localeCompare(b.ip, undefined, { numeric: true });
      break;
    case 'model':
      cmp = a.model.localeCompare(b.model);
      break;
    case 'status':
      cmp = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
      break;
    case 'lastSeen':
      cmp =
        new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime();
      break;
    default:
      break;
  }
  return dir === 'asc' ? cmp : -cmp;
}

/** Validate a CIDR string (e.g. 10.0.0.0/24). */
function isValidCidr(val: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(val.trim());
}

/** Load custom subnets from localStorage. */
function loadCustomSubnets(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_SUBNETS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === 'string');
    }
  } catch {
    // ignore
  }
  return [];
}

/** Save custom subnets to localStorage. */
function saveCustomSubnets(subnets: string[]): void {
  try {
    localStorage.setItem(CUSTOM_SUBNETS_STORAGE_KEY, JSON.stringify(subnets));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ScannerView: React.FC = () => {
  const api = useElectronAPI();
  const {
    switches,
    isScanning,
    scanProgress,
    scanScanned,
    scanTotal,
    lastScanTime,
    scan,
    startPolling,
    stopPolling,
  } = useDiscovery();

  // Subnet selector
  const [detectedSubnets, setDetectedSubnets] = useState<string[]>([]);
  const [customSubnets, setCustomSubnets] = useState<string[]>(loadCustomSubnets);
  const [selectedSubnet, setSelectedSubnet] = useState('2.0.0.0/24');
  const [subnetDropdownOpen, setSubnetDropdownOpen] = useState(false);

  // Custom subnet input
  const [customSubnetInput, setCustomSubnetInput] = useState('');
  const [customSubnetError, setCustomSubnetError] = useState('');

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Search / filter / sort
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Selected switch
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Refreshing switch details
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // Build the merged list of all subnets (defaults + detected + custom), deduplicated
  const allSubnets = useMemo(() => {
    const set = new Set<string>([
      ...GIGACORE_DEFAULT_SUBNETS,
      ...detectedSubnets,
      ...customSubnets,
    ]);
    return Array.from(set);
  }, [detectedSubnets, customSubnets]);

  // Detect subnets on mount
  useEffect(() => {
    api.getLocalSubnets().then((subs: string[]) => {
      if (subs.length > 0) {
        setDetectedSubnets(subs);
      }
    });
  }, [api]);

  // Auto-refresh toggle
  useEffect(() => {
    if (autoRefresh) {
      startPolling(selectedSubnet, 30000);
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [autoRefresh, selectedSubnet, startPolling, stopPolling]);

  // Derive rack groups from switches for filter
  const rackGroups = useMemo(() => {
    const groups = new Set(switches.map((s) => s.rackGroup).filter(Boolean));
    return Array.from(groups).map((g) => ({ value: g!, label: g! }));
  }, [switches]);

  const allFilters: FilterDefinition[] = useMemo(
    () => [
      ...FILTERS,
      ...(rackGroups.length > 0
        ? [{ key: 'rackGroup', label: 'Rack Group', options: rackGroups }]
        : []),
    ],
    [rackGroups],
  );

  // Filtered & sorted switches
  const filteredSwitches = useMemo(() => {
    return switches
      .filter((sw) => matchesSearch(sw, searchQuery))
      .filter((sw) => matchesFilters(sw, activeFilters))
      .sort((a, b) => compareSwitches(a, b, sortField, sortDir));
  }, [switches, searchQuery, activeFilters, sortField, sortDir]);

  const totalDevices = useMemo(
    () => switches.reduce((acc: number, sw: SwitchInfo) => acc + sw.ports.filter((p: import('../types').PortInfo) => p.operStatus === 'up').length, 0),
    [switches],
  );

  const handleScan = useCallback(() => {
    scan(selectedSubnet);
  }, [scan, selectedSubnet]);

  const handlePing = useCallback(
    async (ip: string) => {
      const result = await api.pingSwitch(ip);
      console.log(`Ping ${ip}: ${result.alive ? `OK (${result.latency}ms)` : 'FAILED'}`);
    },
    [api],
  );

  const handleOpenWebUI = useCallback(
    (ip: string) => {
      api.openWebUI(ip);
    },
    [api],
  );

  const handleRefreshDetails = useCallback(
    async (switchId: string) => {
      setRefreshingId(switchId);
      try {
        const details = await api.getSwitchDetails(switchId);
        if (details) {
          console.log(`[ScannerView] Refreshed details for ${switchId}:`, details);
          // Details fetched successfully -- in a full implementation this would
          // update the switch in state with the fresh port/group data.
        }
      } catch (err) {
        console.error(`[ScannerView] Failed to refresh details for ${switchId}:`, err);
      } finally {
        setRefreshingId(null);
      }
    },
    [api],
  );

  const handleAddCustomSubnet = useCallback(() => {
    const trimmed = customSubnetInput.trim();
    if (!trimmed) {
      setCustomSubnetError('Enter a CIDR range');
      return;
    }
    if (!isValidCidr(trimmed)) {
      setCustomSubnetError('Invalid CIDR format (e.g. 10.0.0.0/24)');
      return;
    }
    if (allSubnets.includes(trimmed)) {
      setCustomSubnetError('Subnet already in the list');
      return;
    }
    const updated = [...customSubnets, trimmed];
    setCustomSubnets(updated);
    saveCustomSubnets(updated);
    setCustomSubnetInput('');
    setCustomSubnetError('');
    setSelectedSubnet(trimmed);
  }, [customSubnetInput, customSubnets, allSubnets]);

  const handleRemoveCustomSubnet = useCallback(
    (subnet: string) => {
      const updated = customSubnets.filter((s) => s !== subnet);
      setCustomSubnets(updated);
      saveCustomSubnets(updated);
      // If the removed subnet was selected, switch to the first available
      if (selectedSubnet === subnet) {
        const remaining = allSubnets.filter((s) => s !== subnet);
        setSelectedSubnet(remaining[0] ?? '2.0.0.0/24');
      }
    },
    [customSubnets, selectedSubnet, allSubnets],
  );

  const formatTime = (d: Date | null) => {
    if (!d) return '--:--:--';
    return d.toLocaleTimeString();
  };

  return (
    <div className="flex flex-col h-full">
      {/* ---- Top bar ---- */}
      <div className="flex-shrink-0 p-4 space-y-3 border-b border-gray-700">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Subnet selector */}
          <div className="relative">
            <button
              onClick={() => setSubnetDropdownOpen(!subnetDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-sm text-white hover:border-gray-500 transition-colors font-mono"
            >
              {selectedSubnet}
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
            {subnetDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 min-w-[260px] bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 py-1">
                {/* GigaCore defaults & detected subnets */}
                {allSubnets.map((s) => {
                  const isCustom = customSubnets.includes(s);
                  const isDefault = GIGACORE_DEFAULT_SUBNETS.includes(s);
                  return (
                    <div key={s} className="flex items-center group">
                      <button
                        onClick={() => {
                          setSelectedSubnet(s);
                          setSubnetDropdownOpen(false);
                        }}
                        className={`flex-1 text-left px-3 py-1.5 text-sm font-mono transition-colors ${
                          s === selectedSubnet
                            ? 'bg-blue-600/20 text-blue-300'
                            : 'text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {s}
                        {isDefault && (
                          <span className="ml-2 text-[10px] text-gray-500 font-sans">(GigaCore)</span>
                        )}
                        {isCustom && !isDefault && (
                          <span className="ml-2 text-[10px] text-gray-500 font-sans">(custom)</span>
                        )}
                      </button>
                      {isCustom && !isDefault && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveCustomSubnet(s);
                          }}
                          className="px-2 py-1.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove custom subnet"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Divider + custom subnet input */}
                <div className="border-t border-gray-700 mt-1 pt-1 px-2 pb-1">
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={customSubnetInput}
                      onChange={(e) => {
                        setCustomSubnetInput(e.target.value);
                        setCustomSubnetError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomSubnet();
                        }
                      }}
                      placeholder="10.0.0.0/24"
                      className="flex-1 px-2 py-1 text-sm font-mono bg-gray-900 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 min-w-0"
                    />
                    <button
                      onClick={handleAddCustomSubnet}
                      className="p-1 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                      title="Add custom subnet"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {customSubnetError && (
                    <p className="text-xs text-red-400 mt-1">{customSubnetError}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Scan button */}
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
          >
            {isScanning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wifi className="w-4 h-4" />
            )}
            {isScanning ? 'Scanning...' : 'Scan'}
          </button>

          {/* Auto-refresh toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div className="relative">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-9 h-5 rounded-full transition-colors ${
                  autoRefresh ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    autoRefresh ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>
            <span className="text-sm text-gray-400 flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" />
              Auto (30s)
            </span>
          </label>

          {/* Switch count badge */}
          {switches.length > 0 && (
            <span className="ml-auto px-2.5 py-1 text-xs font-medium bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded-full">
              {switches.length} switch{switches.length !== 1 ? 'es' : ''}
            </span>
          )}
        </div>

        {/* Progress bar during scan */}
        {isScanning && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>
                {scanTotal > 0
                  ? `Scanning ${scanScanned} of ${scanTotal} hosts...`
                  : 'Starting scan...'}
              </span>
              <span className="font-mono">{scanProgress}%</span>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">
              Subnet: <span className="font-mono text-gray-400">{selectedSubnet}</span>
            </p>
          </div>
        )}

        {/* Search / filter / sort */}
        <SearchFilter
          onSearch={setSearchQuery}
          filters={allFilters}
          sortOptions={SORT_OPTIONS}
          onFilterChange={setActiveFilters}
          onSortChange={(s, d) => {
            setSortField(s);
            setSortDir(d);
          }}
        />
      </div>

      {/* ---- Stats bar ---- */}
      {switches.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex items-center gap-4 text-xs text-gray-500">
          <span>
            <span className="text-gray-300 font-medium">
              {filteredSwitches.length}
            </span>{' '}
            switch{filteredSwitches.length !== 1 ? 'es' : ''} found
          </span>
          <span className="text-gray-700">|</span>
          <span>
            <span className="text-gray-300 font-medium">{totalDevices}</span>{' '}
            connected ports
          </span>
          <span className="text-gray-700">|</span>
          <span>
            Last scan:{' '}
            <span className="font-mono text-gray-400">
              {formatTime(lastScanTime)}
            </span>
          </span>
        </div>
      )}

      {/* ---- Card grid / empty state ---- */}
      <div className="flex-1 overflow-y-auto p-4">
        {switches.length === 0 && !isScanning ? (
          <EmptyState
            icon={<WifiOff className="w-16 h-16" />}
            title="No GigaCore switches discovered"
            description="Select your subnet and click Scan to discover GigaCore switches on the network. Switches will appear here as cards once detected."
            action={{ label: 'Scan Network', onClick: handleScan }}
          />
        ) : filteredSwitches.length === 0 && switches.length > 0 ? (
          <EmptyState
            icon={<Server className="w-12 h-12" />}
            title="No switches match your filters"
            description="Try adjusting your search query or clearing the active filters."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredSwitches.map((sw) => (
              <SwitchCard
                key={sw.id}
                switchInfo={sw}
                selected={selectedId === sw.id}
                onSelect={setSelectedId}
                onPing={handlePing}
                onOpenWebUI={handleOpenWebUI}
                onRefreshDetails={handleRefreshDetails}
                isRefreshing={refreshingId === sw.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScannerView;
