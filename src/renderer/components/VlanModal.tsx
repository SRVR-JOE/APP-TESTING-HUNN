import React, { useState, useMemo } from 'react';
import { X, Network } from 'lucide-react';
import { GroupColorPicker, PRESET_COLORS } from './GroupColorPicker';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VlanFormData {
  vlanId: number;
  name: string;
  color: string;
  igmpSnooping: boolean;
  igmpQuerier: boolean;
  unknownFlooding: boolean;
  targetSwitchIds: string[];
}

interface SwitchOption {
  id: string;
  name: string;
  model: string;
}

interface VlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: VlanFormData) => void;
  existingVlanIds: number[];
  switches: SwitchOption[];
  /** If provided, we are editing an existing VLAN */
  initialData?: Partial<VlanFormData>;
  mode?: 'create' | 'edit';
}

// ─── Component ──────────────────────────────────────────────────────────────

export const VlanModal: React.FC<VlanModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingVlanIds,
  switches,
  initialData,
  mode = 'create',
}) => {
  const [vlanId, setVlanId] = useState<number>(initialData?.vlanId ?? 0);
  const [name, setName] = useState(initialData?.name ?? '');
  const [color, setColor] = useState(initialData?.color ?? PRESET_COLORS[0].hex);
  const [igmpSnooping, setIgmpSnooping] = useState(initialData?.igmpSnooping ?? false);
  const [igmpQuerier, setIgmpQuerier] = useState(initialData?.igmpQuerier ?? false);
  const [unknownFlooding, setUnknownFlooding] = useState(initialData?.unknownFlooding ?? true);
  const [targetSwitchIds, setTargetSwitchIds] = useState<string[]>(
    initialData?.targetSwitchIds ?? switches.map((s) => s.id)
  );

  const errors = useMemo(() => {
    const errs: string[] = [];
    if (vlanId < 1 || vlanId > 4094) errs.push('VLAN ID must be between 1 and 4094');
    if (mode === 'create' && existingVlanIds.includes(vlanId))
      errs.push('VLAN ID already exists');
    if (!name.trim()) errs.push('Name is required');
    if (targetSwitchIds.length === 0) errs.push('Select at least one switch');
    return errs;
  }, [vlanId, name, targetSwitchIds, existingVlanIds, mode]);

  const isValid = errors.length === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onSave({
      vlanId,
      name: name.trim(),
      color,
      igmpSnooping,
      igmpQuerier,
      unknownFlooding,
      targetSwitchIds,
    });
  };

  const toggleSwitch = (id: string) => {
    setTargetSwitchIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (targetSwitchIds.length === switches.length) {
      setTargetSwitchIds([]);
    } else {
      setTargetSwitchIds(switches.map((s) => s.id));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500/10 rounded-full flex items-center justify-center">
              <Network className="w-4 h-4 text-blue-400" />
            </div>
            <h2 className="text-white font-semibold text-lg">
              {mode === 'create' ? 'Create VLAN' : 'Edit VLAN'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-5">
          {/* VLAN ID */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              VLAN ID
            </label>
            <input
              type="number"
              min={1}
              max={4094}
              value={vlanId || ''}
              onChange={(e) => setVlanId(parseInt(e.target.value, 10) || 0)}
              disabled={mode === 'edit'}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="1-4094"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="e.g. Dante Primary"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Color
            </label>
            <GroupColorPicker value={color} onChange={setColor} />
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <ToggleRow
              label="IGMP Snooping"
              description="Enable IGMP snooping on this VLAN"
              checked={igmpSnooping}
              onChange={setIgmpSnooping}
            />
            <ToggleRow
              label="IGMP Querier"
              description="Act as IGMP querier for this VLAN"
              checked={igmpQuerier}
              onChange={setIgmpQuerier}
            />
            <ToggleRow
              label="Unknown Flooding"
              description="Flood unknown multicast traffic"
              checked={unknownFlooding}
              onChange={setUnknownFlooding}
            />
          </div>

          {/* Target Switches */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">
                Target Switches
              </label>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                {targetSwitchIds.length === switches.length
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto rounded-md border border-gray-700 p-2 bg-gray-750">
              {switches.map((sw) => (
                <label
                  key={sw.id}
                  className="flex items-center gap-3 p-2 rounded hover:bg-gray-700 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={targetSwitchIds.includes(sw.id)}
                    onChange={() => toggleSwitch(sw.id)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-white">{sw.name}</span>
                  <span className="text-xs text-gray-500 ml-auto">
                    {sw.model}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="text-xs text-red-400 space-y-1">
              {errors.map((err, i) => (
                <p key={i}>* {err}</p>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:text-gray-400 text-white rounded-md transition-colors"
            >
              {mode === 'create' ? 'Create VLAN' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Toggle Sub-component ───────────────────────────────────────────────────

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  label,
  description,
  checked,
  onChange,
}) => (
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm text-white">{label}</p>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
);

export default VlanModal;
