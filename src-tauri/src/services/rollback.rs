// SignalGraph — Rollback Manager
// Manages undo/rollback capabilities for all system changes.

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::connectors::manager::ConnectorManager;
use crate::connectors::traits::{ConnectionConfig, DeviceCommand, SafetyLevel};
use crate::models::audit::{ChangeActor, ChangeRecord, ActionType, RollbackStatus};
use crate::models::device::EntityId;

/// Maximum number of rollback records to retain in memory.
const MAX_ROLLBACK_HISTORY: usize = 1000;

/// A rollback-capable change with all data needed to reverse it.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RollbackEntry {
    pub change_record_id: EntityId,
    pub device_id: EntityId,
    pub description: String,
    pub rollback_command: DeviceCommand,
    pub original_state: serde_json::Value,
    pub created_at: i64,
    pub status: RollbackStatus,
    pub session_id: EntityId,
}

/// Result of a rollback attempt.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RollbackResult {
    pub success: bool,
    pub entry_id: EntityId,
    pub message: String,
    pub verified: bool,
    pub new_state: Option<serde_json::Value>,
}

/// The rollback manager that tracks and executes undo operations.
pub struct RollbackManager {
    entries: RwLock<VecDeque<RollbackEntry>>,
    connector_manager: Arc<ConnectorManager>,
}

impl RollbackManager {
    pub fn new(connector_manager: Arc<ConnectorManager>) -> Self {
        Self {
            entries: RwLock::new(VecDeque::with_capacity(MAX_ROLLBACK_HISTORY)),
            connector_manager,
        }
    }

    /// Record a change that can be rolled back.
    pub async fn record_change(
        &self,
        change_record_id: EntityId,
        device_id: EntityId,
        description: &str,
        rollback_command: DeviceCommand,
        original_state: serde_json::Value,
        session_id: EntityId,
    ) {
        let entry = RollbackEntry {
            change_record_id,
            device_id,
            description: description.to_string(),
            rollback_command,
            original_state,
            created_at: chrono::Utc::now().timestamp(),
            status: RollbackStatus::Available,
            session_id,
        };

        let mut entries = self.entries.write().await;
        if entries.len() >= MAX_ROLLBACK_HISTORY {
            // Mark oldest entry as expired
            if let Some(oldest) = entries.front_mut() {
                oldest.status = RollbackStatus::Expired;
            }
            entries.pop_front();
        }
        entries.push_back(entry);
    }

    /// Get all available rollback entries.
    pub async fn list_available(&self) -> Vec<RollbackEntry> {
        self.entries
            .read()
            .await
            .iter()
            .filter(|e| e.status == RollbackStatus::Available)
            .cloned()
            .collect()
    }

    /// Get rollback entries for a specific device.
    pub async fn list_for_device(&self, device_id: EntityId) -> Vec<RollbackEntry> {
        self.entries
            .read()
            .await
            .iter()
            .filter(|e| e.device_id == device_id && e.status == RollbackStatus::Available)
            .cloned()
            .collect()
    }

    /// Get rollback entries for a specific session (all changes made together).
    pub async fn list_for_session(&self, session_id: EntityId) -> Vec<RollbackEntry> {
        self.entries
            .read()
            .await
            .iter()
            .filter(|e| e.session_id == session_id && e.status == RollbackStatus::Available)
            .cloned()
            .collect()
    }

    /// Execute a single rollback.
    pub async fn rollback_single(
        &self,
        change_record_id: EntityId,
        connection_config: &ConnectionConfig,
    ) -> RollbackResult {
        // Find the entry
        let entry = {
            let entries = self.entries.read().await;
            entries
                .iter()
                .find(|e| e.change_record_id == change_record_id)
                .cloned()
        };

        let entry = match entry {
            Some(e) => e,
            None => {
                return RollbackResult {
                    success: false,
                    entry_id: change_record_id,
                    message: "Rollback entry not found".into(),
                    verified: false,
                    new_state: None,
                };
            }
        };

        if entry.status != RollbackStatus::Available {
            return RollbackResult {
                success: false,
                entry_id: change_record_id,
                message: format!("Rollback not available: {:?}", entry.status),
                verified: false,
                new_state: None,
            };
        }

        // Execute the rollback command
        match self
            .connector_manager
            .execute_command(entry.device_id, connection_config, &entry.rollback_command)
            .await
        {
            Ok(result) => {
                // Mark as executed
                let mut entries = self.entries.write().await;
                if let Some(e) = entries
                    .iter_mut()
                    .find(|e| e.change_record_id == change_record_id)
                {
                    e.status = RollbackStatus::Executed;
                }

                RollbackResult {
                    success: result.success,
                    entry_id: change_record_id,
                    message: format!("Rollback executed: {}", result.message),
                    verified: result.success,
                    new_state: result.new_state,
                }
            }
            Err(e) => RollbackResult {
                success: false,
                entry_id: change_record_id,
                message: format!("Rollback failed: {}", e),
                verified: false,
                new_state: None,
            },
        }
    }

    /// Rollback all changes in a session (in reverse order).
    pub async fn rollback_session(
        &self,
        session_id: EntityId,
        connection_configs: &std::collections::HashMap<EntityId, ConnectionConfig>,
    ) -> Vec<RollbackResult> {
        let session_entries = self.list_for_session(session_id).await;
        let mut results = Vec::new();

        // Execute in reverse order (undo last change first)
        for entry in session_entries.into_iter().rev() {
            if let Some(config) = connection_configs.get(&entry.device_id) {
                let result = self
                    .rollback_single(entry.change_record_id, config)
                    .await;
                results.push(result);
            } else {
                results.push(RollbackResult {
                    success: false,
                    entry_id: entry.change_record_id,
                    message: "No connection config available for device".into(),
                    verified: false,
                    new_state: None,
                });
            }
        }

        results
    }

    /// Preview what a rollback would do without executing it.
    pub async fn preview_rollback(
        &self,
        change_record_id: EntityId,
    ) -> Option<RollbackPreview> {
        let entries = self.entries.read().await;
        entries
            .iter()
            .find(|e| e.change_record_id == change_record_id)
            .map(|entry| RollbackPreview {
                description: entry.description.clone(),
                device_id: entry.device_id,
                original_state: entry.original_state.clone(),
                rollback_action: entry.rollback_command.description.clone(),
                safety_level: entry.rollback_command.safety_level.clone(),
            })
    }
}

/// Preview of what a rollback will do.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RollbackPreview {
    pub description: String,
    pub device_id: EntityId,
    pub original_state: serde_json::Value,
    pub rollback_action: String,
    pub safety_level: SafetyLevel,
}
