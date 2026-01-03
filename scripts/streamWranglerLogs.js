/**
 * Wrangler Log Streaming Script
 * Captures Wrangler dev server output and writes to a log file for easy tailing
 */

import { spawn } from 'child_process';
import { createWriteStream, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logDir = join(__dirname, '..', '.wrangler');
const logFile = join(logDir, 'server.log');

console.log('[Log Streamer] Starting Wrangler with log streaming...');
console.log('[Log Streamer] Logs will be written to:', logFile);
console.log('[Log Streamer] Tail logs with: tail -f .wrangler/server.log');
console.log('');

// Ensure .wrangler directory exists
mkdirSync(logDir, { recursive: true });

// Create log file stream
const logStream = createWriteStream(logFile, { flags: 'a' });

// Start Wrangler Pages dev server
const wrangler = spawn('npx', ['wrangler', 'pages', 'dev', 'public', '--port', '8788'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true
});

// Pipe stdout to both console and log file
wrangler.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);
  logStream.write(output);
});

// Pipe stderr to both console and log file
wrangler.stderr.on('data', (data) => {
  const output = data.toString();
  process.stderr.write(output);
  logStream.write(output);
});

wrangler.on('close', (code) => {
  console.log(`\n[Log Streamer] Wrangler process exited with code ${code}`);
  logStream.end();
  process.exit(code);
});

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n[Log Streamer] Shutting down...');
  wrangler.kill('SIGINT');
});

process.on('SIGTERM', () => {
  wrangler.kill('SIGTERM');
});
