import React, { useState, useRef, useCallback } from 'react';
import { MoreVertical, Trash2, Palette, Edit3, ChevronDown } from 'lucide-react';
import RackSwitch from './RackSwitch';
import type { RackGroupData, SwitchInRack, OverlayMode } from '../store/useRackMapStore';

interface RackGroupProps {
  group: RackGroupData;
  switches: SwitchInRack[];
  isSelected: boolean;
  overlayMode: OverlayMode;
  onSelect: () => void;
  onDrop: (switchId: string) => void;
  onSwitchClick: (switchId: string) => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
  onColorChange: (color: string) => void;
  onSwitchReorder: (switchId: string, newIndex: number) => void;
}

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

const healthSummary = (switches: SwitchInRack[]) => {
  if (switches.length === 0) return { label: 'Empty', color: 'text-gray-500', dot: 'bg-gray-500' };
  const hasOffline = switches.some((s) => s.healthStatus === 'offline');
  const hasCritical = switches.some((s) => s.healthStatus === 'critical');
  const hasWarning = switches.some((s) => s.healthStatus === 'warning');
  if (hasCritical) return { label: 'Critical', color: 'text-red-400', dot: 'bg-red-500' };
  if (hasWarning) return { label: 'Warning', color: 'text-yellow-400', dot: 'bg-yellow-500' };
  if (hasOffline) return { label: 'Degraded', color: 'text-gray-400', dot: 'bg-gray-500' };
  return { label: 'OK', color: 'text-green-400', dot: 'bg-green-500' };
};

const RackGroup: React.FC<RackGroupProps> = ({
  group,
  switches,
  isSelected,
  overlayMode,
  onSelect,
  onDrop,
  onSwitchClick,
  onRename,
  onDelete,
  onColorChange,
  onSwitchReorder: _onSwitchReorder,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [showMenu, setShowMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const health = healthSummary(switches);

  const handleDoubleClick = useCallback(() => {
    setEditName(group.name);
    setIsEditing(true);
    setTimeout(() => nameInputRef.current?.select(), 0);
  }, [group.name]);

  const handleNameSubmit = useCallback(() => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== group.name) {
      onRename(trimmed);
    }
    setIsEditing(false);
  }, [editName, group.name, onRename]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const switchId = e.dataTransfer.getData('text/switch-id');
      if (switchId) {
        onDrop(switchId);
      }
    },
    [onDrop]
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setShowMenu(true);
  }, []);

  return (
    <div
      className={`
        relative rounded-xl border backdrop-blur-sm transition-all duration-200
        ${isSelected
          ? 'border-blue-500/50 ring-2 ring-blue-500/20 shadow-lg shadow-blue-500/10'
          : 'border-gray-600/50 hover:border-gray-500/60'}
        ${isDragOver
          ? 'border-dashed border-2 border-blue-400/70 bg-blue-500/10'
          : 'bg-gray-800/90'}
      `}
      style={{ width: group.width }}
      onClick={onSelect}
      onContextMenu={handleContextMenu}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Color accent bar on left */}
      <div
        className="absolute left-0 top-3 bottom-3 w-1 rounded-full"
        style={{ backgroundColor: group.color }}
      />

      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              ref={nameInputRef}
              className="bg-gray-700 text-sm font-semibold text-white px-2 py-0.5 rounded border border-gray-500 outline-none focus:border-blue-500 w-full"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSubmit();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              autoFocus
            />
          ) : (
            <h3
              className="text-sm font-semibold text-gray-200 truncate cursor-text"
              onDoubleClick={handleDoubleClick}
              title="Double-click to rename"
            >
              {group.name}
            </h3>
          )}
        </div>
        <span className={`w-2 h-2 rounded-full ${health.dot}`} />
        <div className="relative">
          <button
            className="p-1 rounded hover:bg-gray-700 transition-colors text-gray-400 hover:text-gray-200"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
          >
            <MoreVertical size={14} />
          </button>

          {/* Context Menu */}
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => { setShowMenu(false); setShowColorPicker(false); }} />
              <div
                ref={menuRef}
                className="absolute right-0 top-full mt-1 w-44 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 py-1 overflow-hidden"
              >
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    handleDoubleClick();
                  }}
                >
                  <Edit3 size={14} /> Rename
                </button>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowColorPicker(!showColorPicker);
                  }}
                >
                  <Palette size={14} /> Change Color
                  <ChevronDown size={12} className="ml-auto" />
                </button>
                {showColorPicker && (
                  <div className="px-3 py-2 flex flex-wrap gap-1.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                          c === group.color ? 'border-white scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onColorChange(c);
                          setShowMenu(false);
                          setShowColorPicker(false);
                        }}
                      />
                    ))}
                  </div>
                )}
                <hr className="border-gray-700 my-1" />
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onDelete();
                  }}
                >
                  <Trash2 size={14} /> Delete Group
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Switch cards */}
      <div className="px-3 pb-2 space-y-2">
        {switches.length === 0 ? (
          <div className={`
            rounded-lg border-2 border-dashed py-6 text-center text-xs
            ${isDragOver ? 'border-blue-400/50 text-blue-300' : 'border-gray-600/40 text-gray-500'}
          `}>
            Drop switches here
          </div>
        ) : (
          switches.map((sw) => (
            <RackSwitch
              key={sw.id}
              switchData={sw}
              overlayMode={overlayMode}
              isSelected={false}
              onClick={() => onSwitchClick(sw.id)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-700/50 flex items-center justify-between text-[11px] text-gray-500">
        <span>
          {switches.length} switch{switches.length !== 1 ? 'es' : ''}
        </span>
        <span className="flex items-center gap-1.5">
          Health: <span className={`w-1.5 h-1.5 rounded-full ${health.dot}`} />
          <span className={health.color}>{health.label}</span>
        </span>
      </div>

      {/* Drop zone overlay */}
      {isDragOver && (
        <div className="absolute inset-0 rounded-xl bg-blue-500/5 pointer-events-none border-2 border-blue-400/30 border-dashed" />
      )}
    </div>
  );
};

export default RackGroup;
