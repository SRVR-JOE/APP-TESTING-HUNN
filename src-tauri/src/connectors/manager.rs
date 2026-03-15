// SignalGraph — Connector Manager
// Manages the lifecycle of all registered connectors and dispatches operations.

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use super::traits::{
    Connector, ConnectorCapability, ConnectorResult, ConnectionConfig,
    DeviceCommand, CommandResult, DiscoveredDevice,
};
use crate::models::device::{Device, DeviceStatus, EntityId};
use crate::models::signal::{Port, Route};

/// Manages all registered connectors and provides a unified interface.
pub struct ConnectorManager {
    connectors: RwLock<HashMap<String, Arc<dyn Connector>>>,
    device_connector_map: RwLock<HashMap<EntityId, String>>,
}

impl ConnectorManager {
    pub fn new() -> Self {
        Self {
            connectors: RwLock::new(HashMap::new()),
            device_connector_map: RwLock::new(HashMap::new()),
        }
    }

    /// Register a new connector.
    pub async fn register(&self, connector: Arc<dyn Connector>) {
        let manifest = connector.manifest();
        let id = manifest.id.clone();
        self.connectors.write().await.insert(id, connector);
    }

    /// Get a list of all registered connector IDs.
    pub async fn list_connectors(&self) -> Vec<String> {
        self.connectors.read().await.keys().cloned().collect()
    }

    /// Run discovery across all connectors that support it.
    pub async fn discover_all(&self, network: &str) -> Vec<DiscoveredDevice> {
        let connectors = self.connectors.read().await;
        let mut all_discovered = Vec::new();

        // Run all discovery-capable connectors in parallel
        let mut handles = Vec::new();
        for (id, connector) in connectors.iter() {
            if connector.supports(&ConnectorCapability::Discovery) {
                let connector = Arc::clone(connector);
                let network = network.to_string();
                let connector_id = id.clone();
                handles.push(tokio::spawn(async move {
                    match connector.discover(&network).await {
                        Ok(devices) => {
                            tracing::info!(
                                connector = %connector_id,
                                count = devices.len(),
                                "Discovery completed"
                            );
                            devices
                        }
                        Err(e) => {
                            tracing::warn!(
                                connector = %connector_id,
                                error = %e,
                                "Discovery failed"
                            );
                            Vec::new()
                        }
                    }
                }));
            }
        }

        for handle in handles {
            if let Ok(devices) = handle.await {
                all_discovered.extend(devices);
            }
        }

        // Deduplicate by IP address
        all_discovered.sort_by(|a, b| a.ip_address.cmp(&b.ip_address));
        all_discovered.dedup_by(|a, b| a.ip_address == b.ip_address);

        all_discovered
    }

    /// Associate a device with a connector for future operations.
    pub async fn bind_device(&self, device_id: EntityId, connector_id: &str) {
        self.device_connector_map
            .write()
            .await
            .insert(device_id, connector_id.to_string());
    }

    /// Get the status of a device through its associated connector.
    pub async fn get_device_status(
        &self,
        device_id: EntityId,
        config: &ConnectionConfig,
    ) -> ConnectorResult<DeviceStatus> {
        let connector = self.get_connector_for_device(device_id).await?;
        connector.get_status(config).await
    }

    /// Get ports for a device through its associated connector.
    pub async fn get_device_ports(
        &self,
        device_id: EntityId,
        config: &ConnectionConfig,
    ) -> ConnectorResult<Vec<Port>> {
        let connector = self.get_connector_for_device(device_id).await?;
        connector.get_ports(config).await
    }

    /// Get routing for a device through its associated connector.
    pub async fn get_device_routing(
        &self,
        device_id: EntityId,
        config: &ConnectionConfig,
    ) -> ConnectorResult<Vec<Route>> {
        let connector = self.get_connector_for_device(device_id).await?;
        connector.get_routing(config).await
    }

    /// Execute a command on a device (with validation first).
    pub async fn execute_command(
        &self,
        device_id: EntityId,
        config: &ConnectionConfig,
        command: &DeviceCommand,
    ) -> ConnectorResult<CommandResult> {
        let connector = self.get_connector_for_device(device_id).await?;

        // Validate first
        if connector.supports(&ConnectorCapability::ValidateCommand) {
            let valid = connector.validate_command(config, command).await?;
            if !valid {
                return Err(super::traits::ConnectorError::CommandRejected(
                    "Command validation failed".to_string(),
                ));
            }
        }

        // Execute based on action type
        match command.action.as_str() {
            "set_routing" => connector.set_routing(config, command).await,
            "set_config" => connector.set_config(config, command).await,
            _ => Err(super::traits::ConnectorError::NotSupported(
                format!("Unknown action: {}", command.action),
            )),
        }
    }

    /// Run health check on a device.
    pub async fn health_check(
        &self,
        device_id: EntityId,
        config: &ConnectionConfig,
    ) -> ConnectorResult<bool> {
        let connector = self.get_connector_for_device(device_id).await?;
        connector.health_check(config).await
    }

    /// Internal: find the connector associated with a device.
    async fn get_connector_for_device(
        &self,
        device_id: EntityId,
    ) -> ConnectorResult<Arc<dyn Connector>> {
        let map = self.device_connector_map.read().await;
        let connector_id = map.get(&device_id).ok_or_else(|| {
            super::traits::ConnectorError::Internal(
                format!("No connector bound for device {}", device_id),
            )
        })?;

        let connectors = self.connectors.read().await;
        connectors.get(connector_id).cloned().ok_or_else(|| {
            super::traits::ConnectorError::Internal(
                format!("Connector '{}' not found", connector_id),
            )
        })
    }
}
