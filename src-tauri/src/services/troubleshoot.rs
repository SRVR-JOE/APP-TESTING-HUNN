// SignalGraph — Troubleshooting Engine (DiagnosticCore)
// Traces signal paths, ranks root causes, and recommends fixes.

use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::connectors::manager::ConnectorManager;
use crate::connectors::traits::ConnectionConfig;
use crate::models::device::{DeviceStatus, EntityId};
use crate::models::signal::{Port, PortStatus, Route};
use crate::services::graph::TopologyGraph;

/// A diagnosis produced by the troubleshooting engine.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnosis {
    pub issue: String,
    pub signal_chain: Vec<HopStatus>,
    pub break_point: Option<BreakPoint>,
    pub probable_causes: Vec<ProbableCause>,
    pub recommended_actions: Vec<RecommendedAction>,
    pub confidence: f32,
    pub evidence: Vec<String>,
}

/// Status of one hop in a signal chain during diagnosis.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HopStatus {
    pub device_id: EntityId,
    pub device_name: String,
    pub port_id: EntityId,
    pub port_label: String,
    pub status: PortStatus,
    pub signal_present: bool,
    pub format: Option<String>,
    pub errors: Vec<String>,
}

/// Where the signal breaks in the chain.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BreakPoint {
    pub between_device_a: EntityId,
    pub between_device_b: EntityId,
    pub port_a: EntityId,
    pub port_b: EntityId,
    pub description: String,
}

/// A ranked probable cause with confidence score.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProbableCause {
    pub rank: u8,
    pub description: String,
    pub probability: f32,
    pub evidence: Vec<String>,
    pub category: CauseCategory,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CauseCategory {
    Physical,       // Cable, connector, port hardware
    Configuration,  // Wrong routing, format mismatch, EDID
    Network,        // VLAN, IP, bandwidth, switch port
    Device,         // Device failure, firmware bug
    Power,          // Power supply, UPS
    External,       // User error, environmental
}

/// A recommended action to resolve the issue.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendedAction {
    pub rank: u8,
    pub description: String,
    pub action_type: ActionType,
    pub requires_approval: bool,
    pub estimated_downtime: Option<String>,
    pub rollback_available: bool,
    pub commands: Vec<ActionCommand>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActionType {
    Physical,     // Check/replace cable, reseat connector
    Software,     // Change routing, update config
    Restart,      // Power cycle device
    Escalation,   // Contact vendor support
    Workaround,   // Temporary fix using alternate path
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionCommand {
    pub device_id: EntityId,
    pub command: String,
    pub parameters: serde_json::Value,
    pub safety_level: crate::connectors::traits::SafetyLevel,
}

/// The troubleshooting engine.
pub struct TroubleshootEngine {
    graph: Arc<TopologyGraph>,
    connector_manager: Arc<ConnectorManager>,
}

impl TroubleshootEngine {
    pub fn new(
        graph: Arc<TopologyGraph>,
        connector_manager: Arc<ConnectorManager>,
    ) -> Self {
        Self {
            graph,
            connector_manager,
        }
    }

    /// Diagnose a signal-loss issue on a specific device/port.
    pub async fn diagnose_signal_loss(
        &self,
        dest_device_id: EntityId,
        dest_port_id: Option<EntityId>,
    ) -> Result<Diagnosis, String> {
        // Step 1: Get the device and affected port
        let dest_node = self
            .graph
            .get_device(dest_device_id)
            .await
            .ok_or("Device not found in graph")?;

        let affected_port = if let Some(port_id) = dest_port_id {
            dest_node
                .ports
                .iter()
                .find(|p| p.id == port_id)
                .ok_or("Port not found on device")?
                .clone()
        } else {
            // Find the first input port with no signal
            dest_node
                .ports
                .iter()
                .find(|p| p.status == PortStatus::NoSignal)
                .ok_or("No port with signal loss found")?
                .clone()
        };

        // Step 2: Trace backward from the affected port
        let paths = self
            .graph
            .trace_backward(affected_port.id, 20)
            .await;

        if paths.is_empty() {
            return Ok(Diagnosis {
                issue: format!(
                    "No signal on {} port {}",
                    dest_node.device.display_name(),
                    affected_port.display_label()
                ),
                signal_chain: Vec::new(),
                break_point: None,
                probable_causes: vec![ProbableCause {
                    rank: 1,
                    description: "No signal path found to this port. It may not be patched."
                        .into(),
                    probability: 0.9,
                    evidence: vec!["No routes exist to this port in the topology graph".into()],
                    category: CauseCategory::Configuration,
                }],
                recommended_actions: vec![RecommendedAction {
                    rank: 1,
                    description: "Check that a source is patched to this input".into(),
                    action_type: ActionType::Physical,
                    requires_approval: false,
                    estimated_downtime: None,
                    rollback_available: false,
                    commands: Vec::new(),
                }],
                confidence: 0.9,
                evidence: vec!["Graph trace found no incoming routes".into()],
            });
        }

        // Step 3: For each device in the path, query live status
        let path = &paths[0]; // Take the primary path
        let mut hop_statuses = Vec::new();

        for route in path {
            // Query source port status
            let src_device = self.find_device_for_port(route.source_port_id).await;
            if let Some((device, port)) = src_device {
                hop_statuses.push(HopStatus {
                    device_id: device.id,
                    device_name: device.display_name(),
                    port_id: port.id,
                    port_label: port.display_label(),
                    status: port.status.clone(),
                    signal_present: port.status == PortStatus::Active,
                    format: port.current_format.as_ref().map(|f| {
                        format!(
                            "{}@{}",
                            f.resolution.as_deref().unwrap_or("?"),
                            f.frame_rate.unwrap_or(0.0)
                        )
                    }),
                    errors: Vec::new(),
                });
            }
        }

        // Add the final destination
        hop_statuses.push(HopStatus {
            device_id: dest_node.device.id,
            device_name: dest_node.device.display_name(),
            port_id: affected_port.id,
            port_label: affected_port.display_label(),
            status: affected_port.status.clone(),
            signal_present: false,
            format: None,
            errors: vec!["No signal detected".into()],
        });

        // Step 4: Find the break point
        let break_point = self.find_break_point(&hop_statuses);

        // Step 5: Rank probable causes
        let probable_causes = self.rank_causes(&hop_statuses, &break_point);

        // Step 6: Generate recommended actions
        let recommended_actions = self.generate_recommendations(&probable_causes, &break_point);

        // Step 7: Calculate confidence
        let confidence = self.calculate_confidence(&hop_statuses, &probable_causes);

        Ok(Diagnosis {
            issue: format!(
                "Signal loss on {} port {}",
                dest_node.device.display_name(),
                affected_port.display_label()
            ),
            signal_chain: hop_statuses,
            break_point,
            probable_causes,
            recommended_actions,
            confidence,
            evidence: vec![
                format!("Traced {} hops in signal path", path.len()),
                "Queried device status at each hop".into(),
            ],
        })
    }

    /// Find where the signal breaks in the chain.
    fn find_break_point(&self, hops: &[HopStatus]) -> Option<BreakPoint> {
        for i in 0..hops.len() - 1 {
            if hops[i].signal_present && !hops[i + 1].signal_present {
                return Some(BreakPoint {
                    between_device_a: hops[i].device_id,
                    between_device_b: hops[i + 1].device_id,
                    port_a: hops[i].port_id,
                    port_b: hops[i + 1].port_id,
                    description: format!(
                        "Signal present at {} ({}) but absent at {} ({})",
                        hops[i].device_name,
                        hops[i].port_label,
                        hops[i + 1].device_name,
                        hops[i + 1].port_label,
                    ),
                });
            }
        }
        None
    }

    /// Rank probable causes based on the failure pattern.
    fn rank_causes(
        &self,
        hops: &[HopStatus],
        break_point: &Option<BreakPoint>,
    ) -> Vec<ProbableCause> {
        let mut causes = Vec::new();

        if let Some(ref bp) = break_point {
            // Physical connection issues are most common
            causes.push(ProbableCause {
                rank: 1,
                description: format!(
                    "Cable disconnected or faulty between {} and {}",
                    bp.between_device_a, bp.between_device_b
                ),
                probability: 0.45,
                evidence: vec![
                    "Signal present at source, absent at destination".into(),
                    "Most common cause of single-point signal loss".into(),
                ],
                category: CauseCategory::Physical,
            });

            causes.push(ProbableCause {
                rank: 2,
                description: "Cable fault or damage".into(),
                probability: 0.25,
                evidence: vec![
                    "Same symptom pattern as loose cable".into(),
                ],
                category: CauseCategory::Physical,
            });

            causes.push(ProbableCause {
                rank: 3,
                description: "EDID/format negotiation failure".into(),
                probability: 0.15,
                evidence: vec![
                    "Common with HDMI connections between different vendors".into(),
                ],
                category: CauseCategory::Configuration,
            });

            causes.push(ProbableCause {
                rank: 4,
                description: "Input port hardware failure".into(),
                probability: 0.10,
                evidence: vec![
                    "Less common but possible".into(),
                ],
                category: CauseCategory::Device,
            });
        } else {
            causes.push(ProbableCause {
                rank: 1,
                description: "No signal path configured to this destination".into(),
                probability: 0.7,
                evidence: vec![
                    "Could not find a break point — entire chain may be misconfigured".into(),
                ],
                category: CauseCategory::Configuration,
            });
        }

        causes
    }

    /// Generate recommended actions from the causes.
    fn generate_recommendations(
        &self,
        causes: &[ProbableCause],
        break_point: &Option<BreakPoint>,
    ) -> Vec<RecommendedAction> {
        let mut actions = Vec::new();

        if let Some(ref bp) = break_point {
            actions.push(RecommendedAction {
                rank: 1,
                description: format!(
                    "Check physical cable connection at the destination device"
                ),
                action_type: ActionType::Physical,
                requires_approval: false,
                estimated_downtime: None,
                rollback_available: false,
                commands: Vec::new(),
            });

            actions.push(RecommendedAction {
                rank: 2,
                description: "Try an alternate cable".into(),
                action_type: ActionType::Physical,
                requires_approval: false,
                estimated_downtime: Some("5-10 seconds".into()),
                rollback_available: false,
                commands: Vec::new(),
            });
        }

        actions
    }

    /// Calculate overall confidence in the diagnosis.
    fn calculate_confidence(
        &self,
        hops: &[HopStatus],
        causes: &[ProbableCause],
    ) -> f32 {
        let mut confidence: f32 = 0.5; // Base confidence

        // More hops queried = more data = higher confidence
        let queried_hops = hops.iter().filter(|h| h.status != PortStatus::Unknown).count();
        confidence += (queried_hops as f32 / hops.len().max(1) as f32) * 0.3;

        // Clear break point = higher confidence
        if !causes.is_empty() && causes[0].probability > 0.4 {
            confidence += 0.15;
        }

        confidence.min(0.99)
    }

    /// Helper: find a device and port by port ID.
    async fn find_device_for_port(
        &self,
        port_id: EntityId,
    ) -> Option<(crate::models::device::Device, Port)> {
        let devices = self.graph.all_devices().await;
        for node in devices {
            if let Some(port) = node.ports.iter().find(|p| p.id == port_id) {
                return Some((node.device.clone(), port.clone()));
            }
        }
        None
    }
}
