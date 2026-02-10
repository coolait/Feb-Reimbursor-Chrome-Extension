"""
Helper script to find CSS selectors for form fields.
Opens the form in a browser and helps identify field selectors.
"""

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import time


def find_form_selectors(form_url: str):
    """Find CSS selectors for all form fields on the page."""
    
    # Setup Chrome driver
    options = Options()
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    
    try:
        print(f"Opening form: {form_url}")
        driver.get(form_url)
        time.sleep(3)  # Wait for page to load
        
        print("\n" + "="*60)
        print("Finding form fields...")
        print("="*60 + "\n")
        
        # Find all input fields
        inputs = driver.find_elements(By.TAG_NAME, "input")
        print(f"Found {len(inputs)} input fields:\n")
        
        for i, input_field in enumerate(inputs, 1):
            try:
                name = input_field.get_attribute("name")
                id_attr = input_field.get_attribute("id")
                type_attr = input_field.get_attribute("type")
                placeholder = input_field.get_attribute("placeholder")
                label = None
                
                # Try to find associated label
                if id_attr:
                    try:
                        label = driver.find_element(By.CSS_SELECTOR, f"label[for='{id_attr}']")
                        label_text = label.text
                    except:
                        pass
                
                if not label and name:
                    try:
                        label = driver.find_element(By.XPATH, f"//label[contains(., '{name}')]")
                        label_text = label.text
                    except:
                        pass
                
                # Generate selectors
                selectors = []
                if id_attr:
                    selectors.append(f"#{id_attr}")
                if name:
                    selectors.append(f"input[name='{name}']")
                if placeholder:
                    selectors.append(f"input[placeholder='{placeholder}']")
                
                print(f"Input {i}:")
                print(f"  Type: {type_attr}")
                print(f"  Name: {name}")
                print(f"  ID: {id_attr}")
                print(f"  Placeholder: {placeholder}")
                if label:
                    print(f"  Label: {label_text}")
                print(f"  Selectors: {', '.join(selectors) if selectors else 'None'}")
                print()
            
            except Exception as e:
                print(f"  Error reading input {i}: {str(e)}")
        
        # Find all select dropdowns
        selects = driver.find_elements(By.TAG_NAME, "select")
        print(f"\nFound {len(selects)} select dropdowns:\n")
        
        for i, select_field in enumerate(selects, 1):
            try:
                name = select_field.get_attribute("name")
                id_attr = select_field.get_attribute("id")
                
                # Generate selectors
                selectors = []
                if id_attr:
                    selectors.append(f"#{id_attr}")
                if name:
                    selectors.append(f"select[name='{name}']")
                
                print(f"Select {i}:")
                print(f"  Name: {name}")
                print(f"  ID: {id_attr}")
                print(f"  Selectors: {', '.join(selectors) if selectors else 'None'}")
                print()
            
            except Exception as e:
                print(f"  Error reading select {i}: {str(e)}")
        
        # Find all textareas
        textareas = driver.find_elements(By.TAG_NAME, "textarea")
        print(f"\nFound {len(textareas)} textarea fields:\n")
        
        for i, textarea_field in enumerate(textareas, 1):
            try:
                name = textarea_field.get_attribute("name")
                id_attr = textarea_field.get_attribute("id")
                placeholder = textarea_field.get_attribute("placeholder")
                
                # Generate selectors
                selectors = []
                if id_attr:
                    selectors.append(f"#{id_attr}")
                if name:
                    selectors.append(f"textarea[name='{name}']")
                if placeholder:
                    selectors.append(f"textarea[placeholder='{placeholder}']")
                
                print(f"Textarea {i}:")
                print(f"  Name: {name}")
                print(f"  ID: {id_attr}")
                print(f"  Placeholder: {placeholder}")
                print(f"  Selectors: {', '.join(selectors) if selectors else 'None'}")
                print()
            
            except Exception as e:
                print(f"  Error reading textarea {i}: {str(e)}")
        
        print("\n" + "="*60)
        print("Keep browser open to inspect the page manually.")
        print("Press Enter when done...")
        print("="*60)
        input()
    
    finally:
        driver.quit()


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        form_url = sys.argv[1]
    else:
        form_url = input("Enter the form URL: ")
    
    find_form_selectors(form_url)

