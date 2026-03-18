import React from 'react';
import {
  Radar,
  LayoutGrid,
  Monitor,
  Users,
  Layers,
  FileSpreadsheet,
  BookOpen,
  ScrollText,
  Wrench,
  Settings,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { VIEWS, type ViewId } from '@shared/constants';

interface NavItem {
  id: ViewId;
  label: string;
  icon: React.ComponentType<any>;
}

const navItems: NavItem[] = [
  { id: VIEWS.SCANNER, label: 'Scanner', icon: Radar },
  { id: VIEWS.RACK_MAP, label: 'Rack Map', icon: LayoutGrid },
  { id: VIEWS.DEVICE_DETAIL, label: 'Device Detail', icon: Monitor },
  { id: VIEWS.DISCOVERED_DEVICES, label: 'Devices', icon: Users },
  { id: VIEWS.BATCH_CONFIG, label: 'Batch Config', icon: Layers },
  { id: VIEWS.EXCEL_IMPORT, label: 'Excel Import', icon: FileSpreadsheet },
  { id: VIEWS.PROFILES, label: 'Profiles', icon: BookOpen },
  { id: VIEWS.LOGS, label: 'Logs', icon: ScrollText },
  { id: VIEWS.TROUBLESHOOT, label: 'Troubleshoot', icon: Wrench },
  { id: VIEWS.SETTINGS, label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const selectedView = useAppStore((state) => state.selectedView);
  const setView = useAppStore((state) => state.setView);

  return (
    <aside className="w-56 bg-gc-dark border-r border-gray-700 flex flex-col">
      <div className="px-4 py-5 border-b border-gray-700">
        <h1 className="text-lg font-bold text-gc-accent tracking-wide">
          Luminex Configurator
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">Switch Management</p>
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = selectedView === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`
                w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium
                transition-colors duration-150 text-left
                ${
                  isActive
                    ? 'bg-gc-blue/20 text-gc-accent border-r-2 border-gc-accent'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }
              `}
            >
              <Icon size={18} className={isActive ? 'text-gc-accent' : ''} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-gray-700 text-xs text-gray-500">
        v0.1.0
      </div>
    </aside>
  );
}
