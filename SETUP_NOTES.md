# Setup Notes

## Important: UID Radio Button Handling

Based on the form structure, when a UID is provided, you need to:
1. Select the "YES" radio button for "Is payee a UC Berkeley Student or Faculty/Staff Member?"
2. Then fill in the UID field

To handle this automatically, you can add the following to your `FIELD_MAPPINGS` in `config.py`:

```python
"UID_Radio_Yes": {
    "selector": "input[type='radio'][value='yes']",
    "selectors": [
        "input[type='radio'][name*='uid'][value*='yes']",
        "input[type='radio'][name*='student'][value*='yes']",
        "input[type='radio'][id*='uid'][value*='yes']"
    ],
    "type": "radio",
    "required": False,
    "condition": lambda data: data.get("UID", "").strip() != ""
},
```

This will automatically select the "YES" radio button only if a UID is present in the data.

**Note**: The `condition` field checks if UID exists before trying to select the radio button. Make sure this entry comes **before** the UID input field in `FIELD_MAPPINGS` so the radio button is selected first.

## Field Mapping Order

The order of fields in `FIELD_MAPPINGS` matters for some forms. For example:
1. Radio buttons should be selected before related input fields
2. Dropdowns that enable/disable other fields should be filled first
3. Required fields should be filled before optional fields

## Common Field Selectors

Based on the form structure, here are common selectors you might need:

### Radio Buttons
- `input[type='radio'][value='yes']` - Select "YES" option
- `input[type='radio'][value='no']` - Select "NO" option
- `input[type='radio'][name='field_name'][value='value']` - More specific

### Dropdowns
- `select[name='field_name']` - Standard dropdown
- `select[id='field_id']` - By ID
- Note: For dropdowns, use `"type": "select"` in the config

### Input Fields
- `input[name='field_name']` - Standard input
- `input[id='field_id']` - By ID
- `input[type='email']` - Email input
- `input[type='tel']` - Phone input
- `input[type='date']` - Date input

### Textareas
- `textarea[name='field_name']` - Standard textarea
- `textarea[id='field_id']` - By ID

## Data Transformations

You can add transformations to clean or format data:

```python
"Total Amount": {
    "selector": "input[name='amount']",
    "type": "input",
    "transform": lambda x: x.replace("$", "").replace(",", "").strip() if x else ""
}
```

Common transformations:
- Remove currency symbols: `lambda x: x.replace("$", "").replace(",", "").strip() if x else ""`
- Format dates: `lambda x: x.strftime("%Y-%m-%d") if hasattr(x, 'strftime') else str(x)`
- Clean phone numbers: `lambda x: ''.join(filter(str.isdigit, str(x))) if x else ""`

## Testing

1. **Test with one row first**: Set `PROCESS_ROW_START` to test with a single row
2. **Check console output**: The script provides detailed feedback
3. **Verify field mappings**: Use `find_form_selectors.py` to verify selectors
4. **Test transformations**: Make sure data transformations work correctly
5. **Test edge cases**: Empty fields, special characters, long text, etc.

## Troubleshooting Common Issues

### Fields not filling
- Check that selectors are correct (use `find_form_selectors.py`)
- Verify column names match exactly (case-sensitive)
- Check if fields are disabled or hidden
- Verify that the form has loaded completely

### Radio buttons not selecting
- Check that the selector matches the actual radio button
- Verify the value attribute matches
- Try using XPath instead of CSS selector if needed

### Dropdowns not selecting
- Check that the option text matches exactly
- Try using option value instead of text
- Verify the dropdown is enabled and visible

### Data formatting issues
- Check transformations are working correctly
- Verify data types match expected format
- Check for special characters that might cause issues

## Security Notes

1. **Credentials**: Never commit `credentials.json` or `token.json` to version control
2. **Data privacy**: Be careful with sensitive data in Google Sheets
3. **Form submission**: The script doesn't automatically submit forms - manual review is required
4. **Permissions**: Only grant necessary permissions to the Google API credentials

## Performance Tips

1. **Batch processing**: Process multiple rows in one session
2. **Headless mode**: Use headless mode for faster processing (but you can't review)
3. **Wait times**: Adjust `IMPLICIT_WAIT` and `EXPLICIT_WAIT` based on form load time
4. **Error handling**: The script continues to next row on errors (configurable)

## Next Steps

1. Customize field mappings for your specific form
2. Add error handling for edge cases
3. Set up logging to track processed rows
4. Consider adding a database to track processing status
5. Add validation for data before filling forms
6. Consider adding email notifications for completed processing

