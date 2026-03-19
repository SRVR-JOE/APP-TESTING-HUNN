import { create } from 'zustand';
import type {
  ShowFile,
  ShowFileVersion,
  ShowFileSwitchConfig,
  VlanConfig,
  RackGroup,
  MapConnection,
  PreFlightReport,
  DeployResult,
  DeployStatus,
  DriftReport,
  DiscoveredSwitch,
} from '@shared/types';
import {
  createShowFile as engineCreateShowFile,
  createVersion,
  runPreFlightChecks,
  detectDrift,
  validateShowFile,
} from '../lib/show-file-engine';
import { useAppStore } from './useAppStore';

// ---------------------------------------------------------------------------
// Mock live switches for simulation
// ---------------------------------------------------------------------------

function getLiveSwitches(): DiscoveredSwitch[] {
  return useAppStore.getState().switches;
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface ShowFileState {
  showFiles: ShowFile[];
  versions: Record<string, ShowFileVersion[]>;
  activeShowFileId: string | null;
  preFlightReport: PreFlightReport | null;
  deployResult: DeployResult | null;
  driftReport: DriftReport | null;

  // CRUD
  createShowFile: (
    name: string,
    switches: ShowFileSwitchConfig[],
    vlans: VlanConfig[],
    rackLayout?: { groups: RackGroup[]; connections: MapConnection[] },
  ) => ShowFile;
  saveVersion: (showFileId: string, changeDescription: string) => void;
  loadShowFile: (id: string) => void;
  deleteShowFile: (id: string) => void;

  // Deploy workflow
  runPreFlight: (showFileId: string) => PreFlightReport;
  deploy: (showFileId: string) => Promise<DeployResult>;
  rollback: (deployId: string) => void;

  // Drift
  checkDrift: (showFileId: string) => DriftReport;

  // Import / Export
  importShowFile: (json: string) => ShowFile | null;
  exportShowFile: (id: string) => string | null;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function uuid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function now(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useShowFileStore = create<ShowFileState>((set, get) => ({
  showFiles: [],
  versions: {},
  activeShowFileId: null,
  preFlightReport: null,
  deployResult: null,
  driftReport: null,

  // ---- CRUD ---------------------------------------------------------------

  createShowFile: (name, switches, vlans, rackLayout) => {
    const sf = engineCreateShowFile(name, switches, vlans, rackLayout);
    const version = createVersion(sf, 'Initial version');

    set((state) => ({
      showFiles: [...state.showFiles, sf],
      versions: { ...state.versions, [sf.id]: [version] },
      activeShowFileId: sf.id,
    }));
    return sf;
  },

  saveVersion: (showFileId, changeDescription) => {
    const { showFiles, versions } = get();
    const sf = showFiles.find((s) => s.id === showFileId);
    if (!sf) return;

    const existingVersions = versions[showFileId] ?? [];
    const prevSnapshot = existingVersions.length > 0
      ? existingVersions[existingVersions.length - 1].snapshot
      : undefined;

    const updatedSf = { ...sf, version: sf.version + 1, updatedAt: now() };
    const ver = createVersion(updatedSf, changeDescription, prevSnapshot);

    set((state) => ({
      showFiles: state.showFiles.map((s) => (s.id === showFileId ? updatedSf : s)),
      versions: {
        ...state.versions,
        [showFileId]: [...(state.versions[showFileId] ?? []), ver],
      },
    }));
  },

  loadShowFile: (id) => {
    set({ activeShowFileId: id, preFlightReport: null, deployResult: null, driftReport: null });
  },

  deleteShowFile: (id) => {
    set((state) => {
      const { [id]: _removed, ...restVersions } = state.versions;
      return {
        showFiles: state.showFiles.filter((s) => s.id !== id),
        versions: restVersions,
        activeShowFileId: state.activeShowFileId === id ? null : state.activeShowFileId,
      };
    });
  },

  // ---- Deploy workflow ----------------------------------------------------

  runPreFlight: (showFileId) => {
    const sf = get().showFiles.find((s) => s.id === showFileId);
    if (!sf) {
      const emptyReport: PreFlightReport = {
        id: uuid(),
        showFileId,
        timestamp: now(),
        checks: [],
        overallStatus: 'fail',
        canDeploy: false,
      };
      set({ preFlightReport: emptyReport });
      return emptyReport;
    }

    const report = runPreFlightChecks(sf, getLiveSwitches());
    set({ preFlightReport: report });
    return report;
  },

  deploy: async (showFileId) => {
    const sf = get().showFiles.find((s) => s.id === showFileId);
    const report = get().preFlightReport;

    if (!sf || !report || !report.canDeploy) {
      const failResult: DeployResult = {
        id: uuid(),
        showFileId,
        timestamp: now(),
        switches: [],
        overallStatus: 'failed',
        preFlightReport: report ?? {
          id: uuid(),
          showFileId,
          timestamp: now(),
          checks: [],
          overallStatus: 'fail',
          canDeploy: false,
        },
        rollbackAvailable: false,
      };
      set({ deployResult: failResult });
      return failResult;
    }

    // Build per-switch deploy statuses
    const switchStatuses: { switchId: string; status: DeployStatus; message?: string; duration?: number }[] =
      sf.switches.map((sw) => ({
        switchId: sw.switchId,
        status: 'pending' as DeployStatus,
      }));

    const pendingResult: DeployResult = {
      id: uuid(),
      showFileId,
      timestamp: now(),
      switches: switchStatuses,
      overallStatus: 'deploying',
      preFlightReport: report,
      rollbackAvailable: false,
    };
    set({ deployResult: pendingResult });

    // ---------------------------------------------------------------------------
    // Try real IPC first, fall back to simulation
    // ---------------------------------------------------------------------------
    if (window.electronAPI?.deployShowFile) {
      // Subscribe to per-switch progress events if available
      let unsubProgress: (() => void) | undefined;
      if (window.electronAPI.onDeployProgress) {
        unsubProgress = window.electronAPI.onDeployProgress((progress) => {
          set((state) => {
            if (!state.deployResult) return {};
            const updatedSwitches = state.deployResult.switches.map((sw) =>
              sw.switchId === progress.switchId
                ? { ...sw, status: progress.status, message: progress.message, duration: progress.duration }
                : sw,
            );
            return { deployResult: { ...state.deployResult, switches: updatedSwitches } };
          });
        });
      }

      try {
        const result = await window.electronAPI.deployShowFile(sf);
        // Merge the pre-flight report from our local state into the result
        const finalResult: DeployResult = {
          ...result,
          preFlightReport: report,
        };
        set({ deployResult: finalResult });

        // Auto-save version on successful deploy
        if (finalResult.overallStatus === 'success') {
          get().saveVersion(showFileId, 'Deployed to switches');
        }

        return finalResult;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown deployment error';
        const errorResult: DeployResult = {
          ...pendingResult,
          switches: switchStatuses.map((sw) => ({
            ...sw,
            status: sw.status === 'pending' ? 'failed' as DeployStatus : sw.status,
            message: sw.status === 'pending' ? errorMessage : sw.message,
          })),
          overallStatus: 'failed',
          rollbackAvailable: false,
        };
        set({ deployResult: errorResult });
        return errorResult;
      } finally {
        unsubProgress?.();
      }
    }

    // ---------------------------------------------------------------------------
    // Simulation fallback (dev mode / no Electron)
    // ---------------------------------------------------------------------------
    for (let i = 0; i < sf.switches.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 800));
      const swCfg = sf.switches[i];

      // Simulate: update the corresponding switch in useAppStore
      const appStore = useAppStore.getState();
      const existingSwitch = appStore.switches.find((s) => s.id === swCfg.switchId);
      if (existingSwitch) {
        const updated: DiscoveredSwitch = {
          ...existingSwitch,
          name: swCfg.name,
          ip: swCfg.ip,
          groups: swCfg.groups,
          ports: swCfg.portConfigs.map((pc) => ({
            port: pc.port,
            label: pc.label ?? `Port ${pc.port}`,
            linkUp: true,
            speedMbps: 1000,
            maxSpeedMbps: 1000,
            errorsPerMin: 0,
            isTrunk: (pc.taggedVlans?.length ?? 0) > 0,
            vlans: pc.taggedVlans ?? [pc.vlan],
            poeEnabled: pc.poeEnabled,
          })),
        };
        appStore.addSwitch(updated);
      }

      switchStatuses[i] = {
        switchId: swCfg.switchId,
        status: 'success',
        duration: 600 + Math.round(Math.random() * 800),
      };

      set((state) => ({
        deployResult: state.deployResult
          ? { ...state.deployResult, switches: [...switchStatuses] }
          : state.deployResult,
      }));
    }

    const finalResult: DeployResult = {
      ...pendingResult,
      switches: switchStatuses,
      overallStatus: 'success',
      rollbackAvailable: true,
    };
    set({ deployResult: finalResult });

    // Auto-save version on deploy
    get().saveVersion(showFileId, 'Deployed to switches');

    return finalResult;
  },

  rollback: (_deployId) => {
    const { activeShowFileId, versions } = get();
    if (!activeShowFileId) return;

    const verList = versions[activeShowFileId];
    if (!verList || verList.length < 2) return;

    // Restore the second-to-last version
    const previousVersion = verList[verList.length - 2];
    const restored = { ...previousVersion.snapshot, updatedAt: now() };

    set((state) => ({
      showFiles: state.showFiles.map((s) => (s.id === activeShowFileId ? restored : s)),
      deployResult: state.deployResult
        ? { ...state.deployResult, overallStatus: 'rolled-back' as DeployStatus, rollbackAvailable: false }
        : null,
    }));

    get().saveVersion(activeShowFileId, `Rolled back to version ${previousVersion.version}`);
  },

  // ---- Drift --------------------------------------------------------------

  checkDrift: (showFileId) => {
    const sf = get().showFiles.find((s) => s.id === showFileId);
    if (!sf) {
      const emptyReport: DriftReport = {
        id: uuid(),
        showFileId,
        timestamp: now(),
        drifts: [],
        totalDrifts: 0,
      };
      set({ driftReport: emptyReport });
      return emptyReport;
    }
    const report = detectDrift(sf, getLiveSwitches());
    set({ driftReport: report });
    return report;
  },

  // ---- Import / Export ----------------------------------------------------

  importShowFile: (json) => {
    try {
      const parsed = JSON.parse(json) as ShowFile;
      const validation = validateShowFile(parsed);
      if (!validation.valid) {
        console.error('Import validation failed:', validation.errors);
        return null;
      }
      // Assign new ID to avoid collisions
      const imported: ShowFile = { ...parsed, id: uuid(), updatedAt: now() };
      const version = createVersion(imported, 'Imported');

      set((state) => ({
        showFiles: [...state.showFiles, imported],
        versions: { ...state.versions, [imported.id]: [version] },
        activeShowFileId: imported.id,
      }));
      return imported;
    } catch (err) {
      console.error('Failed to import show file:', err);
      return null;
    }
  },

  exportShowFile: (id) => {
    const sf = get().showFiles.find((s) => s.id === id);
    if (!sf) return null;
    return JSON.stringify(sf, null, 2);
  },
}));
