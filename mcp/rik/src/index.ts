#!/usr/bin/env node
import { RIKMCPServer } from './server.js';

async function main() {
  const server = new RIKMCPServer();
  const success = await server.run();
  if (!success) {
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    // console.error('Failed to start RIK MCP Server:', error);
    process.exit(1);
  });
}

export { main };
