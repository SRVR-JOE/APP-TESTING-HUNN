import React from 'react';
import { Wrench } from 'lucide-react';

export default function TroubleshootView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Wrench size={24} className="text-gc-accent" />
        <h2 className="text-xl font-semibold">Troubleshoot</h2>
      </div>
      <p className="text-gray-400">
        Diagnostic tools including health checks, ping tests, switch comparison, and counter resets.
      </p>
      <div className="bg-gc-panel rounded-lg border border-gray-700 p-8 text-center text-gray-500">
        Troubleshoot View - Diagnostic tools interface will be implemented here.
      </div>
    </div>
  );
}
