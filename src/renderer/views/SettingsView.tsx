import React, { useState, useCallback } from 'react';
import {
  Settings,
  Network,
  Timer,
  Database,
  Monitor,
  Info,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
  HardDrive,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface NetworkSettings {
  scanSubnets: string[];
  scanTimeout: number;
  snmpReadCommunity: string;
  snmpWriteCommunity: string;
  apiUsername: string;
  apiPassword: string;
}

interface PollingSettings {
  discoveryInterval: number;
  portStatsInterval: number;
  healthCheckInterval: number;
  autoScanOnLaunch: boolean;
}

interface RetentionSettings {
  eventLogDays: number;
  portStatsDays: number;
  dbSizeMb: number;
}

interface DisplaySettings {
  defaultView: 'scanner' | 'rack-map' | 'topology';
  defaultOverlay: 'none' | 'vlan' | 'poe' | 'traffic';
  temperatureUnit: 'C' | 'F';
}

type SettingsSection = 'network' | 'polling' | 'retention' | 'display' | 'about';

const SECTION_ITEMS: { key: SettingsSection; label: string; icon: React.ReactNode }[] = [
  { key: 'network', label: 'Network', icon: <Network size={16} /> },
  { key: 'polling', label: 'Polling', icon: <Timer size={16} /> },
  { key: 'retention', label: 'Data Retention', icon: <Database size={16} /> },
  { key: 'display', label: 'Display', icon: <Monitor size={16} /> },
  { key: 'about', label: 'About', icon: <Info size={16} /> },
];

// ─── Toggle ─────────────────────────────────────────────────────────────────

function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      className="flex items-center gap-2"
      onClick={() => onChange(!value)}
    >
      <div
        className={`w-9 h-5 rounded-full transition-colors relative ${
          value ? 'bg-gc-accent' : 'bg-gray-700'
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            value ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </div>
      {label && <span className="text-sm">{label}</span>}
    </button>
  );
}

// ─── Field wrapper ──────────────────────────────────────────────────────────

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-gray-800 last:border-0">
      <div className="flex-1 min-w-0 pr-4">
        <div className="text-sm font-medium">{label}</div>
        {description && (
          <div className="text-xs text-gray-500 mt-0.5">{description}</div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ─── Section Card ───────────────────────────────────────────────────────────

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-gc-accent">{icon}</span>
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function SettingsView() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('network');

  // ─── Network settings state ─────────────────────────────────────────
  const [network, setNetwork] = useState<NetworkSettings>({
    scanSubnets: ['192.168.1.0/24', '10.0.0.0/24', '172.16.0.0/24'],
    scanTimeout: 5000,
    snmpReadCommunity: 'public',
    snmpWriteCommunity: 'private',
    apiUsername: 'admin',
    apiPassword: 'admin',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showSnmpWrite, setShowSnmpWrite] = useState(false);
  const [newSubnet, setNewSubnet] = useState('');

  // ─── Polling settings state ─────────────────────────────────────────
  const [polling, setPolling] = useState<PollingSettings>({
    discoveryInterval: 30,
    portStatsInterval: 60,
    healthCheckInterval: 300,
    autoScanOnLaunch: true,
  });

  // ─── Retention settings state ───────────────────────────────────────
  const [retention, setRetention] = useState<RetentionSettings>({
    eventLogDays: 90,
    portStatsDays: 30,
    dbSizeMb: 142.7,
  });
  const [purgeConfirm, setPurgeConfirm] = useState<'events' | 'stats' | null>(null);

  // ─── Display settings state ─────────────────────────────────────────
  const [display, setDisplay] = useState<DisplaySettings>({
    defaultView: 'scanner',
    defaultOverlay: 'vlan',
    temperatureUnit: 'C',
  });

  // ─── Handlers ───────────────────────────────────────────────────────

  const addSubnet = useCallback(() => {
    const trimmed = newSubnet.trim();
    if (!trimmed) return;
    if (network.scanSubnets.includes(trimmed)) return;
    setNetwork((prev) => ({
      ...prev,
      scanSubnets: [...prev.scanSubnets, trimmed],
    }));
    setNewSubnet('');
  }, [newSubnet, network.scanSubnets]);

  const removeSubnet = useCallback((subnet: string) => {
    setNetwork((prev) => ({
      ...prev,
      scanSubnets: prev.scanSubnets.filter((s) => s !== subnet),
    }));
  }, []);

  const handlePurge = useCallback((type: 'events' | 'stats') => {
    // In real app, would call IPC to purge database
    setRetention((prev) => ({
      ...prev,
      dbSizeMb: Math.max(1, prev.dbSizeMb - (type === 'events' ? 80 : 45)),
    }));
    setPurgeConfirm(null);
  }, []);

  return (
    <div className="flex h-full -m-6">
      {/* ─── Sidebar Nav ─────────────────────────────────────────────── */}
      <div className="w-56 shrink-0 border-r border-gray-800 bg-gray-900/80 py-5 px-3">
        <div className="flex items-center gap-2 px-3 mb-4">
          <Settings size={20} className="text-gc-accent" />
          <h2 className="text-lg font-semibold">Settings</h2>
        </div>
        <nav className="space-y-0.5">
          {SECTION_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                activeSection === item.key
                  ? 'bg-gc-accent/10 text-gc-accent font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
              onClick={() => setActiveSection(item.key)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ─── Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {/* ── Network Settings ─────────────────────────────────────── */}
        {activeSection === 'network' && (
          <>
            <SectionCard title="Default Scan Subnets" icon={<Network size={18} />}>
              <div className="space-y-2 mb-3">
                {network.scanSubnets.map((subnet) => (
                  <div
                    key={subnet}
                    className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2"
                  >
                    <span className="text-sm font-mono">{subnet}</span>
                    <button
                      className="text-gray-500 hover:text-red-400"
                      onClick={() => removeSubnet(subnet)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm font-mono outline-none focus:border-gc-accent"
                  placeholder="e.g. 10.10.0.0/24"
                  value={newSubnet}
                  onChange={(e) => setNewSubnet(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSubnet()}
                />
                <button
                  className="px-3 py-1.5 text-sm rounded-lg bg-gc-accent text-gray-900 font-medium hover:bg-gc-accent/90 disabled:opacity-40"
                  disabled={!newSubnet.trim()}
                  onClick={addSubnet}
                >
                  <Plus size={14} className="inline mr-1" />
                  Add
                </button>
              </div>
            </SectionCard>

            <SectionCard title="Scan & SNMP" icon={<Network size={18} />}>
              <SettingRow
                label="Scan Timeout"
                description="How long to wait for a response from each device"
              >
                <div className="flex items-center gap-2">
                  <input
                    className="w-24 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-right font-mono outline-none focus:border-gc-accent"
                    type="number"
                    min={500}
                    max={30000}
                    step={500}
                    value={network.scanTimeout}
                    onChange={(e) =>
                      setNetwork((prev) => ({
                        ...prev,
                        scanTimeout: parseInt(e.target.value) || 5000,
                      }))
                    }
                  />
                  <span className="text-xs text-gray-500">ms</span>
                </div>
              </SettingRow>

              <SettingRow
                label="SNMP Read Community"
                description="Community string for read operations"
              >
                <input
                  className="w-40 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm font-mono outline-none focus:border-gc-accent"
                  value={network.snmpReadCommunity}
                  onChange={(e) =>
                    setNetwork((prev) => ({
                      ...prev,
                      snmpReadCommunity: e.target.value,
                    }))
                  }
                />
              </SettingRow>

              <SettingRow
                label="SNMP Write Community"
                description="Community string for write operations"
              >
                <div className="flex items-center gap-1.5">
                  <input
                    className="w-40 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm font-mono outline-none focus:border-gc-accent"
                    type={showSnmpWrite ? 'text' : 'password'}
                    value={network.snmpWriteCommunity}
                    onChange={(e) =>
                      setNetwork((prev) => ({
                        ...prev,
                        snmpWriteCommunity: e.target.value,
                      }))
                    }
                  />
                  <button
                    className="text-gray-500 hover:text-white"
                    onClick={() => setShowSnmpWrite(!showSnmpWrite)}
                  >
                    {showSnmpWrite ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </SettingRow>
            </SectionCard>

            <SectionCard title="API Credentials" icon={<Network size={18} />}>
              <SettingRow
                label="Default Username"
                description="Default username for switch HTTP API"
              >
                <input
                  className="w-40 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm outline-none focus:border-gc-accent"
                  value={network.apiUsername}
                  onChange={(e) =>
                    setNetwork((prev) => ({ ...prev, apiUsername: e.target.value }))
                  }
                />
              </SettingRow>

              <SettingRow
                label="Default Password"
                description="Default password for switch HTTP API"
              >
                <div className="flex items-center gap-1.5">
                  <input
                    className="w-40 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm outline-none focus:border-gc-accent"
                    type={showPassword ? 'text' : 'password'}
                    value={network.apiPassword}
                    onChange={(e) =>
                      setNetwork((prev) => ({ ...prev, apiPassword: e.target.value }))
                    }
                  />
                  <button
                    className="text-gray-500 hover:text-white"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </SettingRow>
            </SectionCard>
          </>
        )}

        {/* ── Polling Settings ─────────────────────────────────────── */}
        {activeSection === 'polling' && (
          <SectionCard title="Polling Intervals" icon={<Timer size={18} />}>
            <SettingRow
              label="Discovery Poll Interval"
              description="How often to scan the network for new switches"
            >
              <div className="flex items-center gap-2">
                <input
                  className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-right font-mono outline-none focus:border-gc-accent"
                  type="number"
                  min={5}
                  max={300}
                  value={polling.discoveryInterval}
                  onChange={(e) =>
                    setPolling((prev) => ({
                      ...prev,
                      discoveryInterval: parseInt(e.target.value) || 30,
                    }))
                  }
                />
                <span className="text-xs text-gray-500">seconds</span>
              </div>
            </SettingRow>

            <SettingRow
              label="Port Stats Collection Interval"
              description="How often to collect port counters and traffic data"
            >
              <div className="flex items-center gap-2">
                <input
                  className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-right font-mono outline-none focus:border-gc-accent"
                  type="number"
                  min={10}
                  max={600}
                  value={polling.portStatsInterval}
                  onChange={(e) =>
                    setPolling((prev) => ({
                      ...prev,
                      portStatsInterval: parseInt(e.target.value) || 60,
                    }))
                  }
                />
                <span className="text-xs text-gray-500">seconds</span>
              </div>
            </SettingRow>

            <SettingRow
              label="Health Check Interval"
              description="How often to run health diagnostics on each switch"
            >
              <div className="flex items-center gap-2">
                <input
                  className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-right font-mono outline-none focus:border-gc-accent"
                  type="number"
                  min={60}
                  max={3600}
                  value={polling.healthCheckInterval}
                  onChange={(e) =>
                    setPolling((prev) => ({
                      ...prev,
                      healthCheckInterval: parseInt(e.target.value) || 300,
                    }))
                  }
                />
                <span className="text-xs text-gray-500">seconds</span>
              </div>
            </SettingRow>

            <SettingRow
              label="Auto-scan on Launch"
              description="Automatically start network scanning when the app opens"
            >
              <Toggle
                value={polling.autoScanOnLaunch}
                onChange={(v) =>
                  setPolling((prev) => ({ ...prev, autoScanOnLaunch: v }))
                }
              />
            </SettingRow>
          </SectionCard>
        )}

        {/* ── Data Retention ───────────────────────────────────────── */}
        {activeSection === 'retention' && (
          <>
            <SectionCard title="Data Retention" icon={<Database size={18} />}>
              <SettingRow
                label="Event Log Retention"
                description="How long to keep event log entries"
              >
                <div className="flex items-center gap-2">
                  <input
                    className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-right font-mono outline-none focus:border-gc-accent"
                    type="number"
                    min={1}
                    max={365}
                    value={retention.eventLogDays}
                    onChange={(e) =>
                      setRetention((prev) => ({
                        ...prev,
                        eventLogDays: parseInt(e.target.value) || 90,
                      }))
                    }
                  />
                  <span className="text-xs text-gray-500">days</span>
                </div>
              </SettingRow>

              <SettingRow
                label="Port Stats Retention"
                description="How long to keep port traffic statistics"
              >
                <div className="flex items-center gap-2">
                  <input
                    className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-right font-mono outline-none focus:border-gc-accent"
                    type="number"
                    min={1}
                    max={365}
                    value={retention.portStatsDays}
                    onChange={(e) =>
                      setRetention((prev) => ({
                        ...prev,
                        portStatsDays: parseInt(e.target.value) || 30,
                      }))
                    }
                  />
                  <span className="text-xs text-gray-500">days</span>
                </div>
              </SettingRow>
            </SectionCard>

            <SectionCard title="Database" icon={<HardDrive size={18} />}>
              <SettingRow label="Database Size" description="Current size of the local database">
                <span className="text-sm font-mono text-gc-accent">
                  {retention.dbSizeMb.toFixed(1)} MB
                </span>
              </SettingRow>

              <div className="flex gap-3 mt-4">
                <div className="flex-1">
                  <button
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-700 text-gray-300 hover:border-yellow-600 hover:text-yellow-400 transition"
                    onClick={() => setPurgeConfirm('events')}
                  >
                    <Trash2 size={14} className="inline mr-1.5" />
                    Purge Event Logs
                  </button>
                </div>
                <div className="flex-1">
                  <button
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-700 text-gray-300 hover:border-yellow-600 hover:text-yellow-400 transition"
                    onClick={() => setPurgeConfirm('stats')}
                  >
                    <Trash2 size={14} className="inline mr-1.5" />
                    Purge Port Stats
                  </button>
                </div>
              </div>

              {/* Purge confirmation */}
              {purgeConfirm && (
                <div className="mt-3 bg-yellow-900/20 border border-yellow-800/30 rounded-lg px-4 py-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-yellow-300">
                        Are you sure you want to purge all{' '}
                        {purgeConfirm === 'events' ? 'event logs' : 'port statistics'}?
                        This cannot be undone.
                      </p>
                      <div className="flex gap-2 mt-2">
                        <button
                          className="px-3 py-1 text-xs rounded bg-yellow-600 text-white hover:bg-yellow-500"
                          onClick={() => handlePurge(purgeConfirm)}
                        >
                          Purge Now
                        </button>
                        <button
                          className="px-3 py-1 text-xs rounded border border-gray-600 text-gray-300 hover:border-gray-500"
                          onClick={() => setPurgeConfirm(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </SectionCard>
          </>
        )}

        {/* ── Display Settings ─────────────────────────────────────── */}
        {activeSection === 'display' && (
          <SectionCard title="Display Preferences" icon={<Monitor size={18} />}>
            <SettingRow
              label="Default View on Launch"
              description="Which view to show when the app opens"
            >
              <select
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm outline-none focus:border-gc-accent"
                value={display.defaultView}
                onChange={(e) =>
                  setDisplay((prev) => ({
                    ...prev,
                    defaultView: e.target.value as DisplaySettings['defaultView'],
                  }))
                }
              >
                <option value="scanner">Scanner</option>
                <option value="rack-map">Rack Map</option>
                <option value="topology">Topology</option>
              </select>
            </SettingRow>

            <SettingRow
              label="Default Rack Map Overlay"
              description="Default overlay mode for the rack map view"
            >
              <select
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm outline-none focus:border-gc-accent"
                value={display.defaultOverlay}
                onChange={(e) =>
                  setDisplay((prev) => ({
                    ...prev,
                    defaultOverlay: e.target.value as DisplaySettings['defaultOverlay'],
                  }))
                }
              >
                <option value="none">None</option>
                <option value="vlan">VLAN Colors</option>
                <option value="poe">PoE Status</option>
                <option value="traffic">Traffic Load</option>
              </select>
            </SettingRow>

            <SettingRow
              label="Temperature Unit"
              description="Display switch temperatures in Celsius or Fahrenheit"
            >
              <div className="flex rounded-lg border border-gray-700 overflow-hidden">
                <button
                  className={`px-3 py-1 text-sm transition ${
                    display.temperatureUnit === 'C'
                      ? 'bg-gc-accent text-gray-900 font-medium'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  onClick={() =>
                    setDisplay((prev) => ({ ...prev, temperatureUnit: 'C' }))
                  }
                >
                  °C
                </button>
                <button
                  className={`px-3 py-1 text-sm transition ${
                    display.temperatureUnit === 'F'
                      ? 'bg-gc-accent text-gray-900 font-medium'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  onClick={() =>
                    setDisplay((prev) => ({ ...prev, temperatureUnit: 'F' }))
                  }
                >
                  °F
                </button>
              </div>
            </SettingRow>
          </SectionCard>
        )}

        {/* ── About ────────────────────────────────────────────────── */}
        {activeSection === 'about' && (
          <>
            <SectionCard title="About GigaCore Command" icon={<Info size={18} />}>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-gc-accent/10 flex items-center justify-center">
                  <Settings size={28} className="text-gc-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">GigaCore Command</h3>
                  <p className="text-sm text-gray-400">
                    Luminex GigaCore switch management application
                  </p>
                </div>
              </div>

              <SettingRow label="App Version">
                <span className="text-sm font-mono">0.1.0</span>
              </SettingRow>
              <SettingRow label="Electron Version">
                <span className="text-sm font-mono">28.1.0</span>
              </SettingRow>
              <SettingRow label="Chrome Version">
                <span className="text-sm font-mono">120.0.6099.109</span>
              </SettingRow>
              <SettingRow label="Node.js Version">
                <span className="text-sm font-mono">18.18.2</span>
              </SettingRow>
              <SettingRow label="Database Path">
                <span className="text-xs font-mono text-gray-400 break-all">
                  ~/Library/Application Support/gigacore-command/data.db
                </span>
              </SettingRow>
            </SectionCard>

            <SectionCard title="Updates & Links" icon={<RefreshCw size={18} />}>
              <div className="space-y-3">
                <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg bg-gc-accent text-gray-900 font-medium hover:bg-gc-accent/90 transition">
                  <RefreshCw size={14} />
                  Check for Updates
                </button>

                <div className="flex flex-col gap-2">
                  <a
                    href="#"
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-gc-accent transition"
                  >
                    <ExternalLink size={14} />
                    Luminex GigaCore Documentation
                  </a>
                  <a
                    href="#"
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-gc-accent transition"
                  >
                    <ExternalLink size={14} />
                    Release Notes
                  </a>
                  <a
                    href="#"
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-gc-accent transition"
                  >
                    <ExternalLink size={14} />
                    Report an Issue
                  </a>
                  <a
                    href="#"
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-gc-accent transition"
                  >
                    <ExternalLink size={14} />
                    GigaCore Firmware Downloads
                  </a>
                </div>
              </div>
            </SectionCard>
          </>
        )}

        {/* Save bar */}
        <div className="sticky bottom-0 bg-gray-900/90 backdrop-blur border-t border-gray-800 -mx-8 px-8 py-3 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Changes are saved automatically to local storage.
          </span>
          <button className="px-4 py-2 text-sm rounded-lg bg-gc-accent text-gray-900 font-medium hover:bg-gc-accent/90 transition flex items-center gap-1.5">
            <CheckCircle2 size={14} />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
