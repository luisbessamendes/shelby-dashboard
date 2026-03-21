# openpyxl Guide for Excel Operations

## Creating New Workbooks

### Basic Creation
```python
from openpyxl import Workbook

wb = Workbook()
sheet = wb.active
sheet.title = 'My Sheet'

# Add data
sheet['A1'] = 'Hello'
sheet['B1'] = 'World'

# Append rows
sheet.append(['Row', 'of', 'data'])
sheet.append([1, 2, 3])

wb.save('output.xlsx')
```

### Working with Multiple Sheets
```python
# Create new sheet
sheet2 = wb.create_sheet('Second Sheet')
sheet3 = wb.create_sheet('Third Sheet', 0)  # Insert at position 0

# Access sheets
sheet = wb['Sheet Name']
sheet = wb.active

# List all sheets
for name in wb.sheetnames:
    print(name)

# Remove sheet
wb.remove(sheet2)
```

## Loading Existing Workbooks

### Basic Loading
```python
from openpyxl import load_workbook

wb = load_workbook('existing.xlsx')
sheet = wb.active
```

### Loading Options
```python
# Read calculated values (WARNING: loses formulas on save)
wb = load_workbook('file.xlsx', data_only=True)

# Read-only mode (faster for large files)
wb = load_workbook('file.xlsx', read_only=True)

# Write-only mode (memory efficient)
wb = Workbook(write_only=True)
```

## Cell Operations

### Accessing Cells
```python
# By coordinate
cell = sheet['A1']
cell = sheet.cell(row=1, column=1)  # 1-indexed

# Get value
value = sheet['A1'].value

# Set value
sheet['A1'] = 'New Value'
sheet['A1'].value = 42
```

### Formulas
```python
# Add formula
sheet['B1'] = '=SUM(A1:A10)'
sheet['C1'] = '=A1*B1'
sheet['D1'] = '=AVERAGE(A:A)'

# Cross-sheet reference
sheet['E1'] = "='Other Sheet'!A1"

# Absolute references
sheet['F1'] = '=$A$1*B1'
```

### Ranges
```python
# Iterate over range
for row in sheet['A1:C3']:
    for cell in row:
        print(cell.value)

# Get range as tuple
cells = sheet['A1':'C3']

# Iterate by rows
for row in sheet.iter_rows(min_row=1, max_row=10, min_col=1, max_col=3):
    print([cell.value for cell in row])

# Iterate by columns
for col in sheet.iter_cols(min_row=1, max_row=10, min_col=1, max_col=3):
    print([cell.value for cell in col])
```

## Formatting

### Fonts
```python
from openpyxl.styles import Font

# Basic font
sheet['A1'].font = Font(name='Arial', size=12)

# Bold, italic, color
sheet['A1'].font = Font(bold=True, italic=True, color='FF0000')

# Financial model colors
sheet['A1'].font = Font(color='0000FF')  # Blue input
sheet['B1'].font = Font(color='000000')  # Black formula
sheet['C1'].font = Font(color='008000')  # Green internal link
sheet['D1'].font = Font(color='FF0000')  # Red external link
```

### Fills
```python
from openpyxl.styles import PatternFill

# Solid fill
sheet['A1'].fill = PatternFill('solid', start_color='FFFF00')

# Yellow highlight
sheet['A1'].fill = PatternFill('solid', start_color='FFFF00')

# Gray background
sheet['A1'].fill = PatternFill('solid', start_color='D3D3D3')
```

### Alignment
```python
from openpyxl.styles import Alignment

# Horizontal alignment
sheet['A1'].alignment = Alignment(horizontal='center')
sheet['B1'].alignment = Alignment(horizontal='right')

# Vertical alignment
sheet['A1'].alignment = Alignment(vertical='top')

# Wrap text
sheet['A1'].alignment = Alignment(wrap_text=True)
```

### Borders
```python
from openpyxl.styles import Border, Side

# Define border style
thin = Side(style='thin', color='000000')
border = Border(left=thin, right=thin, top=thin, bottom=thin)

sheet['A1'].border = border
```

### Number Formats
```python
# Currency
sheet['A1'].number_format = '$#,##0.00'

# Currency with zeros as dash
sheet['A1'].number_format = '$#,##0;($#,##0);-'

# Percentage
sheet['A1'].number_format = '0.0%'

# Date
sheet['A1'].number_format = 'yyyy-mm-dd'

# Multiple format
sheet['A1'].number_format = '0.0x'

# Text
sheet['A1'].number_format = '@'
```

## Column and Row Operations

### Dimensions
```python
# Set column width
sheet.column_dimensions['A'].width = 20

# Set row height
sheet.row_dimensions[1].height = 30

# Auto-size (approximate)
from openpyxl.utils import get_column_letter
for col in sheet.columns:
    max_length = 0
    column = col[0].column_letter
    for cell in col:
        if cell.value:
            max_length = max(max_length, len(str(cell.value)))
    sheet.column_dimensions[column].width = max_length + 2
```

### Insert/Delete
```python
# Insert rows
sheet.insert_rows(2, 3)  # Insert 3 rows at position 2

# Insert columns
sheet.insert_cols(2, 2)  # Insert 2 columns at position 2

# Delete rows
sheet.delete_rows(2, 3)  # Delete 3 rows starting at 2

# Delete columns
sheet.delete_cols(2, 2)  # Delete 2 columns starting at 2
```

## Comments
```python
from openpyxl.comments import Comment

# Add comment
sheet['A1'].comment = Comment(
    "This is a comment",
    "Author Name"
)

# Multi-line comment
sheet['A1'].comment = Comment(
    "Line 1\nLine 2\nLine 3",
    "Author"
)
```

## Important Notes

### Cell Indexing
- Cells are 1-indexed: `sheet.cell(row=1, column=1)` refers to A1
- Use `get_column_letter()` to convert column number to letter:
  ```python
  from openpyxl.utils import get_column_letter
  letter = get_column_letter(64)  # Returns 'BL'
  ```

### Data-Only Mode Warning
```python
# WARNING: This loses formulas when saved
wb = load_workbook('file.xlsx', data_only=True)
# ... modify ...
wb.save('file.xlsx')  # Formulas are now gone!
```

### Formula Recalculation
openpyxl stores formulas as strings but doesn't calculate them. Use `scripts/recalc.py` to update values:
```bash
python scripts/recalc.py output.xlsx
```
