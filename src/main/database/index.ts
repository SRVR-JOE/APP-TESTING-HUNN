// ============================================================================
// GigaCore Command — Database Layer Barrel Export
// ============================================================================
//
// Exports a singleton DatabaseManager and all repository / logging classes.
// Usage:
//   import { databaseManager, switchRepo, deviceRepo, eventLogger, portStats, logExporter } from './database';
//

import { DatabaseManager } from './database';
import { SwitchRepository } from './switch-repository';
import { DeviceRepository } from './device-repository';
import { EventLogger } from '../logging/event-logger';
import { PortStatsCollector } from '../logging/port-stats-collector';
import { LogExporter } from '../logging/log-exporter';

// Singleton database manager — created once when this module is first imported.
const databaseManager = new DatabaseManager();

// Repositories & services wired to the singleton
const switchRepo = new SwitchRepository(databaseManager);
const deviceRepo = new DeviceRepository(databaseManager);
const eventLogger = new EventLogger(databaseManager);
const portStats = new PortStatsCollector(databaseManager);
const logExporter = new LogExporter(databaseManager);

export {
  databaseManager,
  switchRepo,
  deviceRepo,
  eventLogger,
  portStats,
  logExporter,
  DatabaseManager,
  SwitchRepository,
  DeviceRepository,
  EventLogger,
  PortStatsCollector,
  LogExporter,
};
