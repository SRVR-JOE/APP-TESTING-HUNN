// ============================================================================
// Luminex Configurator — Database Layer Barrel Export
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
import { RackMapRepository } from './rack-map-repository';
import { ProfileRepository } from './profile-repository';

// Singleton database manager — created once when this module is first imported.
const databaseManager = new DatabaseManager();

// Repositories & services wired to the singleton
const switchRepo = new SwitchRepository(databaseManager);
const deviceRepo = new DeviceRepository(databaseManager);
const eventLogger = new EventLogger(databaseManager);
const portStats = new PortStatsCollector(databaseManager);
const portStatsCollector = portStats;
const logExporter = new LogExporter(databaseManager);
const rackMapRepo = new RackMapRepository(databaseManager);
const profileRepo = new ProfileRepository(databaseManager);

export {
  databaseManager,
  switchRepo,
  deviceRepo,
  eventLogger,
  portStats,
  portStatsCollector,
  logExporter,
  rackMapRepo,
  profileRepo,
  DatabaseManager,
  SwitchRepository,
  DeviceRepository,
  EventLogger,
  PortStatsCollector,
  LogExporter,
  RackMapRepository,
  ProfileRepository,
};
