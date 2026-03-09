# @estonia-ai-kit/rik-mcp-server

## Estonian Business Register MCP Server

Connect AI assistants to Estonia's Business Register (Äriregister) with a comprehensive dataset of Estonian companies and board members in a blazing-fast SQLite database.

> [!NOTE]
> Part of the [Estonia AI Kit](https://github.com/stefanoamorelli/estonia-ai-kit) monorepo - The Digital Nation's AI Toolkit

> [!IMPORTANT]
> **New in v1.1.0**: SQLite database with extensive company and board member data for instant queries!
>
> This server uses downloadable open data files and builds a local SQLite database for lightning-fast searches.

## 🚀 Quick Start

### Step 1: Download and Build Database (Required - One Time)

```bash
cd mcp/rik

# Download data files (~6GB total)
bun run download-data

# Build SQLite database
node scripts/import-board-stream.js
```

This downloads:

- 📊 92MB - Basic company data (CSV)
- 👥 976MB - Board members (JSON)
- 💼 718MB - Shareholders (JSON)
- 🏢 4.3GB - General company data (JSON)
- 🔍 328MB - Beneficial owners (JSON)

And creates a compact SQLite database with instant search capabilities!

### Step 2: Configure Claude Desktop

Add to `~/.config/Claude/claude_desktop_config.json` (Linux) or `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac):

```json
{
  "mcpServers": {
    "estonia-rik": {
      "command": "node",
      "args": ["/path/to/estonia-ai-kit/mcp/rik/dist/index.js"]
    }
  }
}
```

## 🎯 What You Can Ask

### 🏢 Company Searches

- "Show me companies at Sepapaja tn 6"
- "Find all companies with 'crypto' in their name"
- "List companies registered in 2024"
- "Show companies in liquidation status"
- "Find company details by registry code"

### 👥 Board Member Queries

- "Show board members of a specific company"
- "Find all companies where [person name] is a board member"
- "Which person serves on the most company boards?"
- "Show companies that share board members with Pipedrive"

### 📊 Statistical Analysis

- "How many companies are registered in Estonia?"
- "How many board members in total?"
- "Distribution of companies by legal form (OÜ, AS, MTÜ)"
- "Most popular addresses for company registration"

### 🔍 Advanced Detective Work

- "Find all companies at the same address as Bolt"
- "Companies sharing both address AND board members"
- "Sequential registry codes (registered same day)"
- "Foreign-owned companies by board member addresses"

## ✨ Features

### What Works Great

✅ **Lightning Fast** - SQLite database with proper indexing  
✅ **Comprehensive** - Extensive dataset of Estonian companies and board members  
✅ **Rich Data** - Names, addresses, VAT numbers, status, registration dates  
✅ **Board Members** - Full names, roles, start/end dates  
✅ **Address Search** - Find all companies at any address  
✅ **People Search** - Find all companies by person name  
✅ **Complex Queries** - Cross-reference board members and addresses

### Current Limitations

⚠️ **Data Freshness** - Daily snapshots (re-download for updates)  
⚠️ **Annual Reports** - Use XBRL filings server for financial data  
⚠️ **Tax Debts** - Requires EMTA authentication  
⚠️ **Personal IDs** - Removed for privacy (since Nov 2024)

## 📈 Database Statistics

| Table                | Records         | Description                          |
| -------------------- | --------------- | ------------------------------------ |
| companies            | Partial dataset | Estonian companies                   |
| board_members        | Partial dataset | Current and historical board members |
| shareholders         | Available       | Company ownership data               |
| beneficial_owners    | Available       | Ultimate beneficial owners           |
| company_general_data | Available       | Extended company information         |

## 🛠️ Available Tools

```typescript
// Company Search
searchCompany({
  name?: string,        // Company name or partial
  registryCode?: string,// 8-digit code
  address?: string,     // Any part of address
  query?: string        // General search
})

// Company Details
getCompanyDetails(registryCode: string)

// Board Members
getBoardMembers(registryCode: string)

// Person Search
searchByPerson({
  name: string,         // Person's full or partial name
  personalCode?: string // Optional ID code
})

// Statistics
getRegistryStatistics() // Database statistics

// Data Check
checkDataAvailability() // Verify database status
```

## 🔧 Maintenance

### Update Data (Monthly Recommended)

```bash
# Re-download latest data
bun run download-data

# Rebuild database
rm .rik-data/rik_data.db
node scripts/import-board-stream.js
```

### Check Database

```bash
# Query statistics
sqlite3 .rik-data/rik_data.db "SELECT COUNT(*) FROM companies;"
sqlite3 .rik-data/rik_data.db "SELECT COUNT(*) FROM board_members;"
```

## 🌐 Data Sources

- **Open Data**: https://avaandmed.ariregister.rik.ee/en/downloading-open-data
- **Web Portal**: https://ariregister.rik.ee
- **Update Frequency**: Daily at source
- **License**: Open data, free to use

## 📦 Part of Estonia AI Kit

This package is part of the [Estonia AI Kit](https://github.com/stefanoamorelli/estonia-ai-kit) monorepo. For complete documentation, contributing guidelines, and additional tools, visit the main repository.

## ⚖️ License

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
