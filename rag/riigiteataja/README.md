# 🇪🇪 Riigi Teataja RAG

Part of the [Estonia AI Kit](https://github.com/estonia-ai-kit) - a collection of open-source AI tools for Estonian data.

> **Author**: Stefano Amorelli <stefano@amorelli.tech>  
> **License**: AGPL-3.0

Ever noticed how ChatGPT gives you generic legal advice that might be completely wrong for Estonia? This tool fixes that by feeding ChatGPT actual Estonian laws from riigiteataja.ee. 

It's basically a FAISS vector database stuffed with the Estonian Constitution (and other laws if you want to scrape more). When you ask a question, it finds the relevant legal sections and gives them to ChatGPT as context. The result? Accurate answers with proper § citations instead of hallucinated nonsense.

## What it Does

- Gets real laws from riigiteataja.ee (currently has the Constitution with 168 sections)
- Chunks them by legal section (§) so you get precise citations, not "somewhere in paragraph 47"
- Uses OpenAI embeddings because they actually understand legal text (costs literal pennies)
- FAISS for the vector search because it's fast and doesn't need a separate database server
- Includes a comparison demo so you can see ChatGPT embarrass itself before the RAG saves it

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
1. **Install dependencies** via bun/pnpm/npm
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

## The Fun Part: Watch ChatGPT Fail Then Succeed

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

### Try These Questions

The Constitution covers a lot:
- "Who can become president of Estonia?"
- "What is the role of Riigikogu?"
- "How long can someone be held in custody without court permission?" (spoiler: 48 hours)
- "What languages can be used in Estonian government?"
- "Can dual citizenship be held in Estonia?"
- "What are the property rights in Estonia?"
- "How are constitutional amendments made?"

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

1. Puppeteer fetches from riigiteataja.ee (handles their JavaScript rendering)
2. Chunker splits by § sections (preserves legal structure)
3. OpenAI embeds each chunk (1536 dimensions of legal goodness)
4. FAISS indexes everything (Facebook's gift to vector search)
5. When you query, it finds similar sections and feeds them to ChatGPT
6. ChatGPT suddenly becomes a legal expert (with citations!)

## Files

- `data/` - Downloaded laws (currently just the Constitution)
- `faiss-index/` - The vector database
- `src/scripts/compare.ts` - The main demo
- `src/scripts/scrape.ts` - Downloads more laws from riigiteataja.ee
- `src/scripts/search.ts` - Direct search without ChatGPT
- `src/scripts/build-index.ts` - Rebuild the index

## Cost

OpenAI charges peanuts for embeddings:
- Constitution (168 sections): ~$0.003
- 10 full laws: ~$0.02
- Every law in Estonia: probably less than a coffee

## Privacy

Yes, your queries go to OpenAI. If you're paranoid about Sam Altman knowing you're interested in Estonian constitutional law, you could use local embeddings (but they're worse at understanding legal text).

## License

AGPL-3.0 - It's open source, do whatever (within reason).

## Contributing

PRs welcome. Potential improvements include downloading additional laws, smarter chunking strategies, and expanding coverage to more Estonian legislation.

## Disclaimer

This is not legal advice. If you're going to court, hire a real lawyer. This is just a tool that makes ChatGPT slightly less likely to make stuff up about Estonian law.