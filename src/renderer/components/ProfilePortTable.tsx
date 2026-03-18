import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Check,
  ChevronDown,
  Edit3,
  Zap,
  ZapOff,
  CheckSquare,
  Square,
  MinusSquare,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProfilePortConfig {
  port: number;
  label: string;
  groupId: number;
  mode: 'access' | 'trunk';
  trunkGroups: number[];
  poeEnabled: boolean;
  speed: 'auto' | '100M' | '1G' | '10G';
  igmpSnooping: boolean;
}

export interface GroupConfig {
  id: number;
  name: string;
  vlanId: number;
  color: string;
  igmpSnooping: boolean;
  querier: boolean;
  flooding: boolean;
}

export interface ProfilePortTableProps {
  ports: ProfilePortConfig[];
  groups: GroupConfig[];
  onPortUpdate: (portNumber: number, updates: Partial<ProfilePortConfig>) => void;
  onBulkUpdate: (portNumbers: number[], updates: Partial<ProfilePortConfig>) => void;
  model: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SPEED_OPTIONS: ProfilePortConfig['speed'][] = ['auto', '100M', '1G', '10G'];

// ─── Inline editable cell ───────────────────────────────────────────────────

function InlineEditCell({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!editing) {
    return (
      <span
        className="cursor-pointer hover:text-gc-accent flex items-center gap-1 group"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {value || <span className="text-gray-600 italic">—</span>}
        <Edit3 size={12} className="opacity-0 group-hover:opacity-60" />
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      className="bg-gray-800 border border-gc-accent rounded px-1.5 py-0.5 text-sm w-full outline-none"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        onCommit(draft);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onCommit(draft);
          setEditing(false);
        }
        if (e.key === 'Escape') setEditing(false);
      }}
    />
  );
}

// ─── Dropdown cell ──────────────────────────────────────────────────────────

function DropdownCell<T extends string | number>({
  value,
  options,
  onChange,
  renderOption,
}: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
  renderOption?: (v: T) => React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-sm w-full appearance-none pr-6 outline-none focus:border-gc-accent cursor-pointer"
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          const parsed = typeof value === 'number' ? (Number(raw) as T) : (raw as T);
          onChange(parsed);
        }}
      >
        {options.map((opt) => (
          <option key={String(opt)} value={String(opt)}>
            {renderOption ? renderOption(opt) : String(opt)}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" />
    </div>
  );
}

// ─── Multi-select dropdown for trunk groups ─────────────────────────────────

function MultiSelectCell({
  selected,
  options,
  onChange,
  renderOption,
}: {
  selected: number[];
  options: { id: number; label: string; color: string }[];
  onChange: (ids: number[]) => void;
  renderOption?: (o: { id: number; label: string; color: string }) => React.ReactNode;
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

  const toggle = (id: number) => {
    if (selected.includes(id)) onChange(selected.filter((s) => s !== id));
    else onChange([...selected, id]);
  };

  return (
    <div ref={ref} className="relative">
      <button
        className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-sm w-full text-left flex items-center gap-1 focus:border-gc-accent outline-none"
        onClick={() => setOpen(!open)}
      >
        <span className="truncate flex-1">
          {selected.length === 0
            ? '—'
            : selected
                .map((id) => options.find((o) => o.id === id)?.label ?? id)
                .join(', ')}
        </span>
        <ChevronDown size={12} className="text-gray-500 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg min-w-[160px] max-h-48 overflow-auto">
          {options.map((opt) => (
            <label
              key={opt.id}
              className="flex items-center gap-2 px-2 py-1 hover:bg-gray-700 cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.id)}
                onChange={() => toggle(opt.id)}
                className="accent-gc-accent"
              />
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: opt.color }}
              />
              {renderOption ? renderOption(opt) : opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Toggle ─────────────────────────────────────────────────────────────────

function ToggleCell({
  value,
  onChange,
  iconOn,
  iconOff,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  iconOn?: React.ReactNode;
  iconOff?: React.ReactNode;
}) {
  return (
    <button
      className={`flex items-center justify-center w-full py-0.5 rounded text-sm transition ${
        value ? 'text-green-400' : 'text-gray-600'
      } hover:text-gc-accent`}
      onClick={() => onChange(!value)}
    >
      {value
        ? iconOn ?? <Check size={16} />
        : iconOff ?? <span className="text-gray-600">—</span>}
    </button>
  );
}

// ─── Bulk Edit Toolbar ──────────────────────────────────────────────────────

function BulkEditToolbar({
  count,
  groups,
  onApply,
  onClear,
}: {
  count: number;
  groups: GroupConfig[];
  onApply: (updates: Partial<ProfilePortConfig>) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-gc-accent/10 border border-gc-accent/30 rounded-lg px-4 py-2 text-sm mb-2">
      <span className="text-gc-accent font-medium">{count} ports selected</span>
      <span className="text-gray-500">|</span>

      <label className="flex items-center gap-1.5">
        Group:
        <select
          className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) onApply({ groupId: Number(e.target.value) });
          }}
        >
          <option value="">—</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5">
        Mode:
        <select
          className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) onApply({ mode: e.target.value as 'access' | 'trunk' });
          }}
        >
          <option value="">—</option>
          <option value="access">Access</option>
          <option value="trunk">Trunk</option>
        </select>
      </label>

      <label className="flex items-center gap-1.5">
        Speed:
        <select
          className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value)
              onApply({ speed: e.target.value as ProfilePortConfig['speed'] });
          }}
        >
          <option value="">—</option>
          {SPEED_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <button
        className="text-xs text-green-400 hover:underline"
        onClick={() => onApply({ poeEnabled: true })}
      >
        PoE On
      </button>
      <button
        className="text-xs text-red-400 hover:underline"
        onClick={() => onApply({ poeEnabled: false })}
      >
        PoE Off
      </button>
      <button
        className="text-xs text-blue-400 hover:underline"
        onClick={() => onApply({ igmpSnooping: true })}
      >
        IGMP On
      </button>
      <button
        className="text-xs text-gray-400 hover:underline"
        onClick={() => onApply({ igmpSnooping: false })}
      >
        IGMP Off
      </button>

      <div className="flex-1" />
      <button className="text-xs text-gray-400 hover:text-white" onClick={onClear}>
        Clear Selection
      </button>
    </div>
  );
}

// ─── Main Table ─────────────────────────────────────────────────────────────

export default function ProfilePortTable({
  ports,
  groups,
  onPortUpdate,
  onBulkUpdate,
  model,
}: ProfilePortTableProps) {
  const [selectedPorts, setSelectedPorts] = useState<Set<number>>(new Set());
  const [editedPorts, setEditedPorts] = useState<Set<number>>(new Set());

  const toggleSelect = useCallback((port: number) => {
    setSelectedPorts((prev) => {
      const next = new Set(prev);
      if (next.has(port)) next.delete(port);
      else next.add(port);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedPorts.size === ports.length) setSelectedPorts(new Set());
    else setSelectedPorts(new Set(ports.map((p) => p.port)));
  }, [selectedPorts, ports]);

  const handleUpdate = useCallback(
    (port: number, updates: Partial<ProfilePortConfig>) => {
      onPortUpdate(port, updates);
      setEditedPorts((prev) => new Set(prev).add(port));
    },
    [onPortUpdate]
  );

  const handleBulk = useCallback(
    (updates: Partial<ProfilePortConfig>) => {
      const nums = Array.from(selectedPorts);
      onBulkUpdate(nums, updates);
      setEditedPorts((prev) => {
        const next = new Set(prev);
        nums.forEach((n) => next.add(n));
        return next;
      });
    },
    [selectedPorts, onBulkUpdate]
  );

  const groupOptions = groups.map((g) => ({
    id: g.id,
    label: g.name,
    color: g.color,
  }));

  const allSelected = selectedPorts.size === ports.length && ports.length > 0;
  const someSelected = selectedPorts.size > 0 && selectedPorts.size < ports.length;

  return (
    <div>
      {selectedPorts.size > 1 && (
        <BulkEditToolbar
          count={selectedPorts.size}
          groups={groups}
          onApply={handleBulk}
          onClear={() => setSelectedPorts(new Set())}
        />
      )}

      <div className="overflow-auto max-h-[calc(100vh-340px)] border border-gray-700 rounded-lg">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-800 z-10">
            <tr className="text-left text-gray-400 text-xs uppercase tracking-wider">
              <th className="px-2 py-2 w-8">
                <button onClick={toggleAll} className="hover:text-gc-accent">
                  {allSelected ? (
                    <CheckSquare size={14} />
                  ) : someSelected ? (
                    <MinusSquare size={14} />
                  ) : (
                    <Square size={14} />
                  )}
                </button>
              </th>
              <th className="px-2 py-2 w-12">Port</th>
              <th className="px-2 py-2 w-32">Label</th>
              <th className="px-2 py-2 w-40">Group / VLAN</th>
              <th className="px-2 py-2 w-24">Mode</th>
              <th className="px-2 py-2 w-44">Trunk Groups</th>
              <th className="px-2 py-2 w-16 text-center">PoE</th>
              <th className="px-2 py-2 w-24">Speed</th>
              <th className="px-2 py-2 w-16 text-center">IGMP</th>
            </tr>
          </thead>
          <tbody>
            {ports.map((p) => {
              const isSelected = selectedPorts.has(p.port);
              const isEdited = editedPorts.has(p.port);
              const group = groups.find((g) => g.id === p.groupId);

              return (
                <tr
                  key={p.port}
                  className={`border-t border-gray-800 transition-colors ${
                    isSelected
                      ? 'bg-gc-accent/5'
                      : isEdited
                      ? 'bg-yellow-900/10'
                      : 'hover:bg-gray-800/50'
                  }`}
                >
                  {/* checkbox */}
                  <td className="px-2 py-1.5">
                    <button
                      onClick={() => toggleSelect(p.port)}
                      className="hover:text-gc-accent"
                    >
                      {isSelected ? (
                        <CheckSquare size={14} className="text-gc-accent" />
                      ) : (
                        <Square size={14} className="text-gray-600" />
                      )}
                    </button>
                  </td>

                  {/* port # */}
                  <td className="px-2 py-1.5 font-mono text-gray-300">{p.port}</td>

                  {/* label */}
                  <td className="px-2 py-1.5">
                    <InlineEditCell
                      value={p.label}
                      onCommit={(v) => handleUpdate(p.port, { label: v })}
                    />
                  </td>

                  {/* group / vlan */}
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      {group && (
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: group.color }}
                        />
                      )}
                      <DropdownCell
                        value={p.groupId}
                        options={groups.map((g) => g.id)}
                        onChange={(v) => handleUpdate(p.port, { groupId: v })}
                        renderOption={(id) => {
                          const g = groups.find((gr) => gr.id === id);
                          return g ? `${g.name} (VLAN ${g.vlanId})` : String(id);
                        }}
                      />
                    </div>
                  </td>

                  {/* mode */}
                  <td className="px-2 py-1.5">
                    <DropdownCell
                      value={p.mode}
                      options={['access', 'trunk'] as const}
                      onChange={(v) => handleUpdate(p.port, { mode: v as 'access' | 'trunk' })}
                    />
                  </td>

                  {/* trunk groups */}
                  <td className="px-2 py-1.5">
                    {p.mode === 'trunk' ? (
                      <MultiSelectCell
                        selected={p.trunkGroups}
                        options={groupOptions}
                        onChange={(ids) => handleUpdate(p.port, { trunkGroups: ids })}
                      />
                    ) : (
                      <span className="text-gray-600 text-xs">N/A</span>
                    )}
                  </td>

                  {/* poe */}
                  <td className="px-2 py-1.5">
                    <ToggleCell
                      value={p.poeEnabled}
                      onChange={(v) => handleUpdate(p.port, { poeEnabled: v })}
                      iconOn={<Zap size={14} className="text-yellow-400" />}
                      iconOff={<ZapOff size={14} className="text-gray-600" />}
                    />
                  </td>

                  {/* speed */}
                  <td className="px-2 py-1.5">
                    <DropdownCell
                      value={p.speed}
                      options={[...SPEED_OPTIONS]}
                      onChange={(v) =>
                        handleUpdate(p.port, { speed: v as ProfilePortConfig['speed'] })
                      }
                    />
                  </td>

                  {/* igmp */}
                  <td className="px-2 py-1.5">
                    <ToggleCell
                      value={p.igmpSnooping}
                      onChange={(v) => handleUpdate(p.port, { igmpSnooping: v })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isEdited(editedPorts) && (
        <div className="mt-2 text-xs text-yellow-500 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500" />
          {editedPorts.size} port{editedPorts.size !== 1 ? 's' : ''} modified (unsaved)
        </div>
      )}
    </div>
  );
}

function isEdited(set: Set<number>) {
  return set.size > 0;
}
