# 14. UI/UX Design

## Design Philosophy: Technician-First

SignalGraph's UI is designed for someone standing at a rack, under time pressure, in a dark room, possibly wearing gloves. It is NOT designed for a product demo or investor pitch.

### UI Principles

1. **Information density over whitespace.** AV engineers want data, not decoration.
2. **Dark theme default.** Standard in production environments (bright screens in dark venues are a problem).
3. **Zero mandatory clicks.** Every view should show useful information immediately.
4. **Keyboard shortcuts for everything.** Power users don't use mice during shows.
5. **Status at a glance.** Red/green/yellow. No ambiguity.
6. **Responsive to window size.** Works on a 13" laptop and a 32" monitor.
7. **Print-friendly outputs.** Documents and labels must produce clean printable output.

---

## Application Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ ┌─────┐  SignalGraph          Tour 2026 — MSG           ⚡ Live │
│ │ Nav │  ┌──────────────────────────────────────────────────┐   │
│ │     │  │                                                  │   │
│ │ 🗺  │  │              MAIN CONTENT AREA                   │   │
│ │ Map │  │                                                  │   │
│ │     │  │     (SystemMap / DeviceView / PathTrace /         │   │
│ │ 🔍  │  │      ConfigDiff / LabelForge / FlightCheck /     │   │
│ │Trace│  │      DocBuilder / ChangeLog)                     │   │
│ │     │  │                                                  │   │
│ │ ⚠   │  │                                                  │   │
│ │Issue│  │                                                  │   │
│ │     │  │                                                  │   │
│ │ 📋  │  │                                                  │   │
│ │Label│  │                                                  │   │
│ │     │  │                                                  │   │
│ │ ⚙   │  │                                                  │   │
│ │Conf │  │                                                  │   │
│ │     │  └──────────────────────────────────────────────────┘   │
│ │ 📊  │  ┌──────────────────────────────────────────────────┐   │
│ │Audit│  │              COPILOT PANEL                        │   │
│ │     │  │  > "Trace Camera 2 to LED Wall Stage Left"       │   │
│ │ ✈   │  │  [AI response / actions / approvals]              │   │
│ │Pre- │  └──────────────────────────────────────────────────┘   │
│ │flght│                                                         │
│ └─────┘                                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Primary Screens

### 1. SystemMap — Topology View

The default landing screen. Shows the entire AV system as an interactive graph.

**Features:**
- Device nodes with status indicators (green/yellow/red)
- Signal flow edges with type indicators (video=blue, audio=green, data=gray)
- Zoom levels: System → Rack → Device → Port
- Click device → expand to show ports and connections
- Click signal path → highlight full chain
- Drag to rearrange layout
- Auto-layout options: hierarchical, force-directed, rack-based
- Grouping by: rack, location, device type, vendor
- Filter bar: search, filter by type/vendor/status
- Mini-map for navigation in large systems

**Status indicators on each node:**
```
🟢 Online, all signals good
🟡 Online, warnings (format mismatch, high temp, etc.)
🔴 Error (signal loss, device error, critical alarm)
⚫ Offline / unreachable
⚪ Unknown / not yet queried
```

### 2. PathTrace — Signal-Path Explorer

Dedicated view for tracing and analyzing signal paths.

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ SIGNAL PATH: Camera 2 → LED Wall Stage Left         │
│                                                      │
│ Source ──→ Hop 1 ──→ Hop 2 ──→ Hop 3 ──→ Dest      │
│                                                      │
│ [CAM-02]  [CVT-01]  [SW-01]   [LED-01]  [WALL-SL]  │
│  SDI Out    SDI→     IN7→      HDMI→     Input 1    │
│  1080p ✓   HDMI ✓   OUT3 ✓    DVI  ✓    Active ✓   │
│                                                      │
│ Chain Status: ✅ HEALTHY                              │
│ Total Latency: ~2.3ms                                │
│ Signal Format: 1080p59.94 throughout                 │
└─────────────────────────────────────────────────────┘
```

**When broken:**
```
│ [CAM-02]  [CVT-01]  [SW-01]   [LED-01]  [WALL-SL]  │
│  SDI Out    SDI→     IN7→      HDMI→     Input 1    │
│  1080p ✓   HDMI ✓   ✗ NOSIG   ——— ——    ——— ——     │
│                      ^^^^^^^^                        │
│                      BREAK POINT                     │
```

### 3. IssueInbox — Alert & Problem Center

```
┌─────────────────────────────────────────────────────┐
│ ISSUES (3 active)                          [Filter] │
│                                                      │
│ 🔴 CRITICAL  Signal loss on Screen 3        2m ago  │
│    FOH-SW-01 Input 7 — No signal detected            │
│    Affected: Camera 2 → LED Wall SL                  │
│    [Investigate] [Acknowledge]                        │
│                                                      │
│ 🟡 WARNING   Firmware mismatch              1h ago   │
│    3 Decimator MD-HX units: 2× v3.1, 1× v2.8        │
│    [View Details] [Acknowledge]                       │
│                                                      │
│ 🟡 WARNING   Temperature high               45m ago  │
│    FOH-AMP-01: 82°C (threshold: 80°C)               │
│    [View Device] [Acknowledge]                        │
│                                                      │
│ ── Resolved (7 today) ──────────────────────         │
│ ✅ Signal restored on Screen 1          Resolved 3h  │
│ ✅ Network switch port flap             Resolved 5h  │
└─────────────────────────────────────────────────────┘
```

### 4. DeviceView — Device Inspector

```
┌─────────────────────────────────────────────────────┐
│ DEVICE: FOH-SW-01 (Barco E2)              [⚙] [📋] │
│                                                      │
│ ┌─── Identity ───┐ ┌─── Health ──────────────────┐  │
│ │ Vendor: Barco   │ │ Status: 🟢 Online           │  │
│ │ Model: E2       │ │ Uptime: 47h 23m             │  │
│ │ FW: 8.3.1       │ │ CPU: 34%  Temp: 42°C        │  │
│ │ S/N: BRC-44521  │ │ Errors: 0  Warnings: 1      │  │
│ │ IP: 192.168.1.101│ │ Last seen: <1s ago          │  │
│ └─────────────────┘ └────────────────────────────┘  │
│                                                      │
│ ┌─── Routing Matrix ────────────────────────────┐   │
│ │        OUT1  OUT2  OUT3  OUT4  OUT5  OUT6     │   │
│ │ IN1  │  ●                                     │   │
│ │ IN2  │        ●                               │   │
│ │ IN3  │                                        │   │
│ │ IN4  │                                        │   │
│ │ IN5  │                          ●             │   │
│ │ IN6  │                                ●       │   │
│ │ IN7  │              ●   (NO SIGNAL)           │   │
│ │ IN8  │                                        │   │
│ │ IN9  │                                        │   │
│ └───────────────────────────────────────────────┘   │
│                                                      │
│ ┌─── Recent Changes ───────────────────────────┐    │
│ │ 14:32 Routing: IN7→OUT3 changed to IN9→OUT3  │    │
│ │ 14:31 Alarm: HDMI Card 2 hot-plug event      │    │
│ │ 09:15 Snapshot: "Show Ready" taken            │    │
│ └───────────────────────────────────────────────┘    │
│                                                      │
│ [Send Command] [Take Snapshot] [View Full Config]    │
└─────────────────────────────────────────────────────┘
```

### 5. ConfigDiff — Configuration Comparison

```
┌─────────────────────────────────────────────────────┐
│ CONFIG DIFF                                          │
│                                                      │
│ Comparing: "Show Ready" (09:15) vs Live (14:35)     │
│                                                      │
│ 3 changes detected across 2 devices                  │
│                                                      │
│ FOH-SW-01 (Barco E2):                               │
│  routing.input7_to_output3:                          │
│ -  source: input_7                                   │
│ +  source: input_9                                   │
│                                                      │
│ FOH-NET-01 (Cisco SG350):                            │
│  port.24.link_speed:                                 │
│ -  1000Mbps                                          │
│ +  100Mbps                                           │
│                                                      │
│  port.24.duplex:                                     │
│ -  full                                              │
│ +  half                                              │
│                                                      │
│ [Revert All] [Revert Selected] [Accept as New Base]  │
└─────────────────────────────────────────────────────┘
```

### 6. LabelForge — Labeling Workspace

```
┌─────────────────────────────────────────────────────┐
│ LABEL WORKSPACE                    Convention: Tour  │
│                                                      │
│ Scope: [All] [Rack 2] [Stage] [FOH] [Custom]       │
│                                                      │
│ ┌─── Device Labels (47) ───────────────────────┐    │
│ │ FOH-SW-01    Barco E2          192.168.1.101  │    │
│ │ FOH-RTR-01   BMD VideoHub     10.0.1.50       │    │
│ │ FOH-CVT-01   Decimator MD-HX  DHCP            │    │
│ │ STG-CAM-01   Sony FR7         192.168.1.201   │    │
│ │ STG-CAM-02   Sony FR7         192.168.1.202   │    │
│ │ ...                                            │    │
│ └────────────────────────────────────────────────┘    │
│                                                      │
│ ┌─── Cable Labels (89) ──────────────────────────┐  │
│ │ SDI-001  STG-CAM-01 → FOH-SW-01.IN01          │  │
│ │ SDI-002  STG-CAM-02 → FOH-CVT-01.IN01         │  │
│ │ HDMI-017 FOH-CVT-01.OUT01 → FOH-SW-01.IN07    │  │
│ │ ...                                             │  │
│ └─────────────────────────────────────────────────┘  │
│                                                      │
│ [Auto-Generate All] [Edit Selected] [Print Labels]   │
│ [Export PDF] [Export CSV] [Generate QR Codes]         │
└─────────────────────────────────────────────────────┘
```

### 7. CoPilot Panel — AI Command Interface

The CoPilot panel is always accessible (collapsible) at the bottom or side of the screen.

```
┌─────────────────────────────────────────────────────┐
│ COPILOT                                    [Expand] │
│                                                      │
│ > Where does Camera 2 go?                            │
│                                                      │
│ Camera 2 (STG-CAM-02) feeds two destinations:        │
│ 1. LED Wall Stage Left (via SDI→CVT→E2→LED Proc)   │
│ 2. Recording (via SDI→VideoHub→Recorder)             │
│                                                      │
│ Both paths are currently ✅ healthy.                  │
│ [Show on Map] [Trace Path 1] [Trace Path 2]         │
│                                                      │
│ > _______________________________________________    │
│ Suggestions: "Check all cameras" | "Show drift"     │
└─────────────────────────────────────────────────────┘
```

### 8. FlightCheck — Preflight Screen

```
┌─────────────────────────────────────────────────────┐
│ PREFLIGHT CHECK — Tour 2026 — MSG Show 2            │
│                                                      │
│ Based on: "Show Ready" snapshot                      │
│ Status: 44/47 checks passed                          │
│                                                      │
│ ✅ All 47 devices online                             │
│ ✅ All 24 video signal paths verified                │
│ ✅ All 16 audio signal paths verified                │
│ ✅ All Dante subscriptions active                    │
│ ⚠  3 warnings:                                      │
│    • FOH-CVT-03: Firmware v2.8 (expected v3.1)      │
│    • FOH-NET-01 Port 24: 100Mbps (expected 1Gbps)   │
│    • FOH-AMP-01: Temperature 78°C (threshold 80°C)  │
│ ✅ No configuration drift from approved snapshot     │
│ ✅ Rollback snapshots available for all devices      │
│                                                      │
│ SHOW READINESS: ✅ READY (with 3 non-critical warnings) │
│                                                      │
│ [View Warnings] [Generate Report] [Print Checklist]  │
└─────────────────────────────────────────────────────┘
```

### 9. PostShow — Reporting Screen

```
┌─────────────────────────────────────────────────────┐
│ POST-SHOW REPORT — MSG Show 2 — March 15, 2026     │
│                                                      │
│ SUMMARY:                                             │
│ • Show duration: 3h 12m                              │
│ • Incidents: 1 (resolved in 1m 48s)                  │
│ • Configuration changes: 2                           │
│ • Devices monitored: 47                              │
│ • Signal paths verified: 40                          │
│                                                      │
│ INCIDENTS:                                           │
│ • 14:31 — HDMI card failure on E2, rerouted to       │
│   spare input. Resolved 14:33.                       │
│                                                      │
│ CHANGES FROM SHOW START:                             │
│ • E2 Input 7→9 reroute (due to card failure)         │
│ • Network port 24 speed degradation (under review)   │
│                                                      │
│ RECOMMENDATIONS:                                     │
│ • Inspect E2 HDMI Card 2 before next show            │
│ • Replace Cat6 cable on FOH-NET-01 Port 24           │
│ • Update FOH-CVT-03 firmware to v3.1                 │
│                                                      │
│ [Export PDF] [Email Report] [Save to Show Archive]   │
└─────────────────────────────────────────────────────┘
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+/` | Focus CoPilot input |
| `Ctrl+1-9` | Switch to screen 1-9 |
| `Ctrl+F` | Global search |
| `Ctrl+D` | Run discovery scan |
| `Ctrl+S` | Take snapshot |
| `Ctrl+T` | Open PathTrace |
| `Ctrl+Z` | Open rollback menu |
| `Ctrl+P` | Print current view |
| `Esc` | Close modal / cancel action |
| `Space` | Approve pending action |
| `F5` | Refresh current view |
| `F11` | Toggle fullscreen |
