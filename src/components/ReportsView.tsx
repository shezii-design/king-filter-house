import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  BarChart4, 
  Search, 
  Calendar, 
  Download, 
  Filter, 
  Lock, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  Users, 
  Undo2, 
  Percent, 
  ShieldAlert, 
  HelpCircle,
  Clock,
  Briefcase,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Settings
} from 'lucide-react';
import { db, encodeCipher } from '../data';
import { 
  Product, 
  Party, 
  Invoice, 
  Return, 
  Quotation, 
  PaymentRecord, 
  CashTransaction, 
  ProcurementJob,
  StockMovement
} from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';

interface ReportsViewProps {
  userRole: 'Owner' | 'Staff';
  cipherKey: string;
  revealRealValues: boolean;
}

type ReportTab = 
  | 'sales' 
  | 'stock' 
  | 'ledger' 
  | 'pl' 
  | 'cashflow' 
  | 'returns' 
  | 'quotations' 
  | 'crossref' 
  | 'procurement' 
  | 'damaged' 
  | 'top_customers' 
  | 'top_products' 
  | 'dead_stock' 
  | 'custom';

type DateRangeType = 'today' | 'week' | 'month' | 'last_month' | 'year' | 'custom';

export default function ReportsView({ 
  userRole, 
  cipherKey, 
  revealRealValues 
}: ReportsViewProps) {
  const [activeTab, setActiveTab] = useState<ReportTab>('sales');

  // Datasets
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [cashbook, setCashbook] = useState<CashTransaction[]>([]);
  const [procurementJobs, setProcurementJobs] = useState<ProcurementJob[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [crossRefs, setCrossRefs] = useState<any[]>([]);

  // Date filters
  const [dateRange, setDateRange] = useState<DateRangeType>('month');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Category list and categories selected state
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Customer Ledger selections
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  // Table specific filters
  const [salesCustomerType, setSalesCustomerType] = useState<string>('All');
  const [salesPaymentMethod, setSalesPaymentMethod] = useState<string>('All');
  const [salesCategoryFilter, setSalesCategoryFilter] = useState<string>('All');

  const [stockLowOnly, setStockLowOnly] = useState<boolean>(false);
  const [stockOutOnly, setStockOutOnly] = useState<boolean>(false);

  // Custom Report Builder States
  const [customEntity, setCustomEntity] = useState<'invoices' | 'products' | 'customers' | 'payments'>('invoices');
  const [customSelectedColumns, setCustomSelectedColumns] = useState<string[]>([]);
  const [customMinAmount, setCustomMinAmount] = useState<number>(0);
  const [customSearchText, setCustomSearchText] = useState<string>('');

  // Load all standard datasets
  const loadDatasets = () => {
    const rawInvoices = db.getInvoices().filter(i => i.is_active);
    const rawProducts = db.getProducts();
    const rawParties = db.getParties();
    const rawReturns = db.getReturns().filter(r => r.is_active);
    const rawQuotations = db.getQuotations().filter(q => q.is_active);
    const rawPayments = db.getPayments();
    const rawCashbook = db.getCashbook();
    const rawProcJobs = db.getProcurementJobs().filter(j => j.is_active);
    const rawMovements = db.getMovements();
    const rawCrossRefs = db.getCrossRefs();

    setInvoices(rawInvoices);
    setProducts(rawProducts);
    setParties(rawParties);
    setReturns(rawReturns);
    setQuotations(rawQuotations);
    setPayments(rawPayments);
    setCashbook(rawCashbook);
    setProcurementJobs(rawProcJobs);
    setMovements(rawMovements);
    setCrossRefs(rawCrossRefs);

    // Get unique categories from products
    const uniqueCats = Array.from(new Set(rawProducts.map(p => p.category).filter(Boolean)));
    setCategories(['All', ...uniqueCats]);

    // Pre-select first customer for ledger if none selected
    const customersOnly = rawParties.filter(p => p.type !== 'supplier' || p.is_customer_linked === true);
    if (customersOnly.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(customersOnly[0].id);
    }
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  // Update date helpers when dropdown shifts
  const handleDateRangeChange = (range: DateRangeType) => {
    setDateRange(range);
    const today = new Date();
    let start = new Date();

    if (range === 'today') {
      start = today;
    } else if (range === 'week') {
      start.setDate(today.getDate() - 7);
    } else if (range === 'month') {
      start.setDate(today.getDate() - 30);
    } else if (range === 'last_month') {
      // First and last day of previous month
      const prev = new Date();
      prev.setMonth(today.getMonth() - 1);
      const firstDay = new Date(prev.getFullYear(), prev.getMonth(), 1);
      const lastDay = new Date(prev.getFullYear(), prev.getMonth() + 1, 0);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(lastDay.toISOString().split('T')[0]);
      return;
    } else if (range === 'year') {
      start = new Date(today.getFullYear(), 0, 1); // Jan 1st
    } else {
      return; // custom
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  };

  // Check if item date is within current boundary
  const isDateWithin = (itemDateStr: string): boolean => {
    if (!itemDateStr) return false;
    const itemDate = new Date(itemDateStr.split('T')[0]).getTime();
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    return itemDate >= start && itemDate <= end;
  };

  // Cost ciphering styling
  const formatCostValue = (val: number) => {
    return revealRealValues ? `Rs. ${val.toLocaleString()}` : encodeCipher(val, cipherKey);
  };

  // Convert and export table rows to clean spreadsheet csv
  const triggerCsvDownload = (headers: string[], dataRows: string[][], filename: string) => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...dataRows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Preset custom columns on custom report entity changes
  useEffect(() => {
    if (customEntity === 'invoices') {
      setCustomSelectedColumns(['Date', 'InvoiceNo', 'Customer', 'ItemsCount', 'NetTotal', 'PayMethod', 'User']);
    } else if (customEntity === 'products') {
      setCustomSelectedColumns(['PartNumber', 'Brand', 'Category', 'StockQty', 'MinAlert', 'SalePrice', 'CostPrice']);
    } else if (customEntity === 'customers') {
      setCustomSelectedColumns(['CustomerName', 'City', 'Phone', 'CreditLimit', 'CreditBalance', 'Type']);
    } else if (customEntity === 'payments') {
      setCustomSelectedColumns(['Date', 'Party', 'Amount', 'Method', 'Reference', 'Type', 'Notes']);
    }
  }, [customEntity]);


  // ==========================================
  // DATA FILTERING & CALCULATIONS BY REPORT VIEW
  // ==========================================

  // 1. SALES REPORT DATAPOINTS
  const filteredSalesInvoices = invoices.filter(inv => {
    // 1. Date range filter
    if (!isDateWithin(inv.timestamp)) return false;

    // 2. Customer Type Filter
    const associatedParty = parties.find(p => p.id === inv.party_id);
    if (salesCustomerType !== 'All') {
      if (salesCustomerType === 'shopkeeper' && associatedParty?.customer_type !== 'shopkeeper') return false;
      if (salesCustomerType === 'retail' && associatedParty?.customer_type !== 'retail' && inv.party_id !== null) return false;
      if (salesCustomerType === 'walkin' && inv.party_id !== null) return false; 
    }

    // 3. Payment Method Filter
    if (salesPaymentMethod !== 'All') {
      if (inv.payment_method !== salesPaymentMethod) return false;
    }

    // 4. Category filter (at least one matching item)
    if (salesCategoryFilter !== 'All') {
      const hasCat = inv.items.some(it => {
        const pObj = products.find(p => p.id === it.product_id);
        return pObj?.category === salesCategoryFilter;
      });
      if (!hasCat) return false;
    }

    return true;
  });

  const totalSalesVal = filteredSalesInvoices.reduce((sum, i) => sum + i.net_amount, 0);
  const cashSalesVal = filteredSalesInvoices
    .filter(i => i.payment_method === 'cash' || i.payment_method === 'bank')
    .reduce((sum, i) => sum + i.net_amount, 0);
  const creditSalesVal = filteredSalesInvoices
    .filter(i => i.payment_method === 'credit' || i.payment_method === 'partial')
    .reduce((sum, i) => sum + i.net_amount, 0);
  
  // Returns inside same date boundary
  const totalReturnsVal = returns
    .filter(r => isDateWithin(r.timestamp))
    .reduce((sum, r) => sum + r.credit_amount, 0);
  
  const netRevenueSecured = totalSalesVal - totalReturnsVal;

  const exportSalesReport = () => {
    const headers = ['Date', 'Invoice No', 'Customer Name', 'Items Count', 'Subtotal', 'Discount', 'Net Total', 'Received Amt', 'Payment Method', 'Status', 'Operator'];
    const rows = filteredSalesInvoices.map(inv => [
      inv.timestamp.split('T')[0],
      inv.invoice_number,
      inv.customer_name,
      inv.items.length.toString(),
      inv.total_amount.toString(),
      inv.discount.toString(),
      inv.net_amount.toString(),
      inv.received_amount.toString(),
      inv.payment_method || 'N/A',
      inv.status,
      inv.user
    ]);
    triggerCsvDownload(headers, rows, 'Sales_Report');
  };

  // 2. STOCK REPORT DATAPOINTS
  const filteredProductsStock = products.filter(p => {
    if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
    if (stockLowOnly && p.stock_qty > p.min_stock_alert) return false;
    if (stockOutOnly && p.stock_qty > 0) return false;
    return true;
  });

  const totalStockSaleVal = filteredProductsStock.reduce((sum, p) => sum + (p.stock_qty * (p.sale_price || 0)), 0);
  const totalStockCostVal = filteredProductsStock.reduce((sum, p) => sum + (p.stock_qty * (p.cost_price || 0)), 0);

  const exportStockReport = () => {
    const headers = ['Part Number', 'Brand', 'Category', 'Stock Qty', 'Min Stock Alert', 'Location', 'Sale Price', 'Cost Price', 'Stock Value (Sale)', 'Stock Value (Cost)'];
    const rows = filteredProductsStock.map(p => [
      p.part_number,
      p.brand,
      p.category || 'N/A',
      p.stock_qty.toString(),
      p.min_stock_alert.toString(),
      p.location || 'Shelf',
      p.sale_price.toString(),
      revealRealValues ? p.cost_price.toString() : 'CIPHERED',
      (p.stock_qty * p.sale_price).toString(),
      revealRealValues ? (p.stock_qty * p.cost_price).toString() : 'CIPHERED'
    ]);
    triggerCsvDownload(headers, rows, 'Stock_Inventory_Report');
  };

  // 3. CUSTOMER LEDGER DATAPOINTS
  const activeCustomerObj = parties.find(p => p.id === selectedCustomerId);
  
  // Ledger activities merge
  let ledgerRows: {
    date: string;
    type: string;
    reference: string;
    description: string;
    debit: number;
    credit: number;
  }[] = [];

  if (activeCustomerObj) {
    // 1. Confirmed Invoices
    const custInvoices = invoices.filter(inv => inv.party_id === activeCustomerObj.id && inv.status !== 'draft');
    custInvoices.forEach(inv => {
      ledgerRows.push({
        date: inv.timestamp,
        type: 'Invoice',
        reference: inv.invoice_number,
        description: `Goods purchased. Sold items count: ${inv.items.length}`,
        debit: inv.net_amount,
        credit: 0
      });
    });

    // 2. Receipts Payments
    const custPayments = payments.filter(p => p.party_id === activeCustomerObj.id && p.type === 'receipt');
    custPayments.forEach(pay => {
      ledgerRows.push({
        date: pay.timestamp || pay.date,
        type: 'Payment Receipt',
        reference: pay.method.toUpperCase(),
        description: `Cashbook receipt logged. ${pay.notes || ''}`,
        debit: 0,
        credit: pay.amount
      });
    });

    // 3. Returns (credit note value)
    const custReturns = returns.filter(r => r.party_id === activeCustomerObj.id && r.status === 'processed');
    custReturns.forEach(ret => {
      ledgerRows.push({
        date: ret.timestamp,
        type: 'Claims Return',
        reference: ret.return_number,
        description: `Goods returned back to stock. Reason: ${ret.reason}`,
        debit: 0,
        credit: ret.credit_amount
      });
    });

    // Sort chronologically
    ledgerRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Apply date range filter to finalized ledger rows, but track opening balance prior to startDate!
    const beforeStartRows = ledgerRows.filter(r => new Date(r.date.split('T')[0]).getTime() < new Date(startDate).getTime());
    const initialDebit = beforeStartRows.reduce((sum, r) => sum + r.debit, 0);
    const initialCredit = beforeStartRows.reduce((sum, r) => sum + r.credit, 0);
    const openingBalanceVal = initialDebit - initialCredit;

    // Filter within range
    ledgerRows = ledgerRows.filter(r => isDateWithin(r.date));
  }

  // Calculate Aging (for Active Customer)
  // Aging classes: Current (0-30 days), 31-60 days, 61-90 days, 91+ days of unpaid amounts
  let agingCurrent = 0;
  let aging30 = 0;
  let aging60 = 0;
  let aging90 = 0;

  if (activeCustomerObj) {
    const custInvoices = invoices.filter(inv => inv.party_id === activeCustomerObj.id && inv.is_active && inv.status === 'confirmed');
    const todayMs = new Date().getTime();

    custInvoices.forEach(inv => {
      const remainingUnpaid = Math.max(0, inv.net_amount - inv.received_amount);
      if (remainingUnpaid > 0) {
        const invAgeDays = Math.floor((todayMs - new Date(inv.timestamp).getTime()) / (1000 * 60 * 60 * 24));
        if (invAgeDays <= 30) {
          agingCurrent += remainingUnpaid;
        } else if (invAgeDays <= 60) {
          aging30 += remainingUnpaid;
        } else if (invAgeDays <= 90) {
          aging60 += remainingUnpaid;
        } else {
          aging90 += remainingUnpaid;
        }
      }
    });
  }

  const exportCustomerLedger = () => {
    if (!activeCustomerObj) return;
    const headers = ['Date', 'Type', 'Reference ID', 'Description', 'Debit Amount', 'Credit Amount', 'Running Balance'];
    let runningVal = 0;
    const rows = ledgerRows.map(row => {
      runningVal += (row.debit - row.credit);
      return [
        row.date.split('T')[0],
        row.type,
        row.reference,
        row.description,
        row.debit.toString(),
        row.credit.toString(),
        runningVal.toString()
      ];
    });
    triggerCsvDownload(headers, rows, `Ledger_${activeCustomerObj.name}`);
  };


  // 4. PROFIT & LOSS (OWNER EXCLUSIVE)
  // Total Net revenue (Sales - Sales Returns)
  // Cost of goods sold: we resolve each sold item with the product cost_price at timestamp
  const plInvoices = invoices.filter(i => isDateWithin(i.timestamp) && i.status === 'confirmed');
  const plReturns = returns.filter(r => isDateWithin(r.timestamp) && r.status === 'processed');

  const totalPlRevenueRaw = plInvoices.reduce((sum, inv) => sum + inv.net_amount, 0);
  const totalPlReturnsCredit = plReturns.reduce((sum, r) => sum + r.credit_amount, 0);
  const netPlRevenueSecured = totalPlRevenueRaw - totalPlReturnsCredit;

  // Resolve COGS
  let totalCogsVal = 0;
  let categoryCogsMap: {[key: string]: {revenue: number, cogs: number}} = {};

  plInvoices.forEach(inv => {
    inv.items.forEach(item => {
      const prodRef = products.find(p => p.id === item.product_id);
      const unitCost = prodRef?.cost_price || 0;
      const totalCostLine = unitCost * item.qty;
      totalCogsVal += totalCostLine;

      const category = prodRef?.category || 'General';
      if (!categoryCogsMap[category]) {
        categoryCogsMap[category] = { revenue: 0, cogs: 0 };
      }
      categoryCogsMap[category].revenue += item.line_total;
      categoryCogsMap[category].cogs += totalCostLine;
    });
  });

  // Subtract Returned Items Costs from COGS (because returned stock flows back to inventory)
  plReturns.forEach(ret => {
    ret.items.forEach(ritem => {
      const prodRef = products.find(p => p.id === ritem.product_id);
      const unitCost = prodRef?.cost_price || 0;
      // standard defective claims shouldn't decrease cogs if damaged, but for general returns we deduct cogs
      if (ritem.condition === 'resellable') {
        const costReturned = unitCost * ritem.qty_returned;
        totalCogsVal = Math.max(0, totalCogsVal - costReturned);

        const category = prodRef?.category || 'General';
        if (categoryCogsMap[category]) {
          categoryCogsMap[category].cogs = Math.max(0, categoryCogsMap[category].cogs - costReturned);
        }
      }
    });
  });

  const plGrossProfit = netPlRevenueSecured - totalCogsVal;
  const plGrossMarginPct = netPlRevenueSecured > 0 ? (plGrossProfit / netPlRevenueSecured) * 100 : 0;


  // 5. CASH FLOW DATAPOINTS
  // We compute total cash-book actions
  const cashFlowIn = cashbook
    .filter(c => isDateWithin(c.timestamp || c.date) && c.type === 'in')
    .reduce((sum, c) => sum + c.amount, 0);

  const cashFlowOut = cashbook
    .filter(c => isDateWithin(c.timestamp || c.date) && c.type === 'out')
    .reduce((sum, c) => sum + c.amount, 0);

  const netCashFlowChange = cashFlowIn - cashFlowOut;


  // 6. RETURNS DATA
  const filteredReturns = returns.filter(r => isDateWithin(r.timestamp));
  const totalProcessedClaimsVal = filteredReturns.reduce((sum, r) => sum + r.credit_amount, 0);


  // 7. QUOTATIONS DATA
  const filteredQuotations = quotations.filter(q => isDateWithin(q.timestamp));
  const activeQuotesCount = filteredQuotations.filter(q => q.status === 'sent' || q.status === 'draft').length;
  const convertedQuotesTotal = filteredQuotations
    .filter(q => q.status === 'converted')
    .reduce((sum, q) => sum + q.total_amount, 0);


  // 8. CROSS REFERENCE USAGE
  // How many times cross references are defined or listed
  const totalCrossRefsCount = crossRefs.length;


  // 9. PROCUREMENT JOBS
  const filteredProcurementJobs = procurementJobs.filter(j => isDateWithin(j.date));
  const completedJobsCount = filteredProcurementJobs.filter(j => j.status === 'completed').length;
  const pendingJobsCount = filteredProcurementJobs.filter(j => j.status === 'pending').length;
  const totalJobBilled = filteredProcurementJobs.reduce((sum, j) => sum + j.billed_amount, 0);
  const totalJobProfit = filteredProcurementJobs.reduce((sum, j) => sum + (j.billed_amount - j.purchase_cost), 0);


  // 10. DAMAGED STOCK
  // Sum up damaged returns (condition is damaged) and stock writeoffs
  const damagedReturnedItemsCost = returns
    .filter(r => isDateWithin(r.timestamp))
    .flatMap(r => r.items)
    .filter(item => item.condition === 'damaged')
    .reduce((sum, item) => sum + (item.qty_returned * (products.find(p => p.id === item.product_id)?.cost_price || item.unit_price)), 0);

  // Damaged movements inside stock logs
  const damagedMovements = movements.filter(m => 
    isDateWithin(m.timestamp) && 
    (m.type === 'adjustment' && (m.reason?.toLowerCase().includes('damage') || m.reason?.toLowerCase().includes('writeoff')))
  );

  const stockAdjustmentDamagedCost = damagedMovements.reduce((sum, m) => {
    const cost = products.find(p => p.id === m.product_id)?.cost_price || 0;
    return sum + (Math.abs(m.qty_change) * cost);
  }, 0);

  const totalEstimatedDamageLoss = damagedReturnedItemsCost + stockAdjustmentDamagedCost;


  // 11. TOP CUSTOMERS ANALYSIS (Last 100 Invoices)
  let customerSalesSummary: {[key: string]: { name: string, total: number, ordersCount: number }} = {};
  
  invoices
    .filter(i => i.status === 'confirmed')
    .forEach(inv => {
      const cName = inv.customer_name || 'Walk-In Customer';
      if (!customerSalesSummary[cName]) {
        customerSalesSummary[cName] = { name: cName, total: 0, ordersCount: 0 };
      }
      customerSalesSummary[cName].total += inv.net_amount;
      customerSalesSummary[cName].ordersCount += 1;
    });

  const sortedTopCustomers = Object.values(customerSalesSummary)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);


  // 12. TOP SELLING PRODUCTS ANALYSIS
  let productSalesSummary: {[key: string]: { part_number: string, brand: string, qtySold: number, revenue: number }} = {};
  
  invoices
    .filter(i => i.status === 'confirmed')
    .forEach(inv => {
      inv.items.forEach(item => {
        const key = item.product_id;
        if (!productSalesSummary[key]) {
          productSalesSummary[key] = { 
            part_number: item.part_number, 
            brand: item.brand, 
            qtySold: 0, 
            revenue: 0 
          };
        }
        productSalesSummary[key].qtySold += item.qty;
        productSalesSummary[key].revenue += item.line_total;
      });
    });

  const sortedTopProducts = Object.values(productSalesSummary)
    .sort((a, b) => b.qtySold - a.qtySold)
    .slice(0, 8);


  // 13. DEAD STOCK DETECTION
  // Products that have positive stock but 0 sales in the last 30 or 90 days
  const soldProductIds = new Set(
    invoices
      .filter(inv => {
        // let's look at last 90 days to check dead stock
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        return new Date(inv.timestamp).getTime() >= ninetyDaysAgo.getTime() && inv.status === 'confirmed';
      })
      .flatMap(inv => inv.items.map(item => item.product_id))
  );

  const deadStockProducts = products.filter(p => p.stock_qty > 0 && !soldProductIds.has(p.id));
  const totalDeadStockTiedCost = deadStockProducts.reduce((sum, p) => sum + (p.stock_qty * (p.cost_price || 0)), 0);


  // 14. CUSTOM REPORT BUILDER DATA
  const getCustomReportRows = () => {
    let rawData: any[] = [];
    if (customEntity === 'invoices') {
      rawData = invoices.filter(inv => {
        if (customSearchText && !inv.customer_name.toLowerCase().includes(customSearchText.toLowerCase()) && !inv.invoice_number.toLowerCase().includes(customSearchText.toLowerCase())) return false;
        if (customMinAmount > 0 && inv.net_amount < customMinAmount) return false;
        return true;
      });
    } else if (customEntity === 'products') {
      rawData = products.filter(p => {
        if (customSearchText && !p.part_number.toLowerCase().includes(customSearchText.toLowerCase()) && !p.brand.toLowerCase().includes(customSearchText.toLowerCase())) return false;
        if (customMinAmount > 0 && p.sale_price < customMinAmount) return false;
        return true;
      });
    } else if (customEntity === 'customers') {
      rawData = parties.filter(p => p.type !== 'supplier' || p.is_customer_linked === true).filter(c => {
        if (customSearchText && !c.name.toLowerCase().includes(customSearchText.toLowerCase()) && !c.city.toLowerCase().includes(customSearchText.toLowerCase())) return false;
        return true;
      });
    } else if (customEntity === 'payments') {
      rawData = payments.filter(p => {
        if (customSearchText && !p.party_name.toLowerCase().includes(customSearchText.toLowerCase()) && !p.method.toLowerCase().includes(customSearchText.toLowerCase())) return false;
        if (customMinAmount > 0 && p.amount < customMinAmount) return false;
        return true;
      });
    }
    return rawData;
  };

  const currentCustomRows = getCustomReportRows();

  const handleExportCustomBuilder = () => {
    if (currentCustomRows.length === 0) return;
    
    // We parse the columns according to checked keys
    const headers = customSelectedColumns;
    const rows = currentCustomRows.map(item => {
      return customSelectedColumns.map(col => {
        if (customEntity === 'invoices') {
          if (col === 'Date') return item.timestamp?.split('T')[0] || '';
          if (col === 'InvoiceNo') return item.invoice_number || '';
          if (col === 'Customer') return item.customer_name || '';
          if (col === 'ItemsCount') return (item.items?.length || 0).toString();
          if (col === 'NetTotal') return (item.net_amount || 0).toString();
          if (col === 'PayMethod') return item.payment_method || '';
          if (col === 'User') return item.user || '';
        } else if (customEntity === 'products') {
          if (col === 'PartNumber') return item.part_number || '';
          if (col === 'Brand') return item.brand || '';
          if (col === 'Category') return item.category || '';
          if (col === 'StockQty') return (item.stock_qty || 0).toString();
          if (col === 'MinAlert') return (item.min_stock_alert || 0).toString();
          if (col === 'SalePrice') return (item.sale_price || 0).toString();
          if (col === 'CostPrice') return revealRealValues ? (item.cost_price || 0).toString() : 'CIPHERED';
        } else if (customEntity === 'customers') {
          if (col === 'CustomerName') return item.name || '';
          if (col === 'City') return item.city || '';
          if (col === 'Phone') return item.phone || '';
          if (col === 'CreditLimit') return (item.credit_limit || 0).toString();
          if (col === 'CreditBalance') return (item.credit_balance || 0).toString();
          if (col === 'Type') return item.customer_type || '';
        } else if (customEntity === 'payments') {
          if (col === 'Date') return item.date || item.timestamp?.split('T')[0] || '';
          if (col === 'Party') return item.party_name || '';
          if (col === 'Amount') return (item.amount || 0).toString();
          if (col === 'Method') return item.method || '';
          if (col === 'Reference') return item.transaction_ref || '';
          if (col === 'Type') return item.type || '';
          if (col === 'Notes') return item.notes || '';
        }
        return '';
      });
    });

    triggerCsvDownload(headers, rows, `Custom_${customEntity}_Export`);
  };

  return (
    <div className="space-y-4" id="reports-view-root">
      
      {/* 8.1 REPORT CONTROLS HEADER */}
      <div className="bg-white p-4 border border-[#E2DFDF] flex flex-col md:flex-row md:items-center justify-between gap-4" id="reports-global-bar">
        <div>
          <h2 className="text-base font-black uppercase text-slate-800 tracking-tight flex items-center">
            <BarChart4 className="w-5 h-5 mr-2 text-[#0EA5E9]" />
            Business Reports & Insights Center
          </h2>
          <p className="text-[11px] text-gray-500 font-bold uppercase tracking-tight">
            15 fully-integrated audits — automatic cipher protected • Owner role gate verified
          </p>
        </div>

        {/* Date range picker - universal across reports except Stock */}
        {activeTab !== 'stock' && activeTab !== 'crossref' && activeTab !== 'top_customers' && activeTab !== 'top_products' && activeTab !== 'dead_stock' && (
          <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 border border-slate-200 rounded-sm">
            <span className="text-[10px] text-gray-500 font-extrabold uppercase font-mono">Range:</span>
            <select
              value={dateRange}
              onChange={(e) => handleDateRangeChange(e.target.value as DateRangeType)}
              className="text-xs bg-white border border-slate-300 px-2 py-1 rounded font-bold text-slate-700"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="year">This Year</option>
              <option value="custom">-- Custom Date --</option>
            </select>

            {dateRange === 'custom' && (
              <div className="flex items-center space-x-1.5 text-xs">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-white border p-1 rounded font-bold font-mono"
                />
                <span className="text-gray-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-white border p-1 rounded font-bold font-mono"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 14 TABS ROADMAP ROW */}
      <div className="bg-white border border-[#E2DFDF] overflow-x-auto whitespace-nowrap flex items-center p-1.5 scrollbar-thin rounded-md" id="reports-nav-tabs">
        {[
          { id: 'sales', label: 'Sales Summary', icon: TrendingUp, iconColor: 'text-emerald-500' },
          { id: 'stock', label: 'Stock Audit', icon: Package, iconColor: 'text-sky-500' },
          { id: 'ledger', label: 'Customer Ledger', icon: Users, iconColor: 'text-blue-500' },
          { id: 'pl', label: 'P&L Statement', icon: Percent, iconColor: 'text-amber-500' },
          { id: 'cashflow', label: 'Cash Flow', icon: DollarSign, iconColor: 'text-emerald-500' },
          { id: 'returns', label: 'Returns Log', icon: Undo2, iconColor: 'text-rose-500' },
          { id: 'quotations', label: 'Quotations', icon: FileText, iconColor: 'text-indigo-500' },
          { id: 'crossref', label: 'Cross-Ref alternate', icon: Sliders, iconColor: 'text-slate-500' },
          { id: 'procurement', label: 'Procurements', icon: Briefcase, iconColor: 'text-orange-500' },
          { id: 'damaged', label: 'Damaged Stock', icon: ShieldAlert, iconColor: 'text-red-500 animate-pulse' },
          { id: 'top_customers', label: 'Top Buyers', icon: Users, iconColor: 'text-purple-500' },
          { id: 'top_products', label: 'Top Items sold', icon: TrendingUp, iconColor: 'text-sky-500' },
          { id: 'dead_stock', label: 'Dead Capital', icon: Clock, iconColor: 'text-slate-500' },
          { id: 'custom', label: 'Custom Builder', icon: Settings, iconColor: 'text-slate-500' }
        ].map(tab => {
          const isSelected = activeTab === tab.id;
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ReportTab)}
              className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-sm mx-1 cursor-pointer transition-all flex items-center space-x-1.5 shrink-0 ${
                isSelected 
                  ? 'bg-[#0EA5E9] text-white shadow-sm' 
                  : 'text-gray-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <IconComponent className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : tab.iconColor}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>


      {/* ======================================================== */}
      {/* 8.2 SALES REPORT TAB */}
      {/* ======================================================== */}
      {activeTab === 'sales' && (
        <div className="space-y-4" id="sales-report-pane">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white p-3 border border-[#E2DFDF] flex flex-col justify-between">
              <span className="text-[9px] text-gray-400 font-extrabold uppercase">Total Sales Orders</span>
              <span className="text-lg font-black text-[#0EA5E9] font-mono">{formatCostValue(totalSalesVal)}</span>
              <span className="text-[8px] text-gray-500 font-medium">All confirmed invoices</span>
            </div>
            <div className="bg-white p-3 border border-[#E2DFDF] flex flex-col justify-between">
              <span className="text-[9px] text-emerald-600 font-extrabold uppercase">Cash Receipts</span>
              <span className="text-lg font-black text-emerald-600 font-mono">{formatCostValue(cashSalesVal)}</span>
              <span className="text-[8px] text-emerald-700 font-medium">Ready cash + bank receipt</span>
            </div>
            <div className="bg-white p-3 border border-[#E2DFDF] flex flex-col justify-between">
              <span className="text-[9px] text-amber-600 font-extrabold uppercase">Credit Outstandings</span>
              <span className="text-lg font-black text-amber-600 font-mono">{formatCostValue(creditSalesVal)}</span>
              <span className="text-[8px] text-amber-700">Accounts pending balance</span>
            </div>
            <div className="bg-white p-3 border border-[#E2DFDF] flex flex-col justify-between">
              <span className="text-[9px] text-red-500 font-extrabold uppercase">Returns/Refunds</span>
              <span className="text-lg font-black text-red-500 font-mono">{formatCostValue(totalReturnsVal)}</span>
              <span className="text-[8px] text-sky-700">Returns credit note issued</span>
            </div>
            <div className="bg-white p-3 border border-[#E2DFDF] flex flex-col justify-between col-span-2 md:col-span-1">
              <span className="text-[9px] text-blue-700 font-extrabold uppercase">Net Revenue Secured</span>
              <span className="text-lg font-black text-blue-700 font-mono">{formatCostValue(netRevenueSecured)}</span>
              <span className="text-[8px] text-blue-800 font-semibold">Invoices minus returns</span>
            </div>
          </div>

          {/* Filters shelf */}
          <div className="bg-white p-3 border border-[#E2DFDF] flex flex-wrap gap-4 items-center">
            <span className="text-xs font-bold text-gray-505 flex items-center">
              <Filter className="w-3.5 h-3.5 mr-1" /> Filters:
            </span>
            <div>
              <label className="text-[9px] text-gray-400 font-black uppercase mr-1">Owner Type</label>
              <select
                value={salesCustomerType}
                onChange={(e) => setSalesCustomerType(e.target.value)}
                className="text-xs border p-1 rounded font-bold"
              >
                <option value="All">All types</option>
                <option value="shopkeeper">Shopkeepers only</option>
                <option value="retail">Retail clients</option>
                <option value="walkin">Walk-in Cash clients</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] text-gray-400 font-black uppercase mr-1">Method</label>
              <select
                value={salesPaymentMethod}
                onChange={(e) => setSalesPaymentMethod(e.target.value)}
                className="text-xs border p-1 rounded font-bold"
              >
                <option value="All">All Methods</option>
                <option value="cash">Cash book</option>
                <option value="credit">Credit Ledges</option>
                <option value="bank">Bank Transfer</option>
                <option value="cheque">Cheques</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] text-gray-400 font-black uppercase mr-1">Category</label>
              <select
                value={salesCategoryFilter}
                onChange={(e) => setSalesCategoryFilter(e.target.value)}
                className="text-xs border p-1 rounded font-bold"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <button
              onClick={exportSalesReport}
              className="ml-auto bg-green-700 hover:bg-green-800 text-white font-black uppercase rounded-xs px-3 py-1.5 text-[11px] tracking-wider flex items-center cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5 mr-1" /> Export Sales CSV
            </button>
          </div>

          {/* Results Table */}
          <div className="bg-white border border-[#E2DFDF] overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 uppercase text-[9px] text-gray-500 font-extrabold border-b border-[#E2DFDF]">
                  <th className="p-3">Date</th>
                  <th className="p-3">Invoice #</th>
                  <th className="p-3">Customer name</th>
                  <th className="p-3 text-center">Items Count</th>
                  <th className="p-3 text-right">Order net</th>
                  <th className="p-3 text-right">Received Cash</th>
                  <th className="p-3 text-center">Payment method</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {filteredSalesInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-gray-400">
                      No matching invoices found in selected parameters and date ranges.
                    </td>
                  </tr>
                ) : (
                  filteredSalesInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50 font-medium">
                      <td className="p-3 font-mono font-bold text-gray-650">{inv.timestamp.split('T')[0]}</td>
                      <td className="p-3 font-mono text-[#0EA5E9] font-black">{inv.invoice_number}</td>
                      <td className="p-3 font-bold text-slate-800">{inv.customer_name}</td>
                      <td className="p-3 text-center font-bold">{inv.items.length}</td>
                      <td className="p-3 text-right font-mono font-extrabold">{formatCostValue(inv.net_amount)}</td>
                      <td className="p-3 text-right font-mono text-emerald-600 font-bold">{formatCostValue(inv.received_amount)}</td>
                      <td className="p-3 text-center uppercase text-[10px] font-bold">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-gray-700">
                          {inv.payment_method || 'Cash'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                          inv.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-sky-100 text-sky-700'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-gray-400 text-[10px] uppercase">{inv.user}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* ======================================================== */}
      {/* 8.3 STOCK REPORT TAB */}
      {/* ======================================================== */}
      {activeTab === 'stock' && (
        <div className="space-y-4" id="stock-report-pane">
          {/* Stock Filters toolbar */}
          <div className="bg-white p-3 border border-[#E2DFDF] flex flex-wrap gap-4 items-center">
            <div>
              <label className="text-[10px] text-gray-400 font-extrabold uppercase mr-1">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs border p-1 rounded font-bold"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="stock-low"
                checked={stockLowOnly}
                onChange={(e) => setStockLowOnly(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300"
              />
              <label htmlFor="stock-low" className="text-xs font-bold text-amber-700">Low Stock Only (≤ Alert limit)</label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="stock-out"
                checked={stockOutOnly}
                onChange={(e) => setStockOutOnly(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300"
              />
              <label htmlFor="stock-out" className="text-xs font-bold text-sky-700">Out Of Stock Only (= 0)</label>
            </div>

            <button
              onClick={exportStockReport}
              className="ml-auto bg-green-700 hover:bg-green-800 text-white font-black uppercase rounded-xs px-3 py-1.5 text-[11px] tracking-wider flex items-center cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5 mr-1" /> Export inventory CSV
            </button>
          </div>

          {/* Table list */}
          <div className="bg-white border border-[#E2DFDF] overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 uppercase text-[9px] text-gray-500 font-extrabold border-b border-[#E2DFDF]">
                  <th className="p-3">Part number</th>
                  <th className="p-3">Brand</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-center">Stock Qty</th>
                  <th className="p-3 text-center">Min Alert</th>
                  <th className="p-3 text-right">Standard Sale</th>
                  <th className="p-3 text-right bg-slate-50/50">Purchase Cost (Owner)</th>
                  <th className="p-3 text-right bg-slate-50">Stock Value (Sale)</th>
                  <th className="p-3 text-right bg-sky-50/20">Stock Value (Cost)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {filteredProductsStock.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-gray-400">
                      No products match your parameters matching the stock criteria.
                    </td>
                  </tr>
                ) : (
                  filteredProductsStock.map(p => {
                    const isLow = p.stock_qty <= p.min_stock_alert;
                    return (
                      <tr key={p.id} className={`hover:bg-slate-50 font-medium ${isLow ? 'bg-amber-50/30' : ''}`}>
                        <td className="p-3 font-mono font-bold text-slate-800">{p.part_number}</td>
                        <td className="p-3 text-gray-700 font-bold">{p.brand}</td>
                        <td className="p-3 text-gray-400 uppercase text-[10px] font-bold">{p.category || 'General'}</td>
                        <td className="p-3 text-center font-bold">
                          <span className={`px-1.5 py-0.5 rounded font-mono ${p.stock_qty <= 0 ? 'bg-sky-100 text-sky-700 font-black' : isLow ? 'bg-amber-100 text-amber-700 font-bold' : 'text-gray-800'}`}>
                            {p.stock_qty}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-gray-400">{p.min_stock_alert}</td>
                        <td className="p-3 text-right font-mono font-bold">{formatCostValue(p.sale_price)}</td>
                        <td className="p-3 text-right font-mono bg-slate-50/50">{formatCostValue(p.cost_price || 0)}</td>
                        <td className="p-3 text-right font-mono bg-slate-50 font-black text-blue-700">
                          {formatCostValue(p.stock_qty * (p.sale_price || 0))}
                        </td>
                        <td className="p-3 text-right font-mono bg-sky-50/10 font-bold text-slate-700">
                          {formatCostValue(p.stock_qty * (p.cost_price || 0))}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {/* Footer Rows */}
              <tfoot>
                <tr className="bg-slate-100 font-extrabold uppercase text-[10px] border-t border-[#E2DFDF]">
                  <td colSpan={7} className="p-3 text-right tracking-tight">Total stock valuation:</td>
                  <td className="p-3 text-right font-mono text-xs font-black text-blue-700 bg-slate-150">
                    {formatCostValue(totalStockSaleVal)}
                  </td>
                  <td className="p-3 text-right font-mono text-xs font-black text-[#0ea5e9] bg-sky-50/20">
                    {formatCostValue(totalStockCostVal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}


      {/* ======================================================== */}
      {/* 8.4 CUSTOMER LEDGER TAB */}
      {/* ======================================================== */}
      {activeTab === 'ledger' && (
        <div className="space-y-4" id="ledger-report-pane">
          {/* Customer selector drop */}
          <div className="bg-white p-4 border border-[#E2DFDF] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black uppercase text-slate-800">Select Customer:</span>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="text-xs border p-2 rounded-sm font-black bg-white focus:ring-1 focus:ring-sky-400 text-[#0EA5E9]"
              >
                {parties
                  .filter(p => p.type !== 'supplier' || p.is_customer_linked === true)
                  .map(cust => (
                    <option key={cust.id} value={cust.id}>
                      {cust.name} ({cust.city}) — Bal: Rs. {cust.credit_balance.toLocaleString()}
                    </option>
                  ))
                }
              </select>
            </div>

            {activeCustomerObj && (
              <button
                onClick={exportCustomerLedger}
                className="bg-green-700 hover:bg-green-800 text-white font-black uppercase rounded-xs px-3 py-1.5 text-[11px] tracking-wider flex items-center cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5 mr-1" /> Export ledger CSV
              </button>
            )}
          </div>

          {/* Aging metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-3 border border-emerald-250 rounded-xs">
              <span className="text-[9px] uppercase font-black text-emerald-700 block">Current Outstanding (0-30 days)</span>
              <span className="text-base font-black text-emerald-800 font-mono mt-0.5 block">Rs. {agingCurrent.toLocaleString()}</span>
            </div>
            <div className="bg-white p-3 border border-amber-200 rounded-xs">
              <span className="text-[9px] uppercase font-black text-amber-700 block">31 - 60 Days Overdue</span>
              <span className="text-base font-black text-amber-800 font-mono mt-0.5 block">Rs. {aging30.toLocaleString()}</span>
            </div>
            <div className="bg-white p-3 border border-orange-250 rounded-xs">
              <span className="text-[9px] uppercase font-black text-orange-700 block">61 - 90 Days Overdue</span>
              <span className="text-base font-black text-orange-850 font-mono mt-0.5 block">Rs. {aging60.toLocaleString()}</span>
            </div>
            <div className="bg-white p-3 border border-sky-200 rounded-xs">
              <span className="text-[9px] uppercase font-black text-[#0ea5e9] block">91+ Days Critically Overdue</span>
              <span className="text-base font-black text-sky-700 font-mono mt-0.5 block">Rs. {aging90.toLocaleString()}</span>
            </div>
          </div>

          {/* Ledger history table */}
          {activeCustomerObj ? (
            <div className="bg-white border border-[#E2DFDF]">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs">
                <span>Ledger Statement from <strong className="font-mono">{startDate}</strong> to <strong className="font-mono">{endDate}</strong></span>
                <span>Active Account Balance: <strong className={activeCustomerObj.credit_balance < 0 ? 'text-sky-600' : 'text-green-700'}>Rs. {activeCustomerObj.credit_balance.toLocaleString()}</strong></span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 uppercase text-[9px] text-gray-500 font-extrabold border-b border-[#E2DFDF]">
                      <th className="p-3">Transaction Date</th>
                      <th className="p-3">Reference Type</th>
                      <th className="p-3">Document Reference</th>
                      <th className="p-3">Description Description</th>
                      <th className="p-3 text-right">Debit (Amount Sold)</th>
                      <th className="p-3 text-right">Credit (Amount Paid)</th>
                      <th className="p-3 text-right bg-slate-100">Cumulative due Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {/* Add Opening Balance Row first if relevant */}
                    {ledgerRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-gray-400">
                          No transaction activities logged inside this date window.
                        </td>
                      </tr>
                    ) : (
                      (() => {
                        let runningValue = 0;
                        return ledgerRows.map((row, index) => {
                          runningValue += (row.debit - row.credit);
                          return (
                            <tr key={index} className="hover:bg-slate-50/50 font-medium">
                              <td className="p-3 font-mono text-gray-600 font-bold">{row.date.split('T')[0]}</td>
                              <td className="p-3">
                                <span className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${
                                  row.type === 'Invoice' ? 'bg-indigo-100 text-indigo-700' :
                                  row.type === 'Payment Receipt' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
                                }`}>
                                  {row.type}
                                </span>
                              </td>
                              <td className="p-3 font-mono font-black text-slate-700">{row.reference}</td>
                              <td className="p-3 text-gray-400 text-[11px]">{row.description}</td>
                              <td className="p-3 text-right font-mono font-bold text-slate-800">
                                {row.debit > 0 ? `Rs. ${row.debit.toLocaleString()}` : '—'}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-emerald-600">
                                {row.credit > 0 ? `Rs. ${row.credit.toLocaleString()}` : '—'}
                              </td>
                              <td className="p-3 text-right font-mono font-black text-slate-800 bg-slate-50/20">
                                Rs. {runningValue.toLocaleString()}
                              </td>
                            </tr>
                          );
                        });
                      })()
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border p-8 text-center text-gray-400 text-xs">
              Kindly create customer files first to audit ledger statements.
            </div>
          )}
        </div>
      )}


      {/* ======================================================== */}
      {/* 8.5 profit & loss analysis */}
      {/* ======================================================== */}
      {activeTab === 'pl' && (
        <div id="pl-report-pane">
          {userRole !== 'Owner' ? (
            <div className="bg-white border border-[#E2DFDF] p-12 text-center flex flex-col items-center justify-center space-y-4 max-w-xl mx-auto rounded-xs shadow-xs">
              <div className="w-12 h-12 bg-sky-100 rounded-full flex items-center justify-center text-[#0EA5E9]">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-tight">Access Restricted to Shop Owner</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Profit & Loss statements, COGS matrices, and margin metrics are locked from staff privilege profiles. Toggle your role block at the sidebar footer to proceed.
              </p>
            </div>
          ) : (
            <div className="space-y-4 font-sans">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-white p-4 border border-[#E2DFDF]">
                  <span className="text-[10px] text-gray-400 font-extrabold uppercase block">Net Sales Income</span>
                  <span className="text-xl font-black font-mono text-slate-850 mt-1 block">Rs. {netPlRevenueSecured.toLocaleString()}</span>
                  <span className="text-[9px] text-slate-500 mt-0.5 block">Revenue: Rs. {totalPlRevenueRaw.toLocaleString()} (Less Returns)</span>
                </div>
                <div className="bg-white p-4 border border-[#E2DFDF]">
                  <span className="text-[10px] text-gray-400 font-extrabold uppercase block">Cost of Goods Sold (COGS)</span>
                  <span className="text-xl font-black font-mono text-amber-600 mt-1 block">Rs. {totalCogsVal.toLocaleString()}</span>
                  <span className="text-[9px] text-slate-500 mt-0.5 block">Resolved from real product buy cost</span>
                </div>
                <div className="bg-white p-4 border border-[#E2DFDF]">
                  <span className="text-[10px] text-emerald-700 font-extrabold uppercase block font-mono">Gross Business Profit</span>
                  <span className="text-xl font-black font-mono text-emerald-600 mt-1 block">Rs. {plGrossProfit.toLocaleString()}</span>
                  <span className="text-[9px] text-emerald-700 mt-0.5 block">Estimated margins balance</span>
                </div>
                <div className="bg-white p-4 border border-[#E2DFDF]">
                  <span className="text-[10px] text-blue-700 font-extrabold uppercase block">Gross Margin Percentage</span>
                  <span className="text-xl font-black font-mono text-blue-700 mt-1 block">{plGrossMarginPct.toFixed(2)}%</span>
                  <span className="text-[9px] text-blue-800 mt-0.5 block">Sales efficiency tracker</span>
                </div>
              </div>

              {/* breakdown statement sheet */}
              <div className="bg-white border border-[#E2DFDF] p-6 space-y-6">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-800 border-b pb-2 tracking-wider">Trading Profit & Loss Statement</h4>
                  <div className="divide-y text-xs">
                    <div className="flex justify-between py-2.5 font-bold">
                      <span className="text-[#0EA5E9]">Revenue from Sales</span>
                      <span className="font-mono">Rs. {totalPlRevenueRaw.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-2.5 font-bold text-gray-400">
                      <span>Less: Returned sales credits</span>
                      <span className="font-mono">(Rs. {totalPlReturnsCredit.toLocaleString()})</span>
                    </div>
                    <div className="flex justify-between py-2.5 font-black text-slate-800 bg-slate-50 px-2 my-1">
                      <span>Net Business Sales Revenue (A)</span>
                      <span className="font-mono">Rs. {netPlRevenueSecured.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between py-2.5 font-bold text-amber-700">
                      <span>Cost of Goods Sold (B)</span>
                      <span className="font-mono">Rs. {totalCogsVal.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between py-3 font-black text-sm text-emerald-700 bg-emerald-50 px-2 mt-2">
                      <span>Gross Profit (A - B)</span>
                      <span className="font-mono">Rs. {plGrossProfit.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Category Margin breakdowns */}
                <div>
                  <h5 className="text-[10px] uppercase font-black text-gray-400 mb-3 tracking-wider">Margin Breakdown by Product Category</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-[#E2DFDF] overflow-x-auto">
                      <table className="w-full text-left text-xs font-medium">
                        <thead>
                          <tr className="bg-slate-100 font-black text-[9px] text-gray-500 uppercase border-b">
                            <th className="p-2">Category</th>
                            <th className="p-2 text-right">Revenue</th>
                            <th className="p-2 text-right">COGS</th>
                            <th className="p-2 text-right">Profit Margin</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150">
                          {Object.entries(categoryCogsMap).length === 0 ? (
                            <tr>
                              <td colSpan={4} className="p-4 text-center text-gray-400">No items resolved yet.</td>
                            </tr>
                          ) : (
                            Object.entries(categoryCogsMap).map(([cat, vals]) => {
                              const profit = vals.revenue - vals.cogs;
                              const margin = vals.revenue > 0 ? (profit / vals.revenue) * 100 : 0;
                              return (
                                <tr key={cat} className="hover:bg-slate-50">
                                  <td className="p-2 font-bold text-slate-800 uppercase">{cat}</td>
                                  <td className="p-2 text-right font-mono text-gray-700">Rs. {vals.revenue.toLocaleString()}</td>
                                  <td className="p-2 text-right font-mono text-amber-600">Rs. {vals.cogs.toLocaleString()}</td>
                                  <td className="p-2 text-right font-mono text-emerald-600 font-bold">
                                    Rs. {profit.toLocaleString()} ({margin.toFixed(0)}%)
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Simple Pie Chart */}
                    <div className="h-48 border border-[#E2DFDF] bg-slate-50 p-2 flex items-center justify-center">
                      {Object.entries(categoryCogsMap).length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={Object.entries(categoryCogsMap).map(([name, val]) => ({ name, value: Math.max(0, val.revenue - val.cogs) }))}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={70}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {Object.entries(categoryCogsMap).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={['#DF1A22', '#1E40AF', '#10B981', '#F59E0B', '#8B5CF6'][index % 5]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => `Rs. ${Number(value).toLocaleString()}`} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <span className="text-xs text-gray-400">Chart will compile once invoices exist in this range</span>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      )}


      {/* ======================================================== */}
      {/* 8.6 CASH FLOW REPORT */}
      {/* ======================================================== */}
      {activeTab === 'cashflow' && (
        <div className="space-y-4" id="cashflow-report-pane">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white p-4 border border-[#E2DFDF] rounded-xs">
              <span className="text-[10px] text-gray-400 font-extrabold uppercase">Sum Cash Inflows</span>
              <span className="text-xl font-black text-emerald-650 font-mono mt-1 block">Rs. {cashFlowIn.toLocaleString()}</span>
              <span className="text-[9px] text-emerald-700">All POS receipts & customer balances</span>
            </div>
            <div className="bg-white p-4 border border-[#E2DFDF] rounded-xs">
              <span className="text-[10px] text-gray-400 font-extrabold uppercase">Sum Cash Outflows</span>
              <span className="text-xl font-black text-orange-600 font-mono mt-1 block">Rs. {cashFlowOut.toLocaleString()}</span>
              <span className="text-[9px] text-orange-800">Payments to vendors & shop writeoffs</span>
            </div>
            <div className="bg-white p-4 border border-[#E2DFDF] rounded-xs">
              <span className="text-[10px] text-gray-400 font-extrabold uppercase">Net Cash flow Change</span>
              <span className={`text-xl font-black font-mono mt-1 block ${netCashFlowChange >= 0 ? 'text-blue-700' : 'text-sky-700'}`}>
                Rs. {netCashFlowChange.toLocaleString()}
              </span>
              <span className="text-[9px] text-gray-500">Real-time ledger delta</span>
            </div>
          </div>

          <div className="bg-white border border-[#E2DFDF]">
            <h4 className="text-xs font-black uppercase text-slate-800 p-3 bg-slate-50 border-b select-none">Cash Book Activity logs</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 uppercase text-[9px] text-gray-500 border-b font-extrabold">
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Reference</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Inflow Amount</th>
                    <th className="p-3 text-right">Outflow Amount</th>
                    <th className="p-3 text-right">Running Register Cash Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {cashbook.filter(c => isDateWithin(c.timestamp || c.date)).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400">
                        No cash transactions logged inside this date parameter view.
                      </td>
                    </tr>
                  ) : (
                    cashbook
                      .filter(c => isDateWithin(c.timestamp || c.date))
                      .map(t => (
                        <tr key={t.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono text-gray-650 font-semibold">{t.timestamp ? t.timestamp.split('T')[0] : t.date}</td>
                          <td className="p-3 font-mono font-bold text-[#0EA5E9]">{t.reference}</td>
                          <td className="p-3 text-slate-705 font-bold">{t.description}</td>
                          <td className="p-3 text-center">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                              t.type === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              {t.type === 'in' ? 'DEPOSIT' : 'WITHDRAW'}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-600">
                            {t.type === 'in' ? `Rs. ${t.amount.toLocaleString()}` : '—'}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-orange-650">
                            {t.type === 'out' ? `Rs. ${t.amount.toLocaleString()}` : '—'}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-800 font-extrabold bg-slate-50/25">
                            Rs. {t.running_balance?.toLocaleString() || '—'}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


      {/* ======================================================== */}
      {/* 8.7 OTHER REPORTS VIEWS (Returns / Quotations / CrossRef / Procurement / Damaged) */}
      {/* ======================================================== */}
      {activeTab === 'returns' && (
        <div className="bg-white border border-[#E2DFDF]" id="returns-report-pane">
          <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
            <h4 className="text-xs font-black uppercase text-slate-800">Returns & Claim Statements</h4>
            <span className="text-xs font-bold text-slate-750">Total claims value: <strong className="font-mono text-[#0EA5E9]">{formatCostValue(totalProcessedClaimsVal)}</strong></span>
          </div>
          <table className="w-full text-left text-xs font-medium">
            <thead>
              <tr className="bg-slate-100 uppercase text-[9px] text-gray-400 font-extrabold">
                <th className="p-3">Return #</th>
                <th className="p-3">Date</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Invoice Ref</th>
                <th className="p-3 text-right">Value Issued</th>
                <th className="p-3 text-center">Form type</th>
                <th className="p-3 text-right">Processor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">No returns logged inside this date.</td>
                </tr>
              ) : (
                filteredReturns.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-black text-[#0EA5E9]">{r.return_number}</td>
                    <td className="p-3 font-mono text-gray-650">{r.timestamp?.split('T')[0]}</td>
                    <td className="p-3 font-bold text-slate-800">{r.customer_name}</td>
                    <td className="p-3 font-mono text-slate-700">{r.invoice_number}</td>
                    <td className="p-3 text-right font-mono font-extrabold text-sky-600">{formatCostValue(r.credit_amount)}</td>
                    <td className="p-3 text-center uppercase text-[9px] font-bold">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{r.type}</span>
                    </td>
                    <td className="p-3 text-right font-bold text-gray-400 select-none uppercase">{r.user}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'quotations' && (
        <div className="space-y-4" id="quotations-report-pane">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-3 border border-[#E2DFDF]">
              <span className="text-[9px] text-gray-400 block uppercase font-bold">Quotations created</span>
              <span className="text-lg font-black block mt-0.5">{filteredQuotations.length}</span>
            </div>
            <div className="bg-white p-3 border border-[#E2DFDF]">
              <span className="text-[9px] text-gray-400 block uppercase font-bold">Active in pipeline</span>
              <span className="text-lg font-black block mt-0.5 text-[#0EA5E9]">{activeQuotesCount}</span>
            </div>
            <div className="bg-white p-3 border border-[#E2DFDF]">
              <span className="text-[9px] text-gray-400 block uppercase font-bold">Converted Orders Value</span>
              <span className="text-lg font-black text-green-650 font-mono block mt-0.5">Rs. {convertedQuotesTotal.toLocaleString()}</span>
            </div>
            <div className="bg-white p-3 border border-[#E2DFDF]">
              <span className="text-[9px] text-gray-400 block uppercase font-bold">Efficiency Conversion Rate</span>
              <span className="text-lg font-black text-blue-700 block mt-0.5">
                {filteredQuotations.length > 0 
                  ? `${Math.round((filteredQuotations.filter(q => q.status === 'converted').length / filteredQuotations.length) * 100)}%` 
                  : '0%'
                }
              </span>
            </div>
          </div>

          <table className="w-full text-left text-xs bg-white border border-[#E2DFDF]">
            <thead>
              <tr className="bg-slate-100 uppercase text-[9px] text-gray-400 font-extrabold border-b">
                <th className="p-3">Quote #</th>
                <th className="p-3">Customer name</th>
                <th className="p-3 text-center">Items count</th>
                <th className="p-3 text-right">Sum total</th>
                <th className="p-3 text-center">Expiry</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150">
              {filteredQuotations.map(q => (
                <tr key={q.id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono font-black text-slate-800">{q.quote_number}</td>
                  <td className="p-3 font-bold text-slate-800">{q.customer_name}</td>
                  <td className="p-3 text-center font-bold">{q.items.length}</td>
                  <td className="p-3 text-right font-mono font-bold">Rs. {q.total_amount.toLocaleString()}</td>
                  <td className="p-3 text-center font-mono text-[10px] text-sky-600">{q.expiry_date}</td>
                  <td className="p-3 text-center uppercase tracking-wider font-bold">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                      q.status === 'converted' ? 'bg-emerald-100 text-emerald-800' :
                      q.status === 'draft' ? 'bg-slate-100 text-slate-800' : 'bg-sky-50 text-[#0ea5e9]'
                    }`}>
                      {q.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'crossref' && (
        <div className="bg-white border border-[#E2DFDF]" id="crossref-report-pane">
          <div className="p-4 bg-slate-50 border-b">
            <h4 className="text-xs font-black uppercase text-slate-800">Cross-Reference Code Connections Auditor</h4>
            <span className="text-[10px] uppercase font-bold text-gray-400 mt-1 block">Audit which stock parts mapped connection rules</span>
          </div>
          <table className="w-full text-left text-xs font-medium">
            <thead>
              <tr className="bg-slate-100 uppercase text-[9px] text-gray-400 font-extrabold border-b">
                <th className="p-3">Local Part Code</th>
                <th className="p-3">Category</th>
                <th className="p-3">Mapped Alternate Code</th>
                <th className="p-3">Compatible Brand</th>
                <th className="p-3">Selling Retail Price</th>
                <th className="p-3 text-center">Warehouse Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150">
              {crossRefs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">No cross connections registered inside parameters database.</td>
                </tr>
              ) : (
                crossRefs.map(x => {
                  const correlatedProd = products.find(p => p.id === x.product_id);
                  return (
                    <tr key={x.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-black text-[#0EA5E9]">{x.original_code}</td>
                      <td className="p-3 text-gray-700 font-bold">{correlatedProd?.category || 'General'}</td>
                      <td className="p-3 font-mono font-bold text-indigo-700">{x.cross_code}</td>
                      <td className="p-3 text-slate-800 uppercase text-[10px] font-bold">{x.brand}</td>
                      <td className="p-3 font-mono font-bold">{formatCostValue(correlatedProd?.sale_price || 0)}</td>
                      <td className="p-3 text-center font-bold">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-gray-700">{correlatedProd?.stock_qty || 0}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'procurement' && (
        <div className="space-y-4" id="procurement-report-pane">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-3 border border-slate-200">
              <span className="text-[10px] text-gray-400 block uppercase font-bold">Total Procurement Jobs</span>
              <span className="text-lg font-black block mt-0.5">{filteredProcurementJobs.length}</span>
            </div>
            <div className="bg-white p-3 border border-slate-200">
              <span className="text-[10px] text-blue-700 block uppercase font-bold">Pending Sourcing</span>
              <span className="text-lg font-black text-blue-700 block mt-0.5">{pendingJobsCount}</span>
            </div>
            <div className="bg-white p-3 border border-slate-200">
              <span className="text-[10px] text-emerald-700 block uppercase font-bold">Total Billed Volume</span>
              <span className="text-lg font-black text-emerald-650 font-mono block mt-0.5">Rs. {totalJobBilled.toLocaleString()}</span>
            </div>
            <div className="bg-white p-3 border border-slate-200">
              <span className="text-[10px] text-[#0EA5E9] block uppercase font-bold">Net markup Margin Profit</span>
              <span className="text-lg font-black text-[#0EA5E9] font-mono block mt-0.5">Rs. {totalJobProfit.toLocaleString()} ({totalJobBilled > 0 ? Math.round((totalJobProfit/totalJobBilled)*100) : 0}%)</span>
            </div>
          </div>

          <table className="w-full text-left text-xs bg-white border border-[#E2DFDF]">
            <thead>
              <tr className="bg-slate-100 uppercase text-[9px] text-gray-400 font-extrabold border-b">
                <th className="p-3">Job Number</th>
                <th className="p-3">Buyer client</th>
                <th className="p-3">Item Description</th>
                <th className="p-3 text-center">Req Qty</th>
                <th className="p-3 text-right">Our Cost Price</th>
                <th className="p-3 text-right">Customer invoice bill</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150">
              {filteredProcurementJobs.map(job => {
                const markup = job.billed_amount - job.purchase_cost;
                return (
                  <tr key={job.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-black text-slate-800">{job.job_number}</td>
                    <td className="p-3 font-bold text-slate-800">{job.customer_name}</td>
                    <td className="p-3 font-medium text-slate-750">{job.item_description}</td>
                    <td className="p-3 text-center font-bold">{job.qty}</td>
                    <td className="p-3 text-right font-mono text-amber-600">{formatCostValue(job.purchase_cost)}</td>
                    <td className="p-3 text-right font-mono text-[#0EA5E9] font-bold">Rs. {job.billed_amount.toLocaleString()}</td>
                    <td className="p-3 text-center font-bold">
                      <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded ${
                        job.status === 'completed' ? 'bg-green-100 text-green-700' :
                        job.status === 'cancelled' ? 'bg-sky-100 text-sky-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {job.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'damaged' && (
        <div className="bg-white border border-[#E2DFDF]" id="damaged-report-pane">
          <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
            <div>
              <h4 className="text-xs font-black uppercase text-slate-800">Damaged Stock & Waste Logs</h4>
              <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-tight">Audit defective returns or manual warehouse write-offs</p>
            </div>
            <span className="text-xs font-bold text-[#0EA5E9]">Total Damaged Cost Value: <strong className="font-mono">{formatCostValue(totalEstimatedDamageLoss)}</strong></span>
          </div>
          <table className="w-full text-left text-xs font-medium border-t">
            <thead>
              <tr className="bg-slate-100 uppercase text-[9px] text-gray-400 border-b font-extrabold col-span-9">
                <th className="p-3">Reference Document</th>
                <th className="p-3">Product details</th>
                <th className="p-3 text-center">Defect Quantities</th>
                <th className="p-3 text-right">Loss Valuation Impact</th>
                <th className="p-3">Reason / Incident Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 font-medium">
              {filteredReturns.flatMap(r => r.items.filter(item => item.condition === 'damaged')).length === 0 && damagedMovements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">No damaged stock flags logged in this range.</td>
                </tr>
              ) : (
                <>
                  {/* Damaged returns items */}
                  {filteredReturns.map(r => 
                    r.items.filter(item => item.condition === 'damaged').map(item => {
                      const cost = products.find(p => p.id === item.product_id)?.cost_price || item.unit_price;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 font-medium">
                          <td className="p-3 font-mono text-[#0EA5E9] font-black">{r.return_number} (Return)</td>
                          <td className="p-3">
                            <span className="font-mono font-bold block">{item.part_number}</span>
                            <span className="text-[9px] text-gray-400 font-sans block">{item.brand}</span>
                          </td>
                          <td className="p-3 text-center font-bold text-[#0ea5e9] font-mono">-{item.qty_returned}</td>
                          <td className="p-3 text-right font-mono font-bold text-sky-700">{formatCostValue(item.qty_returned * cost)}</td>
                          <td className="p-3 text-slate-700 text-[11px]">{r.reason} (Condition: Damaged)</td>
                        </tr>
                      );
                    })
                  )}

                  {/* Stock movements of type writeoff/damage */}
                  {damagedMovements.map(m => {
                    const prod = products.find(p => p.id === m.product_id);
                    const cost = prod?.cost_price || 0;
                    return (
                      <tr key={m.id} className="hover:bg-slate-50 font-medium">
                        <td className="p-3 font-mono font-bold text-slate-700">Stock Adjustment Adjust</td>
                        <td className="p-3">
                          <span className="font-mono font-bold block">{prod?.part_number}</span>
                          <span className="text-[9px] text-gray-400 font-sans block">{prod?.brand}</span>
                        </td>
                        <td className="p-3 text-center font-bold text-sky-600 font-mono">{m.qty_change}</td>
                        <td className="p-3 text-right font-mono font-bold text-sky-700">{formatCostValue(Math.abs(m.qty_change) * cost)}</td>
                        <td className="p-3 text-slate-705 text-[11px]">{m.reason}</td>
                      </tr>
                    );
                  })}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}


      {/* ======================================================== */}
      {/* 8.8 TOP BUYER CUSTOMERS (Graphical & list) */}
      {/* ======================================================== */}
      {activeTab === 'top_customers' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4" id="top-customers-pane">
          <div className="lg:col-span-7 bg-white p-4 border border-[#E2DFDF] space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Top spending Buyer profiles</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-medium">
                <thead>
                  <tr className="bg-slate-100 uppercase text-[9px] text-gray-400 font-extrabold">
                    <th className="p-2.5">Rank</th>
                    <th className="p-2.5">Customer Name</th>
                    <th className="p-2.5 text-center">Orders Count</th>
                    <th className="p-2.5 text-right">Sum total Sales</th>
                    <th className="p-2.5 text-right">Average Ticket Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {sortedTopCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center">No transactions registered.</td>
                    </tr>
                  ) : (
                    sortedTopCustomers.map((cust, i) => (
                      <tr key={cust.name} className="hover:bg-slate-50">
                        <td className="p-2.5 text-slate-400 font-black">#0{i+1}</td>
                        <td className="p-2.5 font-bold text-slate-800">{cust.name}</td>
                        <td className="p-2.5 text-center font-bold">{cust.ordersCount}</td>
                        <td className="p-2.5 text-right font-mono font-black text-blue-700">Rs. {cust.total.toLocaleString()}</td>
                        <td className="p-2.5 text-right font-mono text-gray-650">Rs. {Math.round(cust.total / cust.ordersCount).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white p-4 border border-[#E2DFDF] flex flex-col justify-between" id="top-customers-recharts">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Sales Distribution by Customer</h3>
            <div className="h-64 flex items-center justify-center mt-4">
              {sortedTopCustomers.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sortedTopCustomers} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} style={{ fontSize: '10px' }} />
                    <Tooltip formatter={(v) => `Rs. ${Number(v).toLocaleString()}`} />
                    <Bar dataKey="total" fill="#DF1A22" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <span className="text-xs text-gray-400">No chart data compiled</span>
              )}
            </div>
          </div>
        </div>
      )}


      {/* ======================================================== */}
      {/* 8.9 TOP SELLING ITEMS sold (Graphical & list) */}
      {/* ======================================================== */}
      {activeTab === 'top_products' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4" id="top-products-pane">
          <div className="lg:col-span-7 bg-white p-4 border border-[#E2DFDF] space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Top Selling Automotive/Engine Parts</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-medium">
                <thead>
                  <tr className="bg-slate-100 uppercase text-[9px] text-gray-400 font-extrabold">
                    <th className="p-2.5">Rank</th>
                    <th className="p-2.5">Part Number</th>
                    <th className="p-2.5">Brand</th>
                    <th className="p-2.5 text-center">Quantities Sold</th>
                    <th className="p-2.5 text-right">Gross revenue Generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {sortedTopProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center">No sales registered.</td>
                    </tr>
                  ) : (
                    sortedTopProducts.map((p, i) => (
                      <tr key={p.part_number} className="hover:bg-slate-50">
                        <td className="p-2.5 text-slate-400 font-extrabold">#0{i+1}</td>
                        <td className="p-2.5 font-mono font-bold text-slate-800">{p.part_number}</td>
                        <td className="p-2.5 text-slate-700 font-bold">{p.brand}</td>
                        <td className="p-2.5 text-center font-bold font-mono text-emerald-700">+{p.qtySold} units</td>
                        <td className="p-2.5 text-right font-mono font-black text-blue-700">{formatCostValue(p.revenue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white p-4 border border-[#E2DFDF] flex flex-col justify-between" id="top-products-recharts">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider font-mono">Revenue generated per Item</h3>
            <div className="h-64 flex items-center justify-center mt-4">
              {sortedTopProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sortedTopProducts}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="part_number" style={{ fontSize: '9px' }} />
                    <YAxis />
                    <Tooltip formatter={(value) => `Rs. ${Number(value).toLocaleString()}`} />
                    <Bar dataKey="qtySold" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <span className="text-xs text-gray-400">No chart compiled</span>
              )}
            </div>
          </div>
        </div>
      )}


      {/* ======================================================== */}
      {/* 8.10 DEAD STOCK MODULE */}
      {/* ======================================================== */}
      {activeTab === 'dead_stock' && (
        <div className="space-y-4" id="dead-stock-pane">
          <div className="bg-sky-50 border border-sky-200 p-4 rounded-xs flex items-center justify-between">
            <div className="flex items-center space-x-3 text-red-900">
              <AlertTriangle className="w-5 h-5 text-[#0ea5e9]" />
              <div>
                <p className="font-bold text-xs uppercase text-[#0ea5e9]">Dead stock alerts & capital blockages</p>
                <p className="text-[11px] text-sky-700 font-medium">Following products have registered 0 sales in the last 90 days. This indicates obsolete inventory patterns or stuck funds.</p>
              </div>
            </div>
            <div className="bg-white px-3 py-1.5 border border-sky-300 rounded font-mono font-black text-sky-700 text-xs">
              Blocked Capital: {formatCostValue(totalDeadStockTiedCost)}
            </div>
          </div>

          <div className="bg-white border border-[#E2DFDF] overflow-x-auto">
            <table className="w-full text-left text-xs font-medium">
              <thead>
                <tr className="bg-slate-100 uppercase text-[9px] text-gray-450 border-b font-extrabold">
                  <th className="p-3">Part number</th>
                  <th className="p-3">Brand</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-center">Remaining Stock</th>
                  <th className="p-3 text-right">Standard Buy Cost</th>
                  <th className="p-3 text-right">standard Selling price</th>
                  <th className="p-3 text-right bg-sky-50/25">Valuation Stuck</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 font-medium">
                {deadStockProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400">Amazing! No dead stock detected. All inventory items are rotating smoothly.</td>
                  </tr>
                ) : (
                  deadStockProducts.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 font-medium">
                      <td className="p-3 font-mono font-bold text-slate-800">{p.part_number}</td>
                      <td className="p-3 text-slate-705 font-bold">{p.brand}</td>
                      <td className="p-3 text-slate-450 uppercase text-[10px] font-bold">{p.category || 'General'}</td>
                      <td className="p-3 text-center font-bold">{p.stock_qty}</td>
                      <td className="p-3 text-right font-mono text-amber-600">{formatCostValue(p.cost_price || 0)}</td>
                      <td className="p-3 text-right font-mono font-bold">{formatCostValue(p.sale_price)}</td>
                      <td className="p-3 text-right font-mono text-sky-700 font-black bg-sky-50/5">
                        {formatCostValue(p.stock_qty * (p.cost_price || p.sale_price * 0.7))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* ======================================================== */}
      {/* 8.11 CUSTOM CONFIG REPORT BUILDER */}
      {/* ======================================================== */}
      {activeTab === 'custom' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4" id="custom-builder-pane">
          {/* Controls Config on Left */}
          <div className="lg:col-span-4 bg-white p-4 border border-[#E2DFDF] space-y-4">
            <div className="flex items-center space-x-1 border-b pb-2">
              <Sliders className="w-4 h-4 text-[#0EA5E9]" />
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Custom Config Sheet</h3>
            </div>

            {/* Entity Select */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-400 font-extrabold uppercase block select-none">1. Set Database Entity</label>
              <select
                value={customEntity}
                onChange={(e) => setCustomEntity(e.target.value as any)}
                className="w-full text-xs border p-2 bg-slate-50 font-bold tracking-tight rounded-sm"
              >
                <option value="invoices">Confirmed Direct Invoices</option>
                <option value="products">Products Stock Inventory</option>
                <option value="customers">Buyer / Customer ledgers</option>
                <option value="payments">Receipts / Outgoing payments</option>
              </select>
            </div>

            {/* Check Columns */}
            <div className="space-y-2">
              <label className="text-[10px] text-gray-400 font-extrabold uppercase block select-none">2. Columns to display</label>
              <div className="bg-slate-50 p-2.5 border rounded-sm grid grid-cols-2 gap-2 text-xs font-bold">
                {customEntity === 'invoices' && ['Date', 'InvoiceNo', 'Customer', 'ItemsCount', 'NetTotal', 'PayMethod', 'User'].map(col => (
                  <label key={col} className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customSelectedColumns.includes(col)}
                      onChange={(e) => {
                        if (e.target.checked) setCustomSelectedColumns([...customSelectedColumns, col]);
                        else setCustomSelectedColumns(customSelectedColumns.filter(c => c !== col));
                      }}
                    />
                    <span>{col}</span>
                  </label>
                ))}
                {customEntity === 'products' && ['PartNumber', 'Brand', 'Category', 'StockQty', 'MinAlert', 'SalePrice', 'CostPrice'].map(col => (
                  <label key={col} className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customSelectedColumns.includes(col)}
                      onChange={(e) => {
                        if (e.target.checked) setCustomSelectedColumns([...customSelectedColumns, col]);
                        else setCustomSelectedColumns(customSelectedColumns.filter(c => c !== col));
                      }}
                    />
                    <span>{col}</span>
                  </label>
                ))}
                {customEntity === 'customers' && ['CustomerName', 'City', 'Phone', 'CreditLimit', 'CreditBalance', 'Type'].map(col => (
                  <label key={col} className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customSelectedColumns.includes(col)}
                      onChange={(e) => {
                        if (e.target.checked) setCustomSelectedColumns([...customSelectedColumns, col]);
                        else setCustomSelectedColumns(customSelectedColumns.filter(c => c !== col));
                      }}
                    />
                    <span>{col}</span>
                  </label>
                ))}
                {customEntity === 'payments' && ['Date', 'Party', 'Amount', 'Method', 'Reference', 'Type', 'Notes'].map(col => (
                  <label key={col} className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customSelectedColumns.includes(col)}
                      onChange={(e) => {
                        if (e.target.checked) setCustomSelectedColumns([...customSelectedColumns, col]);
                        else setCustomSelectedColumns(customSelectedColumns.filter(c => c !== col));
                      }}
                    />
                    <span>{col}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Matching parameters */}
            <div className="space-y-3 pt-2">
              <label className="text-[10px] text-gray-400 font-extrabold uppercase block select-none">3. Range Criteria</label>
              
              <div className="space-y-1">
                <span className="text-[10px] text-gray-500 block uppercase font-bold">Search Text</span>
                <input
                  type="text"
                  placeholder="type words to match..."
                  value={customSearchText}
                  onChange={(e) => setCustomSearchText(e.target.value)}
                  className="w-full text-xs p-2 border bg-white"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-gray-500 block uppercase font-bold">Minimum valuation threshold</span>
                <input
                  type="number"
                  value={customMinAmount}
                  onChange={(e) => setCustomMinAmount(Number(e.target.value))}
                  className="w-full text-xs p-2 border font-mono bg-white"
                />
              </div>
            </div>

            <button
              onClick={handleExportCustomBuilder}
              disabled={currentCustomRows.length === 0}
              className="w-full bg-[#0EA5E9] hover:bg-sky-600 text-white font-black uppercase text-xs p-2.5 rounded-sm tracking-widest cursor-pointer disabled:opacity-50 transition-colors flex items-center justify-center space-x-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Compile & Download Builder XLS</span>
            </button>
          </div>

          {/* Table display on right */}
          <div className="lg:col-span-8 bg-white border border-[#E2DFDF] flex flex-col min-h-[460px]">
            <div className="p-3 bg-slate-50 border-b flex justify-between select-none">
              <span className="text-xs font-black uppercase text-slate-800">Custom Table Preview ({currentCustomRows.length} rows matching)</span>
              <span className="text-[10px] uppercase font-bold text-gray-400">Built Dynamic</span>
            </div>
            
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left text-xs font-medium">
                <thead>
                  <tr className="bg-slate-100 border-b uppercase text-[9px] text-gray-400 font-black">
                    {customSelectedColumns.map(col => (
                      <th key={col} className="p-2.5">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 font-medium">
                  {currentCustomRows.length === 0 ? (
                    <tr>
                      <td colSpan={customSelectedColumns.length || 1} className="p-8 text-center text-gray-400 text-xs">
                        No rows matching the builder parameters matching the custom search criteria.
                      </td>
                    </tr>
                  ) : (
                    currentCustomRows.slice(0, 15).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50">
                        {customSelectedColumns.map(col => {
                          let valStr = '';
                          if (customEntity === 'invoices') {
                            if (col === 'Date') valStr = row.timestamp?.split('T')[0] || '';
                            if (col === 'InvoiceNo') valStr = row.invoice_number || '';
                            if (col === 'Customer') valStr = row.customer_name || '';
                            if (col === 'ItemsCount') valStr = (row.items?.length || 0).toString();
                            if (col === 'NetTotal') valStr = `Rs. ${(row.net_amount || 0).toLocaleString()}`;
                            if (col === 'PayMethod') valStr = row.payment_method || '';
                            if (col === 'User') valStr = row.user || '';
                          } else if (customEntity === 'products') {
                            if (col === 'PartNumber') valStr = row.part_number || '';
                            if (col === 'Brand') valStr = row.brand || '';
                            if (col === 'Category') valStr = row.category || '';
                            if (col === 'StockQty') valStr = (row.stock_qty || 0).toString();
                            if (col === 'MinAlert') valStr = (row.min_stock_alert || 0).toString();
                            if (col === 'SalePrice') valStr = `Rs. ${(row.sale_price || 0).toLocaleString()}`;
                            if (col === 'CostPrice') valStr = revealRealValues ? `Rs. ${(row.cost_price || 0).toLocaleString()}` : encodeCipher(row.cost_price, cipherKey);
                          } else if (customEntity === 'customers') {
                            if (col === 'CustomerName') valStr = row.name || '';
                            if (col === 'City') valStr = row.city || '';
                            if (col === 'Phone') valStr = row.phone || '';
                            if (col === 'CreditLimit') valStr = `Rs. ${(row.credit_limit || 0).toLocaleString()}`;
                            if (col === 'CreditBalance') valStr = `Rs. ${(row.credit_balance || 0).toLocaleString()}`;
                            if (col === 'Type') valStr = row.customer_type || '';
                          } else if (customEntity === 'payments') {
                            if (col === 'Date') valStr = row.date || row.timestamp?.split('T')[0] || '';
                            if (col === 'Party') valStr = row.party_name || '';
                            if (col === 'Amount') valStr = `Rs. ${(row.amount || 0).toLocaleString()}`;
                            if (col === 'Method') valStr = row.method || '';
                            if (col === 'Reference') valStr = row.transaction_ref || '';
                            if (col === 'Type') valStr = row.type || '';
                            if (col === 'Notes') valStr = row.notes || '';
                          }
                          return (
                            <td key={col} className="p-2.5 font-bold">{valStr}</td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {currentCustomRows.length > 15 && (
                <p className="p-2 bg-slate-50 text-[10px] text-gray-400 font-extrabold text-center uppercase tracking-wide">
                  Preview shows top 15 results. Download Dynamic CSV to inspect all rows.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
