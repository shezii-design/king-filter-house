/**
 * Mock database & utilities with localStorage persistence
 */

import { Product, CrossReference, StockMovement, Party, Invoice, Return, Quotation, PaymentRecord, ChequeRecord, CashTransaction, SupplierBill, PurchaseOrder, PurchaseOrderItem, ProcurementJob, RareImportDemand } from './types';
import { pushKeyToSupabase, pullKeyFromSupabase, getSupabaseConfig } from './supabase';

// Normalization rule
export function normalizeCode(code: string): string {
  return code.replace(/[-.\s]/g, '').toUpperCase();
}

// Ensure insecure HTTP URLs are automatically upgraded to HTTPS to avoid Mixed Content errors
export function ensureHttpsUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('http://')) {
    return 'https://' + trimmed.substring(7);
  }
  return trimmed;
}

// Custom 1-0 Cipher e.g. "SAKURYFLOW" representing [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
// Note: S=1, A=2, K=3, U=4, R=5, Y=6, F=7, L=8, O=9, W=0
export function encodeCipher(num: number, cipherKey: string = "SAKURYFLOW"): string {
  if (isNaN(num) || num < 0) return "••••";
  const normalizedKey = cipherKey.toUpperCase().padEnd(10, 'X').substring(0, 10);
  const digits = Math.round(num).toString().split('');
  return digits.map(digit => {
    const val = parseInt(digit, 10);
    if (val === 0) {
      return normalizedKey[9]; // 10th char represents 0
    } else {
      return normalizedKey[val - 1]; // 1-9 represent index 0-8
    }
  }).join('');
}

// Initial seed products
const INITIAL_PRODUCTS: Product[] = [
  {
    id: "prod-1",
    part_number: "C-6204",
    part_number_norm: "C6204",
    brand: "Sakura",
    category: "Oil Filter",
    subtype: "C",
    pack_size: "",
    grade: "standard",
    shelf_location: "Row 2-A",
    thread_size: "3/4-16 UNF",
    height_mm: 85,
    od_mm: 68,
    micron_rating: null,
    cabin_filter: "No",
    supplier_code: "SAK-C6204",
    notes: "High demand import, fits Toyota Corolla, Hilux older models.",
    sale_price: 1450,
    cost_price: 1180,
    stock_qty: 45,
    damaged_qty: 0,
    min_stock_alert: 10,
    is_active: true,
    created_at: "2026-06-15T10:00:00Z"
  },
  {
    id: "prod-2",
    part_number: "C-1815",
    part_number_norm: "C1815",
    brand: "Sakura",
    category: "Oil Filter",
    subtype: "O",
    pack_size: "",
    grade: "high_temp",
    shelf_location: "Row 3-B",
    thread_size: "1-12 UNF",
    height_mm: 125,
    od_mm: 93,
    micron_rating: null,
    cabin_filter: "No",
    supplier_code: "SAK-C1815",
    notes: "Heavy duty oil filter, fits Nissan Diesel trucks.",
    sale_price: 1800,
    cost_price: 1400,
    stock_qty: 6,
    damaged_qty: 1,
    min_stock_alert: 8,
    is_active: true,
    created_at: "2026-06-15T11:00:00Z"
  },
  {
    id: "prod-3",
    part_number: "F-1111",
    part_number_norm: "F1111",
    brand: "Sakura",
    category: "Fuel Filter",
    subtype: "FC",
    pack_size: "",
    grade: "normal",
    shelf_location: "Row 1-A",
    thread_size: "M20x1.5",
    height_mm: 140,
    od_mm: 80,
    micron_rating: null,
    cabin_filter: "No",
    supplier_code: "SAK-F1111",
    notes: "Fuel filter for Toyota Hilux Revo.",
    sale_price: 2100,
    cost_price: 1750,
    stock_qty: 0,
    damaged_qty: 0,
    min_stock_alert: 5,
    is_active: true,
    created_at: "2026-06-16T09:20:00Z"
  },
  {
    id: "prod-4",
    part_number: "A-1024",
    part_number_norm: "A1024",
    brand: "Sakura",
    category: "Air Filter",
    subtype: "A",
    pack_size: "",
    grade: "A",
    shelf_location: "Row 4-C",
    thread_size: "",
    height_mm: 220,
    od_mm: 154,
    micron_rating: null,
    cabin_filter: "No",
    supplier_code: "SAK-A1024",
    notes: "Honda Civic air filter element, premium paper mesh.",
    sale_price: 3500,
    cost_price: 2900,
    stock_qty: 32,
    damaged_qty: 0,
    min_stock_alert: 10,
    is_active: true,
    created_at: "2026-06-16T10:45:00Z"
  },
  {
    id: "prod-5",
    part_number: "L-6204",
    part_number_norm: "L6204",
    brand: "Local",
    category: "Oil Filter",
    subtype: "C",
    pack_size: "",
    grade: "normal",
    shelf_location: "Row 2-D",
    thread_size: "3/4-16 UNF",
    height_mm: 85,
    od_mm: 68,
    micron_rating: null,
    cabin_filter: "No",
    supplier_code: "LOC-6204",
    notes: "Local domestic alternative for C-6204.",
    sale_price: 850,
    cost_price: 650,
    stock_qty: 20,
    damaged_qty: 0,
    min_stock_alert: 5,
    is_active: true,
    created_at: "2026-06-17T08:30:00Z"
  },
  {
    id: "prod-6",
    part_number: "B2-C",
    part_number_norm: "B2C",
    brand: "Baldwin",
    category: "Oil Filter",
    subtype: "C",
    pack_size: "",
    grade: "SP",
    shelf_location: "Row 2-A",
    thread_size: "3/4-16 UNF",
    height_mm: 87,
    od_mm: 70,
    micron_rating: null,
    cabin_filter: "No",
    supplier_code: "BAL-B2C",
    notes: "USA brand premium spin-on filter, highly durable.",
    sale_price: 2500,
    cost_price: 2050,
    stock_qty: 12,
    damaged_qty: 0,
    min_stock_alert: 3,
    is_active: true,
    created_at: "2026-06-17T11:15:00Z"
  },
  {
    id: "prod-7",
    part_number: "Mobil Special 20W-50",
    part_number_norm: "MOBILSPECIAL20W50",
    brand: "Mobil",
    category: "Engine Oil",
    subtype: "",
    pack_size: "4L can",
    grade: "high_temp",
    shelf_location: "Oil Rack 1",
    thread_size: "",
    height_mm: null,
    od_mm: null,
    micron_rating: null,
    cabin_filter: "No",
    supplier_code: "MOB-20W50-4L",
    notes: "Multi-grade mineral engine oil for passenger cars.",
    sale_price: 4800,
    cost_price: 4100,
    stock_qty: 15,
    damaged_qty: 0,
    min_stock_alert: 5,
    is_active: true,
    created_at: "2026-06-18T14:00:00Z"
  },
  {
    id: "prod-8",
    part_number: "Caltex Delo 400",
    part_number_norm: "CALTEXDELO400",
    brand: "Caltex",
    category: "Engine Oil",
    subtype: "",
    pack_size: "4L can",
    grade: "SP",
    shelf_location: "Oil Rack 2",
    thread_size: "",
    height_mm: null,
    od_mm: null,
    micron_rating: null,
    cabin_filter: "No",
    supplier_code: "CAL-D400-4L",
    notes: "Premium heavy-duty fleet engine oil.",
    sale_price: 5200,
    cost_price: 4450,
    stock_qty: 2,
    damaged_qty: 0,
    min_stock_alert: 5,
    is_active: true,
    created_at: "2026-06-18T15:30:00Z"
  }
];

// Initial seed cross references
const INITIAL_CROSS_REFS: CrossReference[] = [
  {
    id: "cref-1",
    product_id_1: "prod-1", // Sakura C-6204
    product_id_2: "prod-5", // Local L-6204
    match_type: "exact_match",
    source: "manual",
    discovered_invoice_id: null,
    is_active: true,
    created_at: "2026-06-17T09:00:00Z"
  },
  {
    id: "cref-2",
    product_id_1: "prod-5", // Local L-6204
    product_id_2: "prod-1", // Sakura C-6204
    match_type: "exact_match",
    source: "manual",
    discovered_invoice_id: null,
    is_active: true,
    created_at: "2026-06-17T09:00:00Z"
  },
  {
    id: "cref-3",
    product_id_1: "prod-1", // Sakura C-6204
    product_id_2: "prod-6", // Baldwin B2-C
    match_type: "compatible",
    source: "manual",
    discovered_invoice_id: null,
    is_active: true,
    created_at: "2026-06-17T11:30:00Z"
  },
  {
    id: "cref-4",
    product_id_1: "prod-6", // Baldwin B2-C
    product_id_2: "prod-1", // Sakura C-6204
    match_type: "compatible",
    source: "manual",
    discovered_invoice_id: null,
    is_active: true,
    created_at: "2026-06-17T11:30:00Z"
  }
];

// Initial seed stock movements
const INITIAL_MOVEMENTS: StockMovement[] = [
  {
    id: "mov-1",
    product_id: "prod-1",
    qty_change: 45,
    from_status: "none",
    to_status: "sellable",
    type: "opening_stock",
    user: "Owner",
    timestamp: "2026-06-15T10:00:00Z",
    reason: "Opening inventory load."
  },
  {
    id: "mov-2",
    product_id: "prod-2",
    qty_change: 7,
    from_status: "none",
    to_status: "sellable",
    type: "opening_stock",
    user: "Owner",
    timestamp: "2026-06-15T11:00:00Z",
    reason: "Opening inventory load."
  },
  {
    id: "mov-3",
    product_id: "prod-2",
    qty_change: -1,
    from_status: "sellable",
    to_status: "damaged",
    type: "damaged",
    user: "Staff",
    timestamp: "2026-06-16T14:45:00Z",
    reason: "In-shop dropping damage, thread bent."
  },
  {
    id: "mov-4",
    product_id: "prod-4",
    qty_change: 32,
    from_status: "none",
    to_status: "sellable",
    type: "opening_stock",
    user: "Owner",
    timestamp: "2026-06-16T10:45:00Z",
    reason: "Opening inventory load."
  },
  {
    id: "mov-5",
    product_id: "prod-5",
    qty_change: 20,
    from_status: "none",
    to_status: "sellable",
    type: "opening_stock",
    user: "Owner",
    timestamp: "2026-06-17T08:30:00Z",
    reason: "Opening inventory load."
  },
  {
    id: "mov-6",
    product_id: "prod-6",
    qty_change: 12,
    from_status: "none",
    to_status: "sellable",
    type: "opening_stock",
    user: "Owner",
    timestamp: "2026-06-17T11:15:00Z",
    reason: "Opening stocks loaded."
  },
  {
    id: "mov-7",
    product_id: "prod-7",
    qty_change: 15,
    from_status: "none",
    to_status: "sellable",
    type: "opening_stock",
    user: "Owner",
    timestamp: "2026-06-18T14:00:00Z",
    reason: "Opening stock."
  },
  {
    id: "mov-8",
    product_id: "prod-8",
    qty_change: 2,
    from_status: "none",
    to_status: "sellable",
    type: "opening_stock",
    user: "Owner",
    timestamp: "2026-06-18T15:30:00Z",
    reason: "Opening stock intake."
  }
];

// Initial seed parties
const INITIAL_PARTIES: Party[] = [
  {
    id: "part-1",
    type: "customer",
    customer_type: "regular",
    name: "Ahmad Autos Faisalabad",
    phone: "0300-1234567",
    city: "Faisalabad",
    credit_balance: 14500, // Debitable/Receivable from them
    credit_limit: 50000,
    payment_terms: "Cash only",
    address: "Auto Market, D-Ground, Faisalabad",
    is_active: true,
    created_at: "2026-06-15T12:00:00Z"
  },
  {
    id: "part-2",
    type: "shopkeeper",
    customer_type: "shopkeeper",
    name: "Madina Filter Mart",
    phone: "0321-7654321",
    city: "Samundri",
    credit_balance: 35000,
    credit_limit: 100000,
    payment_terms: "15 days",
    address: "Gojra Road, Samundri",
    is_active: true,
    created_at: "2026-06-16T15:00:00Z"
  },
  {
    id: "part-3",
    type: "supplier",
    name: "Sakura Import Distributor Pakistan",
    phone: "021-3445566",
    city: "Karachi",
    credit_balance: -120000, // Payable to them
    is_active: true,
    created_at: "2026-06-10T11:00:00Z"
  },
  {
    id: "part-4",
    type: "supplier",
    name: "Faisalabad Local Oil Wholesalers",
    phone: "0312-9988776",
    city: "Faisalabad",
    credit_balance: -45000, // Payable to them
    is_active: true,
    created_at: "2026-06-11T16:00:00Z"
  },
  {
    id: "part-5",
    type: "customer",
    customer_type: "company",
    name: "Faisalabad Textile Mills Ltd",
    phone: "041-9201041",
    phone2: "0300-8654321",
    city: "Faisalabad",
    credit_balance: 85000,
    credit_limit: 250000,
    payment_terms: "15 days",
    ntn: "4820155-2",
    address: "Sargodha Road, Industrial Area, Faisalabad, Punjab",
    notes: "Requires original sales tax invoice. High-volume manufacturing purchaser.",
    is_supplier_linked: false,
    is_active: true,
    created_at: "2026-06-12T09:00:00Z",
    sites: [
      { id: 'site-1', name: 'Spinning Unit A' },
      { id: 'site-2', name: 'Weaving Unit B' }
    ],
    machines: [
      {
        id: 'mac-1',
        site_id: 'site-1',
        name: 'Toyota RX300 Loom Compressor',
        type_model: '1TR-FE Industrial',
        operator_name: 'Muhammad Bilal',
        purchaser_name: 'M. Shahbaz (Sourcing)',
        filters: [
          {
            id: 'fr-1',
            product_id: 'prod-1',
            part_number: 'C-6204',
            brand: 'Sakura',
            qty: 2,
            position: 'Main Engine Oil Filter',
            agreed_price: 1400,
            change_interval: 'Every 250 hours',
            last_sold_price: 1420,
            last_sold_date: '2026-06-19'
          },
          {
            id: 'fr-2',
            product_id: 'prod-3',
            part_number: 'F-1111',
            brand: 'Sakura',
            qty: 1,
            position: 'Primary Fuel Line Separator',
            agreed_price: 2000,
            change_interval: 'Every 500 hours'
          }
        ]
      },
      {
        id: 'mac-2',
        site_id: 'site-2',
        name: 'Sulzer Air Jet Loom',
        type_model: 'L5500 Series',
        operator_name: 'Abdul Majeed',
        purchaser_name: 'M. Shahbaz (Sourcing)',
        filters: [
          {
            id: 'fr-3',
            product_id: 'prod-4',
            part_number: 'A-1024',
            brand: 'Sakura',
            qty: 1,
            position: 'Cabin Intake Purifier',
            agreed_price: 3400,
            change_interval: 'Every 1,000 hours'
          }
        ]
      }
    ],
    custom_prices: []
  }
];

// Seed Invoices
const INITIAL_INVOICES: Invoice[] = [
  {
    id: "inv-1",
    invoice_number: "KFH-2026-0001",
    party_id: "part-1",
    customer_name: "Ahmad Autos Faisalabad",
    items: [
      {
        id: "line-1",
        product_id: "prod-1",
        part_number: "C-6204",
        brand: "Sakura",
        sale_price: 1450,
        qty: 10,
        line_total: 14500
      }
    ],
    total_amount: 14500,
    discount: 500,
    net_amount: 14000,
    received_amount: 14000,
    status: "confirmed",
    user: "Owner",
    timestamp: "2026-06-19T11:30:00Z",
    is_active: true
  }
];

// Initial seed supplier bills
const INITIAL_SUPPLIER_BILLS: SupplierBill[] = [
  {
    id: "bill-1",
    bill_number: "SUP-SQR-8822",
    party_id: "part-3",
    supplier_name: "Sakura Import Distributor Pakistan",
    amount: 150000,
    paid_amount: 30000,
    due_amount: 120000,
    timestamp: "2026-06-10T11:00:00Z",
    date: "2026-06-10",
    is_active: true
  },
  {
    id: "bill-2",
    bill_number: "SUP-FLW-5612",
    party_id: "part-4",
    supplier_name: "Faisalabad Local Oil Wholesalers",
    amount: 80000,
    paid_amount: 35000,
    due_amount: 45000,
    timestamp: "2026-06-11T16:00:00Z",
    date: "2026-06-11",
    is_active: true
  }
];

const INITIAL_CHEQUES: ChequeRecord[] = [
  {
    id: "ch-1",
    cheque_number: "CHQ-88910S",
    bank_name: "Habib Bank Ltd (HBL)",
    party_id: "part-1",
    party_name: "Ahmad Autos Faisalabad",
    amount: 12500,
    due_date: "2026-06-25",
    received_date: "2026-06-19",
    status: "pending",
    type: "receipt"
  },
  {
    id: "ch-2",
    cheque_number: "CHQ-99015U",
    bank_name: "Meezan Bank",
    party_id: "part-2",
    party_name: "Madina Filter Mart",
    amount: 25000,
    due_date: "2026-06-18",
    received_date: "2026-06-15",
    status: "pending",
    type: "receipt"
  }
];

const INITIAL_CASH_BOOK: CashTransaction[] = [
  {
    id: "cb-1",
    date: "2026-06-20",
    timestamp: "2026-06-20T09:00:00Z",
    description: "Opening business cash register",
    reference: "KFH-REG-01",
    type: "in",
    amount: 250000,
    running_balance: 250000
  },
  {
    id: "cb-2",
    date: "2026-06-20",
    timestamp: "2026-06-20T10:30:00Z",
    description: "Paid local tea shop bill",
    reference: "KFH-EXP-44",
    type: "out",
    amount: 500,
    running_balance: 249500
  }
];

const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: "po-1",
    po_number: "PO-2026-0001",
    supplier_id: "part-3",
    supplier_name: "Sakura Import Distributor Pakistan",
    status: "in_progress",
    order_date: "2026-06-18",
    expected_date: "2026-06-25",
    items: [
      {
        id: "poi-1",
        product_id: "prod-1",
        part_number: "C-6204",
        brand: "Sakura",
        qty_ordered: 20,
        qty_received: 5,
        agreed_cost: 1180,
        actual_cost: 1180,
        line_total: 23600
      },
      {
        id: "poi-2",
        product_id: "prod-3",
        part_number: "F-1111",
        brand: "Sakura",
        qty_ordered: 10,
        qty_received: 0,
        agreed_cost: 1750,
        line_total: 17500
      }
    ],
    total_amount: 41100,
    discount: 0,
    net_amount: 41100,
    received_amount: 0,
    is_active: true,
    user: "Owner"
  },
  {
    id: "po-2",
    po_number: "PO-2026-0002",
    supplier_id: "part-4",
    supplier_name: "Faisalabad Local Oil Wholesalers",
    status: "received",
    order_date: "2026-06-15",
    expected_date: "2026-06-16",
    items: [
      {
        id: "poi-3",
        product_id: "prod-7",
        part_number: "Mobil Special 20W-50",
        brand: "Mobil",
        qty_ordered: 10,
        qty_received: 10,
        agreed_cost: 4100,
        actual_cost: 4150,
        line_total: 41000
      }
    ],
    total_amount: 41000,
    discount: 1000,
    net_amount: 40000,
    received_amount: 40000,
    is_active: true,
    user: "Owner"
  }
];

const INITIAL_PROCUREMENT_JOBS: ProcurementJob[] = [
  {
    id: "job-1",
    job_number: "JOB-2026-0001",
    customer_name: "Faisalabad Textile Mills Ltd",
    item_description: "Custom High Temp Oil Filter - Baldwin USA Heavy Duty",
    qty: 5,
    status: "pending",
    date: "2026-06-20",
    purchase_cost: 2000,
    billed_amount: 3200,
    notes: "Requires fast delivery to Spinning Unit A",
    user: "Owner",
    is_active: true
  },
  {
    id: "job-2",
    job_number: "JOB-2026-0002",
    customer_name: "Ahmad Autos Faisalabad",
    item_description: "Air Filter elements pack of 20 - Local Grade B",
    qty: 20,
    status: "completed",
    date: "2026-06-19",
    purchase_cost: 500,
    billed_amount: 800,
    notes: "Picked up by operator M. Bilal",
    linked_invoice_id: "inv-1",
    linked_invoice_number: "KFH-2026-0001",
    user: "Staff",
    is_active: true
  }
];

const INITIAL_RARE_DEMANDS: RareImportDemand[] = [
  {
    id: "dem-1",
    demand_number: "DEM-2026-0001",
    customer_name: "Yousaf Hydraulic Workshop",
    phone: "0300-7654321",
    company_name: "Yousaf Brothers Ghee Mills",
    customer_item_number: "H-8512 Baldwin Spec",
    demand_qty_descr: "2 pieces after every 3 months",
    notes: "Frustrated because local copies leak oil and burn seals. Needs premium USA-imported Baldwin spec only.",
    status: "pending",
    brand_targeted: "Baldwin",
    date: "2026-06-21",
    user: "Owner",
    is_active: true
  },
  {
    id: "dem-2",
    demand_number: "DEM-2026-0002",
    customer_name: "Engr. Noman Shakeel",
    phone: "0321-9876543",
    company_name: "Sitara Chemical Industries",
    customer_item_number: "AC-AtlasDry 4B Coalescer",
    demand_qty_descr: "1 piece every 6 months",
    notes: "Requires imported high-performance coalescer element. Local foam copies damage downstream pneumatic valves.",
    status: "sourced",
    brand_targeted: "Donaldson",
    date: "2026-06-20",
    user: "Staff",
    is_active: true
  }
];

// Helper to dispatch store data synchronously to localStorage and asynchronously to Supabase cloud if active
export function saveItem(key: string, valueJson: string, syncDescription: string) {
  localStorage.setItem(key, valueJson);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kfh_data_changed', { detail: { key, syncDescription } }));
  }
  const config = getSupabaseConfig();
  if (config.isActive || (config.url && config.anonKey)) {
    pushKeyToSupabase(key, valueJson)
      .then((success) => {
        if (success) {
          db.logPendingSync(`[Cloud Handshake]: Synced (${syncDescription})`);
        } else {
          db.logPendingSync(`Offline write fallback: Enqueued update (${syncDescription})`);
        }
      })
      .catch(() => {
        db.logPendingSync(`Network fail retry: Enqueued update (${syncDescription})`);
      });
  } else {
    db.logPendingSync(syncDescription);
  }
}

// Helper to initialize LocalStorage if empty
  export function initDB() {
  const isPurged = localStorage.getItem('kfh_db_purged') === 'true';

  if (!localStorage.getItem('kfh_products')) {
    localStorage.setItem('kfh_products', JSON.stringify(isPurged ? [] : INITIAL_PRODUCTS));
  }
  if (!localStorage.getItem('kfh_cross_refs')) {
    localStorage.setItem('kfh_cross_refs', JSON.stringify(isPurged ? [] : INITIAL_CROSS_REFS));
  }
  if (!localStorage.getItem('kfh_movements')) {
    localStorage.setItem('kfh_movements', JSON.stringify(isPurged ? [] : INITIAL_MOVEMENTS));
  }
  if (!localStorage.getItem('kfh_parties')) {
    localStorage.setItem('kfh_parties', JSON.stringify(isPurged ? [] : INITIAL_PARTIES));
  }
  if (!localStorage.getItem('kfh_invoices')) {
    localStorage.setItem('kfh_invoices', JSON.stringify(isPurged ? [] : INITIAL_INVOICES));
  }
  if (!localStorage.getItem('kfh_returns')) {
    localStorage.setItem('kfh_returns', JSON.stringify([]));
  }
  if (!localStorage.getItem('kfh_quotations')) {
    localStorage.setItem('kfh_quotations', JSON.stringify([]));
  }
  if (!localStorage.getItem('kfh_cipher_key')) {
    localStorage.setItem('kfh_cipher_key', 'SAKURYFLOW');
  }
  if (!localStorage.getItem('kfh_user_role')) {
    localStorage.setItem('kfh_user_role', 'Owner');
  }
  if (!localStorage.getItem('kfh_payments')) {
    localStorage.setItem('kfh_payments', JSON.stringify([]));
  }
  if (!localStorage.getItem('kfh_cheques')) {
    localStorage.setItem('kfh_cheques', JSON.stringify(isPurged ? [] : INITIAL_CHEQUES));
  }
  if (!localStorage.getItem('kfh_cashbook')) {
    localStorage.setItem('kfh_cashbook', JSON.stringify(isPurged ? [] : INITIAL_CASH_BOOK));
  }
  if (!localStorage.getItem('kfh_supplier_bills')) {
    localStorage.setItem('kfh_supplier_bills', JSON.stringify(isPurged ? [] : INITIAL_SUPPLIER_BILLS));
  }
  if (!localStorage.getItem('kfh_purchase_orders')) {
    localStorage.setItem('kfh_purchase_orders', JSON.stringify(isPurged ? [] : INITIAL_PURCHASE_ORDERS));
  }
  if (!localStorage.getItem('kfh_procurement_jobs')) {
    localStorage.setItem('kfh_procurement_jobs', JSON.stringify(isPurged ? [] : INITIAL_PROCUREMENT_JOBS));
  }
  if (!localStorage.getItem('kfh_rare_demands')) {
    localStorage.setItem('kfh_rare_demands', JSON.stringify(isPurged ? [] : INITIAL_RARE_DEMANDS));
  }
}

// Database Read/Write API
export const db = {
  getProducts: (): Product[] => {
    initDB();
    const raw = JSON.parse(localStorage.getItem('kfh_products') || '[]');
    const processed = raw.map((p: any) => {
      // Calculate sizes in inches if missing
      const length_inch = p.length_inch !== undefined && p.length_inch !== null ? p.length_inch : null;
      const width_inch = p.width_inch !== undefined && p.width_inch !== null ? p.width_inch : null;
      const inner_diameter_inch = p.inner_diameter_inch !== undefined && p.inner_diameter_inch !== null ? p.inner_diameter_inch : null;

      const image_url = p.image_url ? ensureHttpsUrl(p.image_url) : undefined;
      const image_urls = Array.isArray(p.image_urls) ? p.image_urls.map((u: string) => ensureHttpsUrl(u)).filter(Boolean) : undefined;
      const product_url = p.product_url ? ensureHttpsUrl(p.product_url) : undefined;

      return {
        ...p,
        length_inch,
        width_inch,
        inner_diameter_inch,
        image_url,
        image_urls,
        product_url
      };
    });
    return processed.filter((p: Product) => p.is_active);
  },
  
  getAllProductsWithDeleted: (): Product[] => {
    initDB();
    const raw = JSON.parse(localStorage.getItem('kfh_products') || '[]');
    return raw.map((p: any) => {
      const length_inch = p.length_inch !== undefined && p.length_inch !== null ? p.length_inch : null;
      const width_inch = p.width_inch !== undefined && p.width_inch !== null ? p.width_inch : null;
      const inner_diameter_inch = p.inner_diameter_inch !== undefined && p.inner_diameter_inch !== null ? p.inner_diameter_inch : null;

      const image_url = p.image_url ? ensureHttpsUrl(p.image_url) : undefined;
      const image_urls = Array.isArray(p.image_urls) ? p.image_urls.map((u: string) => ensureHttpsUrl(u)).filter(Boolean) : undefined;
      const product_url = p.product_url ? ensureHttpsUrl(p.product_url) : undefined;

      return {
        ...p,
        length_inch,
        width_inch,
        inner_diameter_inch,
        image_url,
        image_urls,
        product_url
      };
    });
  },

  saveProducts: (products: Product[]) => {
    const sanitized = products.map((p) => ({
      ...p,
      image_url: p.image_url ? ensureHttpsUrl(p.image_url) : undefined,
      image_urls: Array.isArray(p.image_urls) ? p.image_urls.map((u) => ensureHttpsUrl(u)).filter(Boolean) : undefined,
      product_url: p.product_url ? ensureHttpsUrl(p.product_url) : undefined,
    }));
    saveItem('kfh_products', JSON.stringify(sanitized), "Products state updated");
  },

  getCrossRefs: (): CrossReference[] => {
    initDB();
    return JSON.parse(localStorage.getItem('kfh_cross_refs') || '[]')
      .filter((r: CrossReference) => r.is_active);
  },

  saveCrossRefs: (refs: CrossReference[]) => {
    saveItem('kfh_cross_refs', JSON.stringify(refs), "Cross Reference relationships updated");
  },

  getMovements: (): StockMovement[] => {
    initDB();
    const movs = JSON.parse(localStorage.getItem('kfh_movements') || '[]');
    return movs.sort((a: StockMovement, b: StockMovement) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  saveMovement: (movement: Omit<StockMovement, 'id' | 'timestamp'>) => {
    const movements = JSON.parse(localStorage.getItem('kfh_movements') || '[]');
    const newMovement: StockMovement = {
      ...movement,
      id: "mov-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString()
    };
    movements.push(newMovement);
    saveItem('kfh_movements', JSON.stringify(movements), `Logged stock movement of ${movement.qty_change} for product ${movement.product_id}`);
    return newMovement;
  },

  getParties: (): Party[] => {
    initDB();
    const raw = localStorage.getItem('kfh_parties');
    let parsed: Party[] = [];
    try {
      parsed = JSON.parse(raw || '[]');
    } catch (e) {
      parsed = [];
    }
    
    let needsMigration = false;
    const migrated = parsed.map((p: any) => {
      if (!p.customer_type) {
        needsMigration = true;
        if (p.type === 'supplier') return p;
        return {
          ...p,
          customer_type: p.type === 'shopkeeper' ? 'shopkeeper' : 'regular'
        };
      }
      return p;
    });

    const isPurged = localStorage.getItem('kfh_db_purged') === 'true';
    if (!isPurged && !migrated.some((p: any) => p.id === 'part-5')) {
      needsMigration = true;
      const part5 = INITIAL_PARTIES.find(p => p.id === 'part-5');
      if (part5) {
        migrated.push(part5);
      }
    }

    if (needsMigration) {
      saveItem('kfh_parties', JSON.stringify(migrated), "Parties/Contacts database auto-migrated");
    }

    return migrated.filter((p: Party) => p.is_active);
  },

  saveParties: (parties: Party[]) => {
    saveItem('kfh_parties', JSON.stringify(parties), "Parties/Contacts database synchronized");
  },

  getInvoices: (): Invoice[] => {
    initDB();
    return JSON.parse(localStorage.getItem('kfh_invoices') || '[]')
      .filter((i: Invoice) => i.is_active);
  },

  saveInvoice: (invoice: Invoice) => {
    const invoices = JSON.parse(localStorage.getItem('kfh_invoices') || '[]');
    const index = invoices.findIndex((i: Invoice) => i.id === invoice.id);
    if (index >= 0) {
      invoices[index] = invoice;
    } else {
      invoices.push(invoice);
    }
    saveItem('kfh_invoices', JSON.stringify(invoices), `Invoice ${invoice.invoice_number} saved`);
  },

  getReturns: (): Return[] => {
    initDB();
    const raw = localStorage.getItem('kfh_returns') || '[]';
    try {
      return JSON.parse(raw).filter((r: Return) => r.is_active);
    } catch {
      return [];
    }
  },

  saveReturn: (ret: Return) => {
    const returnsList = JSON.parse(localStorage.getItem('kfh_returns') || '[]');
    const index = returnsList.findIndex((r: Return) => r.id === ret.id);
    if (index >= 0) {
      returnsList[index] = ret;
    } else {
      returnsList.push(ret);
    }
    saveItem('kfh_returns', JSON.stringify(returnsList), `Return ${ret.return_number} saved`);
  },

  getQuotations: (): Quotation[] => {
    initDB();
    const raw = localStorage.getItem('kfh_quotations') || '[]';
    try {
      return JSON.parse(raw).filter((q: Quotation) => q.is_active);
    } catch {
      return [];
    }
  },

  saveQuotation: (quote: Quotation) => {
    const quotationsList = JSON.parse(localStorage.getItem('kfh_quotations') || '[]');
    const index = quotationsList.findIndex((q: Quotation) => q.id === quote.id);
    if (index >= 0) {
      quotationsList[index] = quote;
    } else {
      quotationsList.push(quote);
    }
    saveItem('kfh_quotations', JSON.stringify(quotationsList), `Quotation ${quote.quote_number} saved`);
  },

  getPayments: (): PaymentRecord[] => {
    initDB();
    return JSON.parse(localStorage.getItem('kfh_payments') || '[]');
  },

  savePaymentAndSync: (payment: PaymentRecord) => {
    const payments = JSON.parse(localStorage.getItem('kfh_payments') || '[]');
    payments.push(payment);
    saveItem('kfh_payments', JSON.stringify(payments), `Payment of Rs. ${payment.amount} stored`);

    // Also deduct/add from customer or supplier credit balances
    const parties = db.getParties();
    const pIdx = parties.findIndex(p => p.id === payment.party_id);
    if (pIdx >= 0) {
      if (payment.type === 'receipt') {
        // Customer payment reduces their positive receivable balance
        parties[pIdx].credit_balance -= payment.amount;
      } else {
        // Supplier payment reduces our negative payable balance (moves it closer to 0, which means adding to it)
        parties[pIdx].credit_balance += payment.amount;
      }
      db.saveParties(parties);
    }

    // If payment method is cash, also auto log to Cash Book
    if (payment.method === 'cash') {
      db.addCashTransaction({
        date: payment.date,
        description: payment.type === 'receipt' 
          ? `Cash Received from ${payment.party_name}` 
          : `Cash Paid to ${payment.party_name}`,
        reference: payment.type === 'receipt' ? `REC-${payment.id.slice(-5).toUpperCase()}` : `PAY-${payment.id.slice(-5).toUpperCase()}`,
        type: payment.type === 'receipt' ? 'in' : 'out',
        amount: payment.amount
      });
    }

    db.logPendingSync(`Recorded ${payment.type} of Rs. ${payment.amount} for ${payment.party_name}`);
  },

  getCheques: (): ChequeRecord[] => {
    initDB();
    return JSON.parse(localStorage.getItem('kfh_cheques') || '[]');
  },

  saveCheque: (cheque: ChequeRecord) => {
    const cheques = JSON.parse(localStorage.getItem('kfh_cheques') || '[]');
    const index = cheques.findIndex((c: ChequeRecord) => c.id === cheque.id);
    if (index >= 0) {
      cheques[index] = cheque;
    } else {
      cheques.push(cheque);
    }
    saveItem('kfh_cheques', JSON.stringify(cheques), `Cheque ${cheque.cheque_number} status saved: ${cheque.status}`);
  },

  getCashbook: (): CashTransaction[] => {
    initDB();
    return JSON.parse(localStorage.getItem('kfh_cashbook') || '[]');
  },

  addCashTransaction: (tx: Omit<CashTransaction, 'id' | 'running_balance' | 'timestamp'>) => {
    const list = db.getCashbook();
    const lastTx = list[list.length - 1];
    const baseBalance = lastTx ? lastTx.running_balance : 0;
    const change = tx.type === 'in' ? tx.amount : -tx.amount;
    const newTx: CashTransaction = {
      ...tx,
      id: "cb-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      running_balance: baseBalance + change
    };
    list.push(newTx);
    saveItem('kfh_cashbook', JSON.stringify(list), `Cash event logged: ${tx.description}`);
    return newTx;
  },

  getSupplierBills: (): SupplierBill[] => {
    initDB();
    return JSON.parse(localStorage.getItem('kfh_supplier_bills') || '[]');
  },

  saveSupplierBill: (bill: SupplierBill) => {
    const bills = JSON.parse(localStorage.getItem('kfh_supplier_bills') || '[]');
    const index = bills.findIndex((b: SupplierBill) => b.id === bill.id);
    if (index >= 0) {
      bills[index] = bill;
    } else {
      bills.push(bill);
    }
    saveItem('kfh_supplier_bills', JSON.stringify(bills), `Supplier bill ${bill.bill_number} saved`);
  },

  getPurchaseOrders: (): PurchaseOrder[] => {
    initDB();
    const raw = localStorage.getItem('kfh_purchase_orders') || '[]';
    try {
      let changed = false;
      const pos = JSON.parse(raw);
      const processed = pos.map((p: any) => {
        if (p.is_deletion_scheduled && p.deletion_scheduled_at && p.is_active) {
          const scheduledTime = new Date(p.deletion_scheduled_at).getTime();
          const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
          if (Date.now() - scheduledTime >= threeDaysInMs) {
            p.is_active = false;
            changed = true;
          }
        }
        return p;
      });
      if (changed) {
        localStorage.setItem('kfh_purchase_orders', JSON.stringify(processed));
      }
      return processed.filter((p: PurchaseOrder) => p.is_active);
    } catch {
      return [];
    }
  },

  savePurchaseOrder: (po: PurchaseOrder) => {
    const pos = JSON.parse(localStorage.getItem('kfh_purchase_orders') || '[]');
    const index = pos.findIndex((p: PurchaseOrder) => p.id === po.id);
    if (index >= 0) {
      pos[index] = po;
    } else {
      pos.push(po);
    }
    saveItem('kfh_purchase_orders', JSON.stringify(pos), `Purchase Order ${po.po_number} saved`);
  },

  getProcurementJobs: (): ProcurementJob[] => {
    initDB();
    const raw = localStorage.getItem('kfh_procurement_jobs') || '[]';
    try {
      return JSON.parse(raw).filter((j: ProcurementJob) => j.is_active);
    } catch {
      return [];
    }
  },

  saveProcurementJob: (job: ProcurementJob) => {
    const jobs = JSON.parse(localStorage.getItem('kfh_procurement_jobs') || '[]');
    const index = jobs.findIndex((j: ProcurementJob) => j.id === job.id);
    if (index >= 0) {
      jobs[index] = job;
    } else {
      jobs.push(job);
    }
    saveItem('kfh_procurement_jobs', JSON.stringify(jobs), `Procurement Job ${job.job_number} saved`);
  },

  getRareImportDemands: (): RareImportDemand[] => {
    initDB();
    const raw = localStorage.getItem('kfh_rare_demands') || '[]';
    try {
      return JSON.parse(raw).filter((d: RareImportDemand) => d.is_active);
    } catch {
      return [];
    }
  },

  saveRareImportDemand: (demand: RareImportDemand) => {
    const demands = JSON.parse(localStorage.getItem('kfh_rare_demands') || '[]');
    const index = demands.findIndex((d: RareImportDemand) => d.id === demand.id);
    if (index >= 0) {
      demands[index] = demand;
    } else {
      demands.push(demand);
    }
    saveItem('kfh_rare_demands', JSON.stringify(demands), `Rare Demand ${demand.demand_number} saved`);
  },

  getCipherKey: (): string => {
    initDB();
    let key = localStorage.getItem('kfh_cipher_key') || 'SAKURYFLOW';
    key = key.trim();
    if (key.startsWith('"') && key.endsWith('"')) {
      key = key.slice(1, -1);
    }
    if (key.startsWith("'") && key.endsWith("'")) {
      key = key.slice(1, -1);
    }
    return key.toUpperCase().trim();
  },

  setCipherKey: (key: string) => {
    const uppercaseKey = key.toUpperCase().trim();
    saveItem('kfh_cipher_key', uppercaseKey, `Updated encryption Cipher key: ${uppercaseKey}`);
  },

  getUserRole: (): 'Owner' | 'Staff' => {
    initDB();
    return (localStorage.getItem('kfh_user_role') || 'Owner') as 'Owner' | 'Staff';
  },

  setUserRole: (role: 'Owner' | 'Staff') => {
    localStorage.setItem('kfh_user_role', role);
  },

  // Log background syncing operations (simulating Supabase cue offline-first)
  getSyncQueue: (): { id: string; operation: string; time: string }[] => {
    return JSON.parse(localStorage.getItem('kfh_sync_queue') || '[]');
  },

  logPendingSync: (operation: string) => {
    const queue = JSON.parse(localStorage.getItem('kfh_sync_queue') || '[]');
    queue.push({
      id: "sync-" + Date.now() + "-" + Math.floor(Math.random() * 100),
      operation,
      time: new Date().toLocaleTimeString()
    });
    // Keep only last 10 logs for performance
    if (queue.length > 20) {
      queue.shift();
    }
    localStorage.setItem('kfh_sync_queue', JSON.stringify(queue));
  },

  clearSyncQueue: () => {
    localStorage.setItem('kfh_sync_queue', '[]');
  },

  syncAllWithSupabase: async (mode: 'pull' | 'push'): Promise<{ success: boolean; message: string }> => {
    const keys = [
      'kfh_products',
      'kfh_cross_refs',
      'kfh_movements',
      'kfh_parties',
      'kfh_invoices',
      'kfh_returns',
      'kfh_quotations',
      'kfh_payments',
      'kfh_cheques',
      'kfh_cashbook',
      'kfh_supplier_bills',
      'kfh_purchase_orders',
      'kfh_procurement_jobs',
      'kfh_rare_demands',
      'kfh_cipher_key',
      'kfh_shop_info',
      'kfh_owner_name',
      'kfh_manager_name',
      'kfh_signature_pad_data',
      'kfh_manager_signature_pad_data'
    ];

    try {
      if (mode === 'push') {
        for (const key of keys) {
          let val = localStorage.getItem(key);
          if (!val) {
            if (key === 'kfh_cipher_key') val = '"SAKURYFLOW"';
            else if (key === 'kfh_owner_name') val = '"Shahzar"';
            else if (key === 'kfh_manager_name') val = '"Shop Manager"';
            else if (key === 'kfh_signature_pad_data' || key === 'kfh_manager_signature_pad_data') val = '""';
            else if (key === 'kfh_shop_info') val = '{}';
            else val = '[]';
          }
          const success = await pushKeyToSupabase(key, val);
          if (!success) {
            return {
              success: false,
              message: `Failed to push database key: ${key}. Please check your connection or physical table state.`
            };
          }
        }
        db.clearSyncQueue();
        return {
          success: true,
          message: 'All local collections successfully synced/overwritten to your Supabase tables!'
        };
      } else {
        // mode === 'pull'
        let pullSuccessCount = 0;
        for (const key of keys) {
          const remoteVal = await pullKeyFromSupabase(key);
          if (remoteVal !== null) {
            localStorage.setItem(key, typeof remoteVal === 'string' ? remoteVal : JSON.stringify(remoteVal));
            pullSuccessCount++;
          }
        }
        if (pullSuccessCount === 0) {
          return {
            success: false,
            message: 'No active tables found on Supabase database. Run a "Push Data" initial commit first.'
          };
        }
        db.clearSyncQueue();
        return {
          success: true,
          message: `Successfully pulled and restored ${pullSuccessCount} collections from your Supabase tables into localStorage!`
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Error occurred during sync transmission'
      };
    }
  }
};
