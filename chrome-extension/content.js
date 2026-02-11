// Content script to fill forms on the page
// SIMPLIFIED VERSION: Fills Subject (Value 8), Requested Amount (Value 2), and selects "Reimbursement" category

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

// Simulate typing
function typeText(element, text) {
    element.focus();
    element.value = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
}

// Wait function
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Safe click helper used in a few places to avoid CSP issues on links like <a href="javascript:...">
// It was present earlier; restoring it so existing calls work.
function safeClick(element) {
    if (!element) return false;

    try {
        element.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    } catch {
        // ignore
    }

    const tag = (element.tagName || '').toUpperCase();
    if (tag === 'A') {
        const href = (element.getAttribute('href') || '').trim();
        if (/^javascript:/i.test(href)) {
            const preventDefaultNav = (e) => {
                try {
                    e.preventDefault();
                } catch {
                    // ignore
                }
            };
            element.addEventListener('click', preventDefaultNav, { capture: true, once: true });
        }
    }

    try {
        element.focus?.();
    } catch {
        // ignore
    }

    element.click();
    return true;
}

// Extract month name from date string (format: 'month/day/year')
function getMonthNameFromDate(dateString) {
    if (!dateString) {
        return "Unknown";
    }
    
    try {
        // Split the date string by '/'
        const parts = dateString.split('/');
        if (parts.length >= 1) {
            const monthNum = parseInt(parts[0], 10);
            // Map month number to month name
            const months = {
                1: "January", 2: "February", 3: "March", 4: "April",
                5: "May", 6: "June", 7: "July", 8: "August",
                9: "September", 10: "October", 11: "November", 12: "December"
            };
            return months[monthNum] || "Unknown";
        }
    } catch (error) {
        return "Unknown";
    }
    
    return "Unknown";
}

// Hardcoded element IDs for each item (1-6)
// Extracted from screenshots provided by user
// Use a namespace to avoid redeclaration errors if script loads multiple times
if (typeof window.ITEM_ELEMENTS === 'undefined') {
    window.ITEM_ELEMENTS = [
    // Item #1 (index 0)
    {
        dateField: 'answerTextBox-40496834-free',
        typeField: 'dropDown-10532762',
        fieldCorrect: '40496843', 
        vendorField: 'answerTextBox-40496846-free',
        locationField: 'answerTextBox-40496847-free',
        totalField: 'answerTextBox-40496852-free',
        uploadButton: 'fileUploadQuestion-10532772'
    },
    // Item #2 (index 1) - Date: 40496855 (confirmed from screenshot)
    {
        dateField: 'answerTextBox-40496855-free',
        typeField: 'dropDown-10532777',
        fieldCorrect: '40496862',  
        vendorField: 'answerTextBox-40496866-free',
        locationField: 'answerTextBox-40496868-free',  
        totalField: 'answerTextBox-40496871-free', 
        uploadButton: 'fileUploadQuestion-10532786'
    },
    // Item #3 (index 2) - One field shown: 40496874
    {
        dateField: 'answerTextBox-40496874-free', 
        typeField: 'dropDown-10532788',
        fieldCorrect: '40496879',  
        vendorField: 'answerTextBox-40496882-free',
        locationField: 'answerTextBox-40496883-free',
        totalField: 'answerTextBox-40496885-free', 
        uploadButton: 'fileUploadQuestion-10532795'
    },
    // Item #4 (index 3) - Total: 40496889
    {
        dateField: 'answerTextBox-40496889-free',
        typeField: 'dropDown-10532798',  
        fieldCorrect: '40496894',  
        vendorField: 'answerTextBox-40496897-free',  
        locationField: 'answerTextBox-40496898-free', 
        totalField: 'answerTextBox-40496900-free', 
        uploadButton: 'fileUploadQuestion-10532805'  
    },
    // Item #5 (index 4) - One field shown: 40496903
    {
        dateField: 'answerTextBox-40496903-free',
        typeField: 'dropDown-10532807', 
        fieldCorrect: '40496908',  
        vendorField: 'answerTextBox-40496911-free',  
        locationField: 'answerTextBox-40496916-free',  
        totalField: 'answerTextBox-40496918-free', 
        uploadButton: 'fileUploadQuestion-10532818'  
    },
    // Item #6 (index 5) - One field shown: 40496921 (likely Total based on value="$0")
    {
        dateField: 'answerTextBox-40496921-free', 
        typeField: 'dropDown-10532820',  
        fieldCorrect: '40496926',  
        vendorField: 'answerTextBox-40496929-free',  
        locationField: 'answerTextBox-40496952-free',
        totalField: 'answerTextBox-40496932-free',  
        uploadButton: 'fileUploadQuestion-10532827' 
    }
    ];
}

// Find element IDs for a specific item number using the hardcoded array
function findItemElements(itemNumber) {
    // Validate item number
    if (itemNumber < 1 || itemNumber > 6) {
        console.error(`Invalid item number: ${itemNumber}. Must be between 1 and 6.`);
        return {
            dateField: null,
            typeField: null,
            fieldCorrect: null,
            vendorField: null,
            locationField: null,
            totalField: null,
            uploadButton: null
        };
    }
    
    // Get element IDs from array (itemNumber is 1-based, array is 0-based)
    const elements = window.ITEM_ELEMENTS[itemNumber - 1];
    
    if (!elements || !elements.dateField) {
        console.warn(`Item #${itemNumber} element IDs not yet configured. Please provide screenshots.`);
    }
    
    return elements;
}

// Add/activate a new item in the form
async function addNewItem(itemNumber) {
    if (itemNumber === 1) {
        return true; // Item #1 already exists
    }
    
    console.log(`Attempting to add Item #${itemNumber}...`);
    
    // Try to find a button or link to add a new item
    // Look for buttons with text like "Add Item", "Add Another", etc.
    const buttons = document.querySelectorAll('button, a, [role="button"], input[type="button"]');
    let addButton = null;
    
    for (const btn of buttons) {
        const btnText = (btn.textContent || btn.value || '').trim().toUpperCase();
        if ((btnText.includes('ADD') || btnText.includes('NEW')) && 
            (btnText.includes('ITEM') || btnText.includes('ANOTHER') || btnText.includes('MORE') || btnText.includes('EXPENSE'))) {
            addButton = btn;
            console.log(`Found add button: ${btnText} (${btn.id || btn.className})`);
            break;
        }
    }
    
    // Also try to find by common IDs/classes
    if (!addButton) {
        addButton = document.querySelector('[id*="addItem"], [id*="add-item"], [id*="addItem"], [class*="add-item"], [class*="addItem"], [id*="newItem"]');
        if (addButton) {
            console.log(`Found add button by ID/class: ${addButton.id || addButton.className}`);
        }
    }
    
    // Try to find links that might add items
    if (!addButton) {
        const links = document.querySelectorAll('a');
        for (const link of links) {
            const linkText = (link.textContent || '').trim().toUpperCase();
            if (linkText.includes('ADD') && (linkText.includes('ITEM') || linkText.includes('ANOTHER'))) {
                addButton = link;
                console.log(`Found add link: ${linkText}`);
                break;
            }
        }
    }
    
    if (addButton) {
        // Scroll the button into view
        addButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await wait(500);
        addButton.click();
        // Wait for new item section to render (longer for items 2+ so upload button is in DOM)
        await wait(itemNumber > 2 ? 3000 : 2500);
        console.log(`Clicked add button for Item #${itemNumber}`);
        return true;
    }
    
    // If no button found, the form might auto-add items or they might already exist
    // Try scrolling to see if next item is already there
    console.log(`No add button found for Item #${itemNumber}, assuming item already exists or will be auto-added`);
    window.scrollBy(0, 500);
    await wait(1000);
    return true;
}

// Fill a single expense item
async function fillItem(values, n, itemNumber, firstName, amount) {
    try {
        // First, make sure this item exists in the form (add it if needed)
        await addNewItem(itemNumber);
        
        // Find the element IDs for this specific item
        const itemElements = findItemElements(itemNumber);
        
        // Date of Expense (Value n+1)
        const dateOfExpense = getValue(values, n + 1);
        if (dateOfExpense && itemElements.dateField) {
            const dateField = document.getElementById(itemElements.dateField);
            if (dateField) {
                dateField.focus();
                await wait(50);
                typeText(dateField, dateOfExpense);
                await wait(50);
            }
        }
        
        // Select "Supplies" from Type of Expense dropdown
        if (itemElements.typeField && itemElements.fieldCorrect) {
            const typeOfExpenseField = document.getElementById(itemElements.typeField);
            if (typeOfExpenseField) {
                console.log(`Setting Type of Expense for Item #${itemNumber}, field ID: ${itemElements.typeField}, value: ${itemElements.fieldCorrect}`);
                
                // Use the fieldCorrect value from the array
                typeOfExpenseField.value = itemElements.fieldCorrect;
                
                // Trigger multiple events to ensure the form recognizes the selection
                typeOfExpenseField.dispatchEvent(new Event('change', { bubbles: true }));
                typeOfExpenseField.dispatchEvent(new Event('input', { bubbles: true }));
                typeOfExpenseField.focus();
                await wait(100);
                
                // Verify the value was set
                if (typeOfExpenseField.value === itemElements.fieldCorrect) {
                    console.log(`Successfully set Type of Expense to Supplies for Item #${itemNumber} with value: ${itemElements.fieldCorrect}`);
                } else {
                    console.warn(`Failed to set Type of Expense value for Item #${itemNumber}. Expected: ${itemElements.fieldCorrect}, Got: ${typeOfExpenseField.value}`);
                }
            } else {
                console.error(`Could not find Type of Expense field for Item #${itemNumber} with ID: ${itemElements.typeField}`);
            }
        } else {
            if (!itemElements.typeField) {
                console.error(`No Type of Expense field ID configured for Item #${itemNumber}`);
            }
            if (!itemElements.fieldCorrect) {
                console.error(`No fieldCorrect value configured for Item #${itemNumber}`);
            }
        }
        
        // Vendor Name (Value n+3)
        const vendorName = getValue(values, n + 3);
        if (vendorName && itemElements.vendorField) {
            const vendorField = document.getElementById(itemElements.vendorField);
            if (vendorField) {
                vendorField.focus();
                await wait(50);
                typeText(vendorField, vendorName);
                await wait(50);
            }
        }
        
        // Location - hardcoded to "Berkeley, CA"
        if (itemElements.locationField) {
            const locationField = document.getElementById(itemElements.locationField);
            if (locationField) {
                locationField.focus();
                await wait(50);
                typeText(locationField, "Berkeley, CA");
                await wait(50);
            }
        }
        
        // Total of Expense (Value n+4)
        const totalExpense = getValue(values, n + 4);
        if (totalExpense && itemElements.totalField) {
            const totalField = document.getElementById(itemElements.totalField);
            if (totalField) {
                totalField.focus();
                await wait(50);
                typeText(totalField, totalExpense);
                await wait(50);
            }
        }
        
        // Combine Google Drive files (Value n+5 and n+6)
        const link1 = getValue(values, n + 5);  // First Google Drive link
        const link2 = getValue(values, n + 6);  // Second Google Drive link
        
        let uploadMessage = '';
        if (link1 && link2) {
            // Calculate output filename like in Python script: {first_name}-{amount}-{itom}.pdf
            const itom = Math.floor((n - 9) / 8);
            const output_filename = `${firstName}-${amount}-${itom}.pdf`;
            
            // Send message to background script to combine files and get the blob
            try {
                const combineResponse = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({
                        action: 'combineFiles',
                        link1: link1,
                        link2: link2,
                        filename: output_filename
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(response);
                        }
                    });
                });
                
                if (combineResponse && combineResponse.success && combineResponse.fileBlob) {
                    // Upload the file to this item's upload field
                    await uploadFileToItem(itemNumber, combineResponse.fileBlob, output_filename, itemElements.uploadButton);
                    uploadMessage = `File uploaded: ${output_filename}`;
                } else if (combineResponse && combineResponse.error) {
                    console.error(`Item #${itemNumber} file combination error:`, combineResponse.error);
                    uploadMessage = `File upload failed: ${combineResponse.error}`;
                }
            } catch (error) {
                console.error(`Item #${itemNumber} error combining/uploading files:`, error);
                uploadMessage = `File upload error: ${error.message}`;
            }
        } else {
            uploadMessage = 'No file links provided';
        }
        
        const message = `Date/Vendor/Total filled${uploadMessage ? ', ' + uploadMessage : ''}`;
        return { success: true, message: message };
        
    } catch (error) {
        return { success: false, message: `Error: ${error.message}` };
    }
}

// Upload file to a specific item's upload field
async function uploadFileToItem(itemNumber, base64Blob, filename, uploadButtonId) {
    try {
        console.log(`Starting upload for Item #${itemNumber} with button ID: ${uploadButtonId}`);

        const isVisible = (el) => {
            if (!el) return false;
            const s = window.getComputedStyle(el);
            return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetParent !== null;
        };

        const findBestDialogActionButton = (dialogEl) => {
            if (!dialogEl) return null;
            const buttons = Array.from(dialogEl.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]'))
                .filter(isVisible);
            const score = (btn) => {
                const raw = (btn.textContent || btn.value || '').trim().toUpperCase();
                if (!raw) return 0;
                // Prefer actions that imply submitting the upload.
                if (raw.includes('UPLOAD')) return 5;
                if (raw.includes('ATTACH')) return 4;
                if (raw.includes('SAVE')) return 3;
                if (raw === 'OK') return 2;
                if (raw.includes('OK')) return 1;
                return 0;
            };
            const sorted = buttons
                .map((b) => ({ b, s: score(b) }))
                .filter((x) => x.s > 0)
                .sort((a, b) => b.s - a.s);
            return sorted[0]?.b || null;
        };

        const attachmentAppearsNear = async (anchorEl, name) => {
            const root =
                anchorEl?.closest?.('[id*="fileUploadQuestion"], [class*="question"], .form-group, fieldset, tr, li, .row, .col') ||
                anchorEl?.parentElement ||
                document.body;

            const nameUpper = (name || '').toUpperCase();

            for (let i = 0; i < 20; i++) {
                const text = (root.textContent || '').toUpperCase();
                if (nameUpper && text.includes(nameUpper)) return true;

                // Some UIs don't show full filename; check for any PDF-ish indicator appearing.
                const anyPdfLink = root.querySelector?.('a[href*=".pdf"], a[download], a[href*="download"], [class*="uploaded"], [class*="attachment"], [class*="file"]');
                if (anyPdfLink) return true;

                await wait(250);
            }
            return false;
        };
        
        // Convert base64 back to blob
        const byteCharacters = atob(base64Blob);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        
        // Find the upload button for the item
        let uploadButton = null;
        
        // First, try using the provided button ID
        if (uploadButtonId) {
            // Wait a bit for the button to appear in DOM (items 2+ might need time to load)
            for (let i = 0; i < 10; i++) {
                uploadButton = document.getElementById(uploadButtonId);
                if (uploadButton) {
                    console.log(`Found upload button for Item #${itemNumber} by ID: ${uploadButtonId}`);
                    break;
                }
                await wait(200);
            }
        }
        
        // If not found, try to find it using the item number
        if (!uploadButton) {
            console.log(`Button not found by ID ${uploadButtonId}, trying fallback methods...`);
            if (itemNumber === 1) {
                uploadButton = document.getElementById('fileUploadQuestion-10532772');
            } else {
                // For other items, try to find by searching for all upload buttons
                const allUploadButtons = Array.from(document.querySelectorAll('[id*="fileUploadQuestion"]'));
                console.log(`Found ${allUploadButtons.length} upload buttons on page`);
                
                // Log all found button IDs for debugging
                allUploadButtons.forEach((btn, idx) => {
                    console.log(`Upload button ${idx}: ${btn.id}`);
                });
                
                // Try to find the button by ID pattern matching
                if (uploadButtonId) {
                    // Extract the numeric part from the expected ID
                    const expectedNum = uploadButtonId.match(/\d+/);
                    if (expectedNum) {
                        for (const btn of allUploadButtons) {
                            if (btn.id.includes(expectedNum[0])) {
                                uploadButton = btn;
                                console.log(`Found upload button by pattern matching: ${btn.id}`);
                                break;
                            }
                        }
                    }
                }
                
                // If still not found, try by index
                if (!uploadButton && allUploadButtons.length >= itemNumber) {
                    uploadButton = allUploadButtons[itemNumber - 1];
                    console.log(`Using upload button by index ${itemNumber - 1}: ${uploadButton.id}`);
                }
            }
        }
        
        if (!uploadButton) {
            console.error(`Could not find upload button for Item #${itemNumber} with ID: ${uploadButtonId}`);
            console.error(`Available upload buttons on page:`, Array.from(document.querySelectorAll('[id*="fileUploadQuestion"]')).map(btn => btn.id));
            throw new Error(`Could not find upload button for Item #${itemNumber}`);
        }
        
        // If a previous upload dialog is still open (e.g. from last item), close it first
        const openDialogs = document.querySelectorAll('.ui-dialog');
        for (const d of openDialogs) {
            const s = window.getComputedStyle(d);
            if (s.display === 'none' || s.visibility === 'hidden') continue;
            const okBtn = d.querySelector('.ui-dialog-buttonpane button, button');
            if (okBtn && (okBtn.textContent || '').trim().toUpperCase() === 'OK') {
                safeClick(okBtn);
                await wait(800);
                break;
            }
        }
        
        // Scroll the button into view (items 2+ might be below the fold)
        uploadButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await wait(500);
        
        // Click the upload button to open the upload dialog
        console.log(`Clicking upload button for Item #${itemNumber}`);
        
        // If this is not the first item, wait a bit longer and ensure any previous dialog is closed
        // if (itemNumber > 1) {
        //     // Close any existing dialogs first
        //     const existingDialogs = document.querySelectorAll('.ui-dialog, .uploadFileDialog');
        //     for (const dialog of existingDialogs) {
        //         // Try to find close button by class or aria-label
        //         let closeButton = dialog.querySelector('.ui-dialog-titlebar-close, [aria-label="close"]');
                
        //         // If not found, search by text content
        //         if (!closeButton) {
        //             const buttons = dialog.querySelectorAll('button');
        //             for (const btn of buttons) {
        //                 const btnText = btn.textContent || btn.innerHTML || '';
        //                 if (btnText.includes('×') || btnText.includes('✕') || btnText.trim() === '×') {
        //                     closeButton = btn;
        //                     break;
        //                 }
        //             }
        //         }
                
        //         if (closeButton) {
        //             closeButton.click();
        //             await wait(500);
        //         }
        //     }
        //     await wait(1000); // Extra wait for items 2+
        // }
        
        // Use a direct click here so we fully mimic a real user interaction.
        // The CSP issue we fixed earlier was on the account SELECT link, not this upload button.
        uploadButton.click();
        await wait(2500); // Wait for upload dialog to open and load (longer for items 2+)
        
        // Wait for dialog to appear (check multiple times with different selectors)
        let uploadDialog = null;
        let uploadDialogContent = null;
        console.log(`Waiting for upload dialog to appear for Item #${itemNumber}...`);
        
        for (let i = 0; i < 15; i++) {
            // Find the dialog that is currently visible and has the upload content
            // We need to find the dialog that was just opened for this specific item
            const allDialogs = document.querySelectorAll('.ui-dialog');
            for (const dialog of allDialogs) {
                const style = window.getComputedStyle(dialog);
                const isVisible = style.display !== 'none' && 
                                 style.visibility !== 'hidden' &&
                                 dialog.offsetParent !== null;
                
                // Check if this dialog has upload content
                const hasUploadContent = dialog.querySelector('.uploadFileDialog') !== null ||
                                        dialog.querySelector('input[name="PostedFile"]') !== null ||
                                        dialog.getAttribute('aria-labelledby')?.includes('Upload File') ||
                                        dialog.querySelector('.ui-dialog-title')?.textContent.includes('Upload File');
                
                if (isVisible && hasUploadContent) {
                    uploadDialog = dialog;
                    // Find the dialog content area (where the file input is)
                    uploadDialogContent = dialog.querySelector('.ui-dialog-content, .uploadFileDialog, form');
                    console.log(`Found upload dialog for Item #${itemNumber} on attempt ${i + 1}`);
                    break;
                }
            }
            
            if (uploadDialog) break;
            
            // Fallback: try the original selectors
            uploadDialog = document.querySelector('.ui-dialog[style*="display: block"]') ||
                         document.querySelector('.ui-dialog:not([style*="display: none"])');
            
            if (uploadDialog) {
                uploadDialogContent = uploadDialog.querySelector('.ui-dialog-content, .uploadFileDialog, form');
                console.log(`Found upload dialog (fallback) for Item #${itemNumber} on attempt ${i + 1}`);
                break;
            }
            
            await wait(300);
        }
        
        if (!uploadDialog) {
            console.error(`Could not find upload dialog for Item #${itemNumber} after 15 attempts`);
            // Log all dialogs on the page for debugging
            const allDialogs = document.querySelectorAll('[class*="dialog"], [id*="dialog"], [role="dialog"]');
            console.log(`Found ${allDialogs.length} dialog-like elements on page:`, Array.from(allDialogs).map(d => ({ id: d.id, class: d.className, style: d.style.display })));
            throw new Error(`Upload dialog did not appear for Item #${itemNumber}`);
        }
        
        console.log(`Upload dialog found for Item #${itemNumber}, looking for file input...`);
        
        if (uploadDialog) {
            // Wait longer for the dialog to fully render, especially for items 2+
            await wait(1000);
            
            let fileInput = null;
            
            // Strategy 1: Wait for file input to appear using MutationObserver or polling
            // The file input might be created dynamically after dialog opens
            console.log(`Waiting for file input to appear for Item #${itemNumber}...`);
            for (let attempt = 0; attempt < 20; attempt++) {
                // Prefer file input INSIDE the current dialog so we never use one from a previous (hidden) dialog
                // 1. Search in dialog content
                if (uploadDialogContent) {
                    fileInput = uploadDialogContent.querySelector('input[type="file"]');
                    if (fileInput) {
                        console.log(`Found file input in dialog content for Item #${itemNumber} on attempt ${attempt + 1}`);
                        break;
                    }
                }
                // 2. Search in entire dialog
                if (!fileInput) {
                    fileInput = uploadDialog.querySelector('input[type="file"]');
                    if (fileInput) {
                        console.log(`Found file input in dialog for Item #${itemNumber} on attempt ${attempt + 1}`);
                        break;
                    }
                }
                // 3. Search in forms within dialog
                if (!fileInput) {
                    const forms = uploadDialog.querySelectorAll('form');
                    for (const form of forms) {
                        fileInput = form.querySelector('input[type="file"]');
                        if (fileInput) {
                            console.log(`Found file input in form for Item #${itemNumber} on attempt ${attempt + 1}`);
                            break;
                        }
                    }
                }
                // 4. Only then try global (and require it to be inside or near THIS dialog)
                if (!fileInput) {
                    const globalInput = document.querySelector('input[name="PostedFile"][type="file"]');
                    if (globalInput && uploadDialog.contains(globalInput)) {
                        fileInput = globalInput;
                        console.log(`Found PostedFile inside dialog for Item #${itemNumber} on attempt ${attempt + 1}`);
                        break;
                    }
                    if (globalInput) {
                        const rect = globalInput.getBoundingClientRect();
                        const dialogRect = uploadDialog.getBoundingClientRect();
                        const isVisible = rect.width > 0 && rect.height > 0;
                        const isNearDialog = Math.abs(rect.top - dialogRect.top) < 300 || Math.abs(rect.bottom - dialogRect.bottom) < 300;
                        if (isVisible && isNearDialog) {
                            fileInput = globalInput;
                            console.log(`Found visible file input near dialog for Item #${itemNumber} on attempt ${attempt + 1}`);
                            break;
                        }
                    }
                }
                // 5. Check all file inputs on page that are inside or near this dialog
                if (!fileInput) {
                    const allFileInputs = document.querySelectorAll('input[type="file"]');
                    for (const input of allFileInputs) {
                        if (!uploadDialog.contains(input)) continue;
                        const rect = input.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            fileInput = input;
                            console.log(`Found visible file input in dialog for Item #${itemNumber} on attempt ${attempt + 1}: ${input.name || input.id || 'no id'}`);
                            break;
                        }
                    }
                }
                // 6. Check for iframes (they might load asynchronously)
                if (!fileInput) {
                    const iframes = uploadDialog.querySelectorAll('iframe');
                    for (const iframe of iframes) {
                        try {
                            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                            fileInput = iframeDoc.querySelector('input[type="file"]');
                            if (fileInput) {
                                console.log(`Found file input in iframe for Item #${itemNumber} on attempt ${attempt + 1}`);
                                break;
                            }
                        } catch (e) {
                            // CORS or not loaded yet
                        }
                    }
                }
                
                if (fileInput) break;
                
                // Wait before next attempt
                await wait(200);
            }
            
            if (!fileInput) {
                console.error(`Could not find file input for Item #${itemNumber} after 20 attempts`);
                // Last resort: use the first visible file input on the page
                const allFileInputs = document.querySelectorAll('input[type="file"]');
                for (const input of allFileInputs) {
                    const rect = input.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        fileInput = input;
                        console.warn(`Using fallback: first visible file input on page for Item #${itemNumber}`);
                        break;
                    }
                }
            }
            
            if (!fileInput) {
                console.error(`Could not find any file input for Item #${itemNumber}`);
                throw new Error(`Could not find file input in upload dialog for Item #${itemNumber}`);
            }
            
            if (fileInput) {
                console.log(`Found file input for Item #${itemNumber}, setting file...`);
                
                // Create a File object from the blob (single file only)
                const file = new File([blob], filename, { type: 'application/pdf' });
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInput.files = dataTransfer.files;
                // Trigger once so the form sees one file (avoid duplicate uploads from change + input)
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));

                // Resolve dialog container now so we can wait for "file ready" inside it
                let dialogContainer = fileInput.closest('.ui-dialog');
                if (!dialogContainer) {
                    let parent = fileInput.parentElement;
                    while (parent && parent !== document.body) {
                        if (parent.classList.contains('ui-dialog') || parent.classList.contains('uploadFileDialog') || parent.getAttribute('role') === 'dialog') {
                            dialogContainer = parent;
                            break;
                        }
                        parent = parent.parentElement;
                    }
                }
                const dialogToPoll = dialogContainer || uploadDialog;

                // Wait until the page shows the file in the dialog (avoids clicking OK too early and getting "put in a file" error)
                const fileReady = (el) => {
                    if (!el) return false;
                    const text = (el.textContent || '').toLowerCase();
                    const hasFilename = filename && text.includes(filename.toLowerCase());
                    const hasPdf = text.includes('.pdf') || el.querySelector?.('a[href*=".pdf"], [class*="uploaded"], [class*="attachment"], [class*="filename"]');
                    return hasFilename || !!hasPdf;
                };
                console.log(`Waiting for file to appear in dialog for Item #${itemNumber}...`);
                const maxWaitMs = 12000;
                const stepMs = 250;
                let fileShown = false;
                for (let elapsed = 0; elapsed < maxWaitMs; elapsed += stepMs) {
                    if (fileReady(dialogToPoll)) {
                        fileShown = true;
                        console.log(`File visible in dialog for Item #${itemNumber} after ${elapsed}ms`);
                        break;
                    }
                    await wait(stepMs);
                }
                if (!fileShown) {
                    console.warn(`File may not be visible in dialog for Item #${itemNumber}, waiting extra 2s before OK...`);
                    await wait(2000);
                }
                
                // Find and click OK button in the SPECIFIC dialog that contains this file input
                console.log(`Looking for OK button in dialog for Item #${itemNumber}...`);
                let okButton = null;
                if (!dialogContainer) {
                    dialogContainer = fileInput.closest('.ui-dialog');
                    if (!dialogContainer) {
                        let parent = fileInput.parentElement;
                        while (parent && parent !== document.body) {
                            if (parent.classList.contains('ui-dialog') || parent.classList.contains('uploadFileDialog') || parent.getAttribute('role') === 'dialog') {
                                dialogContainer = parent;
                                break;
                            }
                            parent = parent.parentElement;
                        }
                    }
                }
                // If we found the dialog container, search for OK button within it
                if (dialogContainer) {
                    console.log(`Found dialog container for Item #${itemNumber}, searching for OK button...`);
                    const buttonPane = dialogContainer.querySelector('.ui-dialog-buttonpane');
                    if (buttonPane) {
                        const buttons = buttonPane.querySelectorAll('button');
                        console.log(`Found ${buttons.length} buttons in buttonpane for Item #${itemNumber}`);
                        for (const btn of buttons) {
                            const btnText = btn.textContent.trim().toUpperCase();
                            console.log(`Button text: "${btnText}"`);
                            if (btnText === 'OK') {
                                okButton = btn;
                                console.log(`Found OK button by text in buttonpane for Item #${itemNumber}`);
                                break;
                            }
                        }
                    }
                    
                    // If not found in buttonpane, search in the entire dialog container
                    if (!okButton) {
                        const buttons = dialogContainer.querySelectorAll('button');
                        console.log(`Found ${buttons.length} buttons in dialog container for Item #${itemNumber}`);
                        for (const btn of buttons) {
                            const btnText = btn.textContent.trim().toUpperCase();
                            if (btnText === 'OK') {
                                okButton = btn;
                                console.log(`Found OK button in dialog container for Item #${itemNumber}`);
                                break;
                            }
                        }
                    }
                }
                
                // Strategy 2: If we still don't have the button, use the uploadDialog we found earlier
                // but make sure it's the one that contains our file input
                if (!okButton && uploadDialog) {
                    // Verify the uploadDialog contains our file input
                    if (uploadDialog.contains(fileInput)) {
                        const buttonPane = uploadDialog.querySelector('.ui-dialog-buttonpane');
                        if (buttonPane) {
                            const buttons = buttonPane.querySelectorAll('button');
                            for (const btn of buttons) {
                                const btnText = btn.textContent.trim().toUpperCase();
                                if (btnText === 'OK') {
                                    okButton = btn;
                                    console.log(`Found OK button in uploadDialog buttonpane for Item #${itemNumber}`);
                                    break;
                                }
                            }
                        }
                    }
                }

                // Strategy 2b: If there isn't an explicit OK, try "UPLOAD"/"ATTACH"/"SAVE"
                if (!okButton) {
                    const bestAction = findBestDialogActionButton(dialogContainer || uploadDialog);
                    if (bestAction) {
                        okButton = bestAction;
                        console.log(`Using dialog action button: ${(bestAction.textContent || bestAction.value || '').trim()}`);
                    }
                }
                
                // Strategy 3: Find the visible dialog that contains the file input
                if (!okButton) {
                    // Find all visible dialogs
                    const allDialogs = document.querySelectorAll('.ui-dialog');
                    for (const dialog of allDialogs) {
                        // Check if dialog is visible
                        const style = window.getComputedStyle(dialog);
                        const isVisible = style.display !== 'none' && 
                                         style.visibility !== 'hidden' &&
                                         dialog.offsetParent !== null;
                        
                        // Check if this dialog contains our file input
                        if (isVisible && dialog.contains(fileInput)) {
                            const buttonPane = dialog.querySelector('.ui-dialog-buttonpane');
                            if (buttonPane) {
                                const buttons = buttonPane.querySelectorAll('button');
                                for (const btn of buttons) {
                                    const btnText = btn.textContent.trim().toUpperCase();
                                    if (btnText === 'OK') {
                                        okButton = btn;
                                        console.log(`Found OK button in visible dialog containing file input for Item #${itemNumber}`);
                                        break;
                                    }
                                }
                            }
                            if (okButton) break;
                        }
                    }
                }
                
                if (okButton) {
                    console.log(`Clicking dialog action button for Item #${itemNumber}`);
                    okButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await wait(300);
                    okButton.focus();
                    await wait(100);
                    // Single click only (double-click was causing multiple/blank uploads)
                    okButton.click();
                    await wait(500);
                    
                    // Verify dialog is closing
                    const dialogToCheck = dialogContainer || uploadDialog;
                    let dialogStillOpen = true;
                    for (let i = 0; i < 10; i++) {
                        const dialogVisible = isVisible(dialogToCheck);
                        if (!dialogVisible) {
                            dialogStillOpen = false;
                            console.log(`Dialog closed for Item #${itemNumber} after ${i + 1} checks`);
                            break;
                        }
                        await wait(200);
                    }
                    
                    if (dialogStillOpen) {
                        console.warn(`Dialog still appears open for Item #${itemNumber}, waiting for it to close...`);
                        await wait(2000);
                    }
                    // Wait for dialog to be fully gone so the next item's upload doesn't conflict
                    for (let i = 0; i < 20; i++) {
                        const openDialogs = document.querySelectorAll('.ui-dialog');
                        const anyVisible = Array.from(openDialogs).some((d) => {
                            const s = window.getComputedStyle(d);
                            return s.display !== 'none' && s.visibility !== 'hidden' && d.offsetParent !== null;
                        });
                        if (!anyVisible) break;
                        await wait(250);
                    }

                    console.log(`Upload completed for Item #${itemNumber}`);
                } else {
                    console.error(`Could not find OK button in upload dialog for Item #${itemNumber}`);
                    // Log all buttons for debugging
                    const allButtons = uploadDialog.querySelectorAll('button');
                    console.error(`Available buttons in dialog:`, Array.from(allButtons).map(b => ({
                        text: b.textContent.trim(),
                        id: b.id,
                        class: b.className
                    })));
                    
                    // Try to find buttonpane outside dialog
                    const buttonPane = document.querySelector('.ui-dialog-buttonpane');
                    if (buttonPane) {
                        const paneButtons = buttonPane.querySelectorAll('button');
                        console.error(`Available buttons in buttonpane:`, Array.from(paneButtons).map(b => ({
                            text: b.textContent.trim(),
                            id: b.id,
                            class: b.className
                        })));
                    }
                    // Try a broader action button search as a best-effort (but don't hard-fail if it doesn't look perfect)
                    const best = findBestDialogActionButton(dialogContainer || uploadDialog);
                    if (best) {
                        console.warn(`Falling back to dialog action button: ${(best.textContent || best.value || '').trim()}`);
                        safeClick(best);
                        await wait(750);
                    } else {
                        console.warn(`No clear action button found in upload dialog for Item #${itemNumber}; proceeding without additional clicks.`);
                    }
                }
            } else {
                // If no file input found, the dialog might use a different mechanism
                // Try to find iframe or other upload mechanism
                const iframe = uploadDialog.querySelector('iframe');
                if (iframe) {
                    // Handle iframe-based upload
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    const iframeFileInput = iframeDoc.querySelector('input[type="file"]');
                    if (iframeFileInput) {
                        const file = new File([blob], filename, { type: 'application/pdf' });
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(file);
                    iframeFileInput.files = dataTransfer.files;
                    iframeFileInput.dispatchEvent(new Event('change', { bubbles: true }));
                    await wait(1000); // Wait for file to be processed
                    
                    // Find and click OK button in the dialog
                    let okButton = null;
                    const buttons = uploadDialog.querySelectorAll('button');
                    for (const btn of buttons) {
                        const btnText = btn.textContent.trim().toUpperCase();
                        if (btnText === 'OK') {
                            okButton = btn;
                            break;
                        }
                    }
                    if (okButton) {
                        safeClick(okButton);
                        await wait(1000);
                    }
                }
                }
            }
        } else {
            // Alternative: try to find file input directly (might be hidden)
            const hiddenFileInput = document.querySelector('input[type="file"][id*="40496854"], input[type="file"][name*="40496854"]');
            if (hiddenFileInput) {
                const file = new File([blob], filename, { type: 'application/pdf' });
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                hiddenFileInput.files = dataTransfer.files;
                hiddenFileInput.dispatchEvent(new Event('change', { bubbles: true }));
                await wait(1000); // Wait for file to be processed
                
                // Try to find the upload dialog that might have appeared
                let uploadDialog = null;
                for (let i = 0; i < 5; i++) {
                    uploadDialog = document.querySelector('.uploadFileDialog:not([style*="display: none"]), .ui-dialog:not([style*="display: none"])');
                    if (uploadDialog) break;
                    await wait(200);
                }
                
                if (uploadDialog) {
                    // Find and click OK button
                    let okButton = null;
                    const buttons = uploadDialog.querySelectorAll('button');
                    for (const btn of buttons) {
                        if (btn.textContent.trim().toUpperCase() === 'OK') {
                            okButton = btn;
                            break;
                        }
                    }
                    if (okButton) {
                        safeClick(okButton);
                        await wait(1000);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
}

// SIMPLIFIED: Fill Subject field with Value 8 (First Name) and Requested Amount with Value 2
async function fillForm(values) {
    try {
        // Wait a bit for page to be ready
        await wait(500);
        
        // Get Value 8 (First Name)
        const firstName = getValue(values, 8);
        
        if (!firstName) {
            return { success: false, error: 'Value 8 (First Name) is empty' };
        }
        
        // Get Value 18 (Date of Expense for Item #1) to extract month name
        const dateValue = getValue(values, 18);
        const monthName = getMonthNameFromDate(dateValue);
        
        // Find the Subject input field by ID
        const subjectField = document.getElementById('Subject');
        
        if (!subjectField) {
            return { success: false, error: 'Could not find Subject field on this page' };
        }
        
        // Fill the Subject field with "FirstName - MonthName" (matching Python script)
        const subjectValue = firstName + " - " + monthName;
        subjectField.focus();
        await wait(100);
        typeText(subjectField, subjectValue);
        await wait(100);
        
        // Get Value 2 (Amount)
        const amount = getValue(values, 2);
        
        if (amount) {
            // Find the Requested Amount input field by ID
            const requestedAmountField = document.getElementById('RequestedAmount');
            
            if (requestedAmountField) {
                requestedAmountField.focus();
                await wait(100);
                typeText(requestedAmountField, amount);
                await wait(100);
            }
        }
        
        // Select "Reimbursement" from Categories dropdown
        const categoryField = document.getElementById('CategoryId');
        if (categoryField) {
            // Set value to "1352" which is the value for "Reimbursement"
            categoryField.value = "1352";
            // Trigger change event to ensure the form recognizes the selection
            categoryField.dispatchEvent(new Event('change', { bubbles: true }));
            await wait(100);
        }
        
        // Select Account - click the SELECT button and choose the middle account (MISC)
        const accountSelectButton = document.getElementById('accountSelectButton');
        if (accountSelectButton) {
            // Click the account select button to open the modal
            accountSelectButton.click();
            await wait(1500); // Wait for modal to open and load
            
            // Find the account modal container
            const selectAccountContainer = document.getElementById('selectAccountContainer');
            if (selectAccountContainer) {
                // Find the accounts table/grid
                const accountsTable = selectAccountContainer.querySelector('#accounts table, #accounts .table, #accounts [role="grid"], table');
                
                if (accountsTable) {
                    // Find all data rows (skip header row if present)
                    const rows = accountsTable.querySelectorAll('tr');
                    let dataRows = [];
                    
                    // Filter out header rows
                    for (let row of rows) {
                        const firstCell = row.querySelector('td, th');
                        if (firstCell && firstCell.tagName === 'TD') {
                            dataRows.push(row);
                        }
                    }
                    
                    // Select the middle account (second row, index 1)
                    if (dataRows.length >= 2) {
                        const middleRow = dataRows[1];
                        // Find the SELECT button/link in that row
                        const selectButton = middleRow.querySelector('a.button, a[class*="button"], button, [class*="select"], a[href*="javascript"]');
                        if (selectButton) {
                            selectButton.click();
                            await wait(500);
                        } else {
                            // Alternative: try clicking on the row or first cell
                            const firstCell = middleRow.querySelector('td');
                            if (firstCell) {
                                firstCell.click();
                                await wait(500);
                            }
                        }
                    }
                } else {
                    // Fallback: look for all SELECT buttons and click the second one
                    const allSelectButtons = selectAccountContainer.querySelectorAll('a.button, button, a[class*="button"]');
                    for (let i = 0; i < allSelectButtons.length; i++) {
                        const btn = allSelectButtons[i];
                        const btnText = (btn.textContent || btn.innerText || '').trim().toUpperCase();
                        if (btnText.includes('SELECT') && i === 1) {
                            btn.click();
                            await wait(500);
                            break;
                        }
                    }
                }
            }
        }
        
        // Fill Payee Information fields
        const payeeFields = [
            { id: 'PayeeFirstName', value: getValue(values, 8), label: 'First Name' },
            { id: 'PayeeLastName', value: getValue(values, 9), label: 'Last Name' },
            { id: 'PayeeStreet', value: getValue(values, 10), label: 'Street' },
            { id: 'PayeeStreet2', value: getValue(values, 11), label: 'Street Continued' },
            { id: 'PayeeCity', value: getValue(values, 12), label: 'City' },
            { id: 'PayeeState', value: getValue(values, 13), label: 'State' },
            { id: 'PayeeZipCode', value: getValue(values, 14), label: 'ZIP' }
        ];
        
        const filledPayeeFields = [];
        for (const field of payeeFields) {
            const fieldElement = document.getElementById(field.id);
            if (fieldElement && field.value) {
                fieldElement.focus();
                await wait(50);
                typeText(fieldElement, field.value);
                await wait(50);
                filledPayeeFields.push(field.label);
            }
        }
        
        // Select "YES" radio button for UC Berkeley Student/Faculty question
        const yesRadioButton = document.getElementById('28262917');
        if (yesRadioButton) {
            yesRadioButton.checked = true;
            yesRadioButton.dispatchEvent(new Event('change', { bubbles: true }));
            yesRadioButton.dispatchEvent(new Event('click', { bubbles: true }));
            await wait(100);
            
            // Fill the UID field (Value 15) below the YES option
            const uidValue = getValue(values, 15);
            if (uidValue) {
                const uidField = document.getElementById('answerTextBox-28262917-free');
                if (uidField) {
                    uidField.focus();
                    await wait(50);
                    typeText(uidField, uidValue);
                    await wait(50);
                    filledPayeeFields.push('UID');
                }
            }
        }
        
        // Fill Email Address (Value 16)
        const emailValue = getValue(values, 16);
        if (emailValue) {
            const emailField = document.getElementById('answerTextBox-13557646-free');
            if (emailField) {
                emailField.focus();
                await wait(50);
                typeText(emailField, emailValue);
                await wait(50);
                filledPayeeFields.push('Email');
            }
        }
        
        // Fill Phone Number (Value 17)
        const phoneValue = getValue(values, 17);
        if (phoneValue) {
            const phoneField = document.getElementById('answerTextBox-13557622-free');
            if (phoneField) {
                phoneField.focus();
                await wait(50);
                typeText(phoneField, phoneValue);
                await wait(50);
                filledPayeeFields.push('Phone');
            }
        }
        
        // Select "Direct Deposit" from Expenditure Action dropdown
        const expenditureActionField = document.getElementById('dropDown-2483087');
        if (expenditureActionField) {
            // Set value to "43040847" which is the value for "Direct Deposit"
            expenditureActionField.value = "43040847";
            // Trigger change event to ensure the form recognizes the selection
            expenditureActionField.dispatchEvent(new Event('change', { bubbles: true }));
            await wait(100);
        }
        
        // Process multiple items using while loop (like Python script)
        // Start with n=17, check if n==17 or getValue(n) == "Yes"
        let n = 17;
        let itemNumber = 1;
        const processedItems = [];
        
        while (true) {
            // Check if we should process this item
            const shouldProcess = (n === 17) || (getValue(values, n) === "Yes");
            
            if (!shouldProcess) {
                break; // No more items to process
            }
            
            // Fill this item (addNewItem is called inside fillItem)
            const itemResult = await fillItem(values, n, itemNumber, firstName, amount);
            processedItems.push(`Item #${itemNumber}: ${itemResult.message}`);
            
            // Wait longer before moving to next item to ensure upload fully completes
            // This is critical since the file input is reused across items
            if (itemResult.message.includes('File uploaded')) {
                console.log(`Waiting for Item #${itemNumber} upload to fully process...`);
                await wait(3000); // Extra wait after file upload
            } else {
                await wait(1000);
            }
            
            // Move to next item
            n += 8;
            itemNumber++;
            
            // Wait a bit before processing next item to ensure form is ready
            await wait(1000);
        }
        
        const filledFields = [];
        filledFields.push(`Subject: ${firstName}`);
        if (amount) filledFields.push(`Requested Amount: ${amount}`);
        if (categoryField) filledFields.push(`Category: Reimbursement`);
        if (accountSelectButton) filledFields.push(`Account: Selected`);
        if (filledPayeeFields.length > 0) filledFields.push(`Payee Info: ${filledPayeeFields.join(', ')}`);
        if (expenditureActionField) filledFields.push(`Expenditure Action: Direct Deposit`);
        filledFields.push(...processedItems);
        
        return { success: true, message: `Fields filled: ${filledFields.join(', ')}` };
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
        // Respond to ping to confirm content script is ready
        sendResponse({ ready: true });
        return false;
    }
    
    if (request.action === 'fillForm') {
        fillForm(request.values).then(result => {
            sendResponse(result);
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true; // Keep the message channel open for async response
    }
    
    return false;
});

// Log that content script is loaded
console.log('FEB Auto Reimbursor content script loaded');
