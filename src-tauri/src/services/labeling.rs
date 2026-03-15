// SignalGraph — Labeling Engine (LabelForge)
// Auto-generates labels for devices, ports, cables, and racks from topology data.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::models::device::{Device, DeviceType, EntityId};
use crate::models::signal::{Port, PortDirection, Route};
use crate::services::graph::GraphNode;

/// A naming convention that defines how labels are generated.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NamingConvention {
    pub name: String,
    pub device_pattern: String,
    pub port_pattern: String,
    pub cable_pattern: String,
    pub location_codes: HashMap<String, String>,
    pub device_type_codes: HashMap<String, String>,
}

impl Default for NamingConvention {
    fn default() -> Self {
        let mut location_codes = HashMap::new();
        location_codes.insert("front_of_house".into(), "FOH".into());
        location_codes.insert("stage".into(), "STG".into());
        location_codes.insert("monitor_world".into(), "MON".into());
        location_codes.insert("broadcast".into(), "BC".into());
        location_codes.insert("rack_room".into(), "RKR".into());

        let mut device_type_codes = HashMap::new();
        device_type_codes.insert("video_switcher".into(), "SW".into());
        device_type_codes.insert("video_router".into(), "RTR".into());
        device_type_codes.insert("camera".into(), "CAM".into());
        device_type_codes.insert("signal_converter".into(), "CVT".into());
        device_type_codes.insert("media_server".into(), "MS".into());
        device_type_codes.insert("audio_mixer".into(), "MIX".into());
        device_type_codes.insert("audio_dsp".into(), "DSP".into());
        device_type_codes.insert("display".into(), "DISP".into());
        device_type_codes.insert("led_processor".into(), "LED".into());
        device_type_codes.insert("network_switch".into(), "NET".into());
        device_type_codes.insert("multiviewer".into(), "MV".into());
        device_type_codes.insert("record_playback".into(), "REC".into());
        device_type_codes.insert("unknown".into(), "DEV".into());

        Self {
            name: "Standard".into(),
            device_pattern: "{location}-{type}-{seq:02}".into(),
            port_pattern: "{device}.{dir}{num:02}".into(),
            cable_pattern: "{signal}-{seq:03}".into(),
            location_codes,
            device_type_codes,
        }
    }
}

/// A generated label with metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedLabel {
    pub entity_id: EntityId,
    pub entity_type: LabelEntityType,
    pub label: String,
    pub previous_label: Option<String>,
    pub auto_generated: bool,
    pub needs_review: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LabelEntityType {
    Device,
    Port,
    Cable,
    Rack,
    Endpoint,
}

/// The labeling engine that generates consistent labels from topology data.
pub struct LabelingEngine {
    convention: NamingConvention,
    sequence_counters: HashMap<String, u16>,
}

impl LabelingEngine {
    pub fn new(convention: NamingConvention) -> Self {
        Self {
            convention,
            sequence_counters: HashMap::new(),
        }
    }

    /// Generate labels for all devices in the topology.
    pub fn generate_device_labels(&mut self, nodes: &[GraphNode]) -> Vec<GeneratedLabel> {
        // Reset counters for a fresh generation
        self.sequence_counters.clear();

        let mut labels = Vec::new();

        for node in nodes {
            let label = self.generate_device_label(&node.device);
            labels.push(GeneratedLabel {
                entity_id: node.device.id,
                entity_type: LabelEntityType::Device,
                label,
                previous_label: node.device.labels.first().cloned(),
                auto_generated: true,
                needs_review: false,
            });
        }

        labels
    }

    /// Generate a label for a single device.
    fn generate_device_label(&mut self, device: &Device) -> String {
        let location_code = self.get_location_code(device);
        let type_code = self.get_device_type_code(&device.device_type);
        let seq_key = format!("{}_{}", location_code, type_code);
        let seq = self.next_sequence(&seq_key);

        format!("{}-{}-{:02}", location_code, type_code, seq)
    }

    /// Generate labels for all ports on a device.
    pub fn generate_port_labels(
        &self,
        device_label: &str,
        ports: &[Port],
    ) -> Vec<GeneratedLabel> {
        ports
            .iter()
            .map(|port| {
                let dir = match port.direction {
                    PortDirection::Input => "IN",
                    PortDirection::Output => "OUT",
                    PortDirection::Bidirectional => "IO",
                };
                let label = format!("{}.{}{:02}", device_label, dir, port.port_index);

                GeneratedLabel {
                    entity_id: port.id,
                    entity_type: LabelEntityType::Port,
                    label,
                    previous_label: port.label.clone(),
                    auto_generated: true,
                    needs_review: false,
                }
            })
            .collect()
    }

    /// Generate cable labels from route data.
    pub fn generate_cable_labels(
        &mut self,
        routes: &[Route],
        port_labels: &HashMap<EntityId, String>,
    ) -> Vec<GeneratedLabel> {
        routes
            .iter()
            .filter_map(|route| {
                let src_label = port_labels.get(&route.source_port_id)?;
                let dst_label = port_labels.get(&route.dest_port_id)?;
                let signal_code = match route.signal_type {
                    crate::models::signal::SignalType::Video => "VID",
                    crate::models::signal::SignalType::Audio => "AUD",
                    crate::models::signal::SignalType::Data => "DAT",
                    crate::models::signal::SignalType::Control => "CTL",
                    crate::models::signal::SignalType::Mixed => "MIX",
                };
                let seq = self.next_sequence(&format!("cable_{}", signal_code));
                let cable_label = format!("{}-{:03}", signal_code, seq);
                let full_label = format!("{} ({} → {})", cable_label, src_label, dst_label);

                Some(GeneratedLabel {
                    entity_id: route.id,
                    entity_type: LabelEntityType::Cable,
                    label: full_label,
                    previous_label: route.cable_id.clone(),
                    auto_generated: true,
                    needs_review: false,
                })
            })
            .collect()
    }

    /// Get the location code for a device based on its location data.
    fn get_location_code(&self, device: &Device) -> String {
        if let Some(ref rack) = device.location.rack {
            if let Some(num) = rack.chars().filter(|c| c.is_ascii_digit()).collect::<String>().parse::<u8>().ok() {
                return format!("RK{}", num);
            }
            return rack.to_uppercase();
        }
        if let Some(ref room) = device.location.room {
            if let Some(code) = self.convention.location_codes.get(&room.to_lowercase()) {
                return code.clone();
            }
            // Use first 3 characters uppercase as fallback
            return room.chars().take(3).collect::<String>().to_uppercase();
        }
        "LOC".into()
    }

    /// Get the type code for a device type.
    fn get_device_type_code(&self, device_type: &DeviceType) -> String {
        let type_key = format!("{:?}", device_type).to_lowercase();
        self.convention
            .device_type_codes
            .get(&type_key)
            .cloned()
            .unwrap_or_else(|| "DEV".into())
    }

    /// Get the next sequence number for a given key.
    fn next_sequence(&mut self, key: &str) -> u16 {
        let counter = self.sequence_counters.entry(key.to_string()).or_insert(0);
        *counter += 1;
        *counter
    }

    /// Check if any labels have drifted from their auto-generated values
    /// (e.g., after a topology change).
    pub fn detect_label_drift(
        &mut self,
        current_nodes: &[GraphNode],
    ) -> Vec<GeneratedLabel> {
        let expected = self.generate_device_labels(current_nodes);
        expected
            .into_iter()
            .filter(|label| {
                label.previous_label.as_ref() != Some(&label.label)
                    && label.previous_label.is_some()
            })
            .map(|mut label| {
                label.needs_review = true;
                label
            })
            .collect()
    }
}
