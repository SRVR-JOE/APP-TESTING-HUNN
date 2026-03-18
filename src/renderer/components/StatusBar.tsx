import React from 'react';
import { Wifi, Activity, Radio } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export function StatusBar() {
  const switches = useAppStore((state) => state.switches);
  const isScanning = useAppStore((state) => state.isScanning);

  const onlineCount = switches.filter((s) => s.isOnline).length;
  const totalCount = switches.length;

  return (
    <footer className="h-8 bg-gc-dark border-t border-gray-700 flex items-center px-4 text-xs text-gray-400 gap-6 shrink-0">
      <div className="flex items-center gap-1.5">
        <Wifi size={13} className={onlineCount > 0 ? 'text-green-400' : ''} />
        <span>
          {onlineCount}/{totalCount} switches online
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {isScanning ? (
          <>
            <Radio size={13} className="text-gc-accent animate-pulse" />
            <span className="text-gc-accent">Scanning...</span>
          </>
        ) : (
          <>
            <Activity size={13} />
            <span>Idle</span>
          </>
        )}
      </div>

      <div className="ml-auto text-gray-500">Luminex Configurator</div>
    </footer>
  );
}
