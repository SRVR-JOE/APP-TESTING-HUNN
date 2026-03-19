import React from 'react';
import {
  Server, Cpu, AlertTriangle, CheckCircle, Clock, Wrench, XCircle, Package,
} from 'lucide-react';
import type { FleetAsset } from '@shared/types';

interface FleetAssetCardProps {
  asset: FleetAsset;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

const modelIcons: Record<string, React.ReactNode> = {
  'GC-10':  <Cpu className="w-5 h-5" />,
  'GC-14t': <Server className="w-5 h-5" />,
  'GC-16t': <Server className="w-5 h-5" />,
  'GC-26i': <Server className="w-5 h-5" />,
  'GC-30i': <Server className="w-5 h-5" />,
};

const modelColors: Record<string, string> = {
  'GC-10':  'border-purple-500/40 bg-purple-500/10',
  'GC-14t': 'border-green-500/40 bg-green-500/10',
  'GC-16t': 'border-cyan-500/40 bg-cyan-500/10',
  'GC-26i': 'border-orange-500/40 bg-orange-500/10',
  'GC-30i': 'border-blue-500/40 bg-blue-500/10',
};

const statusConfig: Record<FleetAsset['status'], { label: string; color: string; icon: React.ReactNode }> = {
  available:   { label: 'Available',   color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: <CheckCircle className="w-3 h-3" /> },
  deployed:    { label: 'Deployed',    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',         icon: <Package className="w-3 h-3" /> },
  maintenance: { label: 'Maintenance', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',   icon: <Wrench className="w-3 h-3" /> },
  retired:     { label: 'Retired',     color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',         icon: <XCircle className="w-3 h-3" /> },
  rma:         { label: 'RMA',         color: 'bg-red-500/20 text-red-400 border-red-500/30',            icon: <AlertTriangle className="w-3 h-3" /> },
};

function warrantyStatus(expiry?: string): 'ok' | 'warning' | 'expired' | 'none' {
  if (!expiry) return 'none';
  const diff = (new Date(expiry).getTime() - Date.now()) / 86_400_000;
  if (diff < 0) return 'expired';
  if (diff < 90) return 'warning';
  return 'ok';
}

export const FleetAssetCard: React.FC<FleetAssetCardProps> = ({ asset, selected, onSelect }) => {
  const status = statusConfig[asset.status];
  const warranty = warrantyStatus(asset.warrantyExpiry);
  const mColor = modelColors[asset.model] ?? 'border-gray-500/40 bg-gray-500/10';
  const mIcon  = modelIcons[asset.model]  ?? <Server className="w-5 h-5" />;

  return (
    <div
      onClick={() => onSelect?.(asset.id)}
      className={`
        rounded-lg border p-4 cursor-pointer transition-all duration-200
        bg-gc-panel hover:shadow-lg
        ${selected ? 'ring-2 ring-gc-accent border-gc-accent' : 'border-gray-700 hover:border-gray-500'}
      `}
    >
      {/* Model icon + badge */}
      <div className="flex items-center justify-between mb-3">
        <div className={`flex items-center gap-2 px-2 py-1 rounded-md border text-sm ${mColor}`}>
          {mIcon}
          <span className="font-medium text-gray-200">{asset.model}</span>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${status.color}`}>
          {status.icon}
          {status.label}
        </span>
      </div>

      {/* Name */}
      <h3 className="text-white font-semibold text-base truncate mb-1">
        {asset.serial}
      </h3>
      <p className="text-xs text-gray-500 font-mono mb-2">{asset.mac}</p>

      {/* Firmware badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300 border border-gray-600">
          FW {asset.firmware}
        </span>
        {asset.generation === 1 && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
            Gen 1
          </span>
        )}
      </div>

      {/* Tour / Location */}
      {(asset.currentTourId || asset.location) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {asset.currentTourId && (
            <span className="text-xs px-2 py-0.5 rounded bg-gc-blue/15 text-gc-accent border border-gc-blue/30 truncate max-w-[140px]">
              {asset.currentTourId}
            </span>
          )}
          {asset.location && (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-400 truncate max-w-[140px]">
              {asset.location}
            </span>
          )}
        </div>
      )}

      {/* Warranty indicator */}
      <div className="flex items-center gap-1.5 text-xs">
        {warranty === 'ok' && (
          <span className="flex items-center gap-1 text-emerald-400">
            <CheckCircle className="w-3 h-3" /> Warranty active
          </span>
        )}
        {warranty === 'warning' && (
          <span className="flex items-center gap-1 text-yellow-400">
            <Clock className="w-3 h-3" /> Warranty expiring soon
          </span>
        )}
        {warranty === 'expired' && (
          <span className="flex items-center gap-1 text-red-400">
            <AlertTriangle className="w-3 h-3" /> Warranty expired
          </span>
        )}
        {warranty === 'none' && (
          <span className="text-gray-600">No warranty data</span>
        )}
      </div>
    </div>
  );
};

export default FleetAssetCard;
