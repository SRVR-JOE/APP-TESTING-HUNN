import React from 'react';
import type { LocationType } from '@shared/types';
import { LOCATION_TYPE_CONFIG } from '@shared/constants';

interface LocationTypeBadgeProps {
  type: LocationType;
  size?: 'sm' | 'md';
}

export const LocationTypeBadge: React.FC<LocationTypeBadgeProps> = ({ type, size = 'sm' }) => {
  const config = LOCATION_TYPE_CONFIG[type];
  const textSize = size === 'sm' ? 'text-[9px]' : 'text-[10px]';
  const px = size === 'sm' ? 'px-1.5' : 'px-2';
  const py = size === 'sm' ? 'py-0' : 'py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1 ${textSize} font-semibold tracking-wide uppercase ${px} ${py} rounded`}
      style={{
        color: config.color,
        background: `${config.color}18`,
        border: `1px solid ${config.color}30`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-sm flex-shrink-0"
        style={{ background: config.color }}
      />
      {config.label}
    </span>
  );
};

export default LocationTypeBadge;
