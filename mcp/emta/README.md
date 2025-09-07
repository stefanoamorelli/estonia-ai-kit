# @estonia-ai-kit/emta-mcp-server

## Estonian Tax & Customs Board MCP Server

Secure X-Road integration with Estonia's Tax and Customs Board (EMTA) for VAT verification, tax debt checks, and customs data.

> [!NOTE]
> Part of the [Estonia AI Kit](https://github.com/stefanoamorelli/estonia-ai-kit) monorepo - The Digital Nation's AI Toolkit

> [!IMPORTANT]
> This package is a **proof of concept** demonstrating potential EMTA integration. Currently uses mock data to showcase the MCP server structure and capabilities.
>
> **What's needed for real functionality:**
>
> - Valid X-Road member registration
> - PKI certificates from SK ID Solutions
> - Subsystem agreement with EMTA
> - X-Road authentication implementation
>
> All current responses are simulated and include a note: "X-Road service requires authentication. This is simulated data."
>
> **This is a development POC - not ready for production use.**

### X-Road Architecture

| Component         | Protocol       | Security              | Latency   |
| ----------------- | -------------- | --------------------- | --------- |
| X-Road Gateway    | SOAP/HTTPS     | mTLS + TSL            | < 100ms   |
| Message Transport | REST/SOAP      | End-to-end encryption | < 50ms    |
| Service Discovery | WSDL           | PKI certificates      | Cached    |
| Audit Trail       | Immutable logs | Cryptographic proof   | Real-time |

### Quick Start

```bash
# Install
bun add @estonia-ai-kit/emta-mcp-server

# Configure X-Road certificates
export XROAD_MEMBER_CLASS="COM"
export XROAD_MEMBER_CODE="12345678"
export XROAD_SUBSYSTEM="AIKIT"

# Add to Claude Desktop config
{
  "mcpServers": {
    "estonia-emta": {
      "command": "bunx",
      "args": ["@estonia-ai-kit/emta-mcp-server"],
      "env": {
        "XROAD_MEMBER_CLASS": "COM",
        "XROAD_MEMBER_CODE": "12345678"
      }
    }
  }
}
```

### Available Services

```typescript
interface EMTAServices {
  // VAT Operations
  verifyVAT(vatNumber: string): VATStatus;
  getVATRates(): VATRateTable;
  checkVATGroup(groupId: string): VATGroupInfo;

  // Tax Debt
  checkTaxDebt(registryCode: string): TaxDebtStatus;
  getTaxDebtDetails(registryCode: string): DetailedDebt[];

  // Customs
  getCustomsTariff(commodityCode: string): TariffInfo;
  checkEORIStatus(eoriNumber: string): EORIValidation;

  // Declarations
  getDeclarationStatus(declarationId: string): DeclarationInfo;
}
```

### X-Road Request Flow

```mermaid
Client -> MCP_Server: Request
MCP_Server -> Security_Server: SOAP + mTLS
Security_Server -> X_Road: Encrypted message
X_Road -> EMTA_Service: Routed request
EMTA_Service --> Client: Response (< 500ms)
```

### Performance & Limits

- **Throughput**: 100 req/min per subsystem
- **Response time**: < 500ms (p99)
- **Message size**: Max 10MB
- **Certificate validity**: Check quarterly
- **Audit retention**: 7 years

### Security Requirements

- Valid X-Road member registration
- PKI certificates from SK ID Solutions
- Subsystem agreement with EMTA
- Compliance with Estonian Data Protection Act

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
