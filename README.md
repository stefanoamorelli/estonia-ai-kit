<div align="center">

# 🏰 Estonia AI Kit 🇪🇪

![Estonia AI Kit](https://github.com/user-attachments/assets/3ba87546-da28-4b27-b3b8-05eba2d2c5a4)

<sup><a href="https://unsplash.com/photos/snow-covered-brown-white-and-gray-concrete-castle-under-cloudy-skies-2OSEWkQHiGI">Photo by Ilya Orehov on Unsplash, modified with AI</a></sup>

  <h3>🇪🇪 The Digital Nation's AI Toolkit</h3>
  <p>Build AI-powered applications with Estonia's world-leading digital infrastructure</p>

![](https://badge.mcpx.dev?type=server&features=resources,tools 'MCP server with features')
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?logo=go&logoColor=white)](https://go.dev/)
[![Claude Desktop](https://img.shields.io/badge/Claude_Desktop-Ready-5E45CE?logo=anthropic&logoColor=white)](https://claude.ai)
[![VS Code](https://img.shields.io/badge/VS_Code-Compatible-0098FF?logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com/)
[![Nx](https://img.shields.io/badge/Nx-Monorepo-143055?logo=nx&logoColor=white)](https://nx.dev)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

</div>

> [!NOTE]
> This is a community-driven open source project and is not affiliated with, endorsed by, or connected to the Estonian government or any official Estonian institutions.

## 🌍 The Estonian Digital Revolution

Picture this: A country where 99% of government services are online. Where you can establish a company in 18 minutes. Where blockchain secures healthcare records, and every citizen has a digital identity that works seamlessly across all services. This isn't science fiction—this is Estonia today.

Since the early 1990s, Estonia has transformed itself into one of the world's most digitally advanced societies. Starting fresh with modern infrastructure and forward-thinking policies, the country built its services digital-first from the ground up. Today, Estonia stands as a model for digital governance:

- **3 minutes** to file taxes online (with 98% of citizens doing so) <sup>[1](https://e-estonia.com/)</sup>
- **2% of GDP** saved annually through digital governance <sup>[2](https://e-estonia.com/)</sup>
- **120,000+ e-Residents** from 170+ countries running EU companies remotely <sup>[3](https://www.e-resident.gov.ee/)</sup>
- **99.9%** of banking transactions happen online <sup>[4](https://e-estonia.com/)</sup>
- **X-Road** data exchange platform processes 900+ million transactions yearly <sup>[5](https://x-road.global/)</sup>

## 📖 What is Estonia AI Kit?

Estonia AI Kit connects your AI applications directly to Estonian government services, open data, and digital infrastructure. It includes **MCP servers** for AI integration, **CLI tools** for direct terminal access, and **skills** for AI coding agents (like Claude Code) to interact with authenticated services.

### 🎯 What is MCP?

Model Context Protocol (MCP) is an open protocol that standardizes how AI applications connect with external data sources and tools. Estonia AI Kit implements MCP servers for various Estonian services, making them accessible to AI models like Claude, GPT, and others.

## 📦 What's Included

This toolkit covers **government services** (tax, business registry, legal data, statistics) and **private sector services** (banking). Some require personal authentication via Smart-ID/ID-card.

### 🏛️ Government Services

| Package                                                   | Description                                  | Type        | Auth     | Status     |
| --------------------------------------------------------- | -------------------------------------------- | ----------- | -------- | ---------- |
| [`@estonia-ai-kit/rik-mcp-server`](./mcp/rik)             | Estonian Business Register (RIK)             | MCP Server  | None     | 🔶 WIP     |
| [`@estonia-ai-kit/open-data-mcp-server`](./mcp/open-data) | Statistics Estonia / Open Data Portal        | MCP Server  | None     | 🔶 WIP     |
| [`cli/emta`](./cli/emta)                                  | Tax & Customs Board (EMTA) - TSD + KMD tools | CLI / Skill | Smart-ID | ✅ Working |
| [`rag/riigiteataja`](./rag/riigiteataja)                  | Estonian Legal Document RAG pipeline         | RAG         | None     | 🔶 WIP     |
| [`@estonia-ai-kit/shared`](./packages/shared)             | Shared utilities and types                   | Library     | -        | ✅ Ready   |

### 🏦 Private Sector Services

| Package                | Description                                 | Type        | Auth     | Status     |
| ---------------------- | ------------------------------------------- | ----------- | -------- | ---------- |
| [`cli/lhv`](./cli/lhv) | LHV Bank - accounts, transactions, payments | CLI / Skill | Smart-ID | ✅ Working |

> [!IMPORTANT]
> **CLI tools that require authentication** (Smart-ID, ID-card) authenticate as _you_ and access _your_ data. Sessions expire after ~30 minutes.

## 🚀 Quick Start

### CLI Tools / Skills

```bash
# Install the EMTA CLI
go install github.com/stefanoamorelli/estonia-ai-kit/cli/emta@latest

# Install the LHV CLI
go install github.com/stefanoamorelli/estonia-ai-kit/cli/lhv@latest
```

**EMTA** (Tax & Customs):

```bash
emta-cli login                     # Login via Smart-ID QR code
emta-cli tsd list                  # List your TSD declarations
emta-cli tsd show <declaration-id> # Show declaration details
emta-cli kmd list                  # List KMD declarations
emta-cli kmd main read --declaration-id <id>
```

**LHV Bank**:

```bash
lhv auth --interactive             # Authenticate via Smart-ID
lhv get-accounts                   # List accounts
lhv get-transactions               # View transactions
lhv pay --help                     # SEPA payment options
```

### MCP Servers

```bash
# Install dependencies
bun install

# Build all packages
bun run build
```

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "estonia-rik": {
      "command": "node",
      "args": ["/path/to/estonia-ai-kit/mcp/rik/dist/index.js"]
    },
    "estonia-open-data": {
      "command": "node",
      "args": ["/path/to/estonia-ai-kit/mcp/open-data/dist/index.js"]
    }
  }
}
```

### Claude Code Plugins

This repository includes a [Claude Code plugin marketplace](https://docs.anthropic.com/en/docs/claude-code/plugins) with ready-to-use skills for AI-assisted workflows.

```bash
# Add the marketplace (one-time setup)
/plugin marketplace add stefanoamorelli/estonia-ai-kit

# Install a plugin (e.g., LHV Bank or EMTA)
/plugin install lhv@estonia-ai-kit
/plugin install emta@estonia-ai-kit
```

Each plugin bundles a skill file that teaches Claude Code how to use the corresponding CLI tool. The CLI binary must be installed separately (see Quick Start above).

## 🛠️ Project Structure

```
estonia-ai-kit/
├── cli/                       # CLI tools / skills (authenticated services)
│   ├── emta/                  # EMTA Tax & Customs CLI (Go)
│   └── lhv/                   # LHV Bank CLI (Go)
├── mcp/                       # MCP servers
│   ├── rik/                   # Business Register
│   └── open-data/             # Statistics Estonia
├── plugins/                   # Claude Code plugin marketplace
│   ├── emta/                  # EMTA plugin + skill
│   └── lhv/                   # LHV plugin + skill
├── packages/                  # Shared TypeScript libraries
│   ├── shared/                # Common utilities
│   └── riigiteataja-api-client/
├── rag/                       # RAG pipelines
│   └── riigiteataja/          # Legal documents
└── tests/                     # E2E tests
```

## ⚡ Technical Stack

| Component              | Technology                            | Purpose                             |
| ---------------------- | ------------------------------------- | ----------------------------------- |
| **MCP Servers**        | TypeScript, @modelcontextprotocol/sdk | AI assistant integration            |
| **CLI Tools / Skills** | Go, Cobra                             | Terminal access and AI agent skills |
| **API Clients**        | Axios, native fetch, net/http         | HTTP/REST communication             |
| **Data Processing**    | CSV parsing, HTML parsing, JSON       | Handle various data formats         |
| **Monorepo**           | Nx workspace                          | Consistent tooling and code sharing |

## 🧑‍💻 Development

### Prerequisites

- [Node.js 20+](https://nodejs.org/) and [Bun 1.0+](https://bun.sh/) — for MCP servers and TS packages
- [Go 1.21+](https://go.dev/) — for CLI tools

### Setup

```bash
git clone https://github.com/stefanoamorelli/estonia-ai-kit.git
cd estonia-ai-kit

# TypeScript packages
bun install
bun run build

# Go CLI tools
cd cli/emta && go build -o emta-cli .
cd cli/lhv && make install
```

### Testing

```bash
# TypeScript packages
bun run test
npx nx test rik-mcp-server
npx nx test open-data-mcp-server
npx nx test shared
```

## 🔗 Estonian Government Resources

- 🏛️ [e-Business Register](https://ariregister.rik.ee/eng) - Official business registry portal
- 💼 [EMTA (Tax & Customs)](https://www.emta.ee/en) - Estonian Tax and Customs Board
- 📊 [Open Data Portal](https://andmed.eesti.ee/) - Estonian government open data
- 🔐 [X-Road](https://x-tee.ee/en/) - Estonian data exchange platform
- 🇪🇪 [e-Estonia](https://e-estonia.com/) - Digital society overview
- 📚 [RIK Developer Portal](https://avaandmed.ariregister.rik.ee/en) - Business registry API documentation

## 🤝 Contributing

PRs and issues welcome.

Fork → Branch → Commit → Push → PR

## ⚖️ License

This open-source project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. This means:

- ✅ You can use, modify, and distribute this software
- ✅ If you modify and distribute it, you must release your changes under AGPL-3.0
- ✅ If you run a modified version on a server, you must provide the source code to users
- 📄 See the [LICENSE](./LICENSE) file for full details

For commercial licensing options or other licensing inquiries, please contact **stefano@amorelli.tech**.

---

<div align="center">
  <p>
    <strong>Copyright © 2025 Stefano Amorelli</strong><br>
    Released under the GNU Affero General Public License v3.0<br>
    <a href="https://amorelli.tech">amorelli.tech</a> • <a href="mailto:stefano@amorelli.tech">stefano@amorelli.tech</a><br>
    <br>
    Made with ❤️ in Tallinn for Estonia's digital future 🇪🇪<br>
    Enjoy! 🎉
  </p>
</div>
