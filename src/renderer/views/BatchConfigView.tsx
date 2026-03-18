import React from 'react';
import { Layers } from 'lucide-react';

export default function BatchConfigView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Layers size={24} className="text-gc-accent" />
        <h2 className="text-xl font-semibold">Batch Configuration</h2>
      </div>
      <p className="text-gray-400">
        Apply configuration profiles to multiple GigaCore switches simultaneously.
      </p>
      <div className="bg-gc-panel rounded-lg border border-gray-700 p-8 text-center text-gray-500">
        Batch Config View - Multi-switch configuration interface will be implemented here.
      </div>
    </div>
  );
}
