# FEB Auto Reimbursor Chrome Extension

A Chrome extension that automates form filling and Google Drive file combination.

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder
5. The extension should now appear in your extensions list

## Usage

1. Navigate to the form page you want to fill
2. Click the extension icon in your Chrome toolbar
3. Paste the tab-separated row data from Google Sheets
4. Click "Process Row"
5. The extension will fill the form and combine Google Drive files if links are provided

## Features

- Automatically fills form fields based on row data
- Extracts month name from date values
- Combines Google Drive files (PDF, PNG, JPEG) into a single PDF
- Downloads the combined file

## Important Limitations

### Desktop vs Browser Automation

The original Python script uses `pyautogui` to control desktop applications and click at specific screen coordinates. Chrome extensions **cannot**:
- Control desktop applications outside the browser
- Click at absolute screen coordinates
- Control mouse movements
- Send keyboard shortcuts like Alt+Tab

The extension **can**:
- Fill web forms by manipulating DOM elements
- Navigate between form fields using Tab/Enter
- Fill input fields programmatically
- Download files

### PDF Combination

The PDF combination feature is simplified. For full functionality, you'll need to:
1. Install PDF-lib library (requires bundling)
2. Or set up a backend service
3. Or download files separately and combine manually

See `INSTALLATION.md` for more details.

## Customization Required

You **will need** to customize `content.js` to match your specific form structure:
- Update selectors to find your form fields
- Adjust the tab navigation sequence
- Modify dropdown/select handling
- Add file upload handling if needed

## File Structure

- `manifest.json` - Extension configuration
- `popup.html` - Extension popup UI
- `popup.js` - Popup logic and message handling
- `content.js` - Content script for form filling
- `background.js` - Service worker for file operations

## Permissions

The extension requires:
- `activeTab` - To interact with the current tab
- `storage` - To store settings (if needed)
- `downloads` - To download combined PDF files
- `scripting` - To inject content scripts
- Host permissions for Google Drive

