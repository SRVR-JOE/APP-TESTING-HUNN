import React from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  SkipForward,
  Wrench,
  Rocket,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import type { PreFlightReport, PreFlightCheck } from '@shared/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PreFlightPanelProps {
  report: PreFlightReport | null;
  isRunning?: boolean;
  onDeploy?: () => void;
  onRunPreFlight?: () => void;
  deploying?: boolean;
}

// ---------------------------------------------------------------------------
// Status icon helper
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: PreFlightCheck['status'] }) {
  switch (status) {
    case 'pass':
      return <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />;
    case 'fail':
      return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
    case 'skipped':
      return <SkipForward className="w-4 h-4 text-gray-500 flex-shrink-0" />;
  }
}

function overallBanner(status: PreFlightReport['overallStatus']) {
  switch (status) {
    case 'pass':
      return { bg: 'bg-emerald-900/40 border-emerald-700', text: 'text-emerald-300', label: 'All Checks Passed', Icon: ShieldCheck };
    case 'warning':
      return { bg: 'bg-yellow-900/40 border-yellow-700', text: 'text-yellow-300', label: 'Warnings Detected', Icon: AlertTriangle };
    case 'fail':
      return { bg: 'bg-red-900/40 border-red-700', text: 'text-red-300', label: 'Checks Failed', Icon: XCircle };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PreFlightPanel: React.FC<PreFlightPanelProps> = ({
  report,
  isRunning = false,
  onDeploy,
  onRunPreFlight,
  deploying = false,
}) => {
  if (!report && !isRunning) {
    return (
      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-6 text-center">
        <ShieldCheck className="w-10 h-10 text-gray-500 mx-auto mb-3" />
        <p className="text-gray-400 mb-4">Run pre-flight checks before deploying</p>
        {onRunPreFlight && (
          <button
            onClick={onRunPreFlight}
            className="px-4 py-2 bg-gc-accent hover:bg-gc-accent/80 text-white rounded-md text-sm font-medium transition-colors"
          >
            Run Pre-Flight Checks
          </button>
        )}
      </div>
    );
  }

  if (isRunning) {
    return (
      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-6 text-center">
        <Loader2 className="w-8 h-8 text-gc-accent mx-auto mb-3 animate-spin" />
        <p className="text-gray-300">Running pre-flight checks...</p>
      </div>
    );
  }

  if (!report) return null;

  const banner = overallBanner(report.overallStatus);
  const passCount = report.checks.filter((c) => c.status === 'pass').length;
  const warnCount = report.checks.filter((c) => c.status === 'warning').length;
  const failCount = report.checks.filter((c) => c.status === 'fail').length;
  const skipCount = report.checks.filter((c) => c.status === 'skipped').length;

  // Group checks by type
  const grouped = new Map<string, PreFlightCheck[]>();
  for (const check of report.checks) {
    const list = grouped.get(check.type) ?? [];
    list.push(check);
    grouped.set(check.type, list);
  }

  const typeLabels: Record<string, string> = {
    reachability: 'Reachability',
    'firmware-compat': 'Firmware Compatibility',
    'ip-conflict': 'IP Conflicts',
    'vlan-consistency': 'VLAN Consistency',
    'name-conflict': 'Name Conflicts',
    'igmp-querier': 'IGMP Querier',
    'poe-budget': 'PoE Budget',
    'redundancy-path': 'Redundancy Paths',
    'role-assignment': 'Role Assignment',
    'port-conflict': 'Port Conflicts',
  };

  return (
    <div className="space-y-4">
      {/* Overall status banner */}
      <div className={`flex items-center gap-3 p-4 rounded-lg border ${banner.bg}`}>
        <banner.Icon className={`w-6 h-6 ${banner.text}`} />
        <div className="flex-1">
          <h3 className={`text-sm font-semibold ${banner.text}`}>{banner.label}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {passCount} passed, {warnCount} warning{warnCount !== 1 ? 's' : ''}, {failCount} failed
            {skipCount > 0 ? `, ${skipCount} skipped` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {onRunPreFlight && (
            <button
              onClick={onRunPreFlight}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs font-medium transition-colors"
            >
              Re-run
            </button>
          )}
          {onDeploy && (
            <button
              onClick={onDeploy}
              disabled={!report.canDeploy || deploying}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium transition-colors ${
                report.canDeploy && !deploying
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {deploying ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Rocket className="w-3 h-3" />
              )}
              {deploying ? 'Deploying...' : 'Deploy'}
            </button>
          )}
        </div>
      </div>

      {/* Checks grouped by type */}
      <div className="space-y-2">
        {[...grouped.entries()].map(([type, checks]) => (
          <div key={type} className="bg-gray-800/40 border border-gray-700 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-800/80 border-b border-gray-700">
              <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                {typeLabels[type] ?? type}
              </h4>
            </div>
            <div className="divide-y divide-gray-700/50">
              {checks.map((check, idx) => (
                <div key={idx} className="flex items-start gap-3 px-4 py-2.5">
                  <StatusIcon status={check.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200">{check.message}</p>
                    {check.details && (
                      <p className="text-xs text-gray-500 mt-0.5">{check.details}</p>
                    )}
                  </div>
                  {check.autoFixable && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-900/40 border border-blue-700/50 rounded text-xs text-blue-300 whitespace-nowrap">
                      <Wrench className="w-3 h-3" />
                      Auto-fixable
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
