import React from 'react';
import { Users } from 'lucide-react';

export default function DiscoveredDevicesView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Users size={24} className="text-gc-accent" />
        <h2 className="text-xl font-semibold">Discovered Devices</h2>
      </div>
      <p className="text-gray-400">
        All end devices discovered across your GigaCore network with MAC, IP, and connection details.
      </p>
      <div className="bg-gc-panel rounded-lg border border-gray-700 p-8 text-center text-gray-500">
        Discovered Devices View - Device table with filtering will be implemented here.
      </div>
    </div>
  );
}
