import React from 'react';
import { Settings } from 'lucide-react';

export default function SettingsView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Settings size={24} className="text-gc-accent" />
        <h2 className="text-xl font-semibold">Settings</h2>
      </div>
      <p className="text-gray-400">
        Configure application preferences, network defaults, polling intervals, and database settings.
      </p>
      <div className="bg-gc-panel rounded-lg border border-gray-700 p-8 text-center text-gray-500">
        Settings View - Application settings interface will be implemented here.
      </div>
    </div>
  );
}
