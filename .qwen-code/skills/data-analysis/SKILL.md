---
name: data-analysis
description: Use when analyzing CSV/JSON data with pandas. Handles data loading, cleaning, exploration (describe, groupby), visualization, and summary export.
---

# Data Analysis Skill

Analyze structured data using pandas for exploration, transformation, and insights.

## When to Use

- Loading and exploring CSV/JSON datasets
- Cleaning messy data (missing values, duplicates)
- Computing aggregations and statistics
- Grouping and pivoting data
- Creating visualizations
- Exporting analysis results

## Loading Data

### From CSV

```python
import pandas as pd

# Basic load
df = pd.read_csv('data.csv')

# With options
df = pd.read_csv(
    'data.csv',
    sep=';',              # Custom separator
    header=0,             # First row is header
    index_col='id',       # Use column as index
    parse_dates=['date'], # Parse date column
    na_values=['NA', ''], # Custom NA values
    encoding='utf-8',     # File encoding
)

# From URL
df = pd.read_csv('https://example.com/data.csv')

# From compressed file
df = pd.read_csv('data.csv.gz', compression='gzip')
```

### From JSON

```python
# Basic JSON
df = pd.read_json('data.json')

# JSON Lines (one JSON object per line)
df = pd.read_json('data.jsonl', lines=True)

# From API response
import requests
response = requests.get('https://api.example.com/data')
df = pd.read_json(response.text)
```

### From Excel

```python
# Single sheet
df = pd.read_excel('data.xlsx', sheet_name='Sheet1')

# All sheets
sheets = pd.read_excel('data.xlsx', sheet_name=None)  # Dict of DataFrames
```

## Initial Exploration

### Basic Info

```python
# First rows
df.head()
df.head(10)

# Last rows
df.tail()

# Shape
df.shape  # (rows, columns)

# Column names
df.columns

# Data types
df.dtypes

# Full info
df.info()

# Summary statistics
df.describe()

# For categorical columns
df.describe(include=['object'])
```

### Value Counts

```python
# Count unique values
df['status'].value_counts()

# With percentages
df['status'].value_counts(normalize=True)

# Top N
df['category'].value_counts().head(10)
```

### Missing Values

```python
# Count missing per column
df.isnull().sum()

# Percentage missing
df.isnull().sum() / len(df) * 100

# Rows with any missing
df[df.isnull().any(axis=1)]

# Drop missing
df.dropna()

# Drop if all columns missing
df.dropna(how='all')

# Fill missing
df['column'].fillna(0, inplace=True)
df['column'].fillna(df['column'].mean(), inplace=True)
df['column'].fillna('Unknown', inplace=True)
```

## Filtering and Selection

### Column Selection

```python
# Single column (Series)
df['name']

# Multiple columns
df[['name', 'email', 'age']]

# Rename columns
df.rename(columns={'old_name': 'new_name'}, inplace=True)
```

### Row Filtering

```python
# Single condition
df[df['age'] > 25]

# Multiple conditions
df[(df['age'] > 25) & (df['status'] == 'active')]
df[(df['age'] < 18) | (df['guardian'].notna())]

# String contains
df[df['email'].str.contains('@gmail.com')]

# Is in list
df[df['status'].isin(['active', 'pending'])]

# Query method (more readable)
df.query('age > 25 and status == "active"')
```

### Sorting

```python
# Single column
df.sort_values('age', ascending=False)

# Multiple columns
df.sort_values(['status', 'age'], ascending=[True, False])
```

## Aggregations

### Basic Aggregations

```python
# Single column
df['revenue'].sum()
df['revenue'].mean()
df['age'].median()
df['age'].min()
df['age'].max()
df['age'].std()

# Multiple aggregations
df['revenue'].agg(['sum', 'mean', 'min', 'max'])

# Named aggregations
df['revenue'].agg(
    total='sum',
    average='mean',
    minimum='min'
)
```

### GroupBy

```python
# Group and aggregate
df.groupby('category')['revenue'].sum()

# Multiple aggregations
df.groupby('category')['revenue'].agg(['sum', 'mean', 'count'])

# Multiple columns
df.groupby(['category', 'region'])['revenue'].sum()

# Multiple aggregations on multiple columns
df.groupby('category').agg({
    'revenue': ['sum', 'mean'],
    'quantity': 'sum',
    'customer_id': 'count'
})

# Reset index for DataFrame
df.groupby('category')['revenue'].sum().reset_index()
```

### Pivot Tables

```python
# Basic pivot
pd.pivot_table(
    df,
    values='revenue',
    index='category',
    columns='region',
    aggfunc='sum'
)

# With margins (totals)
pd.pivot_table(
    df,
    values='revenue',
    index='category',
    columns='region',
    aggfunc='sum',
    margins=True,
    margins_name='Total'
)
```

## Data Transformation

### Apply Functions

```python
# Apply to column
df['age_group'] = df['age'].apply(
    lambda x: 'young' if x < 30 else 'senior'
)

# Apply to row
df['full_name'] = df.apply(
    lambda row: f"{row['first_name']} {row['last_name']}",
    axis=1
)

# Vectorized (faster than apply)
df['discount_price'] = df['price'] * 0.9
```

### String Operations

```python
# String methods (via .str accessor)
df['email_domain'] = df['email'].str.split('@').str[1]
df['name_upper'] = df['name'].str.upper()
df['name_length'] = df['name'].str.len()
df['has_email'] = df['email'].str.contains('@')
```

### Date/Time Operations

```python
# Ensure datetime type
df['date'] = pd.to_datetime(df['date'])

# Extract components
df['year'] = df['date'].dt.year
df['month'] = df['date'].dt.month
df['day'] = df['date'].dt.day
df['dayofweek'] = df['date'].dt.dayofweek
df['quarter'] = df['date'].dt.quarter

# Date arithmetic
df['days_since'] = (pd.Timestamp.now() - df['date']).dt.days
```

## Merging and Joining

### Concat

```python
# Stack vertically
combined = pd.concat([df1, df2, df3])

# With keys
combined = pd.concat([df1, df2], keys=['source1', 'source2'])
```

### Merge

```python
# Inner join (default)
merged = pd.merge(df1, df2, on='user_id')

# Left join
merged = pd.merge(df1, df2, on='user_id', how='left')

# Different column names
merged = pd.merge(df1, df2, left_on='user_id', right_on='id')

# Multiple keys
merged = pd.merge(df1, df2, on=['user_id', 'date'])
```

## Visualization

```python
import matplotlib.pyplot as plt

# Set style
plt.style.use('seaborn-v0_8')

# Histogram
df['age'].hist(bins=30, figsize=(10, 6))
plt.title('Age Distribution')
plt.xlabel('Age')
plt.ylabel('Count')
plt.show()

# Bar chart
df['category'].value_counts().plot.bar(figsize=(10, 6))
plt.title('Category Distribution')
plt.xticks(rotation=45)
plt.tight_layout()
plt.show()

# Line chart
df.groupby('month')['revenue'].sum().plot.line(figsize=(12, 6))
plt.title('Revenue Over Time')
plt.xlabel('Month')
plt.ylabel('Revenue')
plt.grid(True)
plt.show()

# Scatter plot
df.plot.scatter(x='age', y='income', figsize=(10, 6))
plt.title('Age vs Income')
plt.show()

# Box plot
df.boxplot(column='revenue', by='category', figsize=(10, 6))
plt.title('Revenue by Category')
plt.suptitle('')  # Remove automatic title
plt.show()
```

## Export Results

```python
# To CSV
df.to_csv('output.csv', index=False)

# To Excel
df.to_excel('output.xlsx', index=False, sheet_name='Results')

# To JSON
df.to_json('output.json', orient='records', indent=2)

# To multiple sheets
with pd.ExcelWriter('output.xlsx') as writer:
    df1.to_excel(writer, sheet_name='Summary', index=False)
    df2.to_excel(writer, sheet_name='Details', index=False)
```

## Complete Analysis Example

```python
import pandas as pd
import matplotlib.pyplot as plt

# Load data
df = pd.read_csv('sales_data.csv', parse_dates=['order_date'])

# Initial exploration
print(f"Shape: {df.shape}")
print(f"\nColumns: {df.columns.tolist()}")
print(f"\nData types:\n{df.dtypes}")
print(f"\nMissing values:\n{df.isnull().sum()}")
print(f"\nSummary:\n{df.describe()}")

# Clean data
df = df.dropna(subset=['customer_id', 'revenue'])
df['revenue'] = df['revenue'].fillna(0)

# Analysis: Revenue by category
revenue_by_category = df.groupby('category')['revenue'].agg([
    ('total', 'sum'),
    ('average', 'mean'),
    ('count', 'size')
]).sort_values('total', ascending=False)

print(f"\nRevenue by Category:\n{revenue_by_category}")

# Analysis: Monthly trend
df['month'] = df['order_date'].dt.to_period('M')
monthly_revenue = df.groupby('month')['revenue'].sum()

print(f"\nMonthly Revenue:\n{monthly_revenue}")

# Visualization
fig, axes = plt.subplots(2, 1, figsize=(12, 10))

# Top categories
revenue_by_category.head(10)['total'].plot.bar(ax=axes[0])
axes[0].set_title('Top 10 Categories by Revenue')
axes[0].set_xlabel('Category')
axes[0].set_ylabel('Revenue')
axes[0].tick_params(axis='x', rotation=45)

# Monthly trend
monthly_revenue.plot.line(ax=axes[1])
axes[1].set_title('Monthly Revenue Trend')
axes[1].set_xlabel('Month')
axes[1].set_ylabel('Revenue')
axes[1].grid(True)

plt.tight_layout()
plt.savefig('sales_analysis.png', dpi=300)
plt.show()

# Export summary
revenue_by_category.to_csv('revenue_by_category.csv')
monthly_revenue.to_csv('monthly_revenue.csv')
```

## Checklist

- [ ] Data loaded correctly (check dtypes)
- [ ] Missing values handled
- [ ] Duplicates removed if needed
- [ ] Appropriate aggregations selected
- [ ] Visualizations clear and labeled
- [ ] Results exported for sharing
