# 5. Primary Users

## User Personas & Adoption Strategy

### Tier 1: Primary Users (Initial Adoption Targets)

#### 1. Live Event Engineers / Video Engineers
**Role:** Design, deploy, and operate video/audio/lighting systems for concerts, festivals, corporate events, broadcasts.
**Pain level:** Extreme. They face the highest-pressure, most time-constrained troubleshooting scenarios.
**Adoption trigger:** Signal-path tracing during a show. If SignalGraph saves one crisis, they're a customer for life.
**Typical system:** 20–200 devices, 5–10 vendors, baseband + IP mix, assembled and torn down repeatedly.
**Key needs:**
- Fast discovery of new systems at each venue
- Quick signal-path tracing
- Labeling for temporary systems
- Config backup/restore between shows
- Offline operation (venue internet is unreliable)

#### 2. Systems Integrators (AV Design/Build Firms)
**Role:** Design, install, commission, and hand off permanent AV systems for venues, corporate spaces, houses of worship, stadiums.
**Pain level:** High. Documentation and handoff consume 20-30% of project time.
**Adoption trigger:** Auto-generated documentation, labeling, and as-built drawings that stay synced to reality.
**Typical system:** 50–500+ devices, multi-room, permanent installation, needs long-term management.
**Key needs:**
- Auto-documentation for handoff
- Labeling system for permanent installations
- Config baselines and drift detection
- Firmware inventory and compliance
- Preflight/commissioning checklists

#### 3. Touring Technicians
**Role:** Travel with shows/tours, set up and tear down systems in different venues constantly.
**Pain level:** High. Every venue is different, and they carry their system config between venues.
**Adoption trigger:** "Load our show file, discover what's here, show me the diff, adapt."
**Typical system:** Known touring rig + unknown venue infrastructure.
**Key needs:**
- Show file management (expected vs. discovered state)
- Quick adaptation to venue differences
- Portable, offline-first operation
- Fast re-labeling for each venue
- Change tracking across tour stops

### Tier 2: Secondary Users (V2 Adoption Targets)

#### 4. Broadcast / Live Production Engineers
**Role:** Manage video routing, camera systems, replay, graphics, and distribution for live broadcast.
**Pain level:** Very high. Signal routing complexity in broadcast is extreme.
**Adoption trigger:** Cross-vendor signal tracing in complex IP/baseband hybrid broadcast environments.
**Typical system:** 100–1000+ endpoints, ST 2110 / NDI / SDI, tightly timed, mission-critical.
**Key needs:**
- High-density signal-path mapping
- NMOS / ST 2110 integration
- Multiviewer correlation
- Tally and router state awareness
- Sub-second status updates

#### 5. Corporate AV / Unified Communications Teams
**Role:** Manage meeting rooms, digital signage, enterprise AV, and UC platforms across campuses.
**Pain level:** Moderate but persistent. Managing 50+ rooms with different configurations is a grind.
**Adoption trigger:** Fleet management — see all rooms, all devices, all firmware, all issues in one view.
**Key needs:**
- Multi-room / multi-site management
- Firmware compliance dashboard
- Remote troubleshooting
- Standardized configurations
- Help desk integration

#### 6. Support / Operations / NOC Teams
**Role:** Remote monitoring and support for deployed AV systems.
**Pain level:** Moderate. They need visibility without physical access.
**Adoption trigger:** Remote health monitoring + AI-assisted triage before dispatching a technician.
**Key needs:**
- Remote system visibility
- Alert management
- Incident history
- Escalation workflows
- SLA tracking

### Adoption Funnel

```
FREE TIER (Discovery + Topology View)
  → Hooks live event engineers immediately
  → They see the value of the graph
  → They hit a troubleshooting moment

PAID TIER (AI Tracing + Labeling + Documentation)
  → Converts during first real crisis
  → Or during first documentation deadline
  → Word-of-mouth in tight-knit AV community

TEAM TIER (Multi-user + Show Files + Fleet)
  → Production companies standardize
  → Integrators adopt for projects
  → Corporate AV adopts for campuses

ENTERPRISE TIER (API + Custom Connectors + Support)
  → Major broadcasters
  → Stadium groups
  → Venue chains
```

### Why Live Event Engineers First

1. **They feel the pain most acutely** — time pressure makes every problem urgent
2. **They are influencers** — the AV industry is a small, tight community; word spreads fast
3. **They move between companies** — they carry tool preferences with them
4. **They work across vendors** — they need cross-vendor intelligence more than anyone
5. **They are early adopters** — they try new tools constantly to get an edge
6. **They validate the hardest use case** — if it works during a live show, it works everywhere
