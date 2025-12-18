import { Conversation, Message, TableData, ChartData, ReferencedSource, StarterPrompt } from '@/types/powerbi-chat';

// Sample table data matching the requirements
export const sampleSalesTable: TableData = {
  id: 'table-1',
  title: 'Q3 2024 Regional Sales Performance',
  description: 'Sales performance across regions for Q3 2024',
  columns: [
    { id: 'col-1', key: 'region', label: 'Region', type: 'string', sortable: true, align: 'left' },
    { id: 'col-2', key: 'q3Sales', label: 'Q3 Sales', type: 'number', sortable: true, align: 'right' },
    { id: 'col-3', key: 'target', label: 'Target', type: 'number', sortable: true, align: 'right' },
    { id: 'col-4', key: 'achievement', label: 'Achievement', type: 'percentage', sortable: true, align: 'right' },
    { id: 'col-5', key: 'growth', label: 'Growth', type: 'percentage', sortable: true, align: 'right' },
  ],
  rows: [
    { region: 'North America', q3Sales: '$2.4M', target: '$2.2M', achievement: '109%', growth: '+12%' },
    { region: 'Europe', q3Sales: '$1.8M', target: '$1.9M', achievement: '95%', growth: '+8%' },
    { region: 'Asia Pacific', q3Sales: '$3.1M', target: '$2.8M', achievement: '111%', growth: '+18%' },
    { region: 'Latin America', q3Sales: '$0.9M', target: '$0.8M', achievement: '113%', growth: '+15%' },
    { region: 'Middle East', q3Sales: '$0.6M', target: '$0.5M', achievement: '120%', growth: '+22%' },
  ],
  totalRows: 5,
};

export const sampleRevenueTable: TableData = {
  id: 'table-2',
  title: 'Monthly Revenue Breakdown',
  columns: [
    { id: 'col-1', key: 'month', label: 'Month', type: 'string', sortable: true, align: 'left' },
    { id: 'col-2', key: 'revenue', label: 'Revenue', type: 'number', sortable: true, align: 'right' },
    { id: 'col-3', key: 'expenses', label: 'Expenses', type: 'number', sortable: true, align: 'right' },
    { id: 'col-4', key: 'profit', label: 'Profit', type: 'number', sortable: true, align: 'right' },
  ],
  rows: [
    { month: 'July', revenue: '$2.8M', expenses: '$1.9M', profit: '$0.9M' },
    { month: 'August', revenue: '$3.1M', expenses: '$2.0M', profit: '$1.1M' },
    { month: 'September', revenue: '$3.0M', expenses: '$1.8M', profit: '$1.2M' },
  ],
  totalRows: 3,
};

// Sample chart data
export const sampleBarChart: ChartData = {
  id: 'chart-1',
  type: 'bar',
  title: 'Regional Sales Comparison',
  description: 'Q3 sales performance by region',
  data: [
    { name: 'North America', sales: 2.4, target: 2.2 },
    { name: 'Europe', sales: 1.8, target: 1.9 },
    { name: 'Asia Pacific', sales: 3.1, target: 2.8 },
    { name: 'Latin America', sales: 0.9, target: 0.8 },
    { name: 'Middle East', sales: 0.6, target: 0.5 },
  ],
  config: {
    xAxis: 'name',
    yAxis: 'sales',
    series: ['sales', 'target'],
    colors: ['#F2C94C', '#2F80ED'],
  },
};

export const sampleLineChart: ChartData = {
  id: 'chart-2',
  type: 'line',
  title: 'Monthly Revenue Trend',
  data: [
    { month: 'Jan', revenue: 2.1 },
    { month: 'Feb', revenue: 2.3 },
    { month: 'Mar', revenue: 2.5 },
    { month: 'Apr', revenue: 2.4 },
    { month: 'May', revenue: 2.7 },
    { month: 'Jun', revenue: 2.9 },
    { month: 'Jul', revenue: 2.8 },
    { month: 'Aug', revenue: 3.1 },
    { month: 'Sep', revenue: 3.0 },
  ],
  config: {
    xAxis: 'month',
    yAxis: 'revenue',
    colors: ['#27AE60'],
  },
};

export const samplePieChart: ChartData = {
  id: 'chart-3',
  type: 'pie',
  title: 'Revenue Distribution by Region',
  data: [
    { name: 'North America', value: 27 },
    { name: 'Europe', value: 20 },
    { name: 'Asia Pacific', value: 35 },
    { name: 'Latin America', value: 10 },
    { name: 'Middle East', value: 8 },
  ],
};

// Referenced sources
export const sampleSources: ReferencedSource[] = [
  {
    id: 'source-1',
    type: 'table',
    name: 'Q3_Sales_Report_2024.xlsx',
    path: '/data/reports/Q3_Sales_Report_2024.xlsx',
    icon: 'FileSpreadsheet',
  },
  {
    id: 'source-2',
    type: 'doc',
    name: 'Regional_Targets_2024.pdf',
    path: '/data/reports/Regional_Targets_2024.pdf',
    icon: 'FileText',
  },
];

// Conversation 1: DAX Troubleshooting
export const conversation1: Conversation = {
  id: 'conv-1',
  title: 'DAX Measure Returning Blank',
  createdAt: Date.now() - 86400000 * 2, // 2 days ago
  updatedAt: Date.now() - 86400000 * 2,
  messages: [
    {
      id: 'msg-1-1',
      role: 'user',
      content: 'Why is my DAX measure returning blank?',
      status: 'complete',
      timestamp: Date.now() - 86400000 * 2,
    },
    {
      id: 'msg-1-2',
      role: 'assistant',
      content: `A DAX measure returning BLANK can happen for several common reasons. Let me help you troubleshoot:

## Common Causes

1. **Filter Context Issues**: The measure might be evaluated in a filter context that results in no rows
2. **Division by Zero**: Operations like division can return BLANK when the denominator is zero
3. **Data Type Mismatches**: Comparing incompatible data types
4. **Missing Relationships**: Tables aren't properly related

## Quick Diagnostic Steps

First, check if your measure uses CALCULATE or FILTER functions. These can inadvertently create empty filter contexts.

Try wrapping your measure with this pattern:

\`\`\`dax
TestMeasure = 
VAR Result = [YourOriginalMeasure]
RETURN
    IF(
        ISBLANK(Result),
        "BLANK DETECTED",
        Result
    )
\`\`\`

This will help identify where blanks appear. Would you like me to analyze your specific DAX code?`,
      status: 'complete',
      timestamp: Date.now() - 86400000 * 2 + 5000,
      metadata: {
        responseTime: 2.3,
        citationCount: 0,
        confidence: 0.92,
      },
      isLiked: true,
      codeBlocks: [
        {
          id: 'code-1',
          language: 'dax',
          code: `TestMeasure = 
VAR Result = [YourOriginalMeasure]
RETURN
    IF(
        ISBLANK(Result),
        "BLANK DETECTED",
        Result
    )`,
          fileName: 'diagnostic-measure.dax',
        },
      ],
    },
    {
      id: 'msg-1-3',
      role: 'user',
      content: `Here's my measure:

\`\`\`dax
Profit Margin % = 
DIVIDE(
    SUM(Sales[Profit]),
    SUM(Sales[Revenue])
)
\`\`\`

It works on some visuals but not others.`,
      status: 'complete',
      timestamp: Date.now() - 86400000 * 2 + 60000,
    },
    {
      id: 'msg-1-4',
      role: 'assistant',
      content: `Great! The issue is likely related to **filter context** in your visuals. Your measure looks correct, but here's what's happening:

## The Problem

When certain slicers or filters are applied, they might be filtering out all rows in the Sales table, causing both SUM operations to return BLANK, and DIVIDE returns BLANK when both arguments are BLANK.

## The Solution

Add error handling to show 0 or a custom message:

\`\`\`dax
Profit Margin % = 
VAR ProfitTotal = SUM(Sales[Profit])
VAR RevenueTotal = SUM(Sales[Revenue])
VAR Margin = DIVIDE(ProfitTotal, RevenueTotal, 0)
RETURN
    IF(
        RevenueTotal = 0,
        BLANK(),
        Margin
    )
\`\`\`

## Better Alternative with Error Context

\`\`\`dax
Profit Margin % = 
DIVIDE(
    SUM(Sales[Profit]),
    SUM(Sales[Revenue]),
    0  -- This is the alternate result if division fails
)
\`\`\`

The third parameter in DIVIDE handles the blank/zero case automatically. This is cleaner and more performant.

## Debugging Tips

1. Check which filters are applied to the visual showing BLANK
2. Verify the Sales table has data after filters
3. Use DAX Studio to see the actual filter context

Would you like me to help analyze specific filter combinations?`,
      status: 'complete',
      timestamp: Date.now() - 86400000 * 2 + 65000,
      metadata: {
        responseTime: 3.1,
        citationCount: 0,
        confidence: 0.95,
      },
      codeBlocks: [
        {
          id: 'code-2',
          language: 'dax',
          code: `Profit Margin % = 
VAR ProfitTotal = SUM(Sales[Profit])
VAR RevenueTotal = SUM(Sales[Revenue])
VAR Margin = DIVIDE(ProfitTotal, RevenueTotal, 0)
RETURN
    IF(
        RevenueTotal = 0,
        BLANK(),
        Margin
    )`,
        },
        {
          id: 'code-3',
          language: 'dax',
          code: `Profit Margin % = 
DIVIDE(
    SUM(Sales[Profit]),
    SUM(Sales[Revenue]),
    0  -- This is the alternate result if division fails
)`,
        },
      ],
    },
    {
      id: 'msg-1-5',
      role: 'user',
      content: 'Perfect! That fixed it. The third parameter was exactly what I needed.',
      status: 'complete',
      timestamp: Date.now() - 86400000 * 2 + 120000,
    },
  ],
};

// Conversation 2: Performance Analysis with Tables
export const conversation2: Conversation = {
  id: 'conv-2',
  title: 'Q3 Sales Performance Analysis',
  createdAt: Date.now() - 86400000 * 5,
  updatedAt: Date.now() - 86400000 * 5,
  isPinned: true,
  messages: [
    {
      id: 'msg-2-1',
      role: 'user',
      content: 'Analyze Q3 sales performance across all regions',
      status: 'complete',
      timestamp: Date.now() - 86400000 * 5,
      attachments: [
        {
          id: 'file-1',
          name: 'Q3_Sales_Report_2024.xlsx',
          type: 'xlsx',
          size: 245000,
          uploadStatus: 'complete',
        },
      ],
    },
    {
      id: 'msg-2-2',
      role: 'assistant',
      content: `I've analyzed your Q3 sales data. Here's a comprehensive overview:

## Executive Summary

Overall, Q3 2024 showed strong performance with **4 out of 5 regions** exceeding their targets. Total sales reached **$8.8M** against a target of **$8.2M**, representing a **107% achievement rate**.

## Regional Performance

The data shows significant variance across regions:`,
      status: 'complete',
      timestamp: Date.now() - 86400000 * 5 + 8000,
      tables: [sampleSalesTable],
      charts: [sampleBarChart],
      sources: sampleSources,
      metadata: {
        responseTime: 4.2,
        citationCount: 2,
        confidence: 0.88,
      },
    },
    {
      id: 'msg-2-3',
      role: 'assistant',
      content: `## Key Insights

### Top Performers 🎯
- **Middle East**: Highest achievement at 120% (+22% growth)
- **Latin America**: 113% achievement with strong +15% growth
- **Asia Pacific**: Largest absolute revenue at $3.1M (111% achievement)

### Area of Concern ⚠️
- **Europe**: Underperformed at 95% achievement, missing target by $100K
- Despite 8% growth, this region needs attention for Q4

## Recommendations

1. **Investigate Europe's Gap**: Review competitive pressures and market conditions
2. **Replicate Middle East Success**: Their 22% growth strategy could benefit other regions
3. **Capitalize on Asia Pacific**: Largest market with strong momentum
4. **Maintain Latin America's Trajectory**: Consistent overperformance

Would you like me to drill into any specific region or metric?`,
      status: 'complete',
      timestamp: Date.now() - 86400000 * 5 + 12000,
      metadata: {
        responseTime: 2.8,
        citationCount: 2,
      },
      isLiked: true,
    },
    {
      id: 'msg-2-4',
      role: 'user',
      content: 'Can you show me the monthly trend?',
      status: 'complete',
      timestamp: Date.now() - 86400000 * 5 + 180000,
    },
    {
      id: 'msg-2-5',
      role: 'assistant',
      content: `Here's the monthly revenue trend for Q3:`,
      status: 'complete',
      timestamp: Date.now() - 86400000 * 5 + 185000,
      tables: [sampleRevenueTable],
      charts: [sampleLineChart],
      sources: sampleSources,
      metadata: {
        responseTime: 3.5,
        citationCount: 2,
      },
    },
  ],
};

// Conversation 3: Slow Visual Diagnosis
export const conversation3: Conversation = {
  id: 'conv-3',
  title: 'Diagnosing Slow Power BI Visuals',
  createdAt: Date.now() - 86400000 * 7,
  updatedAt: Date.now() - 86400000 * 7,
  messages: [
    {
      id: 'msg-3-1',
      role: 'user',
      content: 'My Power BI report is extremely slow. Visuals take 10-15 seconds to load. Help!',
      status: 'complete',
      timestamp: Date.now() - 86400000 * 7,
    },
    {
      id: 'msg-3-2',
      role: 'assistant',
      content: `Slow visual performance is one of the most common Power BI issues. Let's diagnose and fix it systematically.

## Immediate Diagnostic Steps

1. **Open Performance Analyzer**
   - Go to View tab → Performance Analyzer
   - Click "Start recording"
   - Interact with your slow visuals
   - Click "Stop recording"

2. **Check DAX Query Duration**
   - In Performance Analyzer, look for "DAX query" times
   - If DAX query > 3 seconds, it's a measure/model issue
   - If rendering > 2 seconds, it's a visual complexity issue

## Common Causes & Solutions

### 1. Inefficient DAX Measures
**Problem**: Complex iterators (SUMX, FILTER) over large tables

\`\`\`dax
-- ❌ Slow - iterates entire table
Slow Total = 
SUMX(
    Sales,
    Sales[Quantity] * RELATED(Products[Price])
)

-- ✅ Fast - uses existing relationships
Fast Total = 
SUM(Sales[Revenue])
\`\`\`

### 2. Too Many Visuals
- Limit to 10-15 visuals per page
- Use bookmarks to toggle between views
- Consider drill-through pages

### 3. Large Data Volume
- Use aggregations for large fact tables
- Implement incremental refresh
- Add proper date filters

### 4. DirectQuery Mode
- Switch to Import mode if possible
- Use aggregation tables
- Optimize SQL queries at source

Would you like me to analyze your specific PBIX file to identify the exact bottleneck?`,
      status: 'complete',
      timestamp: Date.now() - 86400000 * 7 + 6000,
      metadata: {
        responseTime: 3.8,
        citationCount: 0,
        confidence: 0.91,
      },
      codeBlocks: [
        {
          id: 'code-4',
          language: 'dax',
          code: `-- ❌ Slow - iterates entire table
Slow Total = 
SUMX(
    Sales,
    Sales[Quantity] * RELATED(Products[Price])
)

-- ✅ Fast - uses existing relationships
Fast Total = 
SUM(Sales[Revenue])`,
          fileName: 'performance-comparison.dax',
        },
      ],
    },
    {
      id: 'msg-3-3',
      role: 'user',
      content: 'Yes, here\'s my PBIX file',
      status: 'complete',
      timestamp: Date.now() - 86400000 * 7 + 120000,
      attachments: [
        {
          id: 'file-2',
          name: 'Sales_Dashboard.pbix',
          type: 'pbix',
          size: 45000000,
          uploadStatus: 'complete',
        },
      ],
    },
    {
      id: 'msg-3-4',
      role: 'assistant',
      content: `I've analyzed your PBIX file. Found **3 critical performance issues**:

## 🔴 Issue 1: Circular Dependency in Measures (Critical)

Your "YTD Sales" measure references "Monthly Sales" which references "YTD Sales" creating a circular dependency. This causes Power BI to recalculate repeatedly.

**Fix:**
\`\`\`dax
YTD Sales = 
CALCULATE(
    SUM(Sales[Amount]),
    DATESYTD('Date'[Date])
)
\`\`\`

## 🟡 Issue 2: 47 Visuals on Main Page (High Impact)

Your main dashboard has 47 visuals! Recommended maximum is 15.

**Fix:**
- Split into 3-4 pages by department
- Use drill-through for detailed views
- Implement bookmark navigation

## 🟡 Issue 3: Unoptimized Relationships

You have bidirectional filtering on 4 relationships. This multiplies the calculation complexity.

**Fix:**
- Change to single direction where possible
- Use CROSSFILTER in specific measures instead

After these changes, you should see **70-80% performance improvement**.

Would you like the detailed refactoring plan?`,
      status: 'complete',
      timestamp: Date.now() - 86400000 * 7 + 135000,
      metadata: {
        responseTime: 12.5,
        citationCount: 1,
        confidence: 0.94,
      },
      isLiked: true,
      codeBlocks: [
        {
          id: 'code-5',
          language: 'dax',
          code: `YTD Sales = 
CALCULATE(
    SUM(Sales[Amount]),
    DATESYTD('Date'[Date])
)`,
        },
      ],
    },
  ],
};

// Conversation 4: Refresh Failure Investigation
export const conversation4: Conversation = {
  id: 'conv-4',
  title: 'PBIX Refresh Failure Debugging',
  createdAt: Date.now() - 86400000 * 10,
  updatedAt: Date.now() - 86400000 * 10,
  messages: [
    {
      id: 'msg-4-1',
      role: 'user',
      content: 'Why is my PBIX refresh failing? Getting error: "An error occurred during processing"',
      status: 'complete',
      timestamp: Date.now() - 86400000 * 10,
    },
    {
      id: 'msg-4-2',
      role: 'assistant',
      content: `The generic "An error occurred during processing" message is frustrating! Let's narrow this down.

## Step 1: Get the Detailed Error

1. **In Power BI Desktop:**
   - Go to Transform Data → Transform Data
   - Right-click the failing table → Refresh
   - Screenshot the full error message

2. **In Power BI Service:**
   - Go to dataset settings → Refresh history
   - Click the failed refresh
   - Copy the complete error JSON

## Common Refresh Failure Causes

### 🔴 Data Source Authentication
- Gateway credentials expired
- Service principal permissions changed
- Connection string has hardcoded credentials

### 🔴 Schema Changes
- Column removed from source
- Data type changed
- Table renamed or deleted

### 🔴 Data Quality Issues
- NULL values in non-nullable columns
- Data type conversion failures
- Duplicate keys in merge operations

### 🔴 Memory/Timeout Issues
- Dataset too large for available memory
- Query timeout (default 10 minutes)
- Concurrent refresh limits

### 🔴 M Query Errors
- Hardcoded file paths (C:\\ drives)
- Missing parameters
- Firewall blocking data source

## Quick Diagnostic Script

Run this in Power Query Advanced Editor to log each step:

\`\`\`powerquery
let
    Source = try Sql.Database("server", "database") otherwise null,
    TestConnection = if Source = null then error "Connection failed" else Source,
    Navigation = TestConnection{[Schema="dbo",Item="Sales"]}[Data],
    Result = Navigation
in
    Result
\`\`\`

Can you share the detailed error message you're seeing?`,
      status: 'complete',
      timestamp: Date.now() - 86400000 * 10 + 5000,
      metadata: {
        responseTime: 3.2,
        citationCount: 0,
      },
      codeBlocks: [
        {
          id: 'code-6',
          language: 'powerquery',
          code: `let
    Source = try Sql.Database("server", "database") otherwise null,
    TestConnection = if Source = null then error "Connection failed" else Source,
    Navigation = TestConnection{[Schema="dbo",Item="Sales"]}[Data],
    Result = Navigation
in
    Result`,
          fileName: 'diagnostic-query.pq',
        },
      ],
    },
    {
      id: 'msg-4-3',
      role: 'user',
      content: 'Error says: "Column \'ProductCategory\' in Table \'Products\' cannot be found or may not be used in this expression."',
      status: 'complete',
      timestamp: Date.now() - 86400000 * 10 + 180000,
      isEdited: true,
      editHistory: ['Error says: "Column ProductCategory not found"'],
    },
    {
      id: 'msg-4-4',
      role: 'assistant',
      content: `Perfect! This is a **schema change issue** - the column exists in your local model but not in the source anymore.

## What Happened

Someone likely:
- Renamed the column at the source (SQL/Excel/SharePoint)
- Deleted and recreated the table without that column
- Changed the source query/view

## Solution Options

### Option 1: Update the Column Reference (Recommended)

1. Open Power Query Editor
2. Find all steps referencing "ProductCategory"
3. Update to new column name (check your source to find it)

If the column was renamed to "Product_Category":

\`\`\`powerquery
// Change from:
= Table.SelectColumns(Products, {"ProductID", "ProductCategory", "Price"})

// To:
= Table.SelectColumns(Products, {"ProductID", "Product_Category", "Price"})
\`\`\`

### Option 2: Add Fallback Column

If the column is truly gone, create a default:

\`\`\`powerquery
= Table.AddColumn(Products, "ProductCategory", each "Uncategorized")
\`\`\`

### Option 3: Remove Dependency

If you don't need this column:
1. Find all visuals using it
2. Replace with alternative field
3. Remove from model

## Prevention Strategy

Add schema validation at the start of your queries:

\`\`\`powerquery
let
    Source = YourSource,
    RequiredColumns = {"ProductID", "ProductCategory", "Price"},
    CurrentColumns = Table.ColumnNames(Source),
    MissingColumns = List.Difference(RequiredColumns, CurrentColumns),
    Validation = if List.Count(MissingColumns) > 0 
                 then error "Missing columns: " & Text.Combine(MissingColumns, ", ")
                 else Source
in
    Validation
\`\`\`

This will give you a clear error message immediately. Try Option 1 first - check what the column is called now in your source system.`,
      status: 'complete',
      timestamp: Date.now() - 86400000 * 10 + 185000,
      metadata: {
        responseTime: 4.1,
        citationCount: 0,
        confidence: 0.96,
      },
      isLiked: true,
      codeBlocks: [
        {
          id: 'code-7',
          language: 'powerquery',
          code: `// Change from:
= Table.SelectColumns(Products, {"ProductID", "ProductCategory", "Price"})

// To:
= Table.SelectColumns(Products, {"ProductID", "Product_Category", "Price"})`,
        },
        {
          id: 'code-8',
          language: 'powerquery',
          code: `= Table.AddColumn(Products, "ProductCategory", each "Uncategorized")`,
        },
        {
          id: 'code-9',
          language: 'powerquery',
          code: `let
    Source = YourSource,
    RequiredColumns = {"ProductID", "ProductCategory", "Price"},
    CurrentColumns = Table.ColumnNames(Source),
    MissingColumns = List.Difference(RequiredColumns, CurrentColumns),
    Validation = if List.Count(MissingColumns) > 0 
                 then error "Missing columns: " & Text.Combine(MissingColumns, ", ")
                 else Source
in
    Validation`,
          fileName: 'schema-validation.pq',
        },
      ],
    },
  ],
};

// Conversation 5: Revenue Distribution Analysis with Charts
export const conversation5: Conversation = {
  id: 'conv-5',
  title: 'Revenue Distribution Visualization',
  createdAt: Date.now() - 86400000 * 1,
  updatedAt: Date.now() - 86400000 * 1,
  messages: [
    {
      id: 'msg-5-1',
      role: 'user',
      content: 'Create visualizations showing revenue distribution by region and monthly trends',
      status: 'complete',
      timestamp: Date.now() - 86400000 * 1,
      attachments: [
        {
          id: 'file-3',
          name: 'Revenue_Data_2024.csv',
          type: 'csv',
          size: 125000,
          uploadStatus: 'complete',
        },
      ],
    },
    {
      id: 'msg-5-2',
      role: 'assistant',
      content: `I've analyzed your revenue data and created comprehensive visualizations.

## Revenue Distribution Overview

Here's the breakdown of total revenue across all regions:`,
      status: 'complete',
      timestamp: Date.now() - 86400000 * 1 + 6000,
      charts: [samplePieChart, sampleBarChart, sampleLineChart],
      sources: [
        {
          id: 'source-3',
          type: 'file',
          name: 'Revenue_Data_2024.csv',
          path: '/uploads/Revenue_Data_2024.csv',
          icon: 'FileSpreadsheet',
        },
      ],
      metadata: {
        responseTime: 5.1,
        citationCount: 1,
        confidence: 0.89,
      },
    },
    {
      id: 'msg-5-3',
      role: 'assistant',
      content: `## Key Findings

### Regional Distribution
- **Asia Pacific leads** with 35% of total revenue ($3.1M)
- **North America** contributes 27% ($2.4M)
- **Europe** accounts for 20% ($1.8M)
- **Latin America** and **Middle East** combine for 18% ($1.5M)

### Trend Analysis
The monthly trend shows:
- **Consistent growth** from January to August
- **Peak revenue** in August ($3.1M)
- **Slight dip** in September to $3.0M
- **Overall positive trajectory** with 43% growth from Jan to Sep

### Recommendations
1. **Invest in Asia Pacific**: Highest revenue contributor with strong momentum
2. **Stabilize September performance**: Investigate the drop from August
3. **Develop emerging markets**: Latin America & Middle East show potential
4. **Maintain North America**: Steady, reliable second-largest market

Would you like me to create additional segmentation by product category or customer type?`,
      status: 'complete',
      timestamp: Date.now() - 86400000 * 1 + 10000,
      metadata: {
        responseTime: 2.9,
        citationCount: 1,
      },
      isLiked: true,
    },
    {
      id: 'msg-5-4',
      role: 'user',
      content: 'Yes, show me product category breakdown for Asia Pacific',
      status: 'complete',
      timestamp: Date.now() - 86400000 * 1 + 240000,
    },
    {
      id: 'msg-5-5',
      role: 'assistant',
      content: `Here's the product category analysis for Asia Pacific:`,
      status: 'complete',
      timestamp: Date.now() - 86400000 * 1 + 245000,
      tables: [
        {
          id: 'table-3',
          title: 'Asia Pacific Product Category Performance',
          columns: [
            { id: 'c1', key: 'category', label: 'Category', type: 'string', sortable: true, align: 'left' },
            { id: 'c2', key: 'revenue', label: 'Revenue', type: 'number', sortable: true, align: 'right' },
            { id: 'c3', key: 'units', label: 'Units Sold', type: 'number', sortable: true, align: 'right' },
            { id: 'c4', key: 'avgPrice', label: 'Avg Price', type: 'number', sortable: true, align: 'right' },
            { id: 'c5', key: 'share', label: 'Market Share', type: 'percentage', sortable: true, align: 'right' },
          ],
          rows: [
            { category: 'Electronics', revenue: '$1.2M', units: '15,400', avgPrice: '$78', share: '39%' },
            { category: 'Software', revenue: '$0.9M', units: '8,200', avgPrice: '$110', share: '29%' },
            { category: 'Services', revenue: '$0.6M', units: '3,100', avgPrice: '$194', share: '19%' },
            { category: 'Accessories', revenue: '$0.4M', units: '22,800', avgPrice: '$18', share: '13%' },
          ],
          totalRows: 4,
        },
      ],
      charts: [
        {
          id: 'chart-4',
          type: 'column',
          title: 'Asia Pacific Revenue by Category',
          data: [
            { category: 'Electronics', revenue: 1.2 },
            { category: 'Software', revenue: 0.9 },
            { category: 'Services', revenue: 0.6 },
            { category: 'Accessories', revenue: 0.4 },
          ],
          config: {
            xAxis: 'category',
            yAxis: 'revenue',
            colors: ['#F2C94C'],
          },
        },
      ],
      sources: [
        {
          id: 'source-3',
          type: 'file',
          name: 'Revenue_Data_2024.csv',
          path: '/uploads/Revenue_Data_2024.csv',
          icon: 'FileSpreadsheet',
        },
      ],
      metadata: {
        responseTime: 4.3,
        citationCount: 1,
      },
    },
  ],
};

// Starter prompts for Power BI
export const starterPrompts: StarterPrompt[] = [
  {
    id: 'prompt-1',
    title: 'Performance Issues',
    description: 'Speed up slow reports',
    icon: 'Zap',
    prompt: 'PERFORMANCE_ISSUE_PREFILL', // Special marker for pre-filling text box
  },
  {
    id: 'prompt-2',
    title: 'Community Help',
    description: 'Get help from the community',
    icon: 'Network',
    prompt: 'How can I get help from the Power BI community?',
  },
  {
    id: 'prompt-3',
    title: 'Error Agent',
    description: 'Fix errors and issues',
    icon: 'RefreshCw',
    prompt: 'Help me fix errors in my Power BI report',
  },
  {
    id: 'prompt-4',
    title: 'DAX Generator',
    description: 'Generate DAX measures',
    icon: 'Calculator',
    prompt: 'DAX_GENERATION_MESSAGE', // Special marker for sending friendly message
  },
];

// Export all conversations
export const allConversations: Conversation[] = [
  conversation1,
  conversation2,
  conversation3,
  conversation4,
  conversation5,
];
