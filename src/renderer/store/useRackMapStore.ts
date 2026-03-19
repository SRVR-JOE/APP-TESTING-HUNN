import { create } from 'zustand';

// ─── Types ───────────────────────────────────────────────────────────────────

import type { LocationType } from '@shared/types';

export interface RackGroupData {
  id: string;
  name: string;
  color: string;
  positionX: number;
  positionY: number;
  width: number;
  locationType?: LocationType;
}

export interface MiniPortInfo {
  port: number;
  status: 'up' | 'down' | 'error';
  type: 'copper' | 'sfp';
  groupColor?: string;
  poeWatts?: number;
  vlanId?: number;
}

export interface SwitchInRack {
  id: string;
  name: string;
  model: string;
  ip: string;
  healthStatus: 'healthy' | 'warning' | 'critical' | 'offline';
  portsUp: number;
  portCount: number;
  poeDrawWatts?: number;
  poeBudgetWatts?: number;
  ports: MiniPortInfo[];
  trafficMbps?: number;
}

export interface ISLLinkData {
  id: string;
  sourceGroupId: string;
  targetGroupId: string;
  sourcePort: number;
  targetPort: number;
  speed: string;
  status: 'up' | 'down';
}

export type OverlayMode = 'default' | 'poe' | 'health' | 'traffic' | 'vlan';

// ─── State Interface ─────────────────────────────────────────────────────────

export interface BackgroundImage {
  dataUrl: string;           // base64 data URL of the image
  fileName: string;          // original file name
  width: number;             // natural width in px
  height: number;            // natural height in px
  opacity: number;           // 0–1 opacity
  positionX: number;         // position on canvas
  positionY: number;         // position on canvas
  scale: number;             // display scale multiplier
  locked: boolean;           // if true, cannot be dragged
}

export interface RackMapState {
  rackGroups: RackGroupData[];
  switchAssignments: Record<string, string>; // switchId → groupId
  allSwitches: SwitchInRack[];
  islLinks: ISLLinkData[];
  zoom: number;
  panX: number;
  panY: number;
  overlayMode: OverlayMode;
  selectedGroupId: string | null;
  layoutName: string;
  isDirty: boolean;
  sidebarOpen: boolean;
  backgroundImage: BackgroundImage | null;

  // Actions
  addRackGroup: (name: string) => void;
  removeRackGroup: (id: string) => void;
  updateRackGroup: (id: string, updates: Partial<RackGroupData>) => void;
  moveRackGroup: (id: string, x: number, y: number) => void;
  assignSwitch: (switchId: string, groupId: string) => void;
  unassignSwitch: (switchId: string) => void;
  reorderSwitch: (groupId: string, switchId: string, newIndex: number) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  setOverlayMode: (mode: OverlayMode) => void;
  setSelectedGroup: (id: string | null) => void;
  setLayoutName: (name: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setBackgroundImage: (image: BackgroundImage | null) => void;
  updateBackgroundImage: (updates: Partial<BackgroundImage>) => void;
  saveLayout: () => void;
  loadLayout: (layout: SavedLayout) => void;
  exportJSON: () => string;
}

export interface SavedLayout {
  layoutName: string;
  rackGroups: RackGroupData[];
  switchAssignments: Record<string, string>;
  backgroundImage?: BackgroundImage | null;
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

function generatePorts(count: number, upCount: number, type: 'copper' | 'sfp' = 'copper'): MiniPortInfo[] {
  const ports: MiniPortInfo[] = [];
  const vlanColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  for (let i = 1; i <= count; i++) {
    const isUp = i <= upCount;
    ports.push({
      port: i,
      status: isUp ? 'up' : 'down',
      type: i > count - 4 ? 'sfp' : type,
      groupColor: isUp ? vlanColors[i % vlanColors.length] : undefined,
      poeWatts: isUp && type === 'copper' ? Math.floor(Math.random() * 25) + 3 : undefined,
      vlanId: isUp ? (i % 4) + 1 : undefined,
    });
  }
  return ports;
}

const MOCK_SWITCHES: SwitchInRack[] = [
  {
    id: 'sw-foh-core',
    name: 'FOH-CORE',
    model: 'GC-30i',
    ip: '10.0.1.1',
    healthStatus: 'healthy',
    portsUp: 20,
    portCount: 30,
    poeDrawWatts: 180,
    poeBudgetWatts: 370,
    ports: generatePorts(30, 20),
    trafficMbps: 450,
  },
  {
    id: 'sw-foh-aux',
    name: 'FOH-AUX',
    model: 'GC-16t',
    ip: '10.0.1.2',
    healthStatus: 'healthy',
    portsUp: 12,
    portCount: 16,
    poeDrawWatts: 45,
    poeBudgetWatts: 185,
    ports: generatePorts(16, 12),
    trafficMbps: 120,
  },
  {
    id: 'sw-sl-main',
    name: 'SL-MAIN',
    model: 'GC-14t',
    ip: '10.0.2.1',
    healthStatus: 'warning',
    portsUp: 10,
    portCount: 14,
    poeDrawWatts: 92,
    poeBudgetWatts: 150,
    ports: generatePorts(14, 10),
    trafficMbps: 85,
  },
  {
    id: 'sw-sl-stage',
    name: 'SL-STAGE',
    model: 'GC-10',
    ip: '10.0.2.2',
    healthStatus: 'healthy',
    portsUp: 7,
    portCount: 10,
    ports: generatePorts(10, 7),
    trafficMbps: 60,
  },
  {
    id: 'sw-mon-main',
    name: 'MON-MAIN',
    model: 'GC-30i',
    ip: '10.0.3.1',
    healthStatus: 'healthy',
    portsUp: 18,
    portCount: 30,
    poeDrawWatts: 210,
    poeBudgetWatts: 370,
    ports: generatePorts(30, 18),
    trafficMbps: 380,
  },
  {
    id: 'sw-mon-wedge',
    name: 'MON-WEDGE',
    model: 'GC-16t',
    ip: '10.0.3.2',
    healthStatus: 'critical',
    portsUp: 4,
    portCount: 16,
    poeDrawWatts: 155,
    poeBudgetWatts: 185,
    ports: generatePorts(16, 4),
    trafficMbps: 25,
  },
  {
    id: 'sw-bx-main',
    name: 'BX-MAIN',
    model: 'GC-14t',
    ip: '10.0.4.1',
    healthStatus: 'healthy',
    portsUp: 11,
    portCount: 14,
    poeDrawWatts: 68,
    poeBudgetWatts: 150,
    ports: generatePorts(14, 11),
    trafficMbps: 200,
  },
  {
    id: 'sw-bx-feed',
    name: 'BX-FEED',
    model: 'GC-10',
    ip: '10.0.4.2',
    healthStatus: 'offline',
    portsUp: 0,
    portCount: 10,
    ports: generatePorts(10, 0),
    trafficMbps: 0,
  },
];

const MOCK_GROUPS: RackGroupData[] = [
  { id: 'grp-foh', name: 'FOH Rack A', color: '#3b82f6', positionX: 80, positionY: 80, width: 340 },
  { id: 'grp-sl', name: 'Stage Left', color: '#10b981', positionX: 500, positionY: 80, width: 340 },
  { id: 'grp-mon', name: 'Monitor World', color: '#f59e0b', positionX: 80, positionY: 500, width: 340 },
  { id: 'grp-bx', name: 'Broadcast Truck', color: '#ef4444', positionX: 500, positionY: 500, width: 340 },
];

const MOCK_ASSIGNMENTS: Record<string, string> = {
  'sw-foh-core': 'grp-foh',
  'sw-foh-aux': 'grp-foh',
  'sw-sl-main': 'grp-sl',
  'sw-sl-stage': 'grp-sl',
  'sw-mon-main': 'grp-mon',
  'sw-mon-wedge': 'grp-mon',
  'sw-bx-main': 'grp-bx',
  'sw-bx-feed': 'grp-bx',
};

const MOCK_ISL_LINKS: ISLLinkData[] = [
  {
    id: 'isl-foh-sl',
    sourceGroupId: 'grp-foh',
    targetGroupId: 'grp-sl',
    sourcePort: 25,
    targetPort: 25,
    speed: '10G',
    status: 'up',
  },
  {
    id: 'isl-foh-mon',
    sourceGroupId: 'grp-foh',
    targetGroupId: 'grp-mon',
    sourcePort: 26,
    targetPort: 26,
    speed: '10G',
    status: 'up',
  },
  {
    id: 'isl-foh-bx',
    sourceGroupId: 'grp-foh',
    targetGroupId: 'grp-bx',
    sourcePort: 27,
    targetPort: 25,
    speed: '1G',
    status: 'down',
  },
];

// ─── Store ───────────────────────────────────────────────────────────────────

let nextGroupId = 5;

export const useRackMapStore = create<RackMapState>((set, get) => ({
  rackGroups: MOCK_GROUPS,
  switchAssignments: MOCK_ASSIGNMENTS,
  allSwitches: MOCK_SWITCHES,
  islLinks: MOCK_ISL_LINKS,
  zoom: 1,
  panX: 0,
  panY: 0,
  overlayMode: 'default',
  selectedGroupId: null,
  layoutName: 'Main Show Layout',
  isDirty: false,
  sidebarOpen: true,
  backgroundImage: null,

  addRackGroup: (name: string) => {
    const id = `grp-${nextGroupId++}`;
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    const state = get();
    set({
      rackGroups: [
        ...state.rackGroups,
        {
          id,
          name,
          color: colors[state.rackGroups.length % colors.length],
          positionX: 200 + Math.random() * 200,
          positionY: 200 + Math.random() * 200,
          width: 340,
        },
      ],
      isDirty: true,
    });
  },

  removeRackGroup: (id: string) => {
    const state = get();
    const newAssignments = { ...state.switchAssignments };
    // Unassign switches from deleted group
    for (const [swId, grpId] of Object.entries(newAssignments)) {
      if (grpId === id) delete newAssignments[swId];
    }
    set({
      rackGroups: state.rackGroups.filter((g) => g.id !== id),
      switchAssignments: newAssignments,
      selectedGroupId: state.selectedGroupId === id ? null : state.selectedGroupId,
      isDirty: true,
    });
  },

  updateRackGroup: (id: string, updates: Partial<RackGroupData>) => {
    set((state) => ({
      rackGroups: state.rackGroups.map((g) => (g.id === id ? { ...g, ...updates } : g)),
      isDirty: true,
    }));
  },

  moveRackGroup: (id: string, x: number, y: number) => {
    set((state) => ({
      rackGroups: state.rackGroups.map((g) =>
        g.id === id ? { ...g, positionX: x, positionY: y } : g
      ),
      isDirty: true,
    }));
  },

  assignSwitch: (switchId: string, groupId: string) => {
    set((state) => ({
      switchAssignments: { ...state.switchAssignments, [switchId]: groupId },
      isDirty: true,
    }));
  },

  unassignSwitch: (switchId: string) => {
    set((state) => {
      const newAssignments = { ...state.switchAssignments };
      delete newAssignments[switchId];
      return { switchAssignments: newAssignments, isDirty: true };
    });
  },

  reorderSwitch: (_groupId: string, _switchId: string, _newIndex: number) => {
    // Reordering is visual-only in this implementation
    set({ isDirty: true });
  },

  setZoom: (zoom: number) => set({ zoom: Math.max(0.2, Math.min(3, zoom)) }),

  setPan: (x: number, y: number) => set({ panX: x, panY: y }),

  setOverlayMode: (mode: OverlayMode) => set({ overlayMode: mode }),

  setSelectedGroup: (id: string | null) => set({ selectedGroupId: id }),

  setLayoutName: (name: string) => set({ layoutName: name, isDirty: true }),

  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),

  setBackgroundImage: (image: BackgroundImage | null) => set({ backgroundImage: image, isDirty: true }),

  updateBackgroundImage: (updates: Partial<BackgroundImage>) => {
    set((state) => ({
      backgroundImage: state.backgroundImage
        ? { ...state.backgroundImage, ...updates }
        : null,
      isDirty: true,
    }));
  },

  saveLayout: () => {
    const state = get();
    const layout: SavedLayout = {
      layoutName: state.layoutName,
      rackGroups: state.rackGroups,
      switchAssignments: state.switchAssignments,
      backgroundImage: state.backgroundImage,
    };
    try {
      localStorage.setItem('rackMapLayout', JSON.stringify(layout));
    } catch {
      // silently fail
    }
    set({ isDirty: false });
  },

  loadLayout: (layout: SavedLayout) => {
    set({
      layoutName: layout.layoutName,
      rackGroups: layout.rackGroups,
      switchAssignments: layout.switchAssignments,
      backgroundImage: layout.backgroundImage ?? null,
      isDirty: false,
    });
  },

  exportJSON: () => {
    const state = get();
    return JSON.stringify(
      {
        layoutName: state.layoutName,
        rackGroups: state.rackGroups,
        switchAssignments: state.switchAssignments,
        islLinks: state.islLinks,
        backgroundImage: state.backgroundImage,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
  },
}));
