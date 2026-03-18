import React from 'react';
import { BookOpen } from 'lucide-react';

export default function ProfilesView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BookOpen size={24} className="text-gc-accent" />
        <h2 className="text-xl font-semibold">Profiles</h2>
      </div>
      <p className="text-gray-400">
        Manage reusable switch configuration profiles for rapid deployment across your GigaCore network.
      </p>
      <div className="bg-gc-panel rounded-lg border border-gray-700 p-8 text-center text-gray-500">
        Profiles View - Profile management interface will be implemented here.
      </div>
    </div>
  );
}
