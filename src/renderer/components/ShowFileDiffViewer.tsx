import React from 'react';
import {
  Plus,
  Minus,
  PenLine,
  Network,
  GitCompare,
} from 'lucide-react';
import type { ShowFileDiff, ShowFile } from '@shared/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ShowFileDiffViewerProps {
  diff: ShowFileDiff;
  /** Optional: the "before" show file, used to render richer context. */
  before?: ShowFile;
  /** Optional: the "after" show file, used to render richer context. */
  after?: ShowFile;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DiffBadge({ type }: { type: 'added' | 'removed' | 'modified' }) {
  const config = {
    added: { bg: 'bg-emerald-900/50 border-emerald-700/60 text-emerald-300', icon: Plus, label: 'Added' },
    removed: { bg: 'bg-red-900/50 border-red-700/60 text-red-300', icon: Minus, label: 'Removed' },
    modified: { bg: 'bg-yellow-900/50 border-yellow-700/60 text-yellow-300', icon: PenLine, label: 'Modified' },
  }[type];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${config.bg}`}>
      <config.icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function SwitchName({ name, id, before, after }: { name?: string; id: string; before?: ShowFile; after?: ShowFile }) {
  const resolvedName =
    name ??
    after?.switches.find((s) => s.switchId === id)?.name ??
    before?.switches.find((s) => s.switchId === id)?.name ??
    id;
  return <span className="font-mono text-sm">{resolvedName}</span>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ShowFileDiffViewer: React.FC<ShowFileDiffViewerProps> = ({ diff, before, after }) => {
  const hasChanges =
    diff.switchesAdded.length > 0 ||
    diff.switchesRemoved.length > 0 ||
    diff.switchesModified.length > 0 ||
    diff.vlansAdded.length > 0 ||
    diff.vlansRemoved.length > 0;

  if (!hasChanges) {
    return (
      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-6 text-center">
        <GitCompare className="w-8 h-8 text-gray-500 mx-auto mb-2" />
        <p className="text-gray-400 text-sm">No differences found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-3">
        <p className="text-sm text-gray-300">
          <GitCompare className="w-4 h-4 inline mr-1.5 text-gc-accent" />
          {diff.summary}
        </p>
      </div>

      {/* Side-by-side: Switches */}
      {(diff.switchesAdded.length > 0 || diff.switchesRemoved.length > 0 || diff.switchesModified.length > 0) && (
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-gray-800/80 border-b border-gray-700 flex items-center gap-2">
            <Network className="w-4 h-4 text-gc-accent" />
            <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Switch Changes</h4>
          </div>

          <div className="grid grid-cols-2 divide-x divide-gray-700">
            {/* Before column */}
            <div>
              <div className="px-3 py-1.5 bg-gray-800/60 border-b border-gray-700">
                <span className="text-xs font-medium text-gray-400">Before</span>
              </div>
              <div className="divide-y divide-gray-700/50">
                {diff.switchesRemoved.map((id) => (
                  <div key={id} className="flex items-center gap-2 px-3 py-2 bg-red-950/20">
                    <DiffBadge type="removed" />
                    <SwitchName id={id} before={before} after={after} />
                  </div>
                ))}
                {diff.switchesModified.map((mod) => {
                  const beforeSw = before?.switches.find((s) => s.switchId === mod.switchId);
                  return (
                    <div key={mod.switchId} className="px-3 py-2 bg-yellow-950/10">
                      <div className="flex items-center gap-2 mb-1">
                        <DiffBadge type="modified" />
                        <span className="font-mono text-sm text-gray-300">{beforeSw?.name ?? mod.switchId}</span>
                      </div>
                      <div className="ml-6 space-y-0.5">
                        {mod.changes.map((change, i) => {
                          const arrow = change.indexOf('->');
                          if (arrow > -1) {
                            return (
                              <p key={i} className="text-xs text-red-300/80 line-through">
                                {change.split('->')[0].trim()}
                              </p>
                            );
                          }
                          return (
                            <p key={i} className="text-xs text-gray-500">{change}</p>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {diff.switchesAdded.map((id) => (
                  <div key={id} className="flex items-center gap-2 px-3 py-2 opacity-30">
                    <span className="text-xs text-gray-600 italic">not present</span>
                  </div>
                ))}
              </div>
            </div>

            {/* After column */}
            <div>
              <div className="px-3 py-1.5 bg-gray-800/60 border-b border-gray-700">
                <span className="text-xs font-medium text-gray-400">After</span>
              </div>
              <div className="divide-y divide-gray-700/50">
                {diff.switchesRemoved.map((id) => (
                  <div key={id} className="flex items-center gap-2 px-3 py-2 opacity-30">
                    <span className="text-xs text-gray-600 italic">removed</span>
                  </div>
                ))}
                {diff.switchesModified.map((mod) => {
                  const afterSw = after?.switches.find((s) => s.switchId === mod.switchId);
                  return (
                    <div key={mod.switchId} className="px-3 py-2 bg-yellow-950/10">
                      <div className="flex items-center gap-2 mb-1">
                        <DiffBadge type="modified" />
                        <span className="font-mono text-sm text-gray-300">{afterSw?.name ?? mod.switchId}</span>
                      </div>
                      <div className="ml-6 space-y-0.5">
                        {mod.changes.map((change, i) => {
                          const arrow = change.indexOf('->');
                          if (arrow > -1) {
                            return (
                              <p key={i} className="text-xs text-emerald-300/80">
                                {change.split('->')[1].trim()}
                              </p>
                            );
                          }
                          return (
                            <p key={i} className="text-xs text-yellow-300/80">{change}</p>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {diff.switchesAdded.map((id) => (
                  <div key={id} className="flex items-center gap-2 px-3 py-2 bg-emerald-950/20">
                    <DiffBadge type="added" />
                    <SwitchName id={id} before={before} after={after} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VLAN changes */}
      {(diff.vlansAdded.length > 0 || diff.vlansRemoved.length > 0) && (
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-gray-800/80 border-b border-gray-700">
            <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">VLAN Changes</h4>
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-700">
            {/* Before VLANs */}
            <div>
              <div className="px-3 py-1.5 bg-gray-800/60 border-b border-gray-700">
                <span className="text-xs font-medium text-gray-400">Before</span>
              </div>
              <div className="p-3 space-y-1">
                {diff.vlansRemoved.map((vlanId) => {
                  const vlan = before?.vlans.find((v) => v.id === vlanId);
                  return (
                    <div key={vlanId} className="flex items-center gap-2 px-2 py-1 bg-red-950/20 rounded">
                      <DiffBadge type="removed" />
                      <span className="text-sm font-mono text-red-300">
                        VLAN {vlanId}{vlan ? ` (${vlan.name})` : ''}
                      </span>
                    </div>
                  );
                })}
                {diff.vlansAdded.map((vlanId) => (
                  <div key={vlanId} className="flex items-center gap-2 px-2 py-1 opacity-30">
                    <span className="text-xs text-gray-600 italic">not present</span>
                  </div>
                ))}
              </div>
            </div>

            {/* After VLANs */}
            <div>
              <div className="px-3 py-1.5 bg-gray-800/60 border-b border-gray-700">
                <span className="text-xs font-medium text-gray-400">After</span>
              </div>
              <div className="p-3 space-y-1">
                {diff.vlansRemoved.map((vlanId) => (
                  <div key={vlanId} className="flex items-center gap-2 px-2 py-1 opacity-30">
                    <span className="text-xs text-gray-600 italic">removed</span>
                  </div>
                ))}
                {diff.vlansAdded.map((vlanId) => {
                  const vlan = after?.vlans.find((v) => v.id === vlanId);
                  return (
                    <div key={vlanId} className="flex items-center gap-2 px-2 py-1 bg-emerald-950/20 rounded">
                      <DiffBadge type="added" />
                      <span className="text-sm font-mono text-emerald-300">
                        VLAN {vlanId}{vlan ? ` (${vlan.name})` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
