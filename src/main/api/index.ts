// ============================================================================
// Luminex Configurator — API Module Barrel Exports
// ============================================================================

// Types
export {
  ApiError,
  ApiErrorCode,
  type ApiErrorCodeType,
  type SwitchSystemInfo,
  type PortInfo,
  type PortAdminStatus,
  type PortOperStatus,
  type PortType,
  type VlanMode,
  type PortSpeed,
  type PoeStatus,
  type PortLldpNeighbor,
  type GroupConfig,
  type PoeSummary,
  type PoePriority,
  type PoePortInfo,
  type IgmpConfig,
  type IgmpGroupConfig,
  type SwitchProfileSlot,
  type LldpNeighborInfo,
  type PortStatistics,
  type RlinkxStatus,
  type RlinkxRole,
  type RlinkxRingState,
  type IpConfig,
  type SwitchCredentials,
  type BatchOperation,
  type BatchResult,
  type BatchProgress,
  type WsTopic,
  type WsConnectionState,
  type WsMessage,
  type RequestLogEntry,
  type RequestLogHook,
} from './api-types';

// REST API client
export { GigaCoreClient } from './gigacore-client';

// WebSocket client
export { GigaCoreWebSocket } from './websocket-client';

// Batch executor
export { BatchExecutor } from './batch-executor';

// Auth manager
export { AuthManager } from './auth';
