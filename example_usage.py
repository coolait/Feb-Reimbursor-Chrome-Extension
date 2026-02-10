"""
Example usage of the FEB Auto Reimbursement Automation

This script demonstrates how to use the automation programmatically.
"""

from feb_auto_reimburser import ReimbursementAutomation
from config import GOOGLE_SHEET_NAME, WEB_FORM_URL

def main():
    """Example usage of the automation."""
    
    # Create automation instance
    automation = ReimbursementAutomation()
    
    # Example 1: Process all rows
    try:
        automation.run(WEB_FORM_URL)
    except Exception as e:
        print(f"Error: {str(e)}")
    finally:
        # Cleanup is handled in the run method
        pass

def process_single_row(row_number: int, form_url: str):
    """Process a single row from the Google Sheet."""
    
    # Create automation instance
    automation = ReimbursementAutomation()
    
    try:
        # Get row data
        row_data = automation.sheets_reader.get_row_data(GOOGLE_SHEET_NAME, row_number)
        
        # Process the row
        automation.process_row(row_data, row_number, form_url)
    except Exception as e:
        print(f"Error processing row {row_number}: {str(e)}")
    finally:
        if automation.form_filler:
            automation.form_filler.close()

def process_range(start_row: int, end_row: int, form_url: str):
    """Process a range of rows."""
    
    # Create automation instance
    automation = ReimbursementAutomation()
    
    try:
        # Get all records
        all_records = automation.sheets_reader.get_all_records(GOOGLE_SHEET_NAME)
        
        # Process rows in range
        for i, record in enumerate(all_records, start=2):  # Start at row 2 (after header)
            if start_row <= i <= end_row:
                try:
                    automation.process_row(record, i, form_url)
                except Exception as e:
                    print(f"Error processing row {i}: {str(e)}")
                    continue
    except Exception as e:
        print(f"Error: {str(e)}")
    finally:
        if automation.form_filler:
            automation.form_filler.close()

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "single":
            # Process a single row
            row_number = int(sys.argv[2]) if len(sys.argv) > 2 else 2
            form_url = sys.argv[3] if len(sys.argv) > 3 else WEB_FORM_URL
            process_single_row(row_number, form_url)
        elif sys.argv[1] == "range":
            # Process a range of rows
            start_row = int(sys.argv[2]) if len(sys.argv) > 2 else 2
            end_row = int(sys.argv[3]) if len(sys.argv) > 3 else 10
            form_url = sys.argv[4] if len(sys.argv) > 4 else WEB_FORM_URL
            process_range(start_row, end_row, form_url)
        else:
            # Default: process all rows
            form_url = sys.argv[1] if len(sys.argv) > 1 else WEB_FORM_URL
            main()
    else:
        # Default: process all rows
        main()

