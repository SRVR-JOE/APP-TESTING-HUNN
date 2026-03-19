import { create } from 'zustand';
import type { RemoteSession, RemoteAlert, Severity } from '@shared/types';

// ---- Alert filter state -----------------------------------------------------

export interface AlertFilters {
  severity: Severity[];
  type: string[];
  switchId: string[];
}

// ---- Store shape ------------------------------------------------------------

export interface RemoteState {
  sessions: RemoteSession[];
  alerts: RemoteAlert[];
  alertFilters: AlertFilters;

  // Sessions
  addSession: (session: RemoteSession) => void;
  removeSession: (id: string) => void;
  connectSession: (id: string) => void;
  disconnectSession: (id: string) => void;

  // Alerts
  addAlert: (alert: RemoteAlert) => void;
  acknowledgeAlert: (id: string) => void;
  clearAlerts: () => void;
  setAlertFilters: (filters: Partial<AlertFilters>) => void;

  // Derived
  getUnacknowledgedCount: () => number;
}

// ---- Mock data --------------------------------------------------------------

const MOCK_SESSIONS: RemoteSession[] = [
  {
    id: 'rs-1',
    name: 'FOH Local',
    host: '192.168.1.10',
    port: 8080,
    status: 'connected',
    lastPing: new Date(Date.now() - 2000).toISOString(),
    latencyMs: 4,
  },
  {
    id: 'rs-2',
    name: 'Monitor World',
    host: '192.168.1.20',
    port: 8080,
    status: 'connected',
    lastPing: new Date(Date.now() - 5000).toISOString(),
    latencyMs: 12,
  },
  {
    id: 'rs-3',
    name: 'Broadcast Truck',
    host: '10.0.5.100',
    port: 8080,
    status: 'disconnected',
    lastPing: new Date(Date.now() - 120000).toISOString(),
    latencyMs: undefined,
  },
];

const now = Date.now();

const MOCK_ALERTS: RemoteAlert[] = [
  {
    id: 'ra-1',
    sessionId: 'rs-1',
    type: 'link-down',
    severity: 'critical',
    switchId: 'sw-foh-01',
    message: 'Port 14 link down on FOH Core — ISL uplink lost',
    timestamp: new Date(now - 30000).toISOString(),
    acknowledged: false,
    notificationSent: true,
  },
  {
    id: 'ra-2',
    sessionId: 'rs-1',
    type: 'bandwidth',
    severity: 'warning',
    switchId: 'sw-foh-01',
    message: 'Port 3 bandwidth at 87% — Dante Primary near saturation',
    timestamp: new Date(now - 60000).toISOString(),
    acknowledged: false,
    notificationSent: true,
  },
  {
    id: 'ra-3',
    sessionId: 'rs-2',
    type: 'temperature',
    severity: 'error',
    switchId: 'sw-mon-01',
    message: 'Monitor World switch temperature 72°C — above threshold',
    timestamp: new Date(now - 90000).toISOString(),
    acknowledged: false,
    notificationSent: true,
  },
  {
    id: 'ra-4',
    sessionId: 'rs-2',
    type: 'poe',
    severity: 'warning',
    switchId: 'sw-mon-01',
    message: 'PoE budget at 92% — 2 ports may lose power',
    timestamp: new Date(now - 150000).toISOString(),
    acknowledged: true,
    notificationSent: true,
  },
  {
    id: 'ra-5',
    sessionId: 'rs-3',
    type: 'link-down',
    severity: 'critical',
    switchId: 'sw-bcast-01',
    message: 'All ports down — Broadcast Truck switch unreachable',
    timestamp: new Date(now - 120000).toISOString(),
    acknowledged: false,
    notificationSent: true,
  },
  {
    id: 'ra-6',
    sessionId: 'rs-1',
    type: 'firmware',
    severity: 'info',
    switchId: 'sw-foh-02',
    message: 'Firmware update available: v4.2.1 for GigaCore 14R',
    timestamp: new Date(now - 300000).toISOString(),
    acknowledged: true,
    notificationSent: false,
  },
  {
    id: 'ra-7',
    sessionId: 'rs-1',
    type: 'drift',
    severity: 'warning',
    switchId: 'sw-foh-01',
    message: 'VLAN 10 config drift detected — port 7 untagged mismatch',
    timestamp: new Date(now - 400000).toISOString(),
    acknowledged: false,
    notificationSent: true,
  },
  {
    id: 'ra-8',
    sessionId: 'rs-2',
    type: 'health',
    severity: 'info',
    switchId: 'sw-mon-01',
    message: 'Health check passed — all ports within normal parameters',
    timestamp: new Date(now - 500000).toISOString(),
    acknowledged: true,
    notificationSent: false,
  },
];

// ---- Store ------------------------------------------------------------------

export const useRemoteStore = create<RemoteState>((set, get) => ({
  sessions: MOCK_SESSIONS,
  alerts: MOCK_ALERTS,
  alertFilters: {
    severity: [],
    type: [],
    switchId: [],
  },

  // ─── Sessions ──────────────────────────────────────────────────────
  addSession: (session) =>
    set((state) => ({ sessions: [...state.sessions, session] })),

  removeSession: (id) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
    })),

  connectSession: (id) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id
          ? {
              ...s,
              status: 'connected' as const,
              lastPing: new Date().toISOString(),
              latencyMs: Math.floor(Math.random() * 20) + 2,
            }
          : s,
      ),
    })),

  disconnectSession: (id) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id
          ? { ...s, status: 'disconnected' as const, latencyMs: undefined }
          : s,
      ),
    })),

  // ─── Alerts ────────────────────────────────────────────────────────
  addAlert: (alert) =>
    set((state) => ({ alerts: [alert, ...state.alerts] })),

  acknowledgeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === id ? { ...a, acknowledged: true } : a,
      ),
    })),

  clearAlerts: () => set({ alerts: [] }),

  setAlertFilters: (filters) =>
    set((state) => ({
      alertFilters: { ...state.alertFilters, ...filters },
    })),

  // ─── Derived ───────────────────────────────────────────────────────
  getUnacknowledgedCount: () =>
    get().alerts.filter((a) => !a.acknowledged).length,
}));
