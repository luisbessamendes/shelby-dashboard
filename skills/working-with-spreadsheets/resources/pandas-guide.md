# pandas Guide for Excel Operations

## Reading Excel Files

### Basic Reading
```python
import pandas as pd

# Read first sheet
df = pd.read_excel('file.xlsx')

# Read specific sheet
df = pd.read_excel('file.xlsx', sheet_name='Sheet1')

# Read all sheets as dictionary
all_sheets = pd.read_excel('file.xlsx', sheet_name=None)
for name, df in all_sheets.items():
    print(f"Sheet: {name}, Rows: {len(df)}")
```

### Advanced Reading Options
```python
# Specify data types
df = pd.read_excel('file.xlsx', dtype={'id': str, 'amount': float})

# Read specific columns
df = pd.read_excel('file.xlsx', usecols=['A', 'C', 'E'])
# Or by name
df = pd.read_excel('file.xlsx', usecols=['Name', 'Email', 'Phone'])

# Handle dates
df = pd.read_excel('file.xlsx', parse_dates=['date_column'])

# Skip rows
df = pd.read_excel('file.xlsx', skiprows=2)  # Skip first 2 rows

# Specify header row
df = pd.read_excel('file.xlsx', header=1)  # Row 2 is header
```

## Data Analysis

### Basic Exploration
```python
# Preview data
df.head()      # First 5 rows
df.tail(10)    # Last 10 rows
df.sample(5)   # Random 5 rows

# Column info
df.info()      # Data types, non-null counts
df.describe()  # Statistics for numeric columns
df.columns     # Column names
df.shape       # (rows, columns)

# Check for missing values
df.isnull().sum()
df.notna()     # Boolean mask of non-null values
```

### Data Manipulation
```python
# Select columns
df[['Name', 'Email']]

# Filter rows
df[df['Age'] > 25]
df[df['Status'].isin(['Active', 'Pending'])]

# Sort
df.sort_values('Date', ascending=False)
df.sort_values(['Category', 'Amount'], ascending=[True, False])

# Group and aggregate
df.groupby('Category')['Amount'].sum()
df.groupby('Category').agg({
    'Amount': ['sum', 'mean', 'count'],
    'Date': 'max'
})

# Add calculated columns
df['Total'] = df['Quantity'] * df['Price']
df['Growth'] = df['Revenue'].pct_change()
```

## Writing Excel Files

### Basic Writing
```python
# Write to Excel
df.to_excel('output.xlsx', index=False)

# Write multiple sheets
with pd.ExcelWriter('output.xlsx') as writer:
    df1.to_excel(writer, sheet_name='Sales', index=False)
    df2.to_excel(writer, sheet_name='Customers', index=False)
```

### Advanced Writing
```python
# Write with formatting (requires openpyxl)
with pd.ExcelWriter('output.xlsx', engine='openpyxl') as writer:
    df.to_excel(writer, sheet_name='Data', index=False)
    
    # Access workbook for formatting
    workbook = writer.book
    worksheet = writer.sheets['Data']
    
    # Format header
    for cell in worksheet[1]:
        cell.font = Font(bold=True)
        cell.fill = PatternFill('solid', start_color='D3D3D3')
```

## Best Practices

### Performance
```python
# For large files, read specific columns
df = pd.read_excel('large.xlsx', usecols=['A', 'B', 'C'])

# Use chunking for very large files (CSV)
for chunk in pd.read_csv('large.csv', chunksize=10000):
    process(chunk)
```

### Data Quality
```python
# Handle missing values
df.fillna(0)                    # Replace NaN with 0
df.dropna()                     # Drop rows with NaN
df.fillna(method='ffill')       # Forward fill

# Remove duplicates
df.drop_duplicates()
df.drop_duplicates(subset=['Email'])

# Clean strings
df['Name'] = df['Name'].str.strip()
df['Email'] = df['Email'].str.lower()
```

### Common Patterns
```python
# Pivot table
pivot = df.pivot_table(
    values='Amount',
    index='Category',
    columns='Month',
    aggfunc='sum',
    fill_value=0
)

# Merge dataframes
merged = pd.merge(df1, df2, on='id', how='left')

# Concatenate
combined = pd.concat([df1, df2], ignore_index=True)
```

## Integration with openpyxl

When you need both pandas (data) and openpyxl (formatting):

```python
import pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import Font

# Write data with pandas
df.to_excel('output.xlsx', index=False)

# Format with openpyxl
wb = load_workbook('output.xlsx')
sheet = wb.active

# Format header
for cell in sheet[1]:
    cell.font = Font(bold=True)

# Add formulas
sheet['E2'] = '=C2*D2'

wb.save('output.xlsx')
```
