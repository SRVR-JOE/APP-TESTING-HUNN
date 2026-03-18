import React, { useState } from 'react';
import { Cable, Plus, X, Check, ArrowRightLeft, AlertCircle } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TrunkPort {
  port: number;
  label: string;
  allowedGroups: TrunkGroup[];
  isISL: boolean;
  connectedSwitch?: string;
  operStatus: 'up' | 'down';
}

export interface TrunkGroup {
  id: number;
  name: string;
  color: string;
  tagged: boolean;
}

export interface TrunkConfigProps {
  trunkPorts: TrunkPort[];
  availableGroups: { id: number; name: string; color: string }[];
  onAddGroupToTrunk: (port: number, groupId: number, tagged: boolean) => void;
  onRemoveGroupFromTrunk: (port: number, groupId: number) => void;
  onToggleTrunk: (port: number, enabled: boolean) => void;
}

// ─── Group Chip ──────────────────────────────────────────────────────────────

const GroupChip: React.FC<{
  group: TrunkGroup;
  onRemove: () => void;
}> = ({ group, onRemove }) => (
  <span
    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-transparent hover:border-gray-500 transition-colors"
    style={{ backgroundColor: group.color + '30', color: group.color }}
  >
    <span
      className="w-2 h-2 rounded-full"
      style={{ backgroundColor: group.color }}
    />
    {group.name}
    {group.tagged && (
      <span className="text-[9px] opacity-70 ml-0.5">T</span>
    )}
    <button
      onClick={(e) => { e.stopPropagation(); onRemove(); }}
      className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
    >
      <X size={10} />
    </button>
  </span>
);

// ─── Add Group Popover ───────────────────────────────────────────────────────

const AddGroupPopover: React.FC<{
  availableGroups: { id: number; name: string; color: string }[];
  existingGroupIds: number[];
  onAdd: (groupId: number, tagged: boolean) => void;
  onClose: () => void;
}> = ({ availableGroups, existingGroupIds, onAdd, onClose }) => {
  const remaining = availableGroups.filter((g) => !existingGroupIds.includes(g.id));

  if (remaining.length === 0) {
    return (
      <div className="absolute z-50 top-full left-0 mt-1 p-3 bg-gray-800 border border-gray-600 rounded-lg shadow-xl text-xs text-gray-400">
        All groups already assigned.
        <button onClick={onClose} className="ml-2 text-gc-accent hover:underline">Close</button>
      </div>
    );
  }

  return (
    <div className="absolute z-50 top-full left-0 mt-1 p-2 bg-gray-800 border border-gray-600 rounded-lg shadow-xl min-w-[180px]">
      <div className="text-xs text-gray-400 mb-2 px-1">Add group to trunk:</div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {remaining.map((g) => (
          <div key={g.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-gray-700/50">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} />
              <span className="text-xs text-white">{g.name}</span>
              <span className="text-[10px] text-gray-500">({g.id})</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { onAdd(g.id, false); onClose(); }}
                className="px-1.5 py-0.5 text-[10px] rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
                title="Add untagged"
              >
                U
              </button>
              <button
                onClick={() => { onAdd(g.id, true); onClose(); }}
                className="px-1.5 py-0.5 text-[10px] rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
                title="Add tagged"
              >
                T
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const TrunkConfig: React.FC<TrunkConfigProps> = ({
  trunkPorts,
  availableGroups,
  onAddGroupToTrunk,
  onRemoveGroupFromTrunk,
  onToggleTrunk,
}) => {
  const [addingGroupFor, setAddingGroupFor] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {/* ISL Detection hint */}
      {trunkPorts.some((t) => t.isISL) && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
          <ArrowRightLeft size={16} />
          <span className="text-sm">
            ISL connections detected. Highlighted ports are connected to other GigaCore switches.
          </span>
        </div>
      )}

      <div className="bg-gc-panel rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-800/60 border-b border-gray-700">
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-20">Port</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-28">Label</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-20">Status</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-16">ISL</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Allowed Groups</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {trunkPorts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
                  <Cable size={20} className="inline-block mb-2 opacity-40" />
                  <div>No trunk ports configured. Trunk ports allow multiple groups to traverse a single uplink.</div>
                </td>
              </tr>
            ) : (
              trunkPorts.map((trunk) => (
                <tr
                  key={trunk.port}
                  className={`border-t border-gray-700/50 hover:bg-gray-800/30 transition-colors ${
                    trunk.isISL ? 'bg-blue-500/5' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-mono text-white">{trunk.port}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{trunk.label}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${
                      trunk.operStatus === 'up'
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    }`}>
                      {trunk.operStatus === 'up' ? 'Up' : 'Down'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {trunk.isISL ? (
                      <div className="flex items-center gap-1">
                        <ArrowRightLeft size={14} className="text-blue-400" />
                        <span className="text-xs text-blue-400">{trunk.connectedSwitch || 'GC'}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-600">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative flex flex-wrap items-center gap-1.5">
                      {trunk.allowedGroups.map((g) => (
                        <GroupChip
                          key={g.id}
                          group={g}
                          onRemove={() => onRemoveGroupFromTrunk(trunk.port, g.id)}
                        />
                      ))}
                      <button
                        onClick={() => setAddingGroupFor(addingGroupFor === trunk.port ? null : trunk.port)}
                        className="w-6 h-6 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                      {addingGroupFor === trunk.port && (
                        <AddGroupPopover
                          availableGroups={availableGroups}
                          existingGroupIds={trunk.allowedGroups.map((g) => g.id)}
                          onAdd={(gId, tagged) => onAddGroupToTrunk(trunk.port, gId, tagged)}
                          onClose={() => setAddingGroupFor(null)}
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onToggleTrunk(trunk.port, false)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                      title="Remove trunk configuration"
                    >
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TrunkConfig;
