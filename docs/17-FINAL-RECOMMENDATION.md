# 23. Final Recommendation

## What Exactly to Build First

**Build "SignalGraph Lite" — a free, offline-first, desktop app that discovers AV devices on a network and shows them in a live interactive topology map with basic signal-path tracing.**

That's it. That's v0.1.

### Why This Specific Slice

1. **It's useful on day one with zero configuration.** Plug into a network, launch the app, see every device. No account, no setup, no internet required.

2. **Nothing like it exists.** There is no cross-vendor AV discovery + topology tool. This alone is novel.

3. **It's the foundation everything else requires.** The graph must exist before AI can reason over it, before labels can be generated, before documentation can be produced, before configs can be compared. Build the graph first.

4. **It's demonstrable in 30 seconds.** "Watch: I plug in, hit scan, and in 15 seconds I see every device on this network, what it is, and how it connects." That's a trade show demo. That's a YouTube video. That's word of mouth.

5. **It validates the hardest technical risk first.** If device discovery and identification don't work reliably, nothing else matters. Find out fast.

6. **The upgrade path is natural.** Free topology view → "I wish I could trace this signal" → Pro license → "I wish it could troubleshoot" → AI features → "My whole team needs this" → Team license.

### The Exact Feature List for v0.1

```
SIGNALGRAPH v0.1 — "See Your System"

✅ Network discovery (mDNS, SNMP, ARP, Dante, NDI)
✅ Device identification (vendor, model, firmware)
✅ Interactive topology graph (react-flow)
✅ Device status (online/offline/error)
✅ Basic device inspector (click to see details)
✅ Manual device addition
✅ Signal-path display (discovered routes)
✅ Basic search and filter
✅ Save/load topology (local file)
✅ Dark theme
✅ Windows installer + macOS build
✅ Offline-first (no internet required)

❌ NOT included: AI, labeling, documentation, config management,
   rollback, team features, cloud anything
```

### Timeline: 6 Weeks to v0.1

| Week | Deliverable |
|------|-------------|
| 1 | Tauri app shell, SQLite schema, event bus |
| 2 | Network scanner, mDNS + SNMP discovery |
| 3 | Device identification, Blackmagic + Dante connectors |
| 4 | React Flow topology view, device inspector |
| 5 | Signal-path display, save/load, search |
| 6 | Polish, packaging, Windows + macOS builds |

### Then What

If v0.1 gets 100 installs and positive feedback from real AV engineers, immediately build:
- **v0.2** (4 weeks): AI CoPilot with signal-path tracing queries
- **v0.3** (4 weeks): Config snapshots, diff, basic labeling
- **v0.4** (4 weeks): Troubleshooting engine, rollback, audit log
- **v1.0** (4 weeks): Full labeling, documentation, preflight, polish

If v0.1 doesn't get traction, you've spent 6 weeks and learned exactly why. Pivot the positioning, the UX, or the target market — but you'll pivot with real feedback, not theory.

---

## My Strongest Opinion

**Stop planning and start building the discovery engine.** The product thesis is sound. The market need is real. The technical architecture is solid. But none of that matters until a real AV engineer opens SignalGraph, scans a network, sees their system mapped automatically, and says: "Where has this been my whole career?"

That moment is 6 weeks away. Ship it.
