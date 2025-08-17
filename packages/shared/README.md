# @estonia-ai-kit/shared

## Shared Utilities & Core Components

Battle-tested utilities, type definitions, and X-Road client implementations used across all Estonia AI Kit packages.

> [!NOTE]
> Part of the [Estonia AI Kit](https://github.com/stefanoamorelli/estonia-ai-kit) monorepo - The Digital Nation's AI Toolkit

### What's Inside

```typescript
// Type-safe API clients
import { XRoadClient, APIClient } from '@estonia-ai-kit/shared';

// Caching strategies
import { CacheManager, TTLCache } from '@estonia-ai-kit/shared/cache';

// Estonian-specific validators
import {
  validateRegistryCode,
  validatePersonalCode,
  validateIBAN,
  validateVATNumber,
} from '@estonia-ai-kit/shared/validators';

// X-Road utilities
import { buildSOAPEnvelope, parseXRoadResponse, signMessage } from '@estonia-ai-kit/shared/xroad';

// Data transformers
import { XMLToJSON, normalizeEstonianText, parseXBRL } from '@estonia-ai-kit/shared/transform';
```

### Core Components

| Component      | Purpose                    | Features                      |
| -------------- | -------------------------- | ----------------------------- |
| `XRoadClient`  | X-Road service consumption | mTLS, SOAP, async/await       |
| `CacheManager` | Response caching           | LRU, TTL, memory limits       |
| `RateLimiter`  | API throttling             | Token bucket, sliding window  |
| `RetryClient`  | Resilient requests         | Exponential backoff, jitter   |
| `Logger`       | Structured logging         | JSON, levels, correlation IDs |

### Estonian Validators

```typescript
// Registry code (8 digits)
validateRegistryCode('12345678'); // true

// Personal ID (11 digits with checksum)
validatePersonalCode('38001010000'); // true

// Estonian IBAN
validateIBAN('EE382200221020145685'); // true

// VAT number
validateVATNumber('EE100000000'); // true
```

### X-Road Integration

```typescript
const client = new XRoadClient({
  memberClass: 'COM',
  memberCode: '12345678',
  subsystemCode: 'AIKIT',
  certificate: fs.readFileSync('cert.pem'),
  privateKey: fs.readFileSync('key.pem'),
});

const response = await client.request({
  service: 'EMTA/TaxDebt/v1',
  body: { registryCode: '12345678' },
});
```

### Performance Utilities

```typescript
// Automatic retries with backoff
const resilient = withRetry(apiCall, {
  maxAttempts: 3,
  backoff: 'exponential',
  jitter: true,
});

// Rate limiting
const limited = withRateLimit(apiCall, {
  requests: 100,
  window: '1m',
});

// Response caching
const cached = withCache(apiCall, {
  ttl: '1h',
  key: (params) => `${params.type}:${params.id}`,
});
```

### Installation

```bash
bun add @estonia-ai-kit/shared
```

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
