# Financial Modeling Standards

## Color Coding Standards

Unless otherwise stated by user or existing template:

### Industry-Standard Color Conventions
- **Blue text (RGB: 0,0,255)**: Hardcoded inputs, numbers users will change for scenarios
- **Black text (RGB: 0,0,0)**: ALL formulas and calculations
- **Green text (RGB: 0,128,0)**: Links pulling from other worksheets within same workbook
- **Red text (RGB: 255,0,0)**: External links to other files
- **Yellow background (RGB: 255,255,0)**: Key assumptions needing attention or cells requiring updates

### Implementation
```python
from openpyxl.styles import Font, PatternFill

# Blue input
sheet['A1'].font = Font(color='0000FF')

# Black formula
sheet['B1'].font = Font(color='000000')

# Green internal link
sheet['C1'].font = Font(color='008000')

# Red external link
sheet['D1'].font = Font(color='FF0000')

# Yellow highlight
sheet['E1'].fill = PatternFill('solid', start_color='FFFF00')
```

## Number Formatting Standards

### Required Format Rules
- **Years**: Format as text strings (e.g., "2024" not "2,024")
- **Currency**: Use $#,##0 format; ALWAYS specify units in headers ("Revenue ($mm)")
- **Zeros**: Use number formatting to make all zeros "-", including percentages
  - Format: `$#,##0;($#,##0);-`
- **Percentages**: Default to 0.0% format (one decimal)
- **Multiples**: Format as 0.0x for valuation multiples (EV/EBITDA, P/E)
- **Negative numbers**: Use parentheses (123) not minus -123

### Implementation
```python
# Currency with zeros as dash
sheet['A1'].number_format = '$#,##0;($#,##0);-'

# Percentage with one decimal
sheet['B1'].number_format = '0.0%'

# Multiple format
sheet['C1'].number_format = '0.0x'

# Year as text
sheet['D1'] = "'2024"  # Leading apostrophe forces text
```

## Formula Construction Rules

### Assumptions Placement
Place ALL assumptions (growth rates, margins, multiples) in separate assumption cells. Use cell references instead of hardcoded values.

❌ **WRONG:**
```python
sheet['B5'] = '=B4*1.05'  # Hardcoded 5% growth
```

✅ **CORRECT:**
```python
sheet['B2'] = 0.05  # Assumption cell
sheet['B2'].font = Font(color='0000FF')  # Blue for input
sheet['B5'] = '=B4*(1+$B$2)'  # Reference assumption
```

### Formula Error Prevention
- Verify all cell references are correct
- Check for off-by-one errors in ranges
- Ensure consistent formulas across projection periods
- Test with edge cases (zero, negative numbers)
- Verify no unintended circular references

### Documentation Requirements for Hardcodes

Comment in cells or beside (if end of table):

**Format:** "Source: [System/Document], [Date], [Specific Reference], [URL if applicable]"

**Examples:**
- "Source: Company 10-K, FY2024, Page 45, Revenue Note, [SEC EDGAR URL]"
- "Source: Company 10-Q, Q2 2025, Exhibit 99.1, [SEC EDGAR URL]"
- "Source: Bloomberg Terminal, 8/15/2025, AAPL US Equity"
- "Source: FactSet, 8/20/2025, Consensus Estimates Screen"

### Implementation
```python
from openpyxl.comments import Comment

# Add comment to cell
sheet['A1'].comment = Comment(
    "Source: Company 10-K, FY2024, Page 45, Revenue Note",
    "Author"
)
```

## Common Financial Model Patterns

### Revenue Build
```python
# Assumptions
sheet['B2'] = 'Base Revenue'
sheet['C2'] = 1000000
sheet['C2'].font = Font(color='0000FF')

sheet['B3'] = 'Growth Rate'
sheet['C3'] = 0.15
sheet['C3'].number_format = '0.0%'
sheet['C3'].font = Font(color='0000FF')

# Projection years
sheet['D1'] = '2024'
sheet['E1'] = '2025'
sheet['F1'] = '2026'

# Revenue formula
sheet['D5'] = '=C2'  # Base year
sheet['E5'] = '=D5*(1+$C$3)'  # Year 1
sheet['F5'] = '=E5*(1+$C$3)'  # Year 2
```

### Three-Statement Model Structure
```python
# Income Statement
income_sheet = wb.create_sheet('Income Statement')
income_sheet['A1'] = 'Revenue'
income_sheet['A2'] = 'COGS'
income_sheet['A3'] = 'Gross Profit'
income_sheet['B3'] = '=B1-B2'

# Balance Sheet
balance_sheet = wb.create_sheet('Balance Sheet')
balance_sheet['A1'] = 'Cash'
balance_sheet['B1'] = "='Cash Flow'!B10"  # Link to CF
balance_sheet['B1'].font = Font(color='008000')  # Green for internal link

# Cash Flow
cf_sheet = wb.create_sheet('Cash Flow')
cf_sheet['A1'] = 'Net Income'
cf_sheet['B1'] = "='Income Statement'!B15"
cf_sheet['B1'].font = Font(color='008000')
```
