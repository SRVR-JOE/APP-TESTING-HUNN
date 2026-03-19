import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Layers,
  Network,
  Tag,
  Radio,
  Zap,
  Type,
  Globe,
  FolderInput,
  HardDrive,
  Settings,
  AlertTriangle,
  RotateCcw,
  Power,
  Download,
} from 'lucide-react';
import type { DiscoveredSwitch, HealthStatus } from '@shared/types';
import { useAppStore } from '../store/useAppStore';
import { VIEWS } from '@shared/constants';
import { BatchSelector } from '../components/BatchSelector';
import { BatchPreview } from '../components/BatchPreview';
import type { BatchOperationPreview } from '../components/BatchPreview';
import { BatchProgress } from '../components/BatchProgress';
import type { BatchSwitchStatus } from '../components/BatchProgress';
import { GroupConfigForm } from '../components/GroupConfigForm';
import type { GroupRow } from '../components/GroupConfigForm';
import { SequentialNaming } from '../components/SequentialNaming';
import type { NamingAssignment } from '../components/SequentialNaming';
import { SequentialIP } from '../components/SequentialIP';
import type { IPAssignment } from '../components/SequentialIP';
import { FirmwareUploader } from '../components/FirmwareUploader';
import type { FirmwareFileInfo } from '../components/FirmwareUploader';

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_SWITCHES: DiscoveredSwitch[] = [
  {
    id: 'sw-001', name: 'FOH-Main-01', model: 'GC-30i', ip: '10.0.1.10', mac: '00:50:C2:00:01:01',
    firmware: '2.8.1', generation: 2, serial: 'GC30-20240101', isOnline: true,
    lastSeen: '2026-03-18T10:00:00Z', firstSeen: '2026-01-15T08:00:00Z',
    rackGroup: 'FOH Rack A', portCount: 30, portsUp: 24, healthStatus: 'healthy',
    poe: { drawW: 370, budgetW: 500 },
  },
  {
    id: 'sw-002', name: 'FOH-Main-02', model: 'GC-30i', ip: '10.0.1.11', mac: '00:50:C2:00:01:02',
    firmware: '2.8.1', generation: 2, serial: 'GC30-20240102', isOnline: true,
    lastSeen: '2026-03-18T10:00:00Z', firstSeen: '2026-01-15T08:00:00Z',
    rackGroup: 'FOH Rack A', portCount: 30, portsUp: 18, healthStatus: 'healthy',
    poe: { drawW: 280, budgetW: 500 },
  },
  {
    id: 'sw-003', name: 'Stage-Left-01', model: 'GC-16t', ip: '10.0.1.20', mac: '00:50:C2:00:02:01',
    firmware: '2.7.3', generation: 2, serial: 'GC16-20240201', isOnline: true,
    lastSeen: '2026-03-18T10:00:00Z', firstSeen: '2026-02-01T08:00:00Z',
    rackGroup: 'Stage Left', portCount: 16, portsUp: 12, healthStatus: 'healthy',
    poe: { drawW: 120, budgetW: 240 },
  },
  {
    id: 'sw-004', name: 'Stage-Right-01', model: 'GC-16t', ip: '10.0.1.21', mac: '00:50:C2:00:02:02',
    firmware: '2.7.3', generation: 2, serial: 'GC16-20240202', isOnline: true,
    lastSeen: '2026-03-18T10:00:00Z', firstSeen: '2026-02-01T08:00:00Z',
    rackGroup: 'Stage Right', portCount: 16, portsUp: 10, healthStatus: 'warning',
    poe: { drawW: 190, budgetW: 240 },
  },
  {
    id: 'sw-005', name: 'Monitor-01', model: 'GC-14R', ip: '10.0.1.30', mac: '00:50:C2:00:03:01',
    firmware: '2.8.0', generation: 2, serial: 'GC14-20240301', isOnline: true,
    lastSeen: '2026-03-18T10:00:00Z', firstSeen: '2026-02-15T08:00:00Z',
    rackGroup: 'Monitor World', portCount: 14, portsUp: 8, healthStatus: 'healthy',
  },
  {
    id: 'sw-006', name: 'Broadcast-01', model: 'GC-10i', ip: '10.0.1.40', mac: '00:50:C2:00:04:01',
    firmware: '2.8.1', generation: 2, serial: 'GC10-20240401', isOnline: true,
    lastSeen: '2026-03-18T10:00:00Z', firstSeen: '2026-03-01T08:00:00Z',
    rackGroup: 'Broadcast', portCount: 10, portsUp: 6, healthStatus: 'healthy',
  },
  {
    id: 'sw-007', name: 'Backup-01', model: 'GC-12t', ip: '10.0.1.50', mac: '00:50:C2:00:05:01',
    firmware: '2.6.0', generation: 1, serial: 'GC12-20230501', isOnline: false,
    lastSeen: '2026-03-17T22:00:00Z', firstSeen: '2023-06-01T08:00:00Z',
    rackGroup: 'FOH Rack A', portCount: 12, portsUp: 0, healthStatus: 'offline',
  },
  {
    id: 'sw-008', name: 'Stage-DSP-01', model: 'GC-14R', ip: '10.0.1.31', mac: '00:50:C2:00:03:02',
    firmware: '2.8.0', generation: 2, serial: 'GC14-20240302', isOnline: true,
    lastSeen: '2026-03-18T10:00:00Z', firstSeen: '2026-02-15T08:00:00Z',
    rackGroup: 'Stage Left', portCount: 14, portsUp: 11, healthStatus: 'critical',
    poe: { drawW: 50, budgetW: 150 },
  },
];

// ─── Tab Configuration ──────────────────────────────────────────────────────

type TabId =
  | 'groups'
  | 'ports'
  | 'igmp'
  | 'poe'
  | 'naming'
  | 'ip'
  | 'profile'
  | 'firmware'
  | 'system';

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabDef[] = [
  { id: 'groups', label: 'Groups/VLANs', icon: <Network className="w-4 h-4" /> },
  { id: 'ports', label: 'Port Assignment', icon: <Tag className="w-4 h-4" /> },
  { id: 'igmp', label: 'IGMP', icon: <Radio className="w-4 h-4" /> },
  { id: 'poe', label: 'PoE', icon: <Zap className="w-4 h-4" /> },
  { id: 'naming', label: 'Naming', icon: <Type className="w-4 h-4" /> },
  { id: 'ip', label: 'IP Addressing', icon: <Globe className="w-4 h-4" /> },
  { id: 'profile', label: 'Profile Deploy', icon: <FolderInput className="w-4 h-4" /> },
  { id: 'firmware', label: 'Firmware', icon: <HardDrive className="w-4 h-4" /> },
  { id: 'system', label: 'System', icon: <Settings className="w-4 h-4" /> },
];

// ─── Helper: generate preview for group config ──────────────────────────────

function buildGroupPreview(
  groups: GroupRow[],
  selectedSwitches: DiscoveredSwitch[]
): BatchOperationPreview[] {
  return selectedSwitches.map((sw) => ({
    switchName: sw.name,
    switchIp: sw.ip,
    changes: groups.map((g) => ({
      field: `Group ${g.groupNumber} (${g.name})`,
      currentValue: '(none)',
      newValue: `VLAN ${g.vlanId}, IGMP: ${g.igmpSnooping ? 'on' : 'off'}`,
      type: 'add' as const,
    })),
  }));
}

function buildNamingPreview(assignments: NamingAssignment[]): BatchOperationPreview[] {
  return assignments.map((a) => ({
    switchName: a.currentName,
    switchIp: '',
    changes: [
      {
        field: 'Switch Name',
        currentValue: a.currentName,
        newValue: a.newName,
        type: 'change' as const,
      },
    ],
  }));
}

function buildIPPreview(assignments: IPAssignment[]): BatchOperationPreview[] {
  return assignments.map((a) => ({
    switchName: a.switchName,
    switchIp: a.currentIp,
    changes: [
      {
        field: 'IP Address',
        currentValue: a.currentIp,
        newValue: a.newIp,
        type: a.currentIp === a.newIp ? ('change' as const) : ('change' as const),
      },
    ],
  }));
}

function buildFirmwarePreview(
  file: FirmwareFileInfo,
  selectedSwitches: DiscoveredSwitch[]
): BatchOperationPreview[] {
  const compatible = selectedSwitches.filter((s) =>
    file.compatibleModels.includes(s.model)
  );
  return compatible.map((sw) => ({
    switchName: sw.name,
    switchIp: sw.ip,
    changes: [
      {
        field: 'Firmware',
        currentValue: sw.firmware,
        newValue: file.name.replace(/\.(bin|fw|img)$/, ''),
        type: 'change' as const,
      },
    ],
  }));
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function BatchConfigView() {
  const setView = useAppStore((s) => s.setView);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabId>('groups');
  const [groupBy, setGroupBy] = useState<'model' | 'rack' | 'none'>('rack');

  // Preview / progress state
  const [previewData, setPreviewData] = useState<BatchOperationPreview[] | null>(null);
  const [previewReviewed, setPreviewReviewed] = useState(false);
  const [isDestructive, setIsDestructive] = useState(false);
  const [previewLabel, setPreviewLabel] = useState('');

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [batchStatuses, setBatchStatuses] = useState<BatchSwitchStatus[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const executionTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pre-flight connectivity check state
  const [preFlightRunning, setPreFlightRunning] = useState(false);
  const [preFlightWarning, setPreFlightWarning] = useState<string[] | null>(null);

  const selectedSwitches = MOCK_SWITCHES.filter((s) => selectedIds.has(s.id));

  // ─── Tab-specific form state ───────────────────────────────────────

  // Ports tab state
  const [portAssignments, setPortAssignments] = useState<
    Array<{ portRange: string; groupId: number }>
  >([
    { portRange: '1-8', groupId: 1 },
    { portRange: '9-16', groupId: 2 },
  ]);

  // IGMP tab state
  const IGMP_GROUP_NAMES = ['Control', 'Audio Primary', 'Audio Secondary', 'Video', 'Lighting', 'Intercom'];
  const [igmpSettings, setIgmpSettings] = useState<
    Array<{ groupId: number; name: string; snooping: boolean; querier: boolean; flooding: boolean }>
  >(
    IGMP_GROUP_NAMES.map((name, i) => ({
      groupId: i + 1,
      name,
      snooping: i !== 4,
      querier: i === 1 || i === 3,
      flooding: i === 3,
    }))
  );

  // PoE tab state
  const [poeSettings, setPoeSettings] = useState<
    Array<{ portRange: string; enabled: boolean; priority: string }>
  >([{ portRange: '1-8', enabled: true, priority: 'Critical' }]);

  // Profile tab state
  const PROFILE_OPTIONS = ['Solotech Standard Audio', 'Solotech Video Production', 'Festival Main Stage', 'Corporate AV Default'];
  const [profileSlot, setProfileSlot] = useState(1);

  // ─── Preview handlers ─────────────────────────────────────────────────

  const showPreview = useCallback(
    (operations: BatchOperationPreview[], label: string, destructive = false) => {
      setPreviewData(operations);
      setPreviewLabel(label);
      setIsDestructive(destructive);
      setPreviewReviewed(false);
    },
    []
  );

  const confirmPreview = useCallback(() => {
    setPreviewReviewed(true);
    setPreviewData(null);
  }, []);

  const cancelPreview = useCallback(() => {
    setPreviewData(null);
  }, []);

  // ─── Batch operation type for IPC ────────────────────────────────────
  interface BatchOperation {
    switchIp: string;
    operation: string;
    params: any;
  }

  // ─── Build operations from tab-specific data ──────────────────────────

  const buildOperationsForTab = useCallback(
    (tabId: TabId, tabData?: any): BatchOperation[] => {
      const ops: BatchOperation[] = [];

      switch (tabId) {
        case 'groups': {
          const groups = tabData as GroupRow[] | undefined;
          if (!groups) break;
          for (const sw of selectedSwitches) {
            for (const g of groups) {
              ops.push({
                switchIp: sw.ip,
                operation: 'group.set',
                params: {
                  id: g.groupNumber,
                  config: {
                    name: g.name,
                    vlanId: g.vlanId,
                    color: g.color,
                    igmpSnooping: g.igmpSnooping,
                    igmpQuerier: g.igmpQuerier,
                    unknownFlooding: g.igmpFlooding,
                  },
                },
              });
            }
          }
          break;
        }
        case 'ports': {
          // Port tab uses hardcoded form values — parse port ranges from the UI
          // tabData: { portRange: string, groupId: number }[]
          const assignments = tabData as Array<{ portRange: string; groupId: number }> | undefined;
          if (!assignments) {
            // Fallback: use default values from the form
            for (const sw of selectedSwitches) {
              for (let p = 1; p <= 8; p++) {
                ops.push({ switchIp: sw.ip, operation: 'port.setGroup', params: { port: p, groupId: 1 } });
              }
              for (let p = 9; p <= 16; p++) {
                ops.push({ switchIp: sw.ip, operation: 'port.setGroup', params: { port: p, groupId: 2 } });
              }
            }
          } else {
            for (const sw of selectedSwitches) {
              for (const a of assignments) {
                const [start, end] = a.portRange.split('-').map(Number);
                for (let p = start; p <= (end || start); p++) {
                  ops.push({ switchIp: sw.ip, operation: 'port.setGroup', params: { port: p, groupId: a.groupId } });
                }
              }
            }
          }
          break;
        }
        case 'igmp': {
          // IGMP tab: tabData = { groupId: number, enabled: boolean }[]
          const settings = tabData as Array<{ groupId: number; enabled: boolean }> | undefined;
          if (!settings) {
            // Fallback defaults from the form checkboxes
            const groupNames = ['Control', 'Audio Primary', 'Audio Secondary', 'Video', 'Lighting', 'Intercom'];
            for (const sw of selectedSwitches) {
              groupNames.forEach((_, i) => {
                ops.push({
                  switchIp: sw.ip,
                  operation: 'igmp.setSnooping',
                  params: { groupId: i + 1, enabled: i !== 4 },
                });
              });
            }
          } else {
            for (const sw of selectedSwitches) {
              for (const s of settings) {
                ops.push({
                  switchIp: sw.ip,
                  operation: 'igmp.setSnooping',
                  params: { groupId: s.groupId, enabled: s.enabled },
                });
              }
            }
          }
          break;
        }
        case 'poe': {
          // PoE tab: tabData = { portRange: string, enabled: boolean }[]
          const settings = tabData as Array<{ portRange: string; enabled: boolean }> | undefined;
          if (!settings) {
            // Fallback defaults from the form
            for (const sw of selectedSwitches) {
              for (let p = 1; p <= 8; p++) {
                ops.push({ switchIp: sw.ip, operation: 'poe.setEnabled', params: { port: p, enabled: true } });
              }
            }
          } else {
            for (const sw of selectedSwitches) {
              for (const s of settings) {
                const [start, end] = s.portRange.split('-').map(Number);
                for (let p = start; p <= (end || start); p++) {
                  ops.push({ switchIp: sw.ip, operation: 'poe.setEnabled', params: { port: p, enabled: s.enabled } });
                }
              }
            }
          }
          break;
        }
        case 'naming': {
          const assignments = tabData as NamingAssignment[] | undefined;
          if (!assignments) break;
          // For naming, we need to find the matching switch IP for each assignment
          for (const a of assignments) {
            const sw = selectedSwitches.find((s) => s.id === a.switchId);
            if (sw) {
              ops.push({ switchIp: sw.ip, operation: 'system.setName', params: { name: a.newName } });
            }
          }
          break;
        }
        case 'ip': {
          const assignments = tabData as IPAssignment[] | undefined;
          if (!assignments) break;
          for (const a of assignments) {
            const sw = selectedSwitches.find((s) => s.id === a.switchId);
            if (sw) {
              ops.push({
                switchIp: sw.ip,
                operation: 'ip.setConfig',
                params: { config: { ip: a.newIp, subnet: '255.255.255.0', gateway: '', dhcp: false } },
              });
            }
          }
          break;
        }
        case 'profile': {
          const slot = (tabData as number) || 1;
          for (const sw of selectedSwitches) {
            ops.push({ switchIp: sw.ip, operation: 'profile.recall', params: { slot } });
          }
          break;
        }
        case 'system': {
          // System tab operations (reboot, factory reset) — handled inline
          const action = tabData as 'reboot' | 'factoryReset' | undefined;
          if (action === 'reboot') {
            for (const sw of selectedSwitches) {
              ops.push({ switchIp: sw.ip, operation: 'system.reboot', params: {} });
            }
          }
          break;
        }
        // firmware is handled separately
        default:
          break;
      }

      return ops;
    },
    [selectedSwitches],
  );

  // ─── Simulated execution (fallback for dev mode) ────────────────────

  const simulateExecution = useCallback(() => {
    if (selectedSwitches.length === 0) return;

    setIsExecuting(true);
    setPreviewReviewed(false);
    const statuses: BatchSwitchStatus[] = selectedSwitches.map((sw) => ({
      switchName: sw.name,
      switchIp: sw.ip,
      status: 'waiting',
      progress: 0,
    }));
    setBatchStatuses(statuses);
    setOverallProgress(0);
    setExecutionLog([`[INFO] Starting batch operation on ${selectedSwitches.length} switches... (simulation)`]);

    let currentIdx = 0;

    executionTimer.current = setInterval(() => {
      setBatchStatuses((prev) => {
        const next = [...prev];
        if (currentIdx < next.length) {
          const sw = next[currentIdx];
          if (sw.status === 'waiting') {
            sw.status = 'in-progress';
            sw.progress = 0;
            sw.currentOperation = 'Connecting...';
            setExecutionLog((l) => [...l, `[INFO] Connecting to ${sw.switchName} (${sw.switchIp})...`]);
          } else if (sw.status === 'in-progress') {
            sw.progress = Math.min(sw.progress + 20 + Math.random() * 15, 100);
            if (sw.progress < 40) {
              sw.currentOperation = 'Authenticating...';
            } else if (sw.progress < 70) {
              sw.currentOperation = 'Applying configuration...';
            } else if (sw.progress < 95) {
              sw.currentOperation = 'Verifying changes...';
            }

            if (sw.progress >= 100) {
              if (sw.switchName === 'Backup-01') {
                sw.status = 'failed';
                sw.error = 'Connection refused: switch offline';
                sw.progress = 100;
                setExecutionLog((l) => [
                  ...l,
                  `[ERROR] Failed to configure ${sw.switchName}: Connection refused`,
                ]);
              } else {
                sw.status = 'success';
                sw.progress = 100;
                setExecutionLog((l) => [
                  ...l,
                  `[OK] ${sw.switchName} configured successfully`,
                ]);
              }
              currentIdx++;
            }
          }
        }

        const completed = next.filter(
          (s) => s.status === 'success' || s.status === 'failed' || s.status === 'skipped'
        ).length;
        const inProgressPct =
          next.find((s) => s.status === 'in-progress')?.progress || 0;
        const pct = ((completed + inProgressPct / 100) / next.length) * 100;
        setOverallProgress(Math.min(pct, 100));

        if (currentIdx >= next.length && !next.some((s) => s.status === 'in-progress')) {
          if (executionTimer.current) {
            clearInterval(executionTimer.current);
            executionTimer.current = null;
          }
          setIsExecuting(false);
          const successCount = next.filter((s) => s.status === 'success').length;
          const failCount = next.filter((s) => s.status === 'failed').length;
          setExecutionLog((l) => [
            ...l,
            `[INFO] Batch operation complete: ${successCount} succeeded, ${failCount} failed`,
          ]);
          setOverallProgress(100);
        }

        return next;
      });
    }, 600);
  }, [selectedSwitches]);

  // ─── Real execution via IPC ────────────────────────────────────────

  const realExecution = useCallback(
    async (tabId?: TabId, tabData?: any) => {
      if (selectedSwitches.length === 0) return;

      const api = (window as any).electronAPI;

      // Fall back to simulation if batchExecute is not available (dev mode)
      if (!api?.batchExecute) {
        console.warn('[BatchConfig] electronAPI.batchExecute not available, falling back to simulation');
        simulateExecution();
        return;
      }

      const tab = tabId ?? activeTab;

      // Handle firmware separately via firmware:upload IPC
      // Note: Electron's File objects have a .path property that browser File objects lack.
      // The FirmwareFileInfo carries the file name; we store the full path if available.
      if (tab === 'firmware' && tabData) {
        const { file, rebootAfter } = tabData as { file: FirmwareFileInfo & { path?: string }; rebootAfter: boolean };
        const compatible = selectedSwitches.filter((s) =>
          file.compatibleModels.includes(s.model)
        );

        if (compatible.length === 0) return;

        // If we don't have a file path (e.g. browser mode), fall back to simulation
        const filePath = file.path;
        if (!filePath || !api.firmwareUpload) {
          console.warn('[BatchConfig] No firmware file path or firmwareUpload API, falling back to simulation');
          simulateExecution();
          return;
        }

        setIsExecuting(true);
        setPreviewReviewed(false);
        const statuses: BatchSwitchStatus[] = compatible.map((sw) => ({
          switchName: sw.name,
          switchIp: sw.ip,
          status: 'waiting',
          progress: 0,
        }));
        setBatchStatuses(statuses);
        setOverallProgress(0);
        setExecutionLog([`[INFO] Starting firmware upload to ${compatible.length} switches...`]);

        for (let i = 0; i < compatible.length; i++) {
          const sw = compatible[i];
          setBatchStatuses((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], status: 'in-progress', progress: 10, currentOperation: 'Uploading firmware...' };
            return next;
          });
          setExecutionLog((l) => [...l, `[INFO] Uploading firmware to ${sw.name} (${sw.ip})...`]);

          try {
            await api.firmwareUpload(sw.ip, filePath, rebootAfter);
            setBatchStatuses((prev) => {
              const next = [...prev];
              next[i] = { ...next[i], status: 'success', progress: 100 };
              return next;
            });
            setExecutionLog((l) => [...l, `[OK] ${sw.name} firmware uploaded successfully`]);
          } catch (err: any) {
            setBatchStatuses((prev) => {
              const next = [...prev];
              next[i] = { ...next[i], status: 'failed', progress: 100, error: err.message || String(err) };
              return next;
            });
            setExecutionLog((l) => [...l, `[ERROR] ${sw.name}: ${err.message || String(err)}`]);
          }

          const pct = ((i + 1) / compatible.length) * 100;
          setOverallProgress(pct);
        }

        setIsExecuting(false);
        setOverallProgress(100);
        return;
      }

      // Build operations array for the current tab
      const operations = buildOperationsForTab(tab, tabData);

      if (operations.length === 0) {
        console.warn('[BatchConfig] No operations to execute for tab:', tab);
        simulateExecution();
        return;
      }

      // Initialize UI state
      setIsExecuting(true);
      setPreviewReviewed(false);
      const statuses: BatchSwitchStatus[] = selectedSwitches.map((sw) => ({
        switchName: sw.name,
        switchIp: sw.ip,
        status: 'waiting',
        progress: 0,
      }));
      setBatchStatuses(statuses);
      setOverallProgress(0);
      setExecutionLog([`[INFO] Starting batch operation on ${selectedSwitches.length} switches (${operations.length} operations)...`]);

      // Subscribe to progress events from the main process
      let unsubProgress: (() => void) | null = null;
      if (api.onBatchProgress) {
        unsubProgress = api.onBatchProgress((data: {
          switchIp: string;
          status: 'waiting' | 'in-progress' | 'success' | 'failed' | 'skipped';
          progress: number;
          currentOperation?: string;
          error?: string;
          overallProgress: number;
          total: number;
          completed: number;
          failed: number;
        }) => {
          setBatchStatuses((prev) => {
            const next = [...prev];
            const idx = next.findIndex((s) => s.switchIp === data.switchIp);
            if (idx >= 0) {
              next[idx] = {
                ...next[idx],
                status: data.status,
                progress: data.status === 'success' || data.status === 'failed' ? 100 : Math.min(data.overallProgress, 95),
                currentOperation: data.currentOperation,
                error: data.error,
              };
            }
            return next;
          });

          setOverallProgress(data.overallProgress);

          if (data.status === 'success') {
            const sw = selectedSwitches.find((s) => s.ip === data.switchIp);
            setExecutionLog((l) => [...l, `[OK] ${sw?.name || data.switchIp} configured successfully`]);
          } else if (data.status === 'failed') {
            const sw = selectedSwitches.find((s) => s.ip === data.switchIp);
            setExecutionLog((l) => [
              ...l,
              `[ERROR] Failed to configure ${sw?.name || data.switchIp}: ${data.error || 'Unknown error'}`,
            ]);
          } else if (data.status === 'in-progress') {
            const sw = selectedSwitches.find((s) => s.ip === data.switchIp);
            if (sw) {
              // Only log the first in-progress event per switch
              setBatchStatuses((prev) => {
                const entry = prev.find((s) => s.switchIp === data.switchIp);
                if (entry && entry.status === 'waiting') {
                  setExecutionLog((l) => [...l, `[INFO] Connecting to ${sw.name} (${sw.ip})...`]);
                }
                return prev;
              });
            }
          }
        });
      }

      try {
        const results = await api.batchExecute(operations);

        // Final status update
        const successCount = results.filter((r: any) => r.success).length;
        const failCount = results.filter((r: any) => !r.success).length;
        setExecutionLog((l) => [
          ...l,
          `[INFO] Batch operation complete: ${successCount} succeeded, ${failCount} failed`,
        ]);

        // Ensure final statuses are correct based on results
        setBatchStatuses((prev) => {
          const next = [...prev];
          for (const s of next) {
            const switchResults = results.filter((r: any) => r.switchIp === s.switchIp);
            if (switchResults.length > 0) {
              const anyFailed = switchResults.some((r: any) => !r.success);
              s.status = anyFailed ? 'failed' : 'success';
              s.progress = 100;
              if (anyFailed) {
                s.error = switchResults.find((r: any) => !r.success)?.error;
              }
            }
          }
          return next;
        });
        setOverallProgress(100);
      } catch (err: any) {
        setExecutionLog((l) => [...l, `[ERROR] Batch execution failed: ${err.message || String(err)}`]);
        setBatchStatuses((prev) =>
          prev.map((s) =>
            s.status === 'waiting' || s.status === 'in-progress'
              ? { ...s, status: 'failed', progress: 100, error: err.message || String(err) }
              : s
          )
        );
        setOverallProgress(100);
      } finally {
        setIsExecuting(false);
        if (unsubProgress) unsubProgress();
      }
    },
    [selectedSwitches, activeTab, buildOperationsForTab, simulateExecution],
  );

  // ─── Abort handler ─────────────────────────────────────────────────

  const handleAbort = useCallback(() => {
    // Try to abort via IPC first
    const api = (window as any).electronAPI;
    if (api?.batchAbort) {
      api.batchAbort().catch(() => {});
    }

    if (executionTimer.current) {
      clearInterval(executionTimer.current);
      executionTimer.current = null;
    }
    setIsExecuting(false);
    setBatchStatuses((prev) =>
      prev.map((s) =>
        s.status === 'waiting' || s.status === 'in-progress'
          ? { ...s, status: 'skipped', progress: s.progress }
          : s
      )
    );
    setExecutionLog((l) => [...l, '[WARN] Batch operation aborted by user']);
    setOverallProgress(100);
  }, []);

  const handleRollback = useCallback(async () => {
    const api = (window as any).electronAPI;

    if (!api?.batchRollback) {
      setExecutionLog((l) => [...l, '[WARN] Rollback not available (simulation mode)']);
      return;
    }

    const failedOps = batchStatuses
      .filter((s) => s.status === 'failed')
      .map((s) => ({ switchIp: s.switchIp, operation: s.currentOperation ?? 'unknown' }));

    if (failedOps.length === 0) {
      setExecutionLog((l) => [...l, '[INFO] No failed operations to rollback']);
      return;
    }

    setExecutionLog((l) => [...l, `[INFO] Rolling back ${failedOps.length} failed operations...`]);

    try {
      const result = await api.batchRollback(failedOps);
      setExecutionLog((l) => [
        ...l,
        `[OK] Rollback complete: ${result.rolledBack} restored, ${result.failed} could not be restored`,
      ]);
    } catch (err) {
      setExecutionLog((l) => [
        ...l,
        `[ERROR] Rollback failed: ${err instanceof Error ? err.message : String(err)}`,
      ]);
    }
  }, [batchStatuses]);

  // ─── Pre-flight connectivity check ──────────────────────────────

  const handlePreFlight = useCallback(async () => {
    if (selectedSwitches.length === 0) return;

    const api = (window as any).electronAPI;

    setPreFlightRunning(true);
    setPreFlightWarning(null);
    setExecutionLog((l) => [...l, `[INFO] Pre-flight check: pinging ${selectedSwitches.length} switches...`]);

    const unreachable: string[] = [];

    for (const sw of selectedSwitches) {
      try {
        if (api?.pingSwitch) {
          const result = await api.pingSwitch(sw.ip);
          if (!result.alive) {
            unreachable.push(sw.ip);
          }
        } else {
          // Simulation mode: treat offline switches as unreachable
          if (!sw.isOnline) {
            unreachable.push(sw.ip);
          }
        }
      } catch {
        unreachable.push(sw.ip);
      }
    }

    const reachableCount = selectedSwitches.length - unreachable.length;
    setExecutionLog((l) => [
      ...l,
      `[OK] ${reachableCount}/${selectedSwitches.length} switches reachable`,
    ]);

    if (unreachable.length > 0) {
      setExecutionLog((l) => [
        ...l,
        `[WARN] ${unreachable.length} switches unreachable: ${unreachable.join(', ')}`,
      ]);
      setPreFlightWarning(unreachable);
    } else {
      setPreFlightWarning(null);
    }

    setPreFlightRunning(false);
  }, [selectedSwitches]);

  const dismissPreFlightWarning = useCallback(() => {
    setPreFlightWarning(null);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (executionTimer.current) clearInterval(executionTimer.current);
    };
  }, []);

  const resetExecution = () => {
    setBatchStatuses([]);
    setOverallProgress(0);
    setExecutionLog([]);
  };

  const handleExportTemplate = useCallback(() => {
    const rows = [
      ['Switch Name', 'IP', 'Model', 'Port Range', 'Group ID', 'VLAN ID', 'PoE Enabled'].join(','),
      ...selectedSwitches.map((sw) =>
        [sw.name, sw.ip, sw.model, `1-${sw.portCount}`, '', '', ''].join(',')
      ),
    ];
    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `switch-config-template-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedSwitches]);

  const showingProgress = batchStatuses.length > 0;

  // ─── Tab content renderers ────────────────────────────────────────────

  const renderGroupsTab = () => (
    <GroupConfigForm
      onPreview={(groups) => showPreview(buildGroupPreview(groups, selectedSwitches), 'Group/VLAN Configuration')}
      onApply={(groups) => realExecution('groups', groups)}
      previewReviewed={previewReviewed}
    />
  );

  const PORT_GROUP_OPTIONS = [
    { value: 1, label: 'Group 1 - Control' },
    { value: 2, label: 'Group 2 - Audio Primary' },
    { value: 3, label: 'Group 3 - Audio Secondary' },
    { value: 4, label: 'Group 4 - Video' },
    { value: 5, label: 'Group 5 - Lighting' },
    { value: 6, label: 'Group 6 - Intercom' },
  ];

  const renderPortsTab = () => (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-white">Port Assignment</h4>
      <p className="text-xs text-gray-400">Assign port ranges to groups across the fleet</p>
      {portAssignments.map((assignment, idx) => (
        <div key={idx} className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Port Range</label>
            <input
              type="text"
              value={assignment.portRange}
              onChange={(e) => {
                setPortAssignments((prev) => {
                  const next = [...prev];
                  next[idx] = { ...next[idx], portRange: e.target.value };
                  return next;
                });
              }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gc-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Assign to Group</label>
            <select
              value={assignment.groupId}
              onChange={(e) => {
                setPortAssignments((prev) => {
                  const next = [...prev];
                  next[idx] = { ...next[idx], groupId: parseInt(e.target.value) };
                  return next;
                });
              }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gc-accent"
            >
              {PORT_GROUP_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3 pt-4 border-t border-gray-700">
        <button
          onClick={() =>
            showPreview(
              selectedSwitches.map((sw) => ({
                switchName: sw.name,
                switchIp: sw.ip,
                changes: portAssignments.map((a) => {
                  const groupLabel = PORT_GROUP_OPTIONS.find((o) => o.value === a.groupId)?.label || `Group ${a.groupId}`;
                  return {
                    field: `Ports ${a.portRange}`,
                    currentValue: 'Group 1',
                    newValue: groupLabel,
                    type: 'change' as const,
                  };
                }),
              })),
              'Port Assignment'
            )
          }
          className="px-4 py-2 text-sm font-medium bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          Preview Changes
        </button>
        <button
          onClick={() => realExecution('ports', portAssignments)}
          disabled={!previewReviewed}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            previewReviewed ? 'bg-gc-accent text-white hover:bg-gc-accent/80' : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Apply
        </button>
      </div>
    </div>
  );

  const renderIGMPTab = () => (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-white">IGMP Settings</h4>
      <p className="text-xs text-gray-400">Enable or disable IGMP snooping, querier, and flooding per group</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left py-2 px-3">Group</th>
              <th className="text-center py-2 px-3">Snooping</th>
              <th className="text-center py-2 px-3">Querier</th>
              <th className="text-center py-2 px-3">Unknown Flooding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {igmpSettings.map((setting, i) => (
              <tr key={setting.name} className="hover:bg-gray-800/50">
                <td className="py-2 px-3 text-white">{setting.name}</td>
                <td className="py-2 px-3 text-center">
                  <input
                    type="checkbox"
                    checked={setting.snooping}
                    onChange={(e) => {
                      setIgmpSettings((prev) => {
                        const next = [...prev];
                        next[i] = { ...next[i], snooping: e.target.checked };
                        return next;
                      });
                    }}
                    className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-gc-accent"
                  />
                </td>
                <td className="py-2 px-3 text-center">
                  <input
                    type="checkbox"
                    checked={setting.querier}
                    onChange={(e) => {
                      setIgmpSettings((prev) => {
                        const next = [...prev];
                        next[i] = { ...next[i], querier: e.target.checked };
                        return next;
                      });
                    }}
                    className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-gc-accent"
                  />
                </td>
                <td className="py-2 px-3 text-center">
                  <input
                    type="checkbox"
                    checked={setting.flooding}
                    onChange={(e) => {
                      setIgmpSettings((prev) => {
                        const next = [...prev];
                        next[i] = { ...next[i], flooding: e.target.checked };
                        return next;
                      });
                    }}
                    className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-gc-accent"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 pt-4 border-t border-gray-700">
        <button
          onClick={() =>
            showPreview(
              selectedSwitches.map((sw) => ({
                switchName: sw.name,
                switchIp: sw.ip,
                changes: igmpSettings.map((s) => ({
                  field: `IGMP Snooping (${s.name})`,
                  currentValue: 'Unknown',
                  newValue: s.snooping ? 'Enabled' : 'Disabled',
                  type: 'change' as const,
                })),
              })),
              'IGMP Configuration'
            )
          }
          className="px-4 py-2 text-sm font-medium bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          Preview Changes
        </button>
        <button
          onClick={() =>
            realExecution(
              'igmp',
              igmpSettings.map((s) => ({ groupId: s.groupId, enabled: s.snooping }))
            )
          }
          disabled={!previewReviewed}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            previewReviewed ? 'bg-gc-accent text-white hover:bg-gc-accent/80' : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Apply
        </button>
      </div>
    </div>
  );

  const renderPoETab = () => (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-white">PoE Configuration</h4>
      <p className="text-xs text-gray-400">Enable/disable PoE and set priority for port ranges</p>
      {poeSettings.map((setting, idx) => (
        <div key={idx} className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Port Range</label>
            <input
              type="text"
              value={setting.portRange}
              onChange={(e) => {
                setPoeSettings((prev) => {
                  const next = [...prev];
                  next[idx] = { ...next[idx], portRange: e.target.value };
                  return next;
                });
              }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gc-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">PoE</label>
            <select
              value={setting.enabled ? 'Enabled' : 'Disabled'}
              onChange={(e) => {
                setPoeSettings((prev) => {
                  const next = [...prev];
                  next[idx] = { ...next[idx], enabled: e.target.value === 'Enabled' };
                  return next;
                });
              }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gc-accent"
            >
              <option>Enabled</option>
              <option>Disabled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Priority</label>
            <select
              value={setting.priority}
              onChange={(e) => {
                setPoeSettings((prev) => {
                  const next = [...prev];
                  next[idx] = { ...next[idx], priority: e.target.value };
                  return next;
                });
              }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gc-accent"
            >
              <option>Critical</option>
              <option>High</option>
              <option>Low</option>
            </select>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3 pt-4 border-t border-gray-700">
        <button
          onClick={() =>
            showPreview(
              selectedSwitches.map((sw) => ({
                switchName: sw.name,
                switchIp: sw.ip,
                changes: poeSettings.map((s) => ({
                  field: `Ports ${s.portRange} PoE`,
                  currentValue: 'Unknown',
                  newValue: `${s.enabled ? 'Enabled' : 'Disabled'} (${s.priority})`,
                  type: 'change' as const,
                })),
              })),
              'PoE Configuration'
            )
          }
          className="px-4 py-2 text-sm font-medium bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          Preview Changes
        </button>
        <button
          onClick={() =>
            realExecution(
              'poe',
              poeSettings.map((s) => ({ portRange: s.portRange, enabled: s.enabled }))
            )
          }
          disabled={!previewReviewed}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            previewReviewed ? 'bg-gc-accent text-white hover:bg-gc-accent/80' : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Apply
        </button>
      </div>
    </div>
  );

  const renderNamingTab = () => (
    <SequentialNaming
      switches={selectedSwitches}
      onPreview={(assignments) => showPreview(buildNamingPreview(assignments), 'Sequential Naming')}
      onApply={(assignments) => realExecution('naming', assignments)}
      previewReviewed={previewReviewed}
    />
  );

  const renderIPTab = () => (
    <SequentialIP
      switches={selectedSwitches}
      onPreview={(assignments) => showPreview(buildIPPreview(assignments), 'IP Addressing')}
      onApply={(assignments) => realExecution('ip', assignments)}
      previewReviewed={previewReviewed}
    />
  );

  const renderProfileTab = () => (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-white">Profile Deploy</h4>
      <p className="text-xs text-gray-400">Select a saved profile and push to all selected switches</p>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Select Profile</label>
        <select
          value={profileSlot}
          onChange={(e) => setProfileSlot(parseInt(e.target.value))}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gc-accent"
        >
          {PROFILE_OPTIONS.map((name, i) => (
            <option key={i + 1} value={i + 1}>{name}</option>
          ))}
        </select>
      </div>
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <h5 className="text-xs font-medium text-gray-300 mb-2">Profile Summary</h5>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-500">Groups:</span>
            <span className="text-white ml-2">6 configured</span>
          </div>
          <div>
            <span className="text-gray-500">VLANs:</span>
            <span className="text-white ml-2">6 (1, 10, 11, 20, 30, 40)</span>
          </div>
          <div>
            <span className="text-gray-500">IGMP:</span>
            <span className="text-white ml-2">Snooping enabled on 5 groups</span>
          </div>
          <div>
            <span className="text-gray-500">PoE:</span>
            <span className="text-white ml-2">Enabled ports 1-16</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 pt-4 border-t border-gray-700">
        <button
          onClick={() =>
            showPreview(
              selectedSwitches.map((sw) => ({
                switchName: sw.name,
                switchIp: sw.ip,
                changes: [
                  { field: 'Profile', currentValue: '(custom)', newValue: PROFILE_OPTIONS[profileSlot - 1] || `Slot ${profileSlot}`, type: 'change' as const },
                  { field: 'Groups', currentValue: 'varies', newValue: '6 groups configured', type: 'change' as const },
                ],
              })),
              'Profile Deploy'
            )
          }
          className="px-4 py-2 text-sm font-medium bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          Preview Changes
        </button>
        <button
          onClick={() => realExecution('profile', profileSlot)}
          disabled={!previewReviewed}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            previewReviewed ? 'bg-gc-accent text-white hover:bg-gc-accent/80' : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Deploy Profile
        </button>
      </div>
    </div>
  );

  const renderFirmwareTab = () => (
    <FirmwareUploader
      switches={selectedSwitches}
      onPreview={(file) => showPreview(buildFirmwarePreview(file, selectedSwitches), 'Firmware Update')}
      onApply={(file, rebootAfter) => realExecution('firmware', { file, rebootAfter })}
      previewReviewed={previewReviewed}
    />
  );

  const renderSystemTab = () => (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium text-white">System Operations</h4>
        <p className="text-xs text-gray-400 mt-0.5">
          Reboot or factory reset selected switches
        </p>
      </div>

      {/* Reboot */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <Power className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h5 className="text-sm font-medium text-white">Reboot All Selected</h5>
              <p className="text-xs text-gray-400 mt-0.5">
                Sequentially reboot {selectedSwitches.length} switches
              </p>
            </div>
          </div>
          <button
            onClick={() =>
              showPreview(
                selectedSwitches.map((sw) => ({
                  switchName: sw.name,
                  switchIp: sw.ip,
                  changes: [
                    { field: 'Action', currentValue: 'Running', newValue: 'Reboot', type: 'change' as const },
                  ],
                })),
                'System Reboot'
              )
            }
            className="px-4 py-2 text-sm font-medium bg-yellow-600/20 text-yellow-400 border border-yellow-500/30 rounded-lg hover:bg-yellow-600/30 transition-colors"
          >
            Reboot Selected
          </button>
        </div>
      </div>

      {/* Factory Reset */}
      <div className="bg-gray-800 border border-red-500/20 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <RotateCcw className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h5 className="text-sm font-medium text-white">Factory Reset</h5>
              <p className="text-xs text-red-400/80 mt-0.5">
                This will erase ALL configuration on selected switches
              </p>
            </div>
          </div>
          <button
            onClick={() =>
              showPreview(
                selectedSwitches.map((sw) => ({
                  switchName: sw.name,
                  switchIp: sw.ip,
                  changes: [
                    { field: 'ALL Settings', currentValue: 'Current Config', newValue: 'Factory Default', type: 'remove' as const },
                    { field: 'Groups/VLANs', currentValue: 'Configured', newValue: 'Removed', type: 'remove' as const },
                    { field: 'Port Config', currentValue: 'Configured', newValue: 'Default', type: 'remove' as const },
                  ],
                })),
                'Factory Reset',
                true
              )
            }
            className="px-4 py-2 text-sm font-medium bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-600/30 transition-colors"
          >
            Factory Reset
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-red-500/5 border border-red-500/10 rounded">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400/80">
            WARNING: Factory reset is irreversible. All VLAN, group, port, IGMP, and PoE
            configurations will be permanently erased.
          </p>
        </div>
      </div>
    </div>
  );

  const tabRenderers: Record<TabId, () => React.ReactNode> = {
    groups: renderGroupsTab,
    ports: renderPortsTab,
    igmp: renderIGMPTab,
    poe: renderPoETab,
    naming: renderNamingTab,
    ip: renderIPTab,
    profile: renderProfileTab,
    firmware: renderFirmwareTab,
    system: renderSystemTab,
  };

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-700">
        <Layers size={24} className="text-gc-accent" />
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-white">Batch Configuration</h2>
          <p className="text-xs text-gray-400">
            Apply configuration to multiple GigaCore switches simultaneously
          </p>
        </div>
        {selectedSwitches.length > 0 && (
          <button
            onClick={handleExportTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-700 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-600 hover:text-white transition-colors"
          >
            <Download size={14} />
            Export Template
          </button>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* ─── Left Sidebar: Switch Selector ─────────────────────────────── */}
        <div className="w-[300px] flex-shrink-0 border-r border-gray-700 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-300">Switches</h3>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as 'model' | 'rack' | 'none')}
              className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-400 focus:outline-none focus:border-gc-accent"
            >
              <option value="none">No Grouping</option>
              <option value="rack">By Rack</option>
              <option value="model">By Model</option>
            </select>
          </div>

          <BatchSelector
            switches={MOCK_SWITCHES}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            groupBy={groupBy}
          />
        </div>

        {/* ─── Main Content Area ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col">
          {selectedIds.size === 0 ? (
            /* Empty state */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <Layers className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-400 mb-2">
                  Select Switches to Configure
                </h3>
                <p className="text-sm text-gray-500">
                  Choose one or more switches from the left panel to begin batch configuration.
                  Use filters and group selection for quick multi-select.
                </p>
              </div>
            </div>
          ) : showingProgress ? (
            /* Progress view */
            <div className="flex-1 overflow-y-auto p-6">
              <BatchProgress
                switches={batchStatuses}
                overallProgress={overallProgress}
                isRunning={isExecuting}
                onAbort={handleAbort}
                onRollback={handleRollback}
                log={executionLog}
              />
              {!isExecuting && batchStatuses.length > 0 && batchStatuses.every(s => s.status === 'success') && (
                <div className="flex items-center gap-3 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-sm mt-3">
                  <span className="text-green-400">Batch complete — all switches configured.</span>
                  <button onClick={() => setView(VIEWS.SHOW_FILE)} className="text-gc-accent hover:underline">
                    Save as show file →
                  </button>
                  <button onClick={() => setView(VIEWS.SCANNER)} className="text-gc-accent hover:underline">
                    Verify in scanner →
                  </button>
                </div>
              )}
              {!isExecuting && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={resetExecution}
                    className="px-4 py-2 text-sm font-medium bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Back to Configuration
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Operation tabs */
            <>
              {/* Tab bar */}
              <div className="flex items-center gap-0.5 px-4 pt-3 border-b border-gray-700 overflow-x-auto flex-shrink-0">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setPreviewReviewed(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'text-gc-accent border-gc-accent bg-gray-800/50'
                        : 'text-gray-400 border-transparent hover:text-white hover:bg-gray-800/30'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-6">
                {selectedSwitches.length > 0 && (
                  <div className="mb-4 flex items-center gap-2 text-xs text-gray-500">
                    <span className="px-2 py-0.5 bg-gc-accent/10 text-gc-accent rounded-full font-medium">
                      {selectedSwitches.length} switch{selectedSwitches.length > 1 ? 'es' : ''}
                    </span>
                    <span>selected:</span>
                    <span className="text-gray-400 flex-1">
                      {selectedSwitches
                        .slice(0, 4)
                        .map((s) => s.name)
                        .join(', ')}
                      {selectedSwitches.length > 4 && ` +${selectedSwitches.length - 4} more`}
                    </span>
                    <button
                      onClick={handlePreFlight}
                      disabled={preFlightRunning || isExecuting || selectedSwitches.length === 0}
                      className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white text-sm rounded disabled:opacity-50"
                    >
                      {preFlightRunning ? 'Checking...' : 'Pre-Flight Check'}
                    </button>
                  </div>
                )}

                {/* Pre-flight unreachable warning banner */}
                {preFlightWarning && preFlightWarning.length > 0 && (
                  <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                    <div className="flex-1 text-sm">
                      <p className="text-yellow-300 font-medium">
                        {preFlightWarning.length} switch{preFlightWarning.length > 1 ? 'es' : ''} unreachable
                      </p>
                      <p className="text-yellow-400/70 text-xs mt-0.5">
                        {preFlightWarning.join(', ')}
                      </p>
                    </div>
                    <button
                      onClick={dismissPreFlightWarning}
                      className="px-3 py-1.5 text-xs font-medium bg-yellow-600/20 text-yellow-300 border border-yellow-500/30 rounded hover:bg-yellow-600/30 transition-colors"
                    >
                      Proceed Anyway
                    </button>
                    <button
                      onClick={() => setPreFlightWarning(null)}
                      className="px-3 py-1.5 text-xs font-medium bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {tabRenderers[activeTab]()}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {previewData && (
        <BatchPreview
          operations={previewData}
          onConfirm={confirmPreview}
          onCancel={cancelPreview}
          isDestructive={isDestructive}
          operationLabel={previewLabel}
        />
      )}
    </div>
  );
}
