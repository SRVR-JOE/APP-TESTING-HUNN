import React, { useState, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Monitor,
  ArrowRight,
  CheckSquare,
  Square,
} from 'lucide-react';
import type { DiscoveredSwitch, SwitchProfile } from '@shared/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProfileApplyModalProps {
  profile: SwitchProfile;
  switches: DiscoveredSwitch[];
  isOpen: boolean;
  onClose: () => void;
  onApply: (switchIds: string[]) => void;
}

interface DiffEntry {
  field: string;
  port?: number;
  current: string;
  proposed: string;
}

// ─── Port count per model ───────────────────────────────────────────────────

const MODEL_PORT_COUNTS: Record<string, number> = {
  'GC-10': 10,
  'GC-10i': 10,
  'GC-14R': 14,
  'GC-16t': 16,
  'GC-16i': 16,
  'GC-18t': 18,
  'GC-20t': 20,
  'GC-26': 26,
  'GC-30i': 30,
};

function isModelCompatible(profileModel: string, switchModel: string): boolean {
  if (profileModel === 'Any') return true;
  return profileModel === switchModel;
}

function generateMockDiff(profile: SwitchProfile, sw: DiscoveredSwitch): DiffEntry[] {
  const diffs: DiffEntry[] = [];
  // Simulate some differences
  if (profile.portConfigs.length > 0) {
    diffs.push({
      field: 'VLAN Assignment',
      port: 1,
      current: 'VLAN 1 (Default)',
      proposed: `VLAN ${profile.portConfigs[0]?.vlan ?? 1}`,
    });
    diffs.push({
      field: 'Port Label',
      port: 1,
      current: '(none)',
      proposed: profile.portConfigs[0]?.label ?? 'Port 1',
    });
  }
  if (profile.vlans.length > 0) {
    diffs.push({
      field: 'VLAN Config',
      current: '1 VLAN defined',
      proposed: `${profile.vlans.length} VLANs defined`,
    });
  }
  diffs.push({
    field: 'PoE Policy',
    port: 3,
    current: 'Enabled',
    proposed: 'Disabled',
  });
  return diffs;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ProfileApplyModal({
  profile,
  switches,
  isOpen,
  onClose,
  onApply,
}: ProfileApplyModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewSwitch, setPreviewSwitch] = useState<string | null>(null);
  const [applyProgress, setApplyProgress] = useState<Record<string, 'pending' | 'applying' | 'done' | 'error'>>({});

  if (!isOpen) return null;

  const toggleSwitch = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApply = () => {
    setStep(3);
    const ids = Array.from(selectedIds);
    const progress: Record<string, 'pending' | 'applying' | 'done' | 'error'> = {};
    ids.forEach((id) => (progress[id] = 'pending'));
    setApplyProgress({ ...progress });

    // Simulate sequential application
    let i = 0;
    const applyNext = () => {
      if (i >= ids.length) {
        onApply(ids);
        return;
      }
      const currentId = ids[i];
      setApplyProgress((prev) => ({ ...prev, [currentId]: 'applying' }));
      setTimeout(() => {
        setApplyProgress((prev) => ({ ...prev, [currentId]: 'done' }));
        i++;
        applyNext();
      }, 800 + Math.random() * 400);
    };
    applyNext();
  };

  const allDone = Object.values(applyProgress).every((s) => s === 'done' || s === 'error');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[720px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-semibold">Apply Profile to Switches</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Profile: <span className="text-gc-accent">{profile.name}</span>
              {profile.model !== 'Any' && (
                <span className="ml-2 text-xs bg-gray-800 px-2 py-0.5 rounded">
                  {profile.model}
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-800 text-sm">
          {(['Select Switches', 'Preview Changes', 'Apply'] as const).map((label, idx) => {
            const stepNum = (idx + 1) as 1 | 2 | 3;
            const active = step === stepNum;
            const done = step > stepNum;
            return (
              <React.Fragment key={label}>
                {idx > 0 && <ChevronRight size={14} className="text-gray-600" />}
                <span
                  className={`flex items-center gap-1.5 ${
                    active
                      ? 'text-gc-accent font-medium'
                      : done
                      ? 'text-green-400'
                      : 'text-gray-500'
                  }`}
                >
                  {done ? <CheckCircle2 size={14} /> : null}
                  {label}
                </span>
              </React.Fragment>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {/* Step 1: Select Switches */}
          {step === 1 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-400 mb-3">
                Select the switches to apply this profile to. Incompatible models are marked.
              </p>
              {switches.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No switches discovered yet.</p>
              ) : (
                switches.map((sw) => {
                  const compatible = isModelCompatible(profile.model, sw.model);
                  const selected = selectedIds.has(sw.id);
                  return (
                    <button
                      key={sw.id}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition text-left ${
                        selected
                          ? 'border-gc-accent bg-gc-accent/5'
                          : 'border-gray-700 hover:border-gray-600'
                      } ${!compatible ? 'opacity-50' : ''}`}
                      onClick={() => compatible && toggleSwitch(sw.id)}
                      disabled={!compatible}
                    >
                      {selected ? (
                        <CheckSquare size={16} className="text-gc-accent shrink-0" />
                      ) : (
                        <Square size={16} className="text-gray-600 shrink-0" />
                      )}
                      <Monitor size={16} className="text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{sw.name}</div>
                        <div className="text-xs text-gray-500">
                          {sw.model} &middot; {sw.ip}
                        </div>
                      </div>
                      {!compatible && (
                        <span className="text-xs text-yellow-500 flex items-center gap-1">
                          <AlertTriangle size={12} /> Incompatible
                        </span>
                      )}
                      {compatible && (
                        <span className="text-xs text-green-500">
                          <CheckCircle2 size={12} />
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* Step 2: Preview Diff */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400 mb-3">
                Review the changes that will be applied to each switch.
              </p>
              <div className="flex gap-3">
                {/* Switch list */}
                <div className="w-48 shrink-0 space-y-1">
                  {Array.from(selectedIds).map((id) => {
                    const sw = switches.find((s) => s.id === id);
                    if (!sw) return null;
                    return (
                      <button
                        key={id}
                        className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                          previewSwitch === id
                            ? 'bg-gc-accent/10 text-gc-accent border border-gc-accent/30'
                            : 'hover:bg-gray-800 border border-transparent'
                        }`}
                        onClick={() => setPreviewSwitch(id)}
                      >
                        <div className="font-medium truncate">{sw.name}</div>
                        <div className="text-xs text-gray-500">{sw.model}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Diff table */}
                <div className="flex-1 min-w-0">
                  {previewSwitch ? (
                    (() => {
                      const sw = switches.find((s) => s.id === previewSwitch);
                      if (!sw) return null;
                      const diffs = generateMockDiff(profile, sw);
                      return (
                        <div className="border border-gray-700 rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-800">
                              <tr className="text-left text-gray-400 text-xs uppercase">
                                <th className="px-3 py-2">Setting</th>
                                <th className="px-3 py-2">Port</th>
                                <th className="px-3 py-2">Current</th>
                                <th className="px-3 py-2 w-6" />
                                <th className="px-3 py-2">Proposed</th>
                              </tr>
                            </thead>
                            <tbody>
                              {diffs.map((d, i) => (
                                <tr
                                  key={i}
                                  className="border-t border-gray-800 hover:bg-gray-800/50"
                                >
                                  <td className="px-3 py-1.5">{d.field}</td>
                                  <td className="px-3 py-1.5 font-mono text-gray-400">
                                    {d.port ?? '—'}
                                  </td>
                                  <td className="px-3 py-1.5 text-red-400">{d.current}</td>
                                  <td className="px-3 py-1.5">
                                    <ArrowRight size={12} className="text-gray-600" />
                                  </td>
                                  <td className="px-3 py-1.5 text-green-400">{d.proposed}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-gray-500 text-center py-12 text-sm">
                      Select a switch to preview changes
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Applying */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400 mb-3">
                {allDone ? 'Profile applied successfully.' : 'Applying profile to selected switches...'}
              </p>
              {Array.from(selectedIds).map((id) => {
                const sw = switches.find((s) => s.id === id);
                const status = applyProgress[id] ?? 'pending';
                return (
                  <div
                    key={id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-700"
                  >
                    {status === 'pending' && (
                      <span className="w-5 h-5 rounded-full border-2 border-gray-600" />
                    )}
                    {status === 'applying' && (
                      <Loader2 size={18} className="text-gc-accent animate-spin" />
                    )}
                    {status === 'done' && (
                      <CheckCircle2 size={18} className="text-green-400" />
                    )}
                    {status === 'error' && (
                      <AlertTriangle size={18} className="text-red-400" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{sw?.name ?? id}</div>
                      <div className="text-xs text-gray-500">{sw?.ip}</div>
                    </div>
                    <span
                      className={`text-xs ${
                        status === 'done'
                          ? 'text-green-400'
                          : status === 'applying'
                          ? 'text-gc-accent'
                          : status === 'error'
                          ? 'text-red-400'
                          : 'text-gray-500'
                      }`}
                    >
                      {status === 'pending' && 'Waiting...'}
                      {status === 'applying' && 'Applying...'}
                      {status === 'done' && 'Complete'}
                      {status === 'error' && 'Failed'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800">
          <button
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
            onClick={onClose}
          >
            {step === 3 && allDone ? 'Close' : 'Cancel'}
          </button>
          <div className="flex gap-2">
            {step === 2 && (
              <button
                className="px-4 py-2 text-sm rounded-lg border border-gray-700 hover:border-gray-600 transition"
                onClick={() => setStep(1)}
              >
                Back
              </button>
            )}
            {step === 1 && (
              <button
                className="px-4 py-2 text-sm rounded-lg bg-gc-accent text-gray-900 font-medium hover:bg-gc-accent/90 transition disabled:opacity-40"
                disabled={selectedIds.size === 0}
                onClick={() => {
                  setStep(2);
                  setPreviewSwitch(Array.from(selectedIds)[0] ?? null);
                }}
              >
                Next: Preview Changes
              </button>
            )}
            {step === 2 && (
              <button
                className="px-4 py-2 text-sm rounded-lg bg-gc-accent text-gray-900 font-medium hover:bg-gc-accent/90 transition"
                onClick={handleApply}
              >
                Apply to {selectedIds.size} Switch{selectedIds.size !== 1 ? 'es' : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
