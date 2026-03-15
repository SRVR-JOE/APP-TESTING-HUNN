# 6. The Must-Have Feature Set

## Feature Tiers: MVP → V2 → Platform

---

## MVP (Months 1–6) — "The Graph That Saves Shows"

### Discovery Engine — `AutoScan`
- Network scanning (mDNS, SSDP, SNMP, ARP, Dante Discovery, NDI Discovery, NMOS)
- Device identification (vendor, model, firmware, capabilities)
- Port enumeration (inputs, outputs, types, formats)
- Automatic topology construction
- Manual device addition for non-discoverable gear
- Re-scan / delta detection ("what changed since last scan")

### Topology View — `SystemMap`
- Interactive graph visualization of all devices and signal paths
- Zoom from full-system overview to individual port level
- Color-coded signal types (video, audio, data, control)
- Device grouping by rack, location, function
- Signal-path highlighting (click source → see full path to destination)
- Search/filter by device name, type, vendor, location

### Signal-Path Tracer — `PathTrace`
- Trace any signal from source to destination across the full graph
- Query each device along the path for live status
- Highlight the exact failure point when a path is broken
- Show format/resolution at each hop
- Display latency estimates per hop
- Natural-language query: "Where does Camera 2 go?" / "Why is Screen 3 black?"

### Device Inspector — `DeviceView`
- Live device state (inputs, outputs, routing, format, temperature, errors)
- Configuration viewer (current running config)
- Firmware version display
- Port status matrix
- Command interface (send raw commands where supported)
- Connection history

### Config Snapshot & Diff — `ConfigGuard`
- Snapshot current system state as a "show file"
- Compare live state vs. saved snapshot
- Visual diff: highlight every change (routing, naming, settings)
- Export diff as report
- Restore from snapshot (with approval gate)

### Basic Labeling — `LabelForge` (MVP subset)
- Auto-generate device labels from discovery data
- Auto-generate port labels from connected signal names
- Label template system (customizable naming conventions)
- Export labels as CSV, PDF
- Basic cable label generation

### AI Copilot — `CoPilot` (MVP subset)
- Natural-language system queries ("How many Dante devices are online?")
- Signal-path tracing via natural language
- Basic root-cause suggestions for common failures
- Device lookup ("What firmware is the E2 running?")
- System summary generation

### Change Log — `ChangeTrack`
- Log every detected change (routing, config, device online/offline)
- Timestamp + source + before/after for each change
- Filterable change history
- Export as audit report

### Offline Mode — `LocalFirst`
- Full functionality without internet
- Local AI model for core queries
- Local database for all system data
- Sync when connectivity returns (optional cloud features)

---

## Version 2 (Months 6–12) — "The Intelligent Assistant"

### Advanced AI — `CoPilot Pro`
- Multi-step troubleshooting workflows
- Root-cause ranking with confidence scores
- Automated fix recommendations with dry-run preview
- Runbook generation from common workflows
- Incident learning (improve suggestions from past resolutions)
- RAG over vendor manuals, API docs, and knowledge base
- "Explain this outage in plain English"

### Advanced Labeling — `LabelForge Pro`
- Full naming convention engine (rules, patterns, inheritance)
- Rack elevation label generation
- Stage box / patch panel labeling
- QR code generation linked to live device data
- Cable labeling with source→destination and signal type
- Print workflow integration (Brother, Dymo, Brady, PDF)
- VLAN / network labeling
- Label sync — labels update when topology changes
- Batch label operations

### Documentation Generator — `DocBuilder`
- Auto-generated system documentation from live graph
- Signal flow diagrams (auto-laid-out)
- Rack elevation drawings
- Patch sheets (input/output matrices)
- Network diagrams
- Equipment lists with firmware/serial/IP
- PDF, HTML, and printable output
- Template system for branding

### Preflight & Post-Show — `FlightCheck`
- Auto-generated preflight checklists from system topology
- Per-device health checks
- Per-signal-path verification
- Expected vs. actual state comparison
- Post-show report generation
- Tour stop comparison (this venue vs. last venue)

### Multi-User — `TeamSync`
- Role-based access (operator, engineer, viewer, admin)
- Approval workflows for changes
- Activity feed (who changed what, when)
- Shared show files
- Conflict resolution

### Connector SDK — `ConnectorKit`
- Public SDK for building vendor connectors
- Connector testing sandbox
- Connector versioning and updates
- Community connector marketplace (curated)

---

## Long-Term Platform (Year 1–2+) — "The AV Operating System"

### Fleet Management — `FleetView`
- Multi-venue / multi-system dashboard
- Firmware compliance across fleet
- Standardized configurations across venues
- Centralized alerting
- Remote system access

### Predictive Intelligence — `PredictAV`
- Pattern detection from historical data
- "This device type tends to fail after X hours"
- Proactive maintenance alerts
- Capacity planning
- Performance trending

### Simulation Engine — `SimRoute`
- "What if" routing simulations before live changes
- Impact analysis for proposed changes
- Load / bandwidth simulation
- Failover testing in simulation mode

### Workflow Automation — `ActionFlow`
- Custom automation sequences
- Scheduled actions (e.g., nightly config backup)
- Event-triggered actions (e.g., alert → auto-failover)
- Approval-gated automation chains
- Integration with show control (timecode triggers)

### API & Integrations — `OpenGraph`
- REST API for external tools
- Webhook system for events
- Integration with Slack, Teams, PagerDuty
- Integration with D-Tools, Vectorworks for design sync
- SMPTE ST 2110 / NMOS full support
- sACN / Art-Net universe management

### Marketplace — `ConnectorHub`
- Third-party connector submissions
- Verified connector program
- Revenue sharing for connector developers
- Connector usage analytics

---

## Feature Priority Matrix

| Feature | User Value | Technical Complexity | MVP? |
|---------|-----------|---------------------|------|
| AutoScan (Discovery) | 🔴 Critical | Medium | ✅ |
| SystemMap (Topology) | 🔴 Critical | Medium | ✅ |
| PathTrace (Signal Tracing) | 🔴 Critical | High | ✅ |
| DeviceView (Inspector) | 🟡 High | Low | ✅ |
| ConfigGuard (Snapshots) | 🟡 High | Medium | ✅ |
| LabelForge (Basic Labels) | 🟡 High | Low | ✅ |
| CoPilot (Basic AI) | 🔴 Critical | High | ✅ |
| ChangeTrack (Audit Log) | 🟡 High | Low | ✅ |
| CoPilot Pro (Advanced AI) | 🔴 Critical | Very High | V2 |
| LabelForge Pro (Full Labels) | 🟡 High | Medium | V2 |
| DocBuilder (Documentation) | 🟡 High | Medium | V2 |
| FlightCheck (Preflight) | 🟡 High | Medium | V2 |
| TeamSync (Multi-User) | 🟢 Medium | High | V2 |
| ConnectorKit (SDK) | 🟡 High | High | V2 |
| FleetView (Fleet Mgmt) | 🟢 Medium | High | Platform |
| SimRoute (Simulation) | 🟢 Medium | Very High | Platform |
| ActionFlow (Automation) | 🟢 Medium | High | Platform |
| PredictAV (Predictive) | 🟢 Medium | Very High | Platform |
