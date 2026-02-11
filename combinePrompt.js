/**
 * Simple interface: prompts for two Google Drive links, combines them into one PDF, saves to outputs/.
 * Uses public "Anyone with the link" sharing — no OAuth needed.
 *
 * Run: node combinePrompt.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import { combineTwoLinks } from './combine_drive_files.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputsDir = path.join(__dirname, 'outputs');

function ask(rl, prompt) {
  return new Promise((resolve) => rl.question(prompt, (answer) => resolve(answer.trim())));
}

async function main() {
  console.log('\n  Google Drive PDF Combiner\n  — Paste two shareable links (PDF, PNG, or JPEG) and get one combined PDF.\n');

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const link1 = await ask(rl, '  First Drive link: ');
  if (!link1) {
    console.log('  No link entered. Exiting.');
    rl.close();
    process.exit(1);
  }

  const link2 = await ask(rl, '  Second Drive link: ');
  if (!link2) {
    console.log('  No link entered. Exiting.');
    rl.close();
    process.exit(1);
  }

  let outputName = await ask(rl, '  Output filename (default: combined_output.pdf): ');
  rl.close();

  if (!outputName) outputName = 'combined_output.pdf';
  if (!outputName.endsWith('.pdf')) outputName += '.pdf';

  if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });
  const outputPath = path.join(outputsDir, outputName);

  console.log('\n  Downloading and combining...\n');
  try {
    const pdf = await combineTwoLinks(link1, link2);
    fs.writeFileSync(outputPath, pdf);
    console.log('  Done. Saved to:', outputPath, '\n');
  } catch (err) {
    console.error('  Error:', err.message);
    process.exit(1);
  }
}

main();
