# 11. Labeling Revolution

## Why Labeling Is a Category-Defining Feature

Labeling is the most underestimated pain point in professional AV. It's the unglamorous work that determines whether a system is operable by anyone other than the person who built it. Today, labeling is:
- Done manually in spreadsheets
- Inconsistent between crews
- Outdated within hours of installation
- Not linked to the actual system state
- Time-consuming enough that it's often skipped

**SignalGraph makes labeling automatic, live, and authoritative.** This alone could drive adoption among integrators.

---

## LabelForge — The Labeling Engine

### Naming Convention Engine

SignalGraph includes a rule-based naming engine that generates consistent labels from topology data.

#### Naming Rules

```yaml
naming_convention:
  name: "Standard Tour Convention"

  device_naming:
    pattern: "{location_code}-{device_type_code}-{sequence}"
    examples:
      - "FOH-SW-01"      # Front of House, Switcher, Unit 1
      - "STG-CAM-03"     # Stage, Camera, Unit 3
      - "RK2-CVT-01"     # Rack 2, Converter, Unit 1

    location_codes:
      front_of_house: "FOH"
      stage: "STG"
      monitor_world: "MON"
      broadcast_compound: "BC"
      rack_room: "RKR"
      rack: "RK{n}"

    device_type_codes:
      video_switcher: "SW"
      video_router: "RTR"
      camera: "CAM"
      signal_converter: "CVT"
      media_server: "MS"
      audio_mixer: "MIX"
      audio_dsp: "DSP"
      display: "DSP"  # Context: display
      led_processor: "LED"
      network_switch: "NET"
      multiviewer: "MV"
      record_playback: "REC"
      intercom: "COM"

  port_naming:
    pattern: "{device_label}.{direction}{port_number}"
    examples:
      - "FOH-SW-01.IN07"
      - "FOH-SW-01.OUT03"

  cable_naming:
    pattern: "{signal_type}-{sequence:3}"
    examples:
      - "SDI-042"
      - "HDMI-017"
      - "CAT6-103"
      - "XLR-088"

  endpoint_naming:
    pattern: "{source_device_label}→{dest_device_label}"
    examples:
      - "STG-CAM-02→FOH-SW-01"

  vlan_naming:
    pattern: "VLAN-{purpose}-{number}"
    examples:
      - "VLAN-DANTE-100"
      - "VLAN-NDI-200"
      - "VLAN-MGMT-10"
      - "VLAN-CTRL-50"
```

#### Custom Rule Support
- Users can create custom naming conventions
- Conventions can be saved as templates
- Conventions can be shared across teams
- Multiple conventions can coexist (e.g., one for touring, one for install)

---

### Automated Label Generation from Topology

When SignalGraph discovers a system, it can auto-generate labels for everything:

```
Discovery Complete: 47 devices found

AutoLabel Results:
├── 47 device labels generated
├── 312 port labels generated
├── 89 cable labels generated (from detected connections)
├── 12 VLAN labels generated
├── 23 endpoint labels generated (Dante channels)
├── 4 rack labels generated (from location data)
│
├── Review & Edit: [Open Label Workspace]
├── Apply All: [Apply Labels]
└── Export: [PDF] [CSV] [Print] [QR Batch]
```

### How Auto-Labeling Works

1. **Device auto-naming:**
   - Discovery identifies vendor + model + location
   - Naming convention assigns type code
   - Sequence numbers auto-increment per type per location
   - AI checks for conflicts and suggests disambiguation

2. **Port auto-naming:**
   - Inherits device label as prefix
   - Adds direction + number
   - If signal path is known: adds source/destination hint
   - Example: `FOH-SW-01.IN07 [STG-CAM-02]`

3. **Cable auto-naming:**
   - Signal type detected from port type
   - Sequence number assigned
   - Source→destination encoded
   - Example: `SDI-042 (STG-CAM-02 → FOH-SW-01.IN07)`

4. **Dante/NDI channel naming:**
   - Inherits from device label + channel function
   - Example: `FOH-MIX-01.AuxL`, `STG-CAM-02.PGM`

---

### QR Code System

Every labeled entity can generate a QR code that links to its live data in SignalGraph.

#### QR Code Content

```json
{
  "sg": "1",
  "type": "device",
  "id": "dev_abc123",
  "system": "Tour-2026",
  "url": "signalgraph://device/dev_abc123"
}
```

#### QR Use Cases

| Scan Context | Result |
|-------------|--------|
| Scan device QR | Opens device inspector with live status |
| Scan port QR | Shows what's connected, signal format, status |
| Scan cable QR | Shows source and destination, signal type, status |
| Scan rack QR | Shows rack elevation with all device statuses |
| Scan stage box QR | Shows all connections and patch state |

#### QR Generation
- QR codes generated locally (no internet required)
- Embeddable in printed labels
- Batch generation for entire racks/systems
- Custom QR size and density for different label sizes

---

### Print Workflows

#### Supported Label Printers
- **Brother P-touch** (TZe tape — industry standard for AV)
- **Dymo LabelWriter** (direct thermal)
- **Brady BMP21/BMP51** (industrial labels)
- **Generic PDF** (for any printer)
- **Custom templates** (for specialty label stock)

#### Print Integration

```
Label Workspace
├── Select scope: [All] [Rack 2] [Stage Boxes] [Cables] [Custom]
├── Preview labels: [Grid View] [List View]
├── Label format:
│   ├── Size: [12mm tape] [24mm tape] [Custom]
│   ├── Content: [Name only] [Name + Signal] [Name + QR] [Full]
│   ├── Font: [Auto-size] [Fixed 8pt] [Fixed 10pt]
│   └── Orientation: [Horizontal] [Vertical] [Flag wrap]
├── Print to: [Brother PT-D610BT] [PDF] [CSV Export]
└── Print: [Print Selected] [Print All]
```

#### Label Templates

**Cable wrap label:**
```
┌──────────────────────┐
│ SDI-042              │
│ STG-CAM-02 → SW-01  │
│ [QR]                 │
└──────────────────────┘
```

**Rack device label:**
```
┌──────────────────────────────┐
│ FOH-SW-01                    │
│ Barco E2  │  192.168.1.101   │
│ FW: 8.3.1 │  Rack 2, 12U    │
│ [QR]                         │
└──────────────────────────────┘
```

**Port label (small):**
```
┌──────────┐
│ IN07     │
│ CAM-02   │
└──────────┘
```

**Patch panel label strip:**
```
┌────┬────┬────┬────┬────┬────┬────┬────┐
│ 01 │ 02 │ 03 │ 04 │ 05 │ 06 │ 07 │ 08 │
│CAM1│CAM2│CAM3│GFX │RPL1│RPL2│FEED│BKUP│
└────┴────┴────┴────┴────┴────┴────┴────┘
```

---

### Rack Elevation Labels

SignalGraph auto-generates rack elevation diagrams from discovered data:

```
RACK 2 — FRONT OF HOUSE
┌─────────────────────────────────┐
│ 42U │ Patch Panel - Video       │
├─────┤                           │
│ 41U │ Patch Panel - Audio       │
├─────┤                           │
│ 40U │ [empty]                   │
├─────┼───────────────────────────┤
│ 39U │                           │
│ 38U │ Barco E2 (FOH-SW-01)     │
│ 37U │ 192.168.1.101  FW:8.3.1  │
├─────┼───────────────────────────┤
│ 36U │ Decimator MD-HX (CVT-01) │
├─────┤                           │
│ 35U │ Decimator MD-HX (CVT-02) │
├─────┤                           │
│ 34U │ Decimator MD-HX (CVT-03) │
├─────┼───────────────────────────┤
│ 33U │                           │
│ 32U │ Blackmagic VideoHub 40x40│
│ 31U │ (FOH-RTR-01) 10.0.1.50  │
├─────┼───────────────────────────┤
│ ... │ ...                       │
├─────┼───────────────────────────┤
│ 02U │ UPS (PWR-01)             │
│ 01U │                          │
└─────┴───────────────────────────┘
```

---

### Patch Sheets

Auto-generated patch sheets from live routing data:

```
VIDEO PATCH SHEET — Generated 2026-03-15 14:30
System: Tour 2026 — Venue: Madison Square Garden

SOURCE              │ CABLE  │ DESTINATION           │ FORMAT      │ STATUS
────────────────────┼────────┼───────────────────────┼─────────────┼────────
STG-CAM-01 SDI Out  │ SDI-001│ FOH-SW-01 Input 1     │ 1080p59.94  │ ✓ OK
STG-CAM-02 SDI Out  │ SDI-002│ FOH-SW-01 Input 2     │ 1080p59.94  │ ✓ OK
STG-CAM-03 SDI Out  │ SDI-003│ FOH-SW-01 Input 3     │ 1080p59.94  │ ✓ OK
FOH-MS-01 Out A     │ SDI-010│ FOH-SW-01 Input 5     │ 1080p59.94  │ ✓ OK
FOH-MS-01 Out B     │ SDI-011│ FOH-SW-01 Input 6     │ 4K29.97     │ ⚠ FMT
FOH-SW-01 Out 1     │ HDMI-01│ STG-LED-01 Proc In    │ 1080p59.94  │ ✓ OK
FOH-SW-01 Out 2     │ HDMI-02│ STG-LED-02 Proc In    │ 1080p59.94  │ ✗ NOSIG
FOH-SW-01 Out 3     │ SDI-020│ BC-REC-01 Input 1     │ 1080p59.94  │ ✓ OK
```

---

### Labels That Stay Synced

**The critical difference: labels in SignalGraph are live.**

When the topology changes:
1. System detects the change
2. Affected labels are flagged as "needs review"
3. AI suggests updated labels based on new topology
4. User approves or modifies
5. Labels update everywhere — print queue, documentation, QR codes

Example:
```
CHANGE DETECTED: Input 7 on FOH-SW-01 is now receiving from STG-CAM-04
(was: STG-CAM-02)

LABEL UPDATES SUGGESTED:
- FOH-SW-01.IN07 label: "CAM-02" → "CAM-04"
- Cable SDI-042 label: "STG-CAM-02 → SW-01" → "STG-CAM-04 → SW-01"
- Patch sheet row updated

[Accept All] [Review Each] [Ignore]
```

---

### Export Options

| Format | Use Case |
|--------|----------|
| **PDF** | Print-ready labels, rack elevations, patch sheets |
| **CSV** | Import into other systems, spreadsheet review |
| **Excel** | Formatted workbooks with multiple tabs |
| **SVG** | Scalable vector labels for custom printing |
| **DWG/DXF** | Import into AutoCAD/Vectorworks for as-built drawings |
| **Brother P-touch format** | Direct print to Brother label printers |
| **Dymo DYMO format** | Direct print to Dymo printers |
| **JSON** | API export for integration with other systems |
| **PNG** | Rack elevations and diagrams as images |
