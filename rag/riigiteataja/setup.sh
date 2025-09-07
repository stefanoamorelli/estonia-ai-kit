#!/usr/bin/env bash

echo "🇪🇪 Estonia AI Kit - Riigi Teataja RAG Setup"
echo "============================================"
echo ""

# Check for OpenAI API key
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OPENAI_API_KEY not set!"
    echo ""
    echo "Please set your OpenAI API key:"
    echo "  export OPENAI_API_KEY=\"sk-...\""
    echo ""
    exit 1
fi

echo "✅ OpenAI API key detected"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
if command -v bun &> /dev/null; then
    bun install
elif command -v pnpm &> /dev/null; then
    pnpm install
else
    npm install
fi

echo ""
echo "🌐 Downloading Estonian Constitution from riigiteataja.ee..."
echo "This will take a minute..."
bun src/scripts/scrape.ts

echo ""
echo "🔨 Building FAISS index..."
echo "This will generate embeddings (costs ~$0.003)..."
bun src/scripts/build-index.ts

echo ""
echo "✅ Setup complete!"
echo ""
echo "Try it out:"
echo "  bun src/scripts/compare.ts \"What are the requirements for Estonian citizenship?\""
echo ""