# @estonia-ai-kit/open-data-mcp-server

## Estonian Open Data Portal MCP Server

Access 2,000+ government datasets through Estonia's Open Data Portal API with built-in caching, streaming, and format conversion.

> [!NOTE]
> Part of the [Estonia AI Kit](https://github.com/stefanoamorelli/estonia-ai-kit) monorepo - The Digital Nation's AI Toolkit

> [!IMPORTANT]
> This package provides **real data access to Statistics Estonia (andmed.stat.ee)** API with access to 3,000+ statistical tables.
>
> **Currently Supported:**
>
> - ✅ **Statistics Estonia API**: Official Estonian statistics database
> - 📊 Population, economic indicators, demographics, and more
> - 🎯 No authentication required for public data
> - 📈 Real-time access to government statistical data
>
> **Working Features:**
>
> - Population statistics by year and demographic groups
> - Economic indicators (GDP, unemployment, wages)
> - Browse statistical categories and tables
> - Query specific statistical tables with filters
> - Format and export statistical data
>
> **Note:** Currently only Statistics Estonia (andmed.stat.ee) is implemented. Support for additional Estonian open data sources is welcome - PRs are encouraged!
>
> **API Documentation:**
>
> - Statistics Estonia: https://andmed.stat.ee/help/api-manual.pdf

### Dataset Coverage

| Category     | Datasets | Formats        | Update Freq  |
| ------------ | -------- | -------------- | ------------ |
| Demographics | 450+     | CSV, JSON, XML | Monthly      |
| Economics    | 380+     | CSV, XLSX, API | Daily/Weekly |
| Environment  | 290+     | GeoJSON, SHP   | Real-time    |
| Transport    | 180+     | GTFS, JSON     | Real-time    |
| Health       | 220+     | CSV, JSON      | Weekly       |
| Education    | 150+     | CSV, XLSX      | Yearly       |

### Quick Start

```bash
# Install
bun add @estonia-ai-kit/open-data-mcp-server

# Configure in Claude Desktop
{
  "mcpServers": {
    "estonia-open-data": {
      "command": "bunx",
      "args": ["@estonia-ai-kit/open-data-mcp-server"]
    }
  }
}
```

### Streaming Large Datasets

```typescript
interface DataTools {
  // Search & Discovery
  searchDatasets(params: {
    query?: string;
    category?: Category;
    format?: Format;
    organization?: string;
  }): Dataset[];

  // Data Access
  getDataset(id: string): DatasetMetadata;

  streamData(params: {
    datasetId: string;
    format?: 'csv' | 'json' | 'parquet';
    filters?: Record<string, any>;
    limit?: number;
  }): AsyncIterator<DataChunk>;

  // Analytics
  getStatistics(datasetId: string): DatasetStats;
  getTimeSeries(params: { datasetId: string; metric: string; period: Period }): TimeSeriesData;
}
```

### Optimization Features

```typescript
const optimizations = {
  streaming: {
    chunk_size: '10MB',
    backpressure: true,
    parallel_downloads: 4,
  },
  caching: {
    strategy: 'LRU',
    max_size: '500MB',
    ttl: '6 hours',
  },
  compression: {
    gzip: true,
    brotli: true,
    ratio: '10:1 avg',
  },
  formats: {
    auto_convert: true,
    supported: ['csv', 'json', 'parquet', 'arrow'],
  },
};
```

### Popular Datasets

| Dataset                  | Records         | Use Case              |
| ------------------------ | --------------- | --------------------- |
| Population Register      | 1.3M            | Demographics analysis |
| Business Register        | 300K            | Market research       |
| Real Estate Transactions | 500K/year       | Property analytics    |
| Traffic Flow             | Real-time       | Transport planning    |
| Air Quality              | 24/7 monitoring | Environmental studies |

### API Endpoints

- **Catalog**: `https://andmed.eesti.ee/api/v1/`
- **SPARQL**: `https://andmed.eesti.ee/sparql`
- **GeoServer**: `https://andmed.eesti.ee/geoserver`
- **Real-time**: WebSocket connections available

### 📦 Part of Estonia AI Kit

This package is part of the [Estonia AI Kit](https://github.com/stefanoamorelli/estonia-ai-kit) monorepo. For complete documentation, contributing guidelines, and additional tools, visit the main repository.

### ⚖️ License

This open-source project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. This means:

- ✅ You can use, modify, and distribute this software
- ✅ If you modify and distribute it, you must release your changes under AGPL-3.0
- ✅ If you run a modified version on a server, you must provide the source code to users
- 📄 See the [LICENSE](../../LICENSE) file for full details

For commercial licensing options or other licensing inquiries, please contact **stefano@amorelli.tech**.

**Note:** Datasets accessed through this server are provided under various open licenses (CC0, CC-BY, etc.) by the Estonian government.

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
