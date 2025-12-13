# Refund Workflow Plan - Sales History

## Overview
This document outlines the planned refund workflow system for the Sales History page.

## Current Implementation Status
✅ **Completed:**
- Removed individual refund buttons from each row
- Added checkbox selection for all items (like InventoryManagement)
- Added "Refund" button at the top action bar
- Changed "Actions" column to "Status" column showing "Active" or "Refunded"
- Refund button works with selected items (currently shows placeholder alert)

## Proposed Refund Workflow

### Phase 1: Refund Request Creation (Pending Status)

#### 1.1 User Selection & Refund Button
- User selects one or more items using checkboxes
- User clicks "Refund" button at the top
- System validates:
  - At least one item selected
  - Selected items are not already refunded
  - Selected items are not already pending refund

#### 1.2 Refund Form/Modal
When "Refund" button is clicked, show a modal/form with:
- **Selected Items Summary:**
  - List of selected items with details (Part No., Brand, Qty, Amount)
  - Total quantity to refund
  - Total refund amount
  
- **Refund Information:**
  - **CM Number (Credit Memo):** Auto-generated (e.g., CM-2025-001, CM-2025-002)
  - **Refund Date:** Auto-filled with today's date
  - **Reason:** Dropdown or text field (Defective, Wrong Item, Customer Request, etc.)
  - **Notes:** Optional text field for additional details
  
- **Customer Information:**
  - Customer name (auto-filled from sale)
  - Receipt/Invoice number (auto-filled)
  
- **Actions:**
  - "Create Refund Request" button
  - "Cancel" button

#### 1.3 Create Refund Request
When "Create Refund Request" is clicked:
- Create refund record in database with status: **"PENDING"**
- **Do NOT** return quantity to stock yet
- Generate CM# (Credit Memo number)
- Store refund information:
  - CM Number
  - Items to refund (with quantities)
  - Refund amount
  - Reason
  - Notes
  - Status: PENDING
  - Created date
  - Created by (user)
- Show success message
- Clear selection
- Refresh the page or update UI to show pending status

### Phase 2: Refund Management Page

#### 2.1 New "Refunds" Page/Button
- Add a "Refunds" button on Sales History page (or separate page)
- This page shows all refund requests with statuses:
  - **PENDING** (yellow/orange) - Waiting for item to be received
  - **CONFIRMED** (green) - Item received, quantity returned to stock
  - **CANCELLED** (red) - Refund cancelled

#### 2.2 Refund List View
Display refunds in a table with:
- **CM Number** (clickable to view details)
- **Date Created**
- **Customer**
- **Items Count**
- **Total Amount**
- **Status** (with color coding)
- **Actions:**
  - View Details
  - Print Refund Form
  - Confirm Refund (if PENDING)
  - Cancel Refund (if PENDING)

#### 2.3 Filtering & Search
- Filter by Status (Pending, Confirmed, Cancelled)
- Filter by Date Range
- Search by CM Number, Customer, Receipt Number
- Group by CM# (as requested)

### Phase 3: Item Receipt & Confirmation

#### 3.1 Confirm Refund Process
When user clicks "Confirm Refund" on a PENDING refund:
1. Show confirmation dialog:
   - "Are you sure the item(s) have been received?"
   - List items to confirm
   - Total quantity to return to stock
   
2. When confirmed:
   - Change status from **PENDING** to **CONFIRMED**
   - **Return quantities to stock** (add back to inventory)
   - Update stock quantities in database
   - Mark items as refunded in Sales History
   - Record confirmation date and user
   - Show success message

#### 3.2 Print Refund Form
- Generate printable refund form with:
  - Company header
  - CM Number
  - Date
  - Customer information
  - Item details (table format)
  - Total refund amount
  - Signature fields (for customer and staff)
  - Checkboxes for:
    - Cash Refund
    - Charge Refund
    - Item Received checkbox (to be checked when item is returned)

### Phase 4: Database Schema

#### 4.1 Refunds Table
```sql
CREATE TABLE refunds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cm_number VARCHAR(50) UNIQUE NOT NULL,  -- CM-2025-001
  status ENUM('PENDING', 'CONFIRMED', 'CANCELLED') DEFAULT 'PENDING',
  customer_name VARCHAR(255),
  receipt_number VARCHAR(100),
  invoice_number VARCHAR(100),
  refund_date DATE,
  reason VARCHAR(255),
  notes TEXT,
  total_amount DECIMAL(10,2),
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmed_by VARCHAR(255),
  confirmed_at TIMESTAMP NULL,
  cancelled_by VARCHAR(255),
  cancelled_at TIMESTAMP NULL
);
```

#### 4.2 Refund Items Table
```sql
CREATE TABLE refund_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  refund_id INT NOT NULL,
  sale_id INT,  -- Reference to original sale
  idcode VARCHAR(50),
  benz VARCHAR(50),
  brand VARCHAR(100),
  altno VARCHAR(50),
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2),
  amount DECIMAL(10,2),
  reason VARCHAR(255),
  FOREIGN KEY (refund_id) REFERENCES refunds(id) ON DELETE CASCADE,
  INDEX idx_refund_id (refund_id),
  INDEX idx_sale_id (sale_id)
);
```

### Phase 5: API Endpoints

#### 5.1 Create Refund Request
```
POST /api/sales/refund/create
Body: {
  items: [{ sale_id, quantity, reason }],
  customer_name: string,
  receipt_number: string,
  reason: string,
  notes: string
}
Response: {
  success: true,
  refund_id: number,
  cm_number: string
}
```

#### 5.2 Get Refunds List
```
GET /api/sales/refunds?status=pending&page=1&limit=20
Response: {
  data: [refund objects],
  total: number,
  page: number,
  totalPages: number
}
```

#### 5.3 Get Refund Details
```
GET /api/sales/refunds/:id
Response: {
  refund: { ... },
  items: [ ... ]
}
```

#### 5.4 Confirm Refund
```
POST /api/sales/refunds/:id/confirm
Body: {
  confirmed_by: string
}
Response: {
  success: true,
  message: "Items returned to stock"
}
```

#### 5.5 Cancel Refund
```
POST /api/sales/refunds/:id/cancel
Body: {
  cancelled_by: string,
  reason: string
}
Response: {
  success: true
}
```

#### 5.6 Print Refund Form
```
GET /api/sales/refunds/:id/print
Response: HTML/PDF for printing
```

### Phase 6: UI Updates

#### 6.1 Sales History Status Column
- **Active** (gray) - Normal sale, not refunded
- **Pending** (yellow/orange) - Refund requested, waiting confirmation
- **Refunded** (green) - Refund confirmed, quantity returned to stock

#### 6.2 Refunds Page Layout
- Top section: Search, Filters, Status tabs
- Main table: List of refunds
- Side panel or modal: Refund details when clicked
- Action buttons: Confirm, Cancel, Print

#### 6.3 Grouping by CM#
- Group refund items by CM# in the refunds list
- Show CM# as a header/badge
- Allow filtering/searching by CM#

### Phase 7: Implementation Steps

1. **Step 1:** Create database tables (refunds, refund_items)
2. **Step 2:** Create API endpoints for refund operations
3. **Step 3:** Update Sales History to create refund requests (PENDING status)
4. **Step 4:** Create Refunds page/component
5. **Step 5:** Implement confirm refund functionality (return to stock)
6. **Step 6:** Add print refund form functionality
7. **Step 7:** Add filtering and grouping by CM#
8. **Step 8:** Update Sales History to show PENDING/REFUNDED status
9. **Step 9:** Testing and refinement

## Benefits of This Workflow

1. **Two-Step Process:** Prevents accidental stock returns
2. **Audit Trail:** Complete history of all refunds with CM# tracking
3. **Flexibility:** Can cancel pending refunds if needed
4. **Accountability:** Track who created/confirmed/cancelled refunds
5. **Organization:** Group by CM# for easy tracking
6. **Documentation:** Printable refund forms for records

## Questions to Consider

1. Should refunds be grouped by CM# automatically, or allow manual CM# assignment?
2. Should there be a limit on how long refunds can stay in PENDING status?
3. Should there be approval workflow for large refund amounts?
4. Should refunded items be visible in Sales History or hidden?
5. Can items be partially refunded (e.g., 2 out of 5 units)?

## Next Steps

1. Review and approve this workflow plan
2. Implement database schema
3. Create API endpoints
4. Build Refunds page
5. Integrate with Sales History page
6. Test the complete workflow

