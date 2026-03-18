import React, { useState, useMemo } from 'react';
import { AlertTriangle, ArrowUpDown } from 'lucide-react';
import type { DiscoveredSwitch } from '@shared/types';

export interface IPAssignment {
  switchId: string;
  currentIp: string;
  newIp: string;
  switchName: string;
}

export interface SequentialIPProps {
  switches: DiscoveredSwitch[];
  onPreview: (assignments: IPAssignment[]) => void;
  onApply: (assignments: IPAssignment[]) => void;
  previewReviewed: boolean;
}

function parseIP(ip: string): number[] {
  return ip.split('.').map(Number);
}

function formatIP(octets: number[]): string {
  return octets.join('.');
}

function incrementIP(ip: string, offset: number): string {
  const parts = parseIP(ip);
  let total = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  total += offset;
  return formatIP([
    (total >>> 24) & 0xff,
    (total >>> 16) & 0xff,
    (total >>> 8) & 0xff,
    total & 0xff,
  ]);
}

function isValidIP(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = parseInt(p, 10);
    return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p;
  });
}

export const SequentialIP: React.FC<SequentialIPProps> = ({
  switches,
  onPreview,
  onApply,
  previewReviewed,
}) => {
  const [baseIP, setBaseIP] = useState('10.0.1.10');
  const [subnet, setSubnet] = useState('/24');
  const [gateway, setGateway] = useState('10.0.1.1');
  const [skipOccupied, setSkipOccupied] = useState(true);
  const [order, setOrder] = useState<string[]>(switches.map((s) => s.id));

  // Keep order in sync
  useMemo(() => {
    const currentIds = new Set(order);
    const newIds = switches.map((s) => s.id);
    const hasNew = newIds.some((id) => !currentIds.has(id));
    if (hasNew || order.length !== newIds.length) {
      setOrder(newIds);
    }
  }, [switches.map((s) => s.id).join(',')]);

  const assignments = useMemo(() => {
    if (!isValidIP(baseIP)) return [];
    const existingIPs = new Set(switches.map((s) => s.ip));

    const result: IPAssignment[] = [];
    let offset = 0;

    for (const id of order) {
      const sw = switches.find((s) => s.id === id);
      if (!sw) continue;

      let candidateIP = incrementIP(baseIP, offset);
      if (skipOccupied) {
        while (existingIPs.has(candidateIP) && !switches.some((s) => s.id === id && s.ip === candidateIP)) {
          offset++;
          candidateIP = incrementIP(baseIP, offset);
          if (offset > 500) break; // safety
        }
      }

      result.push({
        switchId: id,
        currentIp: sw.ip,
        newIp: candidateIP,
        switchName: sw.name,
      });
      offset++;
    }

    return result;
  }, [order, switches, baseIP, skipOccupied]);

  // Check for duplicates
  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    const dups = new Set<string>();
    assignments.forEach((a) => {
      const count = (seen.get(a.newIp) || 0) + 1;
      seen.set(a.newIp, count);
      if (count > 1) dups.add(a.newIp);
    });
    return dups;
  }, [assignments]);

  const isBaseIPValid = isValidIP(baseIP);
  const isGatewayValid = isValidIP(gateway);

  const sortByCurrentIP = () => {
    const sorted = [...order].sort((a, b) => {
      const swA = switches.find((s) => s.id === a);
      const swB = switches.find((s) => s.id === b);
      if (!swA || !swB) return 0;
      const pA = parseIP(swA.ip);
      const pB = parseIP(swB.ip);
      for (let i = 0; i < 4; i++) {
        if (pA[i] !== pB[i]) return pA[i] - pB[i];
      }
      return 0;
    });
    setOrder(sorted);
  };

  const sortByName = () => {
    const sorted = [...order].sort((a, b) => {
      const swA = switches.find((s) => s.id === a);
      const swB = switches.find((s) => s.id === b);
      if (!swA || !swB) return 0;
      return swA.name.localeCompare(swB.name);
    });
    setOrder(sorted);
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-white">Sequential IP Assignment</h4>
        <p className="text-xs text-gray-400 mt-0.5">
          Assign sequential IP addresses starting from a base address
        </p>
      </div>

      {/* Configuration */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Base IP Address</label>
          <input
            type="text"
            value={baseIP}
            onChange={(e) => setBaseIP(e.target.value)}
            placeholder="10.0.1.10"
            className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none ${
              isBaseIPValid ? 'border-gray-700 focus:border-gc-accent' : 'border-red-500'
            }`}
          />
          {!isBaseIPValid && baseIP.length > 0 && (
            <p className="text-xs text-red-400 mt-1">Invalid IP address</p>
          )}
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Subnet Mask</label>
          <select
            value={subnet}
            onChange={(e) => setSubnet(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gc-accent"
          >
            <option value="/8">/8 (255.0.0.0)</option>
            <option value="/16">/16 (255.255.0.0)</option>
            <option value="/24">/24 (255.255.255.0)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Gateway</label>
          <input
            type="text"
            value={gateway}
            onChange={(e) => setGateway(e.target.value)}
            placeholder="10.0.1.1"
            className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none ${
              isGatewayValid ? 'border-gray-700 focus:border-gc-accent' : 'border-red-500'
            }`}
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={skipOccupied}
              onChange={(e) => setSkipOccupied(e.target.checked)}
              className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-gc-accent focus:ring-gc-accent focus:ring-offset-0"
            />
            Skip occupied IPs
          </label>
        </div>
      </div>

      {/* Duplicate warning */}
      {duplicates.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-400">
            Duplicate IP addresses detected: {Array.from(duplicates).join(', ')}
          </span>
        </div>
      )}

      {/* Sort buttons */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Sort by:</span>
        <button
          onClick={sortByCurrentIP}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gc-accent transition-colors px-2 py-1 bg-gray-800 rounded border border-gray-700"
        >
          <ArrowUpDown className="w-3 h-3" /> Current IP
        </button>
        <button
          onClick={sortByName}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gc-accent transition-colors px-2 py-1 bg-gray-800 rounded border border-gray-700"
        >
          <ArrowUpDown className="w-3 h-3" /> Name
        </button>
      </div>

      {/* Assignment preview */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-800">
            <tr className="text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left py-2 px-3">#</th>
              <th className="text-left py-2 px-3">Switch</th>
              <th className="text-left py-2 px-3">Current IP</th>
              <th className="text-center py-2 px-3 w-8"></th>
              <th className="text-left py-2 px-3">New IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {assignments.map((a, idx) => {
              const isDuplicate = duplicates.has(a.newIp);
              const isChanged = a.currentIp !== a.newIp;
              return (
                <tr
                  key={a.switchId}
                  className={`${isDuplicate ? 'bg-red-500/5' : ''} hover:bg-gray-800/80 transition-colors`}
                >
                  <td className="py-2 px-3 text-gray-500 text-xs">{idx + 1}</td>
                  <td className="py-2 px-3 text-white">{a.switchName}</td>
                  <td className="py-2 px-3 font-mono text-gray-400">{a.currentIp}</td>
                  <td className="py-2 px-3 text-center text-gray-600">&rarr;</td>
                  <td className="py-2 px-3 font-mono">
                    <span
                      className={
                        isDuplicate
                          ? 'text-red-400'
                          : isChanged
                            ? 'text-gc-accent'
                            : 'text-gray-400'
                      }
                    >
                      {a.newIp}
                    </span>
                    {isDuplicate && (
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 inline ml-2" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {assignments.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            {isBaseIPValid ? 'No switches selected' : 'Enter a valid base IP address'}
          </div>
        )}
      </div>

      {/* Network info */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>Subnet: {subnet}</span>
        <span>Gateway: {gateway}</span>
        <span>
          Range: {baseIP} &mdash; {assignments.length > 0 ? assignments[assignments.length - 1].newIp : '...'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-gray-700">
        <button
          onClick={() => onPreview(assignments)}
          disabled={duplicates.size > 0 || !isBaseIPValid}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            duplicates.size > 0 || !isBaseIPValid
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
        >
          Preview Changes
        </button>
        <button
          onClick={() => onApply(assignments)}
          disabled={!previewReviewed || duplicates.size > 0}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            previewReviewed && duplicates.size === 0
              ? 'bg-gc-accent text-white hover:bg-gc-accent/80'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Apply IP Addresses
        </button>
        {!previewReviewed && (
          <span className="text-xs text-gray-500">Preview changes first</span>
        )}
      </div>
    </div>
  );
};

export default SequentialIP;
