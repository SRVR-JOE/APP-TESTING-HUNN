import React, { useState } from 'react';
import {
  X,
  Save,
  FolderOpen,
  Trash2,
  Download,
  Upload,
  GitCompare,
  Clock,
  FileText,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ShowPreset {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  switchConfigCount: number;
  profileCount: number;
  rackMapIncluded: boolean;
}

export interface ShowPresetManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onRecall: (presetId: string) => void;
  onSave: (name: string, description: string) => void;
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_PRESETS: ShowPreset[] = [
  {
    id: 'preset-1',
    name: 'Summer Tour 2025 - Main Stage',
    description:
      'Full FOH/Monitor/Stage setup for arena shows with 4 GigaCore switches, including broadcast feed.',
    createdAt: '2025-06-15T10:30:00Z',
    updatedAt: '2025-08-20T14:22:00Z',
    switchConfigCount: 4,
    profileCount: 3,
    rackMapIncluded: true,
  },
  {
    id: 'preset-2',
    name: 'Corporate AV Template',
    description:
      'Standard corporate event configuration with 2 switches for main room and breakout audio.',
    createdAt: '2025-03-10T09:00:00Z',
    updatedAt: '2025-03-10T09:00:00Z',
    switchConfigCount: 2,
    profileCount: 1,
    rackMapIncluded: false,
  },
  {
    id: 'preset-3',
    name: 'Festival Main + B-Stage',
    description:
      'Multi-stage festival setup with redundant networking, Dante primary/secondary, and IMAG feeds.',
    createdAt: '2025-07-01T08:00:00Z',
    updatedAt: '2025-09-12T16:45:00Z',
    switchConfigCount: 6,
    profileCount: 4,
    rackMapIncluded: true,
  },
];

// ─── Diff mock ──────────────────────────────────────────────────────────────

interface DiffItem {
  field: string;
  presetValue: string;
  currentValue: string;
  status: 'match' | 'differ';
}

function generateMockDiffForPreset(_presetId: string): DiffItem[] {
  return [
    { field: 'Switch Count', presetValue: '4', currentValue: '4', status: 'match' },
    {
      field: 'FOH Switch - VLAN Config',
      presetValue: '4 VLANs',
      currentValue: '3 VLANs',
      status: 'differ',
    },
    {
      field: 'Stage Box - Port 5 Label',
      presetValue: 'Dante Primary',
      currentValue: '(none)',
      status: 'differ',
    },
    {
      field: 'Monitor World - PoE Port 8',
      presetValue: 'Enabled',
      currentValue: 'Enabled',
      status: 'match',
    },
    {
      field: 'Rack Map Layout',
      presetValue: 'Included',
      currentValue: 'Modified',
      status: 'differ',
    },
  ];
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ShowPresetManager({
  isOpen,
  onClose,
  onRecall,
  onSave,
}: ShowPresetManagerProps) {
  const [activeTab, setActiveTab] = useState<'save' | 'load'>('load');
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [diffPreset, setDiffPreset] = useState<string | null>(null);
  const [presets, setPresets] = useState<ShowPreset[]>(MOCK_PRESETS);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!saveName.trim()) return;
    onSave(saveName.trim(), saveDescription.trim());
    setSaveName('');
    setSaveDescription('');
    // In real app, would refresh the preset list
  };

  const handleDelete = (id: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
    setDeleteConfirm(null);
    if (diffPreset === id) setDiffPreset(null);
  };

  const handleExportJson = (preset: ShowPreset) => {
    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${preset.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          const imported: ShowPreset = {
            id: `preset-imported-${Date.now()}`,
            name: data.name ?? 'Imported Preset',
            description: data.description ?? '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            switchConfigCount: data.switchConfigCount ?? 0,
            profileCount: data.profileCount ?? 0,
            rackMapIncluded: data.rackMapIncluded ?? false,
          };
          setPresets((prev) => [...prev, imported]);
        } catch {
          // noop — invalid JSON
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const diffItems = diffPreset ? generateMockDiffForPreset(diffPreset) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[700px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold">Show Presets</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          <button
            className={`flex-1 py-2.5 text-sm font-medium transition ${
              activeTab === 'load'
                ? 'text-gc-accent border-b-2 border-gc-accent'
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('load')}
          >
            <FolderOpen size={14} className="inline mr-1.5 -mt-0.5" />
            Load Preset
          </button>
          <button
            className={`flex-1 py-2.5 text-sm font-medium transition ${
              activeTab === 'save'
                ? 'text-gc-accent border-b-2 border-gc-accent'
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('save')}
          >
            <Save size={14} className="inline mr-1.5 -mt-0.5" />
            Save Preset
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {/* Save Tab */}
          {activeTab === 'save' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Preset Name</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-gc-accent"
                  placeholder="e.g. Summer Tour 2025 - Main Stage"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-gc-accent resize-none"
                  rows={3}
                  placeholder="Describe the show setup..."
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                />
              </div>

              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2">What will be saved:</h4>
                <ul className="space-y-1.5 text-sm text-gray-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-green-400" />
                    Switch configurations (port assignments, VLANs, PoE)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-green-400" />
                    Rack map layout (positions, connections, groups)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-green-400" />
                    Associated profiles
                  </li>
                </ul>
              </div>

              <button
                className="w-full py-2.5 rounded-lg bg-gc-accent text-gray-900 font-medium text-sm hover:bg-gc-accent/90 transition disabled:opacity-40"
                disabled={!saveName.trim()}
                onClick={handleSave}
              >
                <Save size={14} className="inline mr-1.5 -mt-0.5" />
                Save Current State as Preset
              </button>
            </div>
          )}

          {/* Load Tab */}
          {activeTab === 'load' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  className="text-xs text-gc-accent hover:underline flex items-center gap-1"
                  onClick={handleImportJson}
                >
                  <Upload size={12} />
                  Import from JSON
                </button>
              </div>

              {presets.length === 0 ? (
                <p className="text-gray-500 text-center py-8 text-sm">
                  No show presets saved yet.
                </p>
              ) : (
                presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{preset.name}</h4>
                        <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">
                          {preset.description}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {new Date(preset.updatedAt).toLocaleDateString()}
                          </span>
                          <span>{preset.switchConfigCount} switches</span>
                          <span>{preset.profileCount} profiles</span>
                          {preset.rackMapIncluded && (
                            <span className="text-gc-accent">+ rack map</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Diff view */}
                    {diffPreset === preset.id && (
                      <div className="mt-3 border border-gray-700 rounded-lg overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-800">
                            <tr className="text-gray-400">
                              <th className="text-left px-3 py-1.5">Setting</th>
                              <th className="text-left px-3 py-1.5">Preset</th>
                              <th className="text-left px-3 py-1.5">Current</th>
                              <th className="px-3 py-1.5 w-8" />
                            </tr>
                          </thead>
                          <tbody>
                            {diffItems.map((item, idx) => (
                              <tr key={idx} className="border-t border-gray-800">
                                <td className="px-3 py-1.5">{item.field}</td>
                                <td className="px-3 py-1.5">{item.presetValue}</td>
                                <td className="px-3 py-1.5">{item.currentValue}</td>
                                <td className="px-3 py-1.5 text-center">
                                  {item.status === 'match' ? (
                                    <CheckCircle2
                                      size={12}
                                      className="text-green-400 inline"
                                    />
                                  ) : (
                                    <AlertTriangle
                                      size={12}
                                      className="text-yellow-400 inline"
                                    />
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Delete confirm */}
                    {deleteConfirm === preset.id && (
                      <div className="mt-3 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2 flex items-center justify-between">
                        <span className="text-sm text-red-300">
                          Delete "{preset.name}"? This cannot be undone.
                        </span>
                        <div className="flex gap-2">
                          <button
                            className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-500"
                            onClick={() => handleDelete(preset.id)}
                          >
                            Delete
                          </button>
                          <button
                            className="px-3 py-1 text-xs rounded border border-gray-600 hover:border-gray-500"
                            onClick={() => setDeleteConfirm(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        className="px-3 py-1.5 text-xs rounded-lg bg-gc-accent text-gray-900 font-medium hover:bg-gc-accent/90"
                        onClick={() => onRecall(preset.id)}
                      >
                        <FolderOpen size={12} className="inline mr-1 -mt-0.5" />
                        Load
                      </button>
                      <button
                        className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                          diffPreset === preset.id
                            ? 'border-gc-accent text-gc-accent'
                            : 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                        }`}
                        onClick={() =>
                          setDiffPreset(diffPreset === preset.id ? null : preset.id)
                        }
                      >
                        <GitCompare size={12} className="inline mr-1 -mt-0.5" />
                        Diff
                      </button>
                      <button
                        className="px-3 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600"
                        onClick={() => handleExportJson(preset)}
                      >
                        <Download size={12} className="inline mr-1 -mt-0.5" />
                        Export
                      </button>
                      <button
                        className="px-3 py-1.5 text-xs rounded-lg border border-gray-700 text-red-400 hover:text-red-300 hover:border-red-800"
                        onClick={() =>
                          setDeleteConfirm(deleteConfirm === preset.id ? null : preset.id)
                        }
                      >
                        <Trash2 size={12} className="inline mr-1 -mt-0.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-gray-800">
          <button
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
