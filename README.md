# Leopard ERP & POS — Enterprise Retail & Pharmacy Management System

A high-performance, offline-resilient Point of Sale (POS) and Enterprise Resource Planning (ERP) platform built with Next.js App Router, TypeScript, and Dexie.js IndexedDB.

---

## 🏗️ Architecture Overview

The system is architected as a **Modular Monolith** designed for high throughput, zero-latency desktop workflows, and complete offline resilience.

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Presentation Layer               │
│   (Dashboard, POS Terminal, Stocktaking, Financial Reports) │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
┌──────────────▼──────────────┐ ┌──────────────▼──────────────┐
│     Client Domain Logic     │ │    Store & Auth Providers   │
│ (Finance, Inventory, RBAC)  │ │ (Tenant Isolation, Roles)   │
└──────────────┬──────────────┘ └──────────────┬──────────────┘
               │                               │
┌──────────────▼───────────────────────────────▼──────────────┐
│                    Dexie.js (IndexedDB)                     │
│    25+ Typed Tables • ACID Transactions • Live Queries      │
└──────────────┬──────────────────────────────────────────────┘
               │
┌──────────────▼──────────────┐
│    Sync Queue & Telemetry   │
│   (Background Sync Engine)  │
└─────────────────────────────┘
```

---

## 🚀 Key Modules & Capabilities

### 1. Point of Sale (POS Terminal)
- Sub-millisecond barcode lookups and rapid search (`F2` shortcut focus).
- Real-time stock enforcement: prevents selling zero/negative stock with automatic unit disassembly conversions.
- Comprehensive cart controls: hold/resume sales, item discounts, price list selector (Retail/Wholesale), and multiple payment methods (Cash, Card, Credit).
- Thermal receipt engine with printable layouts (58mm/80mm).

### 2. Multi-Activity Support
- **Supermarkets & Groceries:** Weight scale barcode parsing, multi-barcode item association, and fractional weight calculations.
- **Pharmacies:** Batch number tracking, expiry date monitoring with near-expiry alerts, scientific name indexing, and prescription management.
- **Apparel & General Retail:** Size/Color variants, minimum order limits, and category hierarchies.

### 3. Inventory & Stock Ledger
- Double-entry stock movements: `purchase`, `sale`, `transfer_in`, `transfer_out`, `adjustment`, `sale_return`, and `purchase_return`.
- Strict multi-branch stock transfers with source availability verification.
- Stocktaking and discrepancy adjustment workflows.

### 4. Financial Reporting & Analytics
- Dynamic revenue, profit margin, and Cost of Goods Sold (COGS) analytics.
- Real-time inventory valuation (Cost vs. Expected Retail Value).
- Cash drawer management and end-of-shift closing reconciliations.

### 5. Multi-Tenant Administration & Licensing
- Complete store isolation using `store_id` compound queries.
- Cryptographic license token generation and tenant lifecycle control.
- Silent error telemetry and audit logging.

---

## 🛠️ Technology Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5.x (Strict Type Safety)
- **Styling:** Tailwind CSS + Lucide Icons
- **Client Storage:** Dexie.js (IndexedDB Wrapper with React Live Hooks)
- **Visualizations:** Recharts (Dynamic Financial & Sales Breakdown)
- **Notifications:** Sonner Toast Notifications

---

## 💻 Getting Started

### Prerequisites
- Node.js 18.x or later
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/abdullahprocom/leopard-pos.git

# Install dependencies
npm install

# Run development server
npm run dev
```

Visit `http://localhost:3000` to launch the application.

### Production Build

```bash
npm run build
npm run start
```

---

## 🔒 License & Intellectual Property

Proprietary Enterprise Software. All rights reserved.
