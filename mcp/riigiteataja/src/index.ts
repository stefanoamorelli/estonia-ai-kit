#!/usr/bin/env node
import { RiigiteatajaMCPServer } from './server.js';

async function main() {
  const server = new RiigiteatajaMCPServer();
  const success = await server.run();
  if (!success) {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((_error) => {
    process.exit(1);
  });
}

export { main };
export { RiigiteatajaMCPServer } from './server.js';
