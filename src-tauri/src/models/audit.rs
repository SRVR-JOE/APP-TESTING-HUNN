// SignalGraph — Audit, Change Tracking, and Rollback models

use serde::{Deserialize, Serialize};
use super::device::EntityId;
use uuid::Uuid;

/// Who or what initiated a change.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ChangeActor {
    User,
    Ai,
    System,
    External,
}

/// What type of change occurred.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ActionType {
    RouteChange,
    ConfigChange,
    DeviceAdded,
    DeviceRemoved,
    DeviceStatusChange,
    LabelChange,
    FirmwareChange,
    SnapshotCreated,
    SnapshotRestored,
    BulkChange,
}

/// Whether rollback is available for this change.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RollbackStatus {
    Available,
    Expired,
    Executed,
    Invalidated,
}

/// An immutable audit record for every change in the system.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeRecord {
    pub id: EntityId,
    pub timestamp: i64,
    pub actor: ChangeActor,
    pub actor_id: Option<EntityId>,
    pub action_type: ActionType,
    pub target_device: Option<EntityId>,
    pub target_port: Option<EntityId>,
    pub before_state: Option<serde_json::Value>,
    pub after_state: Option<serde_json::Value>,
    pub description: String,
    pub rollback_data: Option<serde_json::Value>,
    pub rollback_status: RollbackStatus,
    pub approval_id: Option<EntityId>,
    pub session_id: EntityId,
}

impl ChangeRecord {
    pub fn new(
        actor: ChangeActor,
        action_type: ActionType,
        description: &str,
        session_id: EntityId,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            timestamp: chrono::Utc::now().timestamp(),
            actor,
            actor_id: None,
            action_type,
            target_device: None,
            target_port: None,
            before_state: None,
            after_state: None,
            description: description.to_string(),
            rollback_data: None,
            rollback_status: RollbackStatus::Available,
            approval_id: None,
            session_id,
        }
    }
}

/// A point-in-time snapshot of the entire system state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub id: EntityId,
    pub name: String,
    pub description: Option<String>,
    pub created_at: i64,
    pub created_by: Option<EntityId>,
    pub data: serde_json::Value, // Serialized system state
    pub tags: Vec<String>,
}

/// Severity levels for alarms.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum AlarmSeverity {
    Info,
    Warning,
    Critical,
}

/// An active or historical alarm/alert.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alarm {
    pub id: EntityId,
    pub device_id: EntityId,
    pub port_id: Option<EntityId>,
    pub severity: AlarmSeverity,
    pub alarm_type: String,
    pub message: String,
    pub first_seen: i64,
    pub last_seen: i64,
    pub acknowledged: bool,
    pub resolved: bool,
    pub resolved_at: Option<i64>,
}
