import React, { useState, useMemo, useCallback } from 'react';
import {
  Search,
  Download,
  X,
  ChevronDown,
  ChevronUp,
  Monitor,
  Loader2,
} from 'lucide-react';
import { useDiscoveredDevices, useElectronAPI } from '../hooks/useElectronAPI';

/** Infer the device type from the hook return value. */
type DiscoveredDevice = ReturnType<typeof useDiscoveredDevices>['devices'][number];

// ---------------------------------------------------------------------------
// Protocol styling
// ---------------------------------------------------------------------------

const PROTOCOL_STYLES: Record<
  string,
  { bg: string; text: string; dot: string }
> = {
  Dante: { bg: 'bg-red-500/15', text: 'text-red-400', dot: 'bg-red-500' },
  NDI: { bg: 'bg-green-500/15', text: 'text-green-400', dot: 'bg-green-500' },
  'Art-Net': { bg: 'bg-blue-500/15', text: 'text-blue-400', dot: 'bg-blue-500' },
  AES67: { bg: 'bg-purple-500/15', text: 'text-purple-400', dot: 'bg-purple-500' },
  unknown: { bg: 'bg-gray-500/15', text: 'text-gray-400', dot: 'bg-gray-500' },
};

function protocolStyle(protocol: string) {
  return PROTOCOL_STYLES[protocol] ?? PROTOCOL_STYLES.unknown;
}

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

type SortKey =
  | 'name'
  | 'ip'
  | 'mac'
  | 'manufacturer'
  | 'protocol'
  | 'connectedSwitch'
  | 'status'
  | 'lastSeen';

function compareDevices(
  a: DiscoveredDevice,
  b: DiscoveredDevice,
  key: SortKey,
  dir: 'asc' | 'desc',
): number {
  let cmp = 0;
  switch (key) {
    case 'name':
      cmp = a.name.localeCompare(b.name);
      break;
    case 'ip':
      cmp = a.ip.localeCompare(b.ip, undefined, { numeric: true });
      break;
    case 'mac':
      cmp = a.mac.localeCompare(b.mac);
      break;
    case 'manufacturer':
      cmp = a.manufacturer.localeCompare(b.manufacturer);
      break;
    case 'protocol':
      cmp = a.protocol.localeCompare(b.protocol);
      break;
    case 'connectedSwitch':
      cmp = (a.connectedSwitch ?? '').localeCompare(b.connectedSwitch ?? '');
      break;
    case 'status':
      cmp = a.status.localeCompare(b.status);
      break;
    case 'lastSeen':
      cmp =
        new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime();
      break;
  }
  return dir === 'asc' ? cmp : -cmp;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DiscoveredDevicesView: React.FC = () => {
  const api = useElectronAPI();
  const { devices, isLoading, refresh } = useDiscoveredDevices();

  // Search & filters
  const [search, setSearch] = useState('');
  const [protocolFilter, setProtocolFilter] = useState('');
  const [manufacturerFilter, setManufacturerFilter] = useState('');
  const [switchFilter, setSwitchFilter] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Detail panel
  const [selectedDevice, setSelectedDevice] = useState<DiscoveredDevice | null>(
    null,
  );

  // Derived option lists
  const protocols = useMemo(
    () => Array.from(new Set(devices.map((d) => d.protocol))),
    [devices],
  );
  const manufacturers = useMemo(
    () => Array.from(new Set(devices.map((d) => d.manufacturer))),
    [devices],
  );
  const connectedSwitches = useMemo(
    () =>
      Array.from(
        new Set(devices.map((d) => d.connectedSwitch).filter(Boolean)),
      ) as string[],
    [devices],
  );

  // Protocol stats
  const protocolCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    devices.forEach((d) => {
      counts[d.protocol] = (counts[d.protocol] ?? 0) + 1;
    });
    return counts;
  }, [devices]);

  // Filtered & sorted
  const filteredDevices = useMemo(() => {
    return devices
      .filter((d) => {
        if (protocolFilter && d.protocol !== protocolFilter) return false;
        if (manufacturerFilter && d.manufacturer !== manufacturerFilter)
          return false;
        if (switchFilter && d.connectedSwitch !== switchFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            d.name.toLowerCase().includes(q) ||
            d.ip.includes(q) ||
            d.mac.toLowerCase().includes(q) ||
            d.manufacturer.toLowerCase().includes(q) ||
            (d.hostname?.toLowerCase().includes(q) ?? false)
          );
        }
        return true;
      })
      .sort((a, b) => compareDevices(a, b, sortKey, sortDir));
  }, [
    devices,
    search,
    protocolFilter,
    manufacturerFilter,
    switchFilter,
    sortKey,
    sortDir,
  ]);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey],
  );

  const handleExport = useCallback(() => {
    api.exportCSV();
  }, [api, filteredDevices]);

  const SortIcon: React.FC<{ col: SortKey }> = ({ col }) => {
    if (sortKey !== col)
      return <ChevronDown className="w-3 h-3 text-gray-600" />;
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-blue-400" />
    ) : (
      <ChevronDown className="w-3 h-3 text-blue-400" />
    );
  };

  const ColumnHeader: React.FC<{ col: SortKey; children: React.ReactNode; className?: string }> = ({
    col,
    children,
    className = '',
  }) => (
    <th
      onClick={() => handleSort(col)}
      className={`px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 select-none ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <SortIcon col={col} />
      </span>
    </th>
  );

  // Dropdown helper
  const FilterDropdown: React.FC<{
    id: string;
    label: string;
    value: string;
    options: string[];
    onChange: (v: string) => void;
  }> = ({ id, label, value, options, onChange }) => (
    <div className="relative">
      <button
        onClick={() => setOpenDropdown(openDropdown === id ? null : id)}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border transition-colors ${
          value
            ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
            : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
        }`}
      >
        {label}
        {value && <span className="text-blue-400 font-medium">: {value}</span>}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {openDropdown === id && (
        <div className="absolute top-full left-0 mt-1 min-w-[140px] bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 py-1">
          <button
            onClick={() => {
              onChange('');
              setOpenDropdown(null);
            }}
            className="w-full text-left px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-700 hover:text-white"
          >
            All
          </button>
          {options.map((o) => (
            <button
              key={o}
              onClick={() => {
                onChange(o);
                setOpenDropdown(null);
              }}
              className={`w-full text-left px-3 py-1.5 text-sm ${
                value === o
                  ? 'bg-blue-600/20 text-blue-300'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* ---- Top bar ---- */}
      <div className="flex-shrink-0 p-4 space-y-3 border-b border-gray-700">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search devices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-gray-700 border border-gray-600 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <FilterDropdown
            id="protocol"
            label="Protocol"
            value={protocolFilter}
            options={protocols}
            onChange={setProtocolFilter}
          />
          <FilterDropdown
            id="manufacturer"
            label="Manufacturer"
            value={manufacturerFilter}
            options={manufacturers}
            onChange={setManufacturerFilter}
          />
          <FilterDropdown
            id="switch"
            label="Switch"
            value={switchFilter}
            options={connectedSwitches}
            onChange={setSwitchFilter}
          />

          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-400 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Monitor className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-sm text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* ---- Stats bar ---- */}
      <div className="flex-shrink-0 px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 flex items-center gap-4 text-xs text-gray-500 flex-wrap">
        <span>
          <span className="text-gray-300 font-medium">
            {filteredDevices.length}
          </span>{' '}
          device{filteredDevices.length !== 1 ? 's' : ''} found
        </span>
        {Object.entries(protocolCounts).map(([proto, count]) => {
          const style = protocolStyle(proto);
          return (
            <React.Fragment key={proto}>
              <span className="text-gray-700">|</span>
              <span className="flex items-center gap-1">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${style.dot}`} />
                <span>
                  {proto}:{' '}
                  <span className="text-gray-300 font-medium">{count}</span>
                </span>
              </span>
            </React.Fragment>
          );
        })}
      </div>

      {/* ---- Table ---- */}
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[900px]">
          <thead className="sticky top-0 bg-gray-900 z-10">
            <tr className="border-b border-gray-700">
              <th className="w-8 px-3 py-2" /> {/* status dot */}
              <ColumnHeader col="name">Device</ColumnHeader>
              <ColumnHeader col="ip">IP Address</ColumnHeader>
              <ColumnHeader col="mac">MAC Address</ColumnHeader>
              <ColumnHeader col="manufacturer">Manufacturer</ColumnHeader>
              <ColumnHeader col="protocol">Protocol</ColumnHeader>
              <ColumnHeader col="connectedSwitch">Connected To</ColumnHeader>
              <ColumnHeader col="lastSeen">Last Seen</ColumnHeader>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map((device) => {
              const pStyle = protocolStyle(device.protocol);
              const isSelected = selectedDevice?.id === device.id;
              return (
                <tr
                  key={device.id}
                  onClick={() =>
                    setSelectedDevice(isSelected ? null : device)
                  }
                  className={`border-b border-gray-800 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-600/10'
                      : 'hover:bg-gray-800/60'
                  }`}
                >
                  {/* Status dot */}
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        device.status === 'online'
                          ? 'bg-green-500'
                          : 'bg-gray-500'
                      }`}
                    />
                  </td>

                  {/* Name + hostname */}
                  <td className="px-3 py-2.5">
                    <div className="text-sm text-white font-medium">
                      {device.name}
                    </div>
                    {device.hostname && (
                      <div className="text-xs text-gray-500 font-mono">
                        {device.hostname}
                      </div>
                    )}
                  </td>

                  {/* IP */}
                  <td className="px-3 py-2.5 font-mono text-sm text-gray-300">
                    {device.ip}
                  </td>

                  {/* MAC */}
                  <td className="px-3 py-2.5 font-mono text-sm text-gray-400">
                    {device.mac}
                  </td>

                  {/* Manufacturer */}
                  <td className="px-3 py-2.5 text-sm text-gray-300">
                    {device.manufacturer}
                  </td>

                  {/* Protocol badge */}
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${pStyle.bg} ${pStyle.text}`}
                    >
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full ${pStyle.dot}`}
                      />
                      {device.protocol}
                    </span>
                  </td>

                  {/* Connected To */}
                  <td className="px-3 py-2.5 text-sm text-gray-400">
                    {device.connectedSwitch ? (
                      <span>
                        {device.connectedSwitch}
                        {device.connectedPort != null && (
                          <span className="text-gray-500 font-mono">
                            {' '}
                            :{device.connectedPort}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-600">--</span>
                    )}
                  </td>

                  {/* Last Seen */}
                  <td className="px-3 py-2.5 text-sm text-gray-500">
                    {relativeTime(device.lastSeen)}
                  </td>
                </tr>
              );
            })}

            {filteredDevices.length === 0 && (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <div className="text-gray-600 mb-2">
                    <Monitor className="w-10 h-10 mx-auto" />
                  </div>
                  <p className="text-sm text-gray-500">
                    No devices match your filters
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---- Detail panel ---- */}
      {selectedDevice && (
        <div className="flex-shrink-0 border-t border-gray-700 bg-gray-800 p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-white font-semibold text-base">
                {selectedDevice.name}
              </h3>
              {selectedDevice.hostname && (
                <p className="text-xs text-gray-500 font-mono">
                  {selectedDevice.hostname}
                </p>
              )}
            </div>
            <button
              onClick={() => setSelectedDevice(null)}
              className="text-gray-500 hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500 text-xs">IP Address</span>
              <p className="font-mono text-gray-300">{selectedDevice.ip}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs">MAC Address</span>
              <p className="font-mono text-gray-300">{selectedDevice.mac}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs">Manufacturer</span>
              <p className="text-gray-300">{selectedDevice.manufacturer}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs">Protocol</span>
              <p className="text-gray-300">{selectedDevice.protocol}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs">Status</span>
              <p className="text-gray-300 flex items-center gap-1.5">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    selectedDevice.status === 'online'
                      ? 'bg-green-500'
                      : 'bg-gray-500'
                  }`}
                />
                {selectedDevice.status === 'online' ? 'Online' : 'Offline'}
              </p>
            </div>
            <div>
              <span className="text-gray-500 text-xs">Connected To</span>
              <p className="text-gray-300">
                {selectedDevice.connectedSwitch ?? '--'}
                {selectedDevice.connectedPort != null &&
                  ` : Port ${selectedDevice.connectedPort}`}
              </p>
            </div>
            <div>
              <span className="text-gray-500 text-xs">Last Seen</span>
              <p className="text-gray-300">
                {relativeTime(selectedDevice.lastSeen)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiscoveredDevicesView;
