# 7. AI Architecture

## Designing the Built-In AI for Real AV Environments

### Core Principle: The AI Is a Tool User, Not a Chatbot

SignalGraph's AI (CoPilot) is not a conversational assistant that happens to know about AV. It is a **tool-calling agent** that has access to the same device APIs, graph queries, and system actions that a human operator would use — but can execute them faster, more systematically, and with full audit trails.

The AI doesn't "know" the answer to "Why is Screen 3 black?" — it **investigates** by calling tools: tracing the signal path, querying device status, checking config diffs, correlating logs, and then synthesizing a ranked diagnosis.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  User Interface                  │
│         (Natural Language + Action Buttons)       │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│              AI Orchestrator                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Intent   │ │ Planner  │ │ Safety Gate      │ │
│  │ Parser   │ │          │ │ (Approval Check) │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│              Tool Execution Layer                 │
│  ┌──────────────────────────────────────────┐    │
│  │ Available Tools:                          │    │
│  │ • graph.trace_path(src, dst)             │    │
│  │ • graph.query(filter)                    │    │
│  │ • device.get_status(device_id)           │    │
│  │ • device.get_config(device_id)           │    │
│  │ • device.send_command(device_id, cmd)    │    │
│  │ • config.diff(snapshot_a, snapshot_b)    │    │
│  │ • config.restore(snapshot_id, target)    │    │
│  │ • labels.generate(scope, template)       │    │
│  │ • docs.generate(type, scope)             │    │
│  │ • logs.search(device_id, timerange)      │    │
│  │ • scan.discover(network_range)           │    │
│  │ • health.check(device_id | path_id)      │    │
│  └──────────────────────────────────────────┘    │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│           Knowledge Layer (RAG)                   │
│  ┌────────────┐ ┌────────────┐ ┌──────────────┐ │
│  │ Vendor     │ │ System     │ │ Incident     │ │
│  │ Manuals    │ │ Topology   │ │ History      │ │
│  │ & API Docs │ │ & Configs  │ │ & Runbooks   │ │
│  └────────────┘ └────────────┘ └──────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## Local-First AI Strategy

### The Reality of AV Environments
- Many venues have no internet or severely restricted internet
- Show-critical operations cannot depend on cloud latency
- Proprietary system data should not leave the local machine without consent
- Engineers need instant responses, not 2-3 second cloud round trips

### Tiered AI Architecture

#### Tier 1: Local Small Model (Always Available)
**Model:** Quantized local model (e.g., Llama 3.1 8B, Phi-3, Mistral 7B) running on CPU/GPU via llama.cpp, Ollama, or similar runtime.

**Capabilities:**
- Intent parsing (classify user query into tool calls)
- Template-based response generation
- Structured data extraction from device outputs
- Label generation from naming rules
- Simple diagnostic reasoning over small context
- System summary generation

**Limitations:**
- Less capable at complex multi-step reasoning
- Smaller context window
- May need more explicit prompting

**Why it works:** 80% of AI interactions in SignalGraph are structured — the user asks a question, the system translates it to tool calls, executes them, and formats the result. A small local model handles this reliably.

#### Tier 2: Local Large Model (When Hardware Allows)
**Model:** Larger local model (e.g., Llama 3.1 70B quantized, Mixtral 8x7B) for users with GPU-equipped workstations.

**Capabilities:**
- Complex multi-step troubleshooting reasoning
- Better natural-language explanations
- More nuanced root-cause analysis
- Better RAG synthesis over large document sets

#### Tier 3: Cloud Model (When Available & Permitted)
**Model:** Claude (Anthropic API) or similar frontier model.

**Capabilities:**
- Highest-quality reasoning for complex diagnostics
- Long-context analysis over large config files and logs
- Best natural-language generation for documentation
- Access to latest model capabilities

**When to use cloud:**
- User explicitly opts in
- Internet is available
- Query requires reasoning beyond local model capability
- User requests documentation generation (quality matters, latency tolerance is higher)
- Non-time-critical operations (post-show reports, runbook generation)

**Data privacy:**
- System topology is anonymized before sending to cloud (device names, IPs stripped)
- OR user explicitly allows full data sharing
- All cloud interactions are logged in audit trail
- User can see exactly what was sent to the cloud

---

## Tool Calling / Action Execution

### Tool Definition Format

Every capability the AI can use is defined as a structured tool:

```yaml
tool: device.get_status
description: "Get the current status of a device including input/output state, errors, and health"
parameters:
  device_id:
    type: string
    required: true
    description: "The device identifier in the graph"
returns:
  type: DeviceStatus
  fields: [online, inputs, outputs, errors, temperature, uptime, firmware]
safety_level: read_only  # read_only | config_change | critical_change
requires_approval: false
```

### Safety Levels

| Level | Description | Approval Required | Examples |
|-------|------------|-------------------|---------|
| `read_only` | Queries that don't change anything | Never | Get status, trace path, read config |
| `config_change` | Changes to device configuration | User preference (default: yes) | Change routing, update label, modify setting |
| `critical_change` | Changes that could affect live signal | Always | Switch live video route, change output format, firmware update |
| `bulk_change` | Changes to multiple devices | Always + preview | Push config to all devices, bulk rename |

### Action Execution Flow

```
User: "Route Camera 2 to Screen 3"
  │
  ▼
Intent Parser → Identifies: route_change action
  │
  ▼
Planner → Determines required tool calls:
  1. graph.find_device("Camera 2") → device_cam2
  2. graph.find_device("Screen 3") → device_screen3
  3. graph.find_path(device_cam2, device_screen3) → path info
  4. For each device in path: determine routing command
  │
  ▼
Safety Gate → Classifies as: critical_change
  │
  ▼
Approval UI → Shows user:
  "This will change routing on 3 devices:
   - Barco E2: CrossPoint 4→7 (currently: 4→3)
   - Decimator MD-HX: Input HDMI→Output SDI (no change)
   - BSS Soundweb: [audio follows video] Route Ch2→Bus3

   [Preview] [Approve] [Cancel]"
  │
  ▼ (User approves)

Executor → Sends commands to each device in sequence
  │
  ▼
Verifier → Re-queries each device to confirm change took effect
  │
  ▼
ChangeLog → Records: what changed, who approved, old→new state
  │
  ▼
Response → "Done. Camera 2 is now routed to Screen 3.
            Signal confirmed on all 3 devices in the path.
            Rollback available: [Undo]"
```

---

## RAG (Retrieval-Augmented Generation)

### Knowledge Sources

| Source | Type | Update Frequency | Use Case |
|--------|------|-----------------|----------|
| Vendor manuals (PDF/HTML) | Static docs | On import | "What's the max resolution on HDMI 2 of the E2?" |
| API documentation | OpenAPI/Swagger specs | On connector install | Tool parameter validation |
| Current topology | Live graph data | Real-time | "How many devices are in Rack 3?" |
| Config snapshots | Structured data | On snapshot | "What changed since soundcheck?" |
| Device logs | Time-series text | Streaming | "Show me errors from the last hour" |
| Incident history | Structured records | On resolution | "Has this happened before?" |
| Runbooks | Structured procedures | On creation/edit | "What's the procedure for switching to backup?" |
| Community knowledge | Curated Q&A | Periodic sync | "Known issues with firmware 4.2.1" |

### RAG Implementation

```
User Query
    │
    ▼
┌──────────────┐     ┌──────────────────┐
│ Query        │────▶│ Embedding Model   │
│ Embedding    │     │ (local, small)    │
└──────────────┘     └──────────────────┘
    │
    ▼
┌──────────────┐     ┌──────────────────┐
│ Vector       │────▶│ Top-K Relevant    │
│ Search       │     │ Chunks Retrieved  │
└──────────────┘     └──────────────────┘
    │
    ▼
┌──────────────────────────────────┐
│ Context Assembly                  │
│  - Retrieved document chunks      │
│  - Current device state (live)    │
│  - Recent change history          │
│  - Relevant topology subgraph     │
└──────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────┐
│ LLM Generation                    │
│  - Synthesize answer              │
│  - Cite sources                   │
│  - Include confidence score       │
└──────────────────────────────────┘
```

### Local Vector Store
- **Engine:** SQLite with sqlite-vss extension, or LanceDB (embedded, no server)
- **Embedding model:** Local sentence-transformer (e.g., all-MiniLM-L6-v2, ~80MB)
- **Chunk strategy:** Hybrid — structured chunks for configs/specs, paragraph chunks for manuals
- **Index updates:** Incremental — only re-embed changed content

---

## Confidence Scoring

Every AI response includes a confidence indicator:

| Score | Label | Meaning | UI Treatment |
|-------|-------|---------|-------------|
| 0.9+ | **High** | AI has strong evidence from live data and/or documentation | Green indicator, auto-suggest |
| 0.7–0.9 | **Medium** | AI has partial evidence, some inference | Yellow indicator, show reasoning |
| 0.5–0.7 | **Low** | AI is reasoning from limited data, significant uncertainty | Orange indicator, show alternatives |
| <0.5 | **Speculative** | AI is guessing based on general knowledge | Red indicator, explicit warning |

**How confidence is calculated:**
- Based on: number of live data sources consulted, consistency of evidence, whether the failure pattern matches known issues, and whether the AI had to make assumptions
- NOT a probability — it's a practical signal of "how much did I actually check vs. infer?"

---

## Human-in-the-Loop Approval

### Approval Modes

| Mode | Behavior | Best For |
|------|----------|----------|
| **Full Approval** | Every action requires explicit approval | Live shows, critical systems |
| **Smart Approval** | Read-only actions auto-execute; changes require approval | Normal operation |
| **Trusted Mode** | Pre-approved action types auto-execute; critical changes still require approval | Experienced users, rehearsal |
| **Observe Only** | AI suggests but never executes | Learning, audit, review |

### Approval UI

For any action requiring approval:
1. **Plain-English description** of what will happen
2. **Diff preview** showing before/after state
3. **Affected devices** listed with current status
4. **Risk assessment** (what could go wrong)
5. **Rollback plan** (how to undo)
6. **Approve / Modify / Cancel** buttons
7. **"Dry Run" option** — simulate the action and show results without executing

---

## Post-Action Verification

After every approved action:
1. Re-query affected devices
2. Verify expected state matches actual state
3. If mismatch → alert user, offer rollback
4. Log verification result in change history
5. Update topology graph with new state

---

## Explainability

Every AI action includes:
- **What was done** (specific commands sent to specific devices)
- **Why it was done** (user request + reasoning chain)
- **What evidence was consulted** (device status, logs, docs, history)
- **What alternatives were considered** (if applicable)
- **How to undo it** (specific rollback steps)
- **Citations** (which manual section, which log entry, which config value)

Example:
```
DIAGNOSIS: Screen 3 is showing no signal.

REASONING:
1. Traced signal path: Camera 2 → SDI Cable → Decimator MD-HX →
   HDMI Cable → Barco E2 Input 7 → E2 Output 3 → Screen 3
2. Queried each device along the path:
   - Camera 2: outputting 1080p59.94 on SDI ✓
   - Decimator MD-HX: input detected, output active ✓
   - Barco E2 Input 7: NO SIGNAL DETECTED ✗ ← FAILURE POINT
3. Checked E2 Input 7 configuration: expecting HDMI, format auto-detect ON
4. Checked Decimator output: HDMI output active, 1080p59.94

ROOT CAUSE (Confidence: High — 0.92):
Physical connection issue between Decimator HDMI output and E2 Input 7.
The Decimator is outputting signal, but the E2 is not receiving it.

LIKELY CAUSES (ranked):
1. HDMI cable disconnected or loose at E2 end (85%)
2. HDMI cable faulty (10%)
3. E2 Input 7 port failure (5%)

RECOMMENDED ACTION:
Check the HDMI cable connection at Barco E2 Input 7 (Rack 2, Position 4U).

SOURCES:
- Live device query: Barco E2 status at 14:32:07
- Live device query: Decimator MD-HX status at 14:32:07
- Signal path: Graph trace Camera2→Screen3
```
