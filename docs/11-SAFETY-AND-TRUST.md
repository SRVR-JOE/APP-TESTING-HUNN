# 13. Safety and Trust

## Making Operators Trust AI in Live Environments

This is the make-or-break section. An AV engineer will never use a tool that could take down a live show. Every safety mechanism must be visible, predictable, and under the operator's control.

---

## Core Safety Principles

1. **The human is always in control.** The AI suggests; the human decides. No exceptions for critical changes.
2. **Every action is reversible.** If SignalGraph changed it, SignalGraph can undo it.
3. **Every action is visible.** Nothing happens in the background without the user knowing.
4. **Fail safe, not fail dangerous.** If something goes wrong with SignalGraph itself, the AV system continues working — we're an observation/management layer, not in the signal path.
5. **Offline is normal.** The system works fully without internet. Cloud features are always optional.

---

## Approval Gates

### Three-Tier Approval System

```
┌─────────────────────────────────────────────────┐
│ TIER 1: READ-ONLY (Auto-approved)               │
│ • Query device status                            │
│ • Trace signal path                              │
│ • Generate reports                               │
│ • View configuration                             │
│ • Search logs                                    │
│ • Generate labels (preview)                      │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ TIER 2: NON-CRITICAL CHANGES (Configurable)     │
│ • Update labels in SignalGraph                   │
│ • Create/update snapshots                        │
│ • Modify monitoring thresholds                   │
│ • Change naming conventions                      │
│ • Update notes/documentation                     │
│                                                  │
│ Default: Auto-approved                           │
│ Can be set to: Require approval                  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ TIER 3: DEVICE CHANGES (Always require approval) │
│ • Change signal routing                          │
│ • Modify device configuration                    │
│ • Push firmware updates                          │
│ • Restart/reboot devices                         │
│ • Bulk changes                                   │
│ • Any action that affects live signal             │
│                                                  │
│ Always requires: Explicit user approval           │
│ Shows: Diff preview + impact analysis            │
└─────────────────────────────────────────────────┘
```

### Approval UI

For every Tier 3 action:

```
┌─────────────────────────────────────────────────────┐
│ ⚡ ACTION APPROVAL REQUIRED                         │
│                                                      │
│ Action: Change routing on FOH-SW-01 (Barco E2)      │
│ Requested by: AI CoPilot (user-initiated)            │
│                                                      │
│ WHAT WILL CHANGE:                                    │
│ ┌──────────────────────────────────────────────┐    │
│ │ Input 9 → Output 3                           │    │
│ │ (was: Input 7 → Output 3)                    │    │
│ │                                               │    │
│ │ Effect: Screen 3 will show Camera 2 via       │    │
│ │ alternate input path                          │    │
│ └──────────────────────────────────────────────┘    │
│                                                      │
│ IMPACT:                                              │
│ • Screen 3 will briefly flash during switchover      │
│ • No other outputs affected                          │
│ • Audio routing unaffected                           │
│                                                      │
│ ROLLBACK:                                            │
│ • Automatic rollback available                       │
│ • Revert to: Input 7 → Output 3                     │
│                                                      │
│ [🔍 Dry Run] [✅ Approve] [❌ Cancel]                │
│                                                      │
│ ☐ Remember this approval for similar actions         │
└─────────────────────────────────────────────────────┘
```

---

## Rollback System

### How Rollback Works

Every device change creates a rollback record:

```
RollbackRecord {
  id:               UUID
  change_record_id: UUID          // Links to the change it can undo
  device_id:        UUID
  rollback_command:  Command       // The exact command to reverse the change
  previous_state:    DeviceState   // Verified state before the change
  expires_at:        Timestamp     // Rollback data expires after configurable time
  status:           RollbackStatus // available, executed, expired, invalidated
}
```

### Rollback Modes

| Mode | Description |
|------|-------------|
| **Single action** | Undo the last change to a specific device |
| **Session rollback** | Undo all changes made in the current session |
| **Snapshot restore** | Restore entire system to a saved snapshot state |
| **Selective rollback** | Cherry-pick which changes to undo from a list |

### Rollback Safety

- Rollback itself is a Tier 3 action (requires approval)
- Rollback shows a diff preview just like any other change
- If the system state has changed since the original action, the rollback warns about conflicts
- Rollback verifies the result after execution

---

## Diff Previews

Before any change, SignalGraph shows exactly what will change:

```
CONFIG DIFF: FOH-SW-01 (Barco E2)

  routing:
-   input_7 → output_3    # Camera 2 via HDMI Card 2
+   input_9 → output_3    # Camera 2 via HDMI Card 3

  No other changes.

  Affected signal chains:
  • Camera 2 → Screen 3 (will be re-routed through Input 9)

  Unaffected signal chains:
  • Camera 1 → Screen 1 (uses Input 1 → Output 1)
  • Camera 3 → Screen 2 (uses Input 2 → Output 2)
  • [12 more unaffected chains]
```

---

## Dry Runs

For any action, the user can request a dry run:

```
DRY RUN: Route Camera 2 to Screen 3 via Input 9

SIMULATED EXECUTION:
1. ✓ FOH-SW-01 is reachable
2. ✓ Input 9 is available (currently unrouted)
3. ✓ Input 9 supports HDMI at 1080p59.94
4. ✓ Routing command is valid: "ROUTE IN9 TO OUT3"
5. ✓ No conflicting routes
6. ✓ Output 3 format compatible

PREDICTED RESULT:
- Screen 3 will display Camera 2 feed
- Transition: ~100ms signal interruption during switch
- Rollback: revert to Input 7 → Output 3

RISK ASSESSMENT: LOW
No live signals will be permanently affected.

[Execute for Real] [Cancel]
```

---

## Permissions System

### Role-Based Access

| Role | Read | Labels | Config Changes | Bulk Changes | Admin |
|------|------|--------|---------------|-------------|-------|
| **Viewer** | ✓ | — | — | — | — |
| **Operator** | ✓ | ✓ | Approval required | — | — |
| **Engineer** | ✓ | ✓ | ✓ | Approval required | — |
| **Admin** | ✓ | ✓ | ✓ | ✓ | ✓ |

### Device-Level Permissions

```yaml
permission_sets:
  - name: "Show-Critical Devices"
    devices: ["FOH-SW-01", "FOH-RTR-01", "STG-LED-*"]
    rules:
      - all_changes_require_approval: true
      - minimum_role: engineer
      - notify_on_change: ["lead_engineer@crew.com"]

  - name: "Test/Rehearsal Devices"
    devices: ["TEST-*", "REHEAR-*"]
    rules:
      - all_changes_require_approval: false
      - minimum_role: operator
```

---

## Audit Log

Every action in SignalGraph is logged immutably:

```
AUDIT LOG — FOH-SW-01

TIME          │ ACTOR       │ ACTION                    │ RESULT
──────────────┼─────────────┼───────────────────────────┼────────
14:31:42      │ SYSTEM      │ Detected: Input card 2    │ Alarm
              │             │ hot-plug event             │ raised
14:32:07      │ AI/CoPilot  │ Diagnosed: HDMI card 2    │ Report
              │ (J. Smith)  │ failure                    │ generated
14:32:15      │ J. Smith    │ Approved: Move Input 7    │ Executed
              │             │ route to Input 9           │ ✓
14:32:16      │ SYSTEM      │ Executed: ROUTE IN9→OUT3  │ Verified
14:32:17      │ SYSTEM      │ Verified: Signal present  │ OK
              │             │ on Output 3                │
14:32:18      │ SYSTEM      │ Updated labels: IN07→IN09 │ Applied
14:32:20      │ SYSTEM      │ Rollback record created   │ Available
```

### Audit Properties
- Immutable (append-only log)
- Exportable (CSV, JSON, PDF)
- Filterable by device, user, action type, time range
- Searchable
- Retained for configurable duration (default: 1 year)

---

## Tamper Visibility

SignalGraph detects and flags changes made outside of SignalGraph:

```
⚠ EXTERNAL CHANGE DETECTED

Device: FOH-SW-01 (Barco E2)
Time: 23:47:12
Change: Input 5 routing changed (Output 2 → Output 4)

This change was NOT made through SignalGraph.
Possible sources:
- Direct access to E2 control software
- Hardware front panel change
- Another control system

[Acknowledge] [Revert to Last Known] [Investigate]
```

---

## Offline Mode

### What Works Offline (Everything Core)

| Feature | Offline | Notes |
|---------|---------|-------|
| Discovery | ✓ | Local network only |
| Topology View | ✓ | Full functionality |
| Signal Tracing | ✓ | Full functionality |
| Device Queries | ✓ | Direct device communication |
| Config Snapshots | ✓ | Stored locally |
| Labeling | ✓ | Full functionality |
| AI CoPilot | ✓ | Local model |
| Change Log | ✓ | Stored locally |
| Rollback | ✓ | Full functionality |
| Documentation | ✓ | Generated locally |
| Print Labels | ✓ | Local printer |

### What Requires Internet (Optional Enhancements)

| Feature | Online Only | Notes |
|---------|------------|-------|
| Cloud AI (enhanced reasoning) | ✓ | Falls back to local model |
| Team sync | ✓ | Queues changes for sync |
| Firmware download | ✓ | Can stage from local file |
| Knowledge base updates | ✓ | Uses cached version |
| License validation | Periodic | Grace period for offline |

---

## Deterministic Mode

For show-critical environments, SignalGraph offers a "Deterministic Mode":

```
DETERMINISTIC MODE: ENABLED

In this mode:
✓ AI suggestions are presented but NEVER auto-executed
✓ All changes require explicit approval
✓ Rollback records are created BEFORE changes execute
✓ Every action shows full diff preview
✓ No background changes or auto-updates
✓ Discovery runs on manual trigger only (no auto-scan)
✓ Labels update only on manual refresh
✓ Change notifications are prominent (cannot be dismissed without ack)

This mode is recommended during live shows.
```

---

## Trust-Building Strategy

### Progressive Trust Model

SignalGraph earns trust incrementally:

1. **Day 1:** Read-only observation. "Let me just watch your system."
2. **Week 1:** Labeling and documentation. "Let me help with the paperwork."
3. **Month 1:** Troubleshooting assistance. "Let me help you find problems faster."
4. **Month 3:** Approved configuration changes. "Let me help you make changes safely."
5. **Month 6+:** Automated workflows. "Let me handle routine tasks while you focus on the show."

The user controls how fast they move through this progression. SignalGraph never pushes for more trust than the user offers.
