import React from 'react';
import { ScrollText } from 'lucide-react';

export default function LogsView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ScrollText size={24} className="text-gc-accent" />
        <h2 className="text-xl font-semibold">Event Logs</h2>
      </div>
      <p className="text-gray-400">
        Browse and filter event logs from all monitored GigaCore switches with severity-based highlighting.
      </p>
      <div className="bg-gc-panel rounded-lg border border-gray-700 p-8 text-center text-gray-500">
        Logs View - Filterable event log table will be implemented here.
      </div>
    </div>
  );
}
