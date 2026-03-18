import React from 'react';
import { Monitor } from 'lucide-react';

export default function DeviceDetailView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Monitor size={24} className="text-gc-accent" />
        <h2 className="text-xl font-semibold">Device Detail</h2>
      </div>
      <p className="text-gray-400">
        Detailed view of a selected GigaCore switch including port status, PoE budget, and configuration.
      </p>
      <div className="bg-gc-panel rounded-lg border border-gray-700 p-8 text-center text-gray-500">
        Device Detail View - Per-switch dashboard will be implemented here.
      </div>
    </div>
  );
}
