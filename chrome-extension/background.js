// Background service worker for file operations
// Load pdf-lib from extension package (required for Manifest V3 - no remote scripts)
importScripts('lib/pdf-lib.min.js');

const { PDFDocument } = self.PDFLib;

// Set to your deployed combiner server URL (e.g. https://your-app.onrender.com) to support encrypted PDFs.
// Leave empty to use in-browser combining only.
const COMBINER_SERVER_URL = 'https://feb-reimbursor-chrome-extension.onrender.com';

// Download from Google Drive — mirrors combine_drive_files.py (direct URL, then confirm=t for virus scan).
async function downloadFromGoogleDrive(fileId) {
    const urlsToTry = [
        `https://drive.google.com/uc?export=download&id=${fileId}`,
        `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`,
        `https://drive.google.com/uc?id=${fileId}&export=download`
    ];

    for (let i = 0; i < urlsToTry.length; i++) {
        try {
            const response = await fetch(urlsToTry[i], { redirect: 'follow' });
            if (!response.ok) continue;

            const contentType = (response.headers.get('Content-Type') || '').toLowerCase();
            if (contentType.includes('text/html')) continue;

            const blob = await response.blob();
            if (blob.size === 0) continue;

            const head = new Uint8Array(await blob.slice(0, Math.min(1024, blob.size)).arrayBuffer());
            const headStr = String.fromCharCode(...head.slice(0, Math.min(64, head.length))).toLowerCase();
            if (headStr.startsWith('<!doctype') || headStr.startsWith('<html') || headStr.startsWith('<?xml')) continue;

            if (sniffFileKindLoose(head) === 'unknown') continue;

            return blob;
        } catch (e) {
            if (e.message && e.message.includes('authentication')) throw e;
        }
    }
    throw new Error(`Download failed for ${fileId}. Make the file publicly accessible (Anyone with the link) and try again.`);
}

// Extract file ID from Google Drive link
function extractFileId(link) {
    if (link.includes('/file/d/')) {
        return link.split('/file/d/')[1].split('/')[0];
    } else if (link.includes('id=')) {
        return link.split('id=')[1].split('&')[0];
    }
    throw new Error('Invalid Google Drive link format');
}

// Sniff file type by magic bytes (more reliable than blob.type for Google Drive downloads).
function sniffFileKind(bytes) {
    if (!bytes || bytes.length < 4) return 'unknown';

    // PDF: 25 50 44 46 2D  => "%PDF-"
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2D) {
        return 'pdf';
    }

    // JPEG/JPG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return 'jpg';
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
        bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
        bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
    ) {
        return 'png';
    }

    return 'unknown';
}

// Like Python: detect by magic bytes at start (and PDF anywhere in first 1KB for Drive quirks).
function sniffFileKindLoose(bytes) {
    if (!bytes || bytes.length < 4) return 'unknown';
    if (sniffFileKind(bytes) !== 'unknown') return sniffFileKind(bytes);
    for (let i = 0; i + 5 <= Math.min(bytes.length, 1024); i++) {
        if (bytes[i] === 0x25 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x44 && bytes[i + 3] === 0x46 && bytes[i + 4] === 0x2d)
            return 'pdf';
    }
    return 'unknown';
}

// Convert image blob to a single-page PDF blob using pdf-lib
async function convertImageToPdf(imageBlob, kindHint = 'unknown') {
    const bytes = new Uint8Array(await imageBlob.arrayBuffer());
    const mime = (imageBlob.type || '').toLowerCase();
    const kind = kindHint !== 'unknown' ? kindHint : sniffFileKind(bytes);

    const pdfDoc = await PDFDocument.create();
    let image;

    // JPEG / JPG (image/jpeg or image/jpg; Google Drive may use either)
    if (kind === 'jpg' || mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/jpe') {
        image = await pdfDoc.embedJpg(bytes);
    } else if (kind === 'png' || mime === 'image/png') {
        image = await pdfDoc.embedPng(bytes);
    } else {
        // Try JPEG first (common for .jpg), then PNG
        try {
            image = await pdfDoc.embedJpg(bytes);
        } catch (_) {
            try {
                image = await pdfDoc.embedPng(bytes);
            } catch (e) {
                throw new Error('Unsupported image type. Use JPEG or PNG.');
            }
        }
    }

    const dims = image.scaleToFit(612, 792); // Letter size in points
    const page = pdfDoc.addPage([612, 792]);
    page.drawImage(image, {
        x: (612 - dims.width) / 2,
        y: (792 - dims.height) / 2,
        width: dims.width,
        height: dims.height
    });

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
}

// File combiner: same behavior as combine_drive_files.py
// 1) Detect type by magic bytes (PDF, PNG, JPEG/JPG). 2) Convert images to one-page PDFs.
// 3) Merge all PDFs in order (first link = receipt, second = statement) via pdf-lib.
// No raw concatenation, no ignoreEncryption — so both documents always show. If a PDF is
// password-protected, we throw a clear error (user can re-save without password and retry).
function blobToBytes(blob) {
    return blob.arrayBuffer().then((ab) => new Uint8Array(ab));
}

async function combinePdfs(blobs, _filename) {
    if (!blobs || blobs.length === 0) throw new Error('No files to combine');

    const mergedDoc = await PDFDocument.create();

    for (let i = 0; i < blobs.length; i++) {
        const fileNum = i + 1;
        const bytes = await blobToBytes(blobs[i]);
        if (bytes.length === 0) throw new Error(`File ${fileNum} is empty.`);

        const kind = sniffFileKindLoose(bytes);
        let pdfBytes;

        if (kind === 'pdf') {
            pdfBytes = bytes;
        } else if (kind === 'jpg' || kind === 'png') {
            const imageBlob = new Blob([bytes], { type: blobs[i].type || (kind === 'png' ? 'image/png' : 'image/jpeg') });
            const pdfBlob = await convertImageToPdf(imageBlob, kind);
            pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
        } else {
            const t = (blobs[i].type || '').toLowerCase();
            if (t === 'application/pdf') pdfBytes = bytes;
            else if (t === 'image/jpeg' || t === 'image/jpg' || t === 'image/jpe' || t === 'image/png') {
                const imageBlob = new Blob([bytes], { type: t });
                const pdfBlob = await convertImageToPdf(imageBlob, t.includes('png') ? 'png' : 'jpg');
                pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
            } else {
                throw new Error(`File ${fileNum}: Unsupported type (use PDF, PNG, JPEG, or JPG).`);
            }
        }

        // Load PDF without ignoreEncryption so we get real content. If we used ignoreEncryption we'd get blank pages.
        let srcDoc;
        try {
            srcDoc = await PDFDocument.load(pdfBytes);
        } catch (e) {
            const msg = (e && e.message) ? e.message : String(e);
            if (/encrypted|password/i.test(msg)) {
                throw new Error(
                    `File ${fileNum} is encrypted or password-protected; the extension can't decrypt PDFs in the browser. ` +
                    `Fix: Re-save the file (e.g. Open → Print → "Save as PDF") and use that link, or use the project's Python script combine_drive_files.py to combine (it can decrypt with empty password).`
                );
            }
            throw e;
        }

        const pageCount = srcDoc.getPageCount();
        if (pageCount === 0) throw new Error(`File ${fileNum} has no pages.`);
        const copiedPages = await mergedDoc.copyPages(srcDoc, Array.from({ length: pageCount }, (_, j) => j));
        copiedPages.forEach((p) => mergedDoc.addPage(p));
    }

    const mergedBytes = await mergedDoc.save();
    return new Blob([mergedBytes], { type: 'application/pdf' });
}

// Listen for messages
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'combineFiles') {
        handleFileCombination(request.link1, request.link2, request.filename, request.itemNumber)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    if (request.action === 'clearCombinedListForNewRun') {
        chrome.storage.session.set({ combinedList: [], lastCombinedPdf: null }).then(() => sendResponse({ ok: true }));
        return true;
    }
    if (request.action === 'getCombinedList') {
        chrome.storage.session.get('combinedList').then((data) => {
            sendResponse(Array.isArray(data.combinedList) ? data.combinedList : []);
        });
        return true;
    }
    if (request.action === 'testFileCombiner') {
        runFileCombinerTest()
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    if (request.action === 'getLastCombinedPdf') {
        chrome.storage.session.get('lastCombinedPdf').then((data) => {
            sendResponse(data.lastCombinedPdf || null);
        });
        return true;
    }
    if (request.action === 'downloadLastPdf') {
        chrome.storage.session.get('lastCombinedPdf').then((data) => {
            const pdf = data.lastCombinedPdf;
            if (!pdf || !pdf.base64 || !pdf.filename) {
                sendResponse({ success: false, error: 'No PDF to download' });
                return;
            }
            const dataUrl = `data:application/pdf;base64,${pdf.base64}`;
            chrome.downloads.download({
                url: dataUrl,
                filename: pdf.filename,
                saveAs: true
            }, () => {
                if (chrome.runtime.lastError) {
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    sendResponse({ success: true });
                }
            });
        });
        return true;
    }
    if (request.action === 'downloadCombinedByIndex') {
        const index = request.index;
        chrome.storage.session.get('combinedList').then((data) => {
            const list = Array.isArray(data.combinedList) ? data.combinedList : [];
            const item = list[index];
            if (!item || !item.filename) {
                sendResponse({ success: false, error: 'File not found' });
                return;
            }
            if (item.base64 == null || item.base64 === '') {
                sendResponse({ success: false, error: 'PDF not stored (storage limit). Upload succeeded; list-only entry.' });
                return;
            }
            const dataUrl = `data:application/pdf;base64,${item.base64}`;
            chrome.downloads.download({
                url: dataUrl,
                filename: item.filename,
                saveAs: true
            }, () => {
                if (chrome.runtime.lastError) {
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    sendResponse({ success: true });
                }
            });
        });
        return true;
    }
});

// Try hosted Python server (handles encrypted PDFs). Returns blob or null.
async function tryHostedCombiner(link1, link2, filename) {
    if (!COMBINER_SERVER_URL || !COMBINER_SERVER_URL.trim()) return null;
    const base = COMBINER_SERVER_URL.replace(/\/$/, '');
    try {
        const res = await fetch(`${base}/combine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ link1, link2, filename })
        });
        if (!res.ok) return null;
        const ct = (res.headers.get('Content-Type') || '').toLowerCase();
        if (!ct.includes('pdf')) return null;
        return await res.blob();
    } catch (_) {
        return null;
    }
}

// Handle file combination from Google Drive links
async function handleFileCombination(link1, link2, filename, itemNumber) {
    try {
        let combinedBlob = await tryHostedCombiner(link1, link2, filename);
        if (!combinedBlob) {
            const fileId1 = extractFileId(link1);
            const fileId2 = extractFileId(link2);
            const [blob1, blob2] = await Promise.all([
                downloadFromGoogleDrive(fileId1),
                downloadFromGoogleDrive(fileId2)
            ]);
            combinedBlob = await combinePdfs([blob1, blob2], filename);
        }

        const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result;
                const base64String = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
                resolve(base64String);
            };
            reader.onerror = reject;
            reader.readAsDataURL(combinedBlob);
        });

        const entry = { base64, filename, mimeType: 'application/pdf' };
        const newEntry = { filename, base64, mimeType: 'application/pdf', itemNumber: itemNumber ?? null, createdAt: Date.now() };
        try {
            const existing = await chrome.storage.session.get(['combinedList']);
            let combinedList = Array.isArray(existing.combinedList) ? existing.combinedList : [];
            combinedList.push(newEntry);
            if (combinedList.length > 6) combinedList = combinedList.slice(-6);
            await chrome.storage.session.set({ lastCombinedPdf: entry, combinedList });
        } catch (_) {
            try {
                const { combinedList: existing } = await chrome.storage.session.get(['combinedList']);
                const list = Array.isArray(existing) ? existing : [];
                const strip = (e) => ({ filename: e.filename, mimeType: e.mimeType, itemNumber: e.itemNumber, createdAt: e.createdAt });
                let combinedList = list.map(strip);
                combinedList.push({ filename: newEntry.filename, mimeType: 'application/pdf', itemNumber: newEntry.itemNumber, createdAt: newEntry.createdAt });
                if (combinedList.length > 6) combinedList = combinedList.slice(-6);
                combinedList[combinedList.length - 1].base64 = newEntry.base64;
                if (combinedList.length >= 2 && list[list.length - 1]?.base64) {
                    combinedList[combinedList.length - 2].base64 = list[list.length - 1].base64;
                }
                await chrome.storage.session.set({ lastCombinedPdf: entry, combinedList });
            } catch (__) {}
        }

        return {
            success: true,
            fileBlob: base64,
            filename: filename,
            mimeType: 'application/pdf'
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Minimal 1x1 pixel PNG (base64) for testing - small valid PNG
const MINI_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// Temporary test: combine a minimal PDF and a minimal image to verify the file combiner works
async function runFileCombinerTest() {
    try {
        const pdfDoc = await PDFDocument.create();
        pdfDoc.addPage([612, 792]);
        const pdfBytes = await pdfDoc.save();
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

        const pngBytes = Uint8Array.from(atob(MINI_PNG_BASE64), c => c.charCodeAt(0));
        const pngBlob = new Blob([pngBytes], { type: 'image/png' });

        const combined = await combinePdfs([pdfBlob, pngBlob], 'test-combined.pdf');
        if (!combined || combined.size < 100) {
            throw new Error('Combined file too small or empty');
        }
        if (combined.type !== 'application/pdf') {
            throw new Error('Combined file is not a PDF');
        }

        return {
            success: true,
            message: 'File combiner test passed. PDF + image combined successfully.',
            combinedSize: combined.size
        };
    } catch (error) {
        return {
            success: false,
            error: `File combiner test failed: ${error.message}`
        }
    }
}