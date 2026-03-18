import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Download,
  Upload,
  Search,
  Copy,
  FileSpreadsheet,
  Trash2,
  Save,
  Send,
  ChevronDown,
  Tag,
  X,
  FileText,
  Eye,
} from 'lucide-react';
import ProfilePortTable, {
  type ProfilePortConfig,
  type GroupConfig,
} from '../components/ProfilePortTable';
import ProfileApplyModal from '../components/ProfileApplyModal';
import { useAppStore } from '../store/useAppStore';

// ─── Constants ──────────────────────────────────────────────────────────────

const TARGET_MODELS = [
  'Any',
  'GC-10',
  'GC-10i',
  'GC-14R',
  'GC-16t',
  'GC-16i',
  'GC-18t',
  'GC-20t',
  'GC-26',
  'GC-30i',
] as const;

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
  Any: 16,
};

const CATEGORIES = ['Tour', 'Festival', 'Corporate', 'Broadcast', 'Install', 'Template'] as const;
type Category = (typeof CATEGORIES)[number];

// ─── Profile type (local, richer than shared SwitchProfile) ─────────────────

interface LocalProfile {
  id: string;
  name: string;
  description: string;
  model: string;
  category: Category;
  ports: ProfilePortConfig[];
  groups: GroupConfig[];
  igmpSettings: IgmpGroupSetting[];
  createdAt: string;
  updatedAt: string;
}

interface IgmpGroupSetting {
  groupId: number;
  groupName: string;
  snoopingEnabled: boolean;
  querierEnabled: boolean;
  fastLeave: boolean;
  maxGroups: number;
  queryInterval: number;
}

// ─── Solotech default groups ────────────────────────────────────────────────

const SOLOTECH_DEFAULT_GROUPS: GroupConfig[] = [
  { id: 1, name: 'Default', vlanId: 1, color: '#6b7280', igmpSnooping: false, querier: false, flooding: true },
  { id: 2, name: 'Dante Primary', vlanId: 100, color: '#ef4444', igmpSnooping: true, querier: true, flooding: false },
  { id: 3, name: 'Dante Secondary', vlanId: 200, color: '#f97316', igmpSnooping: true, querier: false, flooding: false },
  { id: 4, name: 'Control', vlanId: 50, color: '#3b82f6', igmpSnooping: false, querier: false, flooding: true },
  { id: 5, name: 'AES67', vlanId: 110, color: '#8b5cf6', igmpSnooping: true, querier: true, flooding: false },
  { id: 6, name: 'Video/NDI', vlanId: 300, color: '#10b981', igmpSnooping: true, querier: false, flooding: false },
];

function generateDefaultIgmpSettings(groups: GroupConfig[]): IgmpGroupSetting[] {
  return groups.map((g) => ({
    groupId: g.id,
    groupName: g.name,
    snoopingEnabled: g.igmpSnooping,
    querierEnabled: g.querier,
    fastLeave: g.igmpSnooping,
    maxGroups: 256,
    queryInterval: 125,
  }));
}

function createPorts(count: number, groups: GroupConfig[]): ProfilePortConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    port: i + 1,
    label: '',
    groupId: groups[0]?.id ?? 1,
    mode: 'access' as const,
    trunkGroups: [],
    poeEnabled: true,
    speed: 'auto' as const,
    igmpSnooping: false,
  }));
}

// ─── Mock profiles ──────────────────────────────────────────────────────────

function buildMockProfiles(): LocalProfile[] {
  // 1. Solotech Standard FOH
  const fohGroups = [...SOLOTECH_DEFAULT_GROUPS];
  const fohPorts: ProfilePortConfig[] = createPorts(16, fohGroups);
  // realistic assignments
  fohPorts[0] = { ...fohPorts[0], label: 'Console Dante 1', groupId: 2, igmpSnooping: true };
  fohPorts[1] = { ...fohPorts[1], label: 'Console Dante 2', groupId: 3, igmpSnooping: true };
  fohPorts[2] = { ...fohPorts[2], label: 'Console Control', groupId: 4 };
  fohPorts[3] = { ...fohPorts[3], label: 'System Processor', groupId: 2, igmpSnooping: true };
  fohPorts[4] = { ...fohPorts[4], label: 'Recording PC', groupId: 2, igmpSnooping: true };
  fohPorts[5] = { ...fohPorts[5], label: 'Wireless Mic RX', groupId: 2, poeEnabled: true };
  fohPorts[6] = { ...fohPorts[6], label: 'Stage Link 1', groupId: 2, mode: 'trunk', trunkGroups: [2, 3, 4] };
  fohPorts[7] = { ...fohPorts[7], label: 'Stage Link 2', groupId: 3, mode: 'trunk', trunkGroups: [2, 3, 4] };
  fohPorts[14] = { ...fohPorts[14], label: 'SFP Uplink A', groupId: 2, speed: '10G', mode: 'trunk', trunkGroups: [2, 3, 4, 5] };
  fohPorts[15] = { ...fohPorts[15], label: 'SFP Uplink B', groupId: 3, speed: '10G', mode: 'trunk', trunkGroups: [2, 3, 4, 5] };

  // 2. Stage Box
  const stageGroups = [...SOLOTECH_DEFAULT_GROUPS];
  const stagePorts = createPorts(16, stageGroups);
  stagePorts[0] = { ...stagePorts[0], label: 'Stage Box Dante A', groupId: 2, igmpSnooping: true };
  stagePorts[1] = { ...stagePorts[1], label: 'Stage Box Dante B', groupId: 3, igmpSnooping: true };
  stagePorts[2] = { ...stagePorts[2], label: 'IEM TX 1', groupId: 2 };
  stagePorts[3] = { ...stagePorts[3], label: 'IEM TX 2', groupId: 2 };
  stagePorts[4] = { ...stagePorts[4], label: 'RF Mic RX 1', groupId: 4, poeEnabled: true };
  stagePorts[5] = { ...stagePorts[5], label: 'RF Mic RX 2', groupId: 4, poeEnabled: true };
  stagePorts[6] = { ...stagePorts[6], label: 'FOH Link 1', groupId: 2, mode: 'trunk', trunkGroups: [2, 3, 4] };
  stagePorts[7] = { ...stagePorts[7], label: 'Monitor Link', groupId: 2, mode: 'trunk', trunkGroups: [2, 3, 4] };

  // 3. Monitor World
  const monGroups = [...SOLOTECH_DEFAULT_GROUPS];
  const monPorts = createPorts(10, monGroups);
  monPorts[0] = { ...monPorts[0], label: 'Monitor Console Dante 1', groupId: 2, igmpSnooping: true };
  monPorts[1] = { ...monPorts[1], label: 'Monitor Console Dante 2', groupId: 3, igmpSnooping: true };
  monPorts[2] = { ...monPorts[2], label: 'Monitor Console Ctrl', groupId: 4 };
  monPorts[3] = { ...monPorts[3], label: 'Wedge Amp 1', groupId: 2 };
  monPorts[4] = { ...monPorts[4], label: 'Wedge Amp 2', groupId: 2 };
  monPorts[5] = { ...monPorts[5], label: 'Sidecar', groupId: 2 };
  monPorts[8] = { ...monPorts[8], label: 'Stage Link', groupId: 2, mode: 'trunk', trunkGroups: [2, 3, 4], speed: '10G' };
  monPorts[9] = { ...monPorts[9], label: 'FOH Link', groupId: 2, mode: 'trunk', trunkGroups: [2, 3, 4], speed: '10G' };

  // 4. Broadcast / IMAG
  const bcGroups: GroupConfig[] = [
    ...SOLOTECH_DEFAULT_GROUPS,
    { id: 7, name: 'IMAG', vlanId: 400, color: '#ec4899', igmpSnooping: true, querier: false, flooding: false },
  ];
  const bcPorts = createPorts(26, bcGroups);
  bcPorts[0] = { ...bcPorts[0], label: 'Camera 1 NDI', groupId: 6, igmpSnooping: true, poeEnabled: true };
  bcPorts[1] = { ...bcPorts[1], label: 'Camera 2 NDI', groupId: 6, igmpSnooping: true, poeEnabled: true };
  bcPorts[2] = { ...bcPorts[2], label: 'Camera 3 NDI', groupId: 6, igmpSnooping: true, poeEnabled: true };
  bcPorts[3] = { ...bcPorts[3], label: 'Camera 4 NDI', groupId: 6, igmpSnooping: true, poeEnabled: true };
  bcPorts[4] = { ...bcPorts[4], label: 'Video Switcher', groupId: 6 };
  bcPorts[5] = { ...bcPorts[5], label: 'Graphics PC', groupId: 6 };
  bcPorts[6] = { ...bcPorts[6], label: 'IMAG Projector 1', groupId: 7 };
  bcPorts[7] = { ...bcPorts[7], label: 'IMAG Projector 2', groupId: 7 };
  bcPorts[8] = { ...bcPorts[8], label: 'Recording Server', groupId: 6 };
  bcPorts[9] = { ...bcPorts[9], label: 'Audio Dante Feed', groupId: 2, igmpSnooping: true };
  bcPorts[10] = { ...bcPorts[10], label: 'Comms Base Station', groupId: 4, poeEnabled: true };
  bcPorts[24] = { ...bcPorts[24], label: 'SFP Uplink A', groupId: 2, speed: '10G', mode: 'trunk', trunkGroups: [2, 3, 4, 6, 7] };
  bcPorts[25] = { ...bcPorts[25], label: 'SFP Uplink B', groupId: 3, speed: '10G', mode: 'trunk', trunkGroups: [2, 3, 4, 6, 7] };

  return [
    {
      id: 'profile-foh',
      name: 'Solotech Standard FOH',
      description: 'Standard front-of-house network configuration for tour sound. 6-group Dante/Control/AES67 setup.',
      model: 'GC-16t',
      category: 'Tour',
      ports: fohPorts,
      groups: fohGroups,
      igmpSettings: generateDefaultIgmpSettings(fohGroups),
      createdAt: '2025-01-15T10:00:00Z',
      updatedAt: '2025-11-20T14:30:00Z',
    },
    {
      id: 'profile-stage',
      name: 'Stage Box',
      description: 'Stage-side GigaCore for Dante stage boxes, IEM transmitters, and RF mic receivers.',
      model: 'GC-16t',
      category: 'Tour',
      ports: stagePorts,
      groups: stageGroups,
      igmpSettings: generateDefaultIgmpSettings(stageGroups),
      createdAt: '2025-01-15T10:30:00Z',
      updatedAt: '2025-10-05T09:15:00Z',
    },
    {
      id: 'profile-mon',
      name: 'Monitor World',
      description: 'Monitor engineer position — console, wedge amps, sidecar, with trunk links to FOH and stage.',
      model: 'GC-10',
      category: 'Tour',
      ports: monPorts,
      groups: monGroups,
      igmpSettings: generateDefaultIgmpSettings(monGroups),
      createdAt: '2025-02-10T08:00:00Z',
      updatedAt: '2025-09-18T11:45:00Z',
    },
    {
      id: 'profile-broadcast',
      name: 'Broadcast / IMAG',
      description: 'Broadcast and IMAG distribution with NDI camera feeds, video switching, and IMAG projection.',
      model: 'GC-26',
      category: 'Broadcast',
      ports: bcPorts,
      groups: bcGroups,
      igmpSettings: generateDefaultIgmpSettings(bcGroups),
      createdAt: '2025-03-01T12:00:00Z',
      updatedAt: '2025-12-01T16:00:00Z',
    },
  ];
}

// ─── Tabs ───────────────────────────────────────────────────────────────────

type EditorTab = 'ports' | 'groups' | 'igmp' | 'summary';

const EDITOR_TABS: { key: EditorTab; label: string }[] = [
  { key: 'ports', label: 'Port Configuration' },
  { key: 'groups', label: 'Group Definitions' },
  { key: 'igmp', label: 'IGMP Settings' },
  { key: 'summary', label: 'Summary' },
];

// ─── Context Menu ───────────────────────────────────────────────────────────

function ContextMenu({
  x,
  y,
  onDuplicate,
  onExportExcel,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  onDuplicate: () => void;
  onExportExcel: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      <button
        className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-700 flex items-center gap-2"
        onClick={() => {
          onDuplicate();
          onClose();
        }}
      >
        <Copy size={14} className="text-gray-400" /> Duplicate
      </button>
      <button
        className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-700 flex items-center gap-2"
        onClick={() => {
          onExportExcel();
          onClose();
        }}
      >
        <FileSpreadsheet size={14} className="text-gray-400" /> Export to Excel
      </button>
      <hr className="border-gray-700 my-1" />
      <button
        className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-700 flex items-center gap-2 text-red-400"
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        <Trash2 size={14} /> Delete
      </button>
    </div>
  );
}

// ─── Color Picker Cell ──────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
  '#f43f5e', '#6b7280',
];

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        className="w-6 h-6 rounded border border-gray-600 hover:border-gray-500"
        style={{ backgroundColor: value }}
        onClick={() => setOpen(!open)}
      />
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-2 grid grid-cols-6 gap-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              className={`w-6 h-6 rounded border ${
                c === value ? 'border-white' : 'border-transparent hover:border-gray-500'
              }`}
              style={{ backgroundColor: c }}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ProfilesView() {
  const switches = useAppStore((s) => s.switches);

  const [profiles, setProfiles] = useState<LocalProfile[]>(buildMockProfiles);
  const [selectedId, setSelectedId] = useState<string>(profiles[0]?.id ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<EditorTab>('ports');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    profileId: string;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [applyModalOpen, setApplyModalOpen] = useState(false);

  const selected = useMemo(
    () => profiles.find((p) => p.id === selectedId) ?? null,
    [profiles, selectedId]
  );

  const filteredProfiles = useMemo(() => {
    if (!searchQuery.trim()) return profiles;
    const q = searchQuery.toLowerCase();
    return profiles.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.model.toLowerCase().includes(q)
    );
  }, [profiles, searchQuery]);

  // ─── Profile mutations ──────────────────────────────────────────────────

  const updateProfile = useCallback(
    (id: string, updates: Partial<LocalProfile>) => {
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
        )
      );
    },
    []
  );

  const createNewProfile = useCallback(() => {
    const newId = `profile-${Date.now()}`;
    const groups = [...SOLOTECH_DEFAULT_GROUPS];
    const ports = createPorts(16, groups);
    const newProfile: LocalProfile = {
      id: newId,
      name: 'New Profile',
      description: '',
      model: 'Any',
      category: 'Template',
      ports,
      groups,
      igmpSettings: generateDefaultIgmpSettings(groups),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProfiles((prev) => [newProfile, ...prev]);
    setSelectedId(newId);
    setActiveTab('ports');
  }, []);

  const duplicateProfile = useCallback(
    (id: string) => {
      const source = profiles.find((p) => p.id === id);
      if (!source) return;
      const newId = `profile-${Date.now()}`;
      const dup: LocalProfile = {
        ...source,
        id: newId,
        name: `${source.name} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setProfiles((prev) => [dup, ...prev]);
      setSelectedId(newId);
    },
    [profiles]
  );

  const deleteProfile = useCallback(
    (id: string) => {
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      if (selectedId === id) {
        setSelectedId(profiles.find((p) => p.id !== id)?.id ?? '');
      }
      setDeleteConfirm(false);
    },
    [selectedId, profiles]
  );

  const handleModelChange = useCallback(
    (model: string) => {
      if (!selected) return;
      const portCount = MODEL_PORT_COUNTS[model] ?? 16;
      const currentPorts = selected.ports;
      let newPorts: ProfilePortConfig[];
      if (portCount > currentPorts.length) {
        newPorts = [
          ...currentPorts,
          ...createPorts(portCount - currentPorts.length, selected.groups).map((p, i) => ({
            ...p,
            port: currentPorts.length + i + 1,
          })),
        ];
      } else {
        newPorts = currentPorts.slice(0, portCount);
      }
      updateProfile(selected.id, { model, ports: newPorts });
    },
    [selected, updateProfile]
  );

  // ─── Port updates ──────────────────────────────────────────────────────

  const handlePortUpdate = useCallback(
    (portNumber: number, updates: Partial<ProfilePortConfig>) => {
      if (!selected) return;
      const newPorts = selected.ports.map((p) =>
        p.port === portNumber ? { ...p, ...updates } : p
      );
      updateProfile(selected.id, { ports: newPorts });
    },
    [selected, updateProfile]
  );

  const handleBulkUpdate = useCallback(
    (portNumbers: number[], updates: Partial<ProfilePortConfig>) => {
      if (!selected) return;
      const set = new Set(portNumbers);
      const newPorts = selected.ports.map((p) =>
        set.has(p.port) ? { ...p, ...updates } : p
      );
      updateProfile(selected.id, { ports: newPorts });
    },
    [selected, updateProfile]
  );

  // ─── Group updates ─────────────────────────────────────────────────────

  const handleGroupUpdate = useCallback(
    (groupId: number, updates: Partial<GroupConfig>) => {
      if (!selected) return;
      const newGroups = selected.groups.map((g) =>
        g.id === groupId ? { ...g, ...updates } : g
      );
      updateProfile(selected.id, { groups: newGroups });
    },
    [selected, updateProfile]
  );

  const addGroup = useCallback(() => {
    if (!selected) return;
    const maxId = Math.max(...selected.groups.map((g) => g.id), 0);
    const newGroup: GroupConfig = {
      id: maxId + 1,
      name: `Group ${maxId + 1}`,
      vlanId: (maxId + 1) * 100,
      color: PRESET_COLORS[maxId % PRESET_COLORS.length],
      igmpSnooping: false,
      querier: false,
      flooding: true,
    };
    updateProfile(selected.id, {
      groups: [...selected.groups, newGroup],
      igmpSettings: [
        ...selected.igmpSettings,
        {
          groupId: newGroup.id,
          groupName: newGroup.name,
          snoopingEnabled: false,
          querierEnabled: false,
          fastLeave: false,
          maxGroups: 256,
          queryInterval: 125,
        },
      ],
    });
  }, [selected, updateProfile]);

  const removeGroup = useCallback(
    (groupId: number) => {
      if (!selected) return;
      if (selected.groups.length <= 1) return;
      const fallback = selected.groups.find((g) => g.id !== groupId)?.id ?? 1;
      const newPorts = selected.ports.map((p) =>
        p.groupId === groupId ? { ...p, groupId: fallback } : p
      );
      updateProfile(selected.id, {
        groups: selected.groups.filter((g) => g.id !== groupId),
        igmpSettings: selected.igmpSettings.filter((s) => s.groupId !== groupId),
        ports: newPorts,
      });
    },
    [selected, updateProfile]
  );

  // ─── IGMP updates ─────────────────────────────────────────────────────

  const handleIgmpUpdate = useCallback(
    (groupId: number, updates: Partial<IgmpGroupSetting>) => {
      if (!selected) return;
      const newSettings = selected.igmpSettings.map((s) =>
        s.groupId === groupId ? { ...s, ...updates } : s
      );
      updateProfile(selected.id, { igmpSettings: newSettings });
    },
    [selected, updateProfile]
  );

  // ─── Convert to shared SwitchProfile for the modal ────────────────────

  const toSharedProfile = useCallback(() => {
    if (!selected) return null;
    return {
      id: selected.id,
      name: selected.name,
      description: selected.description,
      model: selected.model,
      generation: 2 as const,
      portConfigs: selected.ports.map((p) => ({
        port: p.port,
        vlan: p.groupId,
        taggedVlans: p.trunkGroups,
        poeEnabled: p.poeEnabled,
        enabled: true,
        label: p.label,
        speed: p.speed,
      })),
      vlans: selected.groups.map((g) => ({
        id: g.vlanId,
        name: g.name,
        tagged: [],
        untagged: [],
      })),
      createdAt: selected.createdAt,
      updatedAt: selected.updatedAt,
    };
  }, [selected]);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full -m-6">
      {/* ─── Sidebar ─────────────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 border-r border-gray-800 flex flex-col bg-gray-900/80">
        {/* Header */}
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={20} className="text-gc-accent" />
            <h2 className="text-lg font-semibold">Profiles</h2>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-sm outline-none focus:border-gc-accent"
              placeholder="Search profiles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-1.5">
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-gc-accent text-gray-900 font-medium hover:bg-gc-accent/90 transition"
              onClick={createNewProfile}
            >
              <Plus size={14} /> New Profile
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-gray-700 text-gray-300 hover:border-gray-600 transition">
              <Download size={14} /> Import from Switch
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-gray-700 text-gray-300 hover:border-gray-600 transition">
              <FileSpreadsheet size={14} /> Import from Excel
            </button>
          </div>
        </div>

        {/* Profile list */}
        <div className="flex-1 overflow-auto px-2 pb-2">
          {filteredProfiles.map((p) => (
            <button
              key={p.id}
              className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition ${
                selectedId === p.id
                  ? 'bg-gc-accent/10 border border-gc-accent/30'
                  : 'hover:bg-gray-800 border border-transparent'
              }`}
              onClick={() => {
                setSelectedId(p.id);
                setActiveTab('ports');
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, profileId: p.id });
              }}
            >
              <div className="font-medium text-sm truncate">{p.name}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded">
                  {p.model}
                </span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    p.category === 'Tour'
                      ? 'bg-blue-900/30 text-blue-400'
                      : p.category === 'Festival'
                      ? 'bg-purple-900/30 text-purple-400'
                      : p.category === 'Broadcast'
                      ? 'bg-pink-900/30 text-pink-400'
                      : p.category === 'Corporate'
                      ? 'bg-green-900/30 text-green-400'
                      : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {p.category}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {new Date(p.updatedAt).toLocaleDateString()}
              </div>
            </button>
          ))}
          {filteredProfiles.length === 0 && (
            <p className="text-gray-500 text-center text-sm py-6">No profiles found</p>
          )}
        </div>
      </div>

      {/* ─── Context Menu ────────────────────────────────────────────────── */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onDuplicate={() => duplicateProfile(contextMenu.profileId)}
          onExportExcel={() => {
            /* noop */
          }}
          onDelete={() => {
            setSelectedId(contextMenu.profileId);
            setDeleteConfirm(true);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* ─── Editor ──────────────────────────────────────────────────────── */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-gray-800">
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0 space-y-3">
                {/* Name */}
                <input
                  className="text-xl font-bold bg-transparent border-b border-transparent hover:border-gray-700 focus:border-gc-accent outline-none w-full pb-0.5 transition"
                  value={selected.name}
                  onChange={(e) => updateProfile(selected.id, { name: e.target.value })}
                />
                {/* Description */}
                <input
                  className="text-sm text-gray-400 bg-transparent border-b border-transparent hover:border-gray-700 focus:border-gc-accent outline-none w-full pb-0.5 transition"
                  placeholder="Add a description..."
                  value={selected.description}
                  onChange={(e) =>
                    updateProfile(selected.id, { description: e.target.value })
                  }
                />
                {/* Model + category */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-sm text-gray-400">
                    Target:
                    <select
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white outline-none focus:border-gc-accent"
                      value={selected.model}
                      onChange={(e) => handleModelChange(e.target.value)}
                    >
                      {TARGET_MODELS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-gray-400">
                    <Tag size={14} />
                    <select
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white outline-none focus:border-gc-accent"
                      value={selected.category}
                      onChange={(e) =>
                        updateProfile(selected.id, {
                          category: e.target.value as Category,
                        })
                      }
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="text-xs text-gray-500">
                    {selected.ports.length} ports &middot; {selected.groups.length} groups
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-800 px-6">
            {EDITOR_TABS.map((tab) => (
              <button
                key={tab.key}
                className={`px-4 py-2.5 text-sm font-medium transition border-b-2 ${
                  activeTab === tab.key
                    ? 'text-gc-accent border-gc-accent'
                    : 'text-gray-400 border-transparent hover:text-white'
                }`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto px-6 py-4">
            {/* ── Port Configuration ───────────────────────────────────── */}
            {activeTab === 'ports' && (
              <ProfilePortTable
                ports={selected.ports}
                groups={selected.groups}
                onPortUpdate={handlePortUpdate}
                onBulkUpdate={handleBulkUpdate}
                model={selected.model}
              />
            )}

            {/* ── Group Definitions ────────────────────────────────────── */}
            {activeTab === 'groups' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-400">
                    Group / VLAN Definitions
                  </h3>
                  <button
                    className="flex items-center gap-1.5 text-xs text-gc-accent hover:underline"
                    onClick={addGroup}
                  >
                    <Plus size={12} /> Add Group
                  </button>
                </div>
                <div className="border border-gray-700 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800">
                      <tr className="text-left text-gray-400 text-xs uppercase tracking-wider">
                        <th className="px-3 py-2 w-12">#</th>
                        <th className="px-3 py-2 w-40">Name</th>
                        <th className="px-3 py-2 w-24">VLAN ID</th>
                        <th className="px-3 py-2 w-16">Color</th>
                        <th className="px-3 py-2 w-24 text-center">IGMP</th>
                        <th className="px-3 py-2 w-24 text-center">Querier</th>
                        <th className="px-3 py-2 w-24 text-center">Flooding</th>
                        <th className="px-3 py-2 w-12" />
                      </tr>
                    </thead>
                    <tbody>
                      {selected.groups.map((g) => (
                        <tr
                          key={g.id}
                          className="border-t border-gray-800 hover:bg-gray-800/50"
                        >
                          <td className="px-3 py-2 font-mono text-gray-400">{g.id}</td>
                          <td className="px-3 py-2">
                            <input
                              className="bg-transparent border-b border-transparent hover:border-gray-700 focus:border-gc-accent outline-none text-sm w-full"
                              value={g.name}
                              onChange={(e) =>
                                handleGroupUpdate(g.id, { name: e.target.value })
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="bg-transparent border-b border-transparent hover:border-gray-700 focus:border-gc-accent outline-none text-sm w-20 font-mono"
                              type="number"
                              min={1}
                              max={4094}
                              value={g.vlanId}
                              onChange={(e) =>
                                handleGroupUpdate(g.id, {
                                  vlanId: parseInt(e.target.value) || 1,
                                })
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <ColorPicker
                              value={g.color}
                              onChange={(color) => handleGroupUpdate(g.id, { color })}
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              className={`text-xs px-2 py-0.5 rounded ${
                                g.igmpSnooping
                                  ? 'bg-green-900/30 text-green-400'
                                  : 'bg-gray-800 text-gray-500'
                              }`}
                              onClick={() =>
                                handleGroupUpdate(g.id, {
                                  igmpSnooping: !g.igmpSnooping,
                                })
                              }
                            >
                              {g.igmpSnooping ? 'On' : 'Off'}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              className={`text-xs px-2 py-0.5 rounded ${
                                g.querier
                                  ? 'bg-blue-900/30 text-blue-400'
                                  : 'bg-gray-800 text-gray-500'
                              }`}
                              onClick={() =>
                                handleGroupUpdate(g.id, { querier: !g.querier })
                              }
                            >
                              {g.querier ? 'On' : 'Off'}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              className={`text-xs px-2 py-0.5 rounded ${
                                g.flooding
                                  ? 'bg-yellow-900/30 text-yellow-400'
                                  : 'bg-gray-800 text-gray-500'
                              }`}
                              onClick={() =>
                                handleGroupUpdate(g.id, { flooding: !g.flooding })
                              }
                            >
                              {g.flooding ? 'On' : 'Off'}
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            {selected.groups.length > 1 && (
                              <button
                                className="text-gray-600 hover:text-red-400"
                                onClick={() => removeGroup(g.id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── IGMP Settings ────────────────────────────────────────── */}
            {activeTab === 'igmp' && (
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3">
                  Per-Group IGMP Configuration
                </h3>
                <div className="border border-gray-700 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800">
                      <tr className="text-left text-gray-400 text-xs uppercase tracking-wider">
                        <th className="px-3 py-2">Group</th>
                        <th className="px-3 py-2 text-center">Snooping</th>
                        <th className="px-3 py-2 text-center">Querier</th>
                        <th className="px-3 py-2 text-center">Fast Leave</th>
                        <th className="px-3 py-2 w-28">Max Groups</th>
                        <th className="px-3 py-2 w-32">Query Interval (s)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.igmpSettings.map((s) => {
                        const group = selected.groups.find((g) => g.id === s.groupId);
                        return (
                          <tr
                            key={s.groupId}
                            className="border-t border-gray-800 hover:bg-gray-800/50"
                          >
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                {group && (
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: group.color }}
                                  />
                                )}
                                {s.groupName}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                className={`text-xs px-2 py-0.5 rounded ${
                                  s.snoopingEnabled
                                    ? 'bg-green-900/30 text-green-400'
                                    : 'bg-gray-800 text-gray-500'
                                }`}
                                onClick={() =>
                                  handleIgmpUpdate(s.groupId, {
                                    snoopingEnabled: !s.snoopingEnabled,
                                  })
                                }
                              >
                                {s.snoopingEnabled ? 'On' : 'Off'}
                              </button>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                className={`text-xs px-2 py-0.5 rounded ${
                                  s.querierEnabled
                                    ? 'bg-blue-900/30 text-blue-400'
                                    : 'bg-gray-800 text-gray-500'
                                }`}
                                onClick={() =>
                                  handleIgmpUpdate(s.groupId, {
                                    querierEnabled: !s.querierEnabled,
                                  })
                                }
                              >
                                {s.querierEnabled ? 'On' : 'Off'}
                              </button>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                className={`text-xs px-2 py-0.5 rounded ${
                                  s.fastLeave
                                    ? 'bg-purple-900/30 text-purple-400'
                                    : 'bg-gray-800 text-gray-500'
                                }`}
                                onClick={() =>
                                  handleIgmpUpdate(s.groupId, {
                                    fastLeave: !s.fastLeave,
                                  })
                                }
                              >
                                {s.fastLeave ? 'On' : 'Off'}
                              </button>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                className="bg-transparent border-b border-transparent hover:border-gray-700 focus:border-gc-accent outline-none text-sm w-20 font-mono"
                                type="number"
                                min={1}
                                value={s.maxGroups}
                                onChange={(e) =>
                                  handleIgmpUpdate(s.groupId, {
                                    maxGroups: parseInt(e.target.value) || 256,
                                  })
                                }
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                className="bg-transparent border-b border-transparent hover:border-gray-700 focus:border-gc-accent outline-none text-sm w-20 font-mono"
                                type="number"
                                min={1}
                                value={s.queryInterval}
                                onChange={(e) =>
                                  handleIgmpUpdate(s.groupId, {
                                    queryInterval: parseInt(e.target.value) || 125,
                                  })
                                }
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Summary ──────────────────────────────────────────────── */}
            {activeTab === 'summary' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-400">Profile Summary</h3>
                  <button className="flex items-center gap-1.5 text-xs text-gc-accent hover:underline">
                    <FileText size={12} /> Export Summary
                  </button>
                </div>

                {/* General info */}
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-3">General</h4>
                  <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <dt className="text-gray-400">Name</dt>
                    <dd>{selected.name}</dd>
                    <dt className="text-gray-400">Model</dt>
                    <dd>{selected.model}</dd>
                    <dt className="text-gray-400">Category</dt>
                    <dd>{selected.category}</dd>
                    <dt className="text-gray-400">Ports</dt>
                    <dd>{selected.ports.length}</dd>
                    <dt className="text-gray-400">Groups</dt>
                    <dd>{selected.groups.length}</dd>
                    <dt className="text-gray-400">Created</dt>
                    <dd>{new Date(selected.createdAt).toLocaleString()}</dd>
                    <dt className="text-gray-400">Last Modified</dt>
                    <dd>{new Date(selected.updatedAt).toLocaleString()}</dd>
                  </dl>
                </div>

                {/* Port assignment summary */}
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-3">Port Assignments</h4>
                  <div className="space-y-1">
                    {selected.groups.map((g) => {
                      const count = selected.ports.filter(
                        (p) => p.groupId === g.id
                      ).length;
                      return (
                        <div key={g.id} className="flex items-center gap-2 text-sm">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: g.color }}
                          />
                          <span className="flex-1">{g.name} (VLAN {g.vlanId})</span>
                          <span className="text-gray-400">
                            {count} port{count !== 1 ? 's' : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Trunk ports */}
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-3">Trunk Ports</h4>
                  {selected.ports.filter((p) => p.mode === 'trunk').length === 0 ? (
                    <p className="text-sm text-gray-500">No trunk ports configured.</p>
                  ) : (
                    <div className="space-y-1 text-sm">
                      {selected.ports
                        .filter((p) => p.mode === 'trunk')
                        .map((p) => (
                          <div key={p.port} className="flex items-center gap-2">
                            <span className="font-mono text-gray-400 w-8">
                              P{p.port}
                            </span>
                            <span>{p.label || '(unlabeled)'}</span>
                            <span className="text-gray-500">
                              — {p.trunkGroups.length} tagged group
                              {p.trunkGroups.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* PoE summary */}
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-3">PoE</h4>
                  <p className="text-sm">
                    {selected.ports.filter((p) => p.poeEnabled).length} of{' '}
                    {selected.ports.length} ports have PoE enabled.
                  </p>
                </div>

                {/* IGMP summary */}
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-3">IGMP Snooping</h4>
                  <div className="space-y-1 text-sm">
                    {selected.igmpSettings
                      .filter((s) => s.snoopingEnabled)
                      .map((s) => (
                        <div key={s.groupId} className="flex items-center gap-2">
                          <span>{s.groupName}</span>
                          {s.querierEnabled && (
                            <span className="text-xs bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded">
                              Querier
                            </span>
                          )}
                          {s.fastLeave && (
                            <span className="text-xs bg-purple-900/30 text-purple-400 px-1.5 py-0.5 rounded">
                              Fast Leave
                            </span>
                          )}
                        </div>
                      ))}
                    {selected.igmpSettings.filter((s) => s.snoopingEnabled).length ===
                      0 && (
                      <p className="text-gray-500">No IGMP snooping enabled.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Bottom action bar ──────────────────────────────────────── */}
          <div className="px-6 py-3 border-t border-gray-800 flex items-center gap-2">
            <button
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-gc-accent text-gray-900 font-medium hover:bg-gc-accent/90 transition"
              onClick={() => {
                /* In real app: persist profile */
              }}
            >
              <Save size={14} /> Save Profile
            </button>
            <button
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-gray-700 text-gray-300 hover:border-gray-600 transition"
              onClick={() => setApplyModalOpen(true)}
            >
              <Send size={14} /> Apply to Switch...
            </button>
            <button className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-gray-700 text-gray-300 hover:border-gray-600 transition">
              <FileSpreadsheet size={14} /> Export to Excel
            </button>
            <div className="flex-1" />
            <button
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-red-900/30 text-red-400 hover:bg-red-900/10 transition"
              onClick={() => setDeleteConfirm(true)}
            >
              <Trash2 size={14} /> Delete Profile
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
            <p>Select a profile or create a new one</p>
          </div>
        </div>
      )}

      {/* ─── Delete Confirm ──────────────────────────────────────────────── */}
      {deleteConfirm && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-96 p-6">
            <h3 className="text-lg font-semibold mb-2">Delete Profile</h3>
            <p className="text-sm text-gray-400 mb-4">
              Are you sure you want to delete "{selected.name}"? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 text-sm rounded-lg border border-gray-700 hover:border-gray-600"
                onClick={() => setDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-500"
                onClick={() => deleteProfile(selected.id)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Apply Modal ─────────────────────────────────────────────────── */}
      {selected && (
        <ProfileApplyModal
          profile={toSharedProfile()!}
          switches={switches}
          isOpen={applyModalOpen}
          onClose={() => setApplyModalOpen(false)}
          onApply={(ids) => {
            setApplyModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
