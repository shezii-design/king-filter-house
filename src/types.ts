/**
 * Types and interfaces for King Filter House FSD Custom ERP
 */

export interface Product {
  id: string;
  part_number: string;        // e.g. "C-6204"
  part_number_norm: string;   // normalized e.g. "C6204"
  brand: string;              // Sakura, etc.
  category: string;           // Filter categories, Oil categories, etc.
  subtype: string;            // Filter subtypes (C, O, EO, FC, F, EF, HC, H, EH, A, AH, AC)
  pack_size: string;          // Liquids/Oils e.g. "4L can"
  grade: string;              // standard, SP, normal, high_temp, A, B, C
  shelf_location: string;     // e.g. "Row 2-A"
  
  // Specs (mainly filters)
  thread_size: string;
  height_mm?: number | null;
  od_mm?: number | null;
  length_inch?: number | null;
  width_inch?: number | null;
  inner_diameter_inch?: number | null;
  gasket_od_mm?: number | null;
  gasket_id_mm?: number | null;
  micron_rating?: number | null;
  cabin_filter: string;       // Yes/No (air filters)
  supplier_code: string;
  notes: string;
  
  // Pricing & Stock
  sale_price: number;
  cost_price: number;
  stock_qty: number;          // Sellable stock
  damaged_qty: number;        // Damaged stock
  min_stock_alert: number;    // Default 5
  
  // Optional references
  image_url?: string;
  image_urls?: string[];
  product_url?: string;
  cross_references?: string;
  
  // Meta flags
  is_active: boolean;         // Soft deleted if false
  created_at: string;
}

export interface CrossReference {
  id: string;
  product_id_1: string;
  product_id_2: string | null;
  external_part_number?: string;
  external_brand?: string;
  match_type: 'exact_match' | 'compatible';
  source: 'manual' | 'invoice';
  discovered_invoice_id: string | null;
  is_active: boolean;
  created_at: string;
  custom_text?: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  qty_change: number;         // e.g., +10 or -2
  from_status: 'sellable' | 'damaged' | 'none';
  to_status: 'sellable' | 'damaged' | 'none';
  type: 'opening_stock' | 'purchased' | 'sold' | 'returned' | 'adjusted' | 'damaged';
  user: 'Owner' | 'Staff';
  timestamp: string;
  reason: string;
}

export interface FilterRequirement {
  id: string;
  product_id: string;
  part_number: string;
  brand: string;
  qty: number;
  position: string;
  agreed_price: number;
  change_interval: string;
  last_sold_price?: number | null;
  last_sold_date?: string | null;
}

export interface Machine {
  id: string;
  site_id: string | null;
  name: string;
  type_model: string;
  operator_name?: string;
  purchaser_name?: string;
  filters: FilterRequirement[];
}

export interface Site {
  id: string;
  name: string;
}

export interface CustomPriceOverride {
  id: string;
  product_id: string;
  part_number: string;
  brand: string;
  custom_price: number;
}

// Added extra data for full app coverage if needed
export interface Party {
  id: string;
  type: 'customer' | 'shopkeeper' | 'supplier' | 'company' | 'regular';
  name: string;
  phone: string;
  phone2?: string;
  city: string;
  credit_balance: number;     // Pakistan Rupees (positive = debit/receivable, negative = payable)
  is_active: boolean;
  created_at: string;
  
  customer_type?: 'regular' | 'company' | 'shopkeeper' | 'walkin';
  address?: string;
  is_supplier_linked?: boolean;
  is_customer_linked?: boolean;
  ntn?: string;
  credit_limit?: number;
  payment_terms?: string;
  notes?: string;
  
  sites?: Site[];
  machines?: Machine[];
  custom_prices?: CustomPriceOverride[];
}

export interface Invoice {
  id: string;
  invoice_number: string;
  party_id: string | null;     // null for walk-in customer
  customer_name: string;      // custom name typed in
  items: InvoiceItem[];
  total_amount: number;
  discount: number;
  net_amount: number;
  received_amount: number;
  status: 'draft' | 'confirmed' | 'returned';
  user: 'Owner' | 'Staff';
  timestamp: string;
  is_active: boolean;
  payment_method?: 'cash' | 'credit' | 'partial' | 'bank' | 'cheque';
  cheque_number?: string;
  bank_name?: string;
  transaction_ref?: string;
  payment_status?: 'paid' | 'partial' | 'unpaid';
  is_tax_invoice?: boolean;
  tax_amount?: number;
  tax_rate?: number;
  ntn_number?: string;
}

export interface InvoiceItem {
  id: string;
  product_id: string;
  part_number: string;
  brand: string;
  sale_price: number;
  qty: number;
  line_total: number;
  // If this item was found via cross reference Search:
  searched_code?: string;
  match_type?: 'exact_match' | 'compatible';
  matched_code?: string;
}

export interface ReturnItem {
  id: string;
  product_id: string;
  part_number: string;
  brand: string;
  qty_returned: number;
  unit_price: number;
  credit_amount: number;
  condition: 'resellable' | 'damaged' | 'supplier_claim';
}

export interface ReplacementItem {
  product_id: string;
  part_number: string;
  brand: string;
  qty: number;
  sale_price: number;
  line_total: number;
}

export interface Return {
  id: string;
  return_number: string;
  invoice_id: string;
  invoice_number: string;
  customer_name: string;
  party_id: string | null;
  type: 'full' | 'partial' | 'exchange' | 'credit_note' | 'defective';
  items: ReturnItem[];
  replacement_item?: ReplacementItem | null;
  credit_amount: number;
  reason: string;
  notes?: string;
  status: 'processed' | 'pending_claim';
  timestamp: string;
  user: 'Owner' | 'Staff';
  is_active: boolean;
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';

export interface Quotation {
  id: string;
  quote_number: string;
  customer_name: string;
  party_id: string | null;
  customer_type?: 'retail' | 'shopkeeper';
  items: InvoiceItem[];
  total_amount: number;
  validity_days: number; // 3, 5, 7, 10, 14, 30
  expiry_date: string;
  notes?: string;
  status: QuoteStatus;
  invoice_id?: string; // Linked invoice ID if converted
  invoice_number?: string; // Linked invoice number
  timestamp: string;
  user: 'Owner' | 'Staff';
  is_active: boolean;
}

export interface PaymentRecord {
  id: string;
  party_id: string;
  party_name: string;
  amount: number;
  timestamp: string;
  date: string;
  method: 'cash' | 'bank' | 'cheque';
  cheque_number?: string;
  bank_name?: string;
  transaction_ref?: string;
  notes?: string;
  user: 'Owner' | 'Staff';
  type: 'receipt' | 'payment'; // receipt = customer, payment = supplier
}

export interface ChequeRecord {
  id: string;
  cheque_number: string;
  bank_name: string;
  party_id: string;
  party_name: string;
  amount: number;
  due_date: string;
  received_date: string;
  status: 'pending' | 'cleared' | 'bounced';
  type: 'receipt' | 'payment';
  notes?: string;
}

export interface CashTransaction {
  id: string;
  date: string;
  timestamp: string;
  description: string;
  reference: string;
  type: 'in' | 'out';
  amount: number;
  running_balance: number;
}

export interface SupplierBill {
  id: string;
  bill_number: string;
  party_id: string;
  supplier_name: string;
  amount: number;
  paid_amount: number;
  due_amount: number;
  timestamp: string;
  date: string;
  is_active: boolean;
}

export interface PurchaseOrderItem {
  id: string;
  product_id: string;
  part_number: string;
  brand: string;
  qty_ordered: number;
  qty_received: number;
  agreed_cost: number;
  actual_cost?: number;
  line_total: number;
  cost_not_identified?: boolean; // flag representing that individual cost rate is temporarily unidentified
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name: string;
  status: 'draft' | 'in_progress' | 'received';
  order_date: string;
  expected_date: string;
  items: PurchaseOrderItem[];
  total_amount: number;
  discount: number;
  net_amount: number;
  received_amount: number;
  is_active: boolean;
  user: 'Owner' | 'Staff';
  cost_not_identified_on_hold?: boolean; // represents whether bill costs are held on draft stage
  held_deferred_amount?: number;          // stores the amount deferred from supplier credit balance
  is_deletion_scheduled?: boolean;
  deletion_scheduled_at?: string;
  deletion_reason?: string;
}

export interface ProcurementJob {
  id: string;
  job_number: string;
  customer_name: string;
  item_description: string;
  qty: number;
  status: 'pending' | 'completed' | 'cancelled';
  date: string;
  purchase_cost: number;
  billed_amount: number;
  notes?: string;
  linked_invoice_id?: string;
  linked_invoice_number?: string;
  user: 'Owner' | 'Staff';
  is_active: boolean;
}

export interface RareImportDemand {
  id: string;
  demand_number: string;
  customer_name: string;
  phone: string;
  company_name: string;
  customer_item_number: string; // the item number they brought or described in frustrated demand
  demand_qty_descr: string;    // e.g. "1 piece after every 1 month"
  notes?: string;              // generic details
  status: 'pending' | 'sourced' | 'ordered' | 'completed';
  brand_targeted?: string;     // Baldwin, Sakura, etc.
  date: string;
  user: 'Owner' | 'Staff';
  is_active: boolean;
}




