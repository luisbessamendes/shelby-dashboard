# Common Excel Formula Errors

## Error Types and Solutions

### #REF! - Invalid Reference

**Cause:** Formula references a cell that doesn't exist or was deleted.

**Common Scenarios:**
```python
# Wrong: Column doesn't exist
sheet['A1'] = '=ZZ999'  # Column ZZ might not exist

# Wrong: Off-by-one error
for i in range(len(df)):
    sheet[f'B{i}'] = f'=A{i}*2'  # Should be i+2 (Excel is 1-indexed)
```

**Solution:**
```python
# Verify cell exists before referencing
if sheet['A1'].value is not None:
    sheet['B1'] = '=A1*2'

# Correct row indexing
for i in range(len(df)):
    excel_row = i + 2  # DataFrame row 0 = Excel row 2 (after header)
    sheet[f'B{excel_row}'] = f'=A{excel_row}*2'
```

---

### #DIV/0! - Division by Zero

**Cause:** Formula divides by zero or empty cell.

**Common Scenarios:**
```python
# Wrong: No zero check
sheet['C1'] = '=A1/B1'  # If B1 is 0, error
```

**Solution:**
```python
# Use IFERROR or IF to handle zeros
sheet['C1'] = '=IFERROR(A1/B1, 0)'
sheet['C1'] = '=IF(B1=0, 0, A1/B1)'

# Or check in Python before creating formula
if pd.notna(df.loc[i, 'denominator']) and df.loc[i, 'denominator'] != 0:
    sheet[f'C{i+2}'] = f'=A{i+2}/B{i+2}'
else:
    sheet[f'C{i+2}'] = 0
```

---

### #VALUE! - Wrong Data Type

**Cause:** Formula expects number but gets text, or vice versa.

**Common Scenarios:**
```python
# Wrong: Text in numeric formula
sheet['A1'] = 'abc'
sheet['B1'] = '=A1*2'  # Error: can't multiply text
```

**Solution:**
```python
# Ensure correct data types
sheet['A1'] = 123  # Number, not string
sheet['B1'] = '=A1*2'

# Or use VALUE() to convert
sheet['B1'] = '=VALUE(A1)*2'
```

---

### #NAME? - Unrecognized Formula

**Cause:** Typo in function name or missing quotes around text.

**Common Scenarios:**
```python
# Wrong: Typo in function name
sheet['A1'] = '=SUMM(B1:B10)'  # Should be SUM

# Wrong: Missing quotes
sheet['A1'] = '=IF(B1=Active, 1, 0)'  # Should be "Active"
```

**Solution:**
```python
# Correct function name
sheet['A1'] = '=SUM(B1:B10)'

# Add quotes around text
sheet['A1'] = '=IF(B1="Active", 1, 0)'
```

---

### #N/A - Value Not Available

**Cause:** VLOOKUP/XLOOKUP/MATCH can't find value.

**Common Scenarios:**
```python
# Wrong: Lookup value doesn't exist
sheet['A1'] = '=VLOOKUP("XYZ", B:C, 2, FALSE)'  # XYZ not in column B
```

**Solution:**
```python
# Use IFERROR to handle missing values
sheet['A1'] = '=IFERROR(VLOOKUP("XYZ", B:C, 2, FALSE), "Not Found")'

# Or use IFNA (Excel 2013+)
sheet['A1'] = '=IFNA(VLOOKUP("XYZ", B:C, 2, FALSE), "Not Found")'
```

---

## Debugging Workflow

### 1. Run Recalculation Script
```bash
python scripts/recalc.py output.xlsx
```

### 2. Analyze Output
```json
{
  "status": "errors_found",
  "total_errors": 5,
  "error_summary": {
    "#REF!": {
      "count": 2,
      "locations": ["Sheet1!B5", "Sheet1!C10"]
    },
    "#DIV/0!": {
      "count": 3,
      "locations": ["Sheet1!D2", "Sheet1!D3", "Sheet1!D4"]
    }
  }
}
```

### 3. Fix Errors
```python
# Load workbook
wb = load_workbook('output.xlsx')
sheet = wb['Sheet1']

# Fix #REF! errors - verify cell references
print(sheet['B5'].value)  # Check formula
sheet['B5'] = '=A5*2'  # Fix reference

# Fix #DIV/0! errors - add zero check
sheet['D2'] = '=IFERROR(B2/C2, 0)'

wb.save('output.xlsx')
```

### 4. Recalculate Again
```bash
python scripts/recalc.py output.xlsx
```

---

## Prevention Checklist

### Before Creating Formulas
- [ ] Verify all referenced cells exist
- [ ] Check DataFrame row to Excel row mapping (add 1 or 2)
- [ ] Verify column letters (use `get_column_letter()` for high columns)
- [ ] Test with sample data including edge cases

### Common Pitfalls
- [ ] **NaN values**: Check with `pd.notna()` before referencing
- [ ] **Zero denominators**: Use IFERROR or IF checks
- [ ] **Column mapping**: Column 64 is BL, not BK
- [ ] **Row offset**: DataFrame row 0 = Excel row 2 (with header)
- [ ] **Cross-sheet refs**: Use `'Sheet Name'!A1` format
- [ ] **Text vs numbers**: Ensure correct data types

### Testing Strategy
1. Test formulas on 2-3 cells first
2. Verify calculated values are correct
3. Run recalc script to check for errors
4. Only then apply to full range
