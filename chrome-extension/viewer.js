(async () => {
    const pdf = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getLastCombinedPdf' }, (data) => {
            resolve(data);
        });
    });

    const filenameEl = document.getElementById('filename');
    const pdfEmbed = document.getElementById('pdfEmbed');
    const pdfContainer = document.getElementById('pdfContainer');
    const noPdfEl = document.getElementById('noPdf');
    const downloadBtn = document.getElementById('downloadBtn');
    const backBtn = document.getElementById('backBtn');

    if (!pdf || !pdf.base64) {
        pdfContainer.style.display = 'none';
        noPdfEl.style.display = 'flex';
        downloadBtn.disabled = true;
    } else {
        filenameEl.textContent = pdf.filename || 'combined.pdf';
        pdfEmbed.src = `data:application/pdf;base64,${pdf.base64}`;

        downloadBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'downloadLastPdf' }, (response) => {
                if (response && !response.success) {
                    alert(response.error || 'Download failed');
                }
            });
        });
    }

    backBtn.addEventListener('click', () => {
        window.close();
    });
})();
