# @estonia-ai-kit/riigiteataja-api-client

## Estonian Legal Database API Client

TypeScript client library for accessing Estonian legislative documents from Riigiteataja.ee, the official publication of Estonian legislation. This library provides programmatic access to legal texts with bilingual support for Estonian and English translations.

> [!NOTE]
> Part of the [Estonia AI Kit](https://github.com/stefanoamorelli/estonia-ai-kit) monorepo - The Digital Nation's AI Toolkit

## Installation

```bash
# Using bun (recommended)
bun add @estonia-ai-kit/riigiteataja-api-client

# Using npm
npm install @estonia-ai-kit/riigiteataja-api-client

# Using yarn
yarn add @estonia-ai-kit/riigiteataja-api-client
```

## Features

- Official Riigiteataja.ee API integration
- Bilingual document retrieval (Estonian and English)
- Automatic retry logic with exponential backoff
- Full TypeScript type definitions
- Parallel document fetching capabilities
- Section-level document parsing
- XML to structured JSON conversion

## Usage

### Basic Example

```typescript
import { RiigiteatajaClient } from '@estonia-ai-kit/riigiteataja-api-client';

const client = new RiigiteatajaClient();

// Fetch Estonian legislative document
const estonianDocument = await client.fetchDocument(512092025009, 'et');

// Fetch English translation
const englishDocument = await client.fetchDocument(512092025009, 'en');

// Search legislative database
const searchResults = await client.searchLaws({
  otsisona: 'citizenship',
  tulemusi: 10
});
```

### Advanced Configuration

```typescript
import {
  RiigiteatajaApiFetcher,
  RiigiteatajaEnglishFetcher
} from '@estonia-ai-kit/riigiteataja-api-client';

// Configure API fetcher with custom settings
const apiFetcher = new RiigiteatajaApiFetcher({
  baseUrl: 'https://www.riigiteataja.ee',
  timeout: 30000,
  maxRetries: 3
});

// Search with specific parameters
const laws = await apiFetcher.searchLaws({
  akti_liik: 'seadus',
  sorteeri: 'relevants',
  tulemusi: 50
});

// English translation fetcher
const englishFetcher = new RiigiteatajaEnglishFetcher();
const translations = await englishFetcher.searchEnglishTranslations(100);
```

### Parallel Bilingual Fetching

```typescript
// Fetch both language versions simultaneously
const { estonian, english } = await client.fetchBilingual(512092025009);

console.log('Estonian title:', estonian.pealkiri);
console.log('English title:', english.pealkiri);
```

## API Reference

### RiigiteatajaClient

Primary client interface for document retrieval.

#### Methods

| Method                              | Description                              |
| ----------------------------------- | ---------------------------------------- |
| `fetchDocument(globalId, language)` | Retrieve single document by global ID    |
| `searchLaws(params)`                | Search Estonian legislative database     |
| `searchEnglishTranslations(limit)`  | Discover available English translations  |
| `fetchBilingual(globalId)`          | Parallel fetch of both language versions |

### RiigiteatajaApiFetcher

Direct API client for Estonian documents.

#### Methods

| Method                              | Description                  |
| ----------------------------------- | ---------------------------- |
| `searchLaws(params)`                | Query official API endpoint  |
| `fetchDocument(globalId, language)` | Fetch and parse XML document |
| `fetchXml(path)`                    | Retrieve raw XML data        |

### RiigiteatajaEnglishFetcher

Specialized client for English translation retrieval.

#### Methods

| Method                             | Description                       |
| ---------------------------------- | --------------------------------- |
| `searchEnglishTranslations(limit)` | Discover translation availability |
| `fetchEnglishDocument(globalId)`   | Retrieve English version          |
| `discoverTranslationId(globalId)`  | Map global ID to translation ID   |

## Technical Implementation

### Estonian Document Retrieval

The library interfaces with the official API endpoint at `/api/oigusakt_otsing/1/otsi` for searching and `/akt/{globalId}/xml` for document retrieval. XML responses are parsed and converted to structured TypeScript objects.

### English Translation Handling

English translations use a hybrid approach combining HTML scraping for ID discovery and XML fetching from `/en/tolge/xml/{translationId}`. The library maintains internal ID mapping between global identifiers and translation identifiers.

### Error Handling

The library implements comprehensive error handling with automatic retry logic for transient failures. Network timeouts and API rate limits are handled gracefully with exponential backoff strategies.

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Build library
bun run build

# Type checking
bun run typecheck

# Linting
bun run lint
```

## Contributing

Contributions are welcome. Please refer to the main repository's contribution guidelines.

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0). See the [LICENSE](LICENSE) file for details.

## Citation

If you use this software in academic work, please cite:

```bibtex
@software{riigiteataja_api_client,
  author = {Amorelli, Stefano},
  title = {Riigiteataja API Client - Estonian Legal Database Integration},
  year = {2025},
  url = {https://github.com/stefanoamorelli/estonia-ai-kit}
}
```

## Support

For issues, feature requests, or questions, please open an issue in the [GitHub repository](https://github.com/stefanoamorelli/estonia-ai-kit/issues).
