import React, { useState } from 'react';
import { Plus, Trash2, RotateCcw } from 'lucide-react';

export interface GroupRow {
  groupNumber: number;
  name: string;
  vlanId: number;
  color: string;
  igmpSnooping: boolean;
  igmpQuerier: boolean;
  igmpFlooding: boolean;
}

export interface GroupConfigFormProps {
  onPreview: (groups: GroupRow[]) => void;
  onApply: (groups: GroupRow[]) => void;
  previewReviewed: boolean;
}

const SOLOTECH_DEFAULTS: GroupRow[] = [
  { groupNumber: 1, name: 'Control', vlanId: 1, color: '#3b82f6', igmpSnooping: true, igmpQuerier: false, igmpFlooding: false },
  { groupNumber: 2, name: 'Audio Primary', vlanId: 10, color: '#22c55e', igmpSnooping: true, igmpQuerier: true, igmpFlooding: false },
  { groupNumber: 3, name: 'Audio Secondary', vlanId: 11, color: '#14b8a6', igmpSnooping: true, igmpQuerier: false, igmpFlooding: false },
  { groupNumber: 4, name: 'Video', vlanId: 20, color: '#a855f7', igmpSnooping: true, igmpQuerier: true, igmpFlooding: true },
  { groupNumber: 5, name: 'Lighting', vlanId: 30, color: '#f59e0b', igmpSnooping: false, igmpQuerier: false, igmpFlooding: false },
  { groupNumber: 6, name: 'Intercom', vlanId: 40, color: '#ef4444', igmpSnooping: true, igmpQuerier: false, igmpFlooding: false },
];

const PRESET_COLORS = [
  '#3b82f6', '#22c55e', '#14b8a6', '#a855f7', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#84cc16', '#f97316',
];

export const GroupConfigForm: React.FC<GroupConfigFormProps> = ({
  onPreview,
  onApply,
  previewReviewed,
}) => {
  const [groups, setGroups] = useState<GroupRow[]>([...SOLOTECH_DEFAULTS]);

  const updateGroup = (index: number, field: keyof GroupRow, value: unknown) => {
    const next = [...groups];
    next[index] = { ...next[index], [field]: value };
    setGroups(next);
  };

  const addGroup = () => {
    const nextNum = groups.length > 0 ? Math.max(...groups.map((g) => g.groupNumber)) + 1 : 1;
    const nextVlan = groups.length > 0 ? Math.max(...groups.map((g) => g.vlanId)) + 10 : 1;
    setGroups([
      ...groups,
      {
        groupNumber: nextNum,
        name: `Group ${nextNum}`,
        vlanId: nextVlan,
        color: PRESET_COLORS[groups.length % PRESET_COLORS.length],
        igmpSnooping: false,
        igmpQuerier: false,
        igmpFlooding: false,
      },
    ]);
  };

  const removeGroup = (index: number) => {
    setGroups(groups.filter((_, i) => i !== index));
  };

  const resetDefaults = () => {
    setGroups([...SOLOTECH_DEFAULTS]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-white">Group / VLAN Configuration</h4>
          <p className="text-xs text-gray-400 mt-0.5">
            Define groups to apply across all selected switches
          </p>
        </div>
        <button
          onClick={resetDefaults}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gc-accent transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Solotech Defaults
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left py-2 px-2 w-12">#</th>
              <th className="text-left py-2 px-2">Name</th>
              <th className="text-left py-2 px-2 w-24">VLAN ID</th>
              <th className="text-center py-2 px-2 w-16">Color</th>
              <th className="text-center py-2 px-2 w-20">Snoop</th>
              <th className="text-center py-2 px-2 w-20">Querier</th>
              <th className="text-center py-2 px-2 w-20">Flood</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {groups.map((g, i) => (
              <tr key={i} className="hover:bg-gray-800/50 transition-colors">
                <td className="py-2 px-2">
                  <input
                    type="number"
                    value={g.groupNumber}
                    onChange={(e) => updateGroup(i, 'groupNumber', parseInt(e.target.value) || 0)}
                    className="w-12 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-gc-accent"
                  />
                </td>
                <td className="py-2 px-2">
                  <input
                    type="text"
                    value={g.name}
                    onChange={(e) => updateGroup(i, 'name', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-gc-accent"
                  />
                </td>
                <td className="py-2 px-2">
                  <input
                    type="number"
                    value={g.vlanId}
                    onChange={(e) => updateGroup(i, 'vlanId', parseInt(e.target.value) || 0)}
                    className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-gc-accent"
                  />
                </td>
                <td className="py-2 px-2 text-center">
                  <input
                    type="color"
                    value={g.color}
                    onChange={(e) => updateGroup(i, 'color', e.target.value)}
                    className="w-8 h-6 bg-transparent border-0 cursor-pointer"
                  />
                </td>
                <td className="py-2 px-2 text-center">
                  <input
                    type="checkbox"
                    checked={g.igmpSnooping}
                    onChange={(e) => updateGroup(i, 'igmpSnooping', e.target.checked)}
                    className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-gc-accent focus:ring-gc-accent focus:ring-offset-0"
                  />
                </td>
                <td className="py-2 px-2 text-center">
                  <input
                    type="checkbox"
                    checked={g.igmpQuerier}
                    onChange={(e) => updateGroup(i, 'igmpQuerier', e.target.checked)}
                    className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-gc-accent focus:ring-gc-accent focus:ring-offset-0"
                  />
                </td>
                <td className="py-2 px-2 text-center">
                  <input
                    type="checkbox"
                    checked={g.igmpFlooding}
                    onChange={(e) => updateGroup(i, 'igmpFlooding', e.target.checked)}
                    className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-gc-accent focus:ring-gc-accent focus:ring-offset-0"
                  />
                </td>
                <td className="py-2 px-2">
                  <button
                    onClick={() => removeGroup(i)}
                    className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add row */}
      <button
        onClick={addGroup}
        className="flex items-center gap-2 text-xs text-gc-accent hover:text-white transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Group
      </button>

      {/* Action buttons */}
      <div className="flex items-center gap-3 pt-4 border-t border-gray-700">
        <button
          onClick={() => onPreview(groups)}
          className="px-4 py-2 text-sm font-medium bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          Preview Changes
        </button>
        <button
          onClick={() => onApply(groups)}
          disabled={!previewReviewed}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            previewReviewed
              ? 'bg-gc-accent text-white hover:bg-gc-accent/80'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Apply to Selected Switches
        </button>
        {!previewReviewed && (
          <span className="text-xs text-gray-500">Preview changes first</span>
        )}
      </div>
    </div>
  );
};

export default GroupConfigForm;
