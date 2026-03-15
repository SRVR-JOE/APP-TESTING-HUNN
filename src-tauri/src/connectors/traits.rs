// SignalGraph — Connector Trait Interface
// Every vendor/protocol connector implements this trait to integrate with the system.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::models::device::{Device, DeviceStatus, EntityId};
use crate::models::signal::{Port, Route, SignalFormat};

/// Result type for connector operations.
pub type ConnectorResult<T> = Result<T, ConnectorError>;

/// Errors that connectors can produce.
#[derive(Debug, thiserror::Error)]
pub enum ConnectorError {
    #[error("Device not reachable: {0}")]
    Unreachable(String),

    #[error("Authentication failed: {0}")]
    AuthFailed(String),

    #[error("Command rejected by device: {0}")]
    CommandRejected(String),

    #[error("Timeout after {0}ms")]
    Timeout(u64),

    #[error("Protocol error: {0}")]
    Protocol(String),

    #[error("Capability not supported: {0}")]
    NotSupported(String),

    #[error("Internal connector error: {0}")]
    Internal(String),
}

/// Safety classification for connector actions.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SafetyLevel {
    ReadOnly,
    ConfigChange,
    CriticalChange,
    BulkChange,
}

/// What a connector is capable of doing.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum ConnectorCapability {
    Discovery,
    Identify,
    GetPorts,
    GetStatus,
    GetConfig,
    GetRouting,
    SetRouting,
    SetConfig,
    SubscribeEvents,
    ValidateCommand,
    RollbackCommand,
    HealthCheck,
}

/// Metadata about a discovered device before full identification.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredDevice {
    pub ip_address: String,
    pub mac_address: Option<String>,
    pub hostname: Option<String>,
    pub vendor_hint: Option<String>,
    pub model_hint: Option<String>,
    pub discovery_method: String,
    pub raw_data: HashMap<String, serde_json::Value>,
}

/// A command to send to a device, with safety metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCommand {
    pub device_id: EntityId,
    pub action: String,
    pub parameters: HashMap<String, serde_json::Value>,
    pub safety_level: SafetyLevel,
    pub description: String,
    pub rollback_command: Option<Box<DeviceCommand>>,
}

/// The result of executing a command on a device.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResult {
    pub success: bool,
    pub message: String,
    pub new_state: Option<serde_json::Value>,
    pub rollback_data: Option<serde_json::Value>,
}

/// Configuration for connecting to a device.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub address: String,
    pub port: Option<u16>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub timeout_ms: u64,
    pub extra: HashMap<String, serde_json::Value>,
}

/// Manifest describing a connector's capabilities and compatibility.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub supported_vendors: Vec<String>,
    pub supported_models: Vec<String>,
    pub capabilities: Vec<ConnectorCapability>,
    pub protocol: String,
    pub default_port: Option<u16>,
    pub discovery_method: Option<String>,
}

/// The core connector trait. All vendor/protocol connectors implement this.
#[async_trait]
pub trait Connector: Send + Sync {
    /// Returns the connector manifest describing its capabilities.
    fn manifest(&self) -> &ConnectorManifest;

    /// Discover devices of this connector's type on the network.
    async fn discover(&self, network: &str) -> ConnectorResult<Vec<DiscoveredDevice>>;

    /// Fully identify a discovered device (vendor, model, firmware, serial, etc.).
    async fn identify(&self, config: &ConnectionConfig) -> ConnectorResult<Device>;

    /// Enumerate all I/O ports on a device.
    async fn get_ports(&self, config: &ConnectionConfig) -> ConnectorResult<Vec<Port>>;

    /// Get current device status (health, errors, temperature, uptime).
    async fn get_status(&self, config: &ConnectionConfig) -> ConnectorResult<DeviceStatus>;

    /// Get the full running configuration of a device.
    async fn get_config(
        &self,
        config: &ConnectionConfig,
    ) -> ConnectorResult<HashMap<String, serde_json::Value>>;

    /// Get current signal routing state (which inputs map to which outputs).
    async fn get_routing(&self, config: &ConnectionConfig) -> ConnectorResult<Vec<Route>>;

    /// Change a signal route on the device.
    async fn set_routing(
        &self,
        config: &ConnectionConfig,
        command: &DeviceCommand,
    ) -> ConnectorResult<CommandResult>;

    /// Apply a configuration change to the device.
    async fn set_config(
        &self,
        config: &ConnectionConfig,
        command: &DeviceCommand,
    ) -> ConnectorResult<CommandResult>;

    /// Validate a command before execution (dry-run check).
    async fn validate_command(
        &self,
        config: &ConnectionConfig,
        command: &DeviceCommand,
    ) -> ConnectorResult<bool>;

    /// Check if the device is reachable and responsive.
    async fn health_check(&self, config: &ConnectionConfig) -> ConnectorResult<bool>;

    /// Get the capabilities this connector supports.
    fn capabilities(&self) -> &[ConnectorCapability] {
        &self.manifest().capabilities
    }

    /// Check if a specific capability is supported.
    fn supports(&self, cap: &ConnectorCapability) -> bool {
        self.manifest().capabilities.contains(cap)
    }
}
