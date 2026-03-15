# 19. Suggested Tech Stack

## Specific Recommendations

| Layer | Technology | Reasoning |
|-------|-----------|-----------|
| **Desktop Framework** | **Tauri 2.0** | Rust backend + web frontend. Small binary (~20MB vs 200MB Electron). Low memory. Native feel. Cross-platform. |
| **Backend Language** | **Rust** | Memory safety without GC. Excellent async (Tokio). Fast network I/O. Strong type system prevents entire classes of bugs. |
| **Frontend** | **React 18 + TypeScript** | Massive ecosystem. react-flow for graph visualization. Huge talent pool. Fast iteration. |
| **Frontend Build** | **Vite** | Fastest dev server. Native ESM. Clean build pipeline. |
| **UI Component Library** | **Radix UI + Tailwind CSS** | Unstyled primitives (Radix) + utility CSS (Tailwind) = full control over look/feel. No opinionated design system. |
| **Graph Visualization** | **React Flow** (primary) + **D3.js** (custom viz) | React Flow for interactive topology. D3 for specialized visualizations (rack elevations, signal flow diagrams). |
| **State Management** | **Zustand** | Simple, fast, TypeScript-native. No Redux boilerplate. Perfect for Tauri IPC integration. |
| **Local Database** | **SQLite** (via `rusqlite` in Rust) | Embedded, zero-config, bulletproof. WAL mode for concurrent reads. Handles 100K+ rows easily. |
| **Schema Migrations** | **refinery** (Rust) | Compile-time verified SQL migrations. |
| **AI Runtime (Local)** | **llama.cpp** (via `llama-cpp-rs` bindings) | Best-in-class local inference. GGUF model format. CPU + GPU support. Active development. |
| **Local AI Model** | **Llama 3.1 8B (Q4_K_M)** default, **Phi-3 Mini** for low-spec machines | Good reasoning at 4-6GB RAM. Quantized models run on CPU. |
| **Cloud AI** | **Anthropic Claude API** | Best reasoning for complex diagnostics. Tool calling support. Long context for config analysis. |
| **Embedding Model** | **all-MiniLM-L6-v2** (ONNX, ~80MB) | Fast, small, runs locally. Good enough for RAG retrieval. |
| **Vector Store** | **LanceDB** (embedded) | Embedded vector database. No server. Rust-native. Perfect for local-first RAG. |
| **Async Runtime** | **Tokio** | Industry standard for async Rust. Powers discovery, device polling, event bus. |
| **Network Discovery** | **libpnet** + **mdns** + **snmp-rs** | Low-level network access (libpnet), mDNS discovery, SNMP queries. |
| **Serialization** | **serde** + **serde_json** | Standard Rust serialization. Used for configs, IPC, storage. |
| **HTTP Client** | **reqwest** | Async HTTP client for REST API connectors. |
| **WebSocket** | **tokio-tungstenite** | Async WebSocket for real-time device APIs. |
| **SSH** | **russh** | Pure Rust SSH client for device management. |
| **SNMP** | **snmp-rs** or **puresnmp** via FFI | SNMP v1/v2c/v3 support. |
| **OSC** | **rosc** | OSC protocol for show control integration. |
| **Serial Ports** | **serialport-rs** | RS-232/422/485 for legacy device control. |
| **PDF Generation** | **printpdf** (Rust) or **@react-pdf/renderer** (frontend) | Rack elevations, patch sheets, documentation PDFs. |
| **QR Code Generation** | **qrcode** (Rust crate) | Local QR code generation for labels. |
| **Label Printing** | Custom adapters per printer SDK | Brother b-PAC SDK, Dymo SDK, or raw ESC/POS. |
| **Testing (Rust)** | Built-in `cargo test` + **mockall** | Unit tests, integration tests, mock device simulation. |
| **Testing (Frontend)** | **Vitest** + **React Testing Library** | Fast, Vite-native testing. |
| **E2E Testing** | **Playwright** | Cross-browser E2E tests for the Tauri webview. |
| **CI/CD** | **GitHub Actions** | Build, test, and release for Windows/macOS/Linux. |
| **Packaging** | **Tauri bundler** | MSI (Windows), DMG (macOS), AppImage (Linux). |
| **Auto-Update** | **Tauri updater** | Built-in update mechanism with custom update server. |
| **Logging** | **tracing** (Rust) + **tracing-subscriber** | Structured logging with span-based tracing. |
| **Error Handling** | **anyhow** + **thiserror** | anyhow for application errors, thiserror for library errors. |
| **Config Files** | **TOML** (app config) + **YAML** (connector manifests) | TOML for Rust-native config. YAML for human-readable connector definitions. |

---

## Architecture Dependency Graph

```
┌─────────────────────────────────────────────┐
│                  User                        │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│  Frontend: React + TypeScript + Vite         │
│  ├── React Flow (topology)                   │
│  ├── Radix UI + Tailwind (components)        │
│  ├── Zustand (state)                         │
│  └── @react-pdf/renderer (PDF output)        │
└─────────────────┬───────────────────────────┘
                  │ Tauri IPC (Commands + Events)
┌─────────────────▼───────────────────────────┐
│  Backend: Rust + Tokio                       │
│  ├── Services (discovery, graph, AI, etc.)   │
│  ├── Connectors (vendor adapters)            │
│  ├── AI Runtime (llama.cpp + Anthropic API)  │
│  └── Data Layer (SQLite + LanceDB)           │
└─────────────────┬───────────────────────────┘
                  │ Network I/O
┌─────────────────▼───────────────────────────┐
│  AV Devices & Network Infrastructure        │
│  ├── REST APIs (reqwest)                     │
│  ├── SNMP (snmp-rs)                          │
│  ├── TCP/Telnet (tokio::net)                 │
│  ├── SSH (russh)                             │
│  ├── WebSocket (tokio-tungstenite)           │
│  ├── OSC (rosc)                              │
│  ├── UDP (tokio::net)                        │
│  ├── Serial (serialport-rs)                  │
│  └── mDNS (mdns crate)                      │
└─────────────────────────────────────────────┘
```

---

## System Requirements

### Minimum (10-50 devices)
- CPU: 4-core x86_64 (Intel i5 / AMD Ryzen 5)
- RAM: 8GB (app uses ~500MB including AI model)
- Disk: 2GB (app + model files)
- OS: Windows 10 21H2+, macOS 12+, Ubuntu 22.04+
- Network: Ethernet (WiFi works but not recommended for production)

### Recommended (50-500 devices)
- CPU: 8-core x86_64 (Intel i7 / AMD Ryzen 7)
- RAM: 16GB (comfortable headroom for AI + large graph)
- GPU: Optional — NVIDIA GPU for faster AI inference
- Disk: 5GB (app + model files + snapshots)
- OS: Windows 11, macOS 14+, Ubuntu 24.04+
- Network: Gigabit Ethernet on management VLAN

### Optimal (500+ devices, full AI)
- CPU: 12+ core (Intel i9 / AMD Ryzen 9)
- RAM: 32GB (larger AI model + extensive history)
- GPU: NVIDIA RTX 3060+ (for 70B model inference)
- Disk: 20GB SSD
- Network: Gigabit Ethernet, dedicated management NIC
