import { create } from 'zustand';
import type {
  OfflineProject,
  VirtualSwitch,
  OfflineNode,
  OfflineLink,
  IPScheme,
  VlanConfig,
  PortConfig,
  SwitchRole,
} from '@shared/types';

// ── Validation types ────────────────────────────────────────────────────────
export interface ValidationIssue {
  id: string;
  severity: 'error' | 'warning';
  message: string;
  nodeId?: string;
}

// ── Store interface ─────────────────────────────────────────────────────────
export interface OfflineState {
  projects: OfflineProject[];
  activeProjectId: string | null;
  selectedNodeId: string | null;
  selectedLinkId: string | null;
  validationIssues: ValidationIssue[];
  linkMode: boolean;
  linkSourceNodeId: string | null;
  linkSourcePort: number | null;

  // Project CRUD
  createProject: (name: string, description?: string) => void;
  deleteProject: (id: string) => void;
  updateProject: (id: string, patch: Partial<Pick<OfflineProject, 'name' | 'description'>>) => void;
  setActiveProject: (id: string) => void;
  getActiveProject: () => OfflineProject | undefined;

  // Virtual switches
  addVirtualSwitch: (vs: VirtualSwitch, node: OfflineNode) => void;
  removeVirtualSwitch: (id: string) => void;
  updateVirtualSwitch: (id: string, patch: Partial<VirtualSwitch>) => void;
  selectNode: (id: string | null) => void;
  moveNode: (id: string, x: number, y: number) => void;

  // Links
  addLink: (link: OfflineLink) => void;
  removeLink: (id: string) => void;
  setLinkMode: (on: boolean) => void;
  setLinkSource: (nodeId: string | null, port: number | null) => void;

  // IP
  setIPScheme: (scheme: Partial<IPScheme>) => void;
  autoAssignIPs: () => void;

  // Export / validate
  exportToShowFile: () => Record<string, unknown> | null;
  validateDesign: () => ValidationIssue[];
}

// ── Helper ──────────────────────────────────────────────────────────────────
function makePorts(count: number): PortConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    port: i + 1,
    vlan: 1,
    poeEnabled: i < count - 2,
    enabled: true,
    label: `Port ${i + 1}`,
  }));
}

const vlanDante: VlanConfig = { id: 10, name: 'Dante Primary', tagged: [], untagged: [] };
const vlanSACN: VlanConfig = { id: 20, name: 'sACN', tagged: [], untagged: [] };
const vlanMgmt: VlanConfig = { id: 1, name: 'Management', tagged: [], untagged: [] };
const vlanComms: VlanConfig = { id: 50, name: 'Comms', tagged: [], untagged: [] };
const vlanNDI: VlanConfig = { id: 30, name: 'NDI Video', tagged: [], untagged: [] };

// ── Mock data — Festival Main Stage ─────────────────────────────────────────
const mockSwitches: VirtualSwitch[] = [
  { id: 'vs-01', name: 'FOH-CORE',    model: 'GC-16Xt',  role: 'foh-core' as SwitchRole,      ip: '10.0.0.1',  portCount: 26, portConfigs: makePorts(26), vlans: [vlanMgmt, vlanDante, vlanSACN, vlanComms, vlanNDI] },
  { id: 'vs-02', name: 'STG-LEFT',    model: 'GC-14R',   role: 'stage-left' as SwitchRole,    ip: '10.0.0.2',  portCount: 14, portConfigs: makePorts(14), vlans: [vlanMgmt, vlanDante, vlanSACN] },
  { id: 'vs-03', name: 'STG-RIGHT',   model: 'GC-14R',   role: 'stage-right' as SwitchRole,   ip: '10.0.0.3',  portCount: 14, portConfigs: makePorts(14), vlans: [vlanMgmt, vlanDante, vlanSACN] },
  { id: 'vs-04', name: 'MON-WORLD',   model: 'GC-16Xt',  role: 'monitor-world' as SwitchRole, ip: '10.0.0.4',  portCount: 18, portConfigs: makePorts(18), vlans: [vlanMgmt, vlanDante, vlanComms] },
  { id: 'vs-05', name: 'TRUSS-DS-L',  model: 'GC-10',    role: 'truss' as SwitchRole,         ip: '10.0.0.5',  portCount: 10, portConfigs: makePorts(10), vlans: [vlanMgmt, vlanSACN] },
  { id: 'vs-06', name: 'TRUSS-DS-R',  model: 'GC-10',    role: 'truss' as SwitchRole,         ip: '10.0.0.6',  portCount: 10, portConfigs: makePorts(10), vlans: [vlanMgmt, vlanSACN] },
  { id: 'vs-07', name: 'TRUSS-US',    model: 'GC-10',    role: 'truss' as SwitchRole,         ip: '10.0.0.7',  portCount: 10, portConfigs: makePorts(10), vlans: [vlanMgmt, vlanSACN] },
  { id: 'vs-08', name: 'DLY-TOWER',   model: 'GC-10',    role: 'delay-tower' as SwitchRole,   ip: '10.0.0.8',  portCount: 10, portConfigs: makePorts(10), vlans: [vlanMgmt, vlanDante] },
];

const mockNodes: OfflineNode[] = [
  { id: 'vs-01', type: 'switch', x: 400, y: 100, label: 'FOH-CORE' },
  { id: 'vs-02', type: 'switch', x: 200, y: 300, label: 'STG-LEFT' },
  { id: 'vs-03', type: 'switch', x: 600, y: 300, label: 'STG-RIGHT' },
  { id: 'vs-04', type: 'switch', x: 400, y: 300, label: 'MON-WORLD' },
  { id: 'vs-05', type: 'switch', x: 150, y: 500, label: 'TRUSS-DS-L' },
  { id: 'vs-06', type: 'switch', x: 650, y: 500, label: 'TRUSS-DS-R' },
  { id: 'vs-07', type: 'switch', x: 400, y: 500, label: 'TRUSS-US' },
  { id: 'vs-08', type: 'switch', x: 400, y: 650, label: 'DLY-TOWER' },
];

const mockLinks: OfflineLink[] = [
  { id: 'lk-01', sourceNodeId: 'vs-01', sourcePort: 25, targetNodeId: 'vs-02', targetPort: 13, cableType: 'fiber-sm', lengthMeters: 75 },
  { id: 'lk-02', sourceNodeId: 'vs-01', sourcePort: 26, targetNodeId: 'vs-03', targetPort: 13, cableType: 'fiber-sm', lengthMeters: 75 },
  { id: 'lk-03', sourceNodeId: 'vs-01', sourcePort: 23, targetNodeId: 'vs-04', targetPort: 11, cableType: 'fiber-sm', lengthMeters: 40 },
  { id: 'lk-04', sourceNodeId: 'vs-02', sourcePort: 14, targetNodeId: 'vs-05', targetPort: 9,  cableType: 'fiber-mm', lengthMeters: 30 },
  { id: 'lk-05', sourceNodeId: 'vs-03', sourcePort: 14, targetNodeId: 'vs-06', targetPort: 9,  cableType: 'fiber-mm', lengthMeters: 30 },
  { id: 'lk-06', sourceNodeId: 'vs-02', sourcePort: 12, targetNodeId: 'vs-07', targetPort: 9,  cableType: 'fiber-mm', lengthMeters: 35 },
  { id: 'lk-07', sourceNodeId: 'vs-01', sourcePort: 21, targetNodeId: 'vs-08', targetPort: 9,  cableType: 'fiber-sm', lengthMeters: 120 },
  { id: 'lk-08', sourceNodeId: 'vs-02', sourcePort: 11, targetNodeId: 'vs-04', targetPort: 12, cableType: 'cat6a',    lengthMeters: 25 },
];

const mockIPScheme: IPScheme = {
  baseSubnet: '10.0.0.0/24',
  vlanSubnets: {
    1: '10.0.0.0/24',
    10: '10.10.0.0/24',
    20: '10.20.0.0/24',
    30: '10.30.0.0/24',
    50: '10.50.0.0/24',
  },
  managementRange: { start: '10.0.0.1', end: '10.0.0.50' },
};

const MOCK_PROJECT: OfflineProject = {
  id: 'op-01',
  name: 'Festival Main Stage',
  description: 'Main stage network design for summer festival — 8 switches, fiber backbone, Dante + sACN',
  virtualSwitches: mockSwitches,
  vlans: [vlanMgmt, vlanDante, vlanSACN, vlanComms, vlanNDI],
  topology: { nodes: mockNodes, links: mockLinks },
  ipScheme: mockIPScheme,
  createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  updatedAt: new Date().toISOString(),
};

// ── Helper to update the active project in the projects array ───────────────
function patchActive(
  state: { projects: OfflineProject[]; activeProjectId: string | null },
  fn: (p: OfflineProject) => OfflineProject,
) {
  return {
    projects: state.projects.map((p) => (p.id === state.activeProjectId ? fn(p) : p)),
  };
}

// ── Zustand Store ───────────────────────────────────────────────────────────
export const useOfflineStore = create<OfflineState>((set, get) => ({
  projects: [MOCK_PROJECT],
  activeProjectId: 'op-01',
  selectedNodeId: null,
  selectedLinkId: null,
  validationIssues: [],
  linkMode: false,
  linkSourceNodeId: null,
  linkSourcePort: null,

  // ---- Project CRUD -------------------------------------------------------
  createProject: (name, description) => {
    const id = `op-${Date.now()}`;
    const now = new Date().toISOString();
    const project: OfflineProject = {
      id,
      name,
      description,
      virtualSwitches: [],
      vlans: [{ id: 1, name: 'Management', tagged: [], untagged: [] }],
      topology: { nodes: [], links: [] },
      ipScheme: { baseSubnet: '10.0.0.0/24', vlanSubnets: { 1: '10.0.0.0/24' }, managementRange: { start: '10.0.0.1', end: '10.0.0.50' } },
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ projects: [...s.projects, project], activeProjectId: id }));
  },

  deleteProject: (id) =>
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      activeProjectId: s.activeProjectId === id ? (s.projects[0]?.id ?? null) : s.activeProjectId,
    })),

  updateProject: (id, patch) =>
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p)),
    })),

  setActiveProject: (id) => set({ activeProjectId: id, selectedNodeId: null, selectedLinkId: null }),

  getActiveProject: () => {
    const { projects, activeProjectId } = get();
    return projects.find((p) => p.id === activeProjectId);
  },

  // ---- Virtual switches ---------------------------------------------------
  addVirtualSwitch: (vs, node) =>
    set((s) => patchActive(s, (p) => ({
      ...p,
      virtualSwitches: [...p.virtualSwitches, vs],
      topology: { ...p.topology, nodes: [...p.topology.nodes, node] },
      updatedAt: new Date().toISOString(),
    }))),

  removeVirtualSwitch: (id) =>
    set((s) => patchActive(s, (p) => ({
      ...p,
      virtualSwitches: p.virtualSwitches.filter((v) => v.id !== id),
      topology: {
        nodes: p.topology.nodes.filter((n) => n.id !== id),
        links: p.topology.links.filter((l) => l.sourceNodeId !== id && l.targetNodeId !== id),
      },
      updatedAt: new Date().toISOString(),
    }))),

  updateVirtualSwitch: (id, patch) =>
    set((s) => patchActive(s, (p) => ({
      ...p,
      virtualSwitches: p.virtualSwitches.map((v) => (v.id === id ? { ...v, ...patch } : v)),
      topology: {
        ...p.topology,
        nodes: p.topology.nodes.map((n) => (n.id === id && patch.name ? { ...n, label: patch.name } : n)),
      },
      updatedAt: new Date().toISOString(),
    }))),

  selectNode: (id) => set({ selectedNodeId: id, selectedLinkId: null }),

  moveNode: (id, x, y) =>
    set((s) => patchActive(s, (p) => ({
      ...p,
      topology: {
        ...p.topology,
        nodes: p.topology.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
      },
    }))),

  // ---- Links --------------------------------------------------------------
  addLink: (link) =>
    set((s) => patchActive(s, (p) => ({
      ...p,
      topology: { ...p.topology, links: [...p.topology.links, link] },
      updatedAt: new Date().toISOString(),
    }))),

  removeLink: (id) =>
    set((s) => patchActive(s, (p) => ({
      ...p,
      topology: { ...p.topology, links: p.topology.links.filter((l) => l.id !== id) },
      updatedAt: new Date().toISOString(),
    }))),

  setLinkMode: (on) => set({ linkMode: on, linkSourceNodeId: null, linkSourcePort: null }),
  setLinkSource: (nodeId, port) => set({ linkSourceNodeId: nodeId, linkSourcePort: port }),

  // ---- IP -----------------------------------------------------------------
  setIPScheme: (scheme) =>
    set((s) => patchActive(s, (p) => ({
      ...p,
      ipScheme: { ...p.ipScheme, ...scheme },
      updatedAt: new Date().toISOString(),
    }))),

  autoAssignIPs: () =>
    set((s) => patchActive(s, (p) => {
      const updated = p.virtualSwitches.map((vs, i) => ({
        ...vs,
        ip: `10.0.0.${i + 1}`,
      }));
      return { ...p, virtualSwitches: updated, updatedAt: new Date().toISOString() };
    })),

  // ---- Export / Validate --------------------------------------------------
  exportToShowFile: () => {
    const proj = get().getActiveProject();
    if (!proj) return null;
    return {
      id: `sf-export-${Date.now()}`,
      name: proj.name,
      description: `Exported from offline design: ${proj.name}`,
      version: 1,
      switches: proj.virtualSwitches.map((vs) => ({
        switchId: vs.id,
        mac: '00:00:00:00:00:00',
        name: vs.name,
        ip: vs.ip,
        role: vs.role,
        portConfigs: vs.portConfigs,
        vlans: vs.vlans,
      })),
      vlans: proj.vlans,
      rackLayout: {
        groups: [],
        connections: proj.topology.links.map((l) => ({
          id: l.id,
          sourceSwitchId: l.sourceNodeId,
          sourcePort: l.sourcePort,
          targetSwitchId: l.targetNodeId,
          targetPort: l.targetPort,
        })),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  validateDesign: () => {
    const proj = get().getActiveProject();
    if (!proj) return [];
    const issues: ValidationIssue[] = [];

    // Check for duplicate IPs
    const ipMap = new Map<string, string>();
    proj.virtualSwitches.forEach((vs) => {
      if (ipMap.has(vs.ip)) {
        issues.push({ id: `val-${issues.length}`, severity: 'error', message: `IP conflict: ${vs.name} and ${ipMap.get(vs.ip)} both use ${vs.ip}`, nodeId: vs.id });
      } else {
        ipMap.set(vs.ip, vs.name);
      }
    });

    // Check for unconnected switches
    const connectedIds = new Set<string>();
    proj.topology.links.forEach((l) => {
      connectedIds.add(l.sourceNodeId);
      connectedIds.add(l.targetNodeId);
    });
    proj.virtualSwitches.forEach((vs) => {
      if (!connectedIds.has(vs.id)) {
        issues.push({ id: `val-${issues.length}`, severity: 'warning', message: `${vs.name} has no connections`, nodeId: vs.id });
      }
    });

    // Check VLAN consistency — each switch should have at least Management VLAN
    proj.virtualSwitches.forEach((vs) => {
      if (!vs.vlans.some((v) => v.id === 1)) {
        issues.push({ id: `val-${issues.length}`, severity: 'warning', message: `${vs.name} is missing Management VLAN (1)`, nodeId: vs.id });
      }
    });

    // Check for switches without a role
    proj.virtualSwitches.forEach((vs) => {
      if (!vs.role) {
        issues.push({ id: `val-${issues.length}`, severity: 'warning', message: `${vs.name} has no role assigned`, nodeId: vs.id });
      }
    });

    set({ validationIssues: issues });
    return issues;
  },
}));
