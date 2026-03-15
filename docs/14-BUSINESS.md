# 16–18. Moat, Business Model & Build Plan

---

## 16. Moat / Defensibility

### Why SignalGraph Is Defensible

**1. The Normalized AV Graph (Data Network Effect)**
Every system SignalGraph maps becomes training data for better AI reasoning. The more systems it sees, the better it diagnoses problems, predicts failures, and suggests configurations. No new entrant can replicate years of accumulated operational intelligence.

**2. Connector Ecosystem**
Each vendor connector takes 2-8 weeks to build and test properly. Once SignalGraph supports 30+ vendors, no competitor can catch up without massive investment. This is the same moat that made Salesforce (AppExchange) and Shopify (app ecosystem) defensible.

**3. Workflow Lock-In (Positive Lock-In)**
Once a team builds show files, naming conventions, snapshots, runbooks, and documentation templates in SignalGraph, switching costs are high — not because we trap them, but because the accumulated work has genuine value.

**4. Operational History**
A venue's incident history, change logs, and configuration evolution are irreplaceable. After a year of use, SignalGraph's audit trail becomes a critical operational record.

**5. Labeling/Documentation System of Record**
Once labels, QR codes, and documentation are generated from SignalGraph, every printed label and QR code in the building points back to SignalGraph. Switching means re-labeling the entire installation.

**6. AI Tuned for AV Reasoning**
General-purpose AI doesn't understand EDID negotiation, Dante subscriptions, or video router cross-points. SignalGraph's AI is trained on AV-specific patterns, failure modes, and device behaviors. This domain-specific fine-tuning is a compounding advantage.

**7. Community & Standards Influence**
If SignalGraph becomes the standard tool, its data model becomes the de facto schema for AV system description. We can drive industry standards (similar to how Terraform's HCL became the standard for infrastructure-as-code).

---

## 17. Business Model

### Pricing Tiers

| Tier | Price | Target | Includes |
|------|-------|--------|----------|
| **Free** | $0 | Individual engineers | Discovery, topology view, 10-device limit, manual tracing, basic labels |
| **Pro** | $49/month per seat | Freelance engineers, small companies | Unlimited devices, AI CoPilot, full labeling, documentation, snapshots |
| **Team** | $99/month per seat | Production companies, integrators | Multi-user, shared show files, approval workflows, team audit trail |
| **Enterprise** | Custom | Large integrators, broadcasters, venue chains | Fleet management, SSO, API access, custom connectors, dedicated support |

### Additional Revenue Streams

| Stream | Model | Notes |
|--------|-------|-------|
| **Connector Marketplace** | Revenue share (70/30) | Third-party connectors for niche vendors |
| **Premium Connectors** | Included in Team+ | High-maintenance vendor connectors (Crestron, QSC, etc.) |
| **Priority Support** | $200/month add-on | Direct engineering support, 4-hour response |
| **Custom Connector Development** | Project-based ($5K-25K) | Build a connector for a customer's proprietary device |
| **Training & Certification** | $500/person | "SignalGraph Certified Engineer" program |

### Strongest Market Wedge

**The free tier with 10-device limit.**

Here's why:
1. 10 devices is enough to map a small system and experience the "wow" of automated topology + signal tracing
2. Any real show has >10 devices, so the conversion trigger is natural
3. $49/month is an impulse purchase for a freelance video engineer who just watched SignalGraph find a fault in 30 seconds
4. The AV industry is tight-knit — one engineer at a festival tells 20 others
5. Production companies will upgrade to Team once 3+ engineers are using Pro

**Avoid per-venue or per-rack pricing.** AV engineers work across many venues and systems. Per-seat is simpler, predictable, and aligns with how the industry buys software (individual tools, not site licenses — at least initially).

---

## 18. First Build Plan

### Phase 1: Foundation (Days 1–30)

**Goal:** Running desktop app with device discovery and basic topology view.

**Week 1-2: Scaffold**
- Set up Tauri 2.0 + Rust + React project
- Implement basic app shell (navigation, theming, window management)
- Set up SQLite database with core schema (devices, ports, routes)
- Implement event bus (Tokio broadcast channels)
- Create basic connector trait definition

**Week 3-4: Discovery**
- Implement network scanning (ARP, ping sweep)
- Implement mDNS discovery
- Implement SNMP discovery (v1/v2c)
- Build first connector: Generic SNMP (network switches)
- Build second connector: Blackmagic VideoHub (simple TCP protocol)
- Build device identification pipeline (vendor/model/firmware)
- Store discovered devices in SQLite

**Week 5-6: Topology View**
- Implement React-based graph visualization (react-flow or d3)
- Display discovered devices as nodes
- Display detected connections as edges
- Device status indicators (online/offline)
- Click-to-inspect basic device info
- Basic search/filter

**Deliverable:** An installable app that discovers devices on a network and shows them in a live topology graph. **This alone is useful** — no AV tool does this across vendors today.

### Phase 2: Intelligence (Days 31–90)

**Goal:** AI-powered signal tracing, config snapshots, and basic labeling.

**Month 2:**
- Implement signal-path data model (routes, chains)
- Build PathTrace engine (graph traversal for signal tracing)
- Add manual signal-path entry (for non-discoverable connections)
- Implement ConfigGuard (snapshot and diff)
- Build additional connectors: Dante Discovery, NDI Discovery
- Basic device inspector panel

**Month 3:**
- Integrate local AI model (llama.cpp, small model)
- Implement CoPilot: natural language → tool calls
- AI-powered signal tracing ("Where does Camera 2 go?")
- Basic LabelForge (auto-generate device/port labels)
- Change tracking (detect and log state changes)
- Basic IssueInbox (alarm display)

**Deliverable:** An app that understands signal flow, traces paths with AI, takes config snapshots, diffs them, and auto-generates labels. **This is the MVP that gets beta users.**

### Phase 3: Production-Ready (Days 91–180)

**Goal:** Reliable enough for real shows. Full labeling, documentation, preflight.

**Month 4:**
- Troubleshooting engine (root-cause ranking)
- Rollback manager
- Approval gates and safety system
- Audit logging
- Advanced labeling (cables, QR codes, print integration)

**Month 5:**
- Documentation generator (patch sheets, rack elevations, signal flow diagrams)
- Preflight checklist generator
- Show file management (save/load/compare)
- Cloud AI integration (optional, for enhanced reasoning)
- RAG system (vendor manual ingestion)

**Month 6:**
- Polish and stability
- 3-5 additional vendor connectors
- Beta testing with 5-10 real AV professionals
- Windows installer + auto-updater
- macOS build
- Launch landing page and waitlist

**Deliverable:** A production-grade tool ready for private beta with real shows. Full labeling, documentation, AI troubleshooting, and config management.

### Phase 4: Market Entry (Months 7–12)

**Goal:** Public launch, paying customers, connector ecosystem.

**Month 7-8:**
- Public beta launch
- Pricing implementation (free tier + Pro)
- Onboarding flow
- 10+ vendor connectors
- Community feedback loop

**Month 9-10:**
- Team features (multi-user, shared show files)
- Connector SDK for third-party developers
- Fleet management basics
- Advanced AI (incident learning, predictive suggestions)

**Month 11-12:**
- Public launch (v1.0)
- Enterprise tier
- Connector marketplace
- Conference demos (InfoComm, LDI, NAB, ISE)
- First paying enterprise customers

---

## Key Milestones

| Milestone | Target | Success Metric |
|-----------|--------|---------------|
| First working topology view | Day 30 | Can discover and display 20+ devices |
| First AI signal trace | Day 75 | "Where does Camera 2 go?" works |
| First external beta tester | Day 150 | Real engineer uses it on a real show |
| First "save the show" moment | Day 180 | SignalGraph helps resolve a live issue |
| First paying customer | Day 210 | Someone pays $49/month |
| 100 paying users | Day 300 | Product-market fit signal |
| First enterprise deal | Day 365 | Validates Team/Enterprise tiers |
