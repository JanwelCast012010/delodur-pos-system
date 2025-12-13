# 🏪 DELODUR Inventory System - Workflow Diagram

## System Overview
```
┌─────────────────────────────────────────────────────────────────┐
│                    DELODUR INVENTORY SYSTEM                     │
│                     Complete Workflow Flow                      │
└─────────────────────────────────────────────────────────────────┘
```

## Main Workflow Process

### 1. QUOTATION PHASE
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   CUSTOMER  │───▶│  QUOTATION  │───▶│   APPROVAL  │
│   REQUEST   │    │  CREATION   │    │   PROCESS   │
└─────────────┘    └─────────────┘    └─────────────┘
                           │
                           ▼
                   ┌─────────────┐
                   │   STATUS    │
                   │  PENDING    │
                   └─────────────┘
```

### 2. ORDER CONVERSION
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  QUOTATION  │───▶│   CONVERT   │───▶│    ORDER    │
│  APPROVED   │    │   BUTTON    │    │   CREATED   │
└─────────────┘    └─────────────┘    └─────────────┘
                           │
                           ▼
                   ┌─────────────┐
                   │   STATUS    │
                   │  CONVERTED  │
                   └─────────────┘
```

### 3. WAREHOUSE PROCESSING
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    ORDER    │───▶│  WAREHOUSE  │───▶│   STOCK     │
│   ITEMS     │    │   RECEIVE   │    │  DEDUCTION  │
└─────────────┘    └─────────────┘    └─────────────┘
                           │
                           ▼
                   ┌─────────────┐
                   │   ITEMS     │
                   │  AVAILABLE  │
                   └─────────────┘
```

### 4. DISTRIBUTION DECISION
```
┌─────────────┐
│  WAREHOUSE  │
│   ITEMS     │
└─────────────┘
        │
        ├─────────────────┬─────────────────┐
        ▼                 ▼                 ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   SERVICE   │  │   CASHIER   │  │   DIRECT    │
│   BUTTON    │  │   BUTTON    │  │    SALE     │
└─────────────┘  └─────────────┘  └─────────────┘
        │                 │                 │
        ▼                 ▼                 ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   SERVICE   │  │   CASHIER   │  │   HISTORY   │
│   ORDERS    │  │    CART     │  │   RECORD    │
└─────────────┘  └─────────────┘  └─────────────┘
```

### 5. SERVICE WORKFLOW
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   SERVICE   │───▶│   SERVICE   │───▶│   SERVICE   │
│   ORDERS    │    │  PROCESSING │    │  DECISION   │
└─────────────┘    └─────────────┘    └─────────────┘
                           │
                           ▼
                   ┌─────────────┐
                   │   CHOOSE    │
                   │   ACTION    │
                   └─────────────┘
                           │
                   ┌───────┴───────┐
                   ▼               ▼
           ┌─────────────┐ ┌─────────────┐
           │  TO CASHIER │ │ TO STOCK    │
           │   BUTTON    │ │  BUTTON     │
           └─────────────┘ └─────────────┘
                   │               │
                   ▼               ▼
           ┌─────────────┐ ┌─────────────┐
           │   CASHIER   │ │  WAREHOUSE  │
           │    CART     │ │   STOCK     │
           └─────────────┘ └─────────────┘
```

### 6. CASHIER WORKFLOW
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   CASHIER   │───▶│   SHOPPING  │───▶│   PAYMENT   │
│    CART     │    │    CART     │    │ PROCESSING  │
└─────────────┘    └─────────────┘    └─────────────┘
                           │
                           ▼
                   ┌─────────────┐
                   │   CALCULATE │
                   │ SUBTOTAL +  │
                   │ 12% VAT     │
                   └─────────────┘
                           │
                           ▼
                   ┌─────────────┐
                   │   COMPLETE  │
                   │    SALE     │
                   └─────────────┘
                           │
                           ▼
                   ┌─────────────┐
                   │   HISTORY   │
                   │   RECORD    │
                   └─────────────┘
```

## Complete System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        SYSTEM ENTRY POINT                      │
│                         (Login Required)                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         DASHBOARD                              │
│  • View System Overview                                        │
│  • Access All Modules                                          │
│  • Quick Actions                                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    QUOTATION MANAGEMENT                        │
│  • Create New Quotation                                        │
│  • Add Items from Stock                                        │
│  • Set Customer Details                                        │
│  • Approve/Reject Quotations                                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ORDER CONVERSION                          │
│  • Convert Approved Quotation to Order                         │
│  • Deduct Stock Quantities                                     │
│  • Generate Order Number                                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      WAREHOUSE MANAGEMENT                      │
│  • View Available Stock                                        │
│  • Send Items to Service                                       │
│  • Send Items to Cashier                                       │
│  • Direct Sales Processing                                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   SERVICE       │ │    CASHIER      │ │   DIRECT SALE   │
│   ORDERS        │ │     CART        │ │   PROCESSING    │
│                 │ │                 │ │                 │
│ • Process Items │ │ • Shopping Cart │ │ • Immediate     │
│ • Send to       │ │ • 12% VAT Calc  │ │   Sale          │
│   Cashier       │ │ • Payment       │ │ • History       │
│ • Return to     │ │   Processing    │ │   Recording     │
│   Stock         │ │                 │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SALES HISTORY                             │
│  • Record All Transactions                                     │
│  • Track Sales Performance                                     │
│  • Generate Reports                                            │
└─────────────────────────────────────────────────────────────────┘
```

## Key Features

### 🔐 Authentication
- JWT Token-based Security
- Role-based Access Control
- Session Management

### 📊 Data Management
- MySQL Database
- Real-time Stock Updates
- Transaction History
- Customer Information

### 💰 Financial Processing
- 12% VAT Calculation
- Multiple Payment Methods
- Receipt Generation
- Sales Reporting

### 🔄 Workflow States
- **Pending**: Quotation awaiting approval
- **Approved**: Quotation ready for conversion
- **Converted**: Quotation converted to order
- **Expired**: Quotation past expiry date
- **Sold**: Items sold to customer
- **Returned**: Items returned to stock

## System Benefits

✅ **Streamlined Process**: Clear workflow from quotation to sale
✅ **Real-time Updates**: Instant stock level changes
✅ **Flexible Distribution**: Multiple paths for item processing
✅ **Complete Tracking**: Full audit trail of all transactions
✅ **User-friendly Interface**: Intuitive design for all users
✅ **Scalable Architecture**: Easy to extend and modify

---

*This workflow ensures efficient inventory management with clear separation of concerns and multiple processing paths for different business needs.*
