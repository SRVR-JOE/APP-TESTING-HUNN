// SignalGraph — Topology Graph Service
// Manages the in-memory graph of devices, ports, and signal routes.
// Provides graph traversal for signal-path tracing and topology queries.

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::models::device::{Device, EntityId};
use crate::models::signal::{
    ChainStatus, Port, PortDirection, Route, SignalChain, SignalType,
};

/// A node in the topology graph.
#[derive(Debug, Clone)]
pub struct GraphNode {
    pub device: Device,
    pub ports: Vec<Port>,
}

/// The topology graph holding the complete system state.
pub struct TopologyGraph {
    devices: RwLock<HashMap<EntityId, GraphNode>>,
    routes: RwLock<HashMap<EntityId, Route>>,
    // Index: port_id -> list of route_ids where this port is source
    outgoing_routes: RwLock<HashMap<EntityId, Vec<EntityId>>>,
    // Index: port_id -> list of route_ids where this port is destination
    incoming_routes: RwLock<HashMap<EntityId, Vec<EntityId>>>,
}

impl TopologyGraph {
    pub fn new() -> Self {
        Self {
            devices: RwLock::new(HashMap::new()),
            routes: RwLock::new(HashMap::new()),
            outgoing_routes: RwLock::new(HashMap::new()),
            incoming_routes: RwLock::new(HashMap::new()),
        }
    }

    /// Add or update a device in the graph.
    pub async fn upsert_device(&self, device: Device, ports: Vec<Port>) {
        let id = device.id;
        let node = GraphNode { device, ports };
        self.devices.write().await.insert(id, node);
    }

    /// Remove a device and all its routes from the graph.
    pub async fn remove_device(&self, device_id: EntityId) {
        // Remove all routes involving this device's ports
        if let Some(node) = self.devices.read().await.get(&device_id) {
            for port in &node.ports {
                self.remove_routes_for_port(port.id).await;
            }
        }
        self.devices.write().await.remove(&device_id);
    }

    /// Add a signal route (edge) to the graph.
    pub async fn add_route(&self, route: Route) {
        let route_id = route.id;
        let src = route.source_port_id;
        let dst = route.dest_port_id;

        self.routes.write().await.insert(route_id, route);
        self.outgoing_routes
            .write()
            .await
            .entry(src)
            .or_default()
            .push(route_id);
        self.incoming_routes
            .write()
            .await
            .entry(dst)
            .or_default()
            .push(route_id);
    }

    /// Remove all routes connected to a port.
    async fn remove_routes_for_port(&self, port_id: EntityId) {
        let mut routes = self.routes.write().await;
        let mut outgoing = self.outgoing_routes.write().await;
        let mut incoming = self.incoming_routes.write().await;

        // Remove outgoing routes
        if let Some(route_ids) = outgoing.remove(&port_id) {
            for rid in &route_ids {
                if let Some(route) = routes.remove(rid) {
                    if let Some(inc) = incoming.get_mut(&route.dest_port_id) {
                        inc.retain(|id| id != rid);
                    }
                }
            }
        }

        // Remove incoming routes
        if let Some(route_ids) = incoming.remove(&port_id) {
            for rid in &route_ids {
                if let Some(route) = routes.remove(rid) {
                    if let Some(out) = outgoing.get_mut(&route.source_port_id) {
                        out.retain(|id| id != rid);
                    }
                }
            }
        }
    }

    /// Get a device by ID.
    pub async fn get_device(&self, device_id: EntityId) -> Option<GraphNode> {
        self.devices.read().await.get(&device_id).cloned()
    }

    /// Get all devices in the graph.
    pub async fn all_devices(&self) -> Vec<GraphNode> {
        self.devices.read().await.values().cloned().collect()
    }

    /// Get all routes in the graph.
    pub async fn all_routes(&self) -> Vec<Route> {
        self.routes.read().await.values().cloned().collect()
    }

    /// Find a device by name/label (case-insensitive partial match).
    pub async fn find_device_by_name(&self, query: &str) -> Vec<GraphNode> {
        let query_lower = query.to_lowercase();
        self.devices
            .read()
            .await
            .values()
            .filter(|node| {
                node.device.display_name().to_lowercase().contains(&query_lower)
                    || node.device.vendor.to_lowercase().contains(&query_lower)
                    || node.device.model.to_lowercase().contains(&query_lower)
                    || node.device.labels.iter().any(|l| l.to_lowercase().contains(&query_lower))
            })
            .cloned()
            .collect()
    }

    /// Trace a signal path forward from a source port to all reachable destinations.
    /// Returns a list of routes forming the path, in order.
    pub async fn trace_forward(
        &self,
        start_port_id: EntityId,
        max_hops: usize,
    ) -> Vec<Vec<Route>> {
        let routes = self.routes.read().await;
        let outgoing = self.outgoing_routes.read().await;
        let devices = self.devices.read().await;

        let mut paths: Vec<Vec<Route>> = Vec::new();
        let mut stack: Vec<(EntityId, Vec<Route>)> = vec![(start_port_id, Vec::new())];

        while let Some((current_port, current_path)) = stack.pop() {
            if current_path.len() >= max_hops {
                paths.push(current_path);
                continue;
            }

            if let Some(route_ids) = outgoing.get(&current_port) {
                if route_ids.is_empty() {
                    // Dead end — this is a terminal port
                    if !current_path.is_empty() {
                        paths.push(current_path);
                    }
                    continue;
                }

                for route_id in route_ids {
                    if let Some(route) = routes.get(route_id) {
                        let mut new_path = current_path.clone();
                        new_path.push(route.clone());

                        // Find the output ports of the device that owns the destination port
                        let dest_device_id =
                            self.find_device_for_port(&devices, route.dest_port_id);

                        if let Some(device_id) = dest_device_id {
                            if let Some(node) = devices.get(&device_id) {
                                let output_ports: Vec<_> = node
                                    .ports
                                    .iter()
                                    .filter(|p| p.direction == PortDirection::Output)
                                    .collect();

                                if output_ports.is_empty() {
                                    // Terminal device (display, speaker, etc.)
                                    paths.push(new_path);
                                } else {
                                    for out_port in output_ports {
                                        stack.push((out_port.id, new_path.clone()));
                                    }
                                }
                            } else {
                                paths.push(new_path);
                            }
                        } else {
                            paths.push(new_path);
                        }
                    }
                }
            } else if !current_path.is_empty() {
                paths.push(current_path);
            }
        }

        paths
    }

    /// Trace backward from a destination port to find its source.
    pub async fn trace_backward(
        &self,
        end_port_id: EntityId,
        max_hops: usize,
    ) -> Vec<Vec<Route>> {
        let routes = self.routes.read().await;
        let incoming = self.incoming_routes.read().await;
        let devices = self.devices.read().await;

        let mut paths: Vec<Vec<Route>> = Vec::new();
        let mut stack: Vec<(EntityId, Vec<Route>)> = vec![(end_port_id, Vec::new())];

        while let Some((current_port, current_path)) = stack.pop() {
            if current_path.len() >= max_hops {
                paths.push(current_path);
                continue;
            }

            if let Some(route_ids) = incoming.get(&current_port) {
                for route_id in route_ids {
                    if let Some(route) = routes.get(route_id) {
                        let mut new_path = current_path.clone();
                        new_path.insert(0, route.clone()); // Prepend for correct order

                        // Find input ports of source device
                        let src_device_id =
                            self.find_device_for_port(&devices, route.source_port_id);

                        if let Some(device_id) = src_device_id {
                            if let Some(node) = devices.get(&device_id) {
                                let input_ports: Vec<_> = node
                                    .ports
                                    .iter()
                                    .filter(|p| p.direction == PortDirection::Input)
                                    .collect();

                                if input_ports.is_empty() {
                                    paths.push(new_path);
                                } else {
                                    for in_port in input_ports {
                                        stack.push((in_port.id, new_path.clone()));
                                    }
                                }
                            } else {
                                paths.push(new_path);
                            }
                        } else {
                            paths.push(new_path);
                        }
                    }
                }
            } else if !current_path.is_empty() {
                paths.push(current_path);
            }
        }

        paths
    }

    /// Find which device owns a given port.
    fn find_device_for_port(
        &self,
        devices: &HashMap<EntityId, GraphNode>,
        port_id: EntityId,
    ) -> Option<EntityId> {
        for (device_id, node) in devices {
            if node.ports.iter().any(|p| p.id == port_id) {
                return Some(*device_id);
            }
        }
        None
    }

    /// Get summary statistics of the graph.
    pub async fn stats(&self) -> GraphStats {
        let devices = self.devices.read().await;
        let routes = self.routes.read().await;

        let total_ports: usize = devices.values().map(|n| n.ports.len()).sum();
        let online_devices = devices
            .values()
            .filter(|n| n.device.status == crate::models::device::DeviceStatus::Online)
            .count();

        GraphStats {
            total_devices: devices.len(),
            online_devices,
            total_ports,
            total_routes: routes.len(),
        }
    }
}

/// Summary statistics for the topology graph.
#[derive(Debug, Clone, serde::Serialize)]
pub struct GraphStats {
    pub total_devices: usize,
    pub online_devices: usize,
    pub total_ports: usize,
    pub total_routes: usize,
}
