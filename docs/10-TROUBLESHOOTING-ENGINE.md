# 12. Troubleshooting Revolution

## The Troubleshooting Engine — `DiagnosticCore`

### How AV Troubleshooting Works Today

```
Engineer notices problem → Guesses where to look → Opens vendor app →
Checks device → Doesn't find issue → Opens another vendor app →
Checks another device → Finds something maybe wrong → Checks cables →
Eventually finds the problem → Fixes it → Doesn't document what happened
```

**Time: 5–60 minutes. Documentation: zero.**

### How SignalGraph Troubleshooting Works

```
Engineer types: "Screen 3 is black"
→ AI identifies affected signal chain
→ Queries every device in the chain in parallel (<2 seconds)
→ Pinpoints the failure point
→ Ranks probable causes
→ Suggests fixes
→ Engineer approves fix
→ Fix is applied, verified, and documented automatically
```

**Time: 30 seconds to 2 minutes. Documentation: automatic.**

---

## Diagnostic Pipeline

### Stage 1: Problem Intake

The user describes the problem in any of these ways:
- Natural language: "Screen 3 is black"
- Device selection: Click device → "Troubleshoot"
- Alarm click: Click an alarm → "Investigate"
- Signal path: Select a signal chain → "Check health"

The AI classifies the problem:

| Problem Type | Detection Method |
|-------------|-----------------|
| Signal loss | No signal at destination port |
| Wrong content | Signal present but wrong source routed |
| Format mismatch | Signal detected but format incompatible |
| Degraded quality | Signal present but errors/artifacts |
| Device offline | Device not responding |
| Audio issue | Audio routing/level/mute problem |
| Network issue | VLAN, IP, or bandwidth problem |
| Latency issue | Excessive delay in signal chain |
| Intermittent fault | Problem comes and goes |

### Stage 2: Signal-Path Analysis

For any signal-related problem, the engine:

1. **Identifies the affected signal chain(s)**
   - Which source should be feeding which destination?
   - What devices are in the path?

2. **Parallel device query**
   - Simultaneously queries every device in the chain
   - Gets: input status, output status, routing state, error flags
   - Total query time: max device latency (typically <1 second)

3. **Walk the chain**
   ```
   Source: STG-CAM-02 SDI Out → ✓ Signal present, 1080p59.94
     ↓ Cable SDI-042
   Hop 1: FOH-CVT-01 SDI In → ✓ Signal detected
   Hop 1: FOH-CVT-01 HDMI Out → ✓ Signal present, 1080p59.94
     ↓ Cable HDMI-017
   Hop 2: FOH-SW-01 Input 7 → ✗ NO SIGNAL ← BREAK POINT
   ```

4. **Isolate the failure domain**
   - The break is between CVT-01 HDMI Out (working) and SW-01 Input 7 (no signal)
   - Failure domain: the physical connection between them

### Stage 3: Root-Cause Ranking

The engine ranks causes using a scoring model:

```
Cause Analysis for: "No signal at FOH-SW-01 Input 7"

Upstream device (FOH-CVT-01) IS outputting signal.
Downstream device (FOH-SW-01) is NOT receiving signal on Input 7.

SCORING FACTORS:
┌─────────────────────────────────────┬────────┬──────────┐
│ Possible Cause                       │ Score  │ Evidence │
├─────────────────────────────────────┼────────┼──────────┤
│ 1. Cable disconnected/loose          │ 0.45   │ Most common cause for signal     │
│    at destination end                │        │ present at source, absent at     │
│                                     │        │ destination. No error flags.      │
├─────────────────────────────────────┼────────┼──────────┤
│ 2. HDMI cable faulty                │ 0.25   │ HDMI cables fail more often      │
│                                     │        │ than SDI. Same symptom pattern.  │
├─────────────────────────────────────┼────────┼──────────┤
│ 3. EDID negotiation failure         │ 0.15   │ HDMI EDID issues common between  │
│                                     │        │ converter and switcher. E2 logs  │
│                                     │        │ show no EDID exchange on In 7.   │
├─────────────────────────────────────┼────────┼──────────┤
│ 4. E2 Input 7 port failure          │ 0.10   │ Less common but possible.        │
│                                     │        │ Other E2 inputs are working.     │
├─────────────────────────────────────┼────────┼──────────┤
│ 5. Decimator HDMI output failure    │ 0.05   │ Unlikely — device reports output │
│                                     │        │ active. But could be false       │
│                                     │        │ positive from device self-report.│
└─────────────────────────────────────┴────────┴──────────┘
```

### Scoring Model Inputs

| Input | Weight | Source |
|-------|--------|--------|
| **Signal presence at each hop** | High | Live device queries |
| **Error flags/logs from devices** | High | Device logs/status |
| **Historical failure rates** | Medium | Incident database |
| **Cable type (HDMI vs SDI vs Cat6)** | Medium | Topology data |
| **Device age/firmware** | Low-Medium | Device info |
| **Environmental factors** | Low | Manual input or sensors |
| **Time since last change** | Medium | Change log |
| **Known firmware bugs** | Medium | Knowledge base |
| **Previous incidents at this point** | Medium | Incident history |

### Stage 4: Correlation Engine

The engine correlates across multiple signals:

```
CORRELATION DETECTED:
- Screen 3: no signal (FOH-SW-01 Input 7)
- Screen 4: no signal (FOH-SW-01 Input 8)
- Both inputs are on the same HDMI input card in the E2

REVISED ANALYSIS:
Individual cable failure is less likely (2 cables failing simultaneously
is improbable). More likely:
1. E2 HDMI input card failure (0.60) — affects both ports on same card
2. Upstream switch/splitter failure (0.25) — if both signals share upstream path
3. Coincidental separate failures (0.05) — very unlikely
```

### Stage 5: Log & Telemetry Correlation

```
DEVICE LOGS ANALYZED:
- FOH-SW-01 (E2): "HDMI Input Card 2: Hot-plug event at 14:31:42"
- FOH-SW-01 (E2): "Input 7: EDID read timeout at 14:31:43"
- FOH-SW-01 (E2): "Input 8: EDID read timeout at 14:31:43"
- FOH-SW-01 (E2): "HDMI Input Card 2: Reset attempt at 14:31:45"
- FOH-SW-01 (E2): "HDMI Input Card 2: Reset failed at 14:31:50"

TIMELINE:
14:31:42  Hot-plug event on HDMI card 2
14:31:43  Both inputs lose EDID
14:31:45  Card attempts self-reset
14:31:50  Reset fails
14:31:55  User reports "Screen 3 is black"

DIAGNOSIS (Updated, Confidence: 0.94):
Barco E2 HDMI Input Card 2 has failed. The hot-plug event at 14:31:42
triggered a card reset that did not succeed. Both Input 7 and Input 8
are affected.

RECOMMENDED ACTIONS:
1. [Quick Fix] Move Camera 2 and Camera 3 cables to E2 Inputs 9 and 10
   (HDMI Card 3, currently unused) and update routing → [Preview] [Approve]
2. [Permanent Fix] Power-cycle the E2 to attempt card recovery
   (will affect all outputs for ~30 seconds) → [Preview] [Approve]
3. [Escalation] Contact Barco support — card may need replacement
   → [Generate Support Ticket]
```

---

### Stage 6: Recommended Actions

Each recommendation includes:

```
ACTION: Move Camera 2 cable from E2 Input 7 to E2 Input 9

IMPACT:
- Camera 2 feed will be interrupted for ~5 seconds during cable move
- No other signals affected
- E2 Input 9 is currently unused

STEPS:
1. Physically move HDMI cable from E2 Input 7 to E2 Input 9
2. SignalGraph will update E2 routing: Input 9 → Output 3 (was Input 7 → Output 3)
3. SignalGraph will verify signal is present on Input 9
4. SignalGraph will update labels and topology

ROLLBACK:
- Move cable back to Input 7
- Restore routing: Input 7 → Output 3

[Dry Run] [Approve Step 2 Only] [Approve All] [Cancel]
```

---

### Stage 7: Learning from Incidents

After resolution, the engine:

1. **Records the full incident:**
   - Problem description
   - Affected signal chains
   - Root cause
   - Resolution steps
   - Time to resolution
   - Devices and components involved

2. **Updates scoring models:**
   - "E2 HDMI card failures" gets a higher base probability
   - "Hot-plug event → card failure" correlation is recorded
   - Future incidents with similar log patterns will be diagnosed faster

3. **Generates knowledge base entry:**
   ```
   INCIDENT: Barco E2 HDMI Input Card Failure
   SYMPTOMS: Multiple HDMI inputs on same card show no signal
   LOG SIGNATURE: "Hot-plug event" followed by "EDID read timeout" on same card
   ROOT CAUSE: HDMI input card hardware failure
   RESOLUTION: Move affected inputs to another card; power-cycle to attempt recovery
   AFFECTED MODELS: E2, S3-4K (HDMI card versions < Rev C)
   TAGS: barco, e2, hdmi, input-card, hardware-failure
   ```

---

### Operator-Friendly Summaries

The troubleshooting engine always produces two outputs:

**Technical Detail** (for the engineer):
Full diagnostic data, log entries, device queries, scoring breakdown.

**Operator Summary** (for anyone):
```
ISSUE: Screens 3 and 4 went black at 2:31 PM.
CAUSE: An HDMI input card in the main video switcher (Barco E2, Rack 2)
       failed unexpectedly.
FIX:   Cameras were moved to spare inputs on the switcher. Full signal
       was restored at 2:33 PM.
STATUS: Temporary fix in place. The failed card should be inspected by
        Barco service before the next show.
```

---

## Drift Detection

Beyond active troubleshooting, the engine continuously monitors for configuration drift:

```
DRIFT REPORT — Daily Check 06:00

CHANGES SINCE LAST APPROVED SNAPSHOT ("Show Ready — MSG Night 1"):

1. ⚠ FOH-SW-01: Input 5 routing changed
   Expected: MS-01 Out A → Output 2 (LED Wall SR)
   Actual:   MS-01 Out A → Output 4 (Confidence Monitor)
   Changed at: 23:47 last night (no user logged)
   Action: [Revert to Approved] [Accept Change] [Investigate]

2. ℹ FOH-NET-01: Port 24 link speed changed
   Expected: 1Gbps
   Actual: 100Mbps
   Possible cause: Cable degradation or device renegotiation
   Action: [Check Cable] [Accept] [Flag for Tech]

3. ✓ All other 312 monitored parameters match approved state.
```

---

## Failure Domain Isolation

```
USER: "Audio is distorted on the PA left side"

FAILURE DOMAIN ANALYSIS:
┌─────────────────────────────────────────────────────────┐
│  Signal Chain: FOH-MIX-01 → DSP-01 → AMP-L → PA-LEFT  │
│                                                          │
│  FOH-MIX-01 (Console)                                   │
│  ├── Mix Bus L: -3dBFS, no clipping ✓                   │
│  ├── Output L: -3dBFS, AES signal clean ✓               │
│  └── Status: Normal ✓                                    │
│                                                          │
│  DSP-01 (System Processor)                               │
│  ├── Input L: -3dBFS received ✓                          │
│  ├── Processing: EQ + Delay + Limiting active ✓          │
│  ├── Output L: +2dBFS ⚠ LIMITING ENGAGED                │
│  └── Status: Limiter active 47% of time ← SUSPECT       │
│                                                          │
│  AMP-L (Amplifier)                                       │
│  ├── Input: +2dBFS received ✓                            │
│  ├── Clip indicators: ACTIVE ✗ ← PROBLEM                │
│  ├── Output: Clipping ✗                                  │
│  └── Temperature: 78°C (high but within spec) ⚠         │
│                                                          │
│  DIAGNOSIS: DSP output level is too hot (+2dBFS),        │
│  driving the amplifier into clipping. DSP limiter is     │
│  engaging but threshold is set too high.                 │
│                                                          │
│  FIX: Reduce DSP-01 output level by 6dB, or lower       │
│  limiter threshold to -6dBFS.                            │
│  [Preview Change] [Approve]                              │
└─────────────────────────────────────────────────────────┘
```
