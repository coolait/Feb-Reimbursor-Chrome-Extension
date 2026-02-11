/**
 * Combine two Google Drive files (PDF, PNG, or JPEG) into one PDF.
 * Same purpose as combine_drive_files.py, in Node.js.
 *
 * Usage:
 *   node combine_drive_files.js
 *   (prompts for link1, link2, output filename)
 *
 *   node combine_drive_files.js <link1> <link2> [output.pdf]
 *
 * Requires Node 18+ (for fetch). Encrypted PDFs will fail (pdf-lib cannot decrypt).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import { PDFDocument } from 'pdf-lib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Link parsing ---

function extractFileId(shareableLink) {
  const link = (shareableLink || '').trim();
  if (link.includes('/file/d/')) {
    return link.split('/file/d/')[1].split('/')[0];
  }
  if (link.includes('id=')) {
    return link.split('id=')[1].split('&')[0];
  }
  throw new Error('Invalid Google Drive link format');
}

// --- Download from Google Drive (same strategies as Python script) ---

const DRIVE_URLS = (fileId) => [
  `https://drive.google.com/uc?export=download&id=${fileId}`,
  `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`,
  `https://drive.google.com/uc?id=${fileId}&export=download`,
];

function isHtml(buffer) {
  if (!buffer || buffer.length < 8) return false;
  const start = buffer.slice(0, 256).toString('utf8').toLowerCase();
  return start.includes('<!doctype') || start.includes('<html');
}

function isSignInPage(html) {
  return /sign\s*in|signin/i.test(html);
}

function parseDownloadLinkFromHtml(html) {
  const m = html.match(/href="(\/uc\?export=download[^"]+)"/);
  if (m) return 'https://drive.google.com' + m[1];
  const m2 = html.match(/id="uc-download-link"[^>]*href="([^"]+)"/);
  if (m2) return 'https://drive.google.com' + m2[1];
  return null;
}

async function downloadFromGoogleDrive(fileId) {
  let lastError = null;
  for (const url of DRIVE_URLS(fileId)) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) continue;
      const contentType = (res.headers.get('Content-Type') || '').toLowerCase();
      if (contentType.includes('text/html')) {
        const html = await res.text();
        if (isSignInPage(html)) {
          throw new Error(
            'File requires authentication. Make the file publicly accessible: Share → Anyone with the link can view.'
          );
        }
        const downloadUrl = parseDownloadLinkFromHtml(html);
        if (downloadUrl) {
          const res2 = await fetch(downloadUrl, { redirect: 'follow' });
          if (res2.ok) {
            const buf = Buffer.from(await res2.arrayBuffer());
            if (!isHtml(buf)) return buf;
          }
        }
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) continue;
      if (isHtml(buf)) continue;
      return buf;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error(`Download failed for ${fileId}. Make the file publicly accessible (Anyone with the link).`);
}

// --- Magic byte detection (same as Python) ---

function sniffFileKind(buffer) {
  if (!buffer || buffer.length < 4) return 'unknown';
  // PDF: %PDF-
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46 && buffer[4] === 0x2d) return 'pdf';
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
      buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a) return 'png';
  return 'unknown';
}

// --- Image to single-page PDF (pdf-lib) ---

async function imageToPdfBytes(imageBuffer, kind) {
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  const { width, height } = page.getSize();
  if (kind === 'png') {
    const img = await doc.embedPng(imageBuffer);
    const scale = Math.min(width / img.width, height / img.height);
    page.drawImage(img, { x: 0, y: 0, width: img.width * scale, height: img.height * scale });
  } else {
    const img = await doc.embedJpg(imageBuffer);
    const scale = Math.min(width / img.width, height / img.height);
    page.drawImage(img, { x: 0, y: 0, width: img.width * scale, height: img.height * scale });
  }
  return await doc.save();
}

// --- Combine PDFs (merge in order; encrypted PDFs will throw) ---

async function combinePdfs(pdfBuffers) {
  const mergedDoc = await PDFDocument.create();
  for (let i = 0; i < pdfBuffers.length; i++) {
    const buf = pdfBuffers[i];
    const srcDoc = await PDFDocument.load(buf);
    const pageCount = srcDoc.getPageCount();
    if (pageCount === 0) throw new Error(`File ${i + 1} has no pages.`);
    const copied = await mergedDoc.copyPages(srcDoc, [...Array(pageCount)].map((_, j) => j));
    copied.forEach((p) => mergedDoc.addPage(p));
  }
  return await mergedDoc.save();
}

// --- Process one Drive link: download → detect type → convert image to PDF if needed → return PDF bytes ---

async function processFile(link, _tempDir) {
  const fileId = extractFileId(link);
  const buffer = await downloadFromGoogleDrive(fileId);
  const kind = sniffFileKind(buffer);
  if (kind === 'pdf') {
    console.log('  File is a PDF');
    return buffer;
  }
  if (kind === 'png') {
    console.log('  File is a PNG, converting to PDF...');
    return await imageToPdfBytes(buffer, 'png');
  }
  if (kind === 'jpg') {
    console.log('  File is a JPEG, converting to PDF...');
    return await imageToPdfBytes(buffer, 'jpg');
  }
  if (buffer.length >= 100 && isHtml(buffer)) {
    throw new Error('Google Drive returned an HTML page. File may be too large or require permission. Make the file publicly accessible.');
  }
  throw new Error(`Unsupported file type. First bytes: ${buffer.slice(0, 8).toString('hex')}`);
}

/** Combine two Drive links (PDF/PNG/JPEG) into one PDF. Returns merged PDF as Uint8Array. */
export async function combineTwoLinks(link1, link2) {
  const pdf1 = await processFile(link1, '');
  const pdf2 = await processFile(link2, '');
  return await combinePdfs([pdf1, pdf2]);
}

// --- Main ---

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function question(readline, prompt) {
  return new Promise((resolve) => readline.question(prompt, resolve));
}

async function mainInteractive() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const link1 = (await question(rl, 'Enter the first Google Drive link (PDF, PNG, or JPEG): ')).trim();
  const link2 = (await question(rl, '\nEnter the second Google Drive link (PDF, PNG, or JPEG): ')).trim();
  let outputName = (await question(rl, '\nEnter output PDF filename (default: combined_output.pdf): ')).trim();
  rl.close();
  if (!outputName) outputName = 'combined_output.pdf';
  if (!outputName.endsWith('.pdf')) outputName += '.pdf';
  return { link1, link2, outputName };
}

async function main() {
  const projectDir = __dirname;
  const tempDir = path.join(projectDir, 'temp');
  const outputsDir = path.join(projectDir, 'outputs');
  ensureDir(tempDir);
  ensureDir(outputsDir);

  let link1, link2, outputName;
  if (process.argv.length >= 4) {
    link1 = process.argv[2];
    link2 = process.argv[3];
    outputName = process.argv[4] || 'combined_output.pdf';
    if (!outputName.endsWith('.pdf')) outputName += '.pdf';
  } else {
    console.log('Google Drive File Combiner (Node.js)\n');
    const answers = await mainInteractive();
    link1 = answers.link1;
    link2 = answers.link2;
    outputName = answers.outputName;
  }

  const outputPath = path.join(outputsDir, outputName);

  console.log('\nProcessing first file...');
  const pdf1 = await processFile(link1, tempDir);
  console.log('\nProcessing second file...');
  const pdf2 = await processFile(link2, tempDir);
  console.log('\nCombining PDFs...');
  const merged = await combinePdfs([pdf1, pdf2]);
  fs.writeFileSync(outputPath, merged);
  console.log(`\nSUCCESS! Combined PDF saved as: ${outputPath}`);
}

const isRunDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__dirname, 'combine_drive_files.js');
if (isRunDirectly) {
  main().catch((e) => {
    console.error('\nERROR:', e.message);
    process.exit(1);
  });
}
