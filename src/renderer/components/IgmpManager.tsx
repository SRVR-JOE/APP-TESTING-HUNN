import React, { useState, useMemo } from 'react';
import {
  Radio,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  Search,
  RefreshCw,
  Power,
  Crown,
  ClipboardCheck,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface IgmpVlanStatus {
  vlanId: number;
  vlanName: string;
  color: string;
  snoopingEnabled: boolean;
  querierSwitchId: string | null;
  querierSwitchName: string | null;
  querierIp: string | null;
  queryInterval: number; // seconds
  querierCount: number; // 0 = none, 1 = correct, >1 = duplicate
  perSwitch: IgmpSwitchDetail[];
}

interface IgmpSwitchDetail {
  switchId: string;
  switchName: string;
  model: string;
  ip: string;
  snoopingEnabled: boolean;
  isQuerier: boolean;
  querierIp: string | null;
  queryInterval: number;
  multicastGroups: number;
}

type QuerierStatus = 'ok' | 'missing' | 'duplicate';

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_SWITCHES = [
  { id: 'sw-1', name: 'GC-FOH-Main', model: 'GigaCore 30i', ip: '10.0.1.1' },
  { id: 'sw-2', name: 'GC-Stage-L', model: 'GigaCore 16Xt', ip: '10.0.1.2' },
  { id: 'sw-3', name: 'GC-Stage-R', model: 'GigaCore 16Xt', ip: '10.0.1.3' },
  { id: 'sw-4', name: 'GC-Broadcast', model: 'GigaCore 14R', ip: '10.0.1.4' },
];

const MOCK_IGMP_STATUS: IgmpVlanStatus[] = [
  {
    vlanId: 1,
    vlanName: 'Management',
    color: '#6B7280',
    snoopingEnabled: false,
    querierSwitchId: null,
    querierSwitchName: null,
    querierIp: null,
    queryInterval: 125,
    querierCount: 0,
    perSwitch: MOCK_SWITCHES.map((sw) => ({
      switchId: sw.id,
      switchName: sw.name,
      model: sw.model,
      ip: sw.ip,
      snoopingEnabled: false,
      isQuerier: false,
      querierIp: null,
      queryInterval: 125,
      multicastGroups: 0,
    })),
  },
  {
    vlanId: 10,
    vlanName: 'D3 Network',
    color: '#3B82F6',
    snoopingEnabled: true,
    querierSwitchId: 'sw-1',
    querierSwitchName: 'GC-FOH-Main',
    querierIp: '10.10.0.1',
    queryInterval: 125,
    querierCount: 1,
    perSwitch: MOCK_SWITCHES.map((sw) => ({
      switchId: sw.id,
      switchName: sw.name,
      model: sw.model,
      ip: sw.ip,
      snoopingEnabled: true,
      isQuerier: sw.id === 'sw-1',
      querierIp: sw.id === 'sw-1' ? '10.10.0.1' : null,
      queryInterval: 125,
      multicastGroups: sw.id === 'sw-1' ? 12 : sw.id === 'sw-4' ? 3 : 8,
    })),
  },
  {
    vlanId: 30,
    vlanName: 'NDI',
    color: '#22C55E',
    snoopingEnabled: true,
    querierSwitchId: 'sw-1',
    querierSwitchName: 'GC-FOH-Main',
    querierIp: '10.30.0.1',
    queryInterval: 60,
    querierCount: 1,
    perSwitch: [
      {
        switchId: 'sw-1',
        switchName: 'GC-FOH-Main',
        model: 'GigaCore 30i',
        ip: '10.0.1.1',
        snoopingEnabled: true,
        isQuerier: true,
        querierIp: '10.30.0.1',
        queryInterval: 60,
        multicastGroups: 6,
      },
      {
        switchId: 'sw-4',
        switchName: 'GC-Broadcast',
        model: 'GigaCore 14R',
        ip: '10.0.1.4',
        snoopingEnabled: true,
        isQuerier: false,
        querierIp: null,
        queryInterval: 60,
        multicastGroups: 4,
      },
    ],
  },
  {
    vlanId: 40,
    vlanName: 'Art-Net',
    color: '#F97316',
    snoopingEnabled: false,
    querierSwitchId: null,
    querierSwitchName: null,
    querierIp: null,
    queryInterval: 125,
    querierCount: 0,
    perSwitch: MOCK_SWITCHES.slice(0, 3).map((sw) => ({
      switchId: sw.id,
      switchName: sw.name,
      model: sw.model,
      ip: sw.ip,
      snoopingEnabled: false,
      isQuerier: false,
      querierIp: null,
      queryInterval: 125,
      multicastGroups: 0,
    })),
  },
  {
    vlanId: 1300,
    vlanName: 'Dante Primary',
    color: '#EF4444',
    snoopingEnabled: true,
    querierSwitchId: 'sw-1',
    querierSwitchName: 'GC-FOH-Main',
    querierIp: '10.130.0.1',
    queryInterval: 125,
    querierCount: 1,
    perSwitch: MOCK_SWITCHES.map((sw) => ({
      switchId: sw.id,
      switchName: sw.name,
      model: sw.model,
      ip: sw.ip,
      snoopingEnabled: true,
      isQuerier: sw.id === 'sw-1',
      querierIp: sw.id === 'sw-1' ? '10.130.0.1' : null,
      queryInterval: 125,
      multicastGroups: sw.id === 'sw-1' ? 24 : sw.id === 'sw-2' ? 18 : 15,
    })),
  },
  {
    vlanId: 1301,
    vlanName: 'Dante Secondary',
    color: '#A855F7',
    snoopingEnabled: true,
    querierSwitchId: null,
    querierSwitchName: null,
    querierIp: null,
    queryInterval: 125,
    querierCount: 2, // Duplicate queriers — problem!
    perSwitch: MOCK_SWITCHES.map((sw) => ({
      switchId: sw.id,
      switchName: sw.name,
      model: sw.model,
      ip: sw.ip,
      snoopingEnabled: true,
      isQuerier: sw.id === 'sw-1' || sw.id === 'sw-2', // Two queriers — conflict
      querierIp:
        sw.id === 'sw-1' ? '10.131.0.1' : sw.id === 'sw-2' ? '10.131.0.2' : null,
      queryInterval: 125,
      multicastGroups: sw.id === 'sw-1' ? 24 : sw.id === 'sw-2' ? 18 : 15,
    })),
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function getQuerierStatus(status: IgmpVlanStatus): QuerierStatus {
  if (!status.snoopingEnabled) return 'ok'; // snooping off = no querier needed
  if (status.querierCount === 0) return 'missing';
  if (status.querierCount > 1) return 'duplicate';
  return 'ok';
}

function getStatusIcon(qs: QuerierStatus): React.ReactNode {
  switch (qs) {
    case 'ok':
      return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    case 'missing':
      return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    case 'duplicate':
      return <XCircle className="w-4 h-4 text-red-400" />;
  }
}

function getStatusLabel(qs: QuerierStatus): string {
  switch (qs) {
    case 'ok':
      return 'OK';
    case 'missing':
      return 'No Querier';
    case 'duplicate':
      return 'Duplicate';
  }
}

function getStatusColor(qs: QuerierStatus): string {
  switch (qs) {
    case 'ok':
      return 'text-green-400';
    case 'missing':
      return 'text-yellow-400';
    case 'duplicate':
      return 'text-red-400';
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export const IgmpManager: React.FC = () => {
  const [igmpStatus, setIgmpStatus] = useState<IgmpVlanStatus[]>(MOCK_IGMP_STATUS);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedVlan, setExpandedVlan] = useState<number | null>(null);
  const [auditResults, setAuditResults] = useState<string[] | null>(null);

  const filteredStatus = useMemo(() => {
    if (!searchQuery.trim()) return igmpStatus;
    const q = searchQuery.toLowerCase();
    return igmpStatus.filter(
      (s) =>
        s.vlanName.toLowerCase().includes(q) ||
        s.vlanId.toString().includes(q) ||
        s.querierSwitchName?.toLowerCase().includes(q)
    );
  }, [igmpStatus, searchQuery]);

  const stats = useMemo(() => {
    const snoopingEnabled = igmpStatus.filter((s) => s.snoopingEnabled).length;
    const withQuerier = igmpStatus.filter(
      (s) => s.snoopingEnabled && s.querierCount === 1
    ).length;
    const issues = igmpStatus.filter((s) => {
      const qs = getQuerierStatus(s);
      return qs !== 'ok';
    }).length;
    return { snoopingEnabled, withQuerier, issues };
  }, [igmpStatus]);

  const handleEnableSnooping = (vlanId: number) => {
    setIgmpStatus((prev) =>
      prev.map((s) =>
        s.vlanId === vlanId
          ? {
              ...s,
              snoopingEnabled: true,
              perSwitch: s.perSwitch.map((ps) => ({
                ...ps,
                snoopingEnabled: true,
              })),
            }
          : s
      )
    );
  };

  const handleDesignateQuerier = (vlanId: number, switchId: string) => {
    setIgmpStatus((prev) =>
      prev.map((s) => {
        if (s.vlanId !== vlanId) return s;
        const sw = MOCK_SWITCHES.find((ms) => ms.id === switchId);
        return {
          ...s,
          querierSwitchId: switchId,
          querierSwitchName: sw?.name ?? null,
          querierIp: sw?.ip ?? null,
          querierCount: 1,
          perSwitch: s.perSwitch.map((ps) => ({
            ...ps,
            isQuerier: ps.switchId === switchId,
            querierIp: ps.switchId === switchId ? sw?.ip ?? null : null,
          })),
        };
      })
    );
  };

  const handleAudit = () => {
    const results: string[] = [];
    igmpStatus.forEach((s) => {
      if (!s.snoopingEnabled) {
        if (s.vlanId !== 1 && s.vlanId !== 40) {
          results.push(
            `VLAN ${s.vlanId} (${s.vlanName}): IGMP snooping disabled — multicast traffic may flood all ports`
          );
        }
        return;
      }
      const qs = getQuerierStatus(s);
      if (qs === 'missing') {
        results.push(
          `VLAN ${s.vlanId} (${s.vlanName}): No IGMP querier configured — multicast group memberships will time out`
        );
      }
      if (qs === 'duplicate') {
        const queriers = s.perSwitch
          .filter((ps) => ps.isQuerier)
          .map((ps) => ps.switchName);
        results.push(
          `VLAN ${s.vlanId} (${s.vlanName}): Duplicate queriers detected on ${queriers.join(', ')} — may cause query storms`
        );
      }
      // Check for inconsistent snooping
      const snoopingOff = s.perSwitch.filter((ps) => !ps.snoopingEnabled);
      if (snoopingOff.length > 0 && snoopingOff.length < s.perSwitch.length) {
        results.push(
          `VLAN ${s.vlanId} (${s.vlanName}): IGMP snooping inconsistent — disabled on ${snoopingOff.map((ps) => ps.switchName).join(', ')}`
        );
      }
    });
    if (results.length === 0) {
      results.push('All IGMP configurations look correct. No issues found.');
    }
    setAuditResults(results);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-purple-500/10 rounded-lg flex items-center justify-center">
            <Radio className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">IGMP Manager</h2>
            <p className="text-gray-400 text-xs">
              Multicast snooping and querier management
            </p>
          </div>
        </div>

        <button
          onClick={handleAudit}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded-md transition-colors"
        >
          <ClipboardCheck className="w-4 h-4" />
          Audit
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-blue-400" />
            <span className="text-gray-400 text-xs">Snooping Enabled</span>
          </div>
          <p className="text-white text-xl font-semibold">
            {stats.snoopingEnabled}
            <span className="text-gray-500 text-sm font-normal">
              /{igmpStatus.length}
            </span>
          </p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-4 h-4 text-green-400" />
            <span className="text-gray-400 text-xs">Querier Configured</span>
          </div>
          <p className="text-white text-xl font-semibold">
            {stats.withQuerier}
            <span className="text-gray-500 text-sm font-normal">
              /{stats.snoopingEnabled}
            </span>
          </p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <span className="text-gray-400 text-xs">Issues</span>
          </div>
          <p
            className={`text-xl font-semibold ${
              stats.issues > 0 ? 'text-yellow-400' : 'text-green-400'
            }`}
          >
            {stats.issues}
          </p>
        </div>
      </div>

      {/* Audit Results */}
      {auditResults && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white text-sm font-medium flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-purple-400" />
              Audit Results
            </h3>
            <button
              onClick={() => setAuditResults(null)}
              className="text-gray-400 hover:text-white text-xs transition-colors"
            >
              Dismiss
            </button>
          </div>
          <div className="space-y-2">
            {auditResults.map((result, i) => {
              const isOk = result.includes('No issues');
              return (
                <div
                  key={i}
                  className={`flex items-start gap-2 text-sm ${
                    isOk ? 'text-green-400' : 'text-yellow-300'
                  }`}
                >
                  {isOk ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  )}
                  <span>{result}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by VLAN name, ID, or querier..."
          className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* IGMP Status Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-750 border-b border-gray-700">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">VLAN ID</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">VLAN Name</th>
              <th className="text-center px-4 py-3 text-gray-400 font-medium">
                Snooping
              </th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">
                Querier Switch
              </th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">
                Querier IP
              </th>
              <th className="text-center px-4 py-3 text-gray-400 font-medium">
                Query Interval
              </th>
              <th className="text-center px-4 py-3 text-gray-400 font-medium">Status</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStatus.map((status) => {
              const qs = getQuerierStatus(status);
              return (
                <React.Fragment key={status.vlanId}>
                  <tr
                    className={`border-b border-gray-700/50 hover:bg-gray-700/30 cursor-pointer transition-colors ${
                      qs === 'duplicate' ? 'bg-red-500/5' : qs === 'missing' ? 'bg-yellow-500/5' : ''
                    }`}
                    onClick={() =>
                      setExpandedVlan((prev) =>
                        prev === status.vlanId ? null : status.vlanId
                      )
                    }
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: status.color }}
                        />
                        <span className="text-white font-mono">{status.vlanId}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white">{status.vlanName}</td>
                    <td className="px-4 py-3 text-center">
                      {status.snoopingEnabled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          ON
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-700 text-gray-500 text-xs rounded-full">
                          OFF
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm">
                      {status.querierSwitchName ?? (
                        <span className="text-gray-600">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm font-mono">
                      {status.querierIp ?? (
                        <span className="text-gray-600">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-400 text-sm">
                      {status.snoopingEnabled ? `${status.queryInterval}s` : '--'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {getStatusIcon(qs)}
                        <span className={`text-xs ${getStatusColor(qs)}`}>
                          {getStatusLabel(qs)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!status.snoopingEnabled && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEnableSnooping(status.vlanId);
                            }}
                            className="p-1.5 text-gray-400 hover:text-green-400 rounded transition-colors"
                            title="Enable snooping on all switches"
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {status.snoopingEnabled && status.querierCount !== 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedVlan(status.vlanId);
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-400 rounded transition-colors"
                            title="Designate querier"
                          >
                            <Crown className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded per-switch detail */}
                  {expandedVlan === status.vlanId && (
                    <tr>
                      <td colSpan={8} className="bg-gray-850 px-4 py-3">
                        <div className="ml-4 space-y-2">
                          <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">
                            Per-Switch IGMP Status
                          </p>
                          <div className="grid gap-2">
                            {status.perSwitch.map((sw) => (
                              <div
                                key={sw.switchId}
                                className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-md px-4 py-2.5"
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-2 h-2 rounded-full ${
                                      sw.snoopingEnabled ? 'bg-green-400' : 'bg-gray-500'
                                    }`}
                                  />
                                  <span className="text-white text-sm">{sw.switchName}</span>
                                  <span className="text-gray-500 text-xs">{sw.model}</span>
                                  <span className="text-gray-600 text-xs font-mono">
                                    {sw.ip}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-xs">
                                  <span
                                    className={
                                      sw.snoopingEnabled ? 'text-green-400' : 'text-gray-600'
                                    }
                                  >
                                    Snooping: {sw.snoopingEnabled ? 'ON' : 'OFF'}
                                  </span>
                                  <span
                                    className={
                                      sw.isQuerier ? 'text-blue-400 font-medium' : 'text-gray-600'
                                    }
                                  >
                                    {sw.isQuerier ? (
                                      <span className="flex items-center gap-1">
                                        <Crown className="w-3 h-3" />
                                        Querier ({sw.querierIp})
                                      </span>
                                    ) : (
                                      'Not Querier'
                                    )}
                                  </span>
                                  <span className="text-gray-400">
                                    {sw.multicastGroups} groups
                                  </span>
                                  {status.snoopingEnabled && !sw.isQuerier && (
                                    <button
                                      onClick={() =>
                                        handleDesignateQuerier(status.vlanId, sw.switchId)
                                      }
                                      className="px-2 py-0.5 text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded transition-colors"
                                    >
                                      Make Querier
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Quick actions for this VLAN */}
                          {status.snoopingEnabled && (
                            <div className="flex items-center gap-2 pt-2 border-t border-gray-700 mt-3">
                              <span className="text-gray-500 text-xs">Quick:</span>
                              <button
                                onClick={() =>
                                  handleDesignateQuerier(status.vlanId, 'sw-1')
                                }
                                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                              >
                                <RefreshCw className="w-3 h-3 inline mr-1" />
                                Reset to FOH querier
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {filteredStatus.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Radio className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No IGMP configurations found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default IgmpManager;
