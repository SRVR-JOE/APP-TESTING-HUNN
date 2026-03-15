# 8. Desktop App Architecture

## Architecture Decision

### Option Analysis

| Option | Framework | Pros | Cons |
|--------|-----------|------|------|
| **A** | Electron + TypeScript | Massive ecosystem, proven at scale (VS Code, Slack), fast UI dev, huge talent pool | Memory heavy, large binary, "not native" criticism |
| **B** | Tauri + Rust + TypeScript | Small binary, low memory, Rust backend performance, native webview | Smaller ecosystem, less mature, Rust learning curve, webview inconsistencies |
| **C** | .NET MAUI / WPF + C# | True Windows native, good for enterprise, strong typing | Windows-only (or limited cross-platform), smaller web talent pool, slower UI iteration |

### Decision: **Tauri 2.0 + Rust Backend + TypeScript/React Frontend**

**Rationale:**

1. **Performance matters.** SignalGraph will run network discovery, maintain live connections to dozens/hundreds of devices, process real-time telemetry, run a local AI model, and render complex graph visualizations — simultaneously. Rust's performance and memory safety are not nice-to-haves; they're operational requirements.

2. **Binary size matters.** AV technicians need to install this on show laptops quickly. A 20MB Tauri app vs. a 200MB Electron app is a real difference in field conditions.

3. **Memory matters.** The app shares the machine with media servers, playback systems, and other resource-hungry AV software. Low memory footprint is a competitive advantage.

4. **Cross-platform with Windows-first.** Tauri 2.0 supports Windows, macOS, and Linux. The AV industry is primarily Windows but has significant macOS usage (especially in broadcast and live events). We build Windows-first, test on macOS, support Linux for embedded/appliance use cases.

5. **Tauri 2.0 is mature enough.** With its stable release, mobile support, and growing ecosystem, it's production-ready for this use case.

6. **Frontend velocity.** TypeScript/React for the UI layer means we can iterate on UX fast, use the massive React ecosystem for graph visualization (react-flow, d3), and hire frontend developers easily.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Tauri Shell                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    React Frontend                          │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │  │
│  │  │SystemMap │ │DeviceView│ │ CoPilot  │ │ LabelForge   │ │  │
│  │  │(Topology)│ │(Inspect) │ │ (AI)     │ │ (Labels)     │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │  │
│  │  │PathTrace │ │ConfigDiff│ │FlightChk │ │ ChangeLog    │ │  │
│  │  │(Tracing) │ │(Compare) │ │(Preflight│ │ (Audit)      │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │  │
│  └────────────────────┬──────────────────────────────────────┘  │
│                       │ Tauri IPC (Commands + Events)            │
│  ┌────────────────────▼──────────────────────────────────────┐  │
│  │                    Rust Core                               │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │                  Service Layer                       │  │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │  │  │
│  │  │  │Discovery │ │ Graph    │ │ AI Orchestrator    │  │  │  │
│  │  │  │ Service  │ │ Service  │ │ (CoPilot Engine)   │  │  │  │
│  │  │  └──────────┘ └──────────┘ └────────────────────┘  │  │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │  │  │
│  │  │  │Config    │ │ Label    │ │ Troubleshoot       │  │  │  │
│  │  │  │ Manager  │ │ Engine   │ │ Engine             │  │  │  │
│  │  │  └──────────┘ └──────────┘ └────────────────────┘  │  │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │  │  │
│  │  │  │Rollback  │ │ Audit    │ │ Connector          │  │  │  │
│  │  │  │ Manager  │ │ Logger   │ │ Manager            │  │  │  │
│  │  │  └──────────┘ └──────────┘ └────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │              Connector Layer                         │  │  │
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌─────────────┐ │  │  │
│  │  │  │ REST   │ │ SNMP   │ │ TCP/   │ │ Vendor SDK  │ │  │  │
│  │  │  │Adapter │ │Adapter │ │ Telnet │ │ Adapters    │ │  │  │
│  │  │  └────────┘ └────────┘ └────────┘ └─────────────┘ │  │  │
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌─────────────┐ │  │  │
│  │  │  │ OSC    │ │ Dante  │ │ NDI    │ │ NMOS        │ │  │  │
│  │  │  │Adapter │ │Adapter │ │Adapter │ │ Adapter     │ │  │  │
│  │  │  └────────┘ └────────┘ └────────┘ └─────────────┘ │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │              Data Layer                              │  │  │
│  │  │  ┌──────────────┐  ┌──────────────┐                │  │  │
│  │  │  │ SQLite        │  │ Vector Store │                │  │  │
│  │  │  │ (Graph +      │  │ (RAG Index)  │                │  │  │
│  │  │  │  Config +     │  │              │                │  │  │
│  │  │  │  Audit)       │  │              │                │  │  │
│  │  │  └──────────────┘  └──────────────┘                │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │              AI Runtime                              │  │  │
│  │  │  ┌──────────────┐  ┌──────────────────────────┐    │  │  │
│  │  │  │ Local LLM    │  │ Cloud LLM (optional)     │    │  │  │
│  │  │  │ (llama.cpp)  │  │ (Anthropic API)          │    │  │  │
│  │  │  └──────────────┘  └──────────────────────────┘    │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Architectural Decisions

### Local Database: SQLite (via rusqlite)
- **Why SQLite:** Embedded, zero-config, bulletproof, fast for the expected data volumes (tens of thousands of devices/routes, not millions). Perfect for local-first desktop apps.
- **Graph model in SQLite:** Use adjacency tables for the device/signal graph. SQLite handles recursive CTEs well for path traversal. No need for a dedicated graph database at MVP — that's over-engineering.
- **Schema versioning:** Use rust-migrate or refinery for migrations.

### Event Bus: Tokio Broadcast Channels
- Internal async event bus for real-time state propagation
- Discovery events, device status changes, user actions all flow through the bus
- Frontend subscribes via Tauri event system
- Enables reactive UI without polling

### Background Services
- **Discovery daemon:** Runs continuously, scans for new/changed devices
- **Health monitor:** Polls device status on configurable intervals
- **Change detector:** Compares live state to last known state, emits change events
- All run as Tokio tasks within the Rust backend

### Plugin/Connector System
- Connectors are compiled Rust crates loaded as dynamic libraries (.dll/.so/.dylib)
- Each connector implements the `Connector` trait
- Hot-reload support for development; bundled for production
- Connector manifest declares supported vendors/models/protocols

### Update System
- Tauri's built-in updater with custom update server
- Differential updates where possible
- Connector updates independent of app updates
- Rollback to previous version if update fails

### Packaging
- MSI installer for Windows (primary)
- DMG for macOS
- AppImage for Linux
- Portable mode (no install) for show laptops
- Total install size target: <100MB (app) + model files (1-4GB, downloaded separately)

---

## Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| App startup | <3 seconds | Engineers open it under pressure |
| Network discovery (Class C) | <15 seconds | Must feel instant for a typical AV network |
| Signal-path trace | <500ms | Real-time troubleshooting requires speed |
| Device status query | <200ms | UI must feel live |
| AI query (local) | <5 seconds | Acceptable for natural-language interactions |
| AI query (cloud) | <10 seconds | Acceptable for complex queries with fallback notice |
| Memory usage (idle) | <200MB | Must coexist with media servers |
| Memory usage (active, 200 devices) | <500MB | Includes graph, cache, and AI model |
| Graph render (500 nodes) | 60fps | Smooth interaction with topology |
