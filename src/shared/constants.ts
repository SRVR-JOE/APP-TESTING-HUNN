// Default network configuration
export const DEFAULT_SUBNET = '192.168.1.0/24';
export const DEFAULT_HTTP_PORT = 80;
export const DEFAULT_HTTPS_PORT = 443;
export const DEFAULT_SNMP_PORT = 161;
export const DEFAULT_WS_PORT = 8080;

// Polling intervals (milliseconds)
export const POLL_INTERVAL_FAST = 2000;
export const POLL_INTERVAL_NORMAL = 5000;
export const POLL_INTERVAL_SLOW = 15000;
export const DISCOVERY_TIMEOUT = 10000;

// Application limits
export const MAX_CONCURRENT_REQUESTS = 10;
export const MAX_EVENT_LOG_ENTRIES = 50000;
export const PORT_STATS_RETENTION_DAYS = 30;

// mDNS / Bonjour service type for GigaCore switches
export const GIGACORE_MDNS_SERVICE = '_gigacore._tcp';
export const GIGACORE_BONJOUR_TYPE = 'gigacore';

// Database
export const DB_FILENAME = 'gigacore-command.db';

// Health check thresholds
export const HEALTH_THRESHOLDS = {
  errorRateWarning: 0.01,
  errorRateCritical: 0.05,
  poeBudgetWarning: 0.8,
  poeBudgetCritical: 0.95,
  pingLatencyWarning: 50,
  pingLatencyCritical: 200,
} as const;

// View identifiers
export const VIEWS = {
  SCANNER: 'scanner',
  RACK_MAP: 'rackMap',
  TOPOLOGY: 'topology',
  DEVICE_DETAIL: 'deviceDetail',
  DISCOVERED_DEVICES: 'discoveredDevices',
  BATCH_CONFIG: 'batchConfig',
  EXCEL_IMPORT: 'excelImport',
  PROFILES: 'profiles',
  LOGS: 'logs',
  TROUBLESHOOT: 'troubleshoot',
  SETTINGS: 'settings',
} as const;

export type ViewId = (typeof VIEWS)[keyof typeof VIEWS];
