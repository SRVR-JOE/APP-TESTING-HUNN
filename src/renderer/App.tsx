import React from 'react';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAppStore } from './store/useAppStore';
import { VIEWS } from '@shared/constants';

import ScannerView from './views/ScannerView';
import RackMapView from './views/RackMapView';
import TopologyView from './views/TopologyView';
import IGMPView from './views/IGMPView';
import VLANConfigView from './views/VLANConfigView';
import DeviceDetailView from './views/DeviceDetailView';
import DiscoveredDevicesView from './views/DiscoveredDevicesView';
import BatchConfigView from './views/BatchConfigView';
import ExcelImportView from './views/ExcelImportView';
import ProfilesView from './views/ProfilesView';
import LogsView from './views/LogsView';
import TroubleshootView from './views/TroubleshootView';
import SettingsView from './views/SettingsView';
import NamingView from './views/NamingView';
import { ShowFileView } from './views/ShowFileView';
import MulticastFlowView from './views/MulticastFlowView';
import RedundancyView from './views/RedundancyView';
import AuditTrailView from './views/AuditTrailView';
import OfflineDesignView from './views/OfflineDesignView';
import RemoteMonitorView from './views/RemoteMonitorView';
import CableScheduleView from './views/CableScheduleView';

const viewComponents: Record<string, React.ComponentType> = {
  [VIEWS.SCANNER]: ScannerView,
  [VIEWS.RACK_MAP]: RackMapView,
  [VIEWS.TOPOLOGY]: TopologyView,
  [VIEWS.IGMP]: IGMPView,
  [VIEWS.VLAN_CONFIG]: VLANConfigView,
  [VIEWS.DEVICE_DETAIL]: DeviceDetailView,
  [VIEWS.DISCOVERED_DEVICES]: DiscoveredDevicesView,
  [VIEWS.BATCH_CONFIG]: BatchConfigView,
  [VIEWS.EXCEL_IMPORT]: ExcelImportView,
  [VIEWS.PROFILES]: ProfilesView,
  [VIEWS.NAMING]: NamingView,
  [VIEWS.SHOW_FILE]: ShowFileView,
  [VIEWS.MULTICAST_FLOW]: MulticastFlowView,
  [VIEWS.REDUNDANCY]: RedundancyView,
  [VIEWS.AUDIT_TRAIL]: AuditTrailView,
  [VIEWS.OFFLINE_DESIGN]: OfflineDesignView,
  [VIEWS.REMOTE_MONITOR]: RemoteMonitorView,
  [VIEWS.CABLE_SCHEDULE]: CableScheduleView,
  [VIEWS.LOGS]: LogsView,
  [VIEWS.TROUBLESHOOT]: TroubleshootView,
  [VIEWS.SETTINGS]: SettingsView,
};

function App() {
  const selectedView = useAppStore((state) => state.selectedView);
  const ActiveView = viewComponents[selectedView] ?? ScannerView;

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <main className="flex-1 overflow-auto p-6">
          <ErrorBoundary>
            <ActiveView />
          </ErrorBoundary>
        </main>
        <StatusBar />
      </div>
    </div>
  );
}

export default App;
