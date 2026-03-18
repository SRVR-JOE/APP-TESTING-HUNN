import React, { useCallback } from 'react';
import { CheckSquare, Square } from 'lucide-react';

export interface VLANMembershipMatrixProps {
  vlanId: number;
  switches: Array<{
    name: string;
    ip: string;
    portCount: number;
    memberPorts: number[];
  }>;
  onTogglePort: (switchIp: string, port: number, isMember: boolean) => void;
}

const VLAN_COLORS: Record<number, string> = {
  1: '#6b7280',
  10: '#ef4444',
  20: '#f59e0b',
  30: '#22c55e',
  40: '#a855f7',
  50: '#ec4899',
  100: '#3b82f6',
  1300: '#14b8a6',
  1301: '#06b6d4',
};

function getVlanColor(vlanId: number): string {
  return VLAN_COLORS[vlanId] ?? '#0078d4';
}

export default function VLANMembershipMatrix({
  vlanId,
  switches,
  onTogglePort,
}: VLANMembershipMatrixProps) {
  const maxPorts = Math.max(...switches.map((s) => s.portCount), 0);
  const portNumbers = Array.from({ length: maxPorts }, (_, i) => i + 1);
  const color = getVlanColor(vlanId);

  const handleSelectAllSwitch = useCallback(
    (sw: VLANMembershipMatrixProps['switches'][0]) => {
      const allMember = portNumbers
        .filter((p) => p <= sw.portCount)
        .every((p) => sw.memberPorts.includes(p));
      portNumbers
        .filter((p) => p <= sw.portCount)
        .forEach((p) => {
          onTogglePort(sw.ip, p, !allMember);
        });
    },
    [portNumbers, onTogglePort]
  );

  const handleSelectAllPort = useCallback(
    (port: number) => {
      const allMember = switches
        .filter((s) => port <= s.portCount)
        .every((s) => s.memberPorts.includes(port));
      switches
        .filter((s) => port <= s.portCount)
        .forEach((s) => {
          onTogglePort(s.ip, port, !allMember);
        });
    },
    [switches, onTogglePort]
  );

  if (switches.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        No switches assigned to this VLAN.
      </div>
    );
  }

  return (
    <div className="overflow-auto max-h-80 border border-gray-700 rounded-lg bg-gray-900/50">
      <table className="text-xs border-collapse">
        <thead className="sticky top-0 z-10 bg-gc-dark">
          <tr>
            <th className="sticky left-0 z-20 bg-gc-dark px-3 py-2 text-left text-gray-400 font-medium border-b border-r border-gray-700 min-w-[160px]">
              Switch
            </th>
            <th className="px-1 py-2 text-gray-500 border-b border-gray-700 min-w-[24px]">
              {/* All checkbox column */}
            </th>
            {portNumbers.map((port) => (
              <th
                key={port}
                className="px-0.5 py-2 text-center text-gray-400 border-b border-gray-700 min-w-[28px] cursor-pointer hover:text-white"
                onClick={() => handleSelectAllPort(port)}
                title={`Toggle port ${port} on all switches`}
              >
                {port}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {switches.map((sw) => {
            const allMember = portNumbers
              .filter((p) => p <= sw.portCount)
              .every((p) => sw.memberPorts.includes(p));
            return (
              <tr
                key={sw.ip}
                className="hover:bg-gray-800/50 transition-colors"
              >
                <td className="sticky left-0 z-10 bg-gc-dark px-3 py-1.5 font-medium text-gray-300 border-r border-gray-700 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span>{sw.name}</span>
                    <span className="text-gray-500 text-[10px]">{sw.ip}</span>
                  </div>
                </td>
                <td className="px-1 py-1.5 text-center">
                  <button
                    onClick={() => handleSelectAllSwitch(sw)}
                    className="text-gray-400 hover:text-white transition-colors"
                    title={`Select all ports on ${sw.name}`}
                  >
                    {allMember ? (
                      <CheckSquare size={14} className="text-gc-accent" />
                    ) : (
                      <Square size={14} />
                    )}
                  </button>
                </td>
                {portNumbers.map((port) => {
                  if (port > sw.portCount) {
                    return (
                      <td
                        key={port}
                        className="px-0.5 py-1.5 text-center"
                      >
                        <span className="text-gray-800">-</span>
                      </td>
                    );
                  }
                  const isMember = sw.memberPorts.includes(port);
                  return (
                    <td
                      key={port}
                      className="px-0.5 py-1.5 text-center cursor-pointer"
                      onClick={() => onTogglePort(sw.ip, port, !isMember)}
                    >
                      {isMember ? (
                        <span
                          className="inline-block w-4 h-4 rounded-full"
                          style={{ backgroundColor: color }}
                          title={`Port ${port} - Member of VLAN ${vlanId}`}
                        />
                      ) : (
                        <span
                          className="inline-block w-4 h-4 rounded-full border border-gray-600 hover:border-gray-400 transition-colors"
                          title={`Port ${port} - Click to add to VLAN ${vlanId}`}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
