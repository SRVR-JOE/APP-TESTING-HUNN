// SignalGraph — AI Action Executor (CoPilot Engine)
// Translates natural-language queries into tool calls, executes them safely,
// and returns structured results with explanations.

use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::connectors::traits::SafetyLevel;
use crate::models::device::EntityId;
use crate::services::graph::TopologyGraph;
use crate::services::troubleshoot::TroubleshootEngine;

/// A tool that the AI can call.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiTool {
    pub name: String,
    pub description: String,
    pub parameters: Vec<ToolParameter>,
    pub safety_level: SafetyLevel,
    pub requires_approval: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolParameter {
    pub name: String,
    pub param_type: String,
    pub description: String,
    pub required: bool,
}

/// A tool call request from the AI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub tool_name: String,
    pub arguments: serde_json::Value,
    pub reasoning: String,
}

/// The result of a tool call execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallResult {
    pub tool_name: String,
    pub success: bool,
    pub result: serde_json::Value,
    pub explanation: String,
    pub safety_level: SafetyLevel,
    pub approval_required: bool,
    pub rollback_available: bool,
}

/// The intent parsed from a user's natural language query.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedIntent {
    pub intent_type: IntentType,
    pub entities: Vec<ReferencedEntity>,
    pub original_query: String,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IntentType {
    TraceSignal,
    DiagnoseIssue,
    QueryDeviceStatus,
    QuerySystemState,
    ChangeRouting,
    ChangeConfig,
    GenerateLabels,
    GenerateDocumentation,
    CompareSnapshots,
    TakeSnapshot,
    RunPreflight,
    SearchDevices,
    ExplainChange,
    Rollback,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReferencedEntity {
    pub entity_type: String,
    pub name: String,
    pub resolved_id: Option<EntityId>,
}

/// A complete AI response with explanation and actions.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiResponse {
    pub answer: String,
    pub tool_calls: Vec<ToolCallResult>,
    pub confidence: f32,
    pub evidence: Vec<String>,
    pub suggested_followups: Vec<String>,
    pub pending_approval: Option<PendingApproval>,
}

/// An action waiting for user approval.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingApproval {
    pub action_description: String,
    pub impact_description: String,
    pub diff_preview: Option<String>,
    pub safety_level: SafetyLevel,
    pub rollback_description: Option<String>,
    pub tool_call: ToolCall,
}

/// The AI executor that processes queries and orchestrates tool calls.
pub struct AiExecutor {
    graph: Arc<TopologyGraph>,
    troubleshoot: Arc<TroubleshootEngine>,
    available_tools: Vec<AiTool>,
}

impl AiExecutor {
    pub fn new(
        graph: Arc<TopologyGraph>,
        troubleshoot: Arc<TroubleshootEngine>,
    ) -> Self {
        let tools = Self::register_tools();
        Self {
            graph,
            troubleshoot,
            available_tools: tools,
        }
    }

    /// Register all available tools the AI can use.
    fn register_tools() -> Vec<AiTool> {
        vec![
            AiTool {
                name: "graph.trace_path".into(),
                description: "Trace signal path from source to destination device".into(),
                parameters: vec![
                    ToolParameter {
                        name: "source".into(),
                        param_type: "string".into(),
                        description: "Source device name or ID".into(),
                        required: true,
                    },
                    ToolParameter {
                        name: "destination".into(),
                        param_type: "string".into(),
                        description: "Destination device name or ID".into(),
                        required: false,
                    },
                ],
                safety_level: SafetyLevel::ReadOnly,
                requires_approval: false,
            },
            AiTool {
                name: "graph.search_devices".into(),
                description: "Search for devices by name, type, vendor, or location".into(),
                parameters: vec![ToolParameter {
                    name: "query".into(),
                    param_type: "string".into(),
                    description: "Search query".into(),
                    required: true,
                }],
                safety_level: SafetyLevel::ReadOnly,
                requires_approval: false,
            },
            AiTool {
                name: "device.get_status".into(),
                description: "Get live status of a specific device".into(),
                parameters: vec![ToolParameter {
                    name: "device_id".into(),
                    param_type: "string".into(),
                    description: "Device ID or name".into(),
                    required: true,
                }],
                safety_level: SafetyLevel::ReadOnly,
                requires_approval: false,
            },
            AiTool {
                name: "troubleshoot.diagnose".into(),
                description: "Diagnose signal loss or issue on a device".into(),
                parameters: vec![
                    ToolParameter {
                        name: "device".into(),
                        param_type: "string".into(),
                        description: "Affected device name or ID".into(),
                        required: true,
                    },
                    ToolParameter {
                        name: "symptom".into(),
                        param_type: "string".into(),
                        description: "Description of the issue".into(),
                        required: false,
                    },
                ],
                safety_level: SafetyLevel::ReadOnly,
                requires_approval: false,
            },
            AiTool {
                name: "device.set_routing".into(),
                description: "Change signal routing on a device".into(),
                parameters: vec![
                    ToolParameter {
                        name: "device_id".into(),
                        param_type: "string".into(),
                        description: "Target device".into(),
                        required: true,
                    },
                    ToolParameter {
                        name: "input".into(),
                        param_type: "integer".into(),
                        description: "Input port number".into(),
                        required: true,
                    },
                    ToolParameter {
                        name: "output".into(),
                        param_type: "integer".into(),
                        description: "Output port number".into(),
                        required: true,
                    },
                ],
                safety_level: SafetyLevel::CriticalChange,
                requires_approval: true,
            },
            AiTool {
                name: "graph.stats".into(),
                description: "Get summary statistics of the current system".into(),
                parameters: Vec::new(),
                safety_level: SafetyLevel::ReadOnly,
                requires_approval: false,
            },
            AiTool {
                name: "labels.generate".into(),
                description: "Auto-generate labels for devices, ports, and cables".into(),
                parameters: vec![ToolParameter {
                    name: "scope".into(),
                    param_type: "string".into(),
                    description: "Scope: 'all', device name, rack name, etc.".into(),
                    required: false,
                }],
                safety_level: SafetyLevel::ConfigChange,
                requires_approval: false,
            },
        ]
    }

    /// Process a natural language query from the user.
    /// In a full implementation, this would call the local LLM for intent parsing
    /// and then execute the appropriate tool calls.
    pub async fn process_query(&self, query: &str) -> AiResponse {
        // Step 1: Parse intent (simplified — real implementation uses LLM)
        let intent = self.parse_intent(query);

        // Step 2: Execute based on intent
        match intent.intent_type {
            IntentType::QuerySystemState => {
                let stats = self.graph.stats().await;
                AiResponse {
                    answer: format!(
                        "System has {} devices ({} online), {} ports, {} active routes.",
                        stats.total_devices,
                        stats.online_devices,
                        stats.total_ports,
                        stats.total_routes
                    ),
                    tool_calls: vec![ToolCallResult {
                        tool_name: "graph.stats".into(),
                        success: true,
                        result: serde_json::to_value(&stats).unwrap_or_default(),
                        explanation: "Retrieved system statistics from topology graph".into(),
                        safety_level: SafetyLevel::ReadOnly,
                        approval_required: false,
                        rollback_available: false,
                    }],
                    confidence: 0.95,
                    evidence: vec!["Live graph query".into()],
                    suggested_followups: vec![
                        "Show all devices".into(),
                        "Any issues?".into(),
                        "Run preflight check".into(),
                    ],
                    pending_approval: None,
                }
            }
            IntentType::SearchDevices => {
                let results = self.graph.find_device_by_name(query).await;
                let device_list: Vec<String> = results
                    .iter()
                    .map(|n| {
                        format!(
                            "{} ({} {}) - {:?}",
                            n.device.display_name(),
                            n.device.vendor,
                            n.device.model,
                            n.device.status
                        )
                    })
                    .collect();

                AiResponse {
                    answer: if results.is_empty() {
                        format!("No devices found matching '{}'", query)
                    } else {
                        format!("Found {} device(s):\n{}", results.len(), device_list.join("\n"))
                    },
                    tool_calls: Vec::new(),
                    confidence: 0.9,
                    evidence: vec!["Graph search".into()],
                    suggested_followups: Vec::new(),
                    pending_approval: None,
                }
            }
            _ => AiResponse {
                answer: format!(
                    "I understood your query as: {:?}. \
                     Full AI processing requires the local LLM to be loaded. \
                     This is a scaffolding response.",
                    intent.intent_type
                ),
                tool_calls: Vec::new(),
                confidence: 0.5,
                evidence: Vec::new(),
                suggested_followups: vec![
                    "Show system status".into(),
                    "List all devices".into(),
                ],
                pending_approval: None,
            },
        }
    }

    /// Simple keyword-based intent parser.
    /// In production, this would be the local LLM.
    fn parse_intent(&self, query: &str) -> ParsedIntent {
        let q = query.to_lowercase();

        let intent_type = if q.contains("trace") || q.contains("where does") || q.contains("path") {
            IntentType::TraceSignal
        } else if q.contains("why") || q.contains("black") || q.contains("no signal")
            || q.contains("broken") || q.contains("troubleshoot") || q.contains("diagnose")
        {
            IntentType::DiagnoseIssue
        } else if q.contains("status") || q.contains("how is") || q.contains("health") {
            IntentType::QueryDeviceStatus
        } else if q.contains("how many") || q.contains("summary") || q.contains("overview")
            || q.contains("system")
        {
            IntentType::QuerySystemState
        } else if q.contains("route") || q.contains("switch") || q.contains("send") {
            IntentType::ChangeRouting
        } else if q.contains("label") || q.contains("name") {
            IntentType::GenerateLabels
        } else if q.contains("document") || q.contains("report") || q.contains("patch sheet") {
            IntentType::GenerateDocumentation
        } else if q.contains("compare") || q.contains("diff") || q.contains("changed") {
            IntentType::CompareSnapshots
        } else if q.contains("snapshot") || q.contains("save") || q.contains("backup") {
            IntentType::TakeSnapshot
        } else if q.contains("preflight") || q.contains("check") || q.contains("ready") {
            IntentType::RunPreflight
        } else if q.contains("find") || q.contains("search") || q.contains("show") || q.contains("list") {
            IntentType::SearchDevices
        } else if q.contains("undo") || q.contains("rollback") || q.contains("revert") {
            IntentType::Rollback
        } else {
            IntentType::Unknown
        };

        ParsedIntent {
            intent_type,
            entities: Vec::new(),
            original_query: query.to_string(),
            confidence: 0.7,
        }
    }
}
