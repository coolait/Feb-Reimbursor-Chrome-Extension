// Parse row input function
function parseRowInput(rowText) {
    return rowText.trim().split('\t');
}

// Get value at 1-based index
function getValue(values, index) {
    if (index - 1 < values.length) {
        return values[index - 1].trim();
    }
    return "";
}

// Get month name from date
function getMonthNameFromDate(dateString) {
    if (!dateString) {
        return "Unknown";
    }
    
    try {
        const parts = dateString.split('/');
        if (parts.length >= 1) {
            const monthNum = parseInt(parts[0]);
            const months = {
                1: "January", 2: "February", 3: "March", 4: "April",
                5: "May", 6: "June", 7: "July", 8: "August",
                9: "September", 10: "October", 11: "November", 12: "December"
            };
            return months[monthNum] || "Unknown";
        }
    } catch (e) {
        return "Unknown";
    }
    
    return "Unknown";
}

// Show or hide the "Last combined PDF" section
function refreshLastPdfSection() {
    chrome.runtime.sendMessage({ action: 'getLastCombinedPdf' }, (pdf) => {
        const section = document.getElementById('lastPdfSection');
        const filenameEl = document.getElementById('lastPdfFilename');
        if (pdf && pdf.filename) {
            section.style.display = 'block';
            filenameEl.textContent = pdf.filename;
        } else {
            section.style.display = 'none';
        }
    });
}

// Show list of all files combined/uploaded in this browser session
function refreshUploadedListSection() {
    chrome.runtime.sendMessage({ action: 'getCombinedList' }, (list) => {
        const section = document.getElementById('uploadedListSection');
        const listEl = document.getElementById('uploadedList');
        const emptyEl = document.getElementById('uploadedListEmpty');

        if (!Array.isArray(list) || list.length === 0) {
            section.style.display = 'none';
            listEl.innerHTML = '';
            emptyEl.style.display = 'block';
            return;
        }

        section.style.display = 'block';
        listEl.innerHTML = '';
        emptyEl.style.display = 'none';

        list.forEach((item, idx) => {
            const li = document.createElement('li');
            li.textContent = `${idx + 1}. ${item.filename || 'combined.pdf'}`;
            listEl.appendChild(li);
        });
    });
}

// Show status message
function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = type;
    statusDiv.style.display = 'block';
    
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

// Process the row data
document.getElementById('processBtn').addEventListener('click', async () => {
    const rowInput = document.getElementById('rowInput').value.trim();
    const processBtn = document.getElementById('processBtn');
    
    if (!rowInput) {
        showStatus('Please paste the row data first', 'error');
        return;
    }
    
    // Disable button
    processBtn.disabled = true;
    showStatus('Processing...', 'info');
    
    try {
        // Parse the input
        const values = parseRowInput(rowInput);
        
        // Get current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) {
            showStatus('Error: No active tab found.', 'error');
            processBtn.disabled = false;
            return;
        }
        
        // Check if we can inject scripts (not on chrome:// or extension pages)
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
            showStatus('Error: Cannot run on this page. Please navigate to a regular webpage (like the form page).', 'error');
            processBtn.disabled = false;
            return;
        }
        
        showStatus(`Connecting to page: ${tab.url.substring(0, 50)}...`, 'info');
        
        // Inject content script if not already injected
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
            // Wait a bit for script to initialize
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (injectError) {
            // Script might already be injected, that's okay
            console.log('Script injection note:', injectError);
        }
        
        // Check if content script is ready
        const checkReady = (retries = 5) => {
            return new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(tab.id, { action: 'ping' }, (response) => {
                    if (chrome.runtime.lastError) {
                        if (retries > 0) {
                            setTimeout(() => checkReady(retries - 1).then(resolve).catch(reject), 200);
                        } else {
                            reject(new Error('Content script not ready'));
                        }
                    } else {
                        resolve();
                    }
                });
            });
        };
        
        // Wait for content script to be ready
        try {
            await checkReady();
        } catch (error) {
            showStatus('Error: Content script not ready. Please refresh the page and try again.', 'error');
            processBtn.disabled = false;
            return;
        }
        
        // Send data to content script with retry
        const sendMessageWithRetry = (retries = 3) => {
            chrome.tabs.sendMessage(tab.id, {
                action: 'fillForm',
                values: values
            }, (response) => {
                if (chrome.runtime.lastError) {
                    if (retries > 0) {
                        // Retry after a short delay
                        setTimeout(() => sendMessageWithRetry(retries - 1), 200);
                        return;
                    }
                    showStatus('Error: ' + chrome.runtime.lastError.message + '. Make sure you are on a webpage (not chrome:// pages).', 'error');
                    processBtn.disabled = false;
                    return;
                }
                
                if (response && response.success) {
                    showStatus(response.message || 'Subject field filled successfully!', 'success');
                    refreshLastPdfSection();
                    refreshUploadedListSection();
                } else {
                    showStatus(response?.error || 'Failed to fill Subject field', 'error');
                }
                
                processBtn.disabled = false;
            });
        };
        
        sendMessageWithRetry();
        
    } catch (error) {
        showStatus('Error: ' + error.message, 'error');
        processBtn.disabled = false;
    }
});

// Test File Combiner button - verifies PDF + image combination works in the extension
document.getElementById('testCombinerBtn').addEventListener('click', async () => {
    const btn = document.getElementById('testCombinerBtn');
    btn.disabled = true;
    showStatus('Running file combiner test...', 'info');
    try {
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'testFileCombiner' }, (res) => {
                if (chrome.runtime.lastError) {
                    resolve({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    resolve(res || { success: false, error: 'No response' });
                }
            });
        });
        if (response.success) {
            showStatus(response.message + (response.combinedSize ? ` (${response.combinedSize} bytes)` : ''), 'success');
        } else {
            showStatus(response.error || 'Test failed', 'error');
        }
    } catch (e) {
        showStatus('Test error: ' + e.message, 'error');
    }
    btn.disabled = false;
});

// Show last PDF section on popup open
refreshLastPdfSection();
refreshUploadedListSection();

// View last combined PDF in extension tab
document.getElementById('viewPdfBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('viewer.html') });
});

// Download last combined PDF
document.getElementById('downloadPdfBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'downloadLastPdf' }, (response) => {
        if (response && response.success) {
            showStatus('Download started', 'success');
        } else {
            showStatus(response?.error || 'Download failed', 'error');
        }
    });
});
