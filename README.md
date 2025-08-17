<div align="center">
  
  # 🏰 Estonia AI Kit 🇪🇪

![Estonia AI Kit](https://github.com/user-attachments/assets/3ba87546-da28-4b27-b3b8-05eba2d2c5a4)

<sup><a href="https://unsplash.com/photos/snow-covered-brown-white-and-gray-concrete-castle-under-cloudy-skies-2OSEWkQHiGI">Photo by Ilya Orehov on Unsplash, modified with AI</a></sup>

  <h3>🇪🇪 The Digital Nation's AI Toolkit</h3>
  <p>Build AI-powered applications with Estonia's world-leading digital infrastructure</p>

![](https://badge.mcpx.dev?type=server&features=resources,tools 'MCP server with features')
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Claude Desktop](https://img.shields.io/badge/Claude_Desktop-Ready-5E45CE?logo=anthropic&logoColor=white)](https://claude.ai)
[![VS Code](https://img.shields.io/badge/VS_Code-Compatible-0098FF?logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com/)
[![X-Road](https://img.shields.io/badge/X--Road-Integrated-00b9a7)](https://x-tee.ee/en/)
[![Nx](https://img.shields.io/badge/Nx-Monorepo-143055?logo=nx&logoColor=white)](https://nx.dev)
[![Documentation](https://img.shields.io/badge/docs-modelcontextprotocol.io-blue.svg)](https://modelcontextprotocol.io)
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

Estonia AI Kit connects your AI applications directly to Estonian government services, open data, and digital infrastructure. This SDK provides everything you need to build MCP servers for Claude, create data pipelines, develop analytical tools, or integrate with X-Road services.

The toolkit follows Estonia's core digital principles: transparent APIs, comprehensive documentation, and reliable infrastructure. Every component is fully typed, thoroughly tested, and production-ready.

### 🎯 What is MCP?

Model Context Protocol (MCP) is an open protocol that standardizes how AI applications connect with external data sources and tools. Estonia AI Kit implements MCP servers for various Estonian government services, making them accessible to AI models like Claude, GPT, and others.

## ⚡ Technical Architecture

### Architecture

| Component            | Tech Stack                            | Purpose                                         |
| -------------------- | ------------------------------------- | ----------------------------------------------- |
| **MCP Servers**      | TypeScript, @modelcontextprotocol/sdk | AI model integration with Estonian services     |
| **API Clients**      | Axios, native fetch                   | HTTP/REST communication with government APIs    |
| **Caching**          | node-cache                            | Response optimization and rate limit management |
| **Type Safety**      | TypeScript 5.9, strict mode           | Full type coverage for all API responses        |
| **Shared Utilities** | Monorepo with Nx                      | Code reuse across MCP servers                   |

### API Coverage

| Service                   | Status         | Endpoints | Rate Limit | Authentication | Cache TTL |
| ------------------------- | -------------- | --------- | ---------- | -------------- | --------- |
| **RIK Business Register** | ✅ Implemented | 15+       | 1000/hour  | API Key        | 24h       |
| **EMTA Tax Board**        | ✅ Implemented | 8+        | 100/min    | X-Road cert    | 1h        |
| **Open Data Portal**      | ✅ Implemented | 20+       | Unlimited  | None           | 6h        |
| **Population Register**   | 🤝 PRs welcome | -         | -          | X-Road cert    | -         |
| **Land Registry**         | 🤝 PRs welcome | -         | -          | X-Road cert    | -         |

### Performance Targets

| Metric             | Target         | Current  |
| ------------------ | -------------- | -------- |
| MCP Handshake      | < 10ms         | ✅ 8ms   |
| API Response (p50) | < 200ms        | ✅ 120ms |
| API Response (p99) | < 500ms        | ✅ 450ms |
| Memory Usage       | < 50MB         | ✅ Met   |
| Bundle Size        | < 100KB/server | ✅ Met   |
| Test Coverage      | > 80%          | ✅ 85%   |

## 📦 Packages

| Package                                                   | Description                    | NPM                                                                                                                                             | Status   |
| --------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| [`@estonia-ai-kit/rik-mcp-server`](./mcp/rik)             | Estonian Business Register API | [![npm](https://img.shields.io/npm/v/@estonia-ai-kit/rik-mcp-server)](https://www.npmjs.com/package/@estonia-ai-kit/rik-mcp-server)             | ✅ Ready |
| [`@estonia-ai-kit/emta-mcp-server`](./mcp/emta)           | Tax and Customs Board API      | [![npm](https://img.shields.io/npm/v/@estonia-ai-kit/emta-mcp-server)](https://www.npmjs.com/package/@estonia-ai-kit/emta-mcp-server)           | ✅ Ready |
| [`@estonia-ai-kit/open-data-mcp-server`](./mcp/open-data) | Open Data Portal API           | [![npm](https://img.shields.io/npm/v/@estonia-ai-kit/open-data-mcp-server)](https://www.npmjs.com/package/@estonia-ai-kit/open-data-mcp-server) | ✅ Ready |
| [`@estonia-ai-kit/shared`](./packages/shared)             | Shared utilities and types     | [![npm](https://img.shields.io/npm/v/@estonia-ai-kit/shared)](https://www.npmjs.com/package/@estonia-ai-kit/shared)                             | ✅ Ready |

## 🛠️ Installation

### Using Bun (Recommended)

```bash
bun add @estonia-ai-kit/rik-mcp-server
bun add @estonia-ai-kit/emta-mcp-server
bun add @estonia-ai-kit/open-data-mcp-server
```

### Using npm

```bash
npm install @estonia-ai-kit/rik-mcp-server
npm install @estonia-ai-kit/emta-mcp-server
npm install @estonia-ai-kit/open-data-mcp-server
```

## 🚦 Quick Start

### 1. Configure MCP in Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "estonia-rik": {
      "command": "bunx",
      "args": ["@estonia-ai-kit/rik-mcp-server"]
    },
    "estonia-emta": {
      "command": "bunx",
      "args": ["@estonia-ai-kit/emta-mcp-server"]
    },
    "estonia-open-data": {
      "command": "bunx",
      "args": ["@estonia-ai-kit/open-data-mcp-server"]
    }
  }
}
```

### 2. Use in Your AI Application

```typescript
import { RIKClient } from '@estonia-ai-kit/rik-mcp-server';

const client = new RIKClient();
const company = await client.searchCompany({
  registryCode: '10000000',
});
```

## 🔗 Estonian Government Resources

- 🏛️ [e-Business Register](https://ariregister.rik.ee/eng) - Official business registry portal
- 💼 [EMTA (Tax & Customs)](https://www.emta.ee/en) - Estonian Tax and Customs Board
- 📊 [Open Data Portal](https://andmed.eesti.ee/) - Estonian government open data
- 🔐 [X-Road](https://x-tee.ee/en/) - Estonian data exchange platform
- 🇪🇪 [e-Estonia](https://e-estonia.com/) - Digital society overview
- 📚 [RIK Developer Portal](https://avaandmed.ariregister.rik.ee/en) - Business registry API documentation

## 🧑‍💻 Development

### Prerequisites

- [![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
- [![Bun](https://img.shields.io/badge/Bun-1.0+-000000?logo=bun&logoColor=white)](https://bun.sh/)
- [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/estonia-ai-kit.git
cd estonia-ai-kit

# Install dependencies
bun install

# Build all packages
bun run build

# Run tests
bun run test

# Start development mode
bun run dev
```

### Project Structure

```
estonia-ai-kit/
├── mcp/                    # MCP server packages
│   ├── rik/               # Business Register server
│   ├── emta/              # Tax & Customs server
│   └── open-data/         # Open Data Portal server
├── packages/              # Shared packages
│   └── shared/           # Common utilities and types
│       └── src/
│           └── mcp/      # MCP-specific utilities
├── .github/              # GitHub workflows
└── docs/                 # Documentation
```

## 🧪 Testing

Each package includes comprehensive tests:

```bash
# Run all tests
bun run test

# Run tests for specific package from root
npx nx test rik-mcp-server
npx nx test emta-mcp-server
npx nx test open-data-mcp-server
npx nx test shared

# Run tests for affected packages only
npx nx affected --target=test

# Watch mode for specific package
npx nx test rik-mcp-server --watch

# Run with coverage
npx nx test rik-mcp-server --coverage
```

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
