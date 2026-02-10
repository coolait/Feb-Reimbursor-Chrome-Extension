# FEB Auto Reimbursement Automation

This script automatically reads data from a Google Sheet and fills out the reimbursement form on the Berkeley portal website.

## Features

- Reads data from Google Sheets
- Automatically fills out web forms
- Maps Google Sheet columns to form fields
- Handles authentication and session management
- Processes multiple rows with pause between entries

## Setup Instructions

### 1. Prerequisites

- Python 3.8 or higher
- Google Chrome browser installed
- Google API credentials (credentials.json)

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Google Sheets API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Sheets API
4. Create credentials (OAuth 2.0 Client ID)
5. Download the credentials JSON file and save it as `credentials.json` in the project directory

### 4. Configuration

1. Open `config.py` and update the following:
   - `GOOGLE_SHEET_NAME`: Name of your Google Sheet
   - `GOOGLE_CREDENTIALS_FILE`: Path to your credentials.json file
   - `WEB_FORM_URL`: URL of the reimbursement form
   - `FIELD_MAPPINGS`: Map Google Sheet columns to form field selectors

2. To find the correct selectors for form fields:
   - Use the `find_form_selectors.py` script (see below)
   - Or inspect the form HTML in your browser

### 5. Finding Form Selectors

Run the helper script to find form field selectors:

```bash
python find_form_selectors.py
```

This will open the form in a browser and help you identify the correct CSS selectors for each field.

## Usage

### Basic Usage

```bash
python feb_auto_reimburser.py <form_url>
```

Example:
```bash
python feb_auto_reimburser.py "https://portal.berkeley.edu/forms/reimbursement"
```

### Command Line Options

- The script will prompt for the form URL if not provided
- It will process rows starting from row 2 (after header)
- Only processes rows where Stage is empty or "Pending" (configurable)

### Processing Flow

1. Authenticates with Google Sheets API
2. Reads data from the specified Google Sheet
3. Filters rows based on configuration
4. For each row:
   - Opens the form in a browser
   - Fills out all fields using data from the Google Sheet
   - Waits for user review/submission
   - Moves to next row

### Manual Review

After each row is filled:
- The browser will remain open for you to review the form
- You can manually submit the form
- Press Enter in the terminal to continue to the next row

## Configuration Options

### config.py Settings

- `GOOGLE_SHEET_NAME`: Name of your Google Sheet
- `PROCESS_ROW_START`: Row number to start processing (default: 2)
- `PROCESS_ONLY_PENDING`: Only process pending rows (default: True)
- `HEADLESS`: Run browser in background (default: False)
- `IMPLICIT_WAIT`: Wait time for elements (default: 10 seconds)
- `EXPLICIT_WAIT`: Maximum wait time (default: 20 seconds)

### Field Mappings

Update `FIELD_MAPPINGS` in `config.py` to map Google Sheet columns to form field selectors:

```python
FIELD_MAPPINGS = {
    "Google Sheet Column Name": {
        "selector": "css_selector_for_form_field",
        "type": "input",  # or "select", "textarea"
        "transform": lambda x: x.replace("$", "").strip()  # optional transformation
    },
    # ... more mappings
}
```

## Troubleshooting

### Common Issues

1. **Google Sheets API Authentication Error**
   - Ensure `credentials.json` is in the project directory
   - Check that Google Sheets API is enabled in your Google Cloud project
   - Delete `token.json` and re-authenticate

2. **Form Field Not Found**
   - Run `find_form_selectors.py` to find correct selectors
   - Update `FIELD_MAPPINGS` in `config.py`
   - Check that the form HTML hasn't changed

3. **Browser Not Opening**
   - Ensure Chrome is installed
   - Check that ChromeDriver is up to date
   - Try running without headless mode first

4. **Sheet Not Found**
   - Verify the sheet name in `config.py`
   - Ensure the sheet is shared with the service account email
   - Check that you have read permissions

## Notes

- The script will pause between rows for manual review
- You can interrupt the script with Ctrl+C
- The browser will remain open until you close it
- Make sure to review each form before submitting

## Support

For issues or questions:
1. Check the troubleshooting section
2. Verify your configuration
3. Check the console output for error messages

