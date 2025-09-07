# 🇪🇪Riigi Teataja RAG

Part of the [Estonia AI Kit](https://github.com/stefanoamorelli/estonia-ai-kit) a collection of open-source AI tools for Estonian data.

This package uses a FAISS-based vector database populated with the Estonian Constitution and, optionally, additional legislation. When a query is submitted, it retrieves the most relevant provisions and supplies them to ChatGPT (or any other LLM) as contextual material. This approach yields more accurate responses with precise §-level citations and reduces the risk of hallucinated or unsupported statements.

## What it Does

- Gets real laws from riigiteataja.ee (currently has the Constitution with 168 sections)
- Chunks them by legal section (§) to get precise citations
- Creates OpenAI embeddings
- Saves embeddings in FAISS vector DB
- Includes a comparison demo

## Setup & Build Process

### First Time Setup

The repository doesn't include the law data or FAISS index - you build them locally. This keeps the repo small and ensures you get fresh data from riigiteataja.ee.

**Requirements:**

- Node.js 18+ (or Bun)
- OpenAI API key (for embeddings, costs ~$0.003)

**Automatic setup:**

```bash
# Set your OpenAI API key
export OPENAI_API_KEY="sk-..."

# Run the setup script
./setup.sh
```

This script will:

1. **Install dependencies** via `bun`/`pnpm`/`npm`
2. **Download Estonian Constitution** from riigiteataja.ee (168 sections)
3. **Build FAISS index** with OpenAI embeddings (~$0.003)

### Manual Setup (if you prefer)

```bash
# 1. Install dependencies
bun install  # or: pnpm install, npm install

# 2. Download the Constitution from riigiteataja.ee
bun src/scripts/scrape.ts
# Creates: data/constitution.json

# 3. Build the FAISS vector index
bun src/scripts/build-index.ts
# Creates: faiss-index/vectors.faiss
#          faiss-index/metadata.json
```

### What Gets Built

After setup, you'll have:

- `data/constitution.json` - Estonian Constitution with 168 legal sections
- `faiss-index/vectors.faiss` - FAISS index with embedded vectors
- `faiss-index/metadata.json` - Metadata for search results

These folders are gitignored because:

- They're generated from source data
- Keeps the repo lightweight
- Ensures you always have fresh data
- Avoids committing binary FAISS files

## ChatGPT vs ChatGPT + RAG

Run the comparison demo to see ChatGPT give wrong answers, then watch the RAG version cite actual law sections:

```bash
bun src/scripts/compare.ts "your legal question"
```

### Real Examples

#### Estonian Citizenship

```bash
bun src/scripts/compare.ts "What are the requirements for Estonian citizenship?"
```

**ChatGPT alone:** Makes up requirements about 8 years residency, language tests, loyalty oaths... sounds plausible but who knows if it's true?

**ChatGPT + RAG:** "According to § 8 of the Estonian Constitution, every child with a parent who is an Estonian citizen has the right to Estonian citizenship by birth..." - actual constitutional text!

#### Estonian Flag

```bash
bun src/scripts/compare.ts "What are the colors of the Estonian flag?"
```

**ChatGPT alone:** Probably gets this right, but might mess up the order or add creative details.

**ChatGPT + RAG:** Cites § 7: "The national colours of Estonia are blue, black and white."

#### Freedom of Speech

```bash
bun src/scripts/compare.ts "What is the status of freedom of speech in Estonia?"
```

**ChatGPT + RAG:** Quotes § 45 verbatim, including the "no censorship" part and the specific exceptions.

## Other Stuff You Can Do

```bash
# Direct search without the ChatGPT comparison
bun src/scripts/search.ts "presidential powers"

# Download more laws (currently set up for 10 major laws)
bun src/scripts/scrape.ts

# Rebuild the index after adding new laws
bun src/scripts/build-index.ts
```

## How it Works

1. Puppeteer fetches from riigiteataja.ee;
2. Chunker splits by § sections (preserves legal structure);
3. OpenAI embeds each chunk (1536 dimensions);
4. FAISS indexes everything;
5. When you query, it finds similar sections and feeds them to ChatGPT;
6. LLM enriched with RAG includes citations and references to real law sections.

## Files

- `data/` - Downloaded laws (currently just the Constitution)
- `faiss-index/` - The vector database
- `src/scripts/compare.ts` - The main demo
- `src/scripts/scrape.ts` - Downloads more laws from riigiteataja.ee
- `src/scripts/search.ts` - Direct search without ChatGPT
- `src/scripts/build-index.ts` - Rebuild the index

## License

AGPL-3.0

## Contributing

PRs welcome. Potential improvements include downloading additional laws, smarter chunking strategies, and expanding coverage to more Estonian legislation.

## Disclaimer

This tool is for informational purposes only and does not constitute legal advice or create an attorney–client relationship. If you are involved in a legal matter or plan to appear in court, you should retain a licensed attorney. The tool’s sole purpose is to reduce the likelihood of inaccuracies in LLM's output.
