# Luminex GigaCore Scanner & Batch Programmer

## Development Map — Claude Code Deployment Ready

-----

## 1. PROJECT OVERVIEW

**App Name:** GigaCore Command
**Purpose:** Network scanner that discovers all Luminex GigaCore switches on the local network, displays them in a visual topology, and provides batch programming of Groups (VLANs), port settings, IGMP, PoE, trunks, profiles, and firmware — all from a single GUI. Supports Excel-driven IP schemes and profile deployment, custom rack/location maps with device grouping, comprehensive data logging, and built-in troubleshooting tools.

**Target Platform:** Electron + React desktop app (Windows primary, macOS secondary)
**Tech Stack:** Electron + Vite + React + TypeScript + Tailwind CSS
**Why Electron:** Same stack as AV Rack AI — code reuse, familiar build pipeline, cross-platform

-----

## 2. RESEARCH FINDINGS — PROTOCOLS & APIs

### 2.1 Discovery Protocols

GigaCore switches support multiple discovery mechanisms. We'll use a **layered approach** for maximum reliability:

| Protocol | Details | Reference |
|----------|---------|-----------|
| **mDNS (Multicast DNS)** | Gen2 switches (30i, 10i, 16t, 18t, 20t, etc.) have mDNS enabled by default. Araneo uses mDNS to discover LumiNodes. Service type likely `_http._tcp` or Luminex-proprietary. | [GigaCore 30i Manual](https://www.luminex.be/wp-content/uploads/doccenter/User-Manual_GigaCore-30i_rev-1.0.1.pdf) — IP Settings section confirms mDNS toggle |
| **LLDP (IEEE 802.1ab)** | All Gen2 switches transmit LLDP frames. Contains model, firmware, port info, and topology data. GigaCore 30i specs confirm 802.1ab compliance. | [GigaCore 30i Specs](https://www.luminex.be/products/gigacore/gigacore-10i/) — IEEE 802.1ab LLDP listed |
| **IP Subnet Scan + HTTP Probe** | Every GigaCore has a web UI on its management IP (default: printed on rear label). Default creds: `admin` / no password. Scan the subnet range and probe for the REST API or web UI signature. | [GigaCore 10 Manual](https://www.luminex.be/wp-content/uploads/doccenter/GigaCore_10_User_Manual-rev-2.8.5.pdf) |
| **ARP Table + MAC OUI** | Luminex's IEEE OUI prefix identifies their devices at L2 before any IP-level probing. | Standard network discovery technique |

**Recommended Discovery Strategy:**

1. **Primary:** mDNS browse (`dns-sd` / `bonjour`) — instant, zero-config
2. **Secondary:** Subnet scan + HTTP probe on port 80 to `/api/` endpoints
3. **Tertiary:** LLDP passive listener for topology mapping
4. **Fallback:** Manual IP entry for isolated/VLAN'd switches

### 2.2 GigaCore API — Two Generations

#### Gen 1 (GigaCore 12, 14R, 16Xt, 16RFO) — HTTP Commands

- **Protocol:** HTTP GET/POST commands
- **Auth:** `admin` / blank password (Basic Auth)
- **Documentation:** [Luminex Support: Gen1 HTTP Commands](https://support.luminex.be/portal/en/kb/articles/gigacore-http-commands)
- **Also accessible via:** SSH/CLI interface for advanced config (e.g., LLDP per-port control)

#### Gen 2 (GigaCore 30i, 10i, 16t, 18t, 20t, 10t, 16i) — REST API + WebSocket

- **Protocol:** REST API (JSON) for configuration + WebSocket for real-time status/state sync
- **Built-in REST Client:** Available at `http://<IP>/__rest-client.html` on every Gen2 switch
- **Auth:** Default no username/password; optional credentials configurable
- **Documentation:** [Luminex Support: Gen2 API Documentation](https://support.luminex.be/portal/en/kb/articles/gigacore-api-documentation)
- **Reference Implementation:** [Q-SYS Plugin for GigaCore](https://support.luminex.be/portal/en/kb/articles/quick-start-q-sys-plugin-for-luminex-gigacore) — confirms REST + WebSocket architecture
- **Open Source Reference:** [Bitfocus Companion Module](https://github.com/bitfocus/companion-module-luminex-gigacore) — TypeScript, MIT licensed, shows actual API usage patterns

#### Known API Endpoints (from Allen & Heath support article + REST client)

```
Base URL: http://<SWITCH_IP>/api/

# LLDP Control (confirmed working)
GET  /api/lldp/port/<port_number>         → port LLDP state
PUT  /api/lldp/port/<port_number>/tx      → payload: "true" | "false"

# Likely endpoints (based on web UI feature parity):
GET  /api/status                          → switch status overview
GET  /api/groups                          → VLAN/Group configuration
PUT  /api/groups/<group_id>               → modify group settings
GET  /api/ports                           → port configuration
PUT  /api/ports/<port_id>/group           → assign port to group
GET  /api/poe                             → PoE status & settings
GET  /api/rlinkx                          → redundancy status
GET  /api/igmp                            → IGMP snooping settings
GET  /api/profiles                        → stored profiles
POST /api/profiles/recall/<n>             → recall profile
POST /api/profiles/store/<n>              → store profile
POST /api/firmware/upgrade                → firmware upload
GET  /api/system                          → system info (model, MAC, serial, FW version)
POST /api/system/reboot                   → reboot switch
POST /api/system/reset                    → factory reset
```

**WebSocket endpoint:** `ws://<SWITCH_IP>/ws` (subscription-based state sync)

> **IMPORTANT:** The full Gen2 API doc is behind Luminex's support portal login. The above endpoints are reverse-engineered from the A&H support article, Q-SYS plugin references, and the built-in REST client. When developing, use `http://<IP>/__rest-client.html` on any Gen2 switch to explore all available endpoints interactively.

### 2.3 Profile System

GigaCore switches have a built-in profile manager. Profiles can be:

- Stored/recalled via the web UI
- Downloaded to a computer as files
- Deployed network-wide via Araneo
- Managed via the API (store/recall/delete)

This is key for batch programming — create a "gold" profile, then deploy to all selected switches.

### 2.4 What Araneo Already Does (Gap Analysis)

Araneo is Luminex's official tool. Understanding its capabilities tells us where our app adds value:

| Feature | Araneo | Our App (GigaCore Command) |
|---------|--------|----------------------------|
| Discovery | Yes (mDNS + proprietary) | Yes (mDNS + subnet scan + LLDP) |
| Topology view | Yes | Yes (simplified, AV-focused) |
| Individual config | Yes | Yes |
| **Batch config** | **Limited (per group/port selection)** | **YES — primary differentiator** |
| Profile deploy | Yes (full project deploy) | Yes (selective per-switch) |
| Firmware batch update | Yes | Yes |
| Health check | Yes | Yes (with custom rules) |
| Offline planning | Yes | No (online-only) |
| **Show/Tour presets** | **No** | **YES — save/recall entire network states** |
| **Excel-driven IP/profile deploy** | **No** | **YES — import .xlsx to deploy IP schemes + profiles** |
| **Custom rack/location maps** | **No** | **YES — visual grouping by rack, zone, stage position** |
| **Data logging & troubleshooting** | **Basic logs** | **YES — full event log, port stats, error history, diagnostics** |
| **Discovered device inventory** | **Edge devices shown** | **YES — all LLDP/mDNS neighbors cataloged, not just switches** |
| **Integration with AV Rack AI** | **No** | **Potential future bridge** |

-----

## 3. APP ARCHITECTURE

```
┌──────────────────────────────────────────────────────────────┐
│                       ELECTRON SHELL                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                RENDERER (React + Tailwind)              │  │
│  │                                                        │  │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │  │ Scanner │ │ Rack Map │ │ Batch    │ │  Logs &  │  │  │
│  │  │  View   │ │  View    │ │ Config   │ │  Diag    │  │  │
│  │  └────┬────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │  │
│  │       │           │            │             │         │  │
│  │  ┌────┴───────────┴────────────┴─────────────┴──────┐  │  │
│  │  │            State Manager (Zustand)                │  │  │
│  │  └──────────────────────┬───────────────────────────┘  │  │
│  └─────────────────────────┼──────────────────────────────┘  │
│                            │ IPC                              │
│  ┌─────────────────────────┼──────────────────────────────┐  │
│  │                MAIN PROCESS (Node.js)                   │  │
│  │                                                        │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │  │ Discovery│ │ API      │ │ Profile  │ │ Excel    │  │  │
│  │  │ Engine   │ │ Client   │ │ Manager  │ │ Importer │  │  │
│  │  │          │ │(REST+WS) │ │          │ │          │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │  │ mDNS     │ │ LLDP     │ │ Firmware │ │ Data     │  │  │
│  │  │ Browser  │ │ Listener │ │ Updater  │ │ Logger   │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │  │
│  │  ┌──────────┐ ┌──────────┐                            │  │
│  │  │ Rack Map │ │ Trouble- │                            │  │
│  │  │ Engine   │ │ shooter  │                            │  │
│  │  └──────────┘ └──────────┘                            │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 3.1 Module Breakdown

#### Discovery Engine (`/src/main/discovery/`)

```
discovery/
  ├── mdns-scanner.ts         # mDNS/Bonjour browser using 'bonjour-service' npm
  ├── subnet-scanner.ts       # IP range scan + HTTP probe
  ├── lldp-listener.ts        # Raw socket LLDP frame parser (topology)
  ├── mac-oui-resolver.ts     # Luminex OUI lookup for L2 identification
  ├── discovered-devices.ts   # Catalog of ALL discovered network devices (not just GigaCore)
  ├── discovery-manager.ts    # Orchestrates all methods, deduplicates results
  └── types.ts                # DiscoveredSwitch, DiscoveredDevice interfaces
```

**Key npm packages:**

- `bonjour-service` — mDNS browser/publisher
- `node-arp` — ARP table access
- `raw-socket` — LLDP frame capture (optional, admin required)
- `ip` — subnet calculations

#### API Client (`/src/main/api/`)

```
api/
  ├── gigacore-client.ts      # Unified REST client (handles Gen1 + Gen2)
  ├── websocket-client.ts     # WebSocket subscription manager (Gen2)
  ├── auth.ts                 # Credential management per switch
  ├── api-types.ts            # TypeScript interfaces for all API responses
  └── batch-executor.ts       # Queued batch operations with rollback
```

**Key npm packages:**

- `axios` — HTTP client
- `ws` — WebSocket client
- `p-queue` — Rate-limited batch execution

#### Excel Import Engine (`/src/main/excel/`)

```
excel/
  ├── excel-parser.ts         # Read .xlsx files, validate structure, extract data
  ├── ip-scheme-importer.ts   # Parse IP scheme sheets → deploy-ready IP plan
  ├── profile-importer.ts     # Parse profile sheets → switch profile configs
  ├── template-generator.ts   # Generate blank .xlsx templates for users to fill in
  ├── validation.ts           # Validate IPs, subnets, VLAN IDs, naming conventions
  └── types.ts                # ExcelIPScheme, ExcelProfile interfaces
```

**Key npm packages:**

- `exceljs` — Read/write .xlsx files with full formatting support
- `xlsx` (SheetJS) — Lightweight alternative parser

**Excel IP Scheme Template Format (generated by app):**

```
Sheet: "IP Scheme"
┌──────────────┬───────────┬──────────────┬────────┬──────────┬──────────┬──────────────┐
│ Switch Name  │ Model     │ Management IP│ Subnet │ Gateway  │ VLAN Mgmt│ Location/Rack│
├──────────────┼───────────┼──────────────┼────────┼──────────┼──────────┼──────────────┤
│ FOH-SW-01    │ GC-30i    │ 10.0.1.10    │ /24    │ 10.0.1.1 │ 100      │ FOH Rack A   │
│ FOH-SW-02    │ GC-18t    │ 10.0.1.11    │ /24    │ 10.0.1.1 │ 100      │ FOH Rack A   │
│ STG-SW-01    │ GC-10t    │ 10.0.2.10    │ /24    │ 10.0.2.1 │ 100      │ Stage Rack 1 │
│ MON-SW-01    │ GC-16t    │ 10.0.3.10    │ /24    │ 10.0.3.1 │ 100      │ Monitor World│
│ DIST-SW-01   │ GC-30i    │ 10.0.1.20    │ /24    │ 10.0.1.1 │ 100      │ Distro Rack  │
└──────────────┴───────────┴──────────────┴────────┴──────────┴──────────┴──────────────┘

Sheet: "Port Assignments"
┌──────────────┬───────┬───────────┬──────────┬──────────────────────┐
│ Switch Name  │ Port  │ Group/VLAN│ Label    │ Notes                │
├──────────────┼───────┼───────────┼──────────┼──────────────────────┤
│ FOH-SW-01    │ 1     │ D3 Net    │ D3-GX2C  │ Disguise primary     │
│ FOH-SW-01    │ 2     │ D3 Net    │ D3-GX3   │ Disguise backup      │
│ FOH-SW-01    │ 3     │ NDI       │ NDI-CAM1 │ PTZ camera 1         │
│ FOH-SW-01    │ 4-8   │ Dante Pri │ DANTE    │ Dante primary        │
│ FOH-SW-01    │ ISL1  │ ISL       │ TO-STG   │ ISL to Stage Rack    │
└──────────────┴───────┴───────────┴──────────┴──────────────────────┘

Sheet: "Group Definitions"
┌──────────┬─────────┬─────────┬───────┬─────────┬─────────┬──────────┐
│ Group #  │ Name    │ VLAN ID │ Color │ IGMP Sn │ Querier │ Flooding │
├──────────┼─────────┼─────────┼───────┼─────────┼─────────┼──────────┤
│ 1        │ Mgmt    │ 100     │ Blue  │ ON      │ ON      │ OFF      │
│ 2        │ D3 Net  │ 10      │ Green │ ON      │ ON      │ OFF      │
│ 3        │ NDI     │ 30      │ Orange│ ON      │ ON      │ OFF      │
│ 4        │ Dante P │ 1300    │ Red   │ ON      │ ON      │ OFF      │
│ 5        │ Dante S │ 1301    │ Pink  │ ON      │ ON      │ OFF      │
└──────────┴─────────┴─────────┴───────┴─────────┴─────────┴──────────┘
```

**Excel Profile Template Format:**

```
Sheet: "Profile Config"
┌──────────────┬───────────────┬──────────────────────────────────────┐
│ Switch Name  │ Profile Name  │ Profile Description                  │
├──────────────┼───────────────┼──────────────────────────────────────┤
│ FOH-SW-01    │ PM-TOUR-FOH   │ Post Malone Tour - FOH config        │
│ FOH-SW-02    │ PM-TOUR-FOH   │ Post Malone Tour - FOH config        │
│ STG-SW-01    │ PM-TOUR-STG   │ Post Malone Tour - Stage config      │
│ MON-SW-01    │ PM-TOUR-MON   │ Post Malone Tour - Monitor config    │
└──────────────┴───────────────┴──────────────────────────────────────┘

Sheet: "Profile: PM-TOUR-FOH"
(Full group/port/IGMP/PoE config for that profile — same columns as Port Assignments + Group Definitions)

Sheet: "Profile: PM-TOUR-STG"
(Same structure, different config values)
```

#### Profile Manager (`/src/main/profiles/`)

```
profiles/
  ├── profile-store.ts        # Local profile storage (JSON + SQLite)
  ├── profile-diff.ts         # Compare two switch configs
  ├── show-presets.ts         # Named presets for entire network states
  ├── excel-profile-bridge.ts # Bridge between Excel imports and profile system
  └── import-export.ts        # Araneo project file compatibility (future)
```

#### Rack Map Engine (`/src/main/rack-map/`)

```
rack-map/
  ├── rack-map-store.ts       # Persist custom map layouts to disk
  ├── rack-group-manager.ts   # Manage user-defined groups (racks, zones, stages)
  ├── layout-engine.ts        # Auto-arrange switches within groups
  └── types.ts                # RackGroup, MapPosition, Zone interfaces
```

#### Data Logger (`/src/main/logging/`)

```
logging/
  ├── event-logger.ts         # Timestamped log of all events (discovery, config changes, errors)
  ├── port-stats-collector.ts # Periodic polling of port traffic stats, error counters
  ├── health-monitor.ts       # Continuous health checks (link status, temp, fan, PoE budget)
  ├── log-database.ts         # SQLite database for log persistence + queries
  ├── log-exporter.ts         # Export logs to CSV/Excel/JSON
  └── types.ts                # LogEntry, PortStats, HealthSnapshot interfaces
```

**Key npm packages:**

- `better-sqlite3` — Fast embedded SQLite for log storage
- `winston` — Structured logging framework

#### Troubleshooter (`/src/main/troubleshoot/`)

```
troubleshoot/
  ├── ping-sweep.ts           # ICMP ping to all switches, latency tracking
  ├── port-diagnostics.ts     # Per-port error counters (CRC, collisions, drops, runts)
  ├── vlan-consistency.ts     # Cross-switch VLAN config consistency checker
  ├── igmp-auditor.ts         # Verify IGMP querier presence per VLAN, snooping state
  ├── firmware-auditor.ts     # Flag mismatched firmware versions across fleet
  ├── rlinkx-validator.ts     # Validate redundancy ring health and failover paths
  ├── poe-budget-checker.ts   # Verify PoE budget vs actual draw, flag oversubscription
  ├── cable-tester.ts         # Link speed vs cable capability check (1G link on 10G port = flag)
  ├── troubleshoot-engine.ts  # Orchestrates all checks, generates report
  └── types.ts                # DiagnosticResult, HealthReport interfaces
```

### 3.2 React Views (`/src/renderer/`)

```
renderer/
  ├── views/
  │   ├── ScannerView.tsx           # Discovery + device list (GigaCore + all discovered devices)
  │   ├── RackMapView.tsx           # Custom visual map with rack groupings
  │   ├── TopologyView.tsx          # Auto-generated LLDP network topology
  │   ├── DeviceDetailView.tsx      # Single switch deep-dive
  │   ├── BatchConfigView.tsx       # Multi-switch programming
  │   ├── ExcelImportView.tsx       # Excel file import wizard (IP scheme + profiles)
  │   ├── ProfilesView.tsx          # Profile/preset management
  │   ├── LogsView.tsx              # Event log viewer with filters + search
  │   ├── TroubleshootView.tsx      # Diagnostics dashboard + health reports
  │   ├── DiscoveredDevicesView.tsx  # All discovered network devices (non-GigaCore)
  │   └── SettingsView.tsx          # App settings, credentials, polling intervals
  ├── components/
  │   ├── SwitchCard.tsx            # Device summary card with health indicator
  │   ├── DiscoveredDeviceCard.tsx  # Card for non-GigaCore discovered devices
  │   ├── PortGrid.tsx              # Visual port layout (colored by group)
  │   ├── GroupEditor.tsx           # VLAN/Group assignment UI
  │   ├── BatchSelector.tsx         # Multi-select switches for batch ops
  │   ├── FirmwareUploader.tsx      # Drag-drop firmware upload
  │   ├── HealthIndicator.tsx       # Traffic light status + hover detail
  │   ├── TopologyGraph.tsx         # D3/React Flow network diagram
  │   ├── RackGroup.tsx             # Draggable rack container with switch slots
  │   ├── RackSwitch.tsx            # Switch representation inside a rack group
  │   ├── ExcelDropzone.tsx         # Drag-drop .xlsx file loader
  │   ├── ExcelPreview.tsx          # Preview parsed Excel data before deploy
  │   ├── IPSchemeTable.tsx         # Editable table showing IP scheme from Excel
  │   ├── ProfileTable.tsx          # Editable table showing profile from Excel
  │   ├── LogTable.tsx              # Virtualized scrolling log table with filters
  │   ├── DiagnosticCard.tsx        # Individual diagnostic check result
  │   ├── HealthReport.tsx          # Full network health summary
  │   └── PortStatsChart.tsx        # Recharts-based port traffic/error graphs
  ├── store/
  │   ├── useAppStore.ts            # Zustand global state
  │   ├── useLogStore.ts            # Log entries state + filter state
  │   └── useRackMapStore.ts        # Rack map layout persistence
  └── App.tsx
```

-----

## 4. FEATURE SPECIFICATION

### 4.1 Scanner View

- **Auto-scan on launch** — mDNS + subnet scan of all local network interfaces
- **Manual IP/range entry** — for VLANed or remote switches
- **Device cards** showing: Model, IP, MAC, FW version, PoE status, port count, online/offline
- **Color-coded status** — Green (online/healthy), Yellow (needs update or warning), Red (error/unreachable)
- **Refresh** button + auto-refresh interval (configurable)
- **Filter/sort** by model, IP range, firmware version, group assignments, rack/location
- **Discovery badge count** — shows total discovered GigaCore switches + total other network devices
- **Quick actions per card** — Ping, Open Web UI, Add to Rack Map, View Logs

### 4.2 Discovered Devices View (NEW)

All network devices found during scanning — not just GigaCore switches. This gives the tech a full picture of what's on the network.

- **Device catalog** — every device found via mDNS, ARP, LLDP neighbor tables
- **Data per device:**
  - MAC address + OUI manufacturer lookup (Luminex, Audinate, QSC, MA Lighting, etc.)
  - IP address (if resolved)
  - Hostname / mDNS service name
  - Protocol type detected (Dante, Art-Net, sACN, NDI, MANet, etc.)
  - Which GigaCore port it's connected to (from LLDP neighbor data)
  - Link speed
  - First seen / last seen timestamps
- **Filtering** — by manufacturer, protocol, connected switch, VLAN
- **Export** — CSV/Excel dump of entire device inventory
- **Use case:** "Show me every Dante device on the network and which switch port each one is plugged into"

### 4.3 Custom Rack Map View (NEW — Primary Visual Interface)

User-created visual layout that mirrors the physical show setup. This is the "home screen" view for day-of-show operations.

- **Create groups** — user defines named groups representing physical locations:
  - `FOH Rack A`, `FOH Rack B`, `Stage Left Rack`, `Stage Right Rack`, `Monitor World`, `Broadcast Truck`, `Distro`, etc.
- **Drag switches into groups** — from the scanner/discovery list, drag-and-drop switches into rack groups
- **Auto-populate from Excel** — if the Excel IP scheme has a `Location/Rack` column, auto-create groups and assign switches on import
- **Visual layout per group:**
  - Each rack group renders as a container/card with its name
  - Switches inside render as mini-cards showing: name, IP, model, health status color
  - Each switch mini-card shows port grid thumbnail (colored dots for group assignments)
  - Click any switch → opens Device Detail View
- **Group health rollup** — rack group header shows aggregate health (worst-case of all switches in group)
- **Inter-group connections** — lines showing ISL/trunk links between groups (which racks are connected)
- **Drag to rearrange** — reposition rack groups on the canvas to match physical stage plot
- **Zoom + pan** — canvas navigation for large deployments
- **Save/load layouts** — persist map layouts per show/tour
  - Layouts saved to local SQLite + exportable as JSON
  - Load a layout → if switch IPs match discovered devices, auto-bind; if not, flag unresolved
- **Status overlay modes:**
  - **Default:** Group assignment colors
  - **PoE mode:** Green/yellow/red based on PoE budget usage
  - **Health mode:** Error/warning indicators per switch
  - **Traffic mode:** Port utilization heat map (if stats available)

### 4.4 Topology View (Auto-Generated)

- **Auto-generated network map** from LLDP neighbor data + ISL/trunk detection
- **Interactive D3 or React Flow graph** — drag nodes, zoom, pan
- **Color-coded links** — ISL trunks, RLinkX redundancy paths, PoE links
- **Click any node** → opens Device Detail View
- **Export topology** as PNG/SVG for documentation
- **Discovered devices shown** — non-GigaCore devices appear as smaller leaf nodes connected to their switch port

### 4.5 Device Detail View

- **Status dashboard** — real-time via WebSocket (Gen2) or polling (Gen1)
- **Port grid** — visual representation matching physical switch layout
  - Color per Group/VLAN (matches Luminex's color scheme)
  - PoE status per port
  - Link speed indicators
  - Connected device name (from LLDP/discovered devices)
  - Click port → assign to Group, configure speed, enable/disable
- **Groups panel** — view/edit all 20+ Groups (VLANs)
  - VLAN ID, name, color, IGMP snooping toggle, querier toggle, unknown flooding
- **Trunks panel** — ISL and custom trunk management
- **PoE panel** — budget overview, per-port allocation, priority settings
- **RLinkX panel** — redundancy status, ring topology health
- **System info** — MAC, serial, firmware, temperature, fan status
- **Port statistics** — per-port TX/RX bytes, packets, errors, drops (graphed over time)
- **Event log** — filtered log showing only events for this specific switch
- **Quick diagnostics** — one-click health check for this switch

### 4.6 Excel Import System (NEW)

#### IP Scheme Import

1. **Load .xlsx** — drag-drop or file picker
2. **Auto-detect sheets** — parser identifies IP Scheme, Port Assignments, Group Definitions sheets by header matching
3. **Validation pass:**
   - All IPs are valid and in correct subnet
   - No duplicate IPs
   - VLAN IDs in valid range (1-4094)
   - Switch names are unique
   - Referenced groups exist in Group Definitions
   - Port numbers valid for the specified model
4. **Preview table** — editable grid showing parsed data with validation errors highlighted in red
5. **Match to discovered switches** — auto-match by current IP, MAC, or model+name; flag unmatched rows
6. **Deploy options:**
   - Deploy IP addresses only
   - Deploy IPs + group definitions
   - Deploy IPs + groups + port assignments
   - Full deploy (everything)
7. **Staged deployment** — applies changes one switch at a time with progress bar; pauses on error with skip/retry/abort options
8. **Post-deploy verification** — re-polls all switches to confirm settings took effect

#### Profile Import from Excel

1. **Load .xlsx** — same drop zone, parser detects profile sheets
2. **Profile sheets** — each tab named `Profile: <PROFILE_NAME>` contains full switch config
3. **Match profiles to switches** — using the `Profile Config` sheet as the mapping
4. **Deploy** — pushes config to matched switches, stores as named profile on each switch
5. **Re-export** — after deploying, can re-export current live state to Excel for documentation

#### Template Generator

- **"Download Template"** button in Excel Import view
- Generates a pre-formatted .xlsx with:
  - All sheet tabs with correct headers and column formatting
  - Dropdown validation lists for Group colors, IGMP ON/OFF, models
  - Example rows filled in with common Solotech VLAN standards (D3 Net=10, NDI=30, Dante Pri=1300, etc.)
  - Conditional formatting rules (duplicate IP highlight, invalid subnet highlight)
  - Instructions sheet explaining each column

### 4.7 Batch Config View

- **Multi-select switches** from scanner list, rack map, or topology
- **Batch operations:**
  - **Set Groups/VLANs** — apply identical group config across all selected switches
  - **Port assignment** — assign port ranges to specific groups across the fleet
  - **IGMP settings** — enable/disable snooping, querier, flooding per group
  - **PoE settings** — enable/disable, set priorities
  - **Device naming** — sequential naming (e.g., "FOH-SW-01", "FOH-SW-02", etc.)
  - **IP addressing** — sequential IP assignment from a base address
  - **Profile deploy** — push a stored profile to all selected switches
  - **Firmware update** — batch firmware push with progress tracking
  - **Reboot all** — coordinated reboot with staggered timing
  - **Factory reset** — with confirmation safeguards
- **Import from Excel** — one-click bridge to load batch config from .xlsx file
- **Preview mode** — shows diff of what will change before applying
- **Progress tracker** — per-switch progress with success/fail indicators
- **Rollback** — store pre-change state, offer undo on failure
- **All batch operations are logged** — every change recorded in event log

### 4.8 Show Presets

- **Save current network state** as a named preset (e.g., "Post Malone Tour", "Festival Stage A")
- **Recall preset** — batch-configure all switches to match saved state
- **Diff view** — compare current state vs preset, highlight changes
- **Export/import** presets as JSON files for sharing between crews
- **Export preset to Excel** — generates a filled-in .xlsx matching the import template format
- **Import preset from Excel** — create a show preset from an Excel file

### 4.9 Data Logging & Event History (NEW)

#### Event Log

Every significant event is timestamped and stored in SQLite:

| Log Category | Events Captured |
|-------------|-----------------|
| **Discovery** | Switch found, switch lost, IP changed, firmware version changed |
| **Config Changes** | Group assigned, port changed, IGMP toggled, PoE changed, IP changed, profile recalled, name changed |
| **Batch Operations** | Batch started, per-switch progress, batch completed/failed, rollback triggered |
| **Excel Import** | File loaded, validation results, deploy started, deploy results |
| **Health** | Temperature warning, fan failure, PoE overload, RLinkX failover, link down, link up |
| **Errors** | API timeout, auth failure, unreachable switch, invalid response, WebSocket disconnect |
| **User Actions** | Manual scan triggered, settings changed, preset saved/recalled, export performed |

#### Log Viewer (LogsView.tsx)

- **Virtualized scrolling table** — handles 100k+ entries without lag
- **Real-time streaming** — new events appear at top as they happen
- **Filters:**
  - By category (Discovery, Config, Health, Error, etc.)
  - By switch (show only events for a specific device)
  - By severity (Info, Warning, Error, Critical)
  - By date/time range
  - Free text search across all log fields
- **Export** — filtered results to CSV, Excel, or JSON
- **Log retention** — configurable (default: 90 days, auto-purge oldest)

#### Port Statistics Logging

- **Periodic collection** — configurable interval (default: 60 seconds)
- **Data captured per port:**
  - TX/RX bytes, packets
  - Broadcast/multicast/unicast counts
  - Error counters: CRC errors, collisions, runts, jabbers, drops
  - Link flap count (up/down transitions)
  - PoE power draw (watts)
- **Stored in SQLite** — time-series data, queryable for graphing
- **Graphed in UI** — Recharts line/area charts on Device Detail View and Troubleshoot View

### 4.10 Troubleshooting Dashboard (NEW)

One-click network health assessment with actionable diagnostics.

#### Health Checks (run individually or as full suite)

| Check | What It Does | Pass/Fail Criteria |
|-------|-------------|-------------------|
| **Ping Sweep** | ICMP ping all known switches | >100ms latency = warning, timeout = fail |
| **Firmware Consistency** | Compare FW versions across fleet | All switches should match; mismatches flagged |
| **VLAN Consistency** | Compare group definitions across ISL-connected switches | Group names, VLAN IDs, IGMP settings should match |
| **IGMP Auditor** | Verify exactly one querier per VLAN in the network | Missing querier = critical; multiple queriers = warning |
| **PoE Budget** | Check actual draw vs budget per switch | >80% = warning, >95% = critical |
| **RLinkX Validation** | Verify redundancy rings are intact | Open ring or failed link = critical |
| **Port Error Check** | Flag ports with elevated CRC/collision/drop counters | Any non-zero error counter = warning; trending up = critical |
| **Link Speed Audit** | Detect mismatched link speeds (e.g., 100M on a Gig port) | Unexpected speed = warning (may indicate bad cable) |
| **Cable/SFP Check** | Flag SFP ports running below expected speed | 1G SFP in 10G slot = informational |
| **Temperature** | Read internal temp sensor | >45°C = warning, >50°C = critical |
| **Fan Status** | Check fan RPM/status | Failed fan = critical |

#### Diagnostic Report

- **Summary view** — green/yellow/red cards per check category
- **Drill-down** — click any card to see per-switch details
- **Export report** — PDF or Excel health report for documentation/handoff
- **Auto-run on schedule** — configurable (e.g., every 15 minutes during show)
- **Notification system** — desktop notification on critical health change

#### Live Troubleshooting Tools

- **Ping tool** — ping any switch from the app with latency graph
- **Port blink** — trigger LED identification on a specific switch port (if API supports)
- **Cable test** — initiate cable diagnostics on copper ports (if supported by switch hardware)
- **Packet counter reset** — zero out port counters for a clean baseline
- **Quick compare** — select two switches, side-by-side diff of all settings

-----

## 5. DEVELOPMENT PHASES

### Phase 1: Foundation (Week 1-2)

- [ ] Electron + Vite + React + TypeScript scaffold (mirror AV Rack AI structure)
- [ ] mDNS discovery module
- [ ] Subnet scanner with HTTP probe
- [ ] Basic REST API client (Gen2 focus)
- [ ] Zustand store for discovered devices
- [ ] Scanner View with device cards
- [ ] SQLite database setup for logs + state persistence
- [ ] Event logger foundation (log all discovery events from day one)

### Phase 2: Device Control + Discovered Devices (Week 3-4)

- [ ] Device Detail View with port grid
- [ ] Group/VLAN editor
- [ ] WebSocket real-time status (Gen2)
- [ ] Polling fallback (Gen1)
- [ ] PoE monitoring panel
- [ ] Profile store/recall via API
- [ ] Discovered Devices View (all non-GigaCore network devices)
- [ ] LLDP neighbor table integration (which device on which port)

### Phase 3: Excel Import System (Week 5-6)

- [ ] ExcelJS integration + parser
- [ ] IP Scheme template generator
- [ ] IP Scheme import with validation + preview
- [ ] Profile template generator
- [ ] Profile import with validation + preview
- [ ] Deploy engine for IP schemes (staged, with progress)
- [ ] Deploy engine for profiles
- [ ] Post-deploy verification

### Phase 4: Rack Map + Batch Operations (Week 7-8)

- [ ] Rack Map View — create/edit groups, drag switches
- [ ] Auto-populate rack map from Excel Location column
- [ ] Inter-group connection visualization
- [ ] Save/load map layouts
- [ ] Batch selector component (from scanner, rack map, or topology)
- [ ] Batch executor with queue management
- [ ] Preview/diff mode
- [ ] Progress tracking UI
- [ ] Rollback system

### Phase 5: Logging, Diagnostics & Troubleshooting (Week 9-10)

- [ ] Port statistics collector (periodic polling + SQLite storage)
- [ ] Log Viewer with filters, search, real-time streaming
- [ ] Log export (CSV/Excel/JSON)
- [ ] Troubleshoot Dashboard — all health checks
- [ ] Diagnostic report generator (export to Excel/PDF)
- [ ] Port stats charting (Recharts)
- [ ] Live tools: ping, quick compare, counter reset

### Phase 6: Topology, Polish & Installer (Week 11-12)

- [ ] LLDP topology detection + auto-generated graph
- [ ] Interactive topology with React Flow
- [ ] Show Presets system (save/recall/diff/export)
- [ ] Firmware batch update
- [ ] Settings, credential management
- [ ] Rack Map overlay modes (PoE, health, traffic)
- [ ] Desktop notifications for critical health events
- [ ] Windows .exe installer build
- [ ] App icon + branding

-----

## 6. KEY DEPENDENCIES

```json
{
  "dependencies": {
    "electron": "^28.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.4.0",
    "axios": "^1.6.0",
    "ws": "^8.14.0",
    "bonjour-service": "^1.2.0",
    "p-queue": "^7.4.0",
    "ip": "^2.0.0",
    "reactflow": "^11.10.0",
    "lucide-react": "^0.294.0",
    "@electron/packager": "^18.0.0",
    "exceljs": "^4.4.0",
    "better-sqlite3": "^11.0.0",
    "winston": "^3.11.0",
    "recharts": "^2.10.0",
    "@tanstack/react-table": "^8.10.0",
    "@tanstack/react-virtual": "^3.0.0",
    "date-fns": "^3.0.0",
    "electron-store": "^8.1.0",
    "node-arp": "^1.0.6"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "typescript": "^5.3.0",
    "tailwindcss": "^3.3.0",
    "electron-builder": "^24.0.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/ws": "^8.5.0"
  }
}
```

**New dependency notes:**

- `exceljs` — Full .xlsx read/write with formatting, validation lists, conditional formatting. Needed for template generation and import parsing.
- `better-sqlite3` — Synchronous SQLite for fast log writes + queries. Stores event logs, port stats time-series, rack map layouts, show presets.
- `winston` — Structured logging with transports (console + file + SQLite).
- `recharts` — Chart library for port stats, PoE usage, latency graphs. Already available in React artifacts.
- `@tanstack/react-table` — Headless table for the log viewer and Excel preview grids.
- `@tanstack/react-virtual` — Virtualized scrolling for 100k+ log entries.
- `date-fns` — Date formatting/filtering for log viewer.

-----

## 7. DATA MODEL — SQLite Schema

```sql
-- Discovered GigaCore switches (persistent across sessions)
CREATE TABLE switches (
  id TEXT PRIMARY KEY,              -- MAC address as unique ID
  name TEXT,
  model TEXT,
  ip TEXT,
  subnet TEXT,
  gateway TEXT,
  mac TEXT UNIQUE,
  firmware TEXT,
  generation INTEGER,               -- 1 or 2
  serial TEXT,
  rack_group TEXT,                  -- FK to rack_groups.id
  last_seen DATETIME,
  first_seen DATETIME,
  is_online BOOLEAN DEFAULT 1
);

-- All discovered network devices (non-GigaCore)
CREATE TABLE discovered_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mac TEXT,
  ip TEXT,
  hostname TEXT,
  manufacturer TEXT,                -- From OUI lookup
  protocol TEXT,                    -- Dante, NDI, Art-Net, sACN, etc.
  connected_switch_mac TEXT,        -- Which GigaCore it's on
  connected_port INTEGER,           -- Which port
  link_speed TEXT,
  first_seen DATETIME,
  last_seen DATETIME,
  FOREIGN KEY (connected_switch_mac) REFERENCES switches(id)
);

-- Event log
CREATE TABLE event_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  category TEXT,                    -- discovery, config, batch, excel, health, error, user
  severity TEXT,                    -- info, warning, error, critical
  switch_mac TEXT,                  -- NULL for system-level events
  switch_name TEXT,
  message TEXT,
  details TEXT,                     -- JSON blob for structured data
  FOREIGN KEY (switch_mac) REFERENCES switches(id)
);

-- Port statistics time-series
CREATE TABLE port_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  switch_mac TEXT,
  port INTEGER,
  tx_bytes INTEGER,
  rx_bytes INTEGER,
  tx_packets INTEGER,
  rx_packets INTEGER,
  tx_broadcast INTEGER,
  rx_broadcast INTEGER,
  tx_multicast INTEGER,
  rx_multicast INTEGER,
  crc_errors INTEGER,
  collisions INTEGER,
  drops INTEGER,
  link_speed TEXT,
  poe_watts REAL,
  FOREIGN KEY (switch_mac) REFERENCES switches(id)
);
CREATE INDEX idx_port_stats_time ON port_stats(switch_mac, port, timestamp);

-- Rack map groups
CREATE TABLE rack_groups (
  id TEXT PRIMARY KEY,              -- UUID
  name TEXT,
  position_x REAL,
  position_y REAL,
  width REAL,
  height REAL,
  color TEXT,
  layout_id TEXT,                   -- FK to map_layouts.id
  sort_order INTEGER
);

-- Switch position within a rack group
CREATE TABLE rack_switch_positions (
  switch_mac TEXT,
  rack_group_id TEXT,
  slot_index INTEGER,               -- Order within the rack group
  FOREIGN KEY (switch_mac) REFERENCES switches(id),
  FOREIGN KEY (rack_group_id) REFERENCES rack_groups(id),
  PRIMARY KEY (switch_mac, rack_group_id)
);

-- Map layouts (per show/tour)
CREATE TABLE map_layouts (
  id TEXT PRIMARY KEY,              -- UUID
  name TEXT,
  description TEXT,
  created DATETIME,
  modified DATETIME,
  is_active BOOLEAN DEFAULT 0
);

-- Show presets
CREATE TABLE show_presets (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  created DATETIME,
  config_json TEXT,                  -- Full network state snapshot as JSON
  layout_id TEXT                    -- Associated rack map layout
);

-- Health check results
CREATE TABLE health_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  check_type TEXT,                  -- ping, firmware, vlan, igmp, poe, rlinkx, etc.
  switch_mac TEXT,
  status TEXT,                      -- pass, warning, fail, critical
  message TEXT,
  details TEXT                      -- JSON
);
```

-----

## 8. CRITICAL REFERENCE LINKS

| Resource | URL |
|----------|-----|
| GigaCore Product Range | https://www.luminex.be/products/gigacore/ |
| Gen2 API Documentation | https://support.luminex.be/portal/en/kb/articles/gigacore-api-documentation |
| Gen1 HTTP Commands | https://support.luminex.be/portal/en/kb/articles/gigacore-http-commands |
| Gen2 Device List | https://support.luminex.be/portal/en/kb/articles/gigacore-generation-2-devices |
| A&H Support (REST API examples) | https://support.luminex.be/portal/en/kb/articles/support-for-allen-heath-systems-gigaace-and-dx |
| Q-SYS Plugin Quick Start | https://support.luminex.be/portal/en/kb/articles/quick-start-q-sys-plugin-for-luminex-gigacore |
| Bitfocus Companion Module (TypeScript) | https://github.com/bitfocus/companion-module-luminex-gigacore |
| Luminex GitHub (Q-SYS plugin source) | https://github.com/luminex-lce |
| GigaCore 30i User Manual | https://www.luminex.be/wp-content/uploads/doccenter/User-Manual_GigaCore-30i_rev-1.0.1.pdf |
| GigaCore 10 User Manual | https://www.luminex.be/wp-content/uploads/doccenter/GigaCore_10_User_Manual-rev-2.8.5.pdf |
| Full GigaCore Manual v2.4.0 | https://www.luminex.be/wp-content/uploads/doccenter/gigacore_full_manual_v240_web-5.pdf |
| Araneo Software | https://www.luminex.be/products/software/araneo/ |
| Araneo User Manual | https://www.luminex.be/wp-content/uploads/doccenter/Araneo_User_Manual-rev-1.1.0.pdf |
| NDI on GigaCore (IGMP config) | https://support.luminex.be/portal/en/kb/articles/using-ndi-on-luminex-gigacore-switches |
| LumiNode API Documentation | https://support.luminex.be/portal/en/kb/articles/luminode-api-documentation |
| Product Downloads (firmware) | https://www.luminex.be/support-2/product-downloads/ |
| ExcelJS Documentation | https://github.com/exceljs/exceljs |
| better-sqlite3 Docs | https://github.com/WiseLibs/better-sqlite3 |
| React Flow (topology/rack map) | https://reactflow.dev/ |
| TanStack Table (log viewer) | https://tanstack.com/table/ |
| TanStack Virtual (virtualized scroll) | https://tanstack.com/virtual/ |

-----

## 9. FIRST STEPS FOR CLAUDE CODE

```bash
# 1. Scaffold the Electron project
mkdir gigacore-command && cd gigacore-command
npm create vite@latest . -- --template react-ts

# 2. Add Electron + all dependencies
npm install electron electron-builder --save-dev
npm install bonjour-service axios ws p-queue ip zustand reactflow lucide-react \
  exceljs better-sqlite3 winston recharts @tanstack/react-table \
  @tanstack/react-virtual date-fns electron-store node-arp

# 3. Structure follows AV Rack AI pattern:
# /src/main/         → Electron main process
#   /discovery/      → mDNS, subnet scan, LLDP, discovered devices
#   /api/            → REST client, WebSocket, batch executor
#   /excel/          → Excel parser, IP scheme import, profile import, template gen
#   /profiles/       → Profile store, presets, diff engine
#   /rack-map/       → Rack group manager, layout persistence
#   /logging/        → Event logger, port stats collector, SQLite database
#   /troubleshoot/   → Health checks, diagnostics, ping sweep
# /src/renderer/     → React app (views, components, store)
# /src/shared/       → Types, constants shared between processes
# /db/               → SQLite database files (auto-created)

# 4. First milestone: Discovery Engine + SQLite + Event Log
# - Set up SQLite schema (all tables)
# - Implement event-logger.ts (write to SQLite from day one)
# - Implement mdns-scanner.ts
# - Implement subnet-scanner.ts
# - Wire to ScannerView.tsx via IPC
# - Display discovered switches as cards
# - Log every discovery event
```

**Start command for Claude Code:**

> "Build the Electron + Vite + React scaffold for GigaCore Command following the architecture in the dev map. Set up the SQLite database with all tables from section 7. Implement the event logger that writes to SQLite. Then build the Discovery Engine — mDNS scanning using bonjour-service and subnet HTTP probing. Wire it to a ScannerView that shows discovered Luminex GigaCore switches as cards with model, IP, MAC, firmware version, and health status. All discovery events should be logged to SQLite."

-----

## 10. NOTES & RISKS

- **API Documentation Access:** The full Gen2 API docs are behind Luminex's support portal. The built-in REST client at `/__rest-client.html` on any Gen2 switch is the best exploration tool. Consider reaching out to Luminex support for official API docs.
- **Gen1 vs Gen2 Differences:** Gen1 uses basic HTTP commands + SSH/CLI; Gen2 has proper REST + WebSocket. The app must detect generation and use the correct client.
- **Network Segmentation:** If the app host isn't on the management VLAN, switches won't be reachable. The app should detect and warn about this.
- **Concurrent API Limits:** Unknown rate limits on switch API. Use `p-queue` with conservative concurrency (2-3 simultaneous requests per switch).
- **Firmware Updates:** Large file transfers — need chunked upload with retry logic.
- **Araneo Coexistence:** Both tools can configure switches simultaneously. No known locking mechanism — warn users about potential conflicts.
- **Excel Validation is Critical:** Bad IP schemes can brick switch accessibility. The preview + validation step must be bulletproof. Always store rollback state before any deploy.
- **SQLite Performance:** Port stats at 60-second intervals across 20+ switches with 12+ ports each = ~15k rows/day. Index on (switch_mac, port, timestamp) is essential. Auto-purge stats older than configurable retention (default 30 days).
- **Port Stats Availability:** Not all GigaCore models/firmware versions expose per-port traffic counters via API. Need graceful degradation when stats aren't available.
- **Rack Map Persistence:** Map layouts must survive app restarts. SQLite + electron-store for layout state. Export to JSON for backup/sharing.
- **Discovered Devices Accuracy:** LLDP neighbor data depends on connected devices also supporting LLDP. Many AV devices don't. mDNS/Bonjour catches Dante and some NDI devices. ARP table catches everything with an IP but gives no protocol info. Multiple methods needed for full coverage.
