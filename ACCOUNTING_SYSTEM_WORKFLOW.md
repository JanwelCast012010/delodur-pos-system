# Accounting System Workflow

## Overview
This document outlines the workflow for an integrated accounting system connected to the inventory management system.

---

## 1. SALES WORKFLOW (Inventory → Accounting)

```
[Customer Purchase]
    ↓
[Cashier/Point of Sale]
    ↓
┌─────────────────────────────────────┐
│ INVENTORY SYSTEM                     │
│ - Deduct stock quantity              │
│ - Record sale                        │
│ - Calculate total                    │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ AUTO-POST TO ACCOUNTING              │
│                                      │
│ DEBIT:  Cash/Accounts Receivable    │
│ CREDIT: Sales Revenue                │
│ DEBIT:  Cost of Goods Sold (COGS)   │
│ CREDIT: Inventory Asset              │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ GENERAL LEDGER                      │
│ - Update account balances           │
│ - Create audit trail                │
└─────────────────────────────────────┘
```

**Example Entry:**
- Customer buys item for ₱1,000 (cost: ₱600)
- **Debit** Cash: ₱1,000
- **Credit** Sales Revenue: ₱1,000
- **Debit** COGS: ₱600
- **Credit** Inventory: ₱600

---

## 2. PURCHASE WORKFLOW (Supplier → Accounting)

```
[Purchase Order Created]
    ↓
[Receive Goods from Supplier]
    ↓
┌─────────────────────────────────────┐
│ INVENTORY SYSTEM                     │
│ - Add stock quantity                │
│ - Record purchase                   │
│ - Update supplier info              │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ AUTO-POST TO ACCOUNTING              │
│                                      │
│ DEBIT:  Inventory Asset              │
│ CREDIT: Accounts Payable            │
│                                      │
│ (When paid)                          │
│ DEBIT:  Accounts Payable            │
│ CREDIT: Cash/Bank                    │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ GENERAL LEDGER                      │
│ - Update account balances           │
│ - Track payables                    │
└─────────────────────────────────────┘
```

**Example Entry:**
- Purchase ₱5,000 worth of inventory
- **Debit** Inventory: ₱5,000
- **Credit** Accounts Payable: ₱5,000
- (When paid) **Debit** Accounts Payable: ₱5,000, **Credit** Cash: ₱5,000

---

## 3. ACCOUNTS RECEIVABLE (AR) WORKFLOW

```
[Sale on Credit]
    ↓
┌─────────────────────────────────────┐
│ CREATE INVOICE                      │
│ - Invoice #                         │
│ - Customer                          │
│ - Amount                            │
│ - Due Date                          │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ POST TO ACCOUNTING                   │
│                                      │
│ DEBIT:  Accounts Receivable         │
│ CREDIT: Sales Revenue                │
└─────────────────────────────────────┘
    ↓
[Customer Payment Received]
    ↓
┌─────────────────────────────────────┐
│ RECORD PAYMENT                       │
│                                      │
│ DEBIT:  Cash                         │
│ CREDIT: Accounts Receivable          │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ UPDATE CUSTOMER BALANCE              │
│ - Mark invoice as paid              │
│ - Update aging report               │
└─────────────────────────────────────┘
```

---

## 4. ACCOUNTS PAYABLE (AP) WORKFLOW

```
[Receive Supplier Invoice]
    ↓
┌─────────────────────────────────────┐
│ RECORD BILL                          │
│ - Bill #                            │
│ - Supplier                          │
│ - Amount                            │
│ - Due Date                          │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ POST TO ACCOUNTING                   │
│                                      │
│ DEBIT:  Expense/Inventory            │
│ CREDIT: Accounts Payable            │
└─────────────────────────────────────┘
    ↓
[Payment Due Date Approaches]
    ↓
┌─────────────────────────────────────┐
│ GENERATE PAYMENT                     │
│                                      │
│ DEBIT:  Accounts Payable            │
│ CREDIT: Cash/Bank                    │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ UPDATE SUPPLIER BALANCE              │
│ - Mark bill as paid                 │
│ - Update aging report               │
└─────────────────────────────────────┘
```

---

## 5. GENERAL JOURNAL ENTRY WORKFLOW

```
[Manual Transaction Needed]
    ↓
┌─────────────────────────────────────┐
│ CREATE JOURNAL ENTRY                 │
│ - Date                              │
│ - Description                       │
│ - Debit Account(s)                  │
│ - Credit Account(s)                 │
│ - Amount (must balance!)            │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ VALIDATE DOUBLE-ENTRY                │
│ - Total Debits = Total Credits      │
│ - All accounts valid                │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ POST TO GENERAL LEDGER               │
│ - Update account balances           │
│ - Create audit trail                │
└─────────────────────────────────────┘
```

**Example:**
- Adjust inventory value
- **Debit** Inventory Adjustment: ₱500
- **Credit** Inventory: ₱500

---

## 6. MONTH-END CLOSING WORKFLOW

```
[End of Month]
    ↓
┌─────────────────────────────────────┐
│ RECONCILE ACCOUNTS                   │
│ - Bank reconciliation               │
│ - AR aging review                   │
│ - AP aging review                   │
│ - Inventory count vs. books         │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ GENERATE FINANCIAL REPORTS           │
│ - Trial Balance                     │
│ - Income Statement (P&L)            │
│ - Balance Sheet                     │
│ - Cash Flow Statement               │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ CLOSE REVENUE & EXPENSE ACCOUNTS     │
│ - Transfer to Retained Earnings     │
│ - Reset for new period              │
└─────────────────────────────────────┘
```

---

## 7. INTEGRATED WORKFLOW (Inventory + Accounting)

```
┌─────────────────────────────────────────────────────────┐
│                    INVENTORY SYSTEM                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Sales   │  │ Purchase │  │  Stock   │              │
│  │  Module  │  │  Module  │  │  Module  │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │             │             │                     │
│       └─────────────┼─────────────┘                     │
│                     │                                   │
│              [Transaction Event]                        │
└─────────────────────┼───────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│                 ACCOUNTING SYSTEM                        │
│  ┌──────────────────────────────────────┐              │
│  │      TRANSACTION PROCESSOR            │              │
│  │  - Receives inventory events          │              │
│  │  - Creates accounting entries         │              │
│  │  - Validates double-entry             │              │
│  └──────────────┬───────────────────────┘              │
│                 │                                       │
│    ┌────────────┼────────────┐                         │
│    ↓            ↓            ↓                         │
│  ┌──────┐   ┌──────┐   ┌──────┐                        │
│  │  AR  │   │  AP  │   │  GL  │                        │
│  └──────┘   └──────┘   └──────┘                        │
│    │            │            │                         │
│    └────────────┼────────────┘                         │
│                 ↓                                       │
│         ┌───────────────┐                              │
│         │   REPORTS     │                              │
│         │  - P&L        │                              │
│         │  - Balance    │                              │
│         │  - Cash Flow  │                              │
│         └───────────────┘                              │
└─────────────────────────────────────────────────────────┘
```

---

## 8. KEY ACCOUNTING RULES

### Double-Entry Principle
- **Every transaction must have equal debits and credits**
- Total Debits = Total Credits

### Account Types

**ASSETS (Debit increases, Credit decreases)**
- Cash
- Accounts Receivable
- Inventory
- Equipment

**LIABILITIES (Credit increases, Debit decreases)**
- Accounts Payable
- Loans Payable
- Accrued Expenses

**EQUITY (Credit increases, Debit decreases)**
- Capital
- Retained Earnings

**REVENUE (Credit increases, Debit decreases)**
- Sales Revenue
- Service Revenue

**EXPENSES (Debit increases, Credit decreases)**
- Cost of Goods Sold
- Operating Expenses
- Salaries

---

## 9. SAMPLE TRANSACTION FLOW

### Scenario: Customer buys 10 items at ₱100 each (cost: ₱60 each)

**Step 1: Inventory System**
- Reduce stock: -10 units
- Record sale: ₱1,000

**Step 2: Auto-Post to Accounting**
```
DEBIT   Cash                    ₱1,000
CREDIT  Sales Revenue           ₱1,000

DEBIT   Cost of Goods Sold      ₱600
CREDIT  Inventory                ₱600
```

**Step 3: Update General Ledger**
- Cash balance: +₱1,000
- Sales Revenue: +₱1,000
- COGS: +₱600
- Inventory: -₱600

**Step 4: Result**
- Net Profit: ₱400 (₱1,000 - ₱600)
- Cash increased by ₱1,000
- Inventory decreased by ₱600

---

## 10. REPORTING WORKFLOW

```
[Request Report]
    ↓
┌─────────────────────────────────────┐
│ QUERY GENERAL LEDGER                 │
│ - Filter by date range              │
│ - Filter by account                 │
│ - Calculate balances                │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ GENERATE REPORT                      │
│                                      │
│ INCOME STATEMENT:                    │
│ - Revenue                            │
│ - COGS                               │
│ - Expenses                           │
│ - Net Income                         │
│                                      │
│ BALANCE SHEET:                       │
│ - Assets                             │
│ - Liabilities                        │
│ - Equity                             │
│                                      │
│ TRIAL BALANCE:                       │
│ - All accounts with balances        │
│ - Verify debits = credits           │
└─────────────────────────────────────┘
```

---

## 11. ERROR HANDLING & VALIDATION

```
[Transaction Attempt]
    ↓
┌─────────────────────────────────────┐
│ VALIDATE                             │
│ ✓ Debits = Credits?                 │
│ ✓ Accounts exist?                   │
│ ✓ Amounts valid?                    │
│ ✓ Date valid?                       │
│ ✓ User has permission?              │
└─────────────────────────────────────┘
    ↓
    ├─ [Valid] → Post to GL
    │
    └─ [Invalid] → Return Error
                   - Show message
                   - Log attempt
                   - Prevent posting
```

---

## 12. USER ROLES & PERMISSIONS

```
┌─────────────────────────────────────┐
│ ACCOUNTANT                           │
│ - Full access                        │
│ - Create journal entries             │
│ - Post transactions                  │
│ - Generate reports                   │
│ - Close periods                      │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ MANAGER                              │
│ - View reports                       │
│ - Approve transactions               │
│ - View audit trail                   │
│ - No posting rights                  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ CASHIER/SALES                        │
│ - Create sales (auto-post)           │
│ - View own transactions              │
│ - No manual journal entries          │
└─────────────────────────────────────┘
```

---

## Summary

This workflow shows how transactions flow from inventory operations into the accounting system, maintaining proper double-entry bookkeeping and providing complete financial visibility. All inventory transactions automatically create corresponding accounting entries, ensuring accurate financial records.

