import React from 'react';
import { MapPin, Users, Wifi, WifiOff, Building2, Tent, Theater, Radio, Warehouse } from 'lucide-react';
import type { VenueProfile } from '@shared/types';

interface VenueCardProps {
  venue: VenueProfile;
  selected?: boolean;
  compact?: boolean;
  onClick?: (venueId: string) => void;
}

const venueTypeConfig: Record<
  VenueProfile['venueType'],
  { label: string; icon: React.ElementType; color: string }
> = {
  arena: { label: 'Arena', icon: Building2, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  stadium: { label: 'Stadium', icon: Building2, color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  theater: { label: 'Theater', icon: Theater, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  festival: { label: 'Festival', icon: Tent, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  convention: { label: 'Convention', icon: Warehouse, color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  'broadcast-studio': { label: 'Broadcast', icon: Radio, color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  outdoor: { label: 'Outdoor', icon: Tent, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  other: { label: 'Other', icon: Building2, color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

export const VenueCard: React.FC<VenueCardProps> = ({ venue, selected = false, compact = false, onClick }) => {
  const typeConf = venueTypeConfig[venue.venueType] ?? venueTypeConfig.other;
  const TypeIcon = typeConf.icon;
  const hasHouseNetwork = venue.houseNetwork?.internetDrop === true;

  if (compact) {
    return (
      <button
        onClick={() => onClick?.(venue.id)}
        className={`w-full text-left px-3 py-2 rounded-lg border transition-all duration-150 ${
          selected
            ? 'bg-gc-blue/10 border-gc-blue ring-1 ring-gc-blue'
            : 'bg-gc-panel border-gray-700/50 hover:border-gray-600'
        }`}
      >
        <div className="flex items-center gap-2">
          <TypeIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="text-sm text-white font-medium truncate">{venue.name}</span>
          <span className="text-xs text-gray-500 ml-auto shrink-0">{venue.city}</span>
        </div>
      </button>
    );
  }

  return (
    <div
      onClick={() => onClick?.(venue.id)}
      className={`rounded-lg border p-4 cursor-pointer transition-all duration-200 ${
        selected
          ? 'bg-gc-blue/10 border-gc-blue ring-1 ring-gc-blue shadow-lg shadow-gc-blue/5'
          : 'bg-gc-panel border-gray-700/50 hover:border-gray-600 hover:shadow-md hover:shadow-black/20'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-white font-semibold text-sm leading-tight truncate pr-2">{venue.name}</h3>
        <div
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border shrink-0 ${typeConf.color}`}
        >
          <TypeIcon className="w-3 h-3" />
          {typeConf.label}
        </div>
      </div>

      {/* Location */}
      <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-3">
        <MapPin className="w-3 h-3 shrink-0" />
        <span>
          {venue.city}, {venue.country}
        </span>
      </div>

      {/* Bottom row: capacity + network status */}
      <div className="flex items-center justify-between">
        {venue.capacity != null && (
          <div className="flex items-center gap-1.5 text-gray-400 text-xs">
            <Users className="w-3 h-3" />
            <span>{venue.capacity.toLocaleString()}</span>
          </div>
        )}
        <div
          className={`flex items-center gap-1 text-xs ${
            hasHouseNetwork ? 'text-green-400' : 'text-gray-500'
          }`}
        >
          {hasHouseNetwork ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          <span>{hasHouseNetwork ? 'Network' : 'No network'}</span>
        </div>
      </div>

      {/* Contact count */}
      {venue.contacts && venue.contacts.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-700/50">
          <span className="text-xs text-gray-500">
            {venue.contacts.length} contact{venue.contacts.length !== 1 ? 's' : ''} on file
          </span>
        </div>
      )}
    </div>
  );
};

export default VenueCard;
