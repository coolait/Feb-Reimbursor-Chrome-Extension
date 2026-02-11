/**
 * drivePdfCombiner.js
 * Combine two Google Drive files (PDF, PNG, or JPEG) into one PDF using the Drive API.
 * Pure ES module, in-memory only, no temp files or Chrome APIs.
 */

import { PDFDocument } from 'pdf-lib';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3/files';

/**
 * Extract Google Drive file ID from shareable link.
 * @param {string} link - Shareable link (e.g. /file/d/ID/view, open?id=ID, uc?id=ID)
 * @returns {string} File ID
 * @throws {Error} Invalid link format
 */
export function extractFileId(link) {
  const s = (link || '').trim();
  if (!s) throw new Error('Invalid link: empty');
  // https://drive.google.com/file/d/FILE_ID/view
  const fileDMatch = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch) return fileDMatch[1];
  // https://drive.google.com/open?id=FILE_ID or uc?id=FILE_ID
  const idMatch = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];
  throw new Error(`Invalid link: could not extract file ID from "${link}"`);
}

/**
 * Download a file from Google Drive using the API (Bearer token).
 * @param {string} fileId - Drive file ID
 * @param {string} accessToken - OAuth2 access token
 * @returns {Promise<ArrayBuffer>}
 * @throws {Error} Download failure
 */
export async function downloadDriveFile(fileId, accessToken) {
  if (!accessToken?.trim()) throw new Error('Download failure: missing access token');
  const url = `${DRIVE_API_BASE}/${encodeURIComponent(fileId)}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Download failure for ${fileId}: ${res.status} ${res.statusText}${text ? ` - ${text.slice(0, 200)}` : ''}`);
  }
  return await res.arrayBuffer();
}

/**
 * Detect file type from magic bytes.
 * @param {ArrayBuffer} arrayBuffer
 * @returns {'pdf'|'png'|'jpeg'|null}
 */
export function detectFileType(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength < 8) return null;
  const u8 = new Uint8Array(arrayBuffer);
  // PDF: %PDF (25 50 44 46)
  if (u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46) return 'pdf';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47 &&
      u8[4] === 0x0d && u8[5] === 0x0a && u8[6] === 0x1a && u8[7] === 0x0a) return 'png';
  // JPEG: FF D8 FF
  if (u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return 'jpeg';
  return null;
}

/**
 * Convert an image (PNG or JPEG) to a single-page PDF.
 * @param {ArrayBuffer} arrayBuffer - Image bytes
 * @param {'png'|'jpeg'} type
 * @returns {Promise<Uint8Array>} PDF bytes
 */
export async function convertImageToPdf(arrayBuffer, type) {
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  const { width, height } = page.getSize();
  const bytes = new Uint8Array(arrayBuffer);
  let img;
  if (type === 'png') {
    img = await doc.embedPng(bytes);
  } else if (type === 'jpeg') {
    img = await doc.embedJpg(bytes);
  } else {
    throw new Error(`Unsupported image type for conversion: ${type}`);
  }
  const scale = Math.min(width / img.width, height / img.height);
  page.drawImage(img, {
    x: 0,
    y: 0,
    width: img.width * scale,
    height: img.height * scale,
  });
  return await doc.save();
}

/**
 * Merge multiple PDF buffers into one.
 * @param {Uint8Array[]} buffers - PDF bytes
 * @returns {Promise<Uint8Array>}
 * @throws {Error} Failed PDF parsing (e.g. encrypted)
 */
export async function mergePdfBuffers(buffers) {
  if (!buffers?.length) throw new Error('No PDF buffers to merge');
  const mergedDoc = await PDFDocument.create();
  for (let i = 0; i < buffers.length; i++) {
    let srcDoc;
    try {
      srcDoc = await PDFDocument.load(buffers[i]);
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      throw new Error(`Failed PDF parsing (file ${i + 1}): ${msg}`);
    }
    const pageCount = srcDoc.getPageCount();
    if (pageCount === 0) throw new Error(`File ${i + 1} has no pages`);
    const copied = await mergedDoc.copyPages(srcDoc, [...Array(pageCount)].map((_, j) => j));
    copied.forEach((p) => mergedDoc.addPage(p));
  }
  return await mergedDoc.save();
}

/**
 * Combine two Google Drive files into a single PDF.
 * @param {string} link1 - First shareable Drive link
 * @param {string} link2 - Second shareable Drive link
 * @param {string} accessToken - OAuth2 access token for Drive API
 * @returns {Promise<Uint8Array>} Merged PDF bytes
 */
export async function combineDriveLinks(link1, link2, accessToken) {
  const id1 = extractFileId(link1);
  const id2 = extractFileId(link2);

  const [buf1, buf2] = await Promise.all([
    downloadDriveFile(id1, accessToken),
    downloadDriveFile(id2, accessToken),
  ]);

  const type1 = detectFileType(buf1);
  const type2 = detectFileType(buf2);
  if (!type1) throw new Error(`Unsupported file type for first file (magic bytes not PDF/PNG/JPEG)`);
  if (!type2) throw new Error(`Unsupported file type for second file (magic bytes not PDF/PNG/JPEG)`);

  const toPdfBytes = async (arrayBuffer, type) => {
    if (type === 'pdf') return new Uint8Array(arrayBuffer);
    return await convertImageToPdf(arrayBuffer, type);
  };

  const pdf1 = await toPdfBytes(buf1, type1);
  const pdf2 = await toPdfBytes(buf2, type2);

  return await mergePdfBuffers([pdf1, pdf2]);
}

// ---------------------------------------------------------------------------
// Usage example (commented out):
// ---------------------------------------------------------------------------
//
// import { combineDriveLinks } from './drivePdfCombiner.js';
//
// const link1 = 'https://drive.google.com/file/d/FILE_ID_1/view';
// const link2 = 'https://drive.google.com/open?id=FILE_ID_2';
// const accessToken = 'ya29.xxx'; // from your OAuth2 flow
//
// const merged = await combineDriveLinks(link1, link2, accessToken);
// // e.g. save: fs.writeFileSync('combined.pdf', merged);
//
