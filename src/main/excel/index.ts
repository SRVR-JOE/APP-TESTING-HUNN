// ── Excel Import/Export Engine — Barrel Exports ──────────────────────────────

// Types
export type {
  ExcelIPScheme,
  ExcelSwitchEntry,
  ExcelPortAssignment,
  ExcelGroupDefinition,
  ExcelProfile,
  ExcelPortConfig,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  DeployPlan,
  DeploySwitchPlan,
  DeployChange,
  DeployResult,
  SwitchDeployResult,
  SwitchBackup,
  VerificationResult,
  SwitchVerification,
  DiscoveredSwitch,
  DiscoveredGroup,
  DiscoveredPort,
  GigaCoreClient,
  GigaCoreModel,
} from './types';

export {
  GIGACORE_MODELS,
  MODEL_PORT_COUNTS,
  SOLOTECH_DEFAULT_GROUPS,
  GROUP_COLORS,
} from './types';

// Classes
export { TemplateGenerator } from './template-generator';
export { ExcelParser } from './excel-parser';
export { ExcelValidator } from './validation';
export { DeployEngine } from './deploy-engine';
export type { DeployOptions } from './deploy-engine';
