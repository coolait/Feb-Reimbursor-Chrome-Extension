"""
Configuration file for the FEB Auto Reimbursement automation.
Update these settings according to your Google Sheet and web form setup.
"""

# Google Sheets Configuration
GOOGLE_SHEET_NAME = "[FEB] 2025 - 2026 Master Budget"  # Update with your Google Sheet name
GOOGLE_SHEET_WORKBOOK_ID = None  # Optional: specify workbook ID if needed
GOOGLE_CREDENTIALS_FILE = "credentials.json"  # Path to your Google API credentials
GOOGLE_TOKEN_FILE = "token.json"  # Path to store OAuth token

# Web Form Configuration
WEB_FORM_URL = "https://your-form-url.com"  # Update with the actual form URL
WEB_FORM_BASE_URL = "https://portal.berkeley.edu"  # Base URL for the form

# Field Mapping: Google Sheet Column -> Web Form Field
# Update selectors based on the actual form HTML
# You can provide multiple selectors as a list - the script will try each one
FIELD_MAPPINGS = {
    # Request Details Section
    # Note: "Reason for purchasing" maps to Description field (see below)
    # Subject field can be mapped separately if needed
    "Total Amount": {
        "selector": "input[name='requested_amount']",
        "selectors": [
            "input[name='requested_amount']",
            "input[id='requested_amount']",
            "input[placeholder*='Requested Amount']"
        ],
        "type": "input",
        "required": True,
        "transform": lambda x: x.replace("$", "").replace(",", "").strip() if x else ""
    },
    "Requested amount": {
        "selector": "input[name='requested_amount']",
        "selectors": [
            "input[name='requested_amount']",
            "input[id='requested_amount']"
        ],
        "type": "input",
        "required": True,
        "transform": lambda x: x.replace("$", "").replace(",", "").strip() if x else ""
    },
    
    # Payee Information Section
    "First Name": {
        "selector": "input[name='first_name']",
        "selectors": [
            "input[name='first_name']",
            "input[id='first_name']",
            "input[name='firstName']"
        ],
        "type": "input",
        "required": True
    },
    "Last Name": {
        "selector": "input[name='last_name']",
        "selectors": [
            "input[name='last_name']",
            "input[id='last_name']",
            "input[name='lastName']"
        ],
        "type": "input",
        "required": True
    },
    "UID": {
        "selector": "input[name='uid']",
        "selectors": [
            "input[name='uid']",
            "input[id='uid']",
            "input[name='UID']",
            "input[type='text'][name*='uid']"
        ],
        "type": "input",
        "required": False
    },
    "Email Address": {
        "selector": "input[name='email']",
        "selectors": [
            "input[name='email']",
            "input[id='email']",
            "input[type='email']"
        ],
        "type": "input",
        "required": True
    },
    "Phone Number": {
        "selector": "input[name='phone']",
        "selectors": [
            "input[name='phone']",
            "input[id='phone']",
            "input[name='phone_number']",
            "input[type='tel']"
        ],
        "type": "input",
        "required": True
    },
    
    # Address Information Section
    "Street": {
        "selector": "input[name='street']",
        "selectors": [
            "input[name='street']",
            "input[id='street']",
            "input[name='address']"
        ],
        "type": "input",
        "required": True
    },
    "Street 2": {
        "selector": "input[name='street2']",
        "selectors": [
            "input[name='street2']",
            "input[id='street2']",
            "input[name='street_continued']",
            "input[name='address2']"
        ],
        "type": "input",
        "required": False
    },
    "City": {
        "selector": "input[name='city']",
        "selectors": [
            "input[name='city']",
            "input[id='city']"
        ],
        "type": "input",
        "required": True
    },
    "State/Province": {
        "selector": "input[name='state']",
        "selectors": [
            "input[name='state']",
            "input[id='state']",
            "input[name='state_province']",
            "select[name='state']"
        ],
        "type": "input",
        "required": True
    },
    "ZIP/Postal Code": {
        "selector": "input[name='zip']",
        "selectors": [
            "input[name='zip']",
            "input[id='zip']",
            "input[name='zip_code']",
            "input[name='postal_code']"
        ],
        "type": "input",
        "required": True
    },
    
    # Expense Details Section
    "Date of transaction": {
        "selector": "input[name='date_of_expense']",
        "selectors": [
            "input[name='date_of_expense']",
            "input[id='date_of_expense']",
            "input[name='date']",
            "input[type='date']"
        ],
        "type": "input",
        "required": True,
        "transform": lambda x: x.strftime("%Y-%m-%d") if hasattr(x, 'strftime') else str(x) if x else ""
    },
    "Name of vendor": {
        "selector": "input[name='vendor']",
        "selectors": [
            "input[name='vendor']",
            "input[id='vendor']",
            "input[name='vendor_name']"
        ],
        "type": "input",
        "required": True
    },
    # Description/Reason field - maps "Reason for purchasing" from sheet
    "Reason for purchasing": {
        "selector": "textarea[name='description']",
        "selectors": [
            "textarea[name='description']",
            "textarea[id='description']",
            "textarea[name='reason']",
            "input[name='reason']"
        ],
        "type": "textarea",
        "required": False
    },
}

# Browser Configuration
BROWSER = "chrome"  # Options: "chrome", "firefox", "edge"
HEADLESS = False  # Set to True to run browser in background
IMPLICIT_WAIT = 10  # Seconds to wait for elements to appear
EXPLICIT_WAIT = 20  # Seconds for explicit waits

# Processing Configuration
PROCESS_ROW_START = 2  # Row number to start processing (1-indexed, accounting for header)
PROCESS_ONLY_PENDING = True  # Only process rows where Stage is empty or "Pending"
STAGE_COLUMN = "D"  # Column letter for Stage

