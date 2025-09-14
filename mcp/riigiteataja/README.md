# Estonian State Gazette (Riigiteataja) MCP Server

Connect AI assistants to Estonia's State Gazette (Riigiteataja) for accessing legal acts, translations, and comprehensive FAQ information.

> [!NOTE]
> Part of the [Estonia AI Kit](https://github.com/stefanoamorelli/estonia-ai-kit) monorepo - The Digital Nation's AI Toolkit

> [!IMPORTANT]
> This server provides access to Riigiteataja's FAQ system and link generation utilities, with limited document fetching capabilities through the available API.

## 🚀 Quick Start

### Step 1: Install Dependencies

```bash
bun install
bun run build
```

### Step 2: Configure Claude Desktop

Add to `~/.config/Claude/claude_desktop_config.json` (Linux) or `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac):

```json
{
  "mcpServers": {
    "estonia-riigiteataja": {
      "command": "node",
      "args": ["/path/to/estonia-ai-kit/mcp/riigiteataja/dist/index.js"]
    }
  }
}
```

## 🎯 What You Can Ask

### 📚 FAQ Access
- "Get all FAQ items from Riigiteataja"
- "Search FAQ for publication marks"
- "What are the FAQ items about translations?"
- "How do I create dynamic links to legal acts?"

### 🔗 Link Generation
- "Create a dynamic link for act 123456789"
- "Generate a paragraph link to section 12 of act 123456789"
- "Create an English translation link for act 123456789"
- "Generate a search URL for tax laws"

### 📖 Legal Documents
- "Fetch legal document with global ID 123456"
- "Search for laws about maksud (taxes)"
- "Get both Estonian and English versions of document 123456"
- "What are the common legal act types in Estonia?"

### 🔍 Utilities
- "Extract the act ID from this URL: https://www.riigiteataja.ee/akt/123456789"
- "What legal act types are available?"
- "Clear the FAQ cache"

## ✨ Features

### What Works Great
✅ **FAQ System** - Complete access to Riigiteataja FAQ items  
✅ **Smart Search** - Search FAQs by keyword or category  
✅ **Link Generation** - Create dynamic, paragraph, and translation links  
✅ **Document Fetching** - Access legal documents via API (when available)  
✅ **Bilingual Support** - Fetch both Estonian and English versions  
✅ **Search URLs** - Generate complex search queries  
✅ **Caching** - Built-in caching for improved performance  

### Current Limitations
⚠️ **No Full Content API** - Complete document text requires website access  
⚠️ **Limited Metadata** - Basic information only for some documents  
⚠️ **Web Scraping** - FAQ fetching relies on HTML parsing  
⚠️ **Translation Status** - Not all documents have translations  

## 🛠️ Available Tools

### FAQ Tools
- `get_all_faq` - Retrieve all FAQ items
- `search_faq` - Search FAQs by keyword
- `get_faq_by_category` - Filter by category
- `get_faq_by_id` - Get specific FAQ

### Link Generation Tools
- `create_dynamic_link` - Always-current version links
- `create_paragraph_link` - Link to specific paragraphs
- `create_translation_link` - English translation links
- `generate_search_url` - Complex search URLs

### Document Tools
- `fetch_legal_document` - Get document by global ID
- `search_legal_documents` - Search with filters
- `fetch_bilingual_document` - Get both language versions
- `get_legal_act_types` - List act types
- `extract_act_id` - Parse URLs

### Utility Tools
- `clear_cache` - Clear cached data

## 📦 Installation

### From npm (when published)
```bash
bun install -g @estonia-ai-kit/riigiteataja-mcp-server
```

### From source
```bash
git clone https://github.com/stefanoamorelli/estonia-ai-kit
cd estonia-ai-kit/mcp/riigiteataja
bun install
bun run build
```

## 🔧 Development

```bash
# Install dependencies
bun install

# Build the server
bun run build

# Run tests
bun test

# Development mode
bun run dev
```

## 📚 Documentation

For more information about:
- **Estonia AI Kit**: See the [main repository](https://github.com/stefanoamorelli/estonia-ai-kit)
- **MCP Protocol**: Visit [Model Context Protocol](https://github.com/anthropics/mcp)
- **Riigiteataja**: Visit [riigiteataja.ee](https://www.riigiteataja.ee)
- **API Documentation**: See [Riigiteataja FAQ](https://www.riigiteataja.ee/kkk.html)

## 📝 License

AGPL-3.0 - See [LICENSE](LICENSE) for details

## 👥 Authors

See [AUTHORS](AUTHORS) file for contributors

## 🔒 Security

For security concerns, see [SECURITY.md](SECURITY.md)

## 📖 Citation

If you use this in research, please cite:
```bibtex
See CITATION.cff for citation format
```

---

Made with ❤️ for Estonia's Digital Nation 🇪🇪