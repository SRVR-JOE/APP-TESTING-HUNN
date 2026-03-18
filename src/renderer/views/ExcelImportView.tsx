import React, { useState, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet,
  Search,
  Eye,
  Rocket,
  ArrowLeft,
  ArrowRight,
  Download,
  FileText,
  X,
  CheckCircle2,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { StepWizard } from '../components/StepWizard';
import { ExcelDropzone } from '../components/ExcelDropzone';
import { ValidationResults, ValidationResult } from '../components/ValidationResults';
import { ExcelPreview, DeployChange } from '../components/ExcelPreview';
import { DeployProgress, DeploySwitchProgress } from '../components/DeployProgress';

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_SHEETS = [
  { name: 'IP Scheme', rows: 12 },
  { name: 'Port Assignments', rows: 48 },
  { name: 'Group Definitions', rows: 9 },
];

const MOCK_VALIDATION: ValidationResult = {
  items: [
    { id: 'v1', type: 'pass', message: 'All IP addresses valid' },
    { id: 'v2', type: 'pass', message: 'No duplicate IPs detected' },
    { id: 'v3', type: 'pass', message: 'All port numbers in valid range (1-52)' },
    { id: 'v4', type: 'pass', message: 'VLAN IDs within range (1-4094)' },
    { id: 'v5', type: 'pass', message: 'Group names are unique' },
    {
      id: 'v6',
      type: 'warning',
      sheet: 'IP Scheme',
      row: 8,
      message: "Switch 'FOH-SW-03' not found on network — will be skipped",
      details:
        'The switch named FOH-SW-03 with IP 10.0.1.30 was not detected during network scan. It will be excluded from deployment.',
    },
    {
      id: 'v7',
      type: 'warning',
      sheet: 'Port Assignments',
      row: 22,
      message: "Port 49 on 'STAGE-SW-01' is currently in use — will be reconfigured",
    },
    {
      id: 'v8',
      type: 'error',
      sheet: 'IP Scheme',
      row: 5,
      message: "Invalid IP address '10.0.1.999'",
      details:
        "The value '10.0.1.999' in column C is not a valid IPv4 address. Each octet must be between 0 and 255.",
    },
    {
      id: 'v9',
      type: 'error',
      sheet: 'Port Assignments',
      row: 35,
      message: "Port 55 exceeds maximum port count (52) for 'AMP-SW-02'",
    },
    {
      id: 'v10',
      type: 'error',
      sheet: 'Group Definitions',
      row: 7,
      message: "Referenced switch 'UNKNOWN-SW' does not exist in IP Scheme sheet",
      details:
        "Group 'Dante Primary' references switch 'UNKNOWN-SW' which is not defined in the IP Scheme sheet. Ensure all switch names match.",
    },
  ],
  errorCount: 3,
  warningCount: 2,
  passCount: 5,
};

const MOCK_VALIDATION_CLEAN: ValidationResult = {
  items: [
    { id: 'v1', type: 'pass', message: 'All IP addresses valid' },
    { id: 'v2', type: 'pass', message: 'No duplicate IPs detected' },
    { id: 'v3', type: 'pass', message: 'All port numbers in valid range (1-52)' },
    { id: 'v4', type: 'pass', message: 'VLAN IDs within range (1-4094)' },
    { id: 'v5', type: 'pass', message: 'Group names are unique' },
    {
      id: 'v6',
      type: 'warning',
      sheet: 'IP Scheme',
      row: 8,
      message: "Switch 'FOH-SW-03' not found on network — will be skipped",
      details:
        'The switch named FOH-SW-03 with IP 10.0.1.30 was not detected during network scan. It will be excluded from deployment.',
    },
    {
      id: 'v7',
      type: 'warning',
      sheet: 'Port Assignments',
      row: 22,
      message: "Port 49 on 'STAGE-SW-01' is currently in use — will be reconfigured",
    },
  ],
  errorCount: 0,
  warningCount: 2,
  passCount: 5,
};

const MOCK_SWITCH_CHANGES: {
  switchName: string;
  switchIp: string;
  matched: boolean;
  changes: DeployChange[];
}[] = [
  {
    switchName: 'FOH-SW-01',
    switchIp: '10.0.1.10',
    matched: true,
    changes: [
      { id: 'c1', field: 'Switch Name', category: 'IP', currentValue: 'GigaCore-1', newValue: 'FOH-SW-01', changeType: 'changed' },
      { id: 'c2', field: 'Management VLAN', category: 'IP', currentValue: '1', newValue: '100', changeType: 'changed' },
      { id: 'c3', field: 'Group Assignment', category: 'Group', port: 'Port 1-8', currentValue: null, newValue: 'Dante Primary', changeType: 'added' },
      { id: 'c4', field: 'Group Assignment', category: 'Group', port: 'Port 9-16', currentValue: null, newValue: 'Dante Secondary', changeType: 'added' },
      { id: 'c5', field: 'PoE Enabled', category: 'PoE', port: 'Port 1', currentValue: 'Off', newValue: 'On (30W)', changeType: 'changed' },
      { id: 'c6', field: 'PoE Enabled', category: 'PoE', port: 'Port 2', currentValue: 'Off', newValue: 'On (30W)', changeType: 'changed' },
      { id: 'c7', field: 'IGMP Snooping', category: 'IGMP', currentValue: 'Disabled', newValue: 'Enabled', changeType: 'changed' },
      { id: 'c8', field: 'Port Speed', category: 'Port', port: 'Port 49', currentValue: 'Auto', newValue: '10G', changeType: 'changed' },
      { id: 'c9', field: 'Port Speed', category: 'Port', port: 'Port 50', currentValue: 'Auto', newValue: '10G', changeType: 'changed' },
    ],
  },
  {
    switchName: 'STAGE-SW-01',
    switchIp: '10.0.1.20',
    matched: true,
    changes: [
      { id: 'c10', field: 'Switch Name', category: 'IP', currentValue: 'GigaCore-2', newValue: 'STAGE-SW-01', changeType: 'changed' },
      { id: 'c11', field: 'Group Assignment', category: 'Group', port: 'Port 1-24', currentValue: 'Default', newValue: 'Audio Network', changeType: 'changed' },
      { id: 'c12', field: 'Group Assignment', category: 'Group', port: 'Port 25-48', currentValue: null, newValue: 'Video Network', changeType: 'added' },
      { id: 'c13', field: 'PoE Enabled', category: 'PoE', port: 'Port 1-8', currentValue: 'On (15W)', newValue: 'On (30W)', changeType: 'changed' },
      { id: 'c14', field: 'IGMP Snooping', category: 'IGMP', currentValue: 'Disabled', newValue: 'Enabled', changeType: 'changed' },
      { id: 'c15', field: 'Trunk Port', category: 'Port', port: 'Port 49', currentValue: null, newValue: 'Trunk (LACP)', changeType: 'added' },
    ],
  },
  {
    switchName: 'FOH-SW-03',
    switchIp: '10.0.1.30',
    matched: false,
    changes: [
      { id: 'c16', field: 'Switch Name', category: 'IP', currentValue: null, newValue: 'FOH-SW-03', changeType: 'added' },
      { id: 'c17', field: 'Management IP', category: 'IP', currentValue: null, newValue: '10.0.1.30', changeType: 'added' },
      { id: 'c18', field: 'Group Assignment', category: 'Group', port: 'Port 1-12', currentValue: null, newValue: 'Dante Primary', changeType: 'added' },
    ],
  },
  {
    switchName: 'AMP-SW-01',
    switchIp: '10.0.1.40',
    matched: true,
    changes: [
      { id: 'c19', field: 'PoE Budget', category: 'PoE', currentValue: '370W', newValue: '740W', changeType: 'changed' },
      { id: 'c20', field: 'PoE Enabled', category: 'PoE', port: 'Port 1-24', currentValue: 'Off', newValue: 'On (60W)', changeType: 'changed' },
      { id: 'c21', field: 'Port Label', category: 'Port', port: 'Port 1', currentValue: null, newValue: 'Amp Rack 1', changeType: 'added' },
      { id: 'c22', field: 'Port Label', category: 'Port', port: 'Port 2', currentValue: null, newValue: 'Amp Rack 2', changeType: 'added' },
    ],
  },
  {
    switchName: 'AMP-SW-02',
    switchIp: '10.0.1.41',
    matched: true,
    changes: [
      { id: 'c23', field: 'PoE Enabled', category: 'PoE', port: 'Port 1-12', currentValue: 'Off', newValue: 'On (30W)', changeType: 'changed' },
      { id: 'c24', field: 'Old Group', category: 'Group', port: 'Port 25-48', currentValue: 'Legacy Audio', newValue: null, changeType: 'removed' },
      { id: 'c25', field: 'Group Assignment', category: 'Group', port: 'Port 25-48', currentValue: null, newValue: 'Audio Network', changeType: 'added' },
    ],
  },
];

const INITIAL_DEPLOY_SWITCHES: DeploySwitchProgress[] = [
  { switchName: 'FOH-SW-01', switchIp: '10.0.1.10', status: 'waiting', progress: 0 },
  { switchName: 'STAGE-SW-01', switchIp: '10.0.1.20', status: 'waiting', progress: 0 },
  { switchName: 'AMP-SW-01', switchIp: '10.0.1.40', status: 'waiting', progress: 0 },
  { switchName: 'AMP-SW-02', switchIp: '10.0.1.41', status: 'waiting', progress: 0 },
];

// ─── Wizard Steps ────────────────────────────────────────────────────────────

const WIZARD_STEPS = [
  { label: 'Select File', icon: <FileSpreadsheet size={16} /> },
  { label: 'Validate', icon: <Search size={16} /> },
  { label: 'Preview', icon: <Eye size={16} /> },
  { label: 'Deploy', icon: <Rocket size={16} /> },
];

// ─── Helper ──────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Main View ───────────────────────────────────────────────────────────────

export const ExcelImportView: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1 state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [fileParsed, setFileParsed] = useState(false);
  const [detectedFormat, setDetectedFormat] = useState<'IP Scheme' | 'Profile' | null>(null);

  // Step 2 state
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResult | null>(null);
  const [useCleanValidation, setUseCleanValidation] = useState(false);

  // Step 3 state
  const [expandedSwitches, setExpandedSwitches] = useState<Set<string>>(new Set(['FOH-SW-01']));

  // Step 4 state
  const [stagedRollout, setStagedRollout] = useState(true);
  const [deploySwitches, setDeploySwitches] = useState<DeploySwitchProgress[]>(INITIAL_DEPLOY_SWITCHES);
  const [overallProgress, setOverallProgress] = useState(0);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployComplete, setDeployComplete] = useState(false);

  // ─── Step 1 handlers ────────────────────────────────────────────────────

  const handleFileSelected = useCallback((file: File) => {
    setSelectedFile(file);
    setIsParsingFile(true);
    setFileParsed(false);
    setDetectedFormat(null);

    // Simulate parse delay
    setTimeout(() => {
      setIsParsingFile(false);
      setFileParsed(true);
      setDetectedFormat(Math.random() > 0.5 ? 'IP Scheme' : 'Profile');
    }, 1500);
  }, []);

  // ─── Step 2: auto-validate on enter ─────────────────────────────────────

  useEffect(() => {
    if (currentStep === 1 && !validationResults && !isValidating) {
      setIsValidating(true);
      const timer = setTimeout(() => {
        setIsValidating(false);
        setValidationResults(useCleanValidation ? MOCK_VALIDATION_CLEAN : MOCK_VALIDATION);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentStep, validationResults, isValidating, useCleanValidation]);

  // ─── Step 4: simulate deploy ────────────────────────────────────────────

  const startDeploy = useCallback(() => {
    setIsDeploying(true);
    setDeployComplete(false);
    const switches = [...INITIAL_DEPLOY_SWITCHES];
    setDeploySwitches(switches);
    setOverallProgress(0);

    const steps = [
      'Creating groups...',
      'Assigning ports...',
      'Configuring PoE...',
      'Verifying...',
    ];

    let currentIdx = 0;
    let stepIdx = 0;
    let progress = 0;

    const interval = setInterval(() => {
      progress += 5;

      if (progress <= 100) {
        stepIdx = Math.min(Math.floor(progress / 25), 3);
        switches[currentIdx] = {
          ...switches[currentIdx],
          status: progress >= 90 ? 'verifying' : 'deploying',
          currentStep: steps[stepIdx],
          progress,
        };
      }

      if (progress > 100) {
        // Simulate one failure on the third switch
        if (currentIdx === 2) {
          switches[currentIdx] = {
            ...switches[currentIdx],
            status: 'failed',
            progress: 65,
            currentStep: 'Configuring PoE...',
            error: 'Connection timed out after 30s — switch may be unreachable',
          };
        } else {
          switches[currentIdx] = {
            ...switches[currentIdx],
            status: 'success',
            progress: 100,
            currentStep: undefined,
          };
        }

        currentIdx++;
        progress = 0;

        if (currentIdx >= switches.length) {
          clearInterval(interval);
          setIsDeploying(false);
          setDeployComplete(true);
        }
      }

      const completed = switches.filter(
        (s) => s.status === 'success' || s.status === 'failed'
      ).length;
      const activeProg =
        switches[currentIdx]?.status === 'deploying' || switches[currentIdx]?.status === 'verifying'
          ? switches[currentIdx].progress
          : 0;
      setOverallProgress(
        Math.round(((completed * 100 + activeProg) / (switches.length * 100)) * 100)
      );
      setDeploySwitches([...switches]);
    }, 300);

    return () => clearInterval(interval);
  }, []);

  // ─── Navigation ─────────────────────────────────────────────────────────

  const canGoNext = (): boolean => {
    switch (currentStep) {
      case 0:
        return fileParsed;
      case 1:
        return (
          !!validationResults &&
          !isValidating &&
          validationResults.errorCount === 0
        );
      case 2:
        return true;
      default:
        return false;
    }
  };

  const hasWarnings =
    validationResults !== null &&
    validationResults.warningCount > 0 &&
    validationResults.errorCount === 0;

  const goNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      if (currentStep === 1) {
        setValidationResults(null);
      }
      setCurrentStep(currentStep - 1);
    }
  };

  const toggleSwitchExpanded = (name: string) => {
    setExpandedSwitches((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const handleRetry = (switchName: string) => {
    setDeploySwitches((prev) =>
      prev.map((s) =>
        s.switchName === switchName
          ? { ...s, status: 'deploying', progress: 0, error: undefined, currentStep: 'Retrying...' }
          : s
      )
    );
    // Simulate retry success
    setTimeout(() => {
      setDeploySwitches((prev) =>
        prev.map((s) =>
          s.switchName === switchName
            ? { ...s, status: 'success', progress: 100, currentStep: undefined }
            : s
        )
      );
      setOverallProgress(100);
    }, 2000);
  };

  const handleSkip = (switchName: string) => {
    setDeploySwitches((prev) =>
      prev.map((s) =>
        s.switchName === switchName
          ? { ...s, status: 'success', progress: 100, currentStep: 'Skipped', error: undefined }
          : s
      )
    );
  };

  const handleAbort = () => {
    setIsDeploying(false);
    setDeploySwitches((prev) =>
      prev.map((s) =>
        s.status === 'waiting' || s.status === 'deploying'
          ? { ...s, status: 'failed', error: 'Aborted by user' }
          : s
      )
    );
  };

  const handleRollback = () => {
    setDeploySwitches(INITIAL_DEPLOY_SWITCHES);
    setOverallProgress(0);
    setDeployComplete(false);
  };

  const resetWizard = () => {
    setCurrentStep(0);
    setSelectedFile(null);
    setIsParsingFile(false);
    setFileParsed(false);
    setDetectedFormat(null);
    setValidationResults(null);
    setIsValidating(false);
    setExpandedSwitches(new Set(['FOH-SW-01']));
    setDeploySwitches(INITIAL_DEPLOY_SWITCHES);
    setOverallProgress(0);
    setIsDeploying(false);
    setDeployComplete(false);
  };

  // ─── Compute summary for step 3 ────────────────────────────────────────

  const totalPortChanges = MOCK_SWITCH_CHANGES.reduce(
    (sum, s) => sum + s.changes.filter((c) => c.changeType !== 'unchanged').length,
    0
  );
  const groupsToCreate = MOCK_SWITCH_CHANGES.reduce(
    (sum, s) =>
      sum + s.changes.filter((c) => c.category === 'Group' && c.changeType === 'added').length,
    0
  );

  // ─── Render steps ──────────────────────────────────────────────────────

  const renderStep = () => {
    switch (currentStep) {
      // ── Step 1: File Selection ────────────────────────────────────────
      case 0:
        return (
          <div className="max-w-2xl mx-auto space-y-6">
            <ExcelDropzone onFileSelected={handleFileSelected} isLoading={isParsingFile} />

            {/* File info */}
            {selectedFile && fileParsed && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet size={24} className="text-green-400" />
                  <div className="flex-1">
                    <p className="text-white font-medium">{selectedFile.name}</p>
                    <p className="text-gray-400 text-sm">{formatFileSize(selectedFile.size)}</p>
                  </div>
                  {detectedFormat && (
                    <span className="px-3 py-1 text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full">
                      {detectedFormat}
                    </span>
                  )}
                  <button
                    className="p-1 text-gray-400 hover:text-gray-200 transition-colors"
                    onClick={() => {
                      setSelectedFile(null);
                      setFileParsed(false);
                      setDetectedFormat(null);
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Sheet summary */}
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <p className="text-sm text-gray-300">
                    <span className="text-gray-400">Found {MOCK_SHEETS.length} sheets: </span>
                    {MOCK_SHEETS.map((s, i) => (
                      <span key={s.name}>
                        {i > 0 && ', '}
                        <span className="text-white font-medium">{s.name}</span>
                        <span className="text-gray-500"> ({s.rows} rows)</span>
                      </span>
                    ))}
                  </p>
                </div>
              </div>
            )}

            {/* Template downloads */}
            <div className="flex items-center gap-3">
              <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gray-800 text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors">
                <Download size={16} />
                IP Scheme Template
              </button>
              <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gray-800 text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors">
                <Download size={16} />
                Profile Template
              </button>
            </div>

            {/* Toggle to control which validation mock to use (dev helper) */}
            <div className="flex items-center gap-2 mt-4">
              <button
                className="text-gray-500 hover:text-gray-300 transition-colors"
                onClick={() => setUseCleanValidation(!useCleanValidation)}
              >
                {useCleanValidation ? <ToggleRight size={20} className="text-blue-400" /> : <ToggleLeft size={20} />}
              </button>
              <span className="text-xs text-gray-500">
                {useCleanValidation ? 'Warnings only (no errors)' : 'Include errors in validation'}
              </span>
            </div>
          </div>
        );

      // ── Step 2: Validation ────────────────────────────────────────────
      case 1:
        return (
          <div className="max-w-2xl mx-auto">
            <ValidationResults
              results={validationResults || { items: [], errorCount: 0, warningCount: 0, passCount: 0 }}
              isValidating={isValidating}
            />
          </div>
        );

      // ── Step 3: Preview & Diff ────────────────────────────────────────
      case 2:
        return (
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Summary bar */}
            <div className="flex items-center gap-4 flex-wrap bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-blue-400" />
                <span className="text-sm text-gray-300">
                  <span className="text-white font-semibold">{MOCK_SWITCH_CHANGES.length}</span> switches affected
                </span>
              </div>
              <div className="w-px h-4 bg-gray-700" />
              <span className="text-sm text-gray-300">
                <span className="text-white font-semibold">{totalPortChanges}</span> port changes
              </span>
              <div className="w-px h-4 bg-gray-700" />
              <span className="text-sm text-gray-300">
                <span className="text-white font-semibold">{groupsToCreate}</span> groups to create
              </span>
            </div>

            {/* Switch cards */}
            {MOCK_SWITCH_CHANGES.map((sw) => (
              <ExcelPreview
                key={sw.switchName}
                switchName={sw.switchName}
                switchIp={sw.switchIp}
                matched={sw.matched}
                changes={sw.changes}
                isExpanded={expandedSwitches.has(sw.switchName)}
                onToggle={() => toggleSwitchExpanded(sw.switchName)}
              />
            ))}
          </div>
        );

      // ── Step 4: Deploy ────────────────────────────────────────────────
      case 3:
        return (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Staged rollout toggle */}
            {!isDeploying && !deployComplete && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">Staged Rollout</p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      Deploy to first switch, verify, then continue
                    </p>
                  </div>
                  <button
                    className="text-gray-400 hover:text-white transition-colors"
                    onClick={() => setStagedRollout(!stagedRollout)}
                  >
                    {stagedRollout ? (
                      <ToggleRight size={28} className="text-blue-400" />
                    ) : (
                      <ToggleLeft size={28} />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Deploy button or progress */}
            {!isDeploying && !deployComplete && (
              <button
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                onClick={startDeploy}
              >
                <Rocket size={18} />
                Start Deployment
              </button>
            )}

            {(isDeploying || deployComplete) && (
              <DeployProgress
                switches={deploySwitches}
                overallProgress={overallProgress}
                isDeploying={isDeploying}
                onRetry={handleRetry}
                onSkip={handleSkip}
                onAbort={handleAbort}
                onRollback={handleRollback}
              />
            )}

            {/* Success summary */}
            {deployComplete && deploySwitches.every((s) => s.status === 'success') && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 text-center space-y-2">
                <CheckCircle2 size={40} className="text-green-400 mx-auto" />
                <p className="text-green-300 text-lg font-medium">Deployment Complete</p>
                <p className="text-gray-400 text-sm">
                  All {deploySwitches.length} switches configured successfully.{' '}
                  {totalPortChanges} changes applied.
                </p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // ─── Main render ────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <FileSpreadsheet size={20} className="text-blue-400" />
          Excel Import Wizard
        </h1>
        <button
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          onClick={resetWizard}
          title="Close wizard"
        >
          <X size={18} />
        </button>
      </div>

      {/* Wizard */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <StepWizard steps={WIZARD_STEPS} currentStep={currentStep}>
          <div className="p-6 pb-0">{renderStep()}</div>
        </StepWizard>
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800">
        <div>
          {currentStep > 0 && currentStep < 3 && (
            <button
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gray-800 text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors"
              onClick={goBack}
            >
              <ArrowLeft size={16} />
              Back
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {currentStep === 1 && hasWarnings && !isValidating && (
            <span className="inline-flex items-center gap-1.5 text-xs text-yellow-400">
              <AlertTriangle size={14} />
              Proceeding with {validationResults?.warningCount} warning
              {(validationResults?.warningCount ?? 0) !== 1 ? 's' : ''}
            </span>
          )}

          {currentStep < 3 && (
            <button
              className={`inline-flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
                canGoNext()
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
              disabled={!canGoNext()}
              onClick={goNext}
            >
              {currentStep === 1 && hasWarnings ? 'Proceed with warnings' : currentStep === 2 ? 'Deploy' : 'Next'}
              <ArrowRight size={16} />
            </button>
          )}

          {currentStep === 3 && deployComplete && (
            <button
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors"
              onClick={resetWizard}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExcelImportView;
