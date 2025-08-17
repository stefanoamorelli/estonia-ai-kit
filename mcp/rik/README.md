# @estonia-ai-kit/rik-mcp-server

## Estonian Business Register MCP Server

Connect AI assistants to Estonia's Business Register (Äriregister) for real-time company data, ownership structures, and financial reports.

> [!NOTE]
> Part of the [Estonia AI Kit](https://github.com/stefanoamorelli/estonia-ai-kit) monorepo - The Digital Nation's AI Toolkit

### What's Inside

| Data Type | Coverage | Update Frequency |
|-----------|----------|-----------------|
| Company profiles | 300,000+ entities | Real-time |
| Annual reports | 10 years history | Daily |
| Ownership chains | Full depth | Real-time |
| Board members | Current & historical | Real-time |
| Financial statements | XBRL format | As filed |

### Quick Start

```bash
# Install
bun add @estonia-ai-kit/rik-mcp-server

# Configure in Claude Desktop
# ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "estonia-rik": {
      "command": "bunx",
      "args": ["@estonia-ai-kit/rik-mcp-server"]
    }
  }
}
```

### Available Tools

```typescript
interface RIKTools {
  searchCompany(params: {
    name?: string;
    registryCode?: string;
    vatNumber?: string;
  }): CompanyData;

  getCompanyDetails(registryCode: string): DetailedCompany;
  
  getAnnualReports(params: {
    registryCode: string;
    year?: number;
  }): FinancialReport[];
  
  getOwnershipStructure(registryCode: string): OwnershipTree;
  
  searchByPerson(params: {
    name?: string;
    idCode?: string;
  }): PersonCompanies[];
}
```

### Performance

- **Response time**: < 200ms (p95)
- **Cache hit rate**: 85%
- **Rate limit**: 1000 req/hour
- **Uptime**: 99.9%

### Data Sources

Direct integration with:
- [Äriregister API](https://avaandmed.ariregister.rik.ee/en)
- [e-Business Portal](https://ariregister.rik.ee/eng)
- [XBRL Financial Reports](https://aruanded.rik.ee/)

### 📦 Part of Estonia AI Kit

This package is part of the [Estonia AI Kit](https://github.com/stefanoamorelli/estonia-ai-kit) monorepo. For complete documentation, contributing guidelines, and additional tools, visit the main repository.

### ⚖️ License

This open-source project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. This means:

- ✅ You can use, modify, and distribute this software
- ✅ If you modify and distribute it, you must release your changes under AGPL-3.0
- ✅ If you run a modified version on a server, you must provide the source code to users
- 📄 See the [LICENSE](../../LICENSE) file for full details

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