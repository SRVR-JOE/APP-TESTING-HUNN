import { create } from 'zustand';
import type { AuditEntry, AuditAction } from '@shared/types';

// ── Filter state ────────────────────────────────────────────────────────────
export interface AuditFilters {
  action: AuditAction | null;
  entityType: AuditEntry['entityType'] | null;
  user: string;
  dateRange: { start: string; end: string } | null;
  search: string;
}

const DEFAULT_FILTERS: AuditFilters = {
  action: null,
  entityType: null,
  user: '',
  dateRange: null,
  search: '',
};

// ── Store interface ─────────────────────────────────────────────────────────
export interface AuditState {
  entries: AuditEntry[];
  filters: AuditFilters;
  addEntry: (entry: AuditEntry) => void;
  setFilter: <K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) => void;
  clearFilters: () => void;
  getFilteredEntries: () => AuditEntry[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function ts(daysAgo: number, h = 10, m = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

// ── Mock Data ───────────────────────────────────────────────────────────────
const MOCK_ENTRIES: AuditEntry[] = [
  { id: 'a01', timestamp: ts(0, 9, 5),  userName: 'jmartinez', action: 'create',   entityType: 'showfile',  entityId: 'sf-100', entityName: 'Summer Festival 2026',     description: 'Created new show file for Summer Festival 2026', before: undefined, after: '{"name":"Summer Festival 2026","switches":[],"vlans":[]}' },
  { id: 'a02', timestamp: ts(0, 9, 12), userName: 'jmartinez', action: 'update',   entityType: 'showfile',  entityId: 'sf-100', entityName: 'Summer Festival 2026',     description: 'Added 6 switches to show file', before: '{"switchCount":0}', after: '{"switchCount":6}' },
  { id: 'a03', timestamp: ts(0, 9, 30), userName: 'akim',      action: 'create',   entityType: 'profile',   entityId: 'pr-40',  entityName: 'FOH Dante+sACN',           description: 'Created profile for FOH with Dante Primary and sACN VLANs' },
  { id: 'a04', timestamp: ts(0, 10, 0), userName: 'akim',      action: 'assign',   entityType: 'switch',    entityId: 'sw-01',  entityName: 'FOH-CORE-01',              description: 'Assigned role foh-core to FOH-CORE-01', before: '{"role":"spare"}', after: '{"role":"foh-core"}' },
  { id: 'a05', timestamp: ts(0, 10, 15),userName: 'akim',      action: 'assign',   entityType: 'switch',    entityId: 'sw-02',  entityName: 'STG-LEFT-01',              description: 'Assigned role stage-left to STG-LEFT-01' },
  { id: 'a06', timestamp: ts(0, 11, 0), userName: 'jmartinez', action: 'deploy',   entityType: 'showfile',  entityId: 'sf-100', entityName: 'Summer Festival 2026',     description: 'Deployed show file v1 to 6 switches' },
  { id: 'a07', timestamp: ts(0, 11, 20),userName: 'bchen',     action: 'update',   entityType: 'vlan',      entityId: 'v-10',   entityName: 'Dante Primary (VLAN 10)',  description: 'Changed IGMP querier interval from 125s to 60s', before: '{"queryInterval":125}', after: '{"queryInterval":60}' },
  { id: 'a08', timestamp: ts(0, 14, 0), userName: 'jmartinez', action: 'rollback', entityType: 'showfile',  entityId: 'sf-100', entityName: 'Summer Festival 2026',     description: 'Rolled back show file from v2 to v1 after VLAN mismatch' },
  { id: 'a09', timestamp: ts(0, 15, 30),userName: 'akim',      action: 'export',   entityType: 'showfile',  entityId: 'sf-100', entityName: 'Summer Festival 2026',     description: 'Exported show file to JSON' },
  { id: 'a10', timestamp: ts(1, 8, 0),  userName: 'bchen',     action: 'create',   entityType: 'venue',     entityId: 've-05',  entityName: 'Madison Square Garden',    description: 'Created venue profile for Madison Square Garden' },
  { id: 'a11', timestamp: ts(1, 8, 30), userName: 'bchen',     action: 'update',   entityType: 'venue',     entityId: 've-05',  entityName: 'Madison Square Garden',    description: 'Added house network details — internet drop, existing VLANs' },
  { id: 'a12', timestamp: ts(1, 9, 45), userName: 'jmartinez', action: 'create',   entityType: 'tour',      entityId: 'tr-10',  entityName: 'North America Summer 2026',description: 'Created tour with 12 stops' },
  { id: 'a13', timestamp: ts(1, 10, 0), userName: 'jmartinez', action: 'assign',   entityType: 'fleet',     entityId: 'fl-22',  entityName: 'GC-16Xt SN:4827',         description: 'Assigned switch to tour North America Summer 2026' },
  { id: 'a14', timestamp: ts(1, 10, 15),userName: 'jmartinez', action: 'assign',   entityType: 'fleet',     entityId: 'fl-23',  entityName: 'GC-16Xt SN:4828',         description: 'Assigned switch to tour North America Summer 2026' },
  { id: 'a15', timestamp: ts(2, 14, 0), userName: 'akim',      action: 'update',   entityType: 'switch',    entityId: 'sw-03',  entityName: 'MON-WORLD-01',            description: 'Updated port 1-8 VLANs from access to trunk mode', before: '{"ports":[{"1":"access"}]}', after: '{"ports":[{"1":"trunk"}]}' },
  { id: 'a16', timestamp: ts(2, 15, 0), userName: 'bchen',     action: 'deploy',   entityType: 'showfile',  entityId: 'sf-98',  entityName: 'Arena Rock Config v3',     description: 'Deployed Arena Rock Config v3 to 8 switches' },
  { id: 'a17', timestamp: ts(3, 9, 0),  userName: 'dmiller',   action: 'login',    entityType: 'system',    entityId: 'sys',    entityName: 'System',                   description: 'User dmiller logged in' },
  { id: 'a18', timestamp: ts(3, 9, 5),  userName: 'dmiller',   action: 'import',   entityType: 'profile',   entityId: 'pr-41',  entityName: 'Broadcast NDI Profile',    description: 'Imported profile from Excel template' },
  { id: 'a19', timestamp: ts(3, 11, 0), userName: 'dmiller',   action: 'create',   entityType: 'template',  entityId: 'tm-12',  entityName: 'TRUSS {number}',           description: 'Created naming template for truss-mounted switches' },
  { id: 'a20', timestamp: ts(4, 8, 30), userName: 'akim',      action: 'delete',   entityType: 'profile',   entityId: 'pr-35',  entityName: 'Old Festival Profile',     description: 'Deleted unused profile "Old Festival Profile"' },
  { id: 'a21', timestamp: ts(4, 10, 0), userName: 'jmartinez', action: 'update',   entityType: 'tour',      entityId: 'tr-09',  entityName: 'Europe Winter 2025',       description: 'Added 3 new tour stops and updated venue schedule' },
  { id: 'a22', timestamp: ts(5, 13, 0), userName: 'bchen',     action: 'deploy',   entityType: 'showfile',  entityId: 'sf-95',  entityName: 'Theater Config v2',        description: 'Deployed Theater Config v2 to 4 switches' },
  { id: 'a23', timestamp: ts(5, 14, 0), userName: 'bchen',     action: 'rollback', entityType: 'showfile',  entityId: 'sf-95',  entityName: 'Theater Config v2',        description: 'Rolled back Theater Config — PoE budget exceeded on MON switch' },
  { id: 'a24', timestamp: ts(6, 9, 0),  userName: 'akim',      action: 'unassign', entityType: 'fleet',     entityId: 'fl-19',  entityName: 'GC-14R SN:3201',          description: 'Unassigned switch from tour — sent to RMA' },
  { id: 'a25', timestamp: ts(6, 10, 30),userName: 'dmiller',   action: 'create',   entityType: 'showfile',  entityId: 'sf-96',  entityName: 'Convention Center Setup',   description: 'Created show file for convention center with 10 switches' },
  { id: 'a26', timestamp: ts(7, 8, 0),  userName: 'jmartinez', action: 'update',   entityType: 'switch',    entityId: 'sw-08',  entityName: 'TRUSS-DS-02',             description: 'Updated firmware from 2.4.3 to 2.5.1', before: '{"firmware":"2.4.3"}', after: '{"firmware":"2.5.1"}' },
  { id: 'a27', timestamp: ts(7, 11, 0), userName: 'akim',      action: 'export',   entityType: 'tour',      entityId: 'tr-10',  entityName: 'North America Summer 2026',description: 'Exported tour advance sheets for all stops' },
  { id: 'a28', timestamp: ts(8, 16, 0), userName: 'bchen',     action: 'create',   entityType: 'venue',     entityId: 've-06',  entityName: 'Red Rocks Amphitheatre',   description: 'Created venue profile for Red Rocks Amphitheatre' },
];

// ── Zustand Store ───────────────────────────────────────────────────────────
export const useAuditStore = create<AuditState>((set, get) => ({
  entries: MOCK_ENTRIES,
  filters: { ...DEFAULT_FILTERS },

  addEntry: (entry) =>
    set((state) => ({ entries: [entry, ...state.entries] })),

  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),

  clearFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  getFilteredEntries: () => {
    const { entries, filters } = get();
    return entries.filter((e) => {
      if (filters.action && e.action !== filters.action) return false;
      if (filters.entityType && e.entityType !== filters.entityType) return false;
      if (filters.user && e.userName?.toLowerCase() !== filters.user.toLowerCase()) return false;
      if (filters.dateRange) {
        const t = new Date(e.timestamp).getTime();
        if (filters.dateRange.start && t < new Date(filters.dateRange.start).getTime()) return false;
        if (filters.dateRange.end && t > new Date(filters.dateRange.end).getTime()) return false;
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const hay = `${e.entityName ?? ''} ${e.description} ${e.userName ?? ''} ${e.entityType}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  },
}));
