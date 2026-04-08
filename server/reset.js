/**
 * Password reset utility — run directly on the server only.
 *
 *   node reset.js
 *
 * Prompts for a new admin password, hashes it with bcrypt, and writes
 * the hash to data/.credentials (same file the main server reads on start).
 * The running server will pick up the new password on the very next login
 * attempt because it re-reads the hash from `runtimeAdminPassword` which is
 * refreshed in-memory — or just restart the server to be safe.
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import config from './src/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const credentialsFilePath = path.join(__dirname, config.dataPath, '.credentials');

// ── Helpers ────────────────────────────────────────────────────

// Shared readline for non-TTY (piped) input
const rlNonTTY = !process.stdin.isTTY
  ? readline.createInterface({ input: process.stdin, output: process.stdout })
  : null;

/** Prompt the user and return the typed string (input hidden when TTY). */
function promptPassword(label) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      rlNonTTY.question(label, (answer) => resolve(answer));
      return;
    }

    process.stdout.write(label);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    let password = '';

    const onData = (char) => {
      if (char === '\r' || char === '\n' || char === '\u0004') {
        // Enter or EOF
        cleanup();
        process.stdout.write('\n');
        resolve(password);
      } else if (char === '\u0003') {
        // Ctrl-C
        cleanup();
        process.stdout.write('\n');
        reject(new Error('Cancelled'));
      } else if (char === '\u007f' || char === '\b') {
        // Backspace
        password = password.slice(0, -1);
      } else {
        password += char;
      }
    };

    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
    };

    process.stdin.on('data', onData);
  });
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  console.log('=== Admin password reset ===\n');

  const password = await promptPassword('New password: ');
  if (!password || password.trim().length === 0) {
    console.error('Error: password must not be empty.');
    process.exit(1);
  }

  const confirm = await promptPassword('Confirm password: ');
  if (password !== confirm) {
    console.error('Error: passwords do not match.');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Error: password must be at least 8 characters.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);

  await fs.mkdir(path.dirname(credentialsFilePath), { recursive: true });
  await fs.writeFile(credentialsFilePath, hash + '\n', { mode: 0o600 });

  console.log(`\nPassword updated successfully.`);
  console.log(`Credentials written to: ${credentialsFilePath}`);
  console.log('Restart the server (or it will use the new password on next login).\n');
}

main().catch((err) => {
  if (err.message === 'Cancelled') process.exit(1);
  console.error('Fatal:', err.message);
  process.exit(1);
});
