import React, { useState, useCallback } from 'react';
import { Plus, Trash2, Check, X, Edit2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GroupConfig {
  id: number;
  name: string;
  vlanId: number;
  color: string;
  igmpSnooping: boolean;
  igmpQuerier: boolean;
  flooding: boolean;
}

export interface GroupEditorProps {
  groups: GroupConfig[];
  onGroupUpdate: (id: number, updates: Partial<GroupConfig>) => void;
  onGroupCreate: (config: Omit<GroupConfig, 'id'>) => void;
  onGroupDelete: (id: number) => void;
}

// ─── Preset Colors ───────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#3b82f6', '#22c55e', '#a855f7', '#eab308', '#ec4899',
  '#06b6d4', '#f97316', '#14b8a6', '#ef4444', '#8b5cf6',
  '#6366f1', '#84cc16', '#f43f5e', '#0ea5e9', '#d946ef',
];

// ─── Toggle Switch ───────────────────────────────────────────────────────────

const Toggle: React.FC<{ enabled: boolean; onChange: (val: boolean) => void }> = ({ enabled, onChange }) => (
  <button
    onClick={() => onChange(!enabled)}
    className={`
      relative w-9 h-5 rounded-full transition-colors duration-200
      ${enabled ? 'bg-gc-accent' : 'bg-gray-600'}
    `}
  >
    <span
      className={`
        absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
        ${enabled ? 'translate-x-4' : 'translate-x-0'}
      `}
    />
  </button>
);

// ─── Color Picker ────────────────────────────────────────────────────────────

const ColorPicker: React.FC<{
  color: string;
  onChange: (color: string) => void;
  onClose: () => void;
}> = ({ color, onChange, onClose }) => (
  <div className="absolute z-50 top-full left-0 mt-1 p-2 bg-gray-800 border border-gray-600 rounded-lg shadow-xl">
    <div className="grid grid-cols-5 gap-1.5 mb-2">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          onClick={() => { onChange(c); onClose(); }}
          className={`w-6 h-6 rounded-full border-2 transition-all ${
            color === c ? 'border-white scale-110' : 'border-transparent hover:border-gray-400'
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
    <input
      type="color"
      value={color}
      onChange={(e) => { onChange(e.target.value); onClose(); }}
      className="w-full h-6 cursor-pointer rounded bg-transparent"
    />
  </div>
);

// ─── Inline Edit Cell ────────────────────────────────────────────────────────

const EditableCell: React.FC<{
  value: string | number;
  type?: 'text' | 'number';
  onSave: (value: string | number) => void;
  className?: string;
}> = ({ value, type = 'text', onSave, className = '' }) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));

  const handleSave = () => {
    const newVal = type === 'number' ? Number(editValue) : editValue;
    if (newVal !== value) onSave(newVal);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') { setEditValue(String(value)); setEditing(false); }
  };

  if (editing) {
    return (
      <input
        autoFocus
        type={type}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`bg-gray-700 border border-gc-accent/50 rounded px-2 py-1 text-sm text-white outline-none w-full ${className}`}
      />
    );
  }

  return (
    <span
      onClick={() => { setEditValue(String(value)); setEditing(true); }}
      className={`cursor-pointer hover:bg-gray-700/50 px-2 py-1 rounded text-sm transition-colors ${className}`}
    >
      {value}
    </span>
  );
};

// ─── New Group Row ───────────────────────────────────────────────────────────

const NewGroupRow: React.FC<{ onCreate: (config: Omit<GroupConfig, 'id'>) => void }> = ({ onCreate }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [vlanId, setVlanId] = useState('');
  const [color, setColor] = useState('#3b82f6');

  const handleCreate = () => {
    if (!name.trim() || !vlanId) return;
    onCreate({
      name: name.trim(),
      vlanId: Number(vlanId),
      color,
      igmpSnooping: false,
      igmpQuerier: false,
      flooding: true,
    });
    setName('');
    setVlanId('');
    setColor('#3b82f6');
    setIsAdding(false);
  };

  if (!isAdding) {
    return (
      <tr>
        <td colSpan={8} className="px-4 py-3">
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 text-gc-accent hover:text-gc-accent/80 text-sm transition-colors"
          >
            <Plus size={14} />
            Add Group
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-gc-accent/5 border-t border-gray-700">
      <td className="px-4 py-2 text-gray-500 text-sm">Auto</td>
      <td className="px-4 py-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Group name"
          className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white outline-none w-28"
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="number"
          value={vlanId}
          onChange={(e) => setVlanId(e.target.value)}
          placeholder="VLAN"
          className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white outline-none w-20"
        />
      </td>
      <td className="px-4 py-2">
        <div className="w-5 h-5 rounded-full border border-gray-500" style={{ backgroundColor: color }} />
      </td>
      <td className="px-4 py-2" />
      <td className="px-4 py-2" />
      <td className="px-4 py-2" />
      <td className="px-4 py-2">
        <div className="flex items-center gap-1">
          <button onClick={handleCreate} className="p-1 text-green-400 hover:bg-green-400/20 rounded">
            <Check size={14} />
          </button>
          <button onClick={() => setIsAdding(false)} className="p-1 text-gray-400 hover:bg-gray-600 rounded">
            <X size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const GroupEditor: React.FC<GroupEditorProps> = ({
  groups,
  onGroupUpdate,
  onGroupCreate,
  onGroupDelete,
}) => {
  const [colorPickerOpen, setColorPickerOpen] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div className="bg-gc-panel rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-800/60 border-b border-gray-700">
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-16">ID</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-24">VLAN ID</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-16">Color</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-24">IGMP Snoop</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-24">Querier</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-24">Flooding</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.id} className="border-t border-gray-700/50 hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-2.5 text-sm text-gray-400 font-mono">{group.id}</td>
                <td className="px-4 py-2.5">
                  <EditableCell
                    value={group.name}
                    onSave={(val) => onGroupUpdate(group.id, { name: String(val) })}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <EditableCell
                    value={group.vlanId}
                    type="number"
                    onSave={(val) => onGroupUpdate(group.id, { vlanId: Number(val) })}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <div className="relative">
                    <button
                      onClick={() => setColorPickerOpen(colorPickerOpen === group.id ? null : group.id)}
                      className="w-6 h-6 rounded-full border-2 border-gray-500 hover:border-gray-300 transition-colors"
                      style={{ backgroundColor: group.color }}
                    />
                    {colorPickerOpen === group.id && (
                      <ColorPicker
                        color={group.color}
                        onChange={(c) => onGroupUpdate(group.id, { color: c })}
                        onClose={() => setColorPickerOpen(null)}
                      />
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <Toggle
                    enabled={group.igmpSnooping}
                    onChange={(val) => onGroupUpdate(group.id, { igmpSnooping: val })}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <Toggle
                    enabled={group.igmpQuerier}
                    onChange={(val) => onGroupUpdate(group.id, { igmpQuerier: val })}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <Toggle
                    enabled={group.flooding}
                    onChange={(val) => onGroupUpdate(group.id, { flooding: val })}
                  />
                </td>
                <td className="px-4 py-2.5">
                  {deleteConfirm === group.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { onGroupDelete(group.id); setDeleteConfirm(null); }}
                        className="p-1 text-red-400 hover:bg-red-400/20 rounded"
                        title="Confirm delete"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="p-1 text-gray-400 hover:bg-gray-600 rounded"
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(group.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                      title="Delete group"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            <NewGroupRow onCreate={onGroupCreate} />
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GroupEditor;
