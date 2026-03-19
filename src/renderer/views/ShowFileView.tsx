import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FileArchive,
  Rocket,
  History,
  Activity,
  Plus,
  Upload,
  Download,
  Trash2,
  FolderOpen,
  Server,
  Clock,
  Tag,
  ChevronRight,
  RotateCcw,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  GitCompare,
  ArrowDownToLine,
  Eye,
} from 'lucide-react';
import type {
  ShowFile,
  ShowFileVersion,
  ShowFileSwitchConfig,
  VlanConfig,
  PortConfig,
  DeployStatus,
} from '@shared/types';
import { useShowFileStore, type ShowFileState } from '../store/useShowFileStore';
import { PreFlightPanel } from '../components/PreFlightPanel';
import { ShowFileDiffViewer } from '../components/ShowFileDiffViewer';

// ---------------------------------------------------------------------------
// Tab definition
// ---------------------------------------------------------------------------

type Tab = 'library' | 'deploy' | 'versions' | 'drift';

const TABS: { id: Tab; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'library', label: 'Library', Icon: FileArchive },
  { id: 'deploy', label: 'Deploy', Icon: Rocket },
  { id: 'versions', label: 'Versions', Icon: History },
  { id: 'drift', label: 'Drift', Icon: Activity },
];

// ---------------------------------------------------------------------------
// Mock data seed — creates realistic show files on first load
// ---------------------------------------------------------------------------

function makePorts(count: number, vlan: number): PortConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    port: i + 1,
    vlan,
    taggedVlans: i >= count - 2 ? [1, 10, 20] : undefined,
    poeEnabled: i < count - 2,
    enabled: true,
    label: i >= count - 2 ? `Uplink ${i - count + 3}` : `Port ${i + 1}`,
  }));
}

function makeMockSwitch(
  id: string,
  name: string,
  ip: string,
  role: ShowFileSwitchConfig['role'],
  portCount: number,
): ShowFileSwitchConfig {
  return {
    switchId: id,
    mac: `00:1A:2B:${id.slice(-2)}:00:01`,
    name,
    ip,
    role,
    portConfigs: makePorts(portCount, 1),
    vlans: [
      { id: 1, name: 'Management', tagged: [], untagged: [1] },
      { id: 10, name: 'Dante Primary', tagged: [1, 2], untagged: [] },
      { id: 20, name: 'sACN', tagged: [1, 2], untagged: [] },
    ],
    groups: [
      { groupNumber: 1, name: 'Management', vlanId: 1, igmpSnooping: false, igmpQuerier: false, unknownFlooding: true },
      { groupNumber: 2, name: 'Dante Primary', vlanId: 10, igmpSnooping: true, igmpQuerier: true, unknownFlooding: false },
    ],
    igmpSettings: { snooping: true, querier: role === 'foh-core' },
    poeSettings: { enabled: true, budgetW: 370 },
  };
}

const MOCK_VLANS: VlanConfig[] = [
  { id: 1, name: 'Management', tagged: [], untagged: [1, 2, 3, 4] },
  { id: 10, name: 'Dante Primary', tagged: [1, 2, 3, 4], untagged: [] },
  { id: 11, name: 'Dante Secondary', tagged: [1, 2, 3, 4], untagged: [] },
  { id: 20, name: 'sACN / E1.31', tagged: [1, 2, 3], untagged: [] },
  { id: 50, name: 'Comms', tagged: [1, 4], untagged: [] },
];

function seedMockData(createFn: ShowFileState['createShowFile']) {
  const switches1: ShowFileSwitchConfig[] = [
    makeMockSwitch('sw-001', 'FOH-CORE-01', '10.0.0.1', 'foh-core', 26),
    makeMockSwitch('sw-002', 'FOH-DISTRO-01', '10.0.0.2', 'foh-distro', 14),
    makeMockSwitch('sw-003', 'SL-RACK-01', '10.0.0.3', 'stage-left', 14),
    makeMockSwitch('sw-004', 'SR-RACK-01', '10.0.0.4', 'stage-right', 14),
    makeMockSwitch('sw-005', 'MON-WORLD-01', '10.0.0.5', 'monitor-world', 18),
  ];
  const sf1 = createFn('Summer Tour 2026 — Main Stage', switches1, MOCK_VLANS);
  // Patch metadata
  Object.assign(sf1, {
    tourId: 'tour-001',
    tags: ['tour', 'main-stage', 'arena'],
    description: 'Main stage network config for the Summer 2026 arena tour',
    createdBy: 'System Engineer',
  });

  const switches2: ShowFileSwitchConfig[] = [
    makeMockSwitch('sw-010', 'BC-CORE-01', '10.1.0.1', 'broadcast', 26),
    makeMockSwitch('sw-011', 'BC-STAGE-01', '10.1.0.2', 'stage-left', 14),
    makeMockSwitch('sw-012', 'BC-DELAY-01', '10.1.0.3', 'delay-tower', 10),
  ];
  const sf2 = createFn('Festival Broadcast — Stage B', switches2, MOCK_VLANS.slice(0, 3));
  Object.assign(sf2, {
    venueId: 'venue-002',
    tags: ['festival', 'broadcast', 'outdoor'],
    description: 'Broadcast network for festival Stage B',
  });

  const switches3: ShowFileSwitchConfig[] = [
    makeMockSwitch('sw-020', 'THEATER-CORE', '10.2.0.1', 'foh-core', 18),
    makeMockSwitch('sw-021', 'THEATER-TRUSS-01', '10.2.0.2', 'truss', 10),
    makeMockSwitch('sw-022', 'THEATER-TRUSS-02', '10.2.0.3', 'truss', 10),
    makeMockSwitch('sw-023', 'THEATER-FLOOR', '10.2.0.4', 'floor-distro', 14),
  ];
  createFn('Theater Residency — City Hall', switches3, MOCK_VLANS);
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export const ShowFileView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [seeded, setSeeded] = useState(false);

  const {
    showFiles,
    versions,
    activeShowFileId,
    preFlightReport,
    deployResult,
    driftReport,
    createShowFile,
    saveVersion,
    loadShowFile,
    deleteShowFile,
    runPreFlight,
    deploy,
    rollback,
    checkDrift,
    importShowFile,
    exportShowFile,
  } = useShowFileStore();

  // Seed mock data on first render
  useEffect(() => {
    if (!seeded && showFiles.length === 0) {
      seedMockData(createShowFile);
      setSeeded(true);
    }
  }, [seeded, showFiles.length, createShowFile]);

  const activeShowFile = useMemo(
    () => showFiles.find((sf) => sf.id === activeShowFileId) ?? null,
    [showFiles, activeShowFileId],
  );

  const activeVersions = useMemo(
    () => (activeShowFileId ? versions[activeShowFileId] ?? [] : []),
    [versions, activeShowFileId],
  );

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
        <div>
          <h1 className="text-lg font-bold">Show Files</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Manage, deploy, and version your network configurations
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === id
                  ? 'bg-gc-accent text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'library' && (
          <LibraryTab
            showFiles={showFiles}
            activeShowFileId={activeShowFileId}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSelect={loadShowFile}
            onDelete={deleteShowFile}
            onExport={exportShowFile}
            onImport={importShowFile}
            onCreate={createShowFile}
          />
        )}
        {activeTab === 'deploy' && (
          <DeployTab
            showFiles={showFiles}
            activeShowFile={activeShowFile}
            preFlightReport={preFlightReport}
            deployResult={deployResult}
            onSelect={loadShowFile}
            onRunPreFlight={runPreFlight}
            onDeploy={deploy}
            onRollback={rollback}
          />
        )}
        {activeTab === 'versions' && (
          <VersionsTab
            activeShowFile={activeShowFile}
            versions={activeVersions}
            showFiles={showFiles}
            onSelect={loadShowFile}
            onSaveVersion={saveVersion}
          />
        )}
        {activeTab === 'drift' && (
          <DriftTab
            showFiles={showFiles}
            activeShowFile={activeShowFile}
            driftReport={driftReport}
            onSelect={loadShowFile}
            onCheckDrift={checkDrift}
          />
        )}
      </div>
    </div>
  );
};

// ===========================================================================
// Library Tab
// ===========================================================================

interface LibraryTabProps {
  showFiles: ShowFile[];
  activeShowFileId: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => string | null;
  onImport: (json: string) => ShowFile | null;
  onCreate: (...args: Parameters<ShowFileState['createShowFile']>) => ShowFile;
}

const LibraryTab: React.FC<LibraryTabProps> = ({
  showFiles,
  activeShowFileId,
  searchQuery,
  setSearchQuery,
  onSelect,
  onDelete,
  onExport,
  onImport,
  onCreate,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return showFiles;
    const q = searchQuery.toLowerCase();
    return showFiles.filter(
      (sf) =>
        sf.name.toLowerCase().includes(q) ||
        sf.tags?.some((t) => t.toLowerCase().includes(q)) ||
        sf.description?.toLowerCase().includes(q),
    );
  }, [showFiles, searchQuery]);

  const handleExport = (id: string) => {
    const json = onExport(id);
    if (!json) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const sf = showFiles.find((s) => s.id === id);
    a.download = `${sf?.name.replace(/\s+/g, '_') ?? 'show-file'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImport(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCreateNew = () => {
    const sw = makeMockSwitch(
      `sw-new-${Date.now()}`,
      'NEW-SWITCH-01',
      '10.0.0.100',
      'spare',
      14,
    );
    onCreate('New Show File', [sw], MOCK_VLANS.slice(0, 2));
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search show files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gc-accent"
          />
        </div>
        <button
          onClick={handleCreateNew}
          className="flex items-center gap-1.5 px-3 py-2 bg-gc-accent hover:bg-gc-accent/80 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
        <button
          onClick={handleImportClick}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm font-medium transition-colors"
        >
          <Upload className="w-4 h-4" />
          Import
        </button>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <FolderOpen className="w-12 h-12 mb-3" />
          <p className="text-sm">No show files found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((sf) => (
            <div
              key={sf.id}
              className={`bg-gray-800/60 border rounded-lg p-4 cursor-pointer transition-all hover:border-gc-accent/60 hover:bg-gray-800 ${
                sf.id === activeShowFileId ? 'border-gc-accent ring-1 ring-gc-accent/30' : 'border-gray-700'
              }`}
              onClick={() => onSelect(sf.id)}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-semibold text-white truncate flex-1 mr-2">{sf.name}</h3>
                <span className="text-xs text-gray-500 whitespace-nowrap">v{sf.version}</span>
              </div>

              {sf.description && (
                <p className="text-xs text-gray-400 mb-3 line-clamp-2">{sf.description}</p>
              )}

              <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                <span className="flex items-center gap-1">
                  <Server className="w-3 h-3" />
                  {sf.switches.length} switches
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(sf.updatedAt).toLocaleDateString()}
                </span>
              </div>

              {sf.tags && sf.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {sf.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-700/60 border border-gray-600 rounded text-xs text-gray-400"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-gray-700/50">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport(sf.id);
                  }}
                  className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Export
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete "${sf.name}"?`)) onDelete(sf.id);
                  }}
                  className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-red-900/60 rounded text-xs text-gray-300 hover:text-red-300 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ===========================================================================
// Deploy Tab
// ===========================================================================

interface DeployTabProps {
  showFiles: ShowFile[];
  activeShowFile: ShowFile | null;
  preFlightReport: ReturnType<typeof useShowFileStore.getState>['preFlightReport'];
  deployResult: ReturnType<typeof useShowFileStore.getState>['deployResult'];
  onSelect: (id: string) => void;
  onRunPreFlight: (id: string) => void;
  onDeploy: (id: string) => Promise<any>;
  onRollback: (id: string) => void;
}

const DeployTab: React.FC<DeployTabProps> = ({
  showFiles,
  activeShowFile,
  preFlightReport,
  deployResult,
  onSelect,
  onRunPreFlight,
  onDeploy,
  onRollback,
}) => {
  const [deploying, setDeploying] = useState(false);
  const [preFlightRunning, setPreFlightRunning] = useState(false);

  // Listen for real-time deploy progress events from the main process.
  // The store already handles updating deployResult via onDeployProgress in
  // the deploy action, but we also subscribe here to cover cases where the
  // main process emits progress events outside of the deploy() call flow
  // (e.g. long-running background deploys).
  useEffect(() => {
    if (!window.electronAPI?.onDeployProgress) return;
    const unsub = window.electronAPI.onDeployProgress((progress) => {
      const store = useShowFileStore.getState();
      if (!store.deployResult) return;
      const updatedSwitches = store.deployResult.switches.map((sw) =>
        sw.switchId === progress.switchId
          ? { ...sw, status: progress.status, message: progress.message, duration: progress.duration }
          : sw,
      );
      useShowFileStore.setState({
        deployResult: { ...store.deployResult, switches: updatedSwitches },
      });
    });
    return unsub;
  }, []);

  const handleRunPreFlight = useCallback(() => {
    if (!activeShowFile) return;
    setPreFlightRunning(true);
    setTimeout(() => {
      onRunPreFlight(activeShowFile.id);
      setPreFlightRunning(false);
    }, 800);
  }, [activeShowFile, onRunPreFlight]);

  const handleDeploy = useCallback(async () => {
    if (!activeShowFile) return;
    setDeploying(true);
    await onDeploy(activeShowFile.id);
    setDeploying(false);
  }, [activeShowFile, onDeploy]);

  const handleRollback = useCallback(() => {
    if (deployResult) onRollback(deployResult.id);
  }, [deployResult, onRollback]);

  const statusIcon = (status: DeployStatus) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'deploying':
        return <Loader2 className="w-4 h-4 text-gc-accent animate-spin" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-500" />;
      case 'rolled-back':
        return <RotateCcw className="w-4 h-4 text-yellow-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Select show file */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2">Select Show File to Deploy</label>
        <select
          value={activeShowFile?.id ?? ''}
          onChange={(e) => onSelect(e.target.value)}
          className="w-full max-w-md px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-gc-accent"
        >
          <option value="">-- Select --</option>
          {showFiles.map((sf) => (
            <option key={sf.id} value={sf.id}>
              {sf.name} (v{sf.version}) -- {sf.switches.length} switches
            </option>
          ))}
        </select>
      </div>

      {activeShowFile && (
        <>
          {/* Show file summary */}
          <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <FileArchive className="w-5 h-5 text-gc-accent" />
              <h3 className="text-sm font-semibold text-white">{activeShowFile.name}</h3>
              <span className="text-xs text-gray-500">v{activeShowFile.version}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-400">
              <div>
                <span className="text-gray-500 block">Switches</span>
                <span className="text-white font-medium">{activeShowFile.switches.length}</span>
              </div>
              <div>
                <span className="text-gray-500 block">VLANs</span>
                <span className="text-white font-medium">{activeShowFile.vlans.length}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Updated</span>
                <span className="text-white font-medium">{new Date(activeShowFile.updatedAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Created By</span>
                <span className="text-white font-medium">{activeShowFile.createdBy ?? 'Unknown'}</span>
              </div>
            </div>
          </div>

          {/* Pre-flight panel */}
          <PreFlightPanel
            report={preFlightReport}
            isRunning={preFlightRunning}
            onRunPreFlight={handleRunPreFlight}
            onDeploy={handleDeploy}
            deploying={deploying}
          />

          {/* Deploy progress */}
          {deployResult && (
            <div className="bg-gray-800/40 border border-gray-700 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-800/80 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-gc-accent" />
                  <h3 className="text-sm font-semibold text-gray-200">Deploy Progress</h3>
                </div>
                <div className="flex items-center gap-2">
                  {deployResult.overallStatus === 'success' && (
                    <span className="text-xs text-emerald-400 font-medium">Deployed Successfully</span>
                  )}
                  {deployResult.overallStatus === 'failed' && (
                    <span className="text-xs text-red-400 font-medium">Deployment Failed</span>
                  )}
                  {deployResult.overallStatus === 'rolled-back' && (
                    <span className="text-xs text-yellow-400 font-medium">Rolled Back</span>
                  )}
                  {deployResult.rollbackAvailable && (
                    <button
                      onClick={handleRollback}
                      className="flex items-center gap-1 px-2 py-1 bg-yellow-900/40 hover:bg-yellow-900/60 border border-yellow-700/50 rounded text-xs text-yellow-300 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Rollback
                    </button>
                  )}
                </div>
              </div>
              <div className="divide-y divide-gray-700/50">
                {deployResult.switches.map((sw) => {
                  const swConfig = activeShowFile.switches.find((s) => s.switchId === sw.switchId);
                  return (
                    <div key={sw.switchId} className="flex items-center gap-3 px-4 py-2.5">
                      {statusIcon(sw.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-200">{swConfig?.name ?? sw.switchId}</span>
                          <span className="text-xs text-gray-500">{swConfig?.ip}</span>
                        </div>
                        {sw.message && sw.status === 'failed' && (
                          <p className="text-xs text-red-400 mt-0.5 truncate" title={sw.message}>
                            {sw.message}
                          </p>
                        )}
                        {sw.message && sw.status !== 'failed' && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate" title={sw.message}>
                            {sw.message}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 capitalize flex-shrink-0">{sw.status}</span>
                      {sw.duration != null && (
                        <span className="text-xs text-gray-600 flex-shrink-0">{sw.duration}ms</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ===========================================================================
// Versions Tab
// ===========================================================================

interface VersionsTabProps {
  activeShowFile: ShowFile | null;
  versions: ShowFileVersion[];
  showFiles: ShowFile[];
  onSelect: (id: string) => void;
  onSaveVersion: (showFileId: string, description: string) => void;
}

const VersionsTab: React.FC<VersionsTabProps> = ({
  activeShowFile,
  versions,
  showFiles,
  onSelect,
  onSaveVersion,
}) => {
  const [selectedVersionIdx, setSelectedVersionIdx] = useState<number | null>(null);
  const [newDescription, setNewDescription] = useState('');

  // Pick the show file if none active
  if (!activeShowFile) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-400">Select a show file to view its version history.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {showFiles.map((sf) => (
            <button
              key={sf.id}
              onClick={() => onSelect(sf.id)}
              className="flex items-center gap-3 p-3 bg-gray-800/60 border border-gray-700 rounded-lg hover:border-gc-accent/60 text-left transition-colors"
            >
              <FileArchive className="w-5 h-5 text-gc-accent flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">{sf.name}</p>
                <p className="text-xs text-gray-500">v{sf.version} -- {sf.switches.length} switches</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-600 ml-auto" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  const sortedVersions = [...versions].sort((a, b) => b.version - a.version);
  const selectedVersion = selectedVersionIdx !== null ? sortedVersions[selectedVersionIdx] : null;

  const handleSave = () => {
    if (!newDescription.trim()) return;
    onSaveVersion(activeShowFile.id, newDescription.trim());
    setNewDescription('');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">{activeShowFile.name}</h2>
          <p className="text-xs text-gray-500">{sortedVersions.length} version(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Describe changes..."
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gc-accent w-64"
          />
          <button
            onClick={handleSave}
            disabled={!newDescription.trim()}
            className="flex items-center gap-1 px-3 py-1.5 bg-gc-accent hover:bg-gc-accent/80 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded text-sm font-medium transition-colors"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            Save Version
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Timeline */}
        <div className="lg:col-span-1 space-y-1">
          {sortedVersions.map((ver, idx) => (
            <button
              key={ver.id}
              onClick={() => setSelectedVersionIdx(idx)}
              className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors ${
                selectedVersionIdx === idx
                  ? 'bg-gc-accent/20 border border-gc-accent/40'
                  : 'bg-gray-800/40 border border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="flex flex-col items-center mt-1">
                <div className={`w-2.5 h-2.5 rounded-full ${idx === 0 ? 'bg-gc-accent' : 'bg-gray-600'}`} />
                {idx < sortedVersions.length - 1 && <div className="w-px h-6 bg-gray-700 mt-1" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-300">v{ver.version}</span>
                  {idx === 0 && (
                    <span className="px-1.5 py-0.5 bg-gc-accent/20 text-gc-accent text-[10px] rounded font-medium">
                      LATEST
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate mt-0.5">{ver.changeDescription}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">
                  {new Date(ver.createdAt).toLocaleString()}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Diff viewer */}
        <div className="lg:col-span-2">
          {selectedVersion ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <GitCompare className="w-4 h-4 text-gc-accent" />
                <h3 className="text-sm font-semibold text-gray-200">
                  Version {selectedVersion.version} Changes
                </h3>
              </div>
              {selectedVersion.diff ? (
                <ShowFileDiffViewer
                  diff={selectedVersion.diff}
                  before={
                    selectedVersionIdx !== null && selectedVersionIdx < sortedVersions.length - 1
                      ? sortedVersions[selectedVersionIdx + 1]?.snapshot
                      : undefined
                  }
                  after={selectedVersion.snapshot}
                />
              ) : (
                <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-6 text-center">
                  <Eye className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Initial version — no previous version to compare</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {selectedVersion.snapshot.switches.length} switches, {selectedVersion.snapshot.vlans.length} VLANs
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <History className="w-10 h-10 mb-3" />
              <p className="text-sm">Select a version to view changes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ===========================================================================
// Drift Tab
// ===========================================================================

interface DriftTabProps {
  showFiles: ShowFile[];
  activeShowFile: ShowFile | null;
  driftReport: ReturnType<typeof useShowFileStore.getState>['driftReport'];
  onSelect: (id: string) => void;
  onCheckDrift: (id: string) => void;
}

const DriftTab: React.FC<DriftTabProps> = ({
  showFiles,
  activeShowFile,
  driftReport,
  onSelect,
  onCheckDrift,
}) => {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [checking, setChecking] = useState(false);

  const handleCheck = useCallback(() => {
    if (!activeShowFile) return;
    setChecking(true);
    setTimeout(() => {
      onCheckDrift(activeShowFile.id);
      setChecking(false);
    }, 600);
  }, [activeShowFile, onCheckDrift]);

  useEffect(() => {
    if (autoRefresh && activeShowFile) {
      intervalRef.current = setInterval(() => {
        onCheckDrift(activeShowFile.id);
      }, 10000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, activeShowFile, onCheckDrift]);

  const severityBadge = (severity: 'info' | 'warning' | 'critical') => {
    const config = {
      info: 'bg-blue-900/40 border-blue-700/50 text-blue-300',
      warning: 'bg-yellow-900/40 border-yellow-700/50 text-yellow-300',
      critical: 'bg-red-900/40 border-red-700/50 text-red-300',
    }[severity];
    return (
      <span className={`px-2 py-0.5 rounded text-xs border font-medium capitalize ${config}`}>
        {severity}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <select
          value={activeShowFile?.id ?? ''}
          onChange={(e) => onSelect(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-gc-accent max-w-md"
        >
          <option value="">-- Select show file --</option>
          {showFiles.map((sf) => (
            <option key={sf.id} value={sf.id}>
              {sf.name}
            </option>
          ))}
        </select>

        <button
          onClick={handleCheck}
          disabled={!activeShowFile || checking}
          className="flex items-center gap-1.5 px-3 py-2 bg-gc-accent hover:bg-gc-accent/80 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {checking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Check Drift
        </button>

        <label className="flex items-center gap-2 cursor-pointer ml-auto">
          <span className="text-xs text-gray-400">Auto-refresh</span>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              autoRefresh ? 'bg-gc-accent' : 'bg-gray-700'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                autoRefresh ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
        </label>
      </div>

      {/* Results */}
      {driftReport ? (
        <div className="space-y-3">
          {/* Summary */}
          <div
            className={`flex items-center gap-3 p-4 rounded-lg border ${
              driftReport.totalDrifts === 0
                ? 'bg-emerald-900/30 border-emerald-700'
                : 'bg-yellow-900/30 border-yellow-700'
            }`}
          >
            {driftReport.totalDrifts === 0 ? (
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-200">
                {driftReport.totalDrifts === 0
                  ? 'No configuration drift detected'
                  : `${driftReport.totalDrifts} drift(s) detected`}
              </p>
              <p className="text-xs text-gray-500">
                Last checked: {new Date(driftReport.timestamp).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Drift table */}
          {driftReport.drifts.length > 0 && (
            <div className="bg-gray-800/40 border border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-800/60">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase">Switch</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase">Field</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase">Expected</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase">Actual</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {driftReport.drifts.map((drift, idx) => (
                    <tr key={idx} className="hover:bg-gray-800/40">
                      <td className="px-4 py-2.5">
                        <span className="text-sm text-gray-200">{drift.switchName}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-sm font-mono text-gray-300">{drift.field}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-sm text-emerald-400 font-mono">{drift.expected}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-sm text-red-400 font-mono">{drift.actual}</span>
                      </td>
                      <td className="px-4 py-2.5">{severityBadge(drift.severity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : activeShowFile ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <Activity className="w-10 h-10 mb-3" />
          <p className="text-sm">Click "Check Drift" to compare live switch state against the show file</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <Activity className="w-10 h-10 mb-3" />
          <p className="text-sm">Select a show file to begin drift detection</p>
        </div>
      )}
    </div>
  );
};
