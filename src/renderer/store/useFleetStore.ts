import { create } from 'zustand';
import type {
  FleetAsset,
  SpareSwitchConfig,
  SwitchAssignmentRule,
  SwitchRole,
  DiscoveredSwitch,
  MaintenanceRecord,
} from '@shared/types';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const today = new Date();
const daysFromNow = (d: number) => {
  const dt = new Date(today);
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().split('T')[0];
};
const daysAgo = (d: number) => daysFromNow(-d);

const MOCK_ASSETS: FleetAsset[] = [
  {
    id: 'fa-001', mac: '00:50:C2:00:A1:01', serial: 'GC10-2023-0001', model: 'GC-10',
    generation: 2, firmware: '2.5.1', purchaseDate: '2023-01-15', warrantyExpiry: daysFromNow(45),
    currentTourId: 'tour-summer-24', status: 'deployed', location: 'FOH Rack A',
    maintenanceHistory: [{ id: 'mh-001', date: daysAgo(30), type: 'firmware-update', description: 'Updated from 2.4.0 to 2.5.1', performedBy: 'J. Smith' }],
    lastSeen: daysAgo(0),
  },
  {
    id: 'fa-002', mac: '00:50:C2:00:A1:02', serial: 'GC14T-2023-0002', model: 'GC-14t',
    generation: 2, firmware: '2.5.1', purchaseDate: '2023-02-10', warrantyExpiry: daysFromNow(120),
    currentTourId: 'tour-summer-24', status: 'deployed', location: 'Stage Left Rack',
    maintenanceHistory: [], lastSeen: daysAgo(0),
  },
  {
    id: 'fa-003', mac: '00:50:C2:00:A1:03', serial: 'GC16T-2023-0003', model: 'GC-16t',
    generation: 2, firmware: '2.4.0', purchaseDate: '2023-03-20', warrantyExpiry: daysFromNow(80),
    currentTourId: 'tour-summer-24', status: 'deployed', location: 'Stage Right Rack',
    maintenanceHistory: [{ id: 'mh-002', date: daysAgo(90), type: 'inspection', description: 'Routine inspection — all clear', performedBy: 'A. Chen' }],
    lastSeen: daysAgo(0),
  },
  {
    id: 'fa-004', mac: '00:50:C2:00:A1:04', serial: 'GC26I-2023-0004', model: 'GC-26i',
    generation: 2, firmware: '2.5.1', purchaseDate: '2022-11-05', warrantyExpiry: daysFromNow(15),
    status: 'available', location: 'Warehouse Shelf B3',
    maintenanceHistory: [{ id: 'mh-003', date: daysAgo(14), type: 'repair', description: 'Replaced fan module', performedBy: 'D. Martinez', cost: 120 }],
    lastSeen: daysAgo(5),
  },
  {
    id: 'fa-005', mac: '00:50:C2:00:A1:05', serial: 'GC30I-2022-0005', model: 'GC-30i',
    generation: 1, firmware: '2.3.2', purchaseDate: '2022-06-18', warrantyExpiry: daysAgo(30),
    status: 'maintenance', location: 'Repair Bench',
    maintenanceHistory: [{ id: 'mh-004', date: daysAgo(2), type: 'rma', description: 'PSU failure — sent for RMA', performedBy: 'J. Smith' }],
    lastSeen: daysAgo(10),
  },
  {
    id: 'fa-006', mac: '00:50:C2:00:A1:06', serial: 'GC10-2024-0006', model: 'GC-10',
    generation: 2, firmware: '2.5.1', purchaseDate: '2024-01-08', warrantyExpiry: daysFromNow(400),
    currentTourId: 'tour-summer-24', status: 'deployed', location: 'Monitor World',
    maintenanceHistory: [], lastSeen: daysAgo(0),
  },
  {
    id: 'fa-007', mac: '00:50:C2:00:A1:07', serial: 'GC14T-2024-0007', model: 'GC-14t',
    generation: 2, firmware: '2.5.0', purchaseDate: '2024-02-20', warrantyExpiry: daysFromNow(380),
    status: 'available', location: 'Warehouse Shelf A1',
    maintenanceHistory: [], lastSeen: daysAgo(14),
  },
  {
    id: 'fa-008', mac: '00:50:C2:00:A1:08', serial: 'GC16T-2022-0008', model: 'GC-16t',
    generation: 1, firmware: '2.3.2', purchaseDate: '2022-04-12', warrantyExpiry: daysAgo(60),
    status: 'retired', location: 'Storage',
    maintenanceHistory: [{ id: 'mh-005', date: daysAgo(60), type: 'inspection', description: 'End-of-life inspection — retired', performedBy: 'A. Chen' }],
  },
  {
    id: 'fa-009', mac: '00:50:C2:00:A1:09', serial: 'GC26I-2024-0009', model: 'GC-26i',
    generation: 2, firmware: '2.5.1', purchaseDate: '2024-03-15', warrantyExpiry: daysFromNow(365),
    currentTourId: 'tour-summer-24', status: 'deployed', location: 'Broadcast Truck',
    maintenanceHistory: [], lastSeen: daysAgo(0),
  },
  {
    id: 'fa-010', mac: '00:50:C2:00:A1:10', serial: 'GC30I-2024-0010', model: 'GC-30i',
    generation: 2, firmware: '2.5.1', purchaseDate: '2024-04-01', warrantyExpiry: daysFromNow(420),
    currentTourId: 'tour-summer-24', status: 'deployed', location: 'FOH Core',
    maintenanceHistory: [], lastSeen: daysAgo(0),
  },
  {
    id: 'fa-011', mac: '00:50:C2:00:A1:11', serial: 'GC10-2023-0011', model: 'GC-10',
    generation: 2, firmware: '2.4.0', purchaseDate: '2023-08-22', warrantyExpiry: daysFromNow(60),
    status: 'available', location: 'Warehouse Shelf C2',
    maintenanceHistory: [{ id: 'mh-006', date: daysAgo(7), type: 'firmware-update', description: 'Failed update — rolled back to 2.4.0', performedBy: 'D. Martinez' }],
    lastSeen: daysAgo(3),
  },
  {
    id: 'fa-012', mac: '00:50:C2:00:A1:12', serial: 'GC14T-2023-0012', model: 'GC-14t',
    generation: 2, firmware: '2.5.0', purchaseDate: '2023-09-10', warrantyExpiry: daysFromNow(75),
    status: 'rma', location: 'Luminex Service Center',
    maintenanceHistory: [{ id: 'mh-007', date: daysAgo(5), type: 'rma', description: 'PoE controller fault — RMA in progress', performedBy: 'J. Smith' }],
  },
];

const MOCK_SPARES: SpareSwitchConfig[] = [
  {
    id: 'spare-001', spareMAC: '00:50:C2:00:FF:01', spareName: 'SPARE-FOH-01', model: 'GC-30i',
    replacesRole: 'foh-core', preloadedProfileId: 'prof-foh-core', status: 'ready',
    lastVerified: daysAgo(1),
  },
  {
    id: 'spare-002', spareMAC: '00:50:C2:00:FF:02', spareName: 'SPARE-STAGE-01', model: 'GC-14t',
    replacesRole: 'stage-left', preloadedProfileId: 'prof-stage-lr', status: 'ready',
    lastVerified: daysAgo(3),
  },
  {
    id: 'spare-003', spareMAC: '00:50:C2:00:FF:03', spareName: 'SPARE-TRUSS-01', model: 'GC-10',
    replacesRole: 'truss', preloadedProfileId: 'prof-truss', status: 'deployed',
    lastVerified: daysAgo(0),
  },
];

const MOCK_RULES: SwitchAssignmentRule[] = [
  { id: 'rule-001', priority: 1, matchField: 'name',  matchPattern: '^FOH.*CORE',     assignRole: 'foh-core',      assignProfile: 'prof-foh-core' },
  { id: 'rule-002', priority: 2, matchField: 'name',  matchPattern: '^FOH.*DISTRO',   assignRole: 'foh-distro',    assignProfile: 'prof-foh-distro' },
  { id: 'rule-003', priority: 3, matchField: 'name',  matchPattern: '^SL[-_]',        assignRole: 'stage-left' },
  { id: 'rule-004', priority: 4, matchField: 'name',  matchPattern: '^SR[-_]',        assignRole: 'stage-right' },
  { id: 'rule-005', priority: 5, matchField: 'model', matchPattern: 'GC-10',          assignRole: 'truss' },
];

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface FleetState {
  assets: FleetAsset[];
  spares: SpareSwitchConfig[];
  assignmentRules: SwitchAssignmentRule[];

  // Asset CRUD
  addAsset: (asset: FleetAsset) => void;
  updateAsset: (id: string, patch: Partial<FleetAsset>) => void;
  retireAsset: (id: string) => void;

  // Spare CRUD
  registerSpare: (spare: SpareSwitchConfig) => void;
  deploySpare: (id: string) => void;
  returnSpare: (id: string) => void;

  // Rule CRUD
  addRule: (rule: SwitchAssignmentRule) => void;
  updateRule: (id: string, patch: Partial<SwitchAssignmentRule>) => void;
  deleteRule: (id: string) => void;

  // Derived / actions
  autoAssignRoles: (switches: DiscoveredSwitch[]) => Record<string, SwitchRole>;
  getFirmwareSummary: () => Record<string, string[]>;
  getWarrantyAlerts: () => FleetAsset[];
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useFleetStore = create<FleetState>((set, get) => ({
  assets: MOCK_ASSETS,
  spares: MOCK_SPARES,
  assignmentRules: MOCK_RULES,

  // -- Asset CRUD -----------------------------------------------------------

  addAsset: (asset) =>
    set((s) => ({ assets: [...s.assets, asset] })),

  updateAsset: (id, patch) =>
    set((s) => ({
      assets: s.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })),

  retireAsset: (id) =>
    set((s) => ({
      assets: s.assets.map((a) =>
        a.id === id ? { ...a, status: 'retired' as const } : a,
      ),
    })),

  // -- Spare CRUD -----------------------------------------------------------

  registerSpare: (spare) =>
    set((s) => ({ spares: [...s.spares, spare] })),

  deploySpare: (id) =>
    set((s) => ({
      spares: s.spares.map((sp) =>
        sp.id === id ? { ...sp, status: 'deployed' as const } : sp,
      ),
    })),

  returnSpare: (id) =>
    set((s) => ({
      spares: s.spares.map((sp) =>
        sp.id === id ? { ...sp, status: 'ready' as const } : sp,
      ),
    })),

  // -- Rule CRUD ------------------------------------------------------------

  addRule: (rule) =>
    set((s) => ({ assignmentRules: [...s.assignmentRules, rule] })),

  updateRule: (id, patch) =>
    set((s) => ({
      assignmentRules: s.assignmentRules.map((r) =>
        r.id === id ? { ...r, ...patch } : r,
      ),
    })),

  deleteRule: (id) =>
    set((s) => ({
      assignmentRules: s.assignmentRules.filter((r) => r.id !== id),
    })),

  // -- Derived helpers ------------------------------------------------------

  autoAssignRoles: (switches) => {
    const rules = [...get().assignmentRules].sort((a, b) => a.priority - b.priority);
    const result: Record<string, SwitchRole> = {};

    for (const sw of switches) {
      for (const rule of rules) {
        const fieldValue =
          rule.matchField === 'mac'    ? sw.mac :
          rule.matchField === 'serial' ? (sw.serial ?? '') :
          rule.matchField === 'name'   ? sw.name :
          rule.matchField === 'ip'     ? sw.ip :
          rule.matchField === 'model'  ? sw.model : '';

        try {
          if (new RegExp(rule.matchPattern, 'i').test(fieldValue)) {
            result[sw.id] = rule.assignRole;
            break;
          }
        } catch {
          // invalid regex — skip rule
        }
      }
    }
    return result;
  },

  getFirmwareSummary: () => {
    const map: Record<string, string[]> = {};
    for (const a of get().assets) {
      if (a.status === 'retired') continue;
      (map[a.firmware] ??= []).push(a.id);
    }
    return map;
  },

  getWarrantyAlerts: () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 90);
    return get().assets.filter((a) => {
      if (!a.warrantyExpiry || a.status === 'retired') return false;
      return new Date(a.warrantyExpiry) <= cutoff;
    });
  },
}));
