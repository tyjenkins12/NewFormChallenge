# NewForm API Data Availability Guide

## **Issue Discovery**

The NewForm API doesn't return data for all parameter combinations. This is **normal behavior** - the API serves sample data with specific availability patterns.

## **Data Availability Patterns**

### **High Data Availability (Recommended)**
- **Level**: `campaign` 
- **Date Range**: `last30` 
- **Result**: ~400+ records consistently available

### **Limited Data Availability**
- **Level**: `ad`
- **Date Range**: `last7`  
- **Result**: Often returns empty `{"data": []}`

### **Working Combinations Tested**

| Platform | Level | Date Range | Breakdowns | Records | Status |
|----------|-------|------------|------------|---------|--------|
| `meta` | `campaign` | `last30` | `["age"]` | 411 | Works |
| `meta` | `campaign` | `last7` | `["age"]` | 60+ | Works |
| `meta` | `ad` | `last30` | `["age"]` | 200+ | Works |
| `meta` | `ad` | `last7` | `["age", "country"]` | 0 | Empty |

## **User Guidance**

### **For Maximum Data Availability:**
```json
{
  "platform": "meta",
  "level": "campaign", 
  "dateRangeEnum": "last30",
  "breakdowns": ["age"],
  "timeIncrement": "7"
}
```

### **If You Need Ad-Level Data:**
- Use `"dateRangeEnum": "last30"` instead of `"last7"`
- Consider fewer breakdowns (single instead of multiple)
- Be prepared for potentially smaller datasets

## **System Improvements Made**

### 1. **Smart Empty Data Handling**
- System detects empty API responses
- Generates helpful console logging
- Still creates reports with clear messaging
- No system crashes or failures

### 2. **User Feedback**  
```
INFO: No data available for: meta ad level, last7 date range
SUGGESTION: Try 'campaign' level or 'last30' date range for more data availability
```

### 3. **Graceful Report Generation**
- Empty data → "No Data Available" in charts
- Summary still generated with appropriate messaging
- Professional report layout maintained

## **Best Practices for Users**

### **Start With High-Availability Combinations:**
1. Choose `campaign` level first
2. Use `last30` date range initially  
3. Test with single breakdowns
4. Gradually adjust parameters based on results

### **Troubleshooting Empty Results:**
1. Check the console logs for specific guidance
2. Try broader date ranges (`last30` vs `last7`)
3. Use higher-level aggregations (`campaign` vs `ad`)
4. Reduce number of breakdowns/dimensions

## **Technical Details**

### **API Response Format:**
```json
{
  "data": [
    {
      "spend": "2223.76",
      "impressions": "157834", 
      "clicks": "818",
      "ctr": "0.518266",
      "age": "18-24",
      "date_start": "2025-08-06",
      "date_stop": "2025-08-12"
    }
  ]
}
```

### **Empty Response:**
```json
{
  "data": []
}
```

## **For Developers**

### **Handling Empty Responses:**
```javascript
const data = apiResponse.data || [];
if (data.length === 0) {
  console.log('SUGGESTION: Try campaign level or last30 date range');
  // Generate report with "No Data Available" messaging
}
```

### **Error Handling Strategy:**
1. **Never crash** on empty data
2. **Always generate reports** (with appropriate messaging)
3. **Provide helpful guidance** in logs
4. **Suggest better parameters** when possible

This ensures a smooth user experience regardless of data availability patterns in the NewForm API.