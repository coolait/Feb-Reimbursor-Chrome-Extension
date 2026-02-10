// Background service worker for file operations
// Load pdf-lib from extension package (required for Manifest V3 - no remote scripts)
importScripts('lib/pdf-lib.min.js');

const { PDFDocument } = self.PDFLib;

// Download file from Google Drive
async function downloadFromGoogleDrive(fileId) {
    try {
        const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to download: ${response.statusText}`);
        }

        const contentType = response.headers.get('Content-Type') || '';
        if (contentType.includes('text/html')) {
            throw new Error('File requires authentication. Please make the file publicly accessible.');
        }

        const blob = await response.blob();
        return blob;
    } catch (error) {
        throw new Error(`Download failed: ${error.message}`);
    }
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

// Combine multiple PDF blobs (and optionally image blobs converted to PDF) into one PDF
async function combinePdfs(blobs, _filename) {
    if (blobs.length === 0) {
        throw new Error('No files to combine');
    }

    const mergedDoc = await PDFDocument.create();

    for (const blob of blobs) {
        // Read bytes once, then decide how to handle.
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const kind = sniffFileKind(bytes);

        let pdfBytes;
        if (kind === 'pdf') {
            pdfBytes = bytes;
        } else if (kind === 'jpg' || kind === 'png') {
            const pdfBlob = await convertImageToPdf(new Blob([bytes], { type: blob.type || '' }), kind);
            pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
        } else {
            // Fall back to MIME if magic bytes unknown (sometimes headers are stripped, but MIME is set).
            const t = (blob.type || '').toLowerCase();
            if (t === 'application/pdf') {
                pdfBytes = bytes;
            } else if (t === 'image/jpeg' || t === 'image/jpg' || t === 'image/jpe' || t === 'image/png') {
                const pdfBlob = await convertImageToPdf(new Blob([bytes], { type: t }), t.includes('png') ? 'png' : 'jpg');
                pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
            } else {
                throw new Error(`Unsupported file type. Use PDF, PNG, JPEG, or JPG.`);
            }
        }

        const srcDoc = await PDFDocument.load(pdfBytes);
        const pageCount = srcDoc.getPageCount();
        const copiedPages = await mergedDoc.copyPages(srcDoc, Array.from({ length: pageCount }, (_, i) => i));
        copiedPages.forEach(p => mergedDoc.addPage(p));
    }

    const mergedBytes = await mergedDoc.save();
    return new Blob([mergedBytes], { type: 'application/pdf' });
}

// Listen for messages
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'combineFiles') {
        handleFileCombination(request.link1, request.link2, request.filename)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ success: false, error: error.message }));
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
});

// Handle file combination from Google Drive links
async function handleFileCombination(link1, link2, filename) {
    try {
        const fileId1 = extractFileId(link1);
        const fileId2 = extractFileId(link2);

        const [blob1, blob2] = await Promise.all([
            downloadFromGoogleDrive(fileId1),
            downloadFromGoogleDrive(fileId2)
        ]);

        const combinedBlob = await combinePdfs([blob1, blob2], filename);

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

        // Store for viewing/downloading in popup and viewer page
        await chrome.storage.session.set({
            lastCombinedPdf: { base64, filename, mimeType: 'application/pdf' }
        });

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
        };
    }
}