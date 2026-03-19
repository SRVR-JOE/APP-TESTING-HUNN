import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { NamingConflict } from '../lib/naming-engine';

interface Props {
  conflicts: NamingConflict[];
}

export const NamingConflictBanner: React.FC<Props> = ({ conflicts }) => {
  if (conflicts.length === 0) return null;

  return (
    <div className="bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
        <span className="text-xs font-semibold text-red-400">
          {conflicts.length} naming conflict{conflicts.length !== 1 ? 's' : ''} detected
        </span>
      </div>
      <div className="ml-6 space-y-0.5">
        {conflicts.slice(0, 5).map((c, i) => (
          <p key={i} className="text-[10px] text-gray-400">
            &quot;{c.name}&quot; conflicts with existing switch
          </p>
        ))}
        {conflicts.length > 5 && (
          <p className="text-[10px] text-gray-500">...and {conflicts.length - 5} more</p>
        )}
      </div>
    </div>
  );
};

export default NamingConflictBanner;
