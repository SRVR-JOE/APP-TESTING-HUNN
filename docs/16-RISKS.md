# 22. Product Risks and Hard Truths

## Technical Risks

### 1. Vendor API Instability (HIGH RISK)
**The problem:** Most AV manufacturers don't publish stable, documented APIs. Many devices use undocumented TCP protocols, proprietary binary formats, or APIs that change between firmware versions without notice.

**Why it's dangerous:** A connector that works with firmware 7.2 might break silently on 7.3. At scale, this creates a constant maintenance burden.

**Mitigation:**
- Version-lock connectors to tested firmware ranges
- Implement protocol-level health checks (verify response format before parsing)
- Build a community reporting system for firmware compatibility
- Prioritize vendors with stable, documented APIs first (Blackmagic, QSC, Dante)
- Establish vendor partnerships early — give them value (telemetry, compatibility data) in exchange for API stability commitments

### 2. Network Discovery Reliability (MEDIUM-HIGH RISK)
**The problem:** AV networks are messy. VLANs isolate devices. Firewalls block discovery protocols. Some devices aren't on any network at all (SDI-only, analog). Wi-Fi vs. wired management networks create visibility gaps.

**Why it's dangerous:** If discovery misses devices, the topology is incomplete, and the AI's reasoning is wrong.

**Mitigation:**
- Support multiple discovery methods (mDNS, SNMP, Dante, NDI, NMOS, ARP)
- Allow manual device addition for non-discoverable gear
- Make it obvious when the graph might be incomplete
- Guide users to configure network access (VLAN trunk port, management network)
- Never claim certainty when the graph has gaps

### 3. Local AI Quality (MEDIUM RISK)
**The problem:** Small local models (8B parameters) are significantly less capable than frontier models. Complex multi-step troubleshooting reasoning may produce incorrect diagnoses.

**Why it's dangerous:** A wrong diagnosis under time pressure is worse than no diagnosis. Engineers will lose trust if the AI gives bad advice even once during a critical moment.

**Mitigation:**
- Local AI handles structured tasks (intent parsing, tool calling, template responses)
- Complex reasoning defers to cloud AI when available
- Always show confidence scores — never present speculation as fact
- Always show the evidence trail — let the engineer verify the reasoning
- "I don't have enough information" is a valid response; train the model to say it
- Offer "Observe Only" mode where AI suggests but doesn't push

### 4. Real-Time Performance at Scale (MEDIUM RISK)
**The problem:** Polling 200+ devices every few seconds, running graph algorithms, rendering a large topology, and running AI inference simultaneously is a serious computational challenge.

**Why it's dangerous:** If the app becomes slow or unresponsive, engineers will close it — especially under pressure.

**Mitigation:**
- Rust backend handles the heavy lifting efficiently
- Adaptive polling (critical devices every 1s, others every 10-30s)
- Graph rendering uses virtualization (only render visible nodes)
- AI inference is async and non-blocking
- Profile and benchmark continuously; set hard performance targets

### 5. Cross-Platform Parity (LOW-MEDIUM RISK)
**The problem:** Tauri uses the OS webview (WebView2 on Windows, WebKit on macOS). Rendering differences can cause UI inconsistencies.

**Mitigation:**
- Test on all platforms in CI
- Use well-tested UI components (Radix) that handle cross-browser differences
- Windows-first development; macOS as secondary
- Document known platform-specific behaviors

---

## Operational Risks

### 6. Trust in Live Environments (HIGH RISK)
**The problem:** AV engineers are rightfully cautious about new tools in live environments. One bad experience — a wrong command sent to a switcher during a show — and the product is dead to that engineer and everyone they talk to.

**Why it's dangerous:** The AV industry is small. Reputation spreads fast. One public failure could set adoption back years.

**Mitigation:**
- Deterministic Mode for live shows (no auto-actions)
- Triple-verify safety gates before any device command
- Extensive testing with real devices before shipping connectors
- Start with read-only features — earn trust before offering write actions
- Public incident response process if something goes wrong

### 7. Scope Creep (HIGH RISK)
**The problem:** The vision is massive. The temptation to build everything at once — every connector, every feature, every vendor — is extreme.

**Why it's dangerous:** Spreading too thin means nothing works well. A half-working product in 20 categories loses to a polished product in 3.

**Mitigation:**
- Ruthless MVP scoping: discovery + topology + signal tracing + basic labeling
- Only 3-5 connectors in MVP (SNMP, Blackmagic, Dante, NDI, generic REST)
- Ship early, ship ugly, ship working
- Let beta users tell you what to build next
- The build plan above is already aggressive — resist adding to it

### 8. Connector Maintenance Burden (MEDIUM-HIGH RISK)
**The problem:** Every connector is a commitment to maintain indefinitely. Firmware updates, API changes, and new device models all require connector updates.

**Why it's dangerous:** At 30+ connectors, maintenance could consume the entire engineering team.

**Mitigation:**
- Connector SDK + community contributors
- Automated connector testing against device simulators
- Firmware compatibility matrix with automated alerts
- Revenue from connector marketplace funds maintenance
- Prioritize connectors with stable, well-documented APIs

---

## Market Risks

### 9. Vendor Resistance (MEDIUM RISK)
**The problem:** Some AV manufacturers may see SignalGraph as a threat to their control software and ecosystem lock-in. They could restrict API access, add authentication requirements, or change protocols.

**Why it's dangerous:** If a major vendor (e.g., Crestron, QSC) actively blocks SignalGraph, it limits the addressable market.

**Mitigation:**
- Position as complementary, not competitive ("We make your devices more valuable")
- Partner with friendly vendors early (Blackmagic and Audinate are good candidates)
- Use open protocols where possible (SNMP, NMOS, Dante API)
- Build enough user demand that vendors can't afford to block us
- If a vendor blocks API access, document it publicly — users will pressure them

### 10. Chicken-and-Egg Problem (MEDIUM RISK)
**The problem:** The product is most valuable with many connectors. But connectors take time to build. Early users may find that their specific devices aren't supported.

**Why it's dangerous:** "It doesn't support my [device]" is a churn reason, even if the core platform is excellent.

**Mitigation:**
- Generic connectors (SNMP, REST, TCP) cover basic discovery and status for most devices
- Manual device entry as fallback
- Transparent connector roadmap driven by user requests
- Connector SDK enables community contributions early
- Focus initial connectors on the most common devices in live events (Blackmagic, Dante, NDI — these three cover a huge percentage of real systems)

### 11. Pricing Sensitivity (LOW-MEDIUM RISK)
**The problem:** The AV industry has a mixed relationship with software subscriptions. Many engineers use free tools (vendor software, spreadsheets) and resist paying for management software.

**Mitigation:**
- Generous free tier that provides real value
- Price point ($49/month) is less than one hour of an AV engineer's billable rate
- Frame ROI in terms of time saved: "One troubleshooting incident saved pays for a year"
- No nickel-and-diming — Pro tier includes everything a working engineer needs
- Enterprise pricing for companies, not individuals

---

## Hard Truths

1. **You will not support every vendor at launch.** Accept it. Focus on the most common devices in your target market (live events) and expand from there.

2. **The AI will be wrong sometimes.** The question is not whether it makes mistakes, but whether it communicates uncertainty honestly. A confident wrong answer is worse than an honest "I'm not sure."

3. **Some engineers will never trust AI.** That's fine. The topology view, labeling, and documentation features are valuable without the AI. Meet users where they are.

4. **Connectors are the product.** The app shell is necessary but not sufficient. The value comes from device integration. Under-invest in connectors and nothing else matters.

5. **First impressions are everything in AV.** If an engineer installs SignalGraph and it doesn't discover their devices in the first 5 minutes, they'll uninstall it. The onboarding experience must be fast and impressive.

6. **Offline-first is genuinely hard.** It constrains everything: AI model size, sync architecture, data storage, update mechanisms. But it's non-negotiable for the target market.

7. **You're building two products.** A desktop application AND an AI system. Both must be excellent. Mediocre AI in a great app, or great AI in a mediocre app, both fail.

8. **The AV industry moves slowly but locks in hard.** Adoption will be slower than consumer software. But once a production company standardizes on SignalGraph, they'll use it for years. Optimize for deep adoption over broad awareness.
