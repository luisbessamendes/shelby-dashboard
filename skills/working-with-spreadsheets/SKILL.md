---
name: working-with-spreadsheets
description: Use when working with spreadsheet files (.xlsx, .xlsm, .csv, .tsv). Handles creating, reading, editing, formatting, and fixing spreadsheet files. Trigger when user references a spreadsheet file by name or wants to create/modify tabular data in Excel format. Do NOT use for Word documents, HTML reports, or database pipelines.
---

# Working with Spreadsheets

## When to use this skill
- Creating new Excel/CSV files from scratch or data sources
- Reading, editing, or fixing existing .xlsx, .xlsm, .csv, or .tsv files
- Adding columns, formulas, formatting, or charts to spreadsheets
- Cleaning messy tabular data (malformed rows, misplaced headers)
- Converting between tabular file formats
- User references a spreadsheet file by name or path

## Workflow

1. **Identify Task Type**
   - Data analysis? → Use pandas
   - Formulas/formatting? → Use openpyxl
   - Both? → Combine tools

2. **Create or Load File**
   - New: Create workbook with openpyxl
   - Existing: Load with openpyxl or pandas

3. **Modify Content**
   - Add data, formulas, formatting
   - **CRITICAL**: Use Excel formulas, not hardcoded values

4. **Save File**
   - Write to .xlsx, .csv, or other format

5. **Recalculate Formulas (MANDATORY if using formulas)**
   ```bash
   python scripts/recalc.py output.xlsx
   ```

6. **Verify and Fix Errors**
   - Check script output for formula errors
   - Fix any #REF!, #DIV/0!, #VALUE!, etc.
   - Recalculate again until zero errors

## Instructions

### CRITICAL: Use Formulas, Not Hardcoded Values

**Always use Excel formulas instead of calculating in Python.**

❌ **WRONG:**
```python
total = df['Sales'].sum()
sheet['B10'] = total  # Hardcoded value
```

✅ **CORRECT:**
```python
sheet['B10'] = '=SUM(B2:B9)'  # Excel formula
```

### Library Selection
- **pandas**: Data analysis, bulk operations, simple export
- **openpyxl**: Formulas, formatting, Excel-specific features

### Creating New Files

```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

wb = Workbook()
sheet = wb.active

# Add data and formulas
sheet['A1'] = 'Revenue'
sheet['B1'] = '=SUM(B2:B10)'

# Formatting
sheet['A1'].font = Font(bold=True)
sheet['A1'].fill = PatternFill('solid', start_color='FFFF00')

wb.save('output.xlsx')
```

### Editing Existing Files

```python
from openpyxl import load_workbook

wb = load_workbook('existing.xlsx')
sheet = wb.active

# Modify
sheet['A1'] = 'New Value'
sheet.insert_rows(2)

wb.save('modified.xlsx')
```

### Recalculating Formulas

```bash
python scripts/recalc.py output.xlsx 30
```

**Output interpretation:**
```json
{
  "status": "errors_found",
  "total_errors": 2,
  "error_summary": {
    "#REF!": {
      "count": 2,
      "locations": ["Sheet1!B5", "Sheet1!C10"]
    }
  }
}
```

### Formula Verification Checklist
- [ ] Test 2-3 sample references before building full model
- [ ] Verify Excel column mapping (column 64 = BL, not BK)
- [ ] Remember Excel rows are 1-indexed (DataFrame row 5 = Excel row 6)
- [ ] Check for NaN/null values with `pd.notna()`
- [ ] Test edge cases (zero, negative, large values)
- [ ] Verify all cell references exist

## Professional Standards

### All Excel Files
- **Professional Font**: Arial or Times New Roman (unless specified)
- **Zero Formula Errors**: Deliver with ZERO #REF!, #DIV/0!, #VALUE!, #N/A, #NAME?
- **Preserve Templates**: Match existing format/style when updating files

### Financial Models
See [resources/financial-models.md](resources/financial-models.md) for:
- Color coding standards (blue inputs, black formulas, green links, red external)
- Number formatting (currency, percentages, zeros as "-")
- Formula construction rules
- Documentation requirements

## Resources
- [resources/financial-models.md](resources/financial-models.md) - Financial modeling standards
- [resources/pandas-guide.md](resources/pandas-guide.md) - Data analysis with pandas
- [resources/openpyxl-guide.md](resources/openpyxl-guide.md) - Excel operations with openpyxl
- [resources/common-errors.md](resources/common-errors.md) - Troubleshooting formula errors
