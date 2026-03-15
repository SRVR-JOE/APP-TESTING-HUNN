# 10. The Digital Twin / Data Model

## The Normalized AV Graph

The data model is the heart of SignalGraph. Everything else — AI reasoning, signal tracing, labeling, documentation, troubleshooting — depends on this model being correct, comprehensive, and live.

---

## Entity Model

### Core Entities

```
System
├── Device
│   ├── Port (Input / Output / Bidirectional)
│   │   └── Endpoint (logical connection point)
│   ├── Config (key-value settings)
│   ├── FirmwareInfo
│   └── HealthMetrics
│
├── Signal
│   ├── Route (source endpoint → destination endpoint)
│   └── SignalChain (ordered list of routes forming a complete path)
│
├── Label
│   ├── DeviceLabel
│   ├── PortLabel
│   ├── CableLabel
│   └── LocationLabel
│
├── Snapshot (point-in-time system state)
│   └── SnapshotDiff (comparison between two snapshots)
│
├── ChangeRecord (audit trail entry)
│
├── Alarm (active or historical alert)
│
├── Playbook (runbook / procedure)
│
└── User
    └── Permission
```

---

## Detailed Entity Definitions

### Device

```
Device {
  id:               UUID
  connector_id:     String          // Which connector manages this device
  vendor:           String          // "Barco", "Blackmagic", etc.
  model:            String          // "E2", "VideoHub 40x40"
  firmware_version: SemVer          // "8.3.1"
  serial_number:    String?
  hostname:         String?
  ip_addresses:     [IpAddress]
  mac_addresses:    [MacAddress]
  device_type:      DeviceType      // video_switcher, audio_mixer, etc.
  location:         Location?       // rack, position, room
  labels:           [Label]
  capabilities:     [Capability]    // What operations this device supports
  status:           DeviceStatus    // online, offline, error, unknown
  last_seen:        Timestamp
  discovered_at:    Timestamp
  metadata:         Map<String, Value>  // Vendor-specific extended data
}

DeviceType enum {
  VideoSwitcher, VideoRouter, VideoProcessor, VideoScaler,
  AudioMixer, AudioDSP, AudioAmplifier, AudioRouter,
  MediaServer, RecordPlayback, Camera, Display,
  LEDProcessor, LightingConsole, LightingNode,
  NetworkSwitch, NetworkRouter,
  ControlProcessor, ShowController,
  SignalConverter, SignalDistributor,
  Multiviewer, StreamEncoder, StreamDecoder,
  IntercomStation, WirelessReceiver,
  PowerDistributor, KVM,
  Unknown
}

Location {
  venue:            String?
  room:             String?
  rack:             String?
  rack_unit:        u8?             // 1U position in rack
  rack_side:        RackSide?       // front, rear
  shelf:            String?
  notes:            String?
}
```

### Port

```
Port {
  id:               UUID
  device_id:        UUID            // Parent device
  direction:        PortDirection   // Input, Output, Bidirectional
  port_index:       u16             // Physical port number on device
  port_type:        PortType        // HDMI, SDI, Dante, NDI, XLR, etc.
  signal_type:      SignalType      // Video, Audio, Data, Control
  label:            Label?
  status:           PortStatus      // active, inactive, error, no_signal
  current_format:   SignalFormat?   // 1080p59.94, 48kHz/24bit, etc.
  connected_to:     UUID?           // Cable or wireless link to another port
  endpoints:        [Endpoint]      // Logical endpoints (e.g., Dante channels)
  capabilities:     PortCapabilities
}

PortType enum {
  // Video
  HDMI, SDI, SDI12G, DisplayPort, DVI, VGA, HDBaseT, Fiber,
  // Audio
  XLR, TRS, RCA, AES3, MADI, DanteAudio, AES67,
  // Network
  Ethernet, SFP, SFPPlus, QSFP,
  // Data/Control
  USB, RS232, RS422, RS485, GPIO, DMX,
  // IP/Virtual
  NDI, SRT, RTMP, ST2110, NMOS,
  // Other
  Custom(String)
}

SignalFormat {
  resolution:       String?         // "1920x1080", "3840x2160"
  frame_rate:       f32?            // 59.94, 29.97, 25, etc.
  color_space:      String?         // "YCbCr 4:2:2", "RGB 4:4:4"
  bit_depth:        u8?             // 8, 10, 12
  sample_rate:      u32?            // 48000, 96000 (audio)
  channels:         u8?             // Audio channel count
  codec:            String?         // "H.264", "ProRes", "PCM"
  bandwidth_mbps:   f32?
}
```

### Endpoint

```
Endpoint {
  id:               UUID
  port_id:          UUID            // Parent port
  endpoint_type:    EndpointType    // Physical port, Dante channel, NDI source, etc.
  channel_index:    u16?            // For multi-channel ports (e.g., Dante channel 1-64)
  label:            Label?
  signal_type:      SignalType
  format:           SignalFormat?
  subscribed_to:    UUID?           // Source endpoint this is receiving from
}
```

### Route (Signal Edge)

```
Route {
  id:               UUID
  source_endpoint:  UUID
  dest_endpoint:    UUID
  signal_type:      SignalType
  active:           bool
  medium:           RouteMedium     // cable, network, internal, wireless
  cable_id:         String?         // Physical cable identifier
  latency_ms:       f32?
  quality:          RouteQuality    // good, degraded, error
  created_at:       Timestamp
  last_verified:    Timestamp
}
```

### SignalChain (Full Path)

```
SignalChain {
  id:               UUID
  name:             String          // "Camera 2 → LED Wall SL"
  routes:           [Route]         // Ordered list of route segments
  source_device:    UUID            // First device in chain
  dest_device:      UUID            // Last device in chain
  signal_type:      SignalType
  status:           ChainStatus     // healthy, degraded, broken
  break_point:      UUID?           // Route where signal is lost (if broken)
  total_latency_ms: f32?
}
```

### Config

```
ConfigEntry {
  id:               UUID
  device_id:        UUID
  key:              String          // Hierarchical: "output.1.resolution"
  value:            Value           // Typed value
  value_type:       ConfigValueType // string, int, float, bool, enum
  category:         String          // "routing", "display", "network", "audio"
  editable:         bool
  requires_reboot:  bool
  last_changed:     Timestamp
  changed_by:       String          // "user", "auto-discovery", "ai-action"
}
```

### HealthMetrics

```
HealthMetrics {
  device_id:        UUID
  timestamp:        Timestamp
  cpu_percent:      f32?
  memory_percent:   f32?
  temperature_c:    f32?
  fan_speed_rpm:    u32?
  uptime_seconds:   u64?
  error_count:      u32?
  warning_count:    u32?
  input_signal:     Map<PortId, bool>
  output_signal:    Map<PortId, bool>
  link_status:      Map<PortId, LinkSpeed>
  custom_metrics:   Map<String, Value>
}
```

### Alarm

```
Alarm {
  id:               UUID
  device_id:        UUID
  port_id:          UUID?
  severity:         AlarmSeverity   // critical, warning, info
  alarm_type:       AlarmType       // signal_loss, temperature, error, offline, drift
  message:          String
  first_seen:       Timestamp
  last_seen:        Timestamp
  acknowledged:     bool
  acknowledged_by:  UUID?
  resolved:         bool
  resolved_at:      Timestamp?
  related_alarms:   [UUID]          // Correlated alarms (same root cause)
}
```

### ChangeRecord

```
ChangeRecord {
  id:               UUID
  timestamp:        Timestamp
  actor:            ChangeActor     // user, ai, system, external
  actor_id:         UUID?           // User ID or AI session ID
  action_type:      ActionType      // route_change, config_change, device_added, etc.
  target_device:    UUID?
  target_port:      UUID?
  before_state:     Value           // Serialized previous state
  after_state:      Value           // Serialized new state
  description:      String          // Human-readable description
  rollback_data:    Value?          // Data needed to undo this change
  rollback_status:  RollbackStatus  // available, expired, executed
  approval_id:      UUID?           // Link to approval record if applicable
  session_id:       UUID            // Group changes from same session/action
}
```

### Snapshot

```
Snapshot {
  id:               UUID
  name:             String          // "Soundcheck Complete", "Show Ready"
  description:      String?
  created_at:       Timestamp
  created_by:       UUID
  device_states:    Map<DeviceId, DeviceSnapshot>
  route_states:     [Route]
  label_states:     Map<EntityId, Label>
  tags:             [String]        // "show-ready", "backup", "tour-stop-chicago"
}
```

### Playbook

```
Playbook {
  id:               UUID
  name:             String          // "Switch to Backup Source"
  description:      String
  trigger:          PlaybookTrigger // manual, alarm, schedule
  steps:            [PlaybookStep]
  created_by:       UUID
  last_run:         Timestamp?
  run_count:        u32
  tags:             [String]
}

PlaybookStep {
  order:            u16
  action:           Action          // Tool call to execute
  condition:        Condition?      // Only run if condition is met
  approval_required: bool
  rollback_action:  Action?
  timeout_ms:       u32
  on_failure:       FailureAction   // stop, skip, retry, alert
}
```

### User & Permission

```
User {
  id:               UUID
  name:             String
  role:             UserRole        // admin, engineer, operator, viewer
  permissions:      [Permission]
  created_at:       Timestamp
  last_active:      Timestamp
}

Permission {
  resource_type:    ResourceType    // device, connector, system, config
  resource_id:      UUID?           // Specific resource or null for all
  actions:          [PermAction]    // read, write, execute, approve, admin
}
```

---

## Graph Structure

### How the Graph Works

```
                    ┌──────────┐
                    │  Camera  │
                    │   Cam2   │
                    └────┬─────┘
                         │ SDI Out 1
                         │ (Route: active, cable: "SDI-042")
                         ▼
                    ┌──────────┐
                    │Decimator │
                    │ MD-HX    │
                    │ SDI→HDMI │
                    └────┬─────┘
                         │ HDMI Out
                         │ (Route: active, cable: "HDMI-017")
                         ▼
                    ┌──────────┐
              ┌────▶│ Barco E2 │◀────┐
              │     │ Input 7  │     │
              │     └────┬─────┘     │
              │          │           │
    (12 other │     Internal         │ (8 other
     inputs)  │     Routing          │  inputs)
              │          │           │
              │     ┌────▼─────┐     │
              └────▶│ E2 Out 3 │◀────┘
                    └────┬─────┘
                         │ HDMI Out
                         │ (Route: active, cable: "HDMI-089")
                         ▼
                    ┌──────────┐
                    │ LED Wall │
                    │ Stage L  │
                    └──────────┘
```

### Graph Queries (Cypher-like, executed on SQLite)

```sql
-- Find all devices in Rack 2
SELECT * FROM devices WHERE location_rack = 'Rack 2';

-- Trace signal path from Camera 2 to LED Wall
WITH RECURSIVE signal_path AS (
  -- Start at Camera 2's output endpoint
  SELECT r.id, r.source_endpoint, r.dest_endpoint, 1 as hop
  FROM routes r
  JOIN endpoints e ON r.source_endpoint = e.id
  JOIN ports p ON e.port_id = p.id
  JOIN devices d ON p.device_id = d.id
  WHERE d.label = 'Camera 2' AND p.direction = 'output'

  UNION ALL

  -- Follow the chain
  SELECT r.id, r.source_endpoint, r.dest_endpoint, sp.hop + 1
  FROM routes r
  JOIN signal_path sp ON r.source_endpoint = (
    -- Find the output endpoint of the device that owns sp.dest_endpoint
    SELECT e2.id FROM endpoints e2
    JOIN ports p2 ON e2.port_id = p2.id
    WHERE p2.device_id = (
      SELECT p3.device_id FROM ports p3
      JOIN endpoints e3 ON p3.id = e3.port_id
      WHERE e3.id = sp.dest_endpoint
    ) AND p2.direction = 'output'
  )
  WHERE sp.hop < 20  -- Safety limit
)
SELECT * FROM signal_path;

-- Find all broken signal chains
SELECT sc.* FROM signal_chains sc WHERE sc.status = 'broken';

-- Find devices with firmware older than X
SELECT * FROM devices WHERE firmware_version < '8.0.0' AND vendor = 'Barco';

-- Get all changes in the last hour
SELECT * FROM change_records
WHERE timestamp > datetime('now', '-1 hour')
ORDER BY timestamp DESC;
```

### Graph Traversal Operations

| Operation | Description | Used By |
|-----------|-------------|---------|
| `trace_forward(endpoint)` | Follow signal from source to all destinations | PathTrace, Troubleshooting |
| `trace_backward(endpoint)` | Follow signal from destination back to source | PathTrace, Troubleshooting |
| `find_path(src, dst)` | Find the route between two specific endpoints | PathTrace |
| `find_all_paths(src, dst)` | Find ALL possible routes (for redundancy analysis) | SimRoute |
| `subgraph(device_ids)` | Extract a subset of the graph | Export, Documentation |
| `neighbors(device)` | Find all directly connected devices | Topology View |
| `shortest_path(src, dst)` | Shortest route by hop count | Routing suggestions |
| `affected_by(device)` | All signal chains passing through a device | Impact analysis |
| `orphaned_ports()` | Ports with no connections | Labeling, Cleanup |
| `topology_diff(snap_a, snap_b)` | Changes between two graph states | ConfigGuard |
