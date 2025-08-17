#!/usr/bin/env node
import { RIKMCPServer } from './server.js';

const server = new RIKMCPServer();
server.run().catch((error) => {
  console.error('Failed to start RIK MCP Server:', error);
  process.exit(1);
});