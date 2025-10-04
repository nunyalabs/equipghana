# Pre-configured PrEP Indicators

## Overview
The EQUIP Analytics module comes with 4 ready-to-use PrEP indicators that align with MER/PEPFAR reporting requirements. These serve as templates for creating additional custom indicators.

---

## 1. PrEP_New: Pregnant Women

**Group:** PrEP_New (New Enrollments)

**Definition:**  
Number of pregnant women who were newly enrolled on pre-exposure prophylaxis (PrEP) to prevent HIV infection in the reporting period.

**Configuration:**
- **Register:** PrEP Register
- **Date Field:** Initiation Date
- **Condition:** `Initiation Date is not empty AND Pregnancy Status = "Pregnant"`

**Disaggregation:**
| Age Group | Condition |
|-----------|-----------|
| 15-19 years | Age >= 15 AND Age <= 19 |
| 20-24 years | Age >= 20 AND Age <= 24 |
| 25-29 years | Age >= 25 AND Age <= 29 |
| 30+ years | Age >= 30 |

**Sample Output:**
```
Age Group    | Count
-------------|------
15-19 years  | 12
20-24 years  | 28
25-29 years  | 35
30+ years    | 18
-------------|------
TOTAL        | 93
```

---

## 2. PrEP_New: Breastfeeding Women

**Group:** PrEP_New (New Enrollments)

**Definition:**  
Number of breastfeeding women who were newly enrolled on pre-exposure prophylaxis (PrEP) to prevent HIV infection in the reporting period.

**Configuration:**
- **Register:** PrEP Register
- **Date Field:** Initiation Date
- **Condition:** `Initiation Date is not empty AND Pregnancy Status = "Breastfeeding"`

**Disaggregation:**
| Age Group | Condition |
|-----------|-----------|
| 15-19 years | Age >= 15 AND Age <= 19 |
| 20-24 years | Age >= 20 AND Age <= 24 |
| 25-29 years | Age >= 25 AND Age <= 29 |
| 30+ years | Age >= 30 |

**Sample Output:**
```
Age Group    | Count
-------------|------
15-19 years  | 8
20-24 years  | 22
25-29 years  | 31
30+ years    | 15
-------------|------
TOTAL        | 76
```

---

## 3. PrEP_CT: Pregnant Women

**Group:** PrEP_CT (Continuation/Follow-up)

**Definition:**  
Number of pregnant women that returned for a follow-up or re-initiation visit to receive PrEP during the reporting period.

**Configuration:**
- **Register:** PrEP Register
- **Date Field:** Last Refill Date
- **Condition:** `Last Refill Date is not empty AND Pregnancy Status = "Pregnant"`

**Disaggregation:**
| Age Group | Condition |
|-----------|-----------|
| 15-19 years | Age >= 15 AND Age <= 19 |
| 20-24 years | Age >= 20 AND Age <= 24 |
| 25-29 years | Age >= 25 AND Age <= 29 |
| 30+ years | Age >= 30 |

**Sample Output:**
```
Age Group    | Count
-------------|------
15-19 years  | 45
20-24 years  | 98
25-29 years  | 112
30+ years    | 67
-------------|------
TOTAL        | 322
```

---

## 4. PrEP_CT: Breastfeeding Women

**Group:** PrEP_CT (Continuation/Follow-up)

**Definition:**  
Number of breastfeeding women that returned for a follow-up or re-initiation visit to receive PrEP during the reporting period.

**Configuration:**
- **Register:** PrEP Register
- **Date Field:** Last Refill Date
- **Condition:** `Last Refill Date is not empty AND Pregnancy Status = "Breastfeeding"`

**Disaggregation:**
| Age Group | Condition |
|-----------|-----------|
| 15-19 years | Age >= 15 AND Age <= 19 |
| 20-24 years | Age >= 20 AND Age <= 24 |
| 25-29 years | Age >= 25 AND Age <= 29 |
| 30+ years | Age >= 30 |

**Sample Output:**
```
Age Group    | Count
-------------|------
15-19 years  | 38
20-24 years  | 85
25-29 years  | 96
30+ years    | 54
-------------|------
TOTAL        | 273
```

---

## How to Use These Indicators

### Running an Indicator
1. Navigate to **Analytics** tab
2. Find the indicator in your library
3. Click **Run** button
4. Set filters (optional):
   - **Date Range:** Start and end dates
   - **Location:** Region, zone, district, or facility
5. View results as table and chart

### Editing an Indicator
1. Click **Edit** on the indicator card
2. Modify any section:
   - **Info:** Name, description, register
   - **Data Elements:** Add/edit/remove elements
   - **Disaggregation:** Change fields or groups
   - **Filters:** Adjust date field or location defaults
3. Click **Save Indicator** to update

### Cloning for New Indicators
1. Click **Edit** on a similar indicator
2. Modify the name (e.g., "PrEP_New: All Women")
3. Update the condition to match your needs
4. Adjust disaggregation if needed
5. **Save as new** (automatically gets new ID)

---

## Creating Similar Indicators

### Example: PrEP_New - All Women (Combined)
Based on PrEP_New: Pregnant Women, modify:
- **Name:** PrEP_New: All Women
- **Condition:** `Initiation Date is not empty`
- **Add Disaggregation:** Pregnancy Status
  - Pregnant: `Pregnancy Status = "Pregnant"`
  - Breastfeeding: `Pregnancy Status = "Breastfeeding"`
  - Not Pregnant/NA: `Pregnancy Status = "Not Pregnant" OR Pregnancy Status = "Not Applicable"`

### Example: PrEP_New by Sex
Based on PrEP_New: Pregnant Women, modify:
- **Name:** PrEP_New: By Sex
- **Condition:** `Initiation Date is not empty`
- **Change Disaggregation:** Sex
  - Male: `Sex = "Male"`
  - Female: `Sex = "Female"`

### Example: PrEP Screening (Pre-enrollment)
New indicator:
- **Name:** PrEP Screening
- **Data Element:** Count where `Screening Date is not empty`
- **Disaggregation:** HIV Risk Category
- **Date Field:** Screening Date

---

## Indicator Maintenance Tips

### 1. Regular Review
- Review indicators quarterly for relevance
- Archive unused indicators
- Update descriptions as programs evolve

### 2. Consistent Naming
- Use MER indicator codes when applicable
- Include population (Pregnant, Breastfeeding, etc.)
- Version numbers for major changes (v2, v3)

### 3. Documentation
- Keep descriptions clear and complete
- Document any custom logic in notes
- Share indicator definitions with team

### 4. Testing
- Test with known data before production use
- Verify totals match manual counts
- Check disaggregation logic with edge cases

---

## Field Requirements for PrEP Indicators

To use these pre-configured indicators, your **PrEP Register** should include these fields:

### Required Fields
- **Initiation Date** (date field)
- **Last Refill Date** (date field)
- **Pregnancy Status** (select_one: Pregnant, Breastfeeding, Not Pregnant, Not Applicable)
- **Age** (numeric field)
- **Sex** (select_one: Male, Female)

### Recommended Additional Fields
- **Facility Name** (text or select_one)
- **District** (text or select_one)
- **HIV Risk Category** (select_one)
- **Doses Dispensed** (numeric)
- **Next Appointment Date** (date)
- **Status** (select_one: Active, Stopped, Transferred Out)

### Calculated Fields (Auto-generate if possible)
- **Age Group:** Calculated from Age field
- **Reporting Period:** Calculated from date fields

---

## Troubleshooting

### Indicator Returns Zero
**Possible causes:**
- No data matches the date range
- Field names don't match register schema
- Pregnancy Status values spelled differently
- Location filter too restrictive

**Solution:**
- Check register has data in date range
- Verify field names in register match condition exactly
- Check for extra spaces in field values
- Remove location filter temporarily

### Disaggregation Shows Unexpected Groups
**Possible causes:**
- Age field contains non-numeric values
- Age conditions overlap or have gaps
- Null/empty age values not handled

**Solution:**
- Clean age data (numbers only)
- Review age group conditions for gaps
- Add condition to handle empty ages

### Totals Don't Match Manual Count
**Possible causes:**
- Multiple records per client counted separately
- Duplicate entries in register
- Condition logic includes/excludes edge cases

**Solution:**
- Review register for duplicates
- Refine conditions to match counting rules
- Add unique identifier field if needed

---

**Last Updated:** October 2024  
**Module Version:** Analytics v2.0  
**Indicator Count:** 4 pre-configured, unlimited custom
