# 9. Connector + Skill Framework

## The Connector Architecture

Connectors are the nervous system of SignalGraph. Each connector teaches the system how to discover, communicate with, and control a specific vendor/device/protocol. The framework must make it easy to add new connectors without touching core code.

---

## Connector Trait (Interface)

Every connector implements a standard Rust trait:

```
Connector Trait
├── discovery()          → Find devices of this type on the network
├── identify()           → Get vendor, model, firmware, serial, capabilities
├── get_ports()          → Enumerate all I/O ports with types and states
├── get_status()         → Current device health, errors, temperature
├── get_config()         → Full running configuration
├── get_routing()        → Current signal routing state (input→output map)
├── set_routing()        → Change a signal route
├── set_config()         → Apply a configuration change
├── subscribe_events()   → Stream real-time state changes
├── validate_command()   → Check if a command is safe before execution
├── rollback_command()   → Reverse a previously executed command
├── get_capabilities()   → What can this connector do?
└── health_check()       → Is the device reachable and responsive?
```

Not every connector implements every method. The `get_capabilities()` method declares what's supported.

---

## Connector Manifest

Each connector ships with a manifest file:

```yaml
connector:
  id: "barco-eventmaster"
  name: "Barco Event Master"
  version: "1.2.0"
  author: "SignalGraph Core Team"

  supported_devices:
    - vendor: "Barco"
      models: ["E2", "S3-4K", "EX"]
      firmware_range: ">=7.0 <9.0"

  protocols:
    - type: "rest"
      default_port: 9999
      discovery: "mdns"
      mdns_service: "_barco-e2._tcp"

  capabilities:
    - discovery
    - identify
    - get_ports
    - get_status
    - get_config
    - get_routing
    - set_routing
    - subscribe_events
    - rollback_command

  schema_version: "1.0"

  safety:
    max_retry: 3
    timeout_ms: 5000
    requires_auth: true
    critical_commands:
      - set_routing  # Requires user approval

  normalized_device_type: "video_switcher"
```

---

## Protocol Adapters

Connectors are built on top of protocol adapters — reusable low-level communication layers:

### Available Protocol Adapters

| Adapter | Protocol | Use Case |
|---------|----------|----------|
| `RestAdapter` | HTTP/HTTPS REST | Modern device APIs (Barco, QSC, most new devices) |
| `SnmpAdapter` | SNMP v1/v2c/v3 | Network switches, legacy infrastructure |
| `TcpAdapter` | Raw TCP | Crestron, Extron SIS, many control protocols |
| `TelnetAdapter` | Telnet | Legacy devices, Cisco switches |
| `SshAdapter` | SSH | Linux-based devices, network equipment |
| `WebSocketAdapter` | WebSocket | Real-time streaming APIs |
| `OscAdapter` | OSC | Show control, some lighting, QLab |
| `MidiAdapter` | MIDI | Audio consoles, some lighting |
| `UdpAdapter` | Raw UDP | sACN, Art-Net, many discovery protocols |
| `SerialAdapter` | RS-232/422/485 | Legacy hardware, some projectors |

### Adapter Interface

```
ProtocolAdapter
├── connect(address, config)     → Establish connection
├── disconnect()                 → Clean disconnect
├── send(payload)                → Send data
├── receive()                    → Receive data
├── is_connected()               → Connection status
├── reconnect()                  → Auto-reconnect with backoff
└── get_latency()                → Connection latency
```

---

## Schema Normalization

The critical innovation: every connector normalizes its vendor-specific data into SignalGraph's universal schema.

### Example: Routing Normalization

**Barco E2 native format:**
```json
{"id": 0, "LMSrcIndex": 3, "LMDstIndex": 7, "Name": "PGM1"}
```

**Blackmagic VideoHub native format:**
```
VIDEO OUTPUT ROUTING:
7 3
```

**Dante native format:**
```json
{"rx_channel": "Speaker-L", "tx_device": "Console", "tx_channel": "Mix-L"}
```

**SignalGraph normalized format (all three):**
```json
{
  "route": {
    "id": "route_abc123",
    "source": {
      "device_id": "dev_001",
      "port_id": "port_out_3",
      "port_label": "Camera 2",
      "signal_type": "video",
      "format": "1080p59.94"
    },
    "destination": {
      "device_id": "dev_002",
      "port_id": "port_in_7",
      "port_label": "PGM1",
      "signal_type": "video",
      "format": "1080p59.94"
    },
    "active": true,
    "timestamp": "2026-03-15T14:32:07Z"
  }
}
```

This normalization is what makes cross-vendor signal tracing possible.

---

## Command Validation

Before any command is sent to a device, it passes through validation:

### Validation Pipeline

```
User/AI Action Request
    │
    ▼
┌──────────────────────┐
│ 1. Schema Validation  │  Does the command have valid parameters?
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 2. Capability Check   │  Does this device/connector support this action?
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 3. State Validation   │  Is the device in a state where this action makes sense?
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 4. Safety Check       │  Is this a critical action? Does it need approval?
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 5. Conflict Check     │  Would this action conflict with another active route?
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 6. Dry Run (optional) │  Simulate the action and predict the outcome
└──────────┬───────────┘
           │
           ▼
Execute or Present for Approval
```

---

## Retry Logic

```
Attempt 1 → Send command
  │ Fail?
  ▼
Wait 500ms → Attempt 2
  │ Fail?
  ▼
Wait 1000ms → Attempt 3
  │ Fail?
  ▼
Wait 2000ms → Attempt 4 (final)
  │ Fail?
  ▼
Report failure to user with:
  - Error type (timeout, refused, auth, protocol error)
  - Device status at time of failure
  - Suggested troubleshooting steps
```

**Important:** Retry logic is ONLY for transient failures (timeout, network blip). Permanent failures (auth error, invalid command, device offline) fail immediately with a clear explanation.

---

## Testing Sandbox

Every connector can be tested without touching real devices:

### Sandbox Modes

| Mode | Description |
|------|-------------|
| **Mock Device** | Connector ships with a mock implementation that simulates the device |
| **Record/Replay** | Record real device interactions, replay them for testing |
| **Dry Run** | Send commands to the validation pipeline without executing |
| **Staging Device** | Connect to a real device marked as "test" (not in live signal path) |

### Connector Test Suite

Every connector must pass:
1. **Discovery test:** Can it find a mock device?
2. **Identify test:** Does it correctly identify vendor/model/firmware?
3. **Status test:** Does it return valid status data?
4. **Routing test:** Can it read and set routes correctly?
5. **Normalization test:** Does output conform to SignalGraph schema?
6. **Error handling test:** Does it handle disconnection, timeout, auth failure gracefully?
7. **Rollback test:** Can it reverse a command?

---

## Version Compatibility

```yaml
compatibility:
  signalgraph_core: ">=1.0 <2.0"     # Core API version
  schema_version: "1.0"               # Data schema version
  protocol_adapters:
    rest: ">=1.0"                      # Required adapter version

  device_firmware:
    min: "7.0"
    max: "8.9"
    tested: ["7.2", "7.5", "8.0", "8.3"]
    known_issues:
      "7.0":
        - "Status endpoint returns incorrect temperature"
        - workaround: "Use SNMP for temperature instead"
```

---

## Priority Connectors for MVP

| Priority | Connector | Why |
|----------|-----------|-----|
| 1 | **Generic SNMP** | Discovers and monitors any SNMP-capable device |
| 2 | **Blackmagic VideoHub** | Extremely common video router, simple protocol |
| 3 | **Dante (via Dante API)** | Ubiquitous in pro audio, huge install base |
| 4 | **NDI Discovery** | Growing fast in live production |
| 5 | **Generic REST** | Template for any REST API device |
| 6 | **Barco Event Master** | High-value live events device |
| 7 | **Generic TCP/Telnet** | Covers Extron SIS, many legacy devices |
| 8 | **NMOS IS-04/IS-05** | Industry standard for broadcast AV-over-IP |

### Community-Requested (V2)
- QSC Q-SYS
- Crestron
- Ross Video DashBoard
- Shure Wireless
- Sennheiser
- Allen & Heath dLive/SQ
- Yamaha CL/QL/TF
- Panasonic PTZ cameras
- Sony cameras (VISCA)
- Luminex LumiNode
- AJA devices
- Decimator
