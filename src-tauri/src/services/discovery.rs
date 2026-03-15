// SignalGraph — Device Discovery Service
// Orchestrates network scanning and device identification across all connectors.

use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{info, warn};

use crate::connectors::manager::ConnectorManager;
use crate::connectors::traits::DiscoveredDevice;
use crate::models::device::{Device, EntityId};

/// Events emitted during discovery.
#[derive(Debug, Clone)]
pub enum DiscoveryEvent {
    ScanStarted { network: String },
    DeviceFound(DiscoveredDevice),
    DeviceIdentified(Device),
    ScanProgress { found: usize, identified: usize },
    ScanComplete { total_found: usize, total_identified: usize },
    ScanError(String),
}

/// Configuration for a discovery scan.
#[derive(Debug, Clone)]
pub struct ScanConfig {
    pub networks: Vec<String>,
    pub timeout_ms: u64,
    pub include_snmp: bool,
    pub include_mdns: bool,
    pub include_dante: bool,
    pub include_ndi: bool,
}

impl Default for ScanConfig {
    fn default() -> Self {
        Self {
            networks: vec!["192.168.1.0/24".to_string()],
            timeout_ms: 15000,
            include_snmp: true,
            include_mdns: true,
            include_dante: true,
            include_ndi: true,
        }
    }
}

/// The discovery service that finds and identifies AV devices on the network.
pub struct DiscoveryService {
    connector_manager: Arc<ConnectorManager>,
    event_tx: broadcast::Sender<DiscoveryEvent>,
}

impl DiscoveryService {
    pub fn new(
        connector_manager: Arc<ConnectorManager>,
        event_tx: broadcast::Sender<DiscoveryEvent>,
    ) -> Self {
        Self {
            connector_manager,
            event_tx,
        }
    }

    /// Run a full network discovery scan.
    pub async fn scan(&self, config: &ScanConfig) -> Vec<Device> {
        let mut all_devices = Vec::new();

        for network in &config.networks {
            info!(network = %network, "Starting discovery scan");
            let _ = self.event_tx.send(DiscoveryEvent::ScanStarted {
                network: network.clone(),
            });

            // Phase 1: Discover raw devices across all connectors
            let discovered = self.connector_manager.discover_all(network).await;

            info!(count = discovered.len(), "Raw devices discovered");

            for raw_device in &discovered {
                let _ = self.event_tx.send(DiscoveryEvent::DeviceFound(raw_device.clone()));
            }

            // Phase 2: Identify each discovered device
            let mut identified_count = 0;
            for raw_device in &discovered {
                match self.identify_device(raw_device).await {
                    Ok(device) => {
                        info!(
                            vendor = %device.vendor,
                            model = %device.model,
                            ip = %raw_device.ip_address,
                            "Device identified"
                        );
                        let _ = self.event_tx.send(DiscoveryEvent::DeviceIdentified(device.clone()));
                        all_devices.push(device);
                        identified_count += 1;
                    }
                    Err(e) => {
                        warn!(
                            ip = %raw_device.ip_address,
                            error = %e,
                            "Failed to identify device"
                        );
                    }
                }

                let _ = self.event_tx.send(DiscoveryEvent::ScanProgress {
                    found: discovered.len(),
                    identified: identified_count,
                });
            }
        }

        let total = all_devices.len();
        let _ = self.event_tx.send(DiscoveryEvent::ScanComplete {
            total_found: total,
            total_identified: total,
        });

        info!(total = total, "Discovery scan complete");
        all_devices
    }

    /// Attempt to identify a raw discovered device using the appropriate connector.
    async fn identify_device(
        &self,
        raw: &DiscoveredDevice,
    ) -> Result<Device, String> {
        // Build a connection config from discovery data
        let config = crate::connectors::traits::ConnectionConfig {
            address: raw.ip_address.clone(),
            port: None,
            username: None,
            password: None,
            timeout_ms: 5000,
            extra: raw.raw_data.clone(),
        };

        // Try to identify with the connector that discovered it
        // In a full implementation, we'd try multiple connectors
        // For now, create a basic device from discovery data
        let mut device = Device::new(
            raw.discovery_method.as_str(),
            raw.vendor_hint.as_deref().unwrap_or("Unknown"),
            raw.model_hint.as_deref().unwrap_or("Unknown"),
            crate::models::device::DeviceType::Unknown,
        );

        device.ip_addresses.push(raw.ip_address.clone());
        if let Some(ref mac) = raw.mac_address {
            device.mac_addresses.push(mac.clone());
        }
        if let Some(ref hostname) = raw.hostname {
            device.hostname = Some(hostname.clone());
        }
        device.status = crate::models::device::DeviceStatus::Online;

        Ok(device)
    }

    /// Re-scan the network and detect changes since the last scan.
    pub async fn delta_scan(
        &self,
        config: &ScanConfig,
        known_devices: &[Device],
    ) -> DeltaScanResult {
        let current = self.scan(config).await;

        let known_ips: std::collections::HashSet<_> = known_devices
            .iter()
            .flat_map(|d| d.ip_addresses.iter().cloned())
            .collect();

        let current_ips: std::collections::HashSet<_> = current
            .iter()
            .flat_map(|d| d.ip_addresses.iter().cloned())
            .collect();

        let new_devices: Vec<_> = current
            .iter()
            .filter(|d| d.ip_addresses.iter().any(|ip| !known_ips.contains(ip)))
            .cloned()
            .collect();

        let missing_ips: Vec<_> = known_ips
            .difference(&current_ips)
            .cloned()
            .collect();

        DeltaScanResult {
            all_devices: current,
            new_devices,
            missing_ips,
        }
    }
}

/// Result of a delta scan comparing current state to known state.
#[derive(Debug)]
pub struct DeltaScanResult {
    pub all_devices: Vec<Device>,
    pub new_devices: Vec<Device>,
    pub missing_ips: Vec<String>,
}
