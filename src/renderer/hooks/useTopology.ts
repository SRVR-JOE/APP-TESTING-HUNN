import { useMemo, useCallback } from 'react';
import {
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TopologySwitch {
  id: string;
  name: string;
  model: string;
  ip: string;
  mac: string;
  firmware: string;
  healthStatus: 'healthy' | 'warning' | 'critical' | 'offline';
  portCount: number;
  portsUp: number;
  rackGroup?: string;
  role: 'core' | 'distribution' | 'edge';
}

export interface TopologyDevice {
  id: string;
  name: string;
  manufacturer: string;
  protocol: 'Dante' | 'NDI' | 'Art-Net' | 'AES67' | 'unknown';
  ip?: string;
  mac: string;
  connectedSwitchId: string;
  connectedPort: number;
}

export interface TopologyLink {
  id: string;
  sourceSwitchId: string;
  sourcePort: number;
  targetSwitchId: string;
  targetPort: number;
  speed: string;
  status: 'up' | 'down';
  isISL: boolean;
  trunkVlans?: number[];
}

export type LayoutAlgorithm = 'force-directed' | 'hierarchical' | 'circular';
export type ColorMode = 'default' | 'by-model' | 'by-health' | 'by-rack';

// ─── Mock Data ───────────────────────────────────────────────────────────────

export const MOCK_SWITCHES: TopologySwitch[] = [
  {
    id: 'sw-core-1',
    name: 'CORE-01',
    model: 'GC-30i',
    ip: '10.0.0.1',
    mac: '00:50:C2:00:01:01',
    firmware: '2.5.0',
    healthStatus: 'healthy',
    portCount: 30,
    portsUp: 24,
    rackGroup: 'Main Rack',
    role: 'core',
  },
  {
    id: 'sw-dist-1',
    name: 'DIST-FOH',
    model: 'GC-16t',
    ip: '10.0.0.10',
    mac: '00:50:C2:00:02:01',
    firmware: '2.5.0',
    healthStatus: 'healthy',
    portCount: 16,
    portsUp: 12,
    rackGroup: 'FOH Rack',
    role: 'distribution',
  },
  {
    id: 'sw-dist-2',
    name: 'DIST-STAGE',
    model: 'GC-16t',
    ip: '10.0.0.11',
    mac: '00:50:C2:00:02:02',
    firmware: '2.4.1',
    healthStatus: 'warning',
    portCount: 16,
    portsUp: 14,
    rackGroup: 'Stage Rack',
    role: 'distribution',
  },
  {
    id: 'sw-dist-3',
    name: 'DIST-MON',
    model: 'GC-16t',
    ip: '10.0.0.12',
    mac: '00:50:C2:00:02:03',
    firmware: '2.5.0',
    healthStatus: 'healthy',
    portCount: 16,
    portsUp: 10,
    rackGroup: 'Monitor Rack',
    role: 'distribution',
  },
  {
    id: 'sw-edge-1',
    name: 'EDGE-STAGE-L',
    model: 'GC-10i',
    ip: '10.0.0.20',
    mac: '00:50:C2:00:03:01',
    firmware: '2.5.0',
    healthStatus: 'healthy',
    portCount: 10,
    portsUp: 8,
    rackGroup: 'Stage Left',
    role: 'edge',
  },
  {
    id: 'sw-edge-2',
    name: 'EDGE-STAGE-R',
    model: 'GC-10i',
    ip: '10.0.0.21',
    mac: '00:50:C2:00:03:02',
    firmware: '2.3.0',
    healthStatus: 'critical',
    portCount: 10,
    portsUp: 3,
    rackGroup: 'Stage Right',
    role: 'edge',
  },
];

export const MOCK_DEVICES: TopologyDevice[] = [
  {
    id: 'dev-1',
    name: 'FOH Console',
    manufacturer: 'Yamaha',
    protocol: 'Dante',
    ip: '10.0.1.10',
    mac: 'AA:BB:CC:00:01:01',
    connectedSwitchId: 'sw-dist-1',
    connectedPort: 1,
  },
  {
    id: 'dev-2',
    name: 'FOH Recorder',
    manufacturer: 'Focusrite',
    protocol: 'Dante',
    ip: '10.0.1.11',
    mac: 'AA:BB:CC:00:01:02',
    connectedSwitchId: 'sw-dist-1',
    connectedPort: 3,
  },
  {
    id: 'dev-3',
    name: 'NDI Camera 1',
    manufacturer: 'PTZOptics',
    protocol: 'NDI',
    ip: '10.0.1.20',
    mac: 'AA:BB:CC:00:02:01',
    connectedSwitchId: 'sw-dist-1',
    connectedPort: 5,
  },
  {
    id: 'dev-4',
    name: 'Stage Box A',
    manufacturer: 'Yamaha',
    protocol: 'Dante',
    ip: '10.0.2.10',
    mac: 'AA:BB:CC:00:03:01',
    connectedSwitchId: 'sw-dist-2',
    connectedPort: 1,
  },
  {
    id: 'dev-5',
    name: 'Stage Box B',
    manufacturer: 'Yamaha',
    protocol: 'Dante',
    ip: '10.0.2.11',
    mac: 'AA:BB:CC:00:03:02',
    connectedSwitchId: 'sw-dist-2',
    connectedPort: 2,
  },
  {
    id: 'dev-6',
    name: 'NDI Camera 2',
    manufacturer: 'BirdDog',
    protocol: 'NDI',
    ip: '10.0.2.20',
    mac: 'AA:BB:CC:00:04:01',
    connectedSwitchId: 'sw-dist-2',
    connectedPort: 5,
  },
  {
    id: 'dev-7',
    name: 'Monitor Console',
    manufacturer: 'Allen & Heath',
    protocol: 'Dante',
    ip: '10.0.3.10',
    mac: 'AA:BB:CC:00:05:01',
    connectedSwitchId: 'sw-dist-3',
    connectedPort: 1,
  },
  {
    id: 'dev-8',
    name: 'Lighting Desk',
    manufacturer: 'GrandMA',
    protocol: 'Art-Net',
    ip: '10.0.3.20',
    mac: 'AA:BB:CC:00:06:01',
    connectedSwitchId: 'sw-dist-3',
    connectedPort: 4,
  },
  {
    id: 'dev-9',
    name: 'LED Wall Proc',
    manufacturer: 'Novastar',
    protocol: 'Art-Net',
    ip: '10.0.3.21',
    mac: 'AA:BB:CC:00:06:02',
    connectedSwitchId: 'sw-dist-3',
    connectedPort: 5,
  },
  {
    id: 'dev-10',
    name: 'Amp Rack L',
    manufacturer: 'Powersoft',
    protocol: 'Dante',
    ip: '10.0.4.10',
    mac: 'AA:BB:CC:00:07:01',
    connectedSwitchId: 'sw-edge-1',
    connectedPort: 1,
  },
  {
    id: 'dev-11',
    name: 'Amp Rack L2',
    manufacturer: 'Powersoft',
    protocol: 'AES67',
    ip: '10.0.4.11',
    mac: 'AA:BB:CC:00:07:02',
    connectedSwitchId: 'sw-edge-1',
    connectedPort: 2,
  },
  {
    id: 'dev-12',
    name: 'Amp Rack R',
    manufacturer: 'Powersoft',
    protocol: 'Dante',
    ip: '10.0.4.20',
    mac: 'AA:BB:CC:00:08:01',
    connectedSwitchId: 'sw-edge-2',
    connectedPort: 1,
  },
];

export const MOCK_LINKS: TopologyLink[] = [
  // Core to distribution ISL links
  {
    id: 'link-core-dist1',
    sourceSwitchId: 'sw-core-1',
    sourcePort: 1,
    targetSwitchId: 'sw-dist-1',
    targetPort: 15,
    speed: '10G',
    status: 'up',
    isISL: true,
    trunkVlans: [1, 10, 20, 30],
  },
  {
    id: 'link-core-dist2',
    sourceSwitchId: 'sw-core-1',
    sourcePort: 2,
    targetSwitchId: 'sw-dist-2',
    targetPort: 15,
    speed: '10G',
    status: 'up',
    isISL: true,
    trunkVlans: [1, 10, 20, 30],
  },
  {
    id: 'link-core-dist3',
    sourceSwitchId: 'sw-core-1',
    sourcePort: 3,
    targetSwitchId: 'sw-dist-3',
    targetPort: 15,
    speed: '10G',
    status: 'up',
    isISL: true,
    trunkVlans: [1, 10, 20],
  },
  // Distribution to edge ISL links
  {
    id: 'link-dist2-edge1',
    sourceSwitchId: 'sw-dist-2',
    sourcePort: 16,
    targetSwitchId: 'sw-edge-1',
    targetPort: 9,
    speed: '1G',
    status: 'up',
    isISL: true,
    trunkVlans: [1, 10],
  },
  {
    id: 'link-dist2-edge2',
    sourceSwitchId: 'sw-dist-2',
    sourcePort: 14,
    targetSwitchId: 'sw-edge-2',
    targetPort: 9,
    speed: '1G',
    status: 'down',
    isISL: true,
    trunkVlans: [1, 10],
  },
  // Device connections
  {
    id: 'link-dev-1',
    sourceSwitchId: 'sw-dist-1',
    sourcePort: 1,
    targetSwitchId: 'dev-1',
    targetPort: 0,
    speed: '1G',
    status: 'up',
    isISL: false,
  },
  {
    id: 'link-dev-2',
    sourceSwitchId: 'sw-dist-1',
    sourcePort: 3,
    targetSwitchId: 'dev-2',
    targetPort: 0,
    speed: '1G',
    status: 'up',
    isISL: false,
  },
  {
    id: 'link-dev-3',
    sourceSwitchId: 'sw-dist-1',
    sourcePort: 5,
    targetSwitchId: 'dev-3',
    targetPort: 0,
    speed: '1G',
    status: 'up',
    isISL: false,
  },
  {
    id: 'link-dev-4',
    sourceSwitchId: 'sw-dist-2',
    sourcePort: 1,
    targetSwitchId: 'dev-4',
    targetPort: 0,
    speed: '1G',
    status: 'up',
    isISL: false,
  },
  {
    id: 'link-dev-5',
    sourceSwitchId: 'sw-dist-2',
    sourcePort: 2,
    targetSwitchId: 'dev-5',
    targetPort: 0,
    speed: '1G',
    status: 'up',
    isISL: false,
  },
  {
    id: 'link-dev-6',
    sourceSwitchId: 'sw-dist-2',
    sourcePort: 5,
    targetSwitchId: 'dev-6',
    targetPort: 0,
    speed: '1G',
    status: 'up',
    isISL: false,
  },
  {
    id: 'link-dev-7',
    sourceSwitchId: 'sw-dist-3',
    sourcePort: 1,
    targetSwitchId: 'dev-7',
    targetPort: 0,
    speed: '1G',
    status: 'up',
    isISL: false,
  },
  {
    id: 'link-dev-8',
    sourceSwitchId: 'sw-dist-3',
    sourcePort: 4,
    targetSwitchId: 'dev-8',
    targetPort: 0,
    speed: '1G',
    status: 'up',
    isISL: false,
  },
  {
    id: 'link-dev-9',
    sourceSwitchId: 'sw-dist-3',
    sourcePort: 5,
    targetSwitchId: 'dev-9',
    targetPort: 0,
    speed: '1G',
    status: 'up',
    isISL: false,
  },
  {
    id: 'link-dev-10',
    sourceSwitchId: 'sw-edge-1',
    sourcePort: 1,
    targetSwitchId: 'dev-10',
    targetPort: 0,
    speed: '1G',
    status: 'up',
    isISL: false,
  },
  {
    id: 'link-dev-11',
    sourceSwitchId: 'sw-edge-1',
    sourcePort: 2,
    targetSwitchId: 'dev-11',
    targetPort: 0,
    speed: '1G',
    status: 'up',
    isISL: false,
  },
  {
    id: 'link-dev-12',
    sourceSwitchId: 'sw-edge-2',
    sourcePort: 1,
    targetSwitchId: 'dev-12',
    targetPort: 0,
    speed: '1G',
    status: 'up',
    isISL: false,
  },
];

// ─── Layout Algorithms ───────────────────────────────────────────────────────

const SWITCH_W = 200;
const SWITCH_H = 110;
const DEVICE_W = 130;
const DEVICE_H = 64;

function hierarchicalLayout(
  switches: TopologySwitch[],
  devices: TopologyDevice[],
  showDevices: boolean,
): { switchPositions: Record<string, { x: number; y: number }>; devicePositions: Record<string, { x: number; y: number }> } {
  const tiers: Record<string, TopologySwitch[]> = { core: [], distribution: [], edge: [] };
  switches.forEach((sw) => tiers[sw.role].push(sw));

  const switchPositions: Record<string, { x: number; y: number }> = {};
  const centerX = 600;

  // Core tier
  tiers.core.forEach((sw, i) => {
    const total = tiers.core.length;
    const spacing = 280;
    switchPositions[sw.id] = {
      x: centerX - ((total - 1) * spacing) / 2 + i * spacing,
      y: 40,
    };
  });

  // Distribution tier
  tiers.distribution.forEach((sw, i) => {
    const total = tiers.distribution.length;
    const spacing = 320;
    switchPositions[sw.id] = {
      x: centerX - ((total - 1) * spacing) / 2 + i * spacing,
      y: 220,
    };
  });

  // Edge tier
  tiers.edge.forEach((sw, i) => {
    const total = tiers.edge.length;
    const spacing = 360;
    switchPositions[sw.id] = {
      x: centerX - ((total - 1) * spacing) / 2 + i * spacing,
      y: 400,
    };
  });

  // Devices positioned below their connected switch
  const devicePositions: Record<string, { x: number; y: number }> = {};
  if (showDevices) {
    const devicesBySwitch: Record<string, TopologyDevice[]> = {};
    devices.forEach((d) => {
      if (!devicesBySwitch[d.connectedSwitchId]) devicesBySwitch[d.connectedSwitchId] = [];
      devicesBySwitch[d.connectedSwitchId].push(d);
    });

    Object.entries(devicesBySwitch).forEach(([switchId, devs]) => {
      const swPos = switchPositions[switchId];
      if (!swPos) return;
      const spacing = 160;
      devs.forEach((d, i) => {
        devicePositions[d.id] = {
          x: swPos.x - ((devs.length - 1) * spacing) / 2 + i * spacing,
          y: swPos.y + 180,
        };
      });
    });
  }

  return { switchPositions, devicePositions };
}

function circularLayout(
  switches: TopologySwitch[],
  devices: TopologyDevice[],
  showDevices: boolean,
): { switchPositions: Record<string, { x: number; y: number }>; devicePositions: Record<string, { x: number; y: number }> } {
  const centerX = 600;
  const centerY = 400;
  const switchRadius = 250;
  const deviceRadius = 420;

  const switchPositions: Record<string, { x: number; y: number }> = {};
  switches.forEach((sw, i) => {
    const angle = (2 * Math.PI * i) / switches.length - Math.PI / 2;
    switchPositions[sw.id] = {
      x: centerX + switchRadius * Math.cos(angle) - SWITCH_W / 2,
      y: centerY + switchRadius * Math.sin(angle) - SWITCH_H / 2,
    };
  });

  const devicePositions: Record<string, { x: number; y: number }> = {};
  if (showDevices) {
    devices.forEach((d, i) => {
      const angle = (2 * Math.PI * i) / devices.length - Math.PI / 2;
      devicePositions[d.id] = {
        x: centerX + deviceRadius * Math.cos(angle) - DEVICE_W / 2,
        y: centerY + deviceRadius * Math.sin(angle) - DEVICE_H / 2,
      };
    });
  }

  return { switchPositions, devicePositions };
}

function forceDirectedLayout(
  switches: TopologySwitch[],
  devices: TopologyDevice[],
  links: TopologyLink[],
  showDevices: boolean,
): { switchPositions: Record<string, { x: number; y: number }>; devicePositions: Record<string, { x: number; y: number }> } {
  // Simple force-directed using iterative spring/repulsion simulation
  const positions: Record<string, { x: number; y: number }> = {};
  const allIds: string[] = [...switches.map((s) => s.id)];
  if (showDevices) allIds.push(...devices.map((d) => d.id));

  // Initialize random positions
  allIds.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / allIds.length;
    const radius = 200 + Math.random() * 100;
    positions[id] = {
      x: 600 + radius * Math.cos(angle),
      y: 400 + radius * Math.sin(angle),
    };
  });

  // Gather edges
  const edges: { source: string; target: string }[] = [];
  links.forEach((l) => {
    if (allIds.includes(l.sourceSwitchId) && allIds.includes(l.targetSwitchId)) {
      edges.push({ source: l.sourceSwitchId, target: l.targetSwitchId });
    }
  });

  // Iterate
  const iterations = 80;
  const repulsion = 30000;
  const attraction = 0.005;
  const damping = 0.9;

  const velocities: Record<string, { vx: number; vy: number }> = {};
  allIds.forEach((id) => (velocities[id] = { vx: 0, vy: 0 }));

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion between all nodes
    for (let i = 0; i < allIds.length; i++) {
      for (let j = i + 1; j < allIds.length; j++) {
        const a = positions[allIds[i]];
        const b = positions[allIds[j]];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        velocities[allIds[i]].vx += fx;
        velocities[allIds[i]].vy += fy;
        velocities[allIds[j]].vx -= fx;
        velocities[allIds[j]].vy -= fy;
      }
    }

    // Attraction along edges
    edges.forEach(({ source, target }) => {
      const a = positions[source];
      const b = positions[target];
      if (!a || !b) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const fx = dx * attraction;
      const fy = dy * attraction;
      velocities[source].vx += fx;
      velocities[source].vy += fy;
      velocities[target].vx -= fx;
      velocities[target].vy -= fy;
    });

    // Apply velocities
    allIds.forEach((id) => {
      positions[id].x += velocities[id].vx;
      positions[id].y += velocities[id].vy;
      velocities[id].vx *= damping;
      velocities[id].vy *= damping;
    });
  }

  const switchIds = new Set(switches.map((s) => s.id));
  const switchPositions: Record<string, { x: number; y: number }> = {};
  const devicePositions: Record<string, { x: number; y: number }> = {};

  Object.entries(positions).forEach(([id, pos]) => {
    if (switchIds.has(id)) {
      switchPositions[id] = pos;
    } else {
      devicePositions[id] = pos;
    }
  });

  return { switchPositions, devicePositions };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTopology(
  switches: TopologySwitch[],
  devices: TopologyDevice[],
  links: TopologyLink[],
  layout: LayoutAlgorithm,
  colorMode: ColorMode,
  showDevices: boolean,
  showLabels: boolean,
) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    // Compute positions based on layout algorithm
    let positions: { switchPositions: Record<string, { x: number; y: number }>; devicePositions: Record<string, { x: number; y: number }> };

    switch (layout) {
      case 'hierarchical':
        positions = hierarchicalLayout(switches, devices, showDevices);
        break;
      case 'circular':
        positions = circularLayout(switches, devices, showDevices);
        break;
      case 'force-directed':
      default:
        positions = forceDirectedLayout(switches, devices, links, showDevices);
        break;
    }

    // Build switch nodes
    const switchNodes: Node[] = switches.map((sw) => ({
      id: sw.id,
      type: 'switchNode',
      position: positions.switchPositions[sw.id] ?? { x: 0, y: 0 },
      data: {
        name: sw.name,
        model: sw.model,
        ip: sw.ip,
        healthStatus: sw.healthStatus,
        portCount: sw.portCount,
        portsUp: sw.portsUp,
        rackGroup: sw.rackGroup,
        firmware: sw.firmware,
        colorMode,
        showLabels,
      },
    }));

    // Build device nodes
    const deviceNodes: Node[] = showDevices
      ? devices.map((d) => ({
          id: d.id,
          type: 'deviceNode',
          position: positions.devicePositions[d.id] ?? { x: 0, y: 0 },
          data: {
            name: d.name,
            manufacturer: d.manufacturer,
            protocol: d.protocol,
            ip: d.ip,
            mac: d.mac,
            showLabels,
          },
        }))
      : [];

    // Build edges
    const edgeList: Edge[] = links
      .filter((l) => {
        if (l.isISL) return true;
        return showDevices;
      })
      .map((l) => ({
        id: l.id,
        source: l.sourceSwitchId,
        target: l.targetSwitchId,
        type: 'linkEdge',
        data: {
          sourcePort: l.sourcePort,
          targetPort: l.targetPort,
          speed: l.speed,
          status: l.status,
          isISL: l.isISL,
          trunkVlans: l.trunkVlans,
          showLabels,
        },
        markerEnd: l.isISL
          ? undefined
          : { type: MarkerType.ArrowClosed, width: 12, height: 12, color: '#6b7280' },
      }));

    return { nodes: [...switchNodes, ...deviceNodes], edges: edgeList };
  }, [switches, devices, links, layout, colorMode, showDevices, showLabels]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Re-sync when inputs change
  const refreshLayout = useCallback(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    refreshLayout,
  };
}
