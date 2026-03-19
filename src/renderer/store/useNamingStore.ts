import { create } from 'zustand';
import type { NamingTemplate, NamingAssignment } from '@shared/types';
import { NAMING_PRESETS } from '@shared/constants';
import { generateBatchNames, detectConflicts, type NamingConflict } from '../lib/naming-engine';
import { useAppStore } from './useAppStore';

const now = new Date().toISOString();
const builtInTemplates: NamingTemplate[] = NAMING_PRESETS.map((p) => ({ ...p, createdAt: now, updatedAt: now }));

let tplCounter = 0;

interface NamingStore {
  templates: NamingTemplate[];
  assignments: NamingAssignment[];
  selectedSwitchIds: string[];
  selectedTemplateId: string | null;
  variableOverrides: Record<string, string>;
  startNumber: number;
  numberPadding: number;
  lastAppliedAt: string | null;

  addTemplate: (t: Omit<NamingTemplate, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>) => string;
  updateTemplate: (id: string, updates: Partial<Pick<NamingTemplate, 'name' | 'pattern' | 'variables' | 'locationType'>>) => void;
  deleteTemplate: (id: string) => void;

  setSelectedSwitchIds: (ids: string[]) => void;
  toggleSwitchSelection: (id: string) => void;
  clearSelection: () => void;
  setSelectedTemplate: (id: string | null) => void;
  setVariableOverrides: (o: Record<string, string>) => void;
  setStartNumber: (n: number) => void;
  setNumberPadding: (n: number) => void;

  getPreviewNames: () => { switchId: string; name: string }[];
  getConflicts: () => NamingConflict[];
  applyNames: () => void;
}

export const useNamingStore = create<NamingStore>((set, get) => ({
  templates: builtInTemplates,
  assignments: [],
  selectedSwitchIds: [],
  selectedTemplateId: null,
  variableOverrides: {},
  startNumber: 1,
  numberPadding: 2,
  lastAppliedAt: null,

  addTemplate: (t) => {
    const id = `tpl-${++tplCounter}`;
    const now = new Date().toISOString();
    set((s) => ({ templates: [...s.templates, { ...t, id, isBuiltIn: false, createdAt: now, updatedAt: now }] }));
    return id;
  },

  updateTemplate: (id, updates) =>
    set((s) => ({
      templates: s.templates.map((t) => t.id === id && !t.isBuiltIn ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t),
    })),

  deleteTemplate: (id) =>
    set((s) => ({
      templates: s.templates.filter((t) => t.id !== id || t.isBuiltIn),
      selectedTemplateId: s.selectedTemplateId === id ? null : s.selectedTemplateId,
    })),

  setSelectedSwitchIds: (ids) => set({ selectedSwitchIds: ids }),
  toggleSwitchSelection: (id) =>
    set((s) => ({
      selectedSwitchIds: s.selectedSwitchIds.includes(id)
        ? s.selectedSwitchIds.filter((i) => i !== id)
        : [...s.selectedSwitchIds, id],
    })),
  clearSelection: () => set({ selectedSwitchIds: [] }),

  setSelectedTemplate: (id) => {
    const tpl = get().templates.find((t) => t.id === id);
    set({ selectedTemplateId: id, variableOverrides: tpl ? { ...tpl.variables } : {} });
  },
  setVariableOverrides: (o) => set({ variableOverrides: o }),
  setStartNumber: (n) => set({ startNumber: n }),
  setNumberPadding: (n) => set({ numberPadding: n }),

  getPreviewNames: () => {
    const { selectedSwitchIds, selectedTemplateId, templates, variableOverrides, startNumber, numberPadding } = get();
    if (!selectedTemplateId || selectedSwitchIds.length === 0) return [];
    const tpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tpl) return [];
    const merged = { ...tpl.variables, ...variableOverrides };
    const names = generateBatchNames(tpl.pattern, merged, selectedSwitchIds.length, startNumber, numberPadding);
    return selectedSwitchIds.map((id, i) => ({ switchId: id, name: names[i] }));
  },

  getConflicts: () => {
    const proposed = get().getPreviewNames();
    if (proposed.length === 0) return [];
    const switches = useAppStore.getState().switches;
    return detectConflicts(proposed, switches, get().selectedSwitchIds);
  },

  applyNames: () => {
    const proposed = get().getPreviewNames();
    if (proposed.length === 0) return;
    const { selectedTemplateId, variableOverrides } = get();

    // Update switch names in the main app store
    const appState = useAppStore.getState();
    const updatedSwitches = appState.switches.map((sw) => {
      const match = proposed.find((p) => p.switchId === sw.id);
      return match ? { ...sw, name: match.name } : sw;
    });
    useAppStore.setState({ switches: updatedSwitches });

    // Record assignments
    const newAssignments: NamingAssignment[] = proposed.map(({ switchId, name }) => ({
      switchId,
      templateId: selectedTemplateId!,
      generatedName: name,
      variableOverrides: { ...variableOverrides },
      applied: true,
    }));

    set((s) => ({
      assignments: [
        ...s.assignments.filter((a) => !proposed.some((p) => p.switchId === a.switchId)),
        ...newAssignments,
      ],
      lastAppliedAt: new Date().toISOString(),
    }));
  },
}));
