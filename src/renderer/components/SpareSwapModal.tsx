import React, { useState, useMemo } from 'react';
import {
  X, ArrowRight, AlertTriangle, CheckCircle, RefreshCw, Server, Package,
} from 'lucide-react';
import type { FleetAsset, SpareSwitchConfig } from '@shared/types';
import { useFleetStore } from '../store/useFleetStore';
import { SWITCH_ROLE_TEMPLATES } from '@shared/constants';

interface SpareSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'select-failed' | 'select-spare' | 'preview' | 'done';

export const SpareSwapModal: React.FC<SpareSwapModalProps> = ({ isOpen, onClose }) => {
  const { assets, spares, updateAsset, deploySpare } = useFleetStore();

  const [step, setStep] = useState<Step>('select-failed');
  const [failedId, setFailedId] = useState<string | null>(null);
  const [spareId, setSpareId] = useState<string | null>(null);

  const failedCandidates = useMemo(
    () => assets.filter((a) => a.status === 'deployed' || a.status === 'maintenance'),
    [assets],
  );
  const readySpares = useMemo(
    () => spares.filter((s) => s.status === 'ready'),
    [spares],
  );

  const failedAsset = assets.find((a) => a.id === failedId);
  const selectedSpare = spares.find((s) => s.id === spareId);

  const roleTemplate = selectedSpare
    ? SWITCH_ROLE_TEMPLATES.find((t) => t.role === selectedSpare.replacesRole)
    : null;

  function handleConfirm() {
    if (!failedId || !spareId) return;
    updateAsset(failedId, { status: 'maintenance' });
    deploySpare(spareId);
    setStep('done');
  }

  function handleReset() {
    setStep('select-failed');
    setFailedId(null);
    setSpareId(null);
  }

  function handleClose() {
    handleReset();
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gc-dark border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-gc-accent" />
            <h2 className="text-white font-semibold text-lg">Hot-Swap Spare</h2>
          </div>
          <button onClick={handleClose} className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-gray-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 py-3 border-b border-gray-700/50">
          <div className="flex items-center gap-2 text-xs">
            {(['select-failed', 'select-spare', 'preview', 'done'] as Step[]).map((s, i) => (
              <React.Fragment key={s}>
                {i > 0 && <div className={`flex-1 h-px ${step === s || (['select-spare', 'preview', 'done'].indexOf(step) >= i - 0) ? 'bg-gc-accent' : 'bg-gray-700'}`} />}
                <span className={`px-2 py-1 rounded-full ${step === s ? 'bg-gc-accent/20 text-gc-accent font-medium' : 'text-gray-500'}`}>
                  {i + 1}. {s === 'select-failed' ? 'Failed Switch' : s === 'select-spare' ? 'Select Spare' : s === 'preview' ? 'Preview' : 'Complete'}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Step 1: Select failed switch */}
          {step === 'select-failed' && (
            <div>
              <p className="text-gray-400 text-sm mb-4">Select the switch that needs to be replaced:</p>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {failedCandidates.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => { setFailedId(a.id); setStep('select-spare'); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left
                      ${failedId === a.id
                        ? 'border-gc-accent bg-gc-accent/10'
                        : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
                      }`}
                  >
                    <Server className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{a.serial}</p>
                      <p className="text-gray-500 text-xs">{a.model} &mdash; {a.mac}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === 'maintenance' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>
                      {a.status}
                    </span>
                    {a.location && <span className="text-xs text-gray-500">{a.location}</span>}
                  </button>
                ))}
                {failedCandidates.length === 0 && (
                  <p className="text-gray-600 text-sm text-center py-8">No deployed or maintenance switches found.</p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Select spare */}
          {step === 'select-spare' && (
            <div>
              <p className="text-gray-400 text-sm mb-4">
                Replacing <span className="text-white font-medium">{failedAsset?.serial}</span> ({failedAsset?.model}).
                Select a spare:
              </p>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {readySpares.map((sp) => (
                  <button
                    key={sp.id}
                    onClick={() => { setSpareId(sp.id); setStep('preview'); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left
                      ${spareId === sp.id
                        ? 'border-gc-accent bg-gc-accent/10'
                        : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
                      }`}
                  >
                    <Package className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{sp.spareName}</p>
                      <p className="text-gray-500 text-xs">{sp.model} &mdash; {sp.spareMAC}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                      {sp.replacesRole}
                    </span>
                  </button>
                ))}
                {readySpares.length === 0 && (
                  <p className="text-gray-600 text-sm text-center py-8">No ready spares available.</p>
                )}
              </div>
              <button onClick={() => setStep('select-failed')} className="mt-4 text-sm text-gray-400 hover:text-white transition-colors">
                &larr; Back
              </button>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && failedAsset && selectedSpare && (
            <div>
              <p className="text-gray-400 text-sm mb-5">Review the hot-swap configuration transfer:</p>

              <div className="flex items-center gap-4 mb-6">
                {/* Failed */}
                <div className="flex-1 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
                  <p className="text-xs text-red-400 uppercase tracking-wider mb-2">Failed Switch</p>
                  <p className="text-white font-semibold">{failedAsset.serial}</p>
                  <p className="text-gray-400 text-xs">{failedAsset.model}</p>
                  <p className="text-gray-500 text-xs font-mono mt-1">{failedAsset.mac}</p>
                  {failedAsset.location && <p className="text-gray-500 text-xs mt-1">{failedAsset.location}</p>}
                </div>

                <ArrowRight className="w-6 h-6 text-gc-accent flex-shrink-0" />

                {/* Spare */}
                <div className="flex-1 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <p className="text-xs text-emerald-400 uppercase tracking-wider mb-2">Replacement Spare</p>
                  <p className="text-white font-semibold">{selectedSpare.spareName}</p>
                  <p className="text-gray-400 text-xs">{selectedSpare.model}</p>
                  <p className="text-gray-500 text-xs font-mono mt-1">{selectedSpare.spareMAC}</p>
                </div>
              </div>

              {/* Config transfer details */}
              <div className="rounded-lg border border-gray-700 bg-gray-800/40 p-4 mb-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Configuration Transfer</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Role</span>
                    <span className="text-white">{roleTemplate?.name ?? selectedSpare.replacesRole}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Profile</span>
                    <span className="text-white">{selectedSpare.preloadedProfileId ?? 'None'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">IP Assignment</span>
                    <span className="text-white">Will inherit from failed switch</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">VLAN Config</span>
                    <span className="text-white">
                      {roleTemplate ? `${roleTemplate.vlanPresets.length} presets` : 'From profile'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tour Assignment</span>
                    <span className="text-white">{failedAsset.currentTourId ?? 'None'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Location</span>
                    <span className="text-white">{failedAsset.location ?? 'Unset'}</span>
                  </div>
                </div>
              </div>

              {selectedSpare.model !== failedAsset.model && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 mb-4">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-300">
                    Model mismatch: failed switch is <strong>{failedAsset.model}</strong> but spare is <strong>{selectedSpare.model}</strong>.
                    Port configuration may need adjustment.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button onClick={() => setStep('select-spare')} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-600 rounded-lg hover:border-gray-400 transition-colors">
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-gc-accent hover:bg-gc-accent/80 text-white rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Confirm Hot-Swap
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-10">
              <CheckCircle className="w-12 h-12 text-emerald-400 mb-4" />
              <h3 className="text-white text-lg font-semibold mb-2">Hot-Swap Complete</h3>
              <p className="text-gray-400 text-sm text-center max-w-md mb-6">
                <strong>{selectedSpare?.spareName}</strong> has been deployed to replace <strong>{failedAsset?.serial}</strong>.
                The failed switch has been moved to maintenance status.
              </p>
              <button
                onClick={handleClose}
                className="px-6 py-2 text-sm font-medium bg-gc-accent hover:bg-gc-accent/80 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpareSwapModal;
