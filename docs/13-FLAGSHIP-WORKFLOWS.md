# 15. Three Flagship Workflows

## Workflow 1: New System Setup at a Venue

### Scenario
A touring video engineer arrives at Madison Square Garden with 3 racks of touring gear. The venue has its own infrastructure. They need to integrate both, document everything, and be show-ready by soundcheck in 4 hours.

### Step-by-Step

**Hour 1: Physical Setup & Discovery**

```
1. Engineer racks touring gear, patches cables, powers up.

2. Opens SignalGraph on their laptop. Connects to the venue network.

3. Clicks [Discover] or types: "Scan the network"

4. SignalGraph runs AutoScan:
   ┌──────────────────────────────────────────────┐
   │ DISCOVERY IN PROGRESS...                      │
   │                                                │
   │ Scanning: 10.0.0.0/24, 192.168.1.0/24        │
   │ Methods: mDNS, SSDP, SNMP, Dante, NDI, NMOS  │
   │                                                │
   │ Found so far:                                  │
   │  12 video devices (Barco, Blackmagic, ...)     │
   │  8 audio devices (Dante network)               │
   │  4 network switches                            │
   │  3 unknown devices                             │
   │  27 total                                      │
   │                                                │
   │ [Stop] [Add Manual Device] [View Topology]     │
   └──────────────────────────────────────────────┘

5. Discovery completes: 47 devices found.
   SignalGraph auto-identifies vendors, models, firmware.

6. 3 devices marked "Unknown" — engineer clicks each,
   manually identifies them (legacy SDI DA, not on network).
   Adds them to the graph manually.
```

**Hour 1.5: Show File Comparison**

```
7. Engineer loads the tour's show file: "Tour 2026 Standard.sg"

8. Types: "Compare what's here to the show file"

9. SignalGraph shows:
   ┌──────────────────────────────────────────────┐
   │ SHOW FILE COMPARISON                          │
   │                                                │
   │ Show File: "Tour 2026 Standard"               │
   │ Venue: Madison Square Garden (discovered)      │
   │                                                │
   │ MATCHED: 38/45 expected devices found          │
   │                                                │
   │ MISSING (7):                                   │
   │  • Confidence monitor (FOH) — not discovered   │
   │  • Record deck backup — not discovered         │
   │  • 5 venue devices in show file not yet present │
   │    (venue hasn't patched all tie lines yet)     │
   │                                                │
   │ EXTRA (9): Venue infrastructure devices         │
   │  • 4 Crestron processors (venue house system)   │
   │  • 3 Extron switchers (meeting rooms)           │
   │  • 2 venue network switches                     │
   │                                                │
   │ ROUTING DIFFERENCES (12):                      │
   │  • Camera inputs on different ports than usual   │
   │    (venue patch panel layout differs)            │
   │  • LED processor at different IP                │
   │  [View All 12 Differences]                      │
   │                                                │
   │ SUGGESTED ADAPTATIONS:                         │
   │  1. Update E2 input assignments for venue patch │
   │  2. Update LED processor IP in routing          │
   │  3. Flag missing devices for manual setup       │
   │  [Apply Adaptations] [Review Each]              │
   └──────────────────────────────────────────────┘

10. Engineer reviews adaptations, approves routing changes.
    SignalGraph pushes updated config to devices (with approval for each).
```

**Hour 2: Labeling**

```
11. Types: "Generate all labels for this system"

12. SignalGraph auto-generates:
    - 50 device labels (touring + venue)
    - 89 cable labels
    - 24 port labels for patch panels
    - 12 Dante channel labels
    - 4 rack labels
    - 2 stage box labels

13. Engineer reviews in LabelForge workspace:
    - Adjusts 3 labels to match crew preferences
    - Approves all others

14. Prints cable labels to Brother P-touch
    Prints rack labels as PDF
    Generates QR codes for rack doors

15. Time spent: 15 minutes (vs. 2+ hours manually)
```

**Hour 3: Preflight**

```
16. All cables patched and labeled.
    Types: "Run preflight check"

17. SignalGraph runs FlightCheck:
    ┌──────────────────────────────────────────────┐
    │ PREFLIGHT: Tour 2026 — MSG                   │
    │                                               │
    │ ✅ 47/47 devices online                       │
    │ ✅ 22/24 video paths verified                 │
    │ ✗  2 video paths broken:                      │
    │    • Camera 4 → E2 Input 4: No signal         │
    │    • Replay 2 → VideoHub Input 12: Format err  │
    │ ✅ 16/16 audio paths verified                 │
    │ ✅ Firmware versions match tour standard       │
    │ ✅ Labels applied and synced                   │
    │                                               │
    │ 2 ISSUES TO RESOLVE:                          │
    │ [Troubleshoot Camera 4] [Troubleshoot Replay] │
    └──────────────────────────────────────────────┘

18. Clicks [Troubleshoot Camera 4]:
    AI traces path, finds cable not patched at venue patch panel.
    Engineer patches the cable. Signal comes up.

19. Clicks [Troubleshoot Replay 2]:
    AI finds format mismatch — Replay is outputting 4K but VideoHub
    input expects 1080p. Suggests: "Set Replay 2 output to 1080p59.94"
    Engineer approves. SignalGraph sends command. Signal comes up.

20. Runs preflight again: 24/24 video paths ✅
    Takes snapshot: "Show Ready — MSG"
```

**Hour 4: Documentation & Handoff**

```
21. Types: "Generate system documentation for this venue"

22. SignalGraph DocBuilder produces:
    - Full system topology diagram (PDF)
    - Video signal flow diagram
    - Audio signal flow diagram
    - Complete patch sheet (source→destination)
    - Rack elevation drawings (4 racks)
    - Equipment list with firmware/IP/serial
    - Dante routing matrix
    - Network VLAN summary

23. Exports as PDF package.
    Saves to tour archive.
    System is show-ready.

Total time: ~3 hours (vs. typical 6-8 hours with manual methods)
Labeling that would have been skipped: DONE
Documentation that would have been "I'll do it later": DONE
```

---

## Workflow 2: Live Troubleshooting During a Fault

### Scenario
Mid-show at a major concert. 15,000 people watching. The stage-left LED wall goes black. The show is live. Clock is ticking.

### Step-by-Step (Real-Time)

```
T+0s    LED Wall Stage Left goes black.
        Stage manager radios: "We lost Stage Left!"

T+5s    Video engineer already has SignalGraph open (it's always running).
        Alarm appears in IssueInbox:
        🔴 CRITICAL: Signal loss — STG-LED-01 (LED Wall Stage Left)

T+8s    Engineer clicks alarm → AI auto-starts investigation.
        OR types: "Why is Stage Left black?"

T+10s   AI PathTrace executes:
        ┌──────────────────────────────────────────┐
        │ INVESTIGATING: STG-LED-01 signal loss     │
        │                                           │
        │ Tracing backward from STG-LED-01...       │
        │ Querying 4 devices in signal path...      │
        │ ████████████████████████░░ 80%             │
        └──────────────────────────────────────────┘

T+12s   Results:
        ┌──────────────────────────────────────────┐
        │ DIAGNOSIS (Confidence: 0.91)              │
        │                                           │
        │ Signal Path:                              │
        │ MS-01 → SW-01.IN5 → SW-01.OUT1 →         │
        │ LED-PROC-01 → LED-WALL-SL                 │
        │                                           │
        │ BREAK POINT: SW-01 Output 1               │
        │                                           │
        │ Detail: E2 Output 1 shows "No Layer       │
        │ Assigned." The PGM preset has lost its     │
        │ output mapping.                            │
        │                                           │
        │ MOST LIKELY CAUSE:                         │
        │ Someone recalled an E2 preset that didn't  │
        │ include Output 1 mapping. This happened    │
        │ at 21:47:12 (32 seconds ago).              │
        │                                           │
        │ E2 Log: "Preset 'SONG-05-ALT' recalled    │
        │ at 21:47:12 by [front panel]"              │
        │                                           │
        │ FIX: Re-assign PGM layer to Output 1.     │
        │                                           │
        │ [🔍 Preview Fix] [✅ Apply Fix] [↩ Recall  │
        │  Last Working Preset]                      │
        └──────────────────────────────────────────┘

T+18s   Engineer sees the problem: wrong preset was recalled.
        Clicks [Recall Last Working Preset]:

        ┌──────────────────────────────────────────┐
        │ ACTION: Recall preset "SONG-05-MAIN"     │
        │ on FOH-SW-01 (Barco E2)                  │
        │                                           │
        │ This will restore:                        │
        │ • Output 1 → PGM layer → LED Wall SL     │
        │ • Output 2 → PGM layer → LED Wall SR     │
        │ • All other outputs unchanged             │
        │                                           │
        │ Transition: Cut (immediate)               │
        │ Impact: LED walls will show content       │
        │         immediately                       │
        │                                           │
        │ [✅ APPROVE — RECALL NOW]  [❌ Cancel]     │
        └──────────────────────────────────────────┘

T+22s   Engineer approves.

T+23s   SignalGraph sends preset recall command to E2.

T+24s   LED Wall Stage Left comes back.
        AI verifies signal is present.

T+25s   SignalGraph logs:
        ┌──────────────────────────────────────────┐
        │ ✅ RESOLVED                               │
        │                                           │
        │ Issue: LED Wall SL signal loss             │
        │ Duration: 25 seconds                       │
        │ Cause: Wrong preset recalled on E2         │
        │ Fix: Recalled correct preset "SONG-05-MAIN"│
        │ Verified: Signal confirmed on all outputs  │
        │ Rollback: Available (recall SONG-05-ALT)  │
        │                                           │
        │ Full incident logged to audit trail.       │
        └──────────────────────────────────────────┘

T+30s   Engineer breathes. The show continues.
        Total downtime: ~25 seconds.
        Without SignalGraph: 2-10 minutes of manual investigation.
```

---

## Workflow 3: Automatic Labeling & Documentation Handoff

### Scenario
A systems integrator just finished installing a 200-device AV system in a new corporate headquarters. They need to hand it off to the client's AV team with complete documentation, labels, and training materials.

### Step-by-Step

```
Day 1: Final Commissioning

1. Integrator opens SignalGraph, runs full discovery.
   200 devices found across 12 conference rooms, 1 auditorium,
   1 broadcast studio, and building-wide digital signage.

2. Types: "Apply 'Corporate Standard' naming convention"
   SignalGraph generates labels using the integrator's saved convention:
   - HQ-AUD-SW-01 (Auditorium switcher)
   - HQ-CR4-DSP-01 (Conference Room 4 DSP)
   - HQ-SIG-PL-03 (Signage player 3)
   ... 200 devices, 800+ ports, 300+ cables labeled.

3. Reviews in LabelForge. Adjusts 12 labels to match client preferences.
   Approves all.

4. Prints:
   - 200 device labels (rack-mount labels with QR codes)
   - 300 cable labels (wrap labels with source→destination)
   - 48 rack labels (rack doors, top and bottom)
   - 12 room labels (AV closet doors)
   - 12 patch panel label strips

   Total print time: ~45 minutes across two Brother P-touch printers.

Day 2: Documentation Generation

5. Types: "Generate full as-built documentation package"

6. SignalGraph DocBuilder produces:

   AS-BUILT DOCUMENTATION PACKAGE
   ├── 01-System-Overview.pdf
   │   └── High-level topology, all rooms, backbone network
   ├── 02-Room-Drawings/
   │   ├── Auditorium-Signal-Flow.pdf
   │   ├── Conference-Room-Template.pdf (rooms 1-10)
   │   ├── Broadcast-Studio.pdf
   │   └── Digital-Signage-Network.pdf
   ├── 03-Rack-Elevations/
   │   ├── AUD-Rack-1.pdf through AUD-Rack-4.pdf
   │   ├── CR-IDF-Rack-1.pdf through CR-IDF-Rack-3.pdf
   │   └── Studio-Rack-1.pdf through Studio-Rack-2.pdf
   ├── 04-Patch-Sheets/
   │   ├── Video-Patch-Matrix.pdf
   │   ├── Audio-Patch-Matrix.pdf
   │   ├── Dante-Routing.pdf
   │   └── Network-Port-Assignments.pdf
   ├── 05-Equipment-List.xlsx
   │   └── All devices with vendor, model, FW, IP, serial, location
   ├── 06-Network-Documentation/
   │   ├── VLAN-Assignment.pdf
   │   ├── IP-Address-Plan.pdf
   │   └── Switch-Port-Mapping.pdf
   ├── 07-Configuration-Baseline/
   │   └── Full system snapshot (restorable)
   └── 08-QR-Code-Index.pdf
       └── Every QR code with what it links to

   Generation time: ~5 minutes.
   Manual equivalent: 2-4 weeks of an engineer's time.

Day 3: Client Handoff

7. Client's AV team installs SignalGraph on their management workstation.

8. Imports the system snapshot from the integrator.

9. Runs discovery — all 200 devices match the handoff documentation.

10. Client team can now:
    - See the full system topology in real time
    - Trace any signal path
    - Get alerted to issues
    - Ask CoPilot questions about THEIR system
    - See labels on every device, port, and cable
    - Scan QR codes to get live device info
    - Access the integrator's documentation baseline
    - Detect any drift from the commissioned state

11. Integrator's handoff is COMPLETE with:
    - Zero ambiguity about system state
    - Living documentation that stays current
    - Self-service troubleshooting capability
    - Full audit trail from day one
    - Baseline snapshot for drift detection

    Client quote: "This is the first time we've received a system
    where the documentation is actually useful."
```
