import { create } from 'zustand';
import type { DiscoveredSwitch, DiscoveredDevice } from '@shared/types';
import { VIEWS } from '@shared/constants';

export interface AppState {
  switches: DiscoveredSwitch[];
  discoveredDevices: DiscoveredDevice[];
  selectedView: string;
  isScanning: boolean;
  selectedSwitchId: string | null;
  setView: (view: string) => void;
  setSwitches: (switches: DiscoveredSwitch[]) => void;
  addSwitch: (sw: DiscoveredSwitch) => void;
  removeSwitch: (id: string) => void;
  setScanning: (scanning: boolean) => void;
  selectSwitch: (id: string | null) => void;
  setDiscoveredDevices: (devices: DiscoveredDevice[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  switches: [],
  discoveredDevices: [],
  selectedView: VIEWS.SCANNER,
  isScanning: false,
  selectedSwitchId: null,

  setView: (view) => set({ selectedView: view }),

  setSwitches: (switches) => set({ switches }),

  addSwitch: (sw) =>
    set((state) => {
      const exists = state.switches.some((s) => s.id === sw.id);
      if (exists) {
        return {
          switches: state.switches.map((s) => (s.id === sw.id ? sw : s)),
        };
      }
      return { switches: [...state.switches, sw] };
    }),

  removeSwitch: (id) =>
    set((state) => ({
      switches: state.switches.filter((s) => s.id !== id),
      selectedSwitchId:
        state.selectedSwitchId === id ? null : state.selectedSwitchId,
    })),

  setScanning: (scanning) => set({ isScanning: scanning }),

  selectSwitch: (id) => set({ selectedSwitchId: id }),

  setDiscoveredDevices: (devices) => set({ discoveredDevices: devices }),
}));
