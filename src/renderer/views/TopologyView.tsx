import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  RefreshCw,
  Eye,
  EyeOff,
  Tag,
  Tags,
  Image,
  FileCode,
  ZoomIn,
  ZoomOut,
  Maximize,
  Network,
} from 'lucide-react';

import { SwitchNode } from '../components/topology/SwitchNode';
import { DeviceNode } from '../components/topology/DeviceNode';
import { LinkEdge } from '../components/topology/LinkEdge';
import {
  TopologyDetailPanel,
  type SelectedElement,
} from '../components/topology/TopologyDetailPanel';
import {
  useTopology,
  MOCK_SWITCHES,
  MOCK_DEVICES,
  MOCK_LINKS,
  type LayoutAlgorithm,
  type ColorMode,
  type TopologySwitch,
  type TopologyDevice,
  type TopologyLink,
} from '../hooks/useTopology';

// ─── Node / Edge type registrations ──────────────────────────────────────────

const nodeTypes = {
  switchNode: SwitchNode,
  deviceNode: DeviceNode,
};

const edgeTypes = {
  linkEdge: LinkEdge,
};

// ─── Layout Options ──────────────────────────────────────────────────────────

const LAYOUT_OPTIONS: { value: LayoutAlgorithm; label: string }[] = [
  { value: 'force-directed', label: 'Force-directed' },
  { value: 'hierarchical', label: 'Hierarchical' },
  { value: 'circular', label: 'Circular' },
];

const COLOR_OPTIONS: { value: ColorMode; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'by-model', label: 'By Model' },
  { value: 'by-health', label: 'By Health' },
  { value: 'by-rack', label: 'By Rack Group' },
];

// ─── Toolbar Button Component ────────────────────────────────────────────────

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`
        flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md
        transition-colors duration-150
        ${
          active
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
        }
      `}
    >
      {children}
    </button>
  );
}

// ─── Inner Flow Component (needs ReactFlowProvider parent) ───────────────────

function TopologyFlowInner() {
  const [layout, setLayout] = useState<LayoutAlgorithm>('hierarchical');
  const [colorMode, setColorMode] = useState<ColorMode>('default');
  const [showDevices, setShowDevices] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  const { nodes, edges, onNodesChange, onEdgesChange, refreshLayout } = useTopology(
    MOCK_SWITCHES,
    MOCK_DEVICES,
    MOCK_LINKS,
    layout,
    colorMode,
    showDevices,
    showLabels,
  );

  // Refresh layout when algorithm changes
  useEffect(() => {
    refreshLayout();
    setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 50);
  }, [layout, showDevices, refreshLayout, fitView]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    refreshLayout();
    setTimeout(() => {
      fitView({ padding: 0.15, duration: 300 });
      setIsRefreshing(false);
    }, 400);
  }, [refreshLayout, fitView]);

  // Node click handler
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const sw = MOCK_SWITCHES.find((s) => s.id === node.id);
      if (sw) {
        setSelectedElement({ type: 'switch', data: sw });
        return;
      }
      const dev = MOCK_DEVICES.find((d) => d.id === node.id);
      if (dev) {
        setSelectedElement({ type: 'device', data: dev });
      }
    },
    [],
  );

  // Edge click handler
  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      const link = MOCK_LINKS.find((l) => l.id === edge.id);
      if (link) {
        setSelectedElement({ type: 'link', data: link });
      }
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    setSelectedElement(null);
  }, []);

  const handleViewDetails = useCallback((switchId: string) => {
    // In real app, navigate to device detail view
    console.log('Navigate to switch detail:', switchId);
  }, []);

  // Export PNG
  const handleExportPNG = useCallback(() => {
    const svgEl = reactFlowWrapper.current?.querySelector('.react-flow__renderer svg') as SVGElement | null;
    if (!svgEl) {
      // Fallback: use html2canvas-style approach with the viewport
      const viewport = reactFlowWrapper.current?.querySelector('.react-flow__viewport') as HTMLElement | null;
      if (!viewport) return;
      // Create a notification that export is not available in mock mode
      console.log('PNG export: would capture the current viewport');
      return;
    }
  }, []);

  // Export SVG
  const handleExportSVG = useCallback(() => {
    console.log('SVG export: would serialize the React Flow SVG');
  }, []);

  // MiniMap node color
  const miniMapNodeColor = useCallback((node: Node) => {
    if (node.type === 'switchNode') {
      const hs = node.data?.healthStatus;
      if (hs === 'critical') return '#ef4444';
      if (hs === 'warning') return '#eab308';
      return '#3b82f6';
    }
    return '#6b7280';
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-800/80 border-b border-gray-700 flex-wrap">
        {/* Refresh */}
        <ToolbarButton onClick={handleRefresh} title="Refresh Topology">
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </ToolbarButton>

        {/* Separator */}
        <div className="w-px h-6 bg-gray-600" />

        {/* Layout selector */}
        <div className="flex items-center gap-1">
          <Network size={14} className="text-gray-400" />
          <select
            value={layout}
            onChange={(e) => setLayout(e.target.value as LayoutAlgorithm)}
            className="bg-gray-700 text-gray-200 text-xs rounded-md px-2 py-1.5 border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {LAYOUT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-gray-600" />

        {/* Show Devices toggle */}
        <ToolbarButton
          onClick={() => setShowDevices((v) => !v)}
          active={showDevices}
          title={showDevices ? 'Hide Devices' : 'Show Devices'}
        >
          {showDevices ? <Eye size={14} /> : <EyeOff size={14} />}
          <span className="hidden sm:inline">Devices</span>
        </ToolbarButton>

        {/* Show Labels toggle */}
        <ToolbarButton
          onClick={() => setShowLabels((v) => !v)}
          active={showLabels}
          title={showLabels ? 'Hide Labels' : 'Show Labels'}
        >
          {showLabels ? <Tag size={14} /> : <Tags size={14} />}
          <span className="hidden sm:inline">Labels</span>
        </ToolbarButton>

        {/* Separator */}
        <div className="w-px h-6 bg-gray-600" />

        {/* Export buttons */}
        <ToolbarButton onClick={handleExportPNG} title="Export as PNG">
          <Image size={14} />
          <span className="hidden sm:inline">PNG</span>
        </ToolbarButton>
        <ToolbarButton onClick={handleExportSVG} title="Export as SVG">
          <FileCode size={14} />
          <span className="hidden sm:inline">SVG</span>
        </ToolbarButton>

        {/* Separator */}
        <div className="w-px h-6 bg-gray-600" />

        {/* Zoom controls */}
        <ToolbarButton onClick={() => zoomIn({ duration: 200 })} title="Zoom In">
          <ZoomIn size={14} />
        </ToolbarButton>
        <ToolbarButton onClick={() => zoomOut({ duration: 200 })} title="Zoom Out">
          <ZoomOut size={14} />
        </ToolbarButton>
        <ToolbarButton onClick={() => fitView({ padding: 0.15, duration: 300 })} title="Fit View">
          <Maximize size={14} />
        </ToolbarButton>

        {/* Separator */}
        <div className="w-px h-6 bg-gray-600" />

        {/* Color mode selector */}
        <select
          value={colorMode}
          onChange={(e) => setColorMode(e.target.value as ColorMode)}
          className="bg-gray-700 text-gray-200 text-xs rounded-md px-2 py-1.5 border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {COLOR_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Main area: graph + detail panel ───────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* React Flow canvas */}
        <div ref={reactFlowWrapper} className="flex-1 bg-gray-950">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.1}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{
              type: 'linkEdge',
            }}
          >
            <Background color="#1e293b" gap={24} size={1} />
            <MiniMap
              nodeColor={miniMapNodeColor}
              maskColor="rgba(0, 0, 0, 0.7)"
              style={{
                backgroundColor: '#111827',
                border: '1px solid #374151',
                borderRadius: 8,
              }}
              pannable
              zoomable
            />

            {/* Legend panel */}
            <Panel position="bottom-left">
              <div className="bg-gray-900/90 border border-gray-700 rounded-lg px-3 py-2 text-[10px] text-gray-400 space-y-1">
                <div className="font-semibold text-gray-300 text-xs mb-1">Legend</div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-0.5 bg-green-500" style={{ strokeDasharray: '4 2' }} />
                  <span>ISL / Trunk (up)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-0.5 bg-red-500" />
                  <span>Link down</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-px bg-gray-500" />
                  <span>Device connection</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span>Healthy</span>
                  <span className="w-2 h-2 rounded-full bg-yellow-500 ml-1" />
                  <span>Warning</span>
                  <span className="w-2 h-2 rounded-full bg-red-500 ml-1" />
                  <span>Critical</span>
                </div>
              </div>
            </Panel>

            {/* Stats panel */}
            <Panel position="top-right">
              <div className="bg-gray-900/90 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-400 space-y-0.5">
                <div className="text-gray-300 font-semibold">
                  {MOCK_SWITCHES.length} Switches
                </div>
                <div>{MOCK_DEVICES.length} Devices</div>
                <div>{MOCK_LINKS.filter((l) => l.isISL).length} ISL Links</div>
              </div>
            </Panel>
          </ReactFlow>
        </div>

        {/* Detail sidebar */}
        <TopologyDetailPanel
          selectedElement={selectedElement}
          onClose={() => setSelectedElement(null)}
          onViewDetails={handleViewDetails}
        />
      </div>
    </div>
  );
}

// ─── Exported Component (with provider) ──────────────────────────────────────

export default function TopologyView() {
  return (
    <div className="h-full -m-6 flex flex-col">
      {/* Page header */}
      <div className="px-6 py-4 border-b border-gray-700 bg-gray-900">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Network size={22} className="text-blue-400" />
          Network Topology
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Auto-generated network map from LLDP discovery data
        </p>
      </div>

      {/* Flow area */}
      <div className="flex-1 min-h-0">
        <ReactFlowProvider>
          <TopologyFlowInner />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
