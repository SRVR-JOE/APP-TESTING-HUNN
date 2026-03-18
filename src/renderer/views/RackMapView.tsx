import React from 'react';
import { LayoutGrid } from 'lucide-react';

export default function RackMapView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <LayoutGrid size={24} className="text-gc-accent" />
        <h2 className="text-xl font-semibold">Rack Map</h2>
      </div>
      <p className="text-gray-400">
        Visual topology of your GigaCore switches organized by rack groups and physical location.
      </p>
      <div className="bg-gc-panel rounded-lg border border-gray-700 p-8 text-center text-gray-500">
        Rack Map View - Interactive topology editor will be implemented here.
      </div>
    </div>
  );
}
