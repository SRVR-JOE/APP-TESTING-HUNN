import React from 'react';
import { Radar } from 'lucide-react';

export default function ScannerView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Radar size={24} className="text-gc-accent" />
        <h2 className="text-xl font-semibold">Network Scanner</h2>
      </div>
      <p className="text-gray-400">
        Scan your network to discover GigaCore switches. Configure subnet ranges and monitor discovery progress.
      </p>
      <div className="bg-gc-panel rounded-lg border border-gray-700 p-8 text-center text-gray-500">
        Scanner View - Network discovery interface will be implemented here.
      </div>
    </div>
  );
}
