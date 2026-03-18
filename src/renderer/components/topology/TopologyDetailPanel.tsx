import React from 'react';
import { X, ExternalLink, Wifi, Server, Cable } from 'lucide-react';
import type { TopologySwitch, TopologyDevice, TopologyLink } from '../../hooks/useTopology';

type SelectedSwitch = { type: 'switch'; data: TopologySwitch };
type SelectedDevice = { type: 'device'; data: TopologyDevice };
type SelectedLink = { type: 'link'; data: TopologyLink };

export type SelectedElement = SelectedSwitch | SelectedDevice | SelectedLink;

export interface TopologyDetailPanelProps {
  selectedElement: SelectedElement | null;
  onClose: () => void;
  onViewDetails: (switchId: string) => void;
}

const HEALTH_STYLES: Record<string, { dot: string; label: string }> = {
  healthy:  { dot: 'bg-green-500', label: 'Healthy' },
  warning:  { dot: 'bg-yellow-500', label: 'Warning' },
  critical: { dot: 'bg-red-500', label: 'Critical' },
  offline:  { dot: 'bg-gray-500', label: 'Offline' },
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-1.5 border-b border-gray-700/50 last:border-0">
      <span className="text-xs text-gray-400 shrink-0 mr-3">{label}</span>
      <span className="text-xs text-white text-right font-medium">{value}</span>
    </div>
  );
}

function SwitchDetail({ data, onViewDetails }: { data: TopologySwitch; onViewDetails: (id: string) => void }) {
  const health = HEALTH_STYLES[data.healthStatus] ?? HEALTH_STYLES.offline;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Server size={18} className="text-blue-400" />
        <span className="font-bold text-base">{data.name}</span>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-3 space-y-0.5">
        <InfoRow label="Model" value={data.model} />
        <InfoRow label="IP Address" value={<span className="font-mono">{data.ip}</span>} />
        <InfoRow label="MAC" value={<span className="font-mono text-[10px]">{data.mac}</span>} />
        <InfoRow label="Firmware" value={data.firmware} />
        <InfoRow label="Role" value={<span className="capitalize">{data.role}</span>} />
        <InfoRow label="Rack Group" value={data.rackGroup ?? 'None'} />
        <InfoRow
          label="Health"
          value={
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${health.dot}`} />
              {health.label}
            </span>
          }
        />
        <InfoRow
          label="Ports"
          value={
            <span>
              <span className="text-green-400">{data.portsUp} up</span>
              {' / '}
              {data.portCount} total
            </span>
          }
        />
      </div>

      <button
        onClick={() => onViewDetails(data.id)}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <ExternalLink size={14} />
        Open Detail View
      </button>
    </div>
  );
}

function DeviceDetail({ data }: { data: TopologyDevice }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Wifi size={18} className="text-green-400" />
        <span className="font-bold text-base">{data.name}</span>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-3 space-y-0.5">
        <InfoRow label="Manufacturer" value={data.manufacturer} />
        <InfoRow label="Protocol" value={data.protocol} />
        <InfoRow label="IP Address" value={data.ip ? <span className="font-mono">{data.ip}</span> : 'N/A'} />
        <InfoRow label="MAC" value={<span className="font-mono text-[10px]">{data.mac}</span>} />
        <InfoRow label="Connected To" value={data.connectedSwitchId} />
        <InfoRow label="Port" value={data.connectedPort} />
      </div>
    </div>
  );
}

function LinkDetail({ data }: { data: TopologyLink }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Cable size={18} className="text-yellow-400" />
        <span className="font-bold text-base">
          {data.isISL ? 'ISL / Trunk Link' : 'Device Link'}
        </span>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-3 space-y-0.5">
        <InfoRow label="Source" value={data.sourceSwitchId} />
        <InfoRow label="Source Port" value={data.sourcePort} />
        <InfoRow label="Target" value={data.targetSwitchId} />
        <InfoRow label="Target Port" value={data.targetPort} />
        <InfoRow label="Speed" value={data.speed} />
        <InfoRow
          label="Status"
          value={
            <span className={data.status === 'up' ? 'text-green-400' : 'text-red-400'}>
              {data.status.toUpperCase()}
            </span>
          }
        />
        {data.trunkVlans && data.trunkVlans.length > 0 && (
          <InfoRow
            label="Trunk VLANs"
            value={
              <div className="flex flex-wrap gap-1 justify-end">
                {data.trunkVlans.map((v) => (
                  <span key={v} className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded font-mono">
                    {v}
                  </span>
                ))}
              </div>
            }
          />
        )}
      </div>

      {data.isISL && (
        <div className="bg-gray-800/50 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Traffic Counters</h4>
          <div className="space-y-0.5">
            <InfoRow label="TX" value="1.24 Gbps" />
            <InfoRow label="RX" value="892 Mbps" />
            <InfoRow label="Packets" value="2.4M / sec" />
            <InfoRow label="Errors" value={<span className="text-green-400">0</span>} />
          </div>
        </div>
      )}
    </div>
  );
}

export function TopologyDetailPanel({ selectedElement, onClose, onViewDetails }: TopologyDetailPanelProps) {
  if (!selectedElement) return null;

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col shrink-0 h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          {selectedElement.type === 'switch' && 'Switch Details'}
          {selectedElement.type === 'device' && 'Device Details'}
          {selectedElement.type === 'link' && 'Link Details'}
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
        >
          <X size={16} className="text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedElement.type === 'switch' && (
          <SwitchDetail data={selectedElement.data} onViewDetails={onViewDetails} />
        )}
        {selectedElement.type === 'device' && (
          <DeviceDetail data={selectedElement.data} />
        )}
        {selectedElement.type === 'link' && (
          <LinkDetail data={selectedElement.data} />
        )}
      </div>
    </div>
  );
}

export default TopologyDetailPanel;
