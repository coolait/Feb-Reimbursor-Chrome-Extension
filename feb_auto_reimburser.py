"""
FEB Auto Reimbursement Automation Script
Reads data from Google Sheets and automatically fills out the reimbursement form.
"""

import time
import json
from typing import Dict, List, Optional
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager
import gspread
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
import os
from config import (
    GOOGLE_SHEET_NAME,
    GOOGLE_CREDENTIALS_FILE,
    GOOGLE_TOKEN_FILE,
    FIELD_MAPPINGS,
    BROWSER,
    HEADLESS,
    IMPLICIT_WAIT,
    EXPLICIT_WAIT,
    PROCESS_ROW_START,
    PROCESS_ONLY_PENDING,
    STAGE_COLUMN,
)


class GoogleSheetsReader:
    """Handles reading data from Google Sheets."""
    
    SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
    
    def __init__(self, credentials_file: str, token_file: str):
        self.credentials_file = credentials_file
        self.token_file = token_file
        self.client = None
        self._authenticate()
    
    def _authenticate(self):
        """Authenticate with Google Sheets API."""
        creds = None
        
        # Load existing token
        if os.path.exists(self.token_file):
            creds = Credentials.from_authorized_user_file(self.token_file, self.SCOPES)
        
        # If no valid credentials, get new ones
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not os.path.exists(self.credentials_file):
                    raise FileNotFoundError(
                        f"Credentials file not found: {self.credentials_file}\n"
                        "Please download credentials.json from Google Cloud Console."
                    )
                flow = InstalledAppFlow.from_client_secrets_file(
                    self.credentials_file, self.SCOPES
                )
                creds = flow.run_local_server(port=0)
            
            # Save credentials for next run
            with open(self.token_file, 'w') as token:
                token.write(creds.to_json())
        
        self.client = gspread.authorize(creds)
    
    def get_sheet(self, sheet_name: str):
        """Get a Google Sheet by name."""
        try:
            return self.client.open(sheet_name).sheet1
        except Exception as e:
            raise Exception(f"Error opening sheet '{sheet_name}': {str(e)}")
    
    def get_all_records(self, sheet_name: str) -> List[Dict]:
        """Get all records from the sheet as a list of dictionaries."""
        sheet = self.get_sheet(sheet_name)
        return sheet.get_all_records()
    
    def get_row_data(self, sheet_name: str, row_number: int) -> Dict:
        """Get data from a specific row as a dictionary."""
        sheet = self.get_sheet(sheet_name)
        headers = sheet.row_values(1)
        row_values = sheet.row_values(row_number)
        
        # Pad row_values if it's shorter than headers
        while len(row_values) < len(headers):
            row_values.append("")
        
        return dict(zip(headers, row_values))


class FormFiller:
    """Handles filling out the web form."""
    
    def __init__(self, headless: bool = False):
        self.driver = None
        self.wait = None
        self.headless = headless
        self._setup_driver()
    
    def _setup_driver(self):
        """Setup Selenium WebDriver."""
        if BROWSER.lower() == "chrome":
            options = Options()
            if self.headless:
                options.add_argument("--headless")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-blink-features=AutomationControlled")
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option('useAutomationExtension', False)
            
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=options)
        else:
            raise ValueError(f"Browser {BROWSER} not supported yet")
        
        self.driver.implicitly_wait(IMPLICIT_WAIT)
        self.wait = WebDriverWait(self.driver, EXPLICIT_WAIT)
    
    def navigate_to_form(self, url: str):
        """Navigate to the form URL."""
        print(f"Navigating to: {url}")
        self.driver.get(url)
        time.sleep(2)  # Allow page to load
    
    def fill_field(self, selector: str, value: str, field_type: str = "input", required: bool = True):
        """Fill a form field with a value."""
        # Allow empty values for non-required fields
        if (not value or value.strip() == "") and required:
            return False
        
        # Skip empty optional fields
        if (not value or value.strip() == "") and not required:
            return True
        
        try:
            # Try multiple selector strategies
            selectors = [selector]
            if "name=" in selector:
                # Also try by ID if we have a name
                name_value = selector.split("name='")[1].split("'")[0] if "name='" in selector else None
                if name_value:
                    selectors.append(f"input[id='{name_value}']")
                    selectors.append(f"input[id*='{name_value}']")
            
            element = None
            for sel in selectors:
                try:
                    element = self.wait.until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, sel))
                    )
                    # Scroll to element to ensure it's visible
                    self.driver.execute_script("arguments[0].scrollIntoView(true);", element)
                    time.sleep(0.5)
                    break
                except TimeoutException:
                    continue
            
            if not element:
                print(f"  Warning: Could not find field with any selector: {selectors}")
                return False
            
            if field_type == "input":
                element.clear()
                element.send_keys(str(value))
                return True
            elif field_type == "select":
                select = Select(element)
                try:
                    select.select_by_visible_text(str(value))
                    return True
                except:
                    try:
                        select.select_by_value(str(value))
                        return True
                    except:
                        print(f"  Warning: Could not select option '{value}' in dropdown")
                        return False
            elif field_type == "textarea":
                element.clear()
                element.send_keys(str(value))
                return True
            elif field_type == "radio":
                if not element.is_selected():
                    element.click()
                return True
        except TimeoutException:
            print(f"  Warning: Could not find field with selector: {selector}")
            return False
        except Exception as e:
            print(f"  Error filling field {selector}: {str(e)}")
            return False
    
    def click_button(self, selector: str):
        """Click a button or link."""
        try:
            element = self.wait.until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
            )
            element.click()
            time.sleep(1)  # Wait for action to complete
            return True
        except TimeoutException:
            print(f"  Warning: Could not find button with selector: {selector}")
            return False
    
    def select_radio_button(self, selector: str):
        """Select a radio button."""
        try:
            element = self.wait.until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
            )
            if not element.is_selected():
                element.click()
            return True
        except TimeoutException:
            print(f"  Warning: Could not find radio button with selector: {selector}")
            return False
    
    def fill_form_from_data(self, data: Dict):
        """Fill the form using data from Google Sheets."""
        print("Filling form with data...")
        
        filled_count = 0
        failed_count = 0
        skipped_count = 0
        
        for sheet_column, field_config in FIELD_MAPPINGS.items():
            # Check condition if provided
            if "condition" in field_config:
                if not field_config["condition"](data):
                    skipped_count += 1
                    continue
            
            if sheet_column in data:
                value = data[sheet_column]
                
                # Skip if value is empty and field is optional
                required = field_config.get("required", True)
                if (not value or value.strip() == "") and not required:
                    skipped_count += 1
                    print(f"  - Skipping optional field {sheet_column} (empty)")
                    continue
                
                # Apply transformation if defined
                if "transform" in field_config and callable(field_config["transform"]):
                    try:
                        value = field_config["transform"](value)
                    except Exception as e:
                        print(f"  Warning: Error transforming {sheet_column}: {str(e)}")
                
                # Handle radio button selection
                if field_config.get("type") == "radio":
                    # Try multiple selectors if provided
                    selectors = field_config.get("selectors", [field_config["selector"]])
                    if isinstance(selectors, str):
                        selectors = [selectors]
                    
                    success = False
                    for sel in selectors:
                        if self.select_radio_button(sel):
                            filled_count += 1
                            print(f"  ✓ Selected {sheet_column}")
                            success = True
                            break
                    
                    if not success:
                        failed_count += 1
                        print(f"  ✗ Failed to select {sheet_column}")
                    continue
                
                # Fill the field
                field_type = field_config.get("type", "input")
                
                # Try multiple selectors if provided
                selectors = field_config.get("selectors", [field_config["selector"]])
                if isinstance(selectors, str):
                    selectors = [selectors]
                
                success = False
                for sel in selectors:
                    if self.fill_field(sel, value, field_type, required):
                        filled_count += 1
                        # Truncate long values in output
                        display_value = str(value)[:50] + "..." if len(str(value)) > 50 else str(value)
                        print(f"  ✓ Filled {sheet_column}: {display_value}")
                        success = True
                        break
                
                if not success:
                    failed_count += 1
                    print(f"  ✗ Failed to fill {sheet_column}")
            else:
                # Column not found in data
                if not field_config.get("required", True):
                    skipped_count += 1
                else:
                    failed_count += 1
                    print(f"  ✗ Column '{sheet_column}' not found in sheet data")
        
        print(f"\nSummary: {filled_count} filled, {failed_count} failed, {skipped_count} skipped")
        return filled_count
    
    def close(self):
        """Close the browser."""
        if self.driver:
            self.driver.quit()


class ReimbursementAutomation:
    """Main automation class that coordinates Google Sheets reading and form filling."""
    
    def __init__(self):
        self.sheets_reader = GoogleSheetsReader(
            GOOGLE_CREDENTIALS_FILE,
            GOOGLE_TOKEN_FILE
        )
        self.form_filler = None
    
    def process_row(self, row_data: Dict, row_number: int, form_url: str):
        """Process a single row from the Google Sheet."""
        print(f"\n{'='*60}")
        print(f"Processing Row {row_number}")
        print(f"{'='*60}")
        
        # Initialize form filler if not already done
        if not self.form_filler:
            self.form_filler = FormFiller(headless=HEADLESS)
        
        # Navigate to form
        self.form_filler.navigate_to_form(form_url)
        
        # Fill form with row data
        filled_count = self.form_filler.fill_form_from_data(row_data)
        
        if filled_count > 0:
            print(f"Successfully processed row {row_number}")
            return True
        else:
            print(f"Failed to process row {row_number}")
            return False
    
    def run(self, form_url: str, start_row: Optional[int] = None, max_rows: Optional[int] = None):
        """Run the automation for all rows in the Google Sheet."""
        print("Starting FEB Auto Reimbursement Automation")
        print(f"Reading from Google Sheet: {GOOGLE_SHEET_NAME}")
        
        try:
            # Get all records
            all_records = self.sheets_reader.get_all_records(GOOGLE_SHEET_NAME)
            
            if not all_records:
                print("No records found in the sheet.")
                return
            
            # Filter records if needed
            records_to_process = []
            start_idx = (start_row or PROCESS_ROW_START) - 2  # Convert to 0-indexed, accounting for header
            
            for i, record in enumerate(all_records, start=2):  # Start at row 2 (after header)
                if i < start_idx + 2:
                    continue
                
                if max_rows and len(records_to_process) >= max_rows:
                    break
                
                # Check if we should process this row
                if PROCESS_ONLY_PENDING:
                    stage = record.get("Stage", "").strip()
                    if stage and stage.lower() not in ["", "pending", "stage 1"]:
                        print(f"Skipping row {i}: Stage is '{stage}'")
                        continue
                
                records_to_process.append((i, record))
            
            print(f"Found {len(records_to_process)} rows to process")
            
            # Process each row
            for idx, (row_number, row_data) in enumerate(records_to_process):
                try:
                    success = self.process_row(row_data, row_number, form_url)
                    if success:
                        print(f"\nRow {row_number} processed successfully")
                        
                        # If this is the last row, wait for user to close
                        if idx == len(records_to_process) - 1:
                            print("\n" + "="*60)
                            print("All rows processed!")
                            print("="*60)
                            input("\nPress Enter to close the browser...")
                        else:
                            # Ask user if they want to continue to next row
                            print("\n" + "-"*60)
                            response = input(f"Continue to next row? (Press Enter to continue, or 'q' to quit): ")
                            if response.lower() == 'q':
                                print("Stopping automation...")
                                break
                            
                            # Navigate to form URL again for next row
                            print(f"Preparing for next row...")
                            self.form_filler.navigate_to_form(form_url)
                    else:
                        print(f"\nRow {row_number} processing failed")
                        response = input("\nContinue to next row? (y/n): ")
                        if response.lower() != 'y':
                            break
                except KeyboardInterrupt:
                    print("\n\nAutomation interrupted by user")
                    break
                except Exception as e:
                    print(f"\nError processing row {row_number}: {str(e)}")
                    import traceback
                    traceback.print_exc()
                    response = input("\nContinue to next row? (y/n): ")
                    if response.lower() != 'y':
                        break
        
        except Exception as e:
            print(f"\nError: {str(e)}")
            import traceback
            traceback.print_exc()
            raise
        finally:
            if self.form_filler:
                if self.form_filler.driver:
                    print("\nClosing browser...")
                    self.form_filler.close()


def main():
    """Main entry point."""
    import sys
    
    # Get form URL from command line or use default
    form_url = sys.argv[1] if len(sys.argv) > 1 else input("Enter the form URL: ")
    
    # Create automation instance
    automation = ReimbursementAutomation()
    
    try:
        # Run automation
        automation.run(form_url)
    except KeyboardInterrupt:
        print("\n\nAutomation interrupted by user")
    except Exception as e:
        print(f"\n\nError: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()

