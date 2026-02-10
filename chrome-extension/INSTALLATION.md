# Installation Instructions

## Step 1: Create Icon Files

Before installing, you need to create three icon files:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

You can:
1. Create simple colored squares in any image editor
2. Use online icon generators
3. Use placeholder images

Place these files in the `chrome-extension` folder.

## Step 2: Load the Extension

1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle switch in the top right corner)
4. Click "Load unpacked"
5. Select the `chrome-extension` folder from this project
6. The extension should now appear in your extensions list

## Step 3: Pin the Extension (Optional)

1. Click the puzzle piece icon in Chrome's toolbar
2. Find "FEB Auto Reimbursor" in the list
3. Click the pin icon to keep it visible in your toolbar

## Step 4: Usage

1. Navigate to the form page you want to fill
2. Click the extension icon in your Chrome toolbar
3. Paste the tab-separated row data from Google Sheets
4. Click "Process Row"
5. The extension will attempt to fill the form

## Important Notes

### Form Filling Limitations

Since the original Python script uses `pyautogui` to control the desktop (mouse movements, clicks at specific coordinates), the Chrome extension version works differently:

- **Browser-based forms**: The extension can fill web forms by manipulating DOM elements
- **Desktop applications**: Cannot be controlled by Chrome extensions
- **Coordinate-based clicks**: The extension tries to find elements by selectors instead of coordinates

You may need to customize the `content.js` file to match your specific form structure.

### PDF Combination

The PDF combination feature in `background.js` is simplified. For production use, consider:

1. **Using PDF-lib**: A browser-compatible PDF library
   ```javascript
   // You would need to add PDF-lib via a bundler or CDN
   import { PDFDocument } from 'pdf-lib';
   ```

2. **Backend Service**: Set up a server endpoint to handle PDF combination

3. **Manual Download**: Download files separately and combine manually

### Customization

You'll likely need to customize:
- `content.js`: Adjust form field selectors to match your actual form
- `popup.js`: Modify the UI if needed
- `background.js`: Improve PDF handling if needed

## Troubleshooting

- **Extension not loading**: Make sure all files are in the `chrome-extension` folder
- **Icons missing**: Create the three icon files (see Step 1)
- **Form not filling**: Check browser console (F12) for errors, and customize selectors in `content.js`
- **PDF combination not working**: This feature needs PDF-lib or a backend service for full functionality

