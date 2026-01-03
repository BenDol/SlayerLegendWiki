#!/usr/bin/env node

/**
 * Stream Dev Server Logs
 *
 * Continuously reads and displays the dev server output in real-time.
 * Run this in a separate terminal while npm run dev is running.
 */

import { readFileSync, existsSync, watchFile } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Find the most recent task output file
const taskDir = join(homedir(), 'AppData', 'Local', 'Temp', 'claude', 'C--Projects-slayerlegend-wiki', 'tasks');

function findLatestTaskOutput() {
  try {
    const fs = await import('fs');
    const files = fs.readdirSync(taskDir)
      .filter(f => f.endsWith('.output'))
      .map(f => ({
        name: f,
        path: join(taskDir, f),
        mtime: fs.statSync(join(taskDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) {
      console.error('No task output files found. Is npm run dev running?');
      process.exit(1);
    }

    return files[0].path;
  } catch (error) {
    console.error('Error finding task output:', error.message);
    process.exit(1);
  }
}

async function main() {
  const logFile = findLatestTaskOutput();
  console.log('📡 Streaming logs from:', logFile);
  console.log('─'.repeat(80));
  console.log('');

  let lastSize = 0;
  let isFirstRead = true;

  // Read initial content
  if (existsSync(logFile)) {
    const content = readFileSync(logFile, 'utf8');
    console.log(content);
    lastSize = content.length;
    isFirstRead = false;
  }

  // Watch for changes
  watchFile(logFile, { interval: 500 }, () => {
    try {
      const content = readFileSync(logFile, 'utf8');

      if (content.length > lastSize) {
        const newContent = content.slice(lastSize);
        process.stdout.write(newContent);
        lastSize = content.length;
      }
    } catch (error) {
      // File might be temporarily unavailable
    }
  });

  console.log('');
  console.log('─'.repeat(80));
  console.log('👀 Watching for new log entries... (Press Ctrl+C to stop)');
}

main().catch(console.error);
