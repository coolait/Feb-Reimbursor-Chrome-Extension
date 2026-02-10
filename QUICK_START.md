# Quick Start Guide

## Step 1: Install Dependencies

```bash
pip install -r requirements.txt
```

## Step 2: Setup Google Sheets API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Sheets API**
4. Create credentials:
   - Go to **APIs & Services** > **Credentials**
   - Click **Create Credentials** > **OAuth client ID**
   - Choose **Desktop app** as the application type
   - Download the credentials JSON file
   - Save it as `credentials.json` in the project directory

## Step 3: Share Your Google Sheet

1. Open your Google Sheet
2. Click **Share** button
3. Share it with the email address from your credentials (you'll see it in the credentials.json file or when you first run the script)
4. Make sure to give it **Viewer** access at minimum

## Step 4: Configure the Script

1. Open `config.py`
2. Update `GOOGLE_SHEET_NAME` with your actual Google Sheet name
3. Update `WEB_FORM_URL` with the actual form URL (or provide it when running the script)
4. Find the correct form field selectors (see Step 5)

## Step 5: Find Form Field Selectors

Run the helper script to find the correct selectors:

```bash
python find_form_selectors.py "https://your-form-url.com"
```

This will:
- Open the form in a browser
- List all input fields, select dropdowns, and textareas
- Show you the CSS selectors for each field

Update `FIELD_MAPPINGS` in `config.py` with the correct selectors.

## Step 6: Run the Script

```bash
python feb_auto_reimburser.py "https://your-form-url.com"
```

Or without the URL (you'll be prompted):

```bash
python feb_auto_reimburser.py
```

## Step 7: Review and Submit

After each row is processed:
1. The browser will remain open
2. Review the filled form
3. Manually submit the form (the script doesn't submit automatically for safety)
4. Press Enter in the terminal to continue to the next row

## Troubleshooting

### Google Sheets API Issues

**Error: "Credentials file not found"**
- Make sure `credentials.json` is in the project directory
- Check that the file name is exactly `credentials.json`

**Error: "Error opening sheet 'Your Sheet Name'"**
- Verify the sheet name in `config.py` matches exactly
- Make sure the sheet is shared with the service account email
- Check that Google Sheets API is enabled in your Google Cloud project

### Form Field Issues

**Error: "Could not find field with selector"**
- Run `find_form_selectors.py` to find the correct selectors
- Update `FIELD_MAPPINGS` in `config.py`
- Check that the form HTML hasn't changed

**Fields not filling correctly**
- Check that the Google Sheet column names match exactly in `FIELD_MAPPINGS`
- Verify that the data types are correct (text, numbers, dates)
- Check the browser console for JavaScript errors

### Browser Issues

**Chrome driver not found**
- The script uses `webdriver-manager` to automatically download ChromeDriver
- Make sure Chrome browser is installed
- Check your internet connection (needed for first-time download)

**Browser opens but doesn't navigate**
- Check the form URL is correct
- Verify you have internet connectivity
- Check if the form requires login (you may need to log in manually first)

## Tips

1. **Test with one row first**: Update `PROCESS_ROW_START` in `config.py` to test with a single row
2. **Use headless mode for testing**: Set `HEADLESS = True` in `config.py` (but you won't be able to review the form)
3. **Check the console output**: The script provides detailed feedback about what it's doing
4. **Manual review is important**: Always review the filled form before submitting
5. **Backup your data**: Make sure you have a backup of your Google Sheet before running the script

## Example Configuration

```python
# config.py
GOOGLE_SHEET_NAME = "Reimbursement Requests"
GOOGLE_CREDENTIALS_FILE = "credentials.json"
GOOGLE_TOKEN_FILE = "token.json"

FIELD_MAPPINGS = {
    "First Name": {
        "selector": "input[name='first_name']",
        "type": "input",
        "required": True
    },
    "Last Name": {
        "selector": "input[name='last_name']",
        "type": "input",
        "required": True
    },
    # ... more mappings
}
```

## Next Steps

1. Customize the field mappings for your specific form
2. Add transformations for data cleaning (e.g., formatting dates, removing currency symbols)
3. Add error handling for specific edge cases
4. Set up logging to track processed rows
5. Consider adding a database to track which rows have been processed

