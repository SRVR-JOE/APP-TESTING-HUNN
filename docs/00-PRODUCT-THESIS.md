# SignalGraph — Product Thesis & Executive Summary

## One-Sentence Product Thesis

**SignalGraph is a desktop-native AI operating layer that discovers, maps, controls, and documents mixed-vendor AV systems as a live digital twin — giving engineers a single source of truth, natural-language troubleshooting, and safe automated actions in real-time, even offline.**

---

## Top 3 Name Recommendations

### 1. SignalGraph (Recommended)
The name communicates exactly what the product does: it understands signal flow as a graph. It's technical enough to earn respect from AV engineers, unique enough to own as a brand, and immediately conveys the core innovation — treating the entire AV system as a navigable, queryable graph of signals, devices, and relationships. Domain availability is strong. It works as a verb: "I SignalGraphed the venue."

### 2. RackMind
Evokes the physical reality of AV (racks, panels, copper) combined with intelligence. It's memorable, punchy, and sounds like something an engineer would actually say. "Let me check RackMind." It anchors the product in the physical world while signaling the AI capability.

### 3. PatchOS
Positions the product as an operating system for patching — the single most painful daily activity in AV. It's bold, implies platform-level ambition, and resonates immediately with anyone who has dealt with patch chaos. The "OS" suffix signals that this isn't a widget, it's infrastructure.

### Additional Names (for consideration)

| # | Name | Reasoning |
|---|------|-----------|
| 4 | **CueSheet** | Familiar show-control term, implies the product orchestrates everything |
| 5 | **Neuron AV** | Neural/intelligent, signals interconnection |
| 6 | **ShowGraph** | Combines live events context with graph architecture |
| 7 | **SysTrace** | Implies tracing signals through systems — core troubleshooting verb |
| 8 | **VenueCore** | Positions as the core brain of any venue |
| 9 | **TwinRack** | Digital twin + physical rack reality |
| 10 | **PathEngine** | Signal paths are the fundamental abstraction |

**Decision: We proceed with "SignalGraph" throughout this document.**

---

## The Single Most Powerful Wedge Feature

**Automated Signal-Path Tracing with Root-Cause Isolation.**

Here's why this is the wedge:

Every AV engineer has faced the moment: a screen goes black, a feed drops, an audio channel disappears — and they have 90 seconds to find and fix it while thousands of people watch. Today, that engineer mentally traces the signal through 5-15 devices across multiple vendors, protocols, and patch points, checking each one manually.

SignalGraph's wedge feature: the engineer types or says:

> "Trace Camera 2 to LED Wall Stage Left — where does it fail?"

The system instantly:
1. Walks the discovered signal graph from source to destination
2. Queries each device along the path for live status
3. Identifies the break point (e.g., "HDMI input 3 on the Barco E2 in Rack 4 shows no signal — upstream Decimator is outputting normally")
4. Ranks probable causes
5. Suggests the fix
6. Offers to execute it with one click (after approval)

This is the "I need this" moment. Every other feature (labeling, documentation, config management) builds naturally from the graph that enables this capability. But this one moment — saving an engineer during a live crisis — is what creates word-of-mouth adoption in the AV industry.

**Adoption wedge strategy:**
- Free tier: discovery + topology view + manual signal tracing
- Paid tier: AI-powered tracing + automated troubleshooting + labeling + documentation
- This gives engineers a reason to install it on day one (free discovery/topology is already valuable) and a reason to pay the moment it saves their show.
