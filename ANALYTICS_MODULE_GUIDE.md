# EQUIP Analytics Module Guide

## Overview
The new Analytics Module provides DHIS2-style data visualization and indicator creation for EQUIP registers. Users can create custom indicators with data elements, disaggregation, and filtering, then visualize results with charts and tables.

## Pre-loaded Example Indicators

The system comes with **4 pre-configured PrEP indicators** to help you get started:

### PrEP_New Group (New Enrollments)
1. **PrEP_New: Pregnant Women**
   - Number of pregnant women newly enrolled on PrEP in the reporting period
   - Disaggregated by age groups (15-19, 20-24, 25-29, 30+)

2. **PrEP_New: Breastfeeding Women**
   - Number of breastfeeding women newly enrolled on PrEP in the reporting period
   - Disaggregated by age groups (15-19, 20-24, 25-29, 30+)

### PrEP_CT Group (Continuation/Follow-up)
3. **PrEP_CT: Pregnant Women**
   - Number of pregnant women who returned for follow-up/re-initiation visits
   - Disaggregated by age groups (15-19, 20-24, 25-29, 30+)

4. **PrEP_CT: Breastfeeding Women**
   - Number of breastfeeding women who returned for follow-up/re-initiation visits
   - Disaggregated by age groups (15-19, 20-24, 25-29, 30+)

**To use these examples:**
1. Navigate to the **Analytics** tab
2. You'll see all 4 indicators in your library
3. Click **Run** on any indicator to generate results
4. Click **Edit** to see how they're configured
5. Use them as templates to create similar indicators

## Features

### 1. Indicator Builder
- **Drag-and-drop field selection** from register schemas
- **Data element types:**
  - **Count:** Count records matching conditions (e.g., "PrEP_New: count where Initiation Date is not empty")
  - **Sum:** Sum numeric fields with conditions (e.g., "Total Doses: sum Doses Dispensed where Status = Active")
  - **Custom:** Write formula expressions using other data elements
- **Multi-level disaggregation** by register fields (age, sex, pregnancy status, etc.)
- **Location filtering** by region, zone, district, facility
- **Date range filtering** for time-based analysis

### 2. Visualization
- **Interactive charts** using Chart.js with colorblind-friendly palettes
- **Results tables** with disaggregation breakdown
- **CSV export** for external analysis (coming soon)
- **Report sharing** between users (coming soon)

### 3. Indicator Library
- **Save and reuse** indicators across sessions
- **Update indicators** without losing historical definitions
- **Delete indicators** no longer needed
- **Run indicators** instantly with current data

## Creating Your First Indicator: PrEP_New

### Step 1: Start New Indicator
1. Navigate to **Analytics** tab
2. Click **New Indicator** button
3. Enter indicator details:
   - **Name:** PrEP_New
   - **Description:** New PrEP initiations this period
   - **Register:** PrEP Register

### Step 2: Add Data Elements
1. Click **Add Data Element**
2. Configure:
   - **Name:** New Initiations
   - **Type:** Count
   - **Condition:** Initiation Date is not empty
3. Click **Save Element**

### Step 3: Add Disaggregation
1. Click **Add Disaggregation**
2. Select **Pregnancy Status** field
3. Define groups:
   - Pregnant: "Pregnancy Status = Pregnant"
   - Breastfeeding: "Pregnancy Status = Breastfeeding"
   - Not Pregnant: "Pregnancy Status = Not Pregnant or Not Applicable"
4. Click **Save Disaggregation**

### Step 4: Set Filters
1. **Date Range:** Select start and end dates
2. **Location:** Choose region, zone, district, or specific facility
3. Click **Apply Filters**

### Step 5: Run and Visualize
1. Click **Run Indicator**
2. View results:
   - **Table:** Shows disaggregated counts
   - **Chart:** Visual bar chart of breakdown
3. Click **Save Indicator** to add to library

## Technical Architecture

### File Structure
```
analytics.js          - Main analytics module (replaces report.js)
index.html           - Updated with analytics UI components
app.js               - Initializes AnalyticsModule
build.js             - Includes analytics.js in build
sw.js                - Caches analytics.js for offline use
```

### Key Functions

#### AnalyticsModule.init(appInstance)
Initializes the module and sets up references to app context.

#### AnalyticsModule.startNewIndicator()
Creates a new indicator and shows the builder interface.

#### AnalyticsModule.addDataElement()
Adds a data element to the current indicator (count, sum, or formula).

#### AnalyticsModule.addDisaggregation()
Adds a disaggregation dimension by field with group definitions.

#### AnalyticsModule.runIndicator()
Executes the indicator calculation:
1. Retrieves records from selected register
2. Applies location and date filters
3. Calculates each data element
4. Applies disaggregation grouping
5. Renders results table and chart

#### AnalyticsModule.saveIndicator()
Saves indicator definition to localStorage for reuse.

### Data Flow
```
User Input → Indicator Definition → Data Retrieval → Filtering → 
Calculation → Disaggregation → Results → Visualization
```

### Expression Syntax
Conditions use simple comparison syntax:
- **Equality:** `Field Name = "Value"`
- **Not empty:** `Field Name is not empty`
- **Numeric:** `Field Name > 10`
- **Compound:** `Status = "Active" AND Age >= 18`

### Formulas
Custom data elements can reference other elements:
```
{Element1} + {Element2}
{Element1} / {Element2} * 100
({Element1} + {Element2}) / 2
```

## Common Use Cases

### 1. PrEP Continuation (PrEP_CT)
- **Data Element:** Count where Last Refill Date within period
- **Disaggregation:** By pregnancy status and age group
- **Filter:** Active clients only

### 2. Service Volume by Facility
- **Data Element:** Count all records
- **Disaggregation:** By facility name
- **Filter:** Date range for reporting period

### 3. Age Distribution
- **Data Element:** Count all records
- **Disaggregation:** By age groups (0-14, 15-19, 20-24, 25+)
- **Filter:** All active records

### 4. Outcome Analysis
- **Data Element:** Count by outcome type
- **Disaggregation:** By outcome (Continued, Stopped, Transferred)
- **Filter:** Last 6 months

## Best Practices

### 1. Naming Conventions
- Use clear, descriptive names for indicators
- Follow DHIS2/MER naming patterns (e.g., PrEP_NEW, PrEP_CT)
- Include period references in descriptions

### 2. Data Element Design
- Keep conditions simple and clear
- Use multiple data elements instead of complex formulas
- Test conditions with sample data first

### 3. Disaggregation Strategy
- Start with key disaggregations (sex, age, pregnancy status)
- Don't over-disaggregate (leads to small cell sizes)
- Align with reporting requirements

### 4. Performance
- Filter by location early to reduce dataset size
- Use date ranges appropriate to register volume
- Save frequently-used indicators for quick reuse

## Troubleshooting

### No Results Showing
- Check date range includes data
- Verify location filter isn't too restrictive
- Ensure register has records matching conditions

### Incorrect Counts
- Review condition syntax
- Check for typos in field names or values
- Verify field values in register match conditions

### Chart Not Rendering
- Ensure Chart.js library loaded (check browser console)
- Verify disaggregation groups defined
- Check results contain numeric values

### Indicator Won't Save
- Provide name and description
- Add at least one data element
- Ensure unique indicator name

## Migration from Old Reports

### What Changed
- **Old:** Token-based expressions (${Field} = "Value")
- **New:** Structured data elements with types
- **Old:** Single expression per metric
- **New:** Multiple data elements with formulas

### Migration Steps
1. Open old report in legacy system
2. Note register, fields used, and expressions
3. Create new indicator in Analytics
4. Add data element for each old metric
5. Translate expression to condition/formula
6. Add disaggregation if needed
7. Test and save

### Example Migration
**Old Report:**
```
Metric: New Clients
Expression: ${Status} = "New"
```

**New Indicator:**
- Name: New Clients
- Data Element: "New Count" (Count where Status = "New")
- Disaggregation: None
- Filter: Current period

## Future Enhancements
- **CSV Export:** Download results for Excel analysis
- **Report Templates:** Pre-built indicators for common reports
- **Scheduled Reports:** Automatic report generation
- **Data Visualization Options:** Pie charts, line graphs, trend analysis
- **Comparison Mode:** Compare periods or locations side-by-side
- **Thresholds/Targets:** Set targets and highlight variance

## Support
For issues or questions:
1. Check this guide first
2. Review indicator definition for errors
3. Test with simplified conditions
4. Contact system administrator with specific error details

---

**Version:** 1.0 (December 2024)  
**Module:** analytics.js  
**Dependencies:** Chart.js, localStorage
