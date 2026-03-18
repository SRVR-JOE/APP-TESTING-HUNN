import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  LayoutGrid,
  Plus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Save,
  Download,
  PanelRightOpen,
  PanelRightClose,
  Search,
  Activity,
  Heart,
  Zap,
  Network,
  Layers,
  GripVertical,
  X,
  Image,
  Lock,
  Unlock,
  Trash2,
} from 'lucide-react';
import RackGroup from '../components/RackGroup';
import ISLLink from '../components/ISLLink';
import { useRackMapStore } from '../store/useRackMapStore';
import type { OverlayMode, BackgroundImage } from '../store/useRackMapStore';
import { useAppStore } from '../store/useAppStore';
import { VIEWS } from '@shared/constants';

// ─── Overlay Mode Config ─────────────────────────────────────────────────────

const overlayModes: { mode: OverlayMode; label: string; icon: React.ReactNode }[] = [
  { mode: 'default', label: 'Default', icon: <LayoutGrid size={14} /> },
  { mode: 'poe', label: 'PoE', icon: <Zap size={14} /> },
  { mode: 'health', label: 'Health', icon: <Heart size={14} /> },
  { mode: 'traffic', label: 'Traffic', icon: <Activity size={14} /> },
  { mode: 'vlan', label: 'VLAN', icon: <Layers size={14} /> },
];

// ─── Group height estimator (for ISL link positioning) ───────────────────────

function estimateGroupHeight(switchCount: number): number {
  // header (44) + switches (each ~100) + footer (32) + padding
  if (switchCount === 0) return 140;
  return 52 + switchCount * 108 + 36;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function RackMapView() {
  const {
    rackGroups,
    switchAssignments,
    allSwitches,
    islLinks,
    zoom,
    panX,
    panY,
    overlayMode,
    selectedGroupId,
    layoutName,
    isDirty,
    sidebarOpen,
    addRackGroup,
    removeRackGroup,
    updateRackGroup,
    moveRackGroup,
    assignSwitch,
    unassignSwitch,
    setZoom,
    setPan,
    setOverlayMode,
    setSelectedGroup,
    setLayoutName,
    setSidebarOpen,
    backgroundImage,
    setBackgroundImage,
    updateBackgroundImage,
    saveLayout,
    exportJSON,
  } = useRackMapStore();

  const setView = useAppStore((s) => s.setView);
  const selectSwitch = useAppStore((s) => s.selectSwitch);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dragGroupId, setDragGroupId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingLayoutName, setEditingLayoutName] = useState(false);
  const [tempLayoutName, setTempLayoutName] = useState(layoutName);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [groupHeights, setGroupHeights] = useState<Record<string, number>>({});
  const [showBgControls, setShowBgControls] = useState(false);
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  // Track actual rendered heights of rack groups
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const heights: Record<string, number> = {};
    for (const [id, el] of Object.entries(groupRefs.current)) {
      if (el) {
        heights[id] = el.getBoundingClientRect().height / zoom;
      }
    }
    setGroupHeights(heights);
  }, [rackGroups, switchAssignments, zoom, overlayMode]);

  // Unassigned switches
  const unassignedSwitches = useMemo(
    () => allSwitches.filter((sw) => !switchAssignments[sw.id]),
    [allSwitches, switchAssignments]
  );

  const filteredUnassigned = useMemo(() => {
    if (!sidebarSearch) return unassignedSwitches;
    const q = sidebarSearch.toLowerCase();
    return unassignedSwitches.filter(
      (sw) =>
        sw.name.toLowerCase().includes(q) ||
        sw.model.toLowerCase().includes(q) ||
        sw.ip.includes(q)
    );
  }, [unassignedSwitches, sidebarSearch]);

  // Switches grouped by rack
  const switchesByGroup = useMemo(() => {
    const map: Record<string, typeof allSwitches> = {};
    for (const group of rackGroups) {
      map[group.id] = [];
    }
    for (const sw of allSwitches) {
      const groupId = switchAssignments[sw.id];
      if (groupId && map[groupId]) {
        map[groupId].push(sw);
      }
    }
    return map;
  }, [rackGroups, allSwitches, switchAssignments]);

  // ─── Canvas Pan/Zoom ────────────────────────────────────────────────────────

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(zoom + delta);
      } else {
        // Pan with wheel
        setPan(panX - e.deltaX, panY - e.deltaY);
      }
    },
    [zoom, panX, panY, setZoom, setPan]
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Middle click or space held
      if (e.button === 1) {
        e.preventDefault();
        setIsPanning(true);
        setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
      }
    },
    [panX, panY]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setPan(e.clientX - panStart.x, e.clientY - panStart.y);
      }
      if (dragGroupId) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const x = (e.clientX - rect.left - panX) / zoom - dragOffset.x;
          const y = (e.clientY - rect.top - panY) / zoom - dragOffset.y;
          moveRackGroup(dragGroupId, Math.round(x), Math.round(y));
        }
      }
    },
    [isPanning, panStart, dragGroupId, dragOffset, zoom, panX, panY, setPan, moveRackGroup]
  );

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
    setDragGroupId(null);
  }, []);

  // Space key for panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && canvasRef.current) {
        canvasRef.current.style.cursor = 'grab';
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && canvasRef.current) {
        canvasRef.current.style.cursor = '';
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // ─── Rack Group Dragging ────────────────────────────────────────────────────

  const handleGroupDragStart = useCallback(
    (groupId: string, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const group = rackGroups.find((g) => g.id === groupId);
      if (!group) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = (e.clientX - rect.left - panX) / zoom;
      const mouseY = (e.clientY - rect.top - panY) / zoom;
      setDragGroupId(groupId);
      setDragOffset({ x: mouseX - group.positionX, y: mouseY - group.positionY });
      e.stopPropagation();
    },
    [rackGroups, panX, panY, zoom]
  );

  // ─── Zoom Controls ─────────────────────────────────────────────────────────

  const zoomIn = () => setZoom(zoom + 0.15);
  const zoomOut = () => setZoom(zoom - 0.15);
  const fitAll = useCallback(() => {
    if (rackGroups.length === 0) {
      setZoom(1);
      setPan(0, 0);
      return;
    }
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const g of rackGroups) {
      minX = Math.min(minX, g.positionX);
      minY = Math.min(minY, g.positionY);
      const h = groupHeights[g.id] || estimateGroupHeight((switchesByGroup[g.id] || []).length);
      maxX = Math.max(maxX, g.positionX + g.width);
      maxY = Math.max(maxY, g.positionY + h);
    }
    const contentW = maxX - minX + 100;
    const contentH = maxY - minY + 100;
    const scaleX = canvasRect.width / contentW;
    const scaleY = canvasRect.height / contentH;
    const newZoom = Math.min(scaleX, scaleY, 1.5);
    const newPanX = (canvasRect.width - contentW * newZoom) / 2 - minX * newZoom + 50;
    const newPanY = (canvasRect.height - contentH * newZoom) / 2 - minY * newZoom + 50;
    setZoom(newZoom);
    setPan(newPanX, newPanY);
  }, [rackGroups, groupHeights, switchesByGroup, setZoom, setPan]);

  // ─── Export ─────────────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${layoutName.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportJSON, layoutName]);

  // ─── Background Image Import ───────────────────────────────────────────────

  const handleBgFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        alert('Unsupported file type. Use PNG, JPEG, WebP, SVG, or PDF.');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new window.Image();
        img.onload = () => {
          setBackgroundImage({
            dataUrl,
            fileName: file.name,
            width: img.naturalWidth,
            height: img.naturalHeight,
            opacity: 0.3,
            positionX: 0,
            positionY: 0,
            scale: 1,
            locked: false,
          });
          setShowBgControls(true);
        };
        img.onerror = () => {
          // For PDFs or SVGs that don't load as Image, set with defaults
          setBackgroundImage({
            dataUrl,
            fileName: file.name,
            width: 1920,
            height: 1080,
            opacity: 0.3,
            positionX: 0,
            positionY: 0,
            scale: 1,
            locked: false,
          });
          setShowBgControls(true);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
      // Reset the input so the same file can be re-selected
      e.target.value = '';
    },
    [setBackgroundImage]
  );

  // ─── Switch Click Handler ───────────────────────────────────────────────────

  const handleSwitchClick = useCallback(
    (switchId: string) => {
      selectSwitch(switchId);
      setView(VIEWS.DEVICE_DETAIL);
    },
    [selectSwitch, setView]
  );

  // ─── ISL link rects ────────────────────────────────────────────────────────

  const groupRects = useMemo(() => {
    const rects: Record<string, { x: number; y: number; width: number; height: number }> = {};
    for (const g of rackGroups) {
      rects[g.id] = {
        x: g.positionX,
        y: g.positionY,
        width: g.width,
        height: groupHeights[g.id] || estimateGroupHeight((switchesByGroup[g.id] || []).length),
      };
    }
    return rects;
  }, [rackGroups, groupHeights, switchesByGroup]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full -m-6 overflow-hidden">
      {/* ─── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/80 border-b border-gray-700 flex-shrink-0">
        {/* Left section */}
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus size={14} /> Add Rack Group
        </button>

        <div className="w-px h-6 bg-gray-700 mx-1" />

        {/* Overlay mode toggle */}
        <div className="flex bg-gray-900/50 rounded-lg p-0.5 border border-gray-700">
          {overlayModes.map(({ mode, label, icon }) => (
            <button
              key={mode}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                overlayMode === mode
                  ? 'bg-gray-700 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              onClick={() => setOverlayMode(mode)}
            >
              {icon}
              <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-gray-700 mx-1" />

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            onClick={zoomOut}
            title="Zoom Out"
          >
            <ZoomOut size={15} />
          </button>
          <span className="text-xs text-gray-400 font-mono w-10 text-center tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            onClick={zoomIn}
            title="Zoom In"
          >
            <ZoomIn size={15} />
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            onClick={fitAll}
            title="Fit All"
          >
            <Maximize2 size={15} />
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Layout name */}
        <div className="flex items-center gap-2">
          {editingLayoutName ? (
            <input
              className="bg-gray-700 text-sm text-white px-2 py-1 rounded border border-gray-500 outline-none focus:border-blue-500"
              value={tempLayoutName}
              onChange={(e) => setTempLayoutName(e.target.value)}
              onBlur={() => {
                if (tempLayoutName.trim()) setLayoutName(tempLayoutName.trim());
                setEditingLayoutName(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (tempLayoutName.trim()) setLayoutName(tempLayoutName.trim());
                  setEditingLayoutName(false);
                }
              }}
              autoFocus
            />
          ) : (
            <span
              className="text-sm text-gray-300 cursor-pointer hover:text-white transition-colors"
              onClick={() => {
                setTempLayoutName(layoutName);
                setEditingLayoutName(true);
              }}
              title="Click to edit layout name"
            >
              {layoutName}
              {isDirty && <span className="text-yellow-500 ml-1">*</span>}
            </span>
          )}
        </div>

        <div className="w-px h-6 bg-gray-700 mx-1" />

        {/* Save / Export */}
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-medium rounded-lg transition-colors"
          onClick={saveLayout}
        >
          <Save size={14} /> Save
        </button>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-medium rounded-lg transition-colors"
          onClick={handleExport}
        >
          <Download size={14} /> Export
        </button>

        <div className="w-px h-6 bg-gray-700 mx-1" />

        {/* Background image controls */}
        <input
          ref={bgFileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
          className="hidden"
          onChange={handleBgFileSelect}
        />
        <button
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            backgroundImage
              ? 'bg-purple-600/30 text-purple-300 hover:bg-purple-600/50 border border-purple-500/30'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
          }`}
          onClick={() => {
            if (backgroundImage) {
              setShowBgControls(!showBgControls);
            } else {
              bgFileInputRef.current?.click();
            }
          }}
          title={backgroundImage ? 'Background image settings' : 'Import background image (stage plot, floor plan, etc.)'}
        >
          <Image size={14} />
          {backgroundImage ? 'Background' : 'Add Background'}
        </button>

        <div className="w-px h-6 bg-gray-700 mx-1" />

        {/* Sidebar toggle */}
        <button
          className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {sidebarOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>
      </div>

      {/* ─── Main Area ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Canvas */}
        <div
          ref={canvasRef}
          className={`flex-1 relative overflow-hidden ${isPanning ? 'cursor-grabbing' : ''}`}
          onWheel={handleWheel}
          onMouseDown={(e) => {
            handleCanvasMouseDown(e);
            // Left click on canvas background = deselect
            if (e.button === 0 && e.target === canvasRef.current) {
              setSelectedGroup(null);
            }
          }}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        >
          {/* Background grid pattern */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="grid-dots"
                x={panX % (20 * zoom)}
                y={panY % (20 * zoom)}
                width={20 * zoom}
                height={20 * zoom}
                patternUnits="userSpaceOnUse"
              >
                <circle cx={1} cy={1} r={0.8} fill="#374151" opacity={0.5} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-dots)" />
          </svg>

          {/* Background image layer */}
          {backgroundImage && (
            <div
              className="absolute pointer-events-none"
              style={{
                transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                transformOrigin: '0 0',
              }}
            >
              <img
                src={backgroundImage.dataUrl}
                alt={backgroundImage.fileName}
                className="block"
                style={{
                  position: 'absolute',
                  left: backgroundImage.positionX,
                  top: backgroundImage.positionY,
                  width: backgroundImage.width * backgroundImage.scale,
                  height: backgroundImage.height * backgroundImage.scale,
                  opacity: backgroundImage.opacity,
                  pointerEvents: backgroundImage.locked ? 'none' : 'auto',
                  userSelect: 'none',
                }}
                draggable={false}
              />
            </div>
          )}

          {/* ISL Links SVG overlay */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{
              transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            <g className="pointer-events-auto">
              {islLinks.map((link) => {
                const from = groupRects[link.sourceGroupId];
                const to = groupRects[link.targetGroupId];
                if (!from || !to) return null;
                return (
                  <ISLLink
                    key={link.id}
                    fromGroup={from}
                    toGroup={to}
                    linkInfo={{
                      sourcePort: link.sourcePort,
                      targetPort: link.targetPort,
                      speed: link.speed,
                      status: link.status,
                    }}
                    onClick={() => {
                      // Could show link detail popover
                    }}
                  />
                );
              })}
            </g>
          </svg>

          {/* Rack groups on canvas */}
          <div
            className="absolute"
            style={{
              transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {rackGroups.map((group) => (
              <div
                key={group.id}
                ref={(el) => { groupRefs.current[group.id] = el; }}
                className="absolute"
                style={{
                  left: group.positionX,
                  top: group.positionY,
                  userSelect: 'none',
                }}
                onMouseDown={(e) => handleGroupDragStart(group.id, e)}
              >
                <RackGroup
                  group={group}
                  switches={switchesByGroup[group.id] || []}
                  isSelected={selectedGroupId === group.id}
                  overlayMode={overlayMode}
                  onSelect={() => setSelectedGroup(group.id)}
                  onDrop={(switchId) => assignSwitch(switchId, group.id)}
                  onSwitchClick={handleSwitchClick}
                  onRename={(name) => updateRackGroup(group.id, { name })}
                  onDelete={() => removeRackGroup(group.id)}
                  onColorChange={(color) => updateRackGroup(group.id, { color })}
                  onSwitchReorder={() => {}}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ─── Right Sidebar ──────────────────────────────────────────────── */}
        {sidebarOpen && (
          <div className="w-64 bg-gray-800/60 border-l border-gray-700 flex flex-col flex-shrink-0">
            <div className="px-3 py-3 border-b border-gray-700">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Unassigned Switches
              </h3>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  className="w-full bg-gray-900/50 border border-gray-700 rounded-lg text-xs text-gray-300 pl-8 pr-3 py-1.5 outline-none focus:border-gray-500 placeholder-gray-600"
                  placeholder="Filter switches..."
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {filteredUnassigned.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-500">
                  {unassignedSwitches.length === 0
                    ? 'All switches assigned'
                    : 'No matches found'}
                </div>
              ) : (
                filteredUnassigned.map((sw) => (
                  <div
                    key={sw.id}
                    className="group flex items-center gap-2 p-2 rounded-lg bg-gray-900/40 border border-gray-700/50 hover:border-gray-600 cursor-grab transition-colors"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/switch-id', sw.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                  >
                    <GripVertical size={12} className="text-gray-600 group-hover:text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-gray-300 truncate">{sw.name}</span>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          sw.healthStatus === 'healthy' ? 'bg-green-500' :
                          sw.healthStatus === 'warning' ? 'bg-yellow-500' :
                          sw.healthStatus === 'critical' ? 'bg-red-500' : 'bg-gray-500'
                        }`} />
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono">{sw.model} | {sw.ip}</div>
                    </div>
                    <button
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-all"
                      title="Remove from rack"
                      onClick={(e) => {
                        e.stopPropagation();
                        unassignSwitch(sw.id);
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="px-3 py-2 border-t border-gray-700 text-[10px] text-gray-500">
              {unassignedSwitches.length} unassigned | {allSwitches.length} total
            </div>
          </div>
        )}
      </div>

      {/* ─── Background Image Controls Panel ─────────────────────────────── */}
      {showBgControls && backgroundImage && (
        <div className="absolute top-14 right-4 z-40 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl p-4 w-72">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Background Image</h3>
            <button
              className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              onClick={() => setShowBgControls(false)}
            >
              <X size={14} />
            </button>
          </div>

          <div className="text-[10px] text-gray-500 mb-3 truncate" title={backgroundImage.fileName}>
            {backgroundImage.fileName} ({backgroundImage.width}x{backgroundImage.height})
          </div>

          {/* Opacity slider */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-400">Opacity</label>
              <span className="text-xs text-gray-500 font-mono">{Math.round(backgroundImage.opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(backgroundImage.opacity * 100)}
              onChange={(e) => updateBackgroundImage({ opacity: Number(e.target.value) / 100 })}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
          </div>

          {/* Scale slider */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-400">Scale</label>
              <span className="text-xs text-gray-500 font-mono">{Math.round(backgroundImage.scale * 100)}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={300}
              value={Math.round(backgroundImage.scale * 100)}
              onChange={(e) => updateBackgroundImage({ scale: Number(e.target.value) / 100 })}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
          </div>

          {/* Position inputs */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">X Position</label>
              <input
                type="number"
                value={backgroundImage.positionX}
                onChange={(e) => updateBackgroundImage({ positionX: Number(e.target.value) })}
                className="w-full bg-gray-900 border border-gray-600 rounded text-xs text-gray-300 px-2 py-1 font-mono outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Y Position</label>
              <input
                type="number"
                value={backgroundImage.positionY}
                onChange={(e) => updateBackgroundImage({ positionY: Number(e.target.value) })}
                className="w-full bg-gray-900 border border-gray-600 rounded text-xs text-gray-300 px-2 py-1 font-mono outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                backgroundImage.locked
                  ? 'bg-yellow-600/20 text-yellow-300 border border-yellow-500/30 hover:bg-yellow-600/30'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => updateBackgroundImage({ locked: !backgroundImage.locked })}
              title={backgroundImage.locked ? 'Unlock position' : 'Lock position'}
            >
              {backgroundImage.locked ? <Lock size={12} /> : <Unlock size={12} />}
              {backgroundImage.locked ? 'Locked' : 'Lock'}
            </button>
            <button
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 rounded-lg transition-colors"
              onClick={() => bgFileInputRef.current?.click()}
              title="Replace image"
            >
              <Image size={12} /> Replace
            </button>
            <button
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/20 rounded-lg transition-colors"
              onClick={() => {
                setBackgroundImage(null);
                setShowBgControls(false);
              }}
              title="Remove background"
            >
              <Trash2 size={12} /> Remove
            </button>
          </div>
        </div>
      )}

      {/* ─── Add Rack Group Dialog ────────────────────────────────────────── */}
      {showAddDialog && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowAddDialog(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl p-5 w-80">
            <h3 className="text-sm font-semibold text-gray-200 mb-3">New Rack Group</h3>
            <input
              className="w-full bg-gray-900 border border-gray-600 rounded-lg text-sm text-gray-200 px-3 py-2 outline-none focus:border-blue-500 mb-4 placeholder-gray-500"
              placeholder="Rack group name..."
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newGroupName.trim()) {
                  addRackGroup(newGroupName.trim());
                  setNewGroupName('');
                  setShowAddDialog(false);
                }
              }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
                onClick={() => { setShowAddDialog(false); setNewGroupName(''); }}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-40"
                disabled={!newGroupName.trim()}
                onClick={() => {
                  addRackGroup(newGroupName.trim());
                  setNewGroupName('');
                  setShowAddDialog(false);
                }}
              >
                Create
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
