import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  Monitor,
  Plus,
  Trash2,
  Link2,
  Layout,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Network,
  Settings,
  Cpu,
  Globe,
  Unlink,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FolderPlus,
  FolderOpen,
} from 'lucide-react';
import type { VirtualSwitch, OfflineNode, OfflineLink, SwitchRole, VlanConfig, PortConfig } from '@shared/types';
import { useOfflineStore, type ValidationIssue } from '../store/useOfflineStore';

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const MODELS = ['GC-10', 'GC-14R', 'GC-16Xt', 'GC-16RFO', 'GC-20', 'GC-26', 'GC-30i'];
const MODEL_PORTS: Record<string, number> = { 'GC-10': 10, 'GC-14R': 14, 'GC-16Xt': 26, 'GC-16RFO': 16, 'GC-20': 20, 'GC-26': 26, 'GC-30i': 30 };
const ROLES: (SwitchRole | '')[] = ['', 'foh-core', 'foh-distro', 'stage-left', 'stage-right', 'monitor-world', 'broadcast', 'delay-tower', 'truss', 'floor-distro', 'spare'];

const ROLE_COLORS: Record<string, string> = {
  'foh-core': '#3b82f6', 'foh-distro': '#60a5fa', 'stage-left': '#10b981', 'stage-right': '#10b981',
  'monitor-world': '#f59e0b', 'broadcast': '#ef4444', 'delay-tower': '#a855f7', 'truss': '#f59e0b',
  'floor-distro': '#10b981', 'spare': '#6b7280', '': '#6b7280',
};

const CABLE_TYPE_COLORS: Record<string, string> = {
  'fiber-sm': '#eab308', 'fiber-mm': '#f97316', cat6: '#3b82f6', cat6a: '#06b6d4', coax: '#a855f7', other: '#6b7280',
};

const GRID_SIZE = 20;
const NODE_W = 140;
const NODE_H = 60;

function snap(v: number) { return Math.round(v / GRID_SIZE) * GRID_SIZE; }

// ═══════════════════════════════════════════════════════════════════════════
// Canvas — SVG-based drag-and-drop with zoom/pan
// ═══════════════════════════════════════════════════════════════════════════

function DesignCanvas({
  nodes, links, switches, selectedNodeId, linkMode, linkSourceNodeId,
  onSelectNode, onMoveNode, onNodeClick, zoom, pan,
}: {
  nodes: OfflineNode[];
  links: OfflineLink[];
  switches: VirtualSwitch[];
  selectedNodeId: string | null;
  linkMode: boolean;
  linkSourceNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
  onNodeClick: (id: string) => void;
  zoom: number;
  pan: { x: number; y: number };
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);

  const nodeMap = useMemo(() => {
    const m = new Map<string, OfflineNode>();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  const switchMap = useMemo(() => {
    const m = new Map<string, VirtualSwitch>();
    switches.forEach((s) => m.set(s.id, s));
    return m;
  }, [switches]);

  const svgPoint = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }, [zoom, pan]);

  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    if (linkMode) { onNodeClick(nodeId); return; }
    e.stopPropagation();
    const pt = svgPoint(e.clientX, e.clientY);
    const node = nodeMap.get(nodeId);
    if (!node) return;
    setDragging({ id: nodeId, offsetX: pt.x - node.x, offsetY: pt.y - node.y });
    onSelectNode(nodeId);
  }, [linkMode, onNodeClick, svgPoint, nodeMap, onSelectNode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const pt = svgPoint(e.clientX, e.clientY);
    onMoveNode(dragging.id, snap(pt.x - dragging.offsetX), snap(pt.y - dragging.offsetY));
  }, [dragging, svgPoint, onMoveNode]);

  const handleMouseUp = useCallback(() => setDragging(null), []);

  return (
    <svg
      ref={svgRef}
      className="w-full h-full"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={() => { if (!linkMode) onSelectNode(null); }}
      style={{ cursor: linkMode ? 'crosshair' : dragging ? 'grabbing' : 'default' }}
    >
      {/* Grid pattern */}
      <defs>
        <pattern id="grid" width={GRID_SIZE * zoom} height={GRID_SIZE * zoom} patternUnits="userSpaceOnUse" x={pan.x % (GRID_SIZE * zoom)} y={pan.y % (GRID_SIZE * zoom)}>
          <path d={`M ${GRID_SIZE * zoom} 0 L 0 0 0 ${GRID_SIZE * zoom}`} fill="none" stroke="#1f2937" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />

      <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
        {/* Links */}
        {links.map((link) => {
          const src = nodeMap.get(link.sourceNodeId);
          const tgt = nodeMap.get(link.targetNodeId);
          if (!src || !tgt) return null;
          const x1 = src.x + NODE_W / 2, y1 = src.y + NODE_H / 2;
          const x2 = tgt.x + NODE_W / 2, y2 = tgt.y + NODE_H / 2;
          return (
            <g key={link.id}>
              <line x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={CABLE_TYPE_COLORS[link.cableType] ?? '#6b7280'} strokeWidth={2} strokeDasharray={link.cableType.startsWith('fiber') ? '0' : '6 3'} opacity={0.7} />
              <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle" fontSize={9} fill="#9ca3af">
                {link.cableType} {link.lengthMeters ? `${link.lengthMeters}m` : ''}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const vs = switchMap.get(node.id);
          const role = vs?.role ?? '';
          const color = ROLE_COLORS[role] ?? '#6b7280';
          const selected = selectedNodeId === node.id;
          const isLinkSource = linkSourceNodeId === node.id;

          return (
            <g key={node.id} transform={`translate(${node.x},${node.y})`}
              onMouseDown={(e) => handleMouseDown(e, node.id)}
              style={{ cursor: linkMode ? 'crosshair' : 'grab' }}
            >
              <rect
                width={NODE_W} height={NODE_H} rx={8}
                fill={selected ? '#1e293b' : '#111827'}
                stroke={isLinkSource ? '#f59e0b' : selected ? color : '#374151'}
                strokeWidth={selected || isLinkSource ? 2.5 : 1.5}
              />
              <rect width={4} height={NODE_H} rx={2} fill={color} />
              <text x={16} y={22} fontSize={12} fontWeight={600} fill="white">{node.label}</text>
              <text x={16} y={38} fontSize={9} fill="#9ca3af">{vs?.model ?? 'Unknown'}</text>
              <text x={16} y={50} fontSize={8} fill="#6b7280">{vs?.ip ?? ''}</text>
              {/* Port count badge */}
              <rect x={NODE_W - 30} y={6} width={24} height={16} rx={4} fill={color} opacity={0.2} />
              <text x={NODE_W - 18} y={18} textAnchor="middle" fontSize={9} fill={color} fontWeight={600}>{vs?.portCount ?? 0}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Properties Panel
// ═══════════════════════════════════════════════════════════════════════════

function PropertiesPanel({
  sw, vlans, onUpdate, onDelete,
}: {
  sw: VirtualSwitch;
  vlans: VlanConfig[];
  onUpdate: (id: string, patch: Partial<VirtualSwitch>) => void;
  onDelete: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'general' | 'ports' | 'vlans'>('general');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <h3 className="text-sm font-semibold truncate">{sw.name}</h3>
        <button onClick={() => onDelete(sw.id)} className="p-1 rounded hover:bg-red-600/20 text-gray-500 hover:text-red-400">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 text-xs">
        {(['general', 'ports', 'vlans'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 capitalize transition ${activeTab === tab ? 'text-gc-accent border-b-2 border-gc-accent' : 'text-gray-500 hover:text-gray-300'}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {activeTab === 'general' && (
          <>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Name</label>
              <input value={sw.name} onChange={(e) => onUpdate(sw.id, { name: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gc-accent" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Model</label>
              <select value={sw.model} onChange={(e) => onUpdate(sw.id, { model: e.target.value, portCount: MODEL_PORTS[e.target.value] ?? sw.portCount })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gc-accent">
                {MODELS.map((m) => <option key={m} value={m}>{m} ({MODEL_PORTS[m]}p)</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Role</label>
              <select value={sw.role ?? ''} onChange={(e) => onUpdate(sw.id, { role: (e.target.value || undefined) as SwitchRole | undefined })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gc-accent">
                {ROLES.map((r) => <option key={r} value={r}>{r || '(none)'}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">IP Address</label>
              <input value={sw.ip} onChange={(e) => onUpdate(sw.id, { ip: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-gc-accent" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Port Count</label>
              <input type="number" value={sw.portCount} readOnly
                className="w-full bg-gray-800/50 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-500" />
            </div>
          </>
        )}

        {activeTab === 'ports' && (
          <div className="space-y-1">
            <div className="grid grid-cols-[2rem_1fr_3rem_3rem] gap-1 text-xs text-gray-500 font-medium mb-1 px-1">
              <span>#</span><span>Label</span><span>VLAN</span><span>PoE</span>
            </div>
            {sw.portConfigs.slice(0, sw.portCount).map((pc) => (
              <div key={pc.port} className="grid grid-cols-[2rem_1fr_3rem_3rem] gap-1 items-center text-xs bg-gray-800/40 rounded px-1 py-0.5">
                <span className="text-gray-500">{pc.port}</span>
                <span className="text-gray-300 truncate">{pc.label}</span>
                <span className="text-gray-400">{pc.vlan}</span>
                <span className={pc.poeEnabled ? 'text-emerald-400' : 'text-gray-600'}>{pc.poeEnabled ? 'ON' : '--'}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'vlans' && (
          <div className="space-y-2">
            {sw.vlans.map((v) => (
              <div key={v.id} className="bg-gray-800/40 rounded p-2 border border-gray-700/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{v.name}</span>
                  <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">ID {v.id}</span>
                </div>
              </div>
            ))}
            {sw.vlans.length === 0 && <div className="text-xs text-gray-600 text-center py-4">No VLANs assigned</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// IP Scheme Panel
// ═══════════════════════════════════════════════════════════════════════════

function IPSchemePanel({ onClose }: { onClose: () => void }) {
  const { getActiveProject, setIPScheme, autoAssignIPs } = useOfflineStore();
  const project = getActiveProject();
  if (!project) return null;
  const { ipScheme } = project;

  return (
    <div className="absolute inset-0 bg-gray-900/95 z-20 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-gc-accent" />
          <h3 className="text-sm font-semibold">IP Scheme</h3>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white"><XCircle className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Base Subnet</label>
          <input value={ipScheme.baseSubnet}
            onChange={(e) => setIPScheme({ baseSubnet: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-gc-accent" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Management Range</label>
          <div className="flex gap-2">
            <input value={ipScheme.managementRange.start} placeholder="Start"
              onChange={(e) => setIPScheme({ managementRange: { ...ipScheme.managementRange, start: e.target.value } })}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-gc-accent" />
            <input value={ipScheme.managementRange.end} placeholder="End"
              onChange={(e) => setIPScheme({ managementRange: { ...ipScheme.managementRange, end: e.target.value } })}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-gc-accent" />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-2">VLAN Subnets</label>
          <div className="space-y-2">
            {Object.entries(ipScheme.vlanSubnets).map(([vid, subnet]) => (
              <div key={vid} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-16">VLAN {vid}</span>
                <input value={subnet}
                  onChange={(e) => setIPScheme({ vlanSubnets: { ...ipScheme.vlanSubnets, [vid]: e.target.value } })}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-gc-accent" />
              </div>
            ))}
          </div>
        </div>
        <button onClick={autoAssignIPs}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded bg-gc-accent hover:brightness-110 text-white text-sm font-medium transition">
          <Network className="w-4 h-4" /> Auto-Assign IPs
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Validation Panel
// ═══════════════════════════════════════════════════════════════════════════

function ValidationPanel({ issues, onClose }: { issues: ValidationIssue[]; onClose: () => void }) {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  return (
    <div className="absolute inset-0 bg-gray-900/95 z-20 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-gc-accent" />
          <h3 className="text-sm font-semibold">Validation Results</h3>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white"><XCircle className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-3" />
            <div className="text-sm font-medium text-emerald-400">All checks passed</div>
            <div className="text-xs text-gray-500 mt-1">No issues found in your design</div>
          </div>
        ) : (
          <div className="space-y-2">
            {errors.length > 0 && <div className="text-xs text-red-400 font-medium uppercase tracking-wide mb-1">{errors.length} Error{errors.length > 1 ? 's' : ''}</div>}
            {errors.map((issue) => (
              <div key={issue.id} className="flex items-start gap-2 bg-red-600/10 border border-red-600/20 rounded p-2">
                <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-red-300">{issue.message}</span>
              </div>
            ))}
            {warnings.length > 0 && <div className="text-xs text-amber-400 font-medium uppercase tracking-wide mb-1 mt-3">{warnings.length} Warning{warnings.length > 1 ? 's' : ''}</div>}
            {warnings.map((issue) => (
              <div key={issue.id} className="flex items-start gap-2 bg-amber-600/10 border border-amber-600/20 rounded p-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-amber-300">{issue.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

const OfflineDesignView: React.FC = () => {
  const store = useOfflineStore();
  const {
    projects, activeProjectId, selectedNodeId, validationIssues,
    linkMode, linkSourceNodeId, linkSourcePort,
    setActiveProject, createProject, deleteProject,
    addVirtualSwitch, removeVirtualSwitch, updateVirtualSwitch,
    selectNode, moveNode, addLink, setLinkMode, setLinkSource,
    validateDesign, exportToShowFile, getActiveProject,
  } = store;

  const project = getActiveProject();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [showIPScheme, setShowIPScheme] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const selectedSwitch = useMemo(
    () => project?.virtualSwitches.find((v) => v.id === selectedNodeId) ?? null,
    [project, selectedNodeId],
  );

  // ── Add switch ────────────────────────────────────────────────────────
  const handleAddSwitch = useCallback(() => {
    if (!project) return;
    const id = `vs-${Date.now()}`;
    const idx = project.virtualSwitches.length + 1;
    const vs: VirtualSwitch = {
      id, name: `SW-${String(idx).padStart(2, '0')}`, model: 'GC-14R', ip: `10.0.0.${idx}`,
      portCount: 14,
      portConfigs: Array.from({ length: 14 }, (_, i) => ({ port: i + 1, vlan: 1, poeEnabled: i < 12, enabled: true, label: `Port ${i + 1}` })),
      vlans: [{ id: 1, name: 'Management', tagged: [], untagged: [] }],
    };
    const node: OfflineNode = { id, type: 'switch', x: snap(200 + Math.random() * 300), y: snap(150 + Math.random() * 200), label: vs.name };
    addVirtualSwitch(vs, node);
  }, [project, addVirtualSwitch]);

  // ── Link mode handling ────────────────────────────────────────────────
  const handleNodeClick = useCallback((nodeId: string) => {
    if (!linkMode) return;
    if (!linkSourceNodeId) {
      setLinkSource(nodeId, 1);
    } else if (linkSourceNodeId !== nodeId) {
      const link: OfflineLink = {
        id: `lk-${Date.now()}`,
        sourceNodeId: linkSourceNodeId,
        sourcePort: linkSourcePort ?? 1,
        targetNodeId: nodeId,
        targetPort: 1,
        cableType: 'cat6',
      };
      addLink(link);
      setLinkMode(false);
    }
  }, [linkMode, linkSourceNodeId, linkSourcePort, addLink, setLinkMode, setLinkSource]);

  // ── Auto-layout ───────────────────────────────────────────────────────
  const handleAutoLayout = useCallback(() => {
    if (!project) return;
    const total = project.topology.nodes.length;
    if (total === 0) return;
    // Simple layered layout
    const cols = Math.ceil(Math.sqrt(total));
    project.topology.nodes.forEach((n, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      moveNode(n.id, 80 + col * 200, 80 + row * 140);
    });
  }, [project, moveNode]);

  // ── Export ────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const data = exportToShowFile();
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project?.name ?? 'offline-design'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportToShowFile, project]);

  // ── Validate ──────────────────────────────────────────────────────────
  const handleValidate = useCallback(() => {
    validateDesign();
    setShowValidation(true);
  }, [validateDesign]);

  // ── Create project ────────────────────────────────────────────────────
  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    createProject(newProjectName.trim());
    setNewProjectName('');
    setShowNewProject(false);
  };

  // ── Zoom controls ─────────────────────────────────────────────────────
  const zoomIn = () => setZoom((z) => Math.min(z + 0.15, 2.5));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.15, 0.3));
  const zoomFit = () => { setZoom(1); setPan({ x: 40, y: 40 }); };

  // ── Middle-mouse pan ──────────────────────────────────────────────────
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [isPanning, panStart]);

  const handleCanvasMouseUp = useCallback(() => setIsPanning(false), []);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Monitor className="w-6 h-6 text-gc-accent" />
          <h1 className="text-xl font-bold tracking-tight">Offline Design</h1>
        </div>

        {/* Project selector */}
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-gray-500" />
          <select
            value={activeProjectId ?? ''}
            onChange={(e) => setActiveProject(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gc-accent min-w-[200px]"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button onClick={() => setShowNewProject(true)} className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition">
            <FolderPlus className="w-4 h-4" />
          </button>
          {projects.length > 1 && activeProjectId && (
            <button onClick={() => deleteProject(activeProjectId)} className="p-1.5 rounded hover:bg-red-600/20 text-gray-500 hover:text-red-400 transition">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* New project inline form */}
      {showNewProject && (
        <div className="px-6 py-2 border-b border-gray-800 flex items-center gap-2 bg-gray-800/40">
          <input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Project name..." autoFocus onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm flex-1 max-w-xs focus:outline-none focus:border-gc-accent" />
          <button onClick={handleCreateProject} className="px-3 py-1.5 rounded bg-gc-accent hover:brightness-110 text-white text-sm font-medium">Create</button>
          <button onClick={() => setShowNewProject(false)} className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm">Cancel</button>
        </div>
      )}

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-6 py-2 border-b border-gray-800 bg-gray-900">
        <button onClick={handleAddSwitch} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-sm transition">
          <Plus className="w-3.5 h-3.5" /> Add Switch
        </button>
        <button
          onClick={() => setLinkMode(!linkMode)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm transition ${linkMode ? 'bg-amber-600/20 text-amber-400 border border-amber-600/30' : 'bg-gray-800 hover:bg-gray-700'}`}
        >
          <Link2 className="w-3.5 h-3.5" /> {linkMode ? 'Click two switches...' : 'Add Link'}
        </button>
        {linkMode && (
          <button onClick={() => setLinkMode(false)} className="px-2 py-1.5 rounded text-xs bg-gray-800 hover:bg-gray-700 text-gray-400">Cancel</button>
        )}
        {selectedNodeId && (
          <button onClick={() => removeVirtualSwitch(selectedNodeId)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-red-600/10 text-red-400 hover:bg-red-600/20 text-sm transition">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        )}

        <div className="w-px h-6 bg-gray-700 mx-1" />

        <button onClick={handleAutoLayout} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-sm transition">
          <Layout className="w-3.5 h-3.5" /> Auto-Layout
        </button>
        <button onClick={handleValidate} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-sm transition">
          <AlertTriangle className="w-3.5 h-3.5" /> Validate
        </button>
        <button onClick={() => setShowIPScheme(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-sm transition">
          <Globe className="w-3.5 h-3.5" /> IP Scheme
        </button>
        <button onClick={handleExport} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-sm transition">
          <Download className="w-3.5 h-3.5" /> Export
        </button>

        {/* Zoom controls */}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={zoomOut} className="p-1.5 rounded hover:bg-gray-700 text-gray-500"><ZoomOut className="w-4 h-4" /></button>
          <span className="text-xs text-gray-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={zoomIn} className="p-1.5 rounded hover:bg-gray-700 text-gray-500"><ZoomIn className="w-4 h-4" /></button>
          <button onClick={zoomFit} className="p-1.5 rounded hover:bg-gray-700 text-gray-500"><Maximize2 className="w-4 h-4" /></button>
        </div>
      </div>

      {/* ── Main area ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative bg-gray-950 overflow-hidden"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
        >
          {project ? (
            <DesignCanvas
              nodes={project.topology.nodes}
              links={project.topology.links}
              switches={project.virtualSwitches}
              selectedNodeId={selectedNodeId}
              linkMode={linkMode}
              linkSourceNodeId={linkSourceNodeId}
              onSelectNode={selectNode}
              onMoveNode={moveNode}
              onNodeClick={handleNodeClick}
              zoom={zoom}
              pan={pan}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600">
              <div className="text-center">
                <Monitor className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <div>No project selected. Create one to get started.</div>
              </div>
            </div>
          )}

          {/* Info overlay */}
          {project && (
            <div className="absolute bottom-3 left-3 flex items-center gap-3 text-xs text-gray-600">
              <span>{project.virtualSwitches.length} switches</span>
              <span>{project.topology.links.length} links</span>
              <span>{project.vlans.length} VLANs</span>
            </div>
          )}

          {/* Overlays */}
          {showIPScheme && <IPSchemePanel onClose={() => setShowIPScheme(false)} />}
          {showValidation && <ValidationPanel issues={validationIssues} onClose={() => setShowValidation(false)} />}
        </div>

        {/* ── Properties panel ─────────────────────────────────────────── */}
        <div className="w-72 border-l border-gray-800 bg-gray-900 flex-shrink-0 flex flex-col overflow-hidden">
          {selectedSwitch ? (
            <PropertiesPanel
              sw={selectedSwitch}
              vlans={project?.vlans ?? []}
              onUpdate={updateVirtualSwitch}
              onDelete={(id) => { removeVirtualSwitch(id); selectNode(null); }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-600 p-4">
              <Settings className="w-8 h-8 mb-3 opacity-30" />
              <div className="text-sm text-center">Select a switch on the canvas to view and edit its properties</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfflineDesignView;
