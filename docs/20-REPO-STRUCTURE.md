# 20. Repository Structure

```
signalgraph/
├── docs/                              # Product & architecture documentation
│   ├── 00-PRODUCT-THESIS.md
│   ├── 01-INDUSTRY-PROBLEM.md
│   ├── ...
│   └── 20-REPO-STRUCTURE.md
│
├── src-tauri/                         # Rust backend (Tauri core)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── main.rs                    # Tauri entry point
│   │   ├── lib.rs                     # Library root
│   │   ├── commands.rs                # Tauri IPC command handlers
│   │   │
│   │   ├── models/                    # Data models (the digital twin)
│   │   │   ├── mod.rs
│   │   │   ├── device.rs             # Device, DeviceType, Location
│   │   │   ├── signal.rs             # Port, Route, SignalChain, SignalFormat
│   │   │   └── audit.rs              # ChangeRecord, Snapshot, Alarm
│   │   │
│   │   ├── services/                  # Core business logic
│   │   │   ├── mod.rs
│   │   │   ├── discovery.rs          # Network discovery & device identification
│   │   │   ├── graph.rs              # Topology graph & signal-path traversal
│   │   │   ├── labeling.rs           # LabelForge — auto-labeling engine
│   │   │   ├── troubleshoot.rs       # DiagnosticCore — troubleshooting engine
│   │   │   ├── rollback.rs           # Rollback manager
│   │   │   └── ai_executor.rs        # CoPilot — AI tool calling & orchestration
│   │   │
│   │   ├── connectors/                # Vendor/protocol connector system
│   │   │   ├── mod.rs
│   │   │   ├── traits.rs             # Connector trait interface
│   │   │   └── manager.rs            # Connector registry & dispatch
│   │   │
│   │   ├── ai/                        # AI runtime integration
│   │   │   ├── mod.rs
│   │   │   ├── local_llm.rs          # llama.cpp integration
│   │   │   ├── cloud_llm.rs          # Anthropic API client
│   │   │   ├── rag.rs                # RAG pipeline (embeddings + vector search)
│   │   │   └── prompts.rs            # System prompts & tool definitions
│   │   │
│   │   └── db/                        # Database layer
│   │       ├── mod.rs
│   │       ├── schema.rs             # SQLite schema definitions
│   │       ├── migrations/            # Database migrations
│   │       └── queries.rs            # Typed query helpers
│   │
│   └── icons/                         # App icons
│
├── src/                               # React frontend
│   ├── App.tsx                        # Root component
│   ├── main.tsx                       # Entry point
│   │
│   ├── components/                    # Reusable UI components
│   │   ├── DeviceNode.tsx            # Graph node component
│   │   ├── StatusIndicator.tsx       # Green/yellow/red status dot
│   │   ├── ApprovalDialog.tsx        # Action approval modal
│   │   ├── DiffView.tsx              # Config diff display
│   │   └── ...
│   │
│   ├── views/                         # Full-screen views
│   │   ├── SystemMap.tsx             # Topology graph view
│   │   ├── PathTrace.tsx             # Signal-path explorer
│   │   ├── DeviceInspector.tsx       # Device detail view
│   │   ├── IssueInbox.tsx            # Alerts & problems
│   │   ├── ConfigDiff.tsx            # Snapshot comparison
│   │   ├── LabelWorkspace.tsx        # LabelForge UI
│   │   ├── CoPilotPanel.tsx          # AI command interface
│   │   ├── PreflightCheck.tsx        # Pre-show checklist
│   │   ├── ChangeLog.tsx             # Audit trail
│   │   └── PostShowReport.tsx        # Post-show summary
│   │
│   ├── hooks/                         # Custom React hooks
│   │   ├── useDiscovery.ts           # Discovery state & events
│   │   ├── useGraph.ts               # Graph data & queries
│   │   ├── useCoPilot.ts             # AI interactions
│   │   └── useDeviceStatus.ts        # Real-time device polling
│   │
│   ├── stores/                        # Zustand state stores
│   │   ├── graphStore.ts             # Topology state
│   │   ├── uiStore.ts                # UI state (selected view, theme)
│   │   └── sessionStore.ts           # Session & user state
│   │
│   ├── types/                         # TypeScript type definitions
│   │   └── graph.ts                  # Mirrors Rust models
│   │
│   └── lib/                           # Utility functions
│       ├── tauri.ts                   # Tauri IPC wrappers
│       └── format.ts                 # Display formatting helpers
│
├── connectors/                        # Standalone connector packages
│   ├── snmp/                          # Generic SNMP connector
│   ├── blackmagic/                    # Blackmagic VideoHub connector
│   ├── dante/                         # Dante audio network connector
│   ├── ndi/                           # NDI discovery connector
│   └── generic-rest/                  # Generic REST API connector
│
├── tests/
│   ├── rust/                          # Rust unit & integration tests
│   ├── frontend/                      # React component tests
│   └── e2e/                           # Playwright E2E tests
│
├── .github/
│   └── workflows/
│       ├── ci.yml                     # Build & test
│       └── release.yml                # Package & publish
│
├── package.json                       # Frontend dependencies
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── README.md
```

## Key Architecture Decisions in Structure

1. **Monorepo**: Everything in one repo for simplicity at this stage. Connectors could split out later.

2. **`src-tauri/` vs `src/`**: Standard Tauri convention. Rust backend in `src-tauri/`, React frontend in `src/`.

3. **`connectors/` at root**: Standalone connector packages that compile into the Rust backend. Each is a self-contained crate with its own tests and manifest.

4. **Models mirror across Rust/TypeScript**: The `src-tauri/src/models/` and `src/types/` directories contain parallel type definitions to ensure type safety across the IPC boundary.

5. **Services are the core**: All business logic lives in `services/`. Views and components are thin — they call services through Tauri IPC.
