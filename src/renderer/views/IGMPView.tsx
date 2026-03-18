import React, { useState, useMemo, useCallback } from 'react';
import {
  Radio,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
  ChevronDown,
  Wrench,
  Info,
  Lightbulb,
  PanelRightOpen,
  PanelRightClose,
  Wifi,
} from 'lucide-react';
import IGMPStatusRow from '../components/IGMPStatusRow';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface IGMPStatusEntry {
  switchName: string;
  switchIp: string;
  vlanId: number;
  vlanName: string;
  snoopingEnabled: boolean;
  querierEnabled: boolean;
  querierIp?: string;
  queryInterval: number;
  mRouterPorts: number[];
  status: 'ok' | 'warning' | 'error';
}

interface MulticastGroup {
  groupAddress: string;
  vlanId: number;
  vlanName: string;
  sourcePort: number;
  receiverPorts: number[];
  switchName: string;
  switchIp: string;
  packetCount: number;
}

interface QuerierInfo {
  vlanId: number;
  vlanName: string;
  querierSwitch: string | null;
  querierIp: string | null;
  status: 'ok' | 'warning' | 'error';
  message: string;
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const INITIAL_IGMP_STATUS: IGMPStatusEntry[] = [
  // VLAN 30 - NDI
  { switchName: 'GC-Core-01', switchIp: '10.0.1.1', vlanId: 30, vlanName: 'NDI', snoopingEnabled: true, querierEnabled: true, querierIp: '10.30.0.1', queryInterval: 125, mRouterPorts: [1, 2], status: 'ok' },
  { switchName: 'GC-Core-02', switchIp: '10.0.1.2', vlanId: 30, vlanName: 'NDI', snoopingEnabled: true, querierEnabled: false, queryInterval: 125, mRouterPorts: [1], status: 'ok' },
  { switchName: 'GC-FOH', switchIp: '10.0.1.20', vlanId: 30, vlanName: 'NDI', snoopingEnabled: true, querierEnabled: false, queryInterval: 125, mRouterPorts: [5], status: 'ok' },
  { switchName: 'GC-Broadcast', switchIp: '10.0.1.30', vlanId: 30, vlanName: 'NDI', snoopingEnabled: true, querierEnabled: false, queryInterval: 125, mRouterPorts: [1], status: 'ok' },

  // VLAN 1300 - Dante Primary
  { switchName: 'GC-Core-01', switchIp: '10.0.1.1', vlanId: 1300, vlanName: 'Dante Pri', snoopingEnabled: true, querierEnabled: true, querierIp: '10.130.0.1', queryInterval: 125, mRouterPorts: [1, 2], status: 'ok' },
  { switchName: 'GC-Core-02', switchIp: '10.0.1.2', vlanId: 1300, vlanName: 'Dante Pri', snoopingEnabled: true, querierEnabled: false, queryInterval: 125, mRouterPorts: [1], status: 'ok' },
  { switchName: 'GC-Stage-L', switchIp: '10.0.1.10', vlanId: 1300, vlanName: 'Dante Pri', snoopingEnabled: true, querierEnabled: false, queryInterval: 125, mRouterPorts: [1], status: 'ok' },
  { switchName: 'GC-Stage-R', switchIp: '10.0.1.11', vlanId: 1300, vlanName: 'Dante Pri', snoopingEnabled: true, querierEnabled: false, queryInterval: 125, mRouterPorts: [1], status: 'ok' },
  { switchName: 'GC-FOH', switchIp: '10.0.1.20', vlanId: 1300, vlanName: 'Dante Pri', snoopingEnabled: true, querierEnabled: false, queryInterval: 125, mRouterPorts: [1], status: 'ok' },

  // VLAN 1301 - Dante Secondary
  { switchName: 'GC-Core-01', switchIp: '10.0.1.1', vlanId: 1301, vlanName: 'Dante Sec', snoopingEnabled: true, querierEnabled: false, queryInterval: 125, mRouterPorts: [1], status: 'warning' },
  { switchName: 'GC-Core-02', switchIp: '10.0.1.2', vlanId: 1301, vlanName: 'Dante Sec', snoopingEnabled: true, querierEnabled: true, querierIp: '10.131.0.2', queryInterval: 125, mRouterPorts: [1], status: 'ok' },
  { switchName: 'GC-Stage-L', switchIp: '10.0.1.10', vlanId: 1301, vlanName: 'Dante Sec', snoopingEnabled: false, querierEnabled: false, queryInterval: 125, mRouterPorts: [], status: 'error' },
  { switchName: 'GC-Stage-R', switchIp: '10.0.1.11', vlanId: 1301, vlanName: 'Dante Sec', snoopingEnabled: false, querierEnabled: false, queryInterval: 125, mRouterPorts: [], status: 'error' },

  // VLAN 40 - Art-Net (no IGMP)
  { switchName: 'GC-Stage-L', switchIp: '10.0.1.10', vlanId: 40, vlanName: 'Art-Net', snoopingEnabled: false, querierEnabled: false, queryInterval: 125, mRouterPorts: [], status: 'ok' },
  { switchName: 'GC-Stage-R', switchIp: '10.0.1.11', vlanId: 40, vlanName: 'Art-Net', snoopingEnabled: false, querierEnabled: false, queryInterval: 125, mRouterPorts: [], status: 'ok' },
  { switchName: 'GC-FOH', switchIp: '10.0.1.20', vlanId: 40, vlanName: 'Art-Net', snoopingEnabled: false, querierEnabled: false, queryInterval: 125, mRouterPorts: [], status: 'ok' },
];

const MOCK_MULTICAST_GROUPS: MulticastGroup[] = [
  {
    groupAddress: '239.255.0.1',
    vlanId: 30,
    vlanName: 'NDI',
    sourcePort: 9,
    receiverPorts: [10, 11, 12, 14],
    switchName: 'GC-Core-01',
    switchIp: '10.0.1.1',
    packetCount: 1_284_503,
  },
  {
    groupAddress: '239.255.0.2',
    vlanId: 30,
    vlanName: 'NDI',
    sourcePort: 13,
    receiverPorts: [10, 15],
    switchName: 'GC-Core-01',
    switchIp: '10.0.1.1',
    packetCount: 892_117,
  },
  {
    groupAddress: '239.69.0.1',
    vlanId: 1300,
    vlanName: 'Dante Pri',
    sourcePort: 21,
    receiverPorts: [22, 23, 24, 25, 26],
    switchName: 'GC-Core-01',
    switchIp: '10.0.1.1',
    packetCount: 3_412_890,
  },
  {
    groupAddress: '239.69.0.2',
    vlanId: 1300,
    vlanName: 'Dante Pri',
    sourcePort: 13,
    receiverPorts: [14, 15, 16],
    switchName: 'GC-Stage-L',
    switchIp: '10.0.1.10',
    packetCount: 2_109_445,
  },
];

const INITIAL_QUERIER_MAP: QuerierInfo[] = [
  { vlanId: 30, vlanName: 'NDI', querierSwitch: 'GC-Core-01', querierIp: '10.30.0.1', status: 'ok', message: 'Querier active on core switch' },
  { vlanId: 1300, vlanName: 'Dante Pri', querierSwitch: 'GC-Core-01', querierIp: '10.130.0.1', status: 'ok', message: 'Querier active on core switch' },
  { vlanId: 1301, vlanName: 'Dante Sec', querierSwitch: 'GC-Core-02', querierIp: '10.131.0.2', status: 'warning', message: 'IGMP snooping disabled on 2 switches' },
  { vlanId: 40, vlanName: 'Art-Net', querierSwitch: null, querierIp: null, status: 'ok', message: 'Art-Net uses broadcast, IGMP optional' },
];

/* ------------------------------------------------------------------ */
/*  Best practices tips                                                */
/* ------------------------------------------------------------------ */

const BEST_PRACTICES = [
  { protocol: 'NDI', tip: 'Enable IGMP snooping + querier on VLAN 30', icon: '🟢' },
  { protocol: 'Dante', tip: 'Enable IGMP snooping on VLANs 1300/1301, querier on primary switch only', icon: '🔵' },
  { protocol: 'Art-Net', tip: 'Typically uses broadcast, IGMP snooping optional', icon: '🟣' },
  { protocol: 'General', tip: 'Always have exactly one querier per VLAN', icon: '📌' },
  { protocol: 'General', tip: 'Set unknown flooding to OFF for multicast-heavy VLANs', icon: '⚡' },
  { protocol: 'General', tip: 'Query interval: 125s default, reduce to 60s for fast failover', icon: '⏱' },
  { protocol: 'Dante', tip: 'Place querier on core switch for optimal multicast routing', icon: '🔵' },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function IGMPView() {
  const [igmpStatus, setIgmpStatus] = useState<IGMPStatusEntry[]>(INITIAL_IGMP_STATUS);
  const [querierMap, setQuerierMap] = useState<QuerierInfo[]>(INITIAL_QUERIER_MAP);
  const [showBestPractices, setShowBestPractices] = useState(false);
  const [expandedVlans, setExpandedVlans] = useState<Set<number>>(new Set([30, 1300]));

  /* Group multicast entries by VLAN */
  const groupedMulticast = useMemo(() => {
    const groups = new Map<number, MulticastGroup[]>();
    MOCK_MULTICAST_GROUPS.forEach((g) => {
      if (!groups.has(g.vlanId)) groups.set(g.vlanId, []);
      groups.get(g.vlanId)!.push(g);
    });
    return groups;
  }, []);

  /* Toggle IGMP snooping */
  const handleToggleSnooping = useCallback((switchIp: string, vlanId: number) => {
    setIgmpStatus((prev) =>
      prev.map((e) => {
        if (e.switchIp !== switchIp || e.vlanId !== vlanId) return e;
        const newSnooping = !e.snoopingEnabled;
        return {
          ...e,
          snoopingEnabled: newSnooping,
          status: !newSnooping && e.vlanId !== 40 ? 'error' : e.status === 'error' && newSnooping ? 'ok' : e.status,
        };
      }),
    );
  }, []);

  /* Toggle querier */
  const handleToggleQuerier = useCallback((switchIp: string, vlanId: number) => {
    setIgmpStatus((prev) =>
      prev.map((e) => {
        if (e.switchIp !== switchIp || e.vlanId !== vlanId) return e;
        return {
          ...e,
          querierEnabled: !e.querierEnabled,
          querierIp: !e.querierEnabled ? switchIp.replace('0.1.', '30.0.') : undefined,
        };
      }),
    );
  }, []);

  /* Fix querier issues */
  const handleFixQuerier = useCallback((vlanId: number) => {
    // Auto-assign querier to GC-Core-01
    setIgmpStatus((prev) =>
      prev.map((e) => {
        if (e.vlanId !== vlanId) return e;
        if (e.switchIp === '10.0.1.1') {
          return { ...e, snoopingEnabled: true, querierEnabled: true, querierIp: `10.${vlanId < 100 ? vlanId : Math.floor(vlanId / 10)}.0.1`, status: 'ok' };
        }
        return { ...e, snoopingEnabled: true, querierEnabled: false, querierIp: undefined, status: 'ok' };
      }),
    );
    setQuerierMap((prev) =>
      prev.map((q) => {
        if (q.vlanId !== vlanId) return q;
        return { ...q, querierSwitch: 'GC-Core-01', querierIp: `10.${vlanId < 100 ? vlanId : Math.floor(vlanId / 10)}.0.1`, status: 'ok', message: 'Querier auto-assigned to core switch' };
      }),
    );
  }, []);

  /* Toggle expanded VLAN in multicast section */
  const toggleVlanExpand = useCallback((vlanId: number) => {
    setExpandedVlans((prev) => {
      const next = new Set(prev);
      if (next.has(vlanId)) next.delete(vlanId);
      else next.add(vlanId);
      return next;
    });
  }, []);

  /* Stat counts */
  const stats = useMemo(() => {
    const ok = igmpStatus.filter((e) => e.status === 'ok').length;
    const warn = igmpStatus.filter((e) => e.status === 'warning').length;
    const err = igmpStatus.filter((e) => e.status === 'error').length;
    return { ok, warn, err, total: igmpStatus.length };
  }, [igmpStatus]);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex h-full bg-gc-darker text-white">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Radio size={20} className="text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">IGMP / Multicast</h1>
              <p className="text-xs text-gray-500">
                Multicast group management and IGMP querier configuration
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status summary badges */}
            <div className="flex items-center gap-2 mr-2">
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-900/30 text-green-400 text-xs">
                <CheckCircle size={12} /> {stats.ok}
              </span>
              {stats.warn > 0 && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-900/30 text-yellow-400 text-xs">
                  <AlertTriangle size={12} /> {stats.warn}
                </span>
              )}
              {stats.err > 0 && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-900/30 text-red-400 text-xs">
                  <XCircle size={12} /> {stats.err}
                </span>
              )}
            </div>

            <button
              onClick={() => setShowBestPractices(!showBestPractices)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors ${
                showBestPractices
                  ? 'border-gc-accent text-gc-accent bg-gc-accent/10'
                  : 'border-gray-700 text-gray-300 hover:bg-gray-800'
              }`}
            >
              {showBestPractices ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
              Best Practices
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-6">
          {/* ======== IGMP Status Grid ======== */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
                IGMP Status
              </h2>
              <span className="text-xs text-gray-500">({igmpStatus.length} entries)</span>
            </div>
            <div className="border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800/60">
                    <th className="w-10 px-3 py-2.5 text-left text-xs font-medium text-gray-400" />
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Switch
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      VLAN
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Snooping
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Querier
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Querier IP
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Interval
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      MRouter Ports
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {igmpStatus.map((entry) => (
                    <IGMPStatusRow
                      key={`${entry.switchIp}-${entry.vlanId}`}
                      switchName={entry.switchName}
                      switchIp={entry.switchIp}
                      vlanId={entry.vlanId}
                      vlanName={entry.vlanName}
                      snoopingEnabled={entry.snoopingEnabled}
                      querierEnabled={entry.querierEnabled}
                      querierIp={entry.querierIp}
                      queryInterval={entry.queryInterval}
                      mRouterPorts={entry.mRouterPorts}
                      onToggleSnooping={() => handleToggleSnooping(entry.switchIp, entry.vlanId)}
                      onToggleQuerier={() => handleToggleQuerier(entry.switchIp, entry.vlanId)}
                      status={entry.status}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ======== Multicast Groups ======== */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
                Multicast Groups
              </h2>
              <span className="text-xs text-gray-500">
                ({MOCK_MULTICAST_GROUPS.length} active groups)
              </span>
            </div>

            {MOCK_MULTICAST_GROUPS.length === 0 ? (
              <div className="border border-gray-800 rounded-xl p-8 text-center">
                <Wifi size={32} className="mx-auto mb-3 text-gray-600" />
                <p className="text-gray-400 mb-1">No active multicast groups</p>
                <p className="text-xs text-gray-600">
                  Multicast groups appear here when devices join multicast streams via IGMP.
                  Ensure IGMP snooping is enabled on the relevant VLANs.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {Array.from(groupedMulticast.entries()).map(([vlanId, groups]) => {
                  const isExpanded = expandedVlans.has(vlanId);
                  return (
                    <div key={vlanId} className="border border-gray-800 rounded-xl overflow-hidden">
                      {/* VLAN group header */}
                      <button
                        onClick={() => toggleVlanExpand(vlanId)}
                        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800/40 hover:bg-gray-800/60 transition-colors text-left"
                      >
                        {isExpanded ? (
                          <ChevronDown size={16} className="text-gray-500" />
                        ) : (
                          <ChevronRight size={16} className="text-gray-500" />
                        )}
                        <span className="text-sm font-medium text-gray-200">
                          VLAN {vlanId} &mdash; {groups[0].vlanName}
                        </span>
                        <span className="text-xs text-gray-500">
                          {groups.length} group{groups.length !== 1 ? 's' : ''}
                        </span>
                      </button>

                      {isExpanded && (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-900/40">
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                                Group Address
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                                Source Port
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                                Receiver Ports
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                                Switch
                              </th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                                Packets
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {groups.map((g) => (
                              <tr
                                key={`${g.groupAddress}-${g.switchIp}`}
                                className="border-t border-gray-800/50 hover:bg-gray-800/20 transition-colors"
                              >
                                <td className="px-4 py-2.5 font-mono text-green-400 text-xs">
                                  {g.groupAddress}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 text-xs font-mono">
                                    P{g.sourcePort}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex gap-1 flex-wrap">
                                    {g.receiverPorts.map((p) => (
                                      <span
                                        key={p}
                                        className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 text-[10px] font-mono"
                                      >
                                        P{p}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 text-xs text-gray-400">
                                  {g.switchName}
                                </td>
                                <td className="px-4 py-2.5 text-right text-xs text-gray-400 font-mono">
                                  {g.packetCount.toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ======== Querier Map ======== */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
                Querier Map
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {querierMap.map((q) => {
                const statusColors = {
                  ok: 'border-green-800/50 bg-green-900/10',
                  warning: 'border-yellow-800/50 bg-yellow-900/10',
                  error: 'border-red-800/50 bg-red-900/10',
                };
                const statusIcons = {
                  ok: <CheckCircle size={16} className="text-green-400" />,
                  warning: <AlertTriangle size={16} className="text-yellow-400" />,
                  error: <XCircle size={16} className="text-red-400" />,
                };

                return (
                  <div
                    key={q.vlanId}
                    className={`border rounded-xl p-4 ${statusColors[q.status]}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-xs text-gray-500">VLAN {q.vlanId}</div>
                        <div className="text-sm font-medium text-gray-200">{q.vlanName}</div>
                      </div>
                      {statusIcons[q.status]}
                    </div>

                    {q.querierSwitch ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Radio size={12} className="text-gc-accent" />
                          <span className="text-sm text-gray-300">{q.querierSwitch}</span>
                        </div>
                        <div className="text-xs text-gray-500 font-mono">{q.querierIp}</div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">No querier assigned</div>
                    )}

                    <div className="mt-3 text-[11px] text-gray-500">{q.message}</div>

                    {q.status !== 'ok' && (
                      <button
                        onClick={() => handleFixQuerier(q.vlanId)}
                        className="mt-3 flex items-center gap-1.5 px-3 py-1.5 w-full justify-center text-xs font-medium text-gc-accent bg-gc-accent/10 border border-gc-accent/30 rounded-lg hover:bg-gc-accent/20 transition-colors"
                      >
                        <Wrench size={12} />
                        Auto-Fix
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* ======== Best Practices Sidebar ======== */}
      {showBestPractices && (
        <div className="w-80 border-l border-gray-800 bg-gc-dark flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Lightbulb size={16} className="text-yellow-400" />
              <h3 className="text-sm font-semibold text-gray-200">Best Practices</h3>
            </div>
            <button
              onClick={() => setShowBestPractices(false)}
              className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors"
            >
              <PanelRightClose size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {BEST_PRACTICES.map((bp, idx) => (
              <div
                key={idx}
                className="flex gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700/50"
              >
                <div className="flex-shrink-0 mt-0.5">
                  <Info size={14} className="text-gc-accent" />
                </div>
                <div>
                  <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-0.5">
                    {bp.protocol}
                  </div>
                  <div className="text-xs text-gray-300 leading-relaxed">{bp.tip}</div>
                </div>
              </div>
            ))}

            <div className="mt-4 p-3 rounded-lg bg-yellow-900/10 border border-yellow-800/30">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-yellow-400" />
                <span className="text-xs font-medium text-yellow-300">Common Issues</span>
              </div>
              <ul className="text-xs text-gray-400 space-y-1.5 list-disc pl-4">
                <li>Multiple queriers on the same VLAN cause instability</li>
                <li>Disabled snooping floods multicast to all ports</li>
                <li>Missing querier prevents group membership updates</li>
                <li>Mismatched query intervals cause timeout issues</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
