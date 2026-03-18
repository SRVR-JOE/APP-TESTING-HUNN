import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  RefreshCw,
  Wifi,
  WifiOff,
  ChevronDown,
  Loader2,
  Server,
} from 'lucide-react';
import type { SwitchInfo, FilterDefinition, SortOption } from '../types';
import { useDiscovery, useElectronAPI } from '../hooks/useElectronAPI';
import { SwitchCard } from '../components/SwitchCard';
import { SearchFilter } from '../components/SearchFilter';
import { EmptyState } from '../components/EmptyState';

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ScannerView: React.FC = () => {
  const api = useElectronAPI();
  const {
    switches,
    isScanning,
    scanProgress,
    lastScanTime,
    scan,
    startPolling,
    stopPolling,
  } = useDiscovery();

  // Subnet selector
  const [subnets, setSubnets] = useState<string[]>(['192.168.1.0/24']);
  const [selectedSubnet, setSelectedSubnet] = useState('192.168.1.0/24');
  const [subnetDropdownOpen, setSubnetDropdownOpen] = useState(false);

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Search / filter / sort
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Selected switch
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Detect subnets on mount
  useEffect(() => {
    api.getLocalSubnets().then((subs: string[]) => {
      if (subs.length > 0) {
        setSubnets(subs);
        setSelectedSubnet(subs[0]);
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
      // In a real app, show a toast notification
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
              <div className="absolute top-full left-0 mt-1 min-w-[180px] bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 py-1">
                {subnets.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSelectedSubnet(s);
                      setSubnetDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-sm font-mono transition-colors ${
                      s === selectedSubnet
                        ? 'bg-blue-600/20 text-blue-300'
                        : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {s}
                  </button>
                ))}
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
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${scanProgress}%` }}
            />
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScannerView;
