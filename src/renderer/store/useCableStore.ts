import { create } from 'zustand';
import type { CableRun, CableSchedule } from '@shared/types';

// ── Store interface ─────────────────────────────────────────────────────────
export interface CableState {
  schedules: CableSchedule[];
  activeScheduleId: string | null;

  createSchedule: (showFileId: string) => void;
  setActiveSchedule: (id: string) => void;
  addCable: (cable: CableRun) => void;
  updateCable: (id: string, patch: Partial<CableRun>) => void;
  deleteCable: (id: string) => void;
  generateFromTopology: () => void;
  getActiveSchedule: () => CableSchedule | undefined;
  getTotalLength: () => number;
  getCablesByType: () => Record<CableRun['type'], CableRun[]>;
}

// ── Mock cable runs ─────────────────────────────────────────────────────────
const MOCK_CABLES: CableRun[] = [
  { id: 'cb-01', label: 'FOH-STG-F01',  type: 'fiber-sm',  lengthMeters: 75,  sourceSwitchId: 'sw-01', sourcePort: 25, sourceLocation: 'FOH Rack A',     destSwitchId: 'sw-02', destPort: 13, destLocation: 'Stage Left Rack',    pathway: 'Cable tray under stage', status: 'verified' },
  { id: 'cb-02', label: 'FOH-STG-F02',  type: 'fiber-sm',  lengthMeters: 75,  sourceSwitchId: 'sw-01', sourcePort: 26, sourceLocation: 'FOH Rack A',     destSwitchId: 'sw-03', destPort: 13, destLocation: 'Stage Right Rack',   pathway: 'Cable tray under stage', status: 'verified' },
  { id: 'cb-03', label: 'FOH-MON-F01',  type: 'fiber-sm',  lengthMeters: 40,  sourceSwitchId: 'sw-01', sourcePort: 23, sourceLocation: 'FOH Rack A',     destSwitchId: 'sw-04', destPort: 11, destLocation: 'Monitor World',      pathway: 'Snake along SR wall',    status: 'verified' },
  { id: 'cb-04', label: 'STG-MON-C01',  type: 'cat6a',     lengthMeters: 25,  sourceSwitchId: 'sw-02', sourcePort: 11, sourceLocation: 'Stage Left Rack', destSwitchId: 'sw-04', destPort: 12, destLocation: 'Monitor World',      pathway: 'Stage floor box',        status: 'installed' },
  { id: 'cb-05', label: 'FOH-D01',      type: 'cat6',      lengthMeters: 5,   sourceSwitchId: 'sw-01', sourcePort: 1,  sourceLocation: 'FOH Rack A',     destSwitchId: 'sw-10', destPort: 1,  destLocation: 'FOH Console',        pathway: 'Direct patch', status: 'verified', notes: 'Dante Primary — console to core' },
  { id: 'cb-06', label: 'FOH-D02',      type: 'cat6',      lengthMeters: 5,   sourceSwitchId: 'sw-01', sourcePort: 2,  sourceLocation: 'FOH Rack A',     destSwitchId: 'sw-10', destPort: 2,  destLocation: 'FOH Console',        pathway: 'Direct patch', status: 'verified', notes: 'Dante Secondary' },
  { id: 'cb-07', label: 'SL-AMP-01',    type: 'cat6',      lengthMeters: 15,  sourceSwitchId: 'sw-02', sourcePort: 1,  sourceLocation: 'Stage Left Rack', destSwitchId: 'sw-20', destPort: 1,  destLocation: 'SL Amp Rack',        pathway: 'Ramp SR to SL',          status: 'installed' },
  { id: 'cb-08', label: 'SL-AMP-02',    type: 'cat6',      lengthMeters: 15,  sourceSwitchId: 'sw-02', sourcePort: 2,  sourceLocation: 'Stage Left Rack', destSwitchId: 'sw-20', destPort: 2,  destLocation: 'SL Amp Rack',        pathway: 'Ramp SR to SL',          status: 'installed' },
  { id: 'cb-09', label: 'SR-AMP-01',    type: 'cat6',      lengthMeters: 12,  sourceSwitchId: 'sw-03', sourcePort: 1,  sourceLocation: 'Stage Right Rack',destSwitchId: 'sw-21', destPort: 1,  destLocation: 'SR Amp Rack',        pathway: 'Direct run',             status: 'verified' },
  { id: 'cb-10', label: 'SR-AMP-02',    type: 'cat6',      lengthMeters: 12,  sourceSwitchId: 'sw-03', sourcePort: 2,  sourceLocation: 'Stage Right Rack',destSwitchId: 'sw-21', destPort: 2,  destLocation: 'SR Amp Rack',        pathway: 'Direct run',             status: 'verified' },
  { id: 'cb-11', label: 'TRUSS-DS-F01', type: 'fiber-mm',  lengthMeters: 30,  sourceSwitchId: 'sw-02', sourcePort: 14, sourceLocation: 'Stage Left Rack', destSwitchId: 'sw-05', destPort: 9,  destLocation: 'DS Truss Left',      pathway: 'Vertical cable run',     status: 'installed' },
  { id: 'cb-12', label: 'TRUSS-DS-F02', type: 'fiber-mm',  lengthMeters: 30,  sourceSwitchId: 'sw-03', sourcePort: 14, sourceLocation: 'Stage Right Rack',destSwitchId: 'sw-06', destPort: 9,  destLocation: 'DS Truss Right',     pathway: 'Vertical cable run',     status: 'installed' },
  { id: 'cb-13', label: 'TRUSS-US-F01', type: 'fiber-mm',  lengthMeters: 35,  sourceSwitchId: 'sw-02', sourcePort: 12, sourceLocation: 'Stage Left Rack', destSwitchId: 'sw-07', destPort: 9,  destLocation: 'US Truss',           pathway: 'Vertical cable run',     status: 'planned' },
  { id: 'cb-14', label: 'MON-D01',      type: 'cat6',      lengthMeters: 3,   sourceSwitchId: 'sw-04', sourcePort: 1,  sourceLocation: 'Monitor World',   destSwitchId: 'sw-30', destPort: 1,  destLocation: 'Monitor Console',    pathway: 'Direct patch',           status: 'verified' },
  { id: 'cb-15', label: 'MON-D02',      type: 'cat6',      lengthMeters: 3,   sourceSwitchId: 'sw-04', sourcePort: 2,  sourceLocation: 'Monitor World',   destSwitchId: 'sw-30', destPort: 2,  destLocation: 'Monitor Console',    pathway: 'Direct patch',           status: 'verified' },
  { id: 'cb-16', label: 'DLY-TWR-F01',  type: 'fiber-sm',  lengthMeters: 120, sourceSwitchId: 'sw-01', sourcePort: 21, sourceLocation: 'FOH Rack A',     destSwitchId: 'sw-08', destPort: 9,  destLocation: 'Delay Tower 1',      pathway: 'Overhead cable tray',    status: 'planned' },
  { id: 'cb-17', label: 'DLY-TWR-F02',  type: 'fiber-sm',  lengthMeters: 150, sourceSwitchId: 'sw-01', sourcePort: 22, sourceLocation: 'FOH Rack A',     destSwitchId: 'sw-09', destPort: 9,  destLocation: 'Delay Tower 2',      pathway: 'Overhead cable tray',    status: 'planned' },
  { id: 'cb-18', label: 'BCK-VIDEO-01', type: 'cat6a',     lengthMeters: 60,  sourceSwitchId: 'sw-01', sourcePort: 20, sourceLocation: 'FOH Rack A',     destSwitchId: 'sw-11', destPort: 1,  destLocation: 'Broadcast Truck',    pathway: 'House trunking',         status: 'installed', notes: 'NDI video feed' },
  { id: 'cb-19', label: 'FLOOR-BOX-01', type: 'cat6',      lengthMeters: 20,  sourceSwitchId: 'sw-02', sourcePort: 8,  sourceLocation: 'Stage Left Rack', destSwitchId: 'sw-40', destPort: 1,  destLocation: 'Floor Box DS-1',     pathway: 'Under stage',            status: 'installed' },
  { id: 'cb-20', label: 'FLOOR-BOX-02', type: 'cat6',      lengthMeters: 22,  sourceSwitchId: 'sw-03', sourcePort: 8,  sourceLocation: 'Stage Right Rack',destSwitchId: 'sw-41', destPort: 1,  destLocation: 'Floor Box DS-2',     pathway: 'Under stage',            status: 'installed' },
  { id: 'cb-21', label: 'COMMS-01',     type: 'cat6',      lengthMeters: 10,  sourceSwitchId: 'sw-01', sourcePort: 18, sourceLocation: 'FOH Rack A',     destSwitchId: 'sw-50', destPort: 1,  destLocation: 'Comms Rack',         pathway: 'FOH patch panel',        status: 'verified', notes: 'Intercom base station' },
  { id: 'cb-22', label: 'SPARE-01',     type: 'coax',      lengthMeters: 50,  sourceSwitchId: 'sw-01', sourcePort: 19, sourceLocation: 'FOH Rack A',     destSwitchId: 'sw-60', destPort: 1,  destLocation: 'Camera Position 1',  pathway: 'House cable tray',       status: 'planned', notes: 'Backup video return' },
];

const MOCK_SCHEDULE: CableSchedule = {
  id: 'cs-01',
  showFileId: 'sf-100',
  cables: MOCK_CABLES,
  totalLength: MOCK_CABLES.reduce((s, c) => s + c.lengthMeters, 0),
  generatedAt: new Date().toISOString(),
};

// ── Zustand Store ───────────────────────────────────────────────────────────
export const useCableStore = create<CableState>((set, get) => ({
  schedules: [MOCK_SCHEDULE],
  activeScheduleId: 'cs-01',

  createSchedule: (showFileId) => {
    const id = `cs-${Date.now()}`;
    const schedule: CableSchedule = {
      id,
      showFileId,
      cables: [],
      totalLength: 0,
      generatedAt: new Date().toISOString(),
    };
    set((s) => ({ schedules: [...s.schedules, schedule], activeScheduleId: id }));
  },

  setActiveSchedule: (id) => set({ activeScheduleId: id }),

  addCable: (cable) =>
    set((s) => ({
      schedules: s.schedules.map((sch) =>
        sch.id === s.activeScheduleId
          ? { ...sch, cables: [...sch.cables, cable], totalLength: sch.totalLength + cable.lengthMeters }
          : sch,
      ),
    })),

  updateCable: (id, patch) =>
    set((s) => ({
      schedules: s.schedules.map((sch) =>
        sch.id === s.activeScheduleId
          ? {
              ...sch,
              cables: sch.cables.map((c) => (c.id === id ? { ...c, ...patch } : c)),
              totalLength: sch.cables.reduce((sum, c) => sum + (c.id === id ? (patch.lengthMeters ?? c.lengthMeters) : c.lengthMeters), 0),
            }
          : sch,
      ),
    })),

  deleteCable: (id) =>
    set((s) => ({
      schedules: s.schedules.map((sch) =>
        sch.id === s.activeScheduleId
          ? {
              ...sch,
              cables: sch.cables.filter((c) => c.id !== id),
              totalLength: sch.cables.filter((c) => c.id !== id).reduce((sum, c) => sum + c.lengthMeters, 0),
            }
          : sch,
      ),
    })),

  generateFromTopology: () => {
    // In a real app this would read from the rack map store.
    // For now it resets the active schedule to the mock data.
    set((s) => ({
      schedules: s.schedules.map((sch) =>
        sch.id === s.activeScheduleId
          ? { ...sch, cables: MOCK_CABLES, totalLength: MOCK_CABLES.reduce((sum, c) => sum + c.lengthMeters, 0), generatedAt: new Date().toISOString() }
          : sch,
      ),
    }));
  },

  getActiveSchedule: () => {
    const { schedules, activeScheduleId } = get();
    return schedules.find((s) => s.id === activeScheduleId);
  },

  getTotalLength: () => {
    const sch = get().getActiveSchedule();
    return sch ? sch.cables.reduce((s, c) => s + c.lengthMeters, 0) : 0;
  },

  getCablesByType: () => {
    const sch = get().getActiveSchedule();
    const grouped: Record<CableRun['type'], CableRun[]> = {
      cat6: [], cat6a: [], 'fiber-sm': [], 'fiber-mm': [], coax: [], other: [],
    };
    sch?.cables.forEach((c) => grouped[c.type].push(c));
    return grouped;
  },
}));
