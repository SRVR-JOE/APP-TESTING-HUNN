import React from 'react';
import * as LucideIcons from 'lucide-react';
import type { SwitchRoleTemplate } from '@shared/types';
import { PROTOCOL_VLAN_PRESETS } from '@shared/constants';

interface RoleTemplateCardProps {
  template: SwitchRoleTemplate;
  compact?: boolean;
  onSelect?: (id: string) => void;
  selected?: boolean;
}

/** Dynamically resolve a lucide icon by name string */
function getIcon(name: string, className = 'w-5 h-5'): React.ReactNode {
  const Icon = (LucideIcons as unknown as Record<string, React.FC<{ className?: string }>>)[name];
  return Icon ? <Icon className={className} /> : <LucideIcons.Box className={className} />;
}

export const RoleTemplateCard: React.FC<RoleTemplateCardProps> = ({
  template,
  compact = false,
  onSelect,
  selected,
}) => {
  const presetLookup = PROTOCOL_VLAN_PRESETS.reduce<Record<string, (typeof PROTOCOL_VLAN_PRESETS)[number]>>(
    (acc, p) => { acc[p.id] = p; return acc; }, {},
  );

  const resolvedPresets = template.vlanPresets
    .map((pid) => presetLookup[pid])
    .filter(Boolean);

  return (
    <div
      onClick={() => onSelect?.(template.id)}
      className={`
        rounded-lg border p-4 transition-all duration-200 cursor-pointer
        bg-gc-panel hover:shadow-lg
        ${selected ? 'ring-2 ring-gc-accent border-gc-accent' : 'border-gray-700 hover:border-gray-500'}
      `}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-lg"
          style={{ backgroundColor: template.color + '22', color: template.color }}
        >
          {getIcon(template.icon)}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-white font-semibold text-sm truncate">{template.name}</h4>
          <p className="text-xs text-gray-500 truncate">{template.role}</p>
        </div>
      </div>

      {/* Description */}
      {!compact && (
        <p className="text-xs text-gray-400 mb-3 line-clamp-2">{template.description}</p>
      )}

      {/* VLAN preset badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {resolvedPresets.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border border-gray-600 bg-gray-800 text-gray-300"
          >
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: p.color }}
            />
            {p.name}
          </span>
        ))}
        {resolvedPresets.length === 0 && (
          <span className="text-[10px] text-gray-600 italic">No VLAN presets</span>
        )}
      </div>

      {/* Port rules summary */}
      {!compact && template.portRules.length > 0 && (
        <div className="border-t border-gray-700 pt-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Port Rules</p>
          <div className="space-y-0.5">
            {template.portRules.map((pr, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                <span className="font-mono text-gray-500 w-14">
                  {pr.portRange}
                </span>
                <span className={`px-1 rounded text-[10px] ${pr.mode === 'trunk' ? 'bg-blue-500/15 text-blue-400' : 'bg-green-500/15 text-green-400'}`}>
                  {pr.mode ?? 'access'}
                </span>
                {pr.poeEnabled && (
                  <span className="px-1 rounded text-[10px] bg-yellow-500/15 text-yellow-400">PoE</span>
                )}
                {pr.label && (
                  <span className="text-gray-500 truncate">{pr.label}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleTemplateCard;
