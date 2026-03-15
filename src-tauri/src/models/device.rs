// SignalGraph — Core Device Data Model
// This defines the normalized representation of any AV device in the system graph.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Unique identifier for all graph entities.
pub type EntityId = Uuid;

/// Top-level device types normalized across vendors.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum DeviceType {
    VideoSwitcher,
    VideoRouter,
    VideoProcessor,
    VideoScaler,
    AudioMixer,
    AudioDsp,
    AudioAmplifier,
    AudioRouter,
    MediaServer,
    RecordPlayback,
    Camera,
    Display,
    LedProcessor,
    LightingConsole,
    LightingNode,
    NetworkSwitch,
    NetworkRouter,
    ControlProcessor,
    ShowController,
    SignalConverter,
    SignalDistributor,
    Multiviewer,
    StreamEncoder,
    StreamDecoder,
    IntercomStation,
    WirelessReceiver,
    PowerDistributor,
    Kvm,
    Unknown,
}

/// Physical or logical location of a device.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Location {
    pub venue: Option<String>,
    pub room: Option<String>,
    pub rack: Option<String>,
    pub rack_unit: Option<u8>,
    pub rack_side: Option<RackSide>,
    pub shelf: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RackSide {
    Front,
    Rear,
}

/// Online/reachability status.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeviceStatus {
    Online,
    Offline,
    Error,
    Unknown,
}

/// The normalized representation of any AV device.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Device {
    pub id: EntityId,
    pub connector_id: String,
    pub vendor: String,
    pub model: String,
    pub firmware_version: Option<String>,
    pub serial_number: Option<String>,
    pub hostname: Option<String>,
    pub ip_addresses: Vec<String>,
    pub mac_addresses: Vec<String>,
    pub device_type: DeviceType,
    pub location: Location,
    pub labels: Vec<String>,
    pub capabilities: Vec<String>,
    pub status: DeviceStatus,
    pub last_seen: i64, // Unix timestamp
    pub discovered_at: i64,
    pub metadata: HashMap<String, serde_json::Value>,
}

impl Device {
    pub fn new(
        connector_id: &str,
        vendor: &str,
        model: &str,
        device_type: DeviceType,
    ) -> Self {
        let now = chrono::Utc::now().timestamp();
        Self {
            id: Uuid::new_v4(),
            connector_id: connector_id.to_string(),
            vendor: vendor.to_string(),
            model: model.to_string(),
            firmware_version: None,
            serial_number: None,
            hostname: None,
            ip_addresses: Vec::new(),
            mac_addresses: Vec::new(),
            device_type,
            location: Location::default(),
            labels: Vec::new(),
            capabilities: Vec::new(),
            status: DeviceStatus::Unknown,
            last_seen: now,
            discovered_at: now,
            metadata: HashMap::new(),
        }
    }

    pub fn display_name(&self) -> String {
        if let Some(ref hostname) = self.hostname {
            hostname.clone()
        } else if let Some(first_label) = self.labels.first() {
            first_label.clone()
        } else {
            format!("{} {}", self.vendor, self.model)
        }
    }
}
