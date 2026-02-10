"""
Simple script to press Alt+Tab, move mouse to center, and click
"""

import pyautogui
import time
from pathlib import Path
from combine_drive_files import process_file, combine_pdfs

def parse_row_input(row_text):
    """
    Parse a tab-separated row from Google Sheets into individual values.
    Returns a list of values (empty strings for empty cells).
    """
    # Split by tab characters
    values = row_text.strip().split('\t')
    # Return list of values (index 0-based, but Value numbers are 1-based)
    return values

# Get input from user
print("Please paste the row from Google Sheets and press Enter:")
row_input = input().strip()

# Parse the input
values = parse_row_input(row_input)

# Map values (Value numbers are 1-based, but list is 0-based, so Value N = index N-1)
# Value 2 = index 1, Value 8 = index 7, etc.
# Extract values with safe indexing (use empty string if index doesn't exist)
def get_value(index):
    """Get value at 1-based index (Value N), returns empty string if not found"""
    if index - 1 < len(values):
        return values[index - 1].strip()
    return ""

def get_month_name_from_date(date_string):
    """
    Extract month name from a date string in format 'month/day/year'.
    Returns the month name (e.g., 'January', 'February', etc.)
    Returns 'Unknown' if date format is invalid.
    """
    if not date_string:
        return "Unknown"
    
    try:
        # Split the date string by '/'
        parts = date_string.split('/')
        if len(parts) >= 1:
            month_num = int(parts[0])
            # Map month number to month name
            months = {
                1: "January", 2: "February", 3: "March", 4: "April",
                5: "May", 6: "June", 7: "July", 8: "August",
                9: "September", 10: "October", 11: "November", 12: "December"
            }
            return months.get(month_num, "Unknown")
    except (ValueError, IndexError):
        return "Unknown"
    
    return "Unknown"

# Press Alt+Tab
pyautogui.hotkey('alt', 'tab')
time.sleep(0.5)  # Wait a bit for window switch



# Start

pyautogui.moveTo(500, 493)
time.sleep(0.2) 
pyautogui.click()

# Name
pyautogui.write(get_value(8)) # Value 8 - First Name
date_value = get_value(18)  # Value 18 - Date of Expense
month_name = get_month_name_from_date(date_value)
pyautogui.write(" - " + month_name)

# Amount
pyautogui.press('tab')
pyautogui.press('tab')
pyautogui.write(get_value(2))  # Value 2 - Amount

#Categories
pyautogui.press('tab')
pyautogui.press('enter')
pyautogui.press('down')
pyautogui.press('down')
pyautogui.press('down')
pyautogui.press('down')
pyautogui.press('enter')

#Account
pyautogui.press('tab')
pyautogui.press('enter')
time.sleep(0.5) 
pyautogui.moveTo(740, 700)
time.sleep(0.5) 
pyautogui.click()

#First Name
time.sleep(0.5) 
pyautogui.moveTo(500, 1090)
time.sleep(0.5) 
pyautogui.click()
pyautogui.write(get_value(8))  # Value 8 - First Name

#Last Name
pyautogui.press('tab')
pyautogui.write(get_value(9))  # Value 9 - Last Name

#Address
pyautogui.press('tab')
pyautogui.write(get_value(10))  # Value 10 - Address
pyautogui.press('tab')
pyautogui.write(get_value(11))  # Value 11 - APT
pyautogui.press('tab')
pyautogui.write(get_value(12))  # Value 12 - City
pyautogui.press('tab')
pyautogui.write(get_value(13))  # Value 13 - State
pyautogui.press('tab')
pyautogui.write(get_value(14))  # Value 14 - ZIP

#UID
pyautogui.press('tab')
pyautogui.press('tab')
pyautogui.press('tab')
pyautogui.press('tab')
pyautogui.press('tab')
pyautogui.press('tab')
pyautogui.write(get_value(15))  # Value 15 - UID
time.sleep(0.5) 
pyautogui.moveTo(423, 600)
time.sleep(0.5)  
pyautogui.click()

#Email
pyautogui.press('tab')
pyautogui.press('tab')
pyautogui.press('tab')
pyautogui.press('tab')
pyautogui.press('tab')
pyautogui.write(get_value(16))  # Value 16 - Email

#Phone
pyautogui.press('tab')
pyautogui.write(get_value(17))  # Value 17 - Phone

#Expenditure Action
pyautogui.press('tab')
pyautogui.press('enter')
pyautogui.press('down')
pyautogui.press('down')
pyautogui.press('down')
pyautogui.press('enter')

#Direct Deposit
pyautogui.press('tab')
pyautogui.press('tab')
pyautogui.press('tab')
pyautogui.press('tab')
pyautogui.press('tab')
pyautogui.press('enter')
pyautogui.press('down')
pyautogui.press('enter')

n=17
while True:
    if n ==17 or get_value(n) == "Yes":
        #Date of Expense
        if n == 17:
            pyautogui.press('tab')
            pyautogui.press('tab')
        pyautogui.press('tab')
        pyautogui.write(get_value(n+1))  # Value 18 - Date of Expense

        #Type of Expense
        pyautogui.press('tab')
        pyautogui.press('enter')
        pyautogui.press('down')
        pyautogui.press('down')
        pyautogui.press('down')
        pyautogui.press('down')
        pyautogui.press('down')
        time.sleep(0.2) 
        pyautogui.press('enter')

        #Vendor Name
        pyautogui.press('tab')
        pyautogui.write(get_value(n+3))  # Value 20 - Vendor Name

        #Location
        pyautogui.press('tab')
        pyautogui.write("Berkeley, CA")  # Value 19 - Location

        #Total Expense 1
        pyautogui.press('tab')
        pyautogui.press('tab')
        pyautogui.write(get_value(n+4))  # Value 21 - Total Expense

        # Combine Google Drive files (Value 22 and Value 23)
        link1 = get_value(n+5)  # Value 22 - First Google Drive link
        link2 = get_value(n+6)  # Value 23 - Second Google Drive link

        # Only combine if both links are provided
        if link1 and link2:
            print("\n" + "=" * 60)
            print("Combining Google Drive files...")
            print("=" * 60)
            
            try:
                # Get project directories
                project_dir = Path(__file__).parent.absolute()
                temp_dir = project_dir / "temp"
                outputs_dir = project_dir / "outputs"
                
                # Create directories if they don't exist
                temp_dir.mkdir(exist_ok=True)
                outputs_dir.mkdir(exist_ok=True)
                
                # Process both files
                pdf_paths = []
                
                print("Processing first file...")
                pdf1 = process_file(link1, str(temp_dir))
                pdf_paths.append(pdf1)
                
                print("\nProcessing second file...")
                pdf2 = process_file(link2, str(temp_dir))
                pdf_paths.append(pdf2)
                
                # Create output filename: "Value 8 - Value 2.pdf"
                first_name = get_value(8)  # Value 8 - First Name
                amount = get_value(2)      # Value 2 - Amount
                itom = int((n-9)/8)      # Value n - Item of Money
                output_filename = f"{first_name}-{amount}-{itom}.pdf"
                output_path = outputs_dir / output_filename
                
                # Combine PDFs
                print(f"\nCombining files into: {output_filename}")
                combine_pdfs(pdf_paths, str(output_path))
                
                print(f"\nSUCCESS! Combined PDF saved as: {output_path}")
                
                # Clean up temporary files
                print("\nCleaning up temporary files...")
                import shutil
                for file in temp_dir.glob("*"):
                    try:
                        if file.is_file():
                            file.unlink()
                    except Exception as e:
                        print(f"Warning: Could not delete {file}: {e}")
                print("Done!")
                
            except Exception as e:
                print(f"\nERROR combining files: {str(e)}")
                import traceback
                traceback.print_exc()
        else:
            print("\nSkipping file combination - one or both Google Drive links are missing.")
    else:
        break
    n += 8
    pyautogui.press('tab')
    pyautogui.press('tab')
    pyautogui.press('enter')
    time.sleep(0.5) 
    pyautogui.press('enter')
    pyautogui.moveTo(1800, 1000)
    time.sleep(1) 
    print("Clicking on the next item")
    pyautogui.click()
    time.sleep(2) 
    pyautogui.write(output_filename)
    pyautogui.press('enter')
    time.sleep(1)
    pyautogui.press('tab')
    pyautogui.press('enter')
    time.sleep(7)