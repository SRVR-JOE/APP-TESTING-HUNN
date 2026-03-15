// SignalGraph — Signal, Port, Route, and SignalChain models
// These define the edges and paths in the AV system graph.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use super::device::EntityId;
use uuid::Uuid;

/// Direction of a port on a device.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PortDirection {
    Input,
    Output,
    Bidirectional,
}

/// Physical or logical port type.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PortType {
    Hdmi,
    Sdi,
    Sdi12g,
    DisplayPort,
    Dvi,
    Vga,
    HdBaseT,
    Fiber,
    Xlr,
    Trs,
    Rca,
    Aes3,
    Madi,
    DanteAudio,
    Aes67,
    Ethernet,
    Sfp,
    SfpPlus,
    Qsfp,
    Usb,
    Rs232,
    Rs422,
    Rs485,
    Gpio,
    Dmx,
    Ndi,
    Srt,
    Rtmp,
    St2110,
    Nmos,
    Custom(String),
}

/// The type of signal carried.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SignalType {
    Video,
    Audio,
    Data,
    Control,
    Mixed,
}

/// Status of a port.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PortStatus {
    Active,
    Inactive,
    Error,
    NoSignal,
    Unknown,
}

/// Signal format description.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SignalFormat {
    pub resolution: Option<String>,
    pub frame_rate: Option<f32>,
    pub color_space: Option<String>,
    pub bit_depth: Option<u8>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u8>,
    pub codec: Option<String>,
    pub bandwidth_mbps: Option<f32>,
}

/// A physical or logical port on a device.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Port {
    pub id: EntityId,
    pub device_id: EntityId,
    pub direction: PortDirection,
    pub port_index: u16,
    pub port_type: PortType,
    pub signal_type: SignalType,
    pub label: Option<String>,
    pub status: PortStatus,
    pub current_format: Option<SignalFormat>,
    pub connected_to: Option<EntityId>,
    pub capabilities: HashMap<String, serde_json::Value>,
}

impl Port {
    pub fn new(
        device_id: EntityId,
        direction: PortDirection,
        port_index: u16,
        port_type: PortType,
        signal_type: SignalType,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            device_id,
            direction,
            port_index,
            port_type,
            signal_type,
            label: None,
            status: PortStatus::Unknown,
            current_format: None,
            connected_to: None,
            capabilities: HashMap::new(),
        }
    }

    pub fn display_label(&self) -> String {
        if let Some(ref label) = self.label {
            label.clone()
        } else {
            let dir = match self.direction {
                PortDirection::Input => "IN",
                PortDirection::Output => "OUT",
                PortDirection::Bidirectional => "IO",
            };
            format!("{}{:02}", dir, self.port_index)
        }
    }
}

/// The medium through which a signal travels.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RouteMedium {
    Cable,
    Network,
    Internal,
    Wireless,
}

/// Quality assessment of a route.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RouteQuality {
    Good,
    Degraded,
    Error,
    Unknown,
}

/// A single signal route (edge in the graph) between two ports/endpoints.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Route {
    pub id: EntityId,
    pub source_port_id: EntityId,
    pub dest_port_id: EntityId,
    pub signal_type: SignalType,
    pub active: bool,
    pub medium: RouteMedium,
    pub cable_id: Option<String>,
    pub latency_ms: Option<f32>,
    pub quality: RouteQuality,
    pub created_at: i64,
    pub last_verified: i64,
}

/// Status of a complete signal chain.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ChainStatus {
    Healthy,
    Degraded,
    Broken,
    Unknown,
}

/// A complete signal chain from source device to destination device.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalChain {
    pub id: EntityId,
    pub name: String,
    pub route_ids: Vec<EntityId>,
    pub source_device_id: EntityId,
    pub dest_device_id: EntityId,
    pub signal_type: SignalType,
    pub status: ChainStatus,
    pub break_point: Option<EntityId>,
    pub total_latency_ms: Option<f32>,
}
