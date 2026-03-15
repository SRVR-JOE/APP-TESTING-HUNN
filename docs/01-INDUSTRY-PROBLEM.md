# 3. The Big Industry Problem

## What the AV Industry Is Missing

The professional AV industry operates some of the most complex real-time signal distribution systems in the world — yet manages them with a patchwork of vendor-specific GUIs, spreadsheets, tribal knowledge, WhatsApp messages, and sticky notes on racks.

### The Fragmentation Problem

Every major AV manufacturer ships their own control software:
- **Barco** has Event Master Toolset
- **Blackmagic** has Videohub Control
- **Dante** has Dante Controller
- **Crestron** has Toolbox
- **QSC** has Q-SYS Designer
- **Ross** has DashBoard
- **Grass Valley** has iControl
- **Luminex** has LumiNode
- **etc.**

None of these talk to each other. None of them understand the system as a whole. Each one is a silo that sees only its own devices.

**Result:** The engineer IS the integration layer. They hold the entire system in their head.

### The 9 Painful Realities

| # | Pain Point | Current "Solution" |
|---|-----------|-------------------|
| 1 | **Mystery signal loss** | Manually trace through 10+ devices, one by one |
| 2 | **Inconsistent naming** | Hope that the last crew followed a convention |
| 3 | **Undocumented patch changes** | Ask around, check notes, guess |
| 4 | **Firmware/version mismatch** | Discover it during the show when something breaks |
| 5 | **Last-minute show reconfig** | Panic, manual changes, hope nothing breaks |
| 6 | **Labeling chaos** | Print labels from spreadsheets that are already outdated |
| 7 | **Crew handoffs** | Walk-through tours and verbal explanations |
| 8 | **No single source of truth** | Multiple conflicting spreadsheets, drawings, and memories |
| 9 | **Troubleshooting under pressure** | Experience, instinct, and luck |

### Why Existing Tools Fail

**1. Vendor tools are silos.**
They manage their own devices well. They have zero awareness of the larger system. A Dante Controller doesn't know about your Barco routing. Your Barco software doesn't know about your NDI sources.

**2. Control systems (Crestron, AMX, Extron, Q-SYS) are programming environments, not intelligence layers.**
They require significant programming to set up. They automate button presses, not reasoning. They don't discover, don't auto-document, don't troubleshoot, and don't adapt.

**3. Documentation tools (Visio, AutoCAD, D-Tools, SysTrack) are static.**
They capture a point-in-time design. The moment the first cable gets plugged in differently than planned, the documentation diverges from reality. And it stays diverged forever.

**4. Monitoring tools (PRTG, Zabbix, Nagios) are IT-centric.**
They understand IP, SNMP, bandwidth, and uptime. They don't understand "Camera 2 feed to LED Wall Stage Left." They don't speak AV.

**5. Nothing reasons across the system.**
No tool today can answer: "Why is Screen 3 showing the wrong content?" — because that answer requires understanding routing through a switcher, format conversion through a scaler, EDID negotiation, network VLAN assignment, and Dante audio routing simultaneously, across five different vendor ecosystems.

### The Opportunity

The AV industry is a $300B+ global market growing at ~6% annually. It is in the early stages of IP convergence (AV-over-IP via NDI, Dante, NMOS, ST 2110), which makes the complexity problem exponentially worse — and simultaneously makes software-driven management possible for the first time.

**The window is now.** As AV moves from baseband to IP, the industry desperately needs an intelligent software layer that can:
- Discover what's on the network
- Understand what it does
- Map how it connects
- Monitor if it's working
- Fix it when it breaks
- Document it for the next crew

**Nobody is building this.** Not the vendors (they're incentivized to lock you in). Not the IT monitoring companies (they don't understand AV). Not the control system companies (they're selling programming services, not intelligence).

SignalGraph is the answer to a problem that every AV professional experiences daily but has accepted as "just how it is." That acceptance is the market opportunity.
