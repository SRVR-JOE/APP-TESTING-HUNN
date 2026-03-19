import React, { useState, useMemo, useCallback } from 'react';
import {
  Wifi,
  WifiOff,
  Plus,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Info,
  XCircle,
  Bell,
  BellOff,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Activity,
  Thermometer,
  Zap,
  BarChart3,
  Settings,
  Filter,
  ArrowUpDown,
  Clock,
  MonitorCheck,
  Satellite,
} from 'lucide-react';
import { useRemoteStore } from '../store/useRemoteStore';
import type { RemoteSession, RemoteAlert, Severity } from '@shared/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<Severity, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  info:     { icon: <Info size={14} />,           color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30',   label: 'Info' },
  warning:  { icon: <AlertTriangle size={14} />,  color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', label: 'Warning' },
  error:    { icon: <AlertCircle size={14} />,     color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', label: 'Error' },
  critical: { icon: <XCircle size={14} />,         color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30',     label: 'Critical' },
};

const ALERT_TYPE_COLORS: Record<string, string> = {
  'link-down':   'bg-red-500/20 text-red-300',
  bandwidth:     'bg-yellow-500/20 text-yellow-300',
  temperature:   'bg-orange-500/20 text-orange-300',
  poe:           'bg-purple-500/20 text-purple-300',
  firmware:      'bg-blue-500/20 text-blue-300',
  drift:         'bg-amber-500/20 text-amber-300',
  health:        'bg-green-500/20 text-green-300',
};

function statusDot(status: RemoteSession['status']) {
  switch (status) {
    case 'connected':    return 'bg-green-400';
    case 'connecting':   return 'bg-yellow-400 animate-pulse';
    case 'disconnected': return 'bg-gray-500';
    case 'error':        return 'bg-red-500';
  }
}

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

// ─── Tab type ────────────────────────────────────────────────────────────────

type Tab = 'alerts' | 'grid' | 'notifications';

// ─── Mock live grid data ─────────────────────────────────────────────────────

interface SwitchGridItem {
  id: string;
  sessionName: string;
  name: string;
  ip: string;
  health: 'healthy' | 'warning' | 'critical' | 'offline';
  trafficMbps: number;
  poeDrawW: number;
  poeBudgetW: number;
  tempC: number;
  portsUp: number;
  portCount: number;
}

const MOCK_GRID: SwitchGridItem[] = [
  { id: 'sw-foh-01', sessionName: 'FOH Local', name: 'FOH Core 01', ip: '192.168.1.10', health: 'warning', trafficMbps: 740, poeDrawW: 180, poeBudgetW: 240, tempC: 58, portsUp: 23, portCount: 26 },
  { id: 'sw-foh-02', sessionName: 'FOH Local', name: 'FOH Distro 02', ip: '192.168.1.11', health: 'healthy', trafficMbps: 320, poeDrawW: 90, poeBudgetW: 120, tempC: 45, portsUp: 12, portCount: 14 },
  { id: 'sw-foh-03', sessionName: 'FOH Local', name: 'Stage Left 03', ip: '192.168.1.12', health: 'healthy', trafficMbps: 210, poeDrawW: 60, poeBudgetW: 120, tempC: 42, portsUp: 8, portCount: 14 },
  { id: 'sw-mon-01', sessionName: 'Monitor World', name: 'Mon Core 01', ip: '192.168.1.20', health: 'critical', trafficMbps: 560, poeDrawW: 220, poeBudgetW: 240, tempC: 72, portsUp: 16, portCount: 18 },
  { id: 'sw-mon-02', sessionName: 'Monitor World', name: 'Mon Distro 02', ip: '192.168.1.21', health: 'healthy', trafficMbps: 180, poeDrawW: 45, poeBudgetW: 120, tempC: 39, portsUp: 6, portCount: 10 },
  { id: 'sw-bcast-01', sessionName: 'Broadcast Truck', name: 'Broadcast Core', ip: '10.0.5.100', health: 'offline', trafficMbps: 0, poeDrawW: 0, poeBudgetW: 240, tempC: 0, portsUp: 0, portCount: 26 },
  { id: 'sw-bcast-02', sessionName: 'Broadcast Truck', name: 'Video Switch', ip: '10.0.5.101', health: 'offline', trafficMbps: 0, poeDrawW: 0, poeBudgetW: 120, tempC: 0, portsUp: 0, portCount: 14 },
];

// ─── Notification settings state ─────────────────────────────────────────────

interface NotificationThresholds {
  linkDown: boolean;
  bandwidthPct: number;
  tempC: number;
  poePct: number;
  emailEnabled: boolean;
  webhookEnabled: boolean;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function RemoteMonitorView() {
  const {
    sessions,
    alerts,
    alertFilters,
    addSession,
    removeSession,
    connectSession,
    disconnectSession,
    acknowledgeAlert,
    clearAlerts,
    setAlertFilters,
    getUnacknowledgedCount,
  } = useRemoteStore();

  const [activeTab, setActiveTab] = useState<Tab>('alerts');
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'time' | 'severity'>('time');
  const [sortAsc, setSortAsc] = useState(false);

  // Add session form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newHost, setNewHost] = useState('');
  const [newPort, setNewPort] = useState('8080');

  // Notification settings
  const [thresholds, setThresholds] = useState<NotificationThresholds>({
    linkDown: true,
    bandwidthPct: 85,
    tempC: 65,
    poePct: 90,
    emailEnabled: false,
    webhookEnabled: true,
  });

  // Auto-refresh indicator
  const [lastRefresh] = useState(new Date());

  const unackCount = getUnacknowledgedCount();

  // ─── Filtered & sorted alerts ────────────────────────────────────
  const filteredAlerts = useMemo(() => {
    let list = [...alerts];

    if (alertFilters.severity.length > 0) {
      list = list.filter((a) => alertFilters.severity.includes(a.severity));
    }
    if (alertFilters.type.length > 0) {
      list = list.filter((a) => alertFilters.type.includes(a.type));
    }
    if (alertFilters.switchId.length > 0) {
      list = list.filter((a) => a.switchId && alertFilters.switchId.includes(a.switchId));
    }

    const severityOrder: Record<Severity, number> = { critical: 0, error: 1, warning: 2, info: 3 };

    list.sort((a, b) => {
      if (sortBy === 'severity') {
        const diff = severityOrder[a.severity] - severityOrder[b.severity];
        return sortAsc ? -diff : diff;
      }
      const diff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      return sortAsc ? -diff : diff;
    });

    return list;
  }, [alerts, alertFilters, sortBy, sortAsc]);

  // ─── Severity breakdown ──────────────────────────────────────────
  const severityBreakdown = useMemo(() => {
    const counts: Record<Severity, number> = { info: 0, warning: 0, error: 0, critical: 0 };
    alerts.forEach((a) => counts[a.severity]++);
    return counts;
  }, [alerts]);

  // ─── Unique types and switches for filter ────────────────────────
  const alertTypes = useMemo(() => [...new Set(alerts.map((a) => a.type))], [alerts]);
  const alertSwitchIds = useMemo(() => [...new Set(alerts.filter((a) => a.switchId).map((a) => a.switchId!))], [alerts]);

  // ─── Add session handler ─────────────────────────────────────────
  const handleAddSession = useCallback(() => {
    if (!newName.trim() || !newHost.trim()) return;
    addSession({
      id: `rs-${Date.now()}`,
      name: newName.trim(),
      host: newHost.trim(),
      port: parseInt(newPort) || 8080,
      status: 'disconnected',
    });
    setNewName('');
    setNewHost('');
    setNewPort('8080');
    setShowAddForm(false);
  }, [newName, newHost, newPort, addSession]);

  // ─── Toggle filter helpers ───────────────────────────────────────
  const toggleSeverityFilter = (sev: Severity) => {
    const current = alertFilters.severity;
    setAlertFilters({
      severity: current.includes(sev) ? current.filter((s) => s !== sev) : [...current, sev],
    });
  };

  const toggleTypeFilter = (type: string) => {
    const current = alertFilters.type;
    setAlertFilters({
      type: current.includes(type) ? current.filter((t) => t !== type) : [...current, type],
    });
  };

  const toggleSwitchFilter = (swId: string) => {
    const current = alertFilters.switchId;
    setAlertFilters({
      switchId: current.includes(swId) ? current.filter((s) => s !== swId) : [...current, swId],
    });
  };

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Satellite size={24} className="text-gc-accent" />
          <div>
            <h1 className="text-xl font-bold">Remote Monitoring</h1>
            <p className="text-sm text-gray-400">
              {sessions.filter((s) => s.status === 'connected').length} of {sessions.length} sessions connected
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <RefreshCw size={12} className="animate-spin" />
            Auto-refresh {timeAgo(lastRefresh.toISOString())}
          </div>
          {unackCount > 0 && (
            <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1.5">
              <Bell size={14} className="text-red-400" />
              <span className="text-sm font-medium text-red-300">{unackCount} unread</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Connections Panel ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${statusDot(session.status)}`} />
                <h3 className="font-semibold text-sm">{session.name}</h3>
              </div>
              <button
                className="text-gray-500 hover:text-red-400 transition"
                onClick={() => removeSession(session.id)}
                title="Remove session"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="space-y-1 text-xs text-gray-400 mb-3">
              <div className="font-mono">{session.host}:{session.port}</div>
              {session.latencyMs !== undefined && (
                <div className="flex items-center gap-1">
                  <Activity size={10} />
                  <span>{session.latencyMs}ms latency</span>
                </div>
              )}
              {session.lastPing && (
                <div className="flex items-center gap-1">
                  <Clock size={10} />
                  <span>Last ping: {timeAgo(session.lastPing)}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {session.status === 'connected' ? (
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-600 text-gray-300 hover:border-red-500/50 hover:text-red-400 transition"
                  onClick={() => disconnectSession(session.id)}
                >
                  <WifiOff size={12} />
                  Disconnect
                </button>
              ) : (
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gc-accent text-gray-900 font-medium hover:bg-gc-accent/90 transition"
                  onClick={() => connectSession(session.id)}
                >
                  <Wifi size={12} />
                  Connect
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Add new session card */}
        {showAddForm ? (
          <div className="bg-gray-800/50 border border-gc-accent/30 rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 text-gc-accent">New Session</h3>
            <div className="space-y-2 mb-3">
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-gc-accent"
                placeholder="Session name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm font-mono outline-none focus:border-gc-accent"
                placeholder="Host IP"
                value={newHost}
                onChange={(e) => setNewHost(e.target.value)}
              />
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm font-mono outline-none focus:border-gc-accent"
                placeholder="Port"
                value={newPort}
                onChange={(e) => setNewPort(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-gc-accent text-gray-900 font-medium hover:bg-gc-accent/90 transition disabled:opacity-40"
                disabled={!newName.trim() || !newHost.trim()}
                onClick={handleAddSession}
              >
                Add
              </button>
              <button
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-gray-600 text-gray-300 hover:text-white transition"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className="border-2 border-dashed border-gray-700 rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-gray-500 hover:border-gc-accent/50 hover:text-gc-accent transition min-h-[140px]"
            onClick={() => setShowAddForm(true)}
          >
            <Plus size={20} />
            <span className="text-xs font-medium">Add Session</span>
          </button>
        )}
      </div>

      {/* ─── Tab Navigation ──────────────────────────────────────────── */}
      <div className="border-b border-gray-700 flex gap-0.5">
        {([
          { key: 'alerts' as Tab, label: 'Alert Dashboard', icon: <Bell size={14} />, badge: unackCount },
          { key: 'grid' as Tab, label: 'Live Status Grid', icon: <MonitorCheck size={14} /> },
          { key: 'notifications' as Tab, label: 'Notification Settings', icon: <Settings size={14} /> },
        ]).map((tab) => (
          <button
            key={tab.key}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab.key
                ? 'border-gc-accent text-gc-accent'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="ml-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Alert Dashboard Tab ─────────────────────────────────────── */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex items-center gap-4 bg-gray-800/30 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 pr-4 border-r border-gray-700">
              <span className="text-2xl font-bold">{alerts.length}</span>
              <span className="text-xs text-gray-400">Total<br/>Alerts</span>
            </div>
            <div className="flex items-center gap-2 pr-4 border-r border-gray-700">
              <Bell size={16} className="text-red-400" />
              <span className="text-lg font-bold text-red-300">{unackCount}</span>
              <span className="text-xs text-gray-400">Unread</span>
            </div>
            {(['critical', 'error', 'warning', 'info'] as Severity[]).map((sev) => {
              const cfg = SEVERITY_CONFIG[sev];
              return (
                <div key={sev} className="flex items-center gap-1.5">
                  <span className={cfg.color}>{cfg.icon}</span>
                  <span className={`text-sm font-semibold ${cfg.color}`}>{severityBreakdown[sev]}</span>
                  <span className="text-xs text-gray-500">{cfg.label}</span>
                </div>
              );
            })}
            <div className="ml-auto">
              <button
                className="text-xs text-gray-500 hover:text-red-400 transition"
                onClick={clearAlerts}
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Filter size={12} />
              Filters:
            </div>
            {/* Severity toggles */}
            <div className="flex gap-1">
              {(['critical', 'error', 'warning', 'info'] as Severity[]).map((sev) => {
                const active = alertFilters.severity.length === 0 || alertFilters.severity.includes(sev);
                const cfg = SEVERITY_CONFIG[sev];
                return (
                  <button
                    key={sev}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs border transition ${
                      active
                        ? `${cfg.bg} border ${cfg.color}`
                        : 'bg-gray-800 border-gray-700 text-gray-500'
                    }`}
                    onClick={() => toggleSeverityFilter(sev)}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            {/* Type filter */}
            <div className="flex gap-1">
              {alertTypes.map((type) => {
                const active = alertFilters.type.length === 0 || alertFilters.type.includes(type);
                return (
                  <button
                    key={type}
                    className={`px-2 py-1 rounded text-xs border transition ${
                      active
                        ? `${ALERT_TYPE_COLORS[type] || 'bg-gray-600/20 text-gray-300'} border-transparent`
                        : 'bg-gray-800 border-gray-700 text-gray-500'
                    }`}
                    onClick={() => toggleTypeFilter(type)}
                  >
                    {type}
                  </button>
                );
              })}
            </div>

            {/* Switch filter */}
            {alertSwitchIds.length > 0 && (
              <div className="flex gap-1">
                {alertSwitchIds.map((swId) => {
                  const active = alertFilters.switchId.length === 0 || alertFilters.switchId.includes(swId);
                  return (
                    <button
                      key={swId}
                      className={`px-2 py-1 rounded text-xs border transition font-mono ${
                        active
                          ? 'bg-gc-accent/10 border-gc-accent/30 text-gc-accent'
                          : 'bg-gray-800 border-gray-700 text-gray-500'
                      }`}
                      onClick={() => toggleSwitchFilter(swId)}
                    >
                      {swId}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Sort */}
            <div className="ml-auto flex items-center gap-2">
              <button
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white transition"
                onClick={() => {
                  if (sortBy === 'time') setSortAsc(!sortAsc);
                  else { setSortBy('time'); setSortAsc(false); }
                }}
              >
                <ArrowUpDown size={12} />
                Time {sortBy === 'time' && (sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
              </button>
              <button
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white transition"
                onClick={() => {
                  if (sortBy === 'severity') setSortAsc(!sortAsc);
                  else { setSortBy('severity'); setSortAsc(false); }
                }}
              >
                <ArrowUpDown size={12} />
                Severity {sortBy === 'severity' && (sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
              </button>
            </div>
          </div>

          {/* Alert list */}
          <div className="space-y-2">
            {filteredAlerts.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <BellOff size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No alerts match the current filters.</p>
              </div>
            )}
            {filteredAlerts.map((alert) => {
              const cfg = SEVERITY_CONFIG[alert.severity];
              const isExpanded = expandedAlertId === alert.id;
              return (
                <div
                  key={alert.id}
                  className={`border rounded-xl transition cursor-pointer ${cfg.bg} ${
                    alert.acknowledged ? 'opacity-60' : ''
                  }`}
                  onClick={() => setExpandedAlertId(isExpanded ? null : alert.id)}
                >
                  <div className="flex items-center gap-3 p-3">
                    <span className={cfg.color}>{cfg.icon}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${ALERT_TYPE_COLORS[alert.type] || 'bg-gray-600/20 text-gray-300'}`}>
                      {alert.type}
                    </span>
                    {alert.switchId && (
                      <span className="text-[10px] font-mono text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">
                        {alert.switchId}
                      </span>
                    )}
                    <span className="text-sm flex-1 truncate">{alert.message}</span>
                    <span className="text-[10px] text-gray-500 whitespace-nowrap">{timeAgo(alert.timestamp)}</span>
                    {!alert.acknowledged && (
                      <button
                        className="shrink-0 flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-gray-800 border border-gray-600 text-gray-300 hover:border-green-500 hover:text-green-400 transition"
                        onClick={(e) => { e.stopPropagation(); acknowledgeAlert(alert.id); }}
                      >
                        <Check size={10} />
                        Ack
                      </button>
                    )}
                    {isExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                  </div>
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 border-t border-gray-700/50">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-400 mt-2">
                        <div><span className="text-gray-500">Alert ID:</span> {alert.id}</div>
                        <div><span className="text-gray-500">Session:</span> {alert.sessionId}</div>
                        <div><span className="text-gray-500">Timestamp:</span> {new Date(alert.timestamp).toLocaleString()}</div>
                        <div><span className="text-gray-500">Notification Sent:</span> {alert.notificationSent ? 'Yes' : 'No'}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Live Status Grid Tab ────────────────────────────────────── */}
      {activeTab === 'grid' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300">All Monitored Switches</h3>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Live — refreshes every 5s
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {MOCK_GRID.map((sw) => {
              const healthColor = {
                healthy: 'border-green-500/30 bg-green-500/5',
                warning: 'border-yellow-500/30 bg-yellow-500/5',
                critical: 'border-red-500/30 bg-red-500/5',
                offline: 'border-gray-600 bg-gray-800/50 opacity-50',
              }[sw.health];
              const healthDot = {
                healthy: 'bg-green-400',
                warning: 'bg-yellow-400',
                critical: 'bg-red-500 animate-pulse',
                offline: 'bg-gray-600',
              }[sw.health];
              const poePct = sw.poeBudgetW > 0 ? Math.round((sw.poeDrawW / sw.poeBudgetW) * 100) : 0;

              return (
                <div key={sw.id} className={`border rounded-xl p-3 ${healthColor}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${healthDot}`} />
                    <span className="text-sm font-semibold truncate">{sw.name}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono mb-3">{sw.ip} — {sw.sessionName}</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Activity size={10} className="text-blue-400" />
                      <span className="text-gray-400">Traffic</span>
                      <span className="ml-auto font-mono">{sw.trafficMbps} Mbps</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Zap size={10} className="text-purple-400" />
                      <span className="text-gray-400">PoE</span>
                      <span className={`ml-auto font-mono ${poePct > 90 ? 'text-red-400' : poePct > 80 ? 'text-yellow-400' : ''}`}>
                        {poePct}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Thermometer size={10} className="text-orange-400" />
                      <span className="text-gray-400">Temp</span>
                      <span className={`ml-auto font-mono ${sw.tempC > 65 ? 'text-red-400' : sw.tempC > 55 ? 'text-yellow-400' : ''}`}>
                        {sw.tempC > 0 ? `${sw.tempC}°C` : '--'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <BarChart3 size={10} className="text-green-400" />
                      <span className="text-gray-400">Ports</span>
                      <span className="ml-auto font-mono">{sw.portsUp}/{sw.portCount}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Notification Settings Tab ───────────────────────────────── */}
      {activeTab === 'notifications' && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-5">
            <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle size={16} className="text-gc-accent" />
              Alert Thresholds
            </h3>
            <div className="space-y-4">
              {/* Link Down */}
              <div className="flex items-center justify-between py-2 border-b border-gray-800">
                <div>
                  <div className="text-sm font-medium">Link Down</div>
                  <div className="text-xs text-gray-500">Alert when any port link goes down</div>
                </div>
                <button
                  className="flex items-center gap-2"
                  onClick={() => setThresholds((p) => ({ ...p, linkDown: !p.linkDown }))}
                >
                  <div className={`w-9 h-5 rounded-full transition-colors relative ${thresholds.linkDown ? 'bg-gc-accent' : 'bg-gray-700'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${thresholds.linkDown ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              </div>

              {/* Bandwidth */}
              <div className="flex items-center justify-between py-2 border-b border-gray-800">
                <div>
                  <div className="text-sm font-medium">Bandwidth Threshold</div>
                  <div className="text-xs text-gray-500">Alert when port utilization exceeds this %</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-right font-mono outline-none focus:border-gc-accent"
                    type="number"
                    min={50}
                    max={100}
                    value={thresholds.bandwidthPct}
                    onChange={(e) => setThresholds((p) => ({ ...p, bandwidthPct: parseInt(e.target.value) || 85 }))}
                  />
                  <span className="text-xs text-gray-500">%</span>
                </div>
              </div>

              {/* Temperature */}
              <div className="flex items-center justify-between py-2 border-b border-gray-800">
                <div>
                  <div className="text-sm font-medium">Temperature Threshold</div>
                  <div className="text-xs text-gray-500">Alert when switch temperature exceeds this value</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-right font-mono outline-none focus:border-gc-accent"
                    type="number"
                    min={40}
                    max={100}
                    value={thresholds.tempC}
                    onChange={(e) => setThresholds((p) => ({ ...p, tempC: parseInt(e.target.value) || 65 }))}
                  />
                  <span className="text-xs text-gray-500">°C</span>
                </div>
              </div>

              {/* PoE */}
              <div className="flex items-center justify-between py-2 border-b border-gray-800">
                <div>
                  <div className="text-sm font-medium">PoE Budget Threshold</div>
                  <div className="text-xs text-gray-500">Alert when PoE draw exceeds this % of budget</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-right font-mono outline-none focus:border-gc-accent"
                    type="number"
                    min={50}
                    max={100}
                    value={thresholds.poePct}
                    onChange={(e) => setThresholds((p) => ({ ...p, poePct: parseInt(e.target.value) || 90 }))}
                  />
                  <span className="text-xs text-gray-500">%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-5">
            <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Bell size={16} className="text-gc-accent" />
              Notification Delivery
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-800">
                <div>
                  <div className="text-sm font-medium">Email Notifications</div>
                  <div className="text-xs text-gray-500">Send alert emails to configured addresses</div>
                </div>
                <button
                  className="flex items-center gap-2"
                  onClick={() => setThresholds((p) => ({ ...p, emailEnabled: !p.emailEnabled }))}
                >
                  <div className={`w-9 h-5 rounded-full transition-colors relative ${thresholds.emailEnabled ? 'bg-gc-accent' : 'bg-gray-700'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${thresholds.emailEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium">Webhook Notifications</div>
                  <div className="text-xs text-gray-500">POST alert data to configured webhook endpoints</div>
                </div>
                <button
                  className="flex items-center gap-2"
                  onClick={() => setThresholds((p) => ({ ...p, webhookEnabled: !p.webhookEnabled }))}
                >
                  <div className={`w-9 h-5 rounded-full transition-colors relative ${thresholds.webhookEnabled ? 'bg-gc-accent' : 'bg-gray-700'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${thresholds.webhookEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
