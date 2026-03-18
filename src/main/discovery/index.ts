/**
 * Network discovery engine for Luminex Configurator.
 *
 * Re-exports all public classes and types from the discovery module.
 */

export { MdnsScanner } from './mdns-scanner';
export { SubnetScanner } from './subnet-scanner';
export { LldpListener } from './lldp-listener';
export { MacOuiResolver } from './mac-oui-resolver';
export { DiscoveryManager } from './discovery-manager';

export type {
  DiscoveredSwitch,
  DiscoveredDevice,
  MdnsDiscoveryResult,
  SubnetScanResult,
  SubnetScanOptions,
  LldpNeighbor,
  TopologyLink,
  LocalSubnet,
} from './types';

export { GIGACORE_PORT_COUNTS, getPortCountForModel } from './types';
