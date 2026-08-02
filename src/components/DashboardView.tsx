import React, { useState, useEffect } from 'react';
import { db, encodeCipher } from '../data';
import { getSupabaseConfig } from '../supabase';
import { Product, StockMovement, Party, Invoice, ChequeRecord, Return } from '../types';
import { 
  LayoutDashboard, 
  AlertTriangle, 
  RefreshCw, 
  ArrowRight, 
  Database, 
  DollarSign, 
  TrendingUp, 
  ArrowUpRight, 
  Layers,
  Target,
  Calendar,
  Users,
  ShoppingBag,
  Plus,
  Activity,
  FileText,
  CheckCircle,
  AlertCircle,
  TrendingDown,
  ArrowDownRight,
  ClipboardList
} from 'lucide-react';

interface DashboardViewProps {
  userRole: 'Owner' | 'Staff';
  cipherKey: string;
  onNavigate: (tab: string) => void;
  revealRealValues?: boolean;
}

export default function DashboardView({ userRole, cipherKey, onNavigate, revealRealValues = false }: DashboardViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [cheques, setCheques] = useState<ChequeRecord[]>([]);
  const [syncQueue, setSyncQueue] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState(() => getSupabaseConfig().isActive);

  useEffect(() => {
    setProducts(db.getProducts());
    setMovements(db.getMovements());
    setParties(db.getParties());
    setInvoices(db.getInvoices().filter(i => i.is_active && i.status !== 'draft'));
    setReturns(db.getReturns());
    setSyncQueue(db.getSyncQueue());
    setCheques(db.getCheques());
  }, []);

  const totalProducts = products.length;
  const lowStockCount = products.filter(p => p.stock_qty <= p.min_stock_alert).length;
  
  // Sale values metrics
  const totalStockSaleValue = products.reduce((acc, p) => acc + (p.sale_price * p.stock_qty), 0);
  const totalStockCostValue = products.reduce((acc, p) => acc + (p.cost_price * p.stock_qty), 0);

  // 10.2 STATS CALCULATIONS
  const todayDate = new Date();
  
  // Today's Sales calculation (cash vs credit split)
  const todayInvoices = invoices.filter(inv => {
    if (!inv.timestamp) return false;
    const invDate = new Date(inv.timestamp);
    return invDate.getFullYear() === todayDate.getFullYear() &&
           invDate.getMonth() === todayDate.getMonth() &&
           invDate.getDate() === todayDate.getDate();
  });

  const todayReturns = returns.filter(ret => {
    if (!ret.timestamp) return false;
    const retDate = new Date(ret.timestamp);
    return retDate.getFullYear() === todayDate.getFullYear() &&
           retDate.getMonth() === todayDate.getMonth() &&
           retDate.getDate() === todayDate.getDate();
  });
  const todayReturnsTotal = todayReturns.reduce((sum, ret) => sum + (ret.credit_amount || 0), 0);
  
  const rawTodaySales = todayInvoices.reduce((sum, inv) => sum + (inv.net_amount || 0), 0);
  const todaySalesTotal = Math.max(0, rawTodaySales - todayReturnsTotal);
  const todaySalesCash = todayInvoices.reduce((sum, inv) => sum + (inv.received_amount || 0), 0);
  const todaySalesCredit = todayInvoices.reduce((sum, inv) => sum + Math.max(0, (inv.net_amount || 0) - (inv.received_amount || 0)), 0);

  // Outstanding Accounts Receivable (AR) total
  const totalOutstandingAR = parties
    .filter(p => p.customer_type && p.credit_balance > 0)
    .reduce((sum, p) => sum + p.credit_balance, 0);

  // Cash in hand
  const cashTransactionsLocal = db.getCashbook();
  const currentCashInHand = cashTransactionsLocal.length > 0
    ? cashTransactionsLocal[cashTransactionsLocal.length - 1].running_balance
    : 0;

  // 9.5 Sales Target KPI metrics calculation
  const salesTargetVal = Number(localStorage.getItem('kfh_sales_target') || '1000000');
  const targetYear = todayDate.getFullYear();
  const targetMonth = todayDate.getMonth(); // 0-indexed
  
  const currentMonthInvoices = invoices.filter(inv => {
    if (!inv.timestamp) return false;
    const invDate = new Date(inv.timestamp);
    return invDate.getFullYear() === targetYear && invDate.getMonth() === targetMonth;
  });

  const currentMonthReturns = returns.filter(ret => {
    if (!ret.timestamp) return false;
    const retDate = new Date(ret.timestamp);
    return retDate.getFullYear() === targetYear && retDate.getMonth() === targetMonth;
  });
  const currentMonthReturnsTotal = currentMonthReturns.reduce((sum, ret) => sum + (ret.credit_amount || 0), 0);
  
  const rawCurrentMonthSales = currentMonthInvoices.reduce((sum, inv) => sum + (inv.net_amount || 0), 0);
  const currentMonthSalesAmount = Math.max(0, rawCurrentMonthSales - currentMonthReturnsTotal);
  
  const pctAchieved = salesTargetVal > 0 ? (currentMonthSalesAmount / salesTargetVal) * 100 : 0;
  const rsRemaining = Math.max(0, salesTargetVal - currentMonthSalesAmount);
  
  // Total Days in current calendar month:
  const totalDaysInCurrentMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const activeDay = todayDate.getDate(); // e.g. 20
  const daysRemaining = Math.max(0, totalDaysInCurrentMonth - activeDay); // e.g. 10
  
  // Daily Average Need:
  const dailyAverageNeeded = daysRemaining > 0 ? (rsRemaining / daysRemaining) : 0;

  // 10.3 ALERTS DATA GENERATORS
  
  // Due payments: list of customers with payment due in next 3 days. Red if overdue, amber if due today, gray if upcoming.
  const getDuePaymentsList = () => {
    const todayNorm = new Date();
    todayNorm.setHours(0,0,0,0);

    const creditAndPartialDocs = invoices.filter(inv => {
      const remainingUnpaid = (inv.net_amount || 0) - (inv.received_amount || 0);
      return remainingUnpaid > 0 && inv.status !== 'returned';
    });

    const mappedUpcoming = creditAndPartialDocs.map(inv => {
      const party = parties.find(p => p.id === inv.party_id);
      let termDays = 30; // standard 30 day trade credit limit
      if (party && party.payment_terms) {
        const match = party.payment_terms.match(/\d+/);
        if (match) termDays = parseInt(match[0], 10);
      }

      const invDate = new Date(inv.timestamp);
      const dueDate = new Date(invDate);
      dueDate.setDate(invDate.getDate() + termDays);
      dueDate.setHours(0,0,0,0);

      const diffTime = dueDate.getTime() - todayNorm.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));

      return {
        id: inv.id,
        invoice_number: inv.invoice_number,
        customer_name: inv.customer_name || party?.name || 'Walk-in Customer',
        outstanding: inv.net_amount - inv.received_amount,
        dueDate: dueDate.toISOString().split('T')[0],
        diffDays
      };
    });

    // Filtering for items overdue (diffDays < 0), due today (diffDays === 0), or due upcoming in next 3 days (diffDays > 0 && diffDays <= 3)
    return mappedUpcoming
      .filter(item => item.diffDays <= 3)
      .sort((a,b) => a.diffDays - b.diffDays);
  };

  // Low stock alert products
  const getLowStockAlerts = () => {
    return products
      .filter(p => p.stock_qty <= p.min_stock_alert)
      .sort((a, b) => a.stock_qty - b.stock_qty);
  };

  // Pending cheques due this week (within next 7 days, or past due)
  const getPendingChequesThisWeek = () => {
    const todayNorm = new Date();
    todayNorm.setHours(0,0,0,0);

    return cheques
      .filter(c => c.status === 'pending')
      .map(c => {
        const dDate = new Date(c.due_date);
        dDate.setHours(0,0,0,0);
        const diffTime = dDate.getTime() - todayNorm.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));
        return {
          ...c,
          diffDays
        };
      })
      .filter(c => c.diffDays <= 7)
      .sort((a,b) => a.diffDays - b.diffDays);
  };

  // 10.5 TOP PRODUCTS BY QUANTITY
  const getTopProductsThisMonth = () => {
    const productSalesMap: Record<string, { part_number: string; brand: string; units_sold: number; revenue: number }> = {};

    currentMonthInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const prodId = item.product_id;
        if (!productSalesMap[prodId]) {
          productSalesMap[prodId] = {
            part_number: item.part_number,
            brand: item.brand,
            units_sold: 0,
            revenue: 0
          };
        }
        productSalesMap[prodId].units_sold += (item.qty || 0);
        productSalesMap[prodId].revenue += (item.line_total || 0);
      });
    });

    return Object.values(productSalesMap)
      .sort((a, b) => b.units_sold - a.units_sold)
      .slice(0, 5);
  };

  const simulateSync = () => {
    if (syncQueue.length === 0) return;
    setIsSyncing(true);
    setTimeout(() => {
      db.clearSyncQueue();
      setSyncQueue([]);
      setIsSyncing(false);
    }, 1500);
  };

  const toggleOnline = () => {
    const nextVal = !onlineStatus;
    setOnlineStatus(nextVal);
    localStorage.setItem('kfh_supabase_sync_active', nextVal ? 'true' : 'false');
    db.logPendingSync(`Sync parameter set dynamically to ${nextVal ? 'ONLINE' : 'OFFLINE'}`);
  };

  return (
    <div className="space-y-6" id="dashboard-container">
      {/* Network and Sync Status Bar */}
      <div className="bg-white p-3 rounded border border-[#E2DFDF] flex items-center justify-between" id="sync-status-bar">
        <div className="flex items-center space-x-3">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${onlineStatus ? 'bg-green-600' : 'bg-amber-500'}`}></span>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#2A2727]">
            {onlineStatus ? 'Online Mode (Auto-Syncing Supabase)' : 'Offline-First Mode (Local-Only State)'}
          </span>
        </div>
        <div className="flex items-center space-x-4">
          {syncQueue.length > 0 && (
            <span className="text-xs text-[#0EA5E9] font-semibold animate-pulse">
              {syncQueue.length} pending local changes
            </span>
          )}
          <button
            onClick={toggleOnline}
            id="toggle-online-btn"
            className="text-xs px-2.5 py-1 rounded text-[#2A2727] bg-[#F5F4F4] border border-[#E2DFDF] font-medium hover:bg-gray-200 transition-none"
          >
            Go {onlineStatus ? 'Offline' : 'Online'}
          </button>
          <button
            onClick={simulateSync}
            disabled={isSyncing || syncQueue.length === 0}
            id="force-sync-btn"
            className={`text-xs px-3 py-1 rounded bg-[#0EA5E9] text-white flex items-center space-x-1 hover:bg-sky-600 transition-none disabled:bg-gray-300 disabled:text-gray-500`}
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

      {/* 10.2 TOP STATS ROW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="top-card-stats-row">
        {/* Card 1: Today's Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100/80 shadow-xs flex flex-col justify-between relative hover:shadow-md hover:border-slate-200/50 transition-all duration-300" id="stat-card-today-sales">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block font-sans mb-1 select-none">Today's Sales</span>
              <h3 className="text-[19px] font-extrabold text-slate-900 leading-tight">
                Rs. {todaySalesTotal.toLocaleString()}
              </h3>
              {todayReturnsTotal > 0 && (
                <span className="text-[10px] text-red-500 font-bold block mt-1 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 w-max">
                  Deducted Returns: Rs. {todayReturnsTotal.toLocaleString()}
                </span>
              )}
            </div>
            {/* Sparkline Visual in Emerald */}
            <div className="opacity-95 text-emerald-500 scale-95" title="Daily steady sales curve">
              <svg className="w-14 h-8 overflow-visible" viewBox="0 0 50 20" fill="none">
                <path d="M 0 17 Q 8 8 18 14 T 36 6 T 50 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M 0 17 Q 8 8 18 14 T 36 6 T 50 1 L 50 20 L 0 20 Z" fill="url(#grad-today)" opacity="0.1" />
                <defs>
                  <linearGradient id="grad-today" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
          <div className="mt-4 pt-2 border-t border-dashed border-slate-100 flex justify-between text-[10px] font-bold text-slate-500 font-sans">
            <div>
              <span className="text-emerald-600">Cash:</span> Rs. {todaySalesCash.toLocaleString()}
            </div>
            <div>
              <span className="text-[#0EA5E9]">Credit:</span> Rs. {todaySalesCredit.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Card 2: Outstanding A/R Total */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100/80 shadow-xs flex flex-col justify-between relative hover:shadow-md hover:border-slate-200/50 transition-all duration-300" id="stat-card-outstanding-ar">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block font-sans mb-1 select-none">Outstanding A/R Total</span>
              <h3 className="text-[19px] font-extrabold text-[#0EA5E9] leading-tight">
                Rs. {totalOutstandingAR.toLocaleString()}
              </h3>
            </div>
            {/* Sparkline visual in Cyan / Sky */}
            <div className="opacity-95 text-[#0EA5E9] scale-95" title="Collectables tracking graph">
              <svg className="w-14 h-8 overflow-visible" viewBox="0 0 50 20" fill="none">
                <path d="M 0 18 Q 12 11 22 15 T 38 12 T 50 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M 0 18 Q 12 11 22 15 T 38 12 T 50 2 L 50 20 L 0 20 Z" fill="url(#grad-ar)" opacity="0.1" />
                <defs>
                  <linearGradient id="grad-ar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0EA5E9" />
                    <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
          <div className="mt-4 pt-2 border-t border-dashed border-slate-100 flex justify-between items-center text-[10px] text-slate-500 font-sans">
            <span className="font-semibold select-none">Collectable trade debits</span>
            <button 
              onClick={() => onNavigate('parties')} 
              className="text-[#0EA5E9] hover:underline hover:text-sky-800 font-bold flex items-center cursor-pointer"
            >
              <span>Ledgers</span>
              <ArrowRight className="w-2.5 h-2.5 ml-0.5" />
            </button>
          </div>
        </div>

        {/* Card 3: Cash In Hand */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100/80 shadow-xs flex flex-col justify-between relative hover:shadow-md hover:border-slate-200/50 transition-all duration-300" id="stat-card-cash-hand">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block font-sans mb-1 select-none">Cash in Hand</span>
              <h3 className="text-[19px] font-extrabold text-slate-800 leading-tight">
                Rs. {currentCashInHand.toLocaleString()}
              </h3>
            </div>
            {/* Sparkline curve for Liquid cash register */}
            <div className="opacity-95 text-indigo-400 scale-95" title="Physical cash trend line">
              <svg className="w-14 h-8 overflow-visible" viewBox="0 0 50 20" fill="none">
                <path d="M 0 5 Q 15 15 25 2 T 42 12 T 50 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M 0 5 Q 15 15 25 2 T 42 12 T 50 14 L 50 20 L 0 20 Z" fill="url(#grad-cash)" opacity="0.1" />
                <defs>
                  <linearGradient id="grad-cash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818CF8" />
                    <stop offset="100%" stopColor="#818CF8" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
          <div className="mt-4 pt-2 border-t border-dashed border-slate-100 flex justify-between items-center text-[10px] text-slate-500 font-sans">
            <span className="font-semibold select-none">Sovereign shop cash pool</span>
            <button 
              onClick={() => {
                localStorage.setItem('kfh_active_accounts_subtab', 'cashbook');
                onNavigate('accounts');
              }} 
              className="text-[#0EA5E9] hover:underline hover:text-sky-800 font-bold flex items-center cursor-pointer"
            >
              <span>Register</span>
              <ArrowRight className="w-2.5 h-2.5 ml-0.5" />
            </button>
          </div>
        </div>

        {/* Card 4: Monthly Target Progress Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100/80 shadow-xs flex flex-col justify-between relative hover:shadow-md hover:border-slate-200/50 transition-all duration-300" id="stat-card-target-progress">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-1 select-none">
              <span className="text-[10px] uppercase font-bold tracking-wider font-sans">Monthly Target Progress</span>
              <Target className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="flex justify-between items-baseline mb-2">
              <h3 className="text-[19px] font-extrabold text-emerald-700 leading-tight">
                {pctAchieved.toFixed(1)}%
              </h3>
              <span className="text-[9px] text-slate-500 font-bold">
                Rs. {currentMonthSalesAmount.toLocaleString()} active
              </span>
            </div>
          </div>
          <div className="mt-1" id="mini-progress-gauge">
            <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden flex border border-slate-200/50">
              <div 
                style={{ width: `${Math.min(100, pctAchieved)}%` }}
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              ></div>
            </div>
            <div className="mt-1.5 flex justify-between text-[8px] text-slate-400 font-mono">
              <span className="font-semibold">Goal: {salesTargetVal >= 1000000 ? `${(salesTargetVal/1000000).toFixed(1)}M` : salesTargetVal.toLocaleString()}</span>
              <span className="font-bold">Needs Rs. {Math.round(dailyAverageNeeded).toLocaleString()}/day</span>
            </div>
          </div>
        </div>
      </div>

      {/* 10.4 QUICK ACTIONS BUTTONS ROW */}
      <div className="bg-white p-4 rounded border border-[#E2DFDF]" id="quick-actions-panel">
        <h4 className="text-xs uppercase tracking-wider font-black text-slate-800 mb-3 flex items-center">
          <Activity className="w-3.5 h-3.5 mr-1 text-[#0EA5E9]" />
          Quick Operational Triggers
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5" id="quick-actions-buttons-grid">
          {/* Action 1: New Invoice (Large red) */}
          <button
            onClick={() => onNavigate('invoice')}
            className="group py-3 px-4 bg-[#0EA5E9] text-white hover:bg-sky-600 font-black text-xs uppercase tracking-wider rounded border border-[#0EA5E9] shadow-sm flex items-center justify-between transition-all cursor-pointer"
            id="quick-act-new-invoice"
          >
            <span className="flex items-center space-x-2">
              <Plus className="w-4 h-4 font-black text-white" />
              <span>New Retail / wholesale Invoice</span>
            </span>
            <ArrowUpRight className="w-4 h-4 text-white opacity-90 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>

          {/* Action 2: New Quotation */}
          <button
            onClick={() => onNavigate('quotations')}
            className="group py-3 px-4 bg-white text-[#2A2727] border border-[#E2DFDF] hover:bg-gray-50 font-bold text-xs uppercase tracking-wider rounded shadow-2xs flex items-center justify-between transition-none cursor-pointer"
            id="quick-act-new-quote"
          >
            <span className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-[#0EA5E9]" />
              <span>Create Quotation File</span>
            </span>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Action 3: New Purchase / Sourcing */}
          <button
            onClick={() => onNavigate('purchases')}
            className="group py-3 px-4 bg-white text-[#2A2727] border border-[#E2DFDF] hover:bg-gray-50 font-bold text-xs uppercase tracking-wider rounded shadow-2xs flex items-center justify-between transition-none cursor-pointer"
            id="quick-act-new-purchase"
          >
            <span className="flex items-center space-x-2">
              <ShoppingBag className="w-4 h-4 text-[#0EA5E9]" />
              <span>New Supplier Purchase</span>
            </span>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Action 4: Add Product Catalog Item (Deep Link opens Modal) */}
          <button
            onClick={() => {
              localStorage.setItem('kfh_open_add_product_modal', 'true');
              onNavigate('inventory');
            }}
            className="group py-3 px-4 bg-white text-[#2A2727] border border-[#E2DFDF] hover:bg-gray-50 font-bold text-xs uppercase tracking-wider rounded shadow-2xs flex items-center justify-between transition-none cursor-pointer"
            id="quick-act-add-product"
          >
            <span className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-[#0EA5E9]" />
              <span>Add Catalog Product item</span>
            </span>
            <Plus className="w-4 h-4 text-gray-400 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>

      {/* 10.3 ALERTS SECTION BENTO ROW */}
      <div className="bg-white p-4 rounded border border-[#E2DFDF]" id="business-alerts-center">
        <h4 className="text-xs uppercase tracking-wider font-black text-slate-800 mb-3 flex items-center">
          <AlertCircle className="w-4 h-4 mr-1.5 text-[#0EA5E9] animate-pulse" />
          Critical Operational Alerts Area
        </h4>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" id="alerts-bento-grid">
          {/* Sub-Section 1: Due Customer Payments */}
          <div className="p-3 bg-gray-50 rounded border border-[#E2DFDF] flex flex-col justify-between" id="alert-due-payments">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-gray-200 mb-2">
                <span className="text-xs font-bold uppercase text-slate-700 tracking-tight flex items-center">
                  <DollarSign className="w-3.5 h-3.5 text-rose-600 mr-1" />
                  Due/Overdue Payments ({getDuePaymentsList().length})
                </span>
                <span className="text-[9px] bg-sky-100 text-[#0EA5E9] px-1 rounded font-bold font-mono">
                  3-Days Window
                </span>
              </div>

              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {getDuePaymentsList().length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-[10px] font-sans">
                    No collectable customer invoices due in next 3 days!
                  </div>
                ) : (
                  getDuePaymentsList().map(item => (
                    <div key={item.id} className="p-2 bg-white rounded border border-gray-150 flex justify-between items-center text-[10px]">
                      <div className="truncate max-w-[120px]">
                        <p className="font-extrabold text-[#2A2727] truncate">{item.customer_name}</p>
                        <p className="text-[9px] text-gray-400 font-mono select-all">INV: {item.invoice_number}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-[#0ea5e9] font-mono">Rs. {item.outstanding.toLocaleString()}</p>
                        {item.diffDays < 0 ? (
                          <span className="text-[8px] bg-red-105 text-[#0ea5e9] px-1 py-0.2 rounded font-bold uppercase border border-sky-200">
                            Overdue {Math.abs(item.diffDays)}d
                          </span>
                        ) : item.diffDays === 0 ? (
                          <span className="text-[8px] bg-amber-100 text-amber-900 px-1 py-0.2 rounded font-bold uppercase border border-amber-300">
                            Due Today
                          </span>
                        ) : (
                          <span className="text-[8px] bg-gray-100 text-gray-600 px-1 py-0.2 rounded font-bold font-mono">
                            In {item.diffDays}d
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <button
              onClick={() => onNavigate('parties')}
              className="mt-3 w-full text-center text-[10px] text-[#0EA5E9] font-extrabold uppercase hover:underline flex items-center justify-center pt-2 border-t border-gray-200"
            >
              <span>Verify Party Receivables Ledger</span>
              <ArrowRight className="w-3 h-3 ml-1" />
            </button>
          </div>

          {/* Sub-Section 2: Critical Low Stock Alerts */}
          <div className="p-3 bg-gray-50 rounded border border-[#E2DFDF] flex flex-col justify-between" id="alert-low-stocks">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-gray-200 mb-2">
                <span className="text-xs font-bold uppercase text-slate-700 tracking-tight flex items-center">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mr-1" />
                  Min-Stock Restock Reqd ({getLowStockAlerts().length})
                </span>
                <span className="text-[9px] bg-amber-50 text-amber-800 px-1.5 py-0.2 rounded font-extrabold uppercase">
                  Alert
                </span>
              </div>

              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {getLowStockAlerts().length === 0 ? (
                  <div className="text-center py-6 text-emerald-800 text-[10px] bg-emerald-50/50 rounded border border-emerald-100 font-sans font-bold">
                     All product inventory stock counts are healthy!
                  </div>
                ) : (
                  getLowStockAlerts().slice(0, 10).map(prod => (
                    <div 
                      key={prod.id} 
                      onClick={() => {
                        localStorage.setItem('kfh_selected_product_id', prod.id);
                        localStorage.setItem('kfh_active_inventory_tab', 'all');
                        onNavigate('inventory');
                      }}
                      className="p-2 bg-white rounded border border-gray-150 hover:border-[#0EA5E9] cursor-pointer flex justify-between items-center text-[10px] transition-all"
                    >
                      <div className="truncate pr-1.5 max-w-[140px]">
                        <p className="font-extrabold text-[#2A2727] truncate select-all">{prod.part_number}</p>
                        <p className="text-[9px] text-gray-400 capitalize">{prod.brand} • {prod.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-[#0EA5E9] font-mono">{prod.stock_qty} pcs</p>
                        <span className="text-[8px] text-gray-400">Min: {prod.min_stock_alert}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => {
                localStorage.setItem('kfh_active_inventory_tab', 'low_stock');
                onNavigate('inventory');
              }}
              className="mt-3 w-full text-center text-[10px] text-[#0EA5E9] font-extrabold uppercase hover:underline flex items-center justify-center pt-2 border-t border-gray-200"
            >
              <span>Restock Low Inventory Stock Tab</span>
              <ArrowRight className="w-3 h-3 ml-1" />
            </button>
          </div>

          {/* Sub-Section 3: Pending Cheques This Week */}
          <div className="p-3 bg-gray-50 rounded border border-[#E2DFDF] flex flex-col justify-between" id="alert-pending-cheques">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-gray-200 mb-2">
                <span className="text-xs font-bold uppercase text-slate-700 tracking-tight flex items-center">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 mr-1" />
                  Weekly Cheques Due ({getPendingChequesThisWeek().length})
                </span>
                <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-extrabold uppercase">
                  Week
                </span>
              </div>

              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {getPendingChequesThisWeek().length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-[10px] font-sans">
                    No pending customer or supplier cheques due this week.
                  </div>
                ) : (
                  getPendingChequesThisWeek().map(cheque => (
                    <div key={cheque.id} className="p-2 bg-white rounded border border-gray-150 flex justify-between items-center text-[10px]">
                      <div className="truncate max-w-[124px]">
                        <p className="font-extrabold text-[#2A2727] truncate">{cheque.party_name}</p>
                        <p className="text-[9px] text-gray-400 font-mono">No: {cheque.cheque_number}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-700 font-mono">Rs. {cheque.amount.toLocaleString()}</p>
                        {cheque.diffDays < 0 ? (
                          <span className="text-[8px] bg-sky-100 text-[#0EA5E9] px-1 rounded font-bold uppercase">
                            Overdue {Math.abs(cheque.diffDays)}d
                          </span>
                        ) : cheque.diffDays === 0 ? (
                          <span className="text-[8px] bg-amber-150 text-[#2A2727] px-1 rounded font-bold uppercase">
                            Due Today
                          </span>
                        ) : (
                          <span className="text-[8px] bg-blue-10 text-blue-800 px-1 rounded font-bold">
                            In {cheque.diffDays}d
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => {
                localStorage.setItem('kfh_active_accounts_subtab', 'cheques');
                onNavigate('accounts');
              }}
              className="mt-3 w-full text-center text-[10px] text-[#0EA5E9] font-extrabold uppercase hover:underline flex items-center justify-center pt-2 border-t border-gray-200"
            >
              <span>Manage Accounts Cheques Ledger</span>
              <ArrowRight className="w-3 h-3 ml-1" />
            </button>
          </div>
        </div>
      </div>

      {/* RESTOCK PLANNING & LOW STOCK ACTION CENTER */}
      <div className="bg-white p-4 rounded border border-[#E2DFDF]" id="low-stock-action-center-widget">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-dashed border-[#E2DFDF] mb-3">
          <div className="flex items-center space-x-2">
            <div className="bg-amber-50 p-1.5 rounded text-amber-600 border border-amber-200">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase text-[#2A2727] tracking-tight">Restock Planning & Low Stock Action Center</h4>
              <p className="text-[10px] text-gray-400 font-extrabold uppercase font-sans">
                Actionable catalog items currently below minimum stock threshold, linked to direct replenishment controls
              </p>
            </div>
          </div>
          
          <div className="text-right flex items-baseline space-x-1 sm:block font-mono">
            <span className="text-[10px] text-gray-400 uppercase font-black tracking-tight">Depleted items: </span>
            <span className="text-xs font-black text-[#0EA5E9] font-bold font-mono">
              {getLowStockAlerts().length} of {totalProducts} items ({totalProducts > 0 ? Math.round((getLowStockAlerts().length / totalProducts) * 100) : 0}%)
            </span>
          </div>
        </div>

        {getLowStockAlerts().length === 0 ? (
          <div className="text-center py-8 text-emerald-800 text-xs bg-emerald-50/50 rounded border border-emerald-150 font-sans font-bold flex flex-col items-center justify-center space-y-2">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
            <span>Success: All product catalog inventory stock levels are healthy! No items are currently below thresholds.</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-medium text-left border-collapse" id="low-stock-planning-table">
                <thead>
                  <tr className="border-b border-[#E2DFDF] text-gray-500 text-[10px] uppercase">
                    <th className="py-2">Item Details</th>
                    <th className="py-2 text-center font-bold">Category / Shelf</th>
                    <th className="py-2 text-center font-bold">Current Stock</th>
                    <th className="py-2 text-center font-bold">Min Threshold</th>
                    <th className="py-2">Stock Level Indicator</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {getLowStockAlerts().map((prod) => {
                    const ratio = prod.min_stock_alert > 0 ? Math.min(100, Math.max(0, (prod.stock_qty / prod.min_stock_alert) * 100)) : 0;
                    return (
                      <tr key={prod.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3">
                          <button
                            onClick={() => {
                              localStorage.setItem('kfh_selected_product_id', prod.id);
                              localStorage.setItem('kfh_active_inventory_tab', 'all');
                              onNavigate('inventory');
                            }}
                            className="font-bold font-mono text-[#0EA5E9] hover:underline text-left block cursor-pointer text-xs"
                          >
                            {prod.part_number}
                          </button>
                          <span className="text-[10px] text-gray-400 font-bold uppercase">{prod.brand}</span>
                        </td>
                        <td className="py-3 text-center">
                          <div className="font-semibold text-slate-800">{prod.category}</div>
                          <div className="text-[9px] text-gray-400 font-mono">Shelf: {prod.shelf_location || 'N/A'}</div>
                        </td>
                        <td className="py-3 text-center">
                          <span className={`font-bold font-mono text-xs px-2 py-0.5 rounded ${
                            prod.stock_qty === 0 ? 'bg-sky-100 text-sky-700 font-bold' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {prod.stock_qty} pcs
                          </span>
                        </td>
                        <td className="py-3 text-center font-mono text-gray-500 font-semibold">
                          {prod.min_stock_alert} pcs
                        </td>
                        <td className="py-3">
                          <div className="w-[140px] max-w-full">
                            <div className="flex justify-between text-[9px] text-gray-400 font-mono mb-1">
                              <span>{ratio.toFixed(0)}% of Min</span>
                              <span>Deficit: {prod.min_stock_alert - prod.stock_qty}</span>
                            </div>
                            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden flex border border-gray-150">
                              <div
                                style={{ width: `${ratio}%` }}
                                className={`h-full rounded-full transition-all ${
                                  prod.stock_qty === 0 ? 'bg-[#0ea5e9]' : 'bg-amber-500'
                                }`}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => {
                              localStorage.setItem('kfh_selected_product_id', prod.id);
                              localStorage.setItem('kfh_active_inventory_tab', 'all');
                              onNavigate('inventory');
                            }}
                            className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 bg-white border border-[#E2DFDF] hover:border-[#0EA5E9] hover:text-[#0EA5E9] rounded transition-colors inline-flex items-center space-x-1 cursor-pointer"
                          >
                            <span>Open Details</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 9.5 MONTHLY MILESTONE SALES TARGET PROGRESS MONITOR */}
      <div className="bg-white p-4 rounded border border-[#E2DFDF]" id="sales-target-progress-widget">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-dashed border-[#E2DFDF] mb-3">
          <div className="flex items-center space-x-2">
            <div className="bg-[#FFF2F2] p-1.5 rounded text-[#0EA5E9]">
              <Target className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase text-[#2A2727] tracking-tight">Monthly Sales Target & Performance KPI Tracker</h4>
              <p className="text-[10px] text-gray-400 font-extrabold uppercase font-sans">
                Real-time tracking of current month billing metrics vs configured milestones
              </p>
            </div>
          </div>
          
          <div className="text-right flex items-baseline space-x-1 sm:block font-mono">
            <span className="text-xs text-gray-400 uppercase font-black tracking-tight text-[10px]">Target: </span>
            <span className="text-xs font-black text-[#2A2727] font-bold font-mono">Rs. {salesTargetVal.toLocaleString()}</span>
          </div>
        </div>

        {/* Progress Gauge */}
        <div className="space-y-2">
          <div className="flex justify-between items-baseline text-xs font-bold text-[#2A2727]">
            <span className="flex items-center space-x-2">
              <span className="font-extrabold uppercase">Monthly Sales Achieved:</span>
              <span className="text-[#0EA5E9] font-black font-mono text-sm">Rs. {currentMonthSalesAmount.toLocaleString()}</span>
            </span>
            <span className="font-black font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-150 rounded">
              {pctAchieved.toFixed(1)}% Achieved
            </span>
          </div>

          <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden shadow-inner flex border border-gray-205">
            <div 
              style={{ width: `${Math.min(100, pctAchieved)}%` }}
              className="bg-gradient-to-r from-[#0EA5E9] to-emerald-500 h-full rounded-full transition-all duration-500 ease-out"
            ></div>
          </div>
        </div>

        {/* Breakdown Stats Bento Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs font-medium">
          {/* Box A */}
          <div className="bg-gray-50 p-2.5 rounded border border-[#E2DFDF] text-center font-bold">
            <p className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">Rupees Remaining</p>
            <p className="text-[13px] font-black font-mono text-slate-800">
              {rsRemaining === 0 ? 'Rs. 0 (Passed Milestone!)' : `Rs. ${rsRemaining.toLocaleString()}`}
            </p>
          </div>

          {/* Box B */}
          <div className="bg-gray-50 p-2.5 rounded border border-[#E2DFDF] text-center font-bold">
            <p className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5 font-bold">Days Left in Month</p>
            <p className="text-[13px] font-black font-mono text-slate-800">{daysRemaining} days remaining</p>
          </div>

          {/* Box C */}
          <div className="bg-gray-50 p-2.5 rounded border border-[#E2DFDF] text-center font-bold">
            <p className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">Daily Average Required</p>
            <p className="text-[13px] font-black font-mono text-[#0EA5E9]">
              {rsRemaining === 0 ? 'Rs. 0' : `Rs. ${Math.round(dailyAverageNeeded).toLocaleString()} / day`}
            </p>
          </div>

          {/* Box D */}
          <div className="bg-gray-50 p-2.5 rounded border border-[#E2DFDF] text-center font-bold font-sans">
            <p className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5 font-bold">Monthly Orders Logged</p>
            <p className="text-[13px] font-black font-mono text-blue-600">
              {currentMonthInvoices.length} billing files
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-two-column">
        {/* Left Column: Recent Stock Movements Logs (2 spans wide) */}
        <div className="bg-white border border-[#E2DFDF] lg:col-span-2 p-4 rounded shadow-xs" id="recent-logs-panel">
          <div className="flex justify-between items-center pb-3 border-b border-[#F5F4F4]">
            <h4 className="text-xs uppercase tracking-wider font-bold text-[#2A2727] flex items-center">
              <Layers className="w-4.5 h-4.5 mr-1.5 text-[#0EA5E9]" />
              Real-time Stock Activities (Log of movements)
            </h4>
            <span className="text-[10px] text-gray-400 font-mono">Faisalabad Shop Ledger</span>
          </div>
          
          <div className="max-h-[360px] overflow-y-auto divide-y divide-[#F5F4F4] text-xs" id="movements-scroller">
            {movements.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                No recent stock movements recorded.
              </div>
            ) : (
              movements.slice(0, 15).map((mov) => {
                const isPositive = mov.qty_change > 0;
                return (
                  <div key={mov.id} className="py-2.5 flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className={`text-[11px] font-bold font-mono px-1.5 py-0.5 rounded ${
                          mov.type === 'opening_stock' ? 'bg-blue-50 text-blue-700' :
                          mov.type === 'purchased' ? 'bg-emerald-50 text-emerald-700' :
                          mov.type === 'sold' ? 'bg-sky-50 text-sky-700 font-semibold' :
                          mov.type === 'damaged' ? 'bg-amber-100 text-[#2A2727] font-semibold border border-amber-300' : 
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {mov.type.toUpperCase()}
                        </span>
                        <span className="font-bold text-[#2A2727]" id={`mov-prod-id-${mov.product_id}`}>
                          {mov.reason.includes('Toyota') || mov.reason.includes('filter') ? mov.reason : `Product Activity (#${mov.product_id.replace('prod-', '')})`}
                        </span>
                      </div>
                      <div className="text-gray-500 leading-tight">
                        {mov.reason}
                      </div>
                      <div className="text-[10px] text-gray-400 flex items-center space-x-2 font-mono">
                        <span>Logged by {mov.user}</span>
                        <span>•</span>
                        <span>{new Date(mov.timestamp).toLocaleTimeString() || "Today"}</span>
                        <span>•</span>
                        <span>{new Date(mov.timestamp).toLocaleDateString() || "2026-06-20"}</span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <span className={`text-sm font-bold font-mono px-2 py-0.5 ${
                        isPositive ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {isPositive ? `+${mov.qty_change}` : mov.qty_change}
                      </span>
                      <p className="text-[9px] text-gray-400 font-mono mt-1">
                        {mov.from_status} → {mov.to_status}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Top Products & Supabase Sync Logs */}
        <div className="space-y-6" id="dashboard-right-sidebar">
          {/* 10.5 Top Products Card */}
          <div className="bg-white p-4 rounded border border-[#E2DFDF] shadow-xs" id="top-products-leaderboard">
            <h4 className="text-xs uppercase tracking-wider font-bold text-[#2A2727] mb-2 flex items-center justify-between pb-2 border-b border-[#F5F4F4]">
              <span className="flex items-center">
                <TrendingUp className="w-4 h-4 mr-1.5 text-emerald-650 text-emerald-600" />
                This Month's Top 5 Selling Products
              </span>
              <span className="text-[9px] text-gray-450 font-bold bg-gray-100 px-1 py-0.2 rounded uppercase">
                Ranked
              </span>
            </h4>
            <div className="divide-y divide-gray-100" id="top-products-rows">
              {getTopProductsThisMonth().length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-xs font-sans">
                  No products sold yet this calendar month.
                </div>
              ) : (
                getTopProductsThisMonth().map((item, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="truncate max-w-[150px]">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] font-black text-slate-550 font-mono text-gray-400 bg-gray-50 w-4 h-4 rounded-full flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="font-extrabold text-[#2A2727] truncate select-all">{item.part_number}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold ml-5">{item.brand}</span>
                    </div>
                    
                    <div className="text-right font-mono font-bold">
                      <p className="text-[#2A2727]">{item.units_sold.toLocaleString()} units</p>
                      <p className="text-[9px] text-emerald-600">Rs. {item.revenue.toLocaleString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sync Queue Logs */}
          <div className="bg-white p-4 rounded border border-[#E2DFDF] shadow-xs" id="sync-history-card">
            <h4 className="text-xs uppercase tracking-wider font-bold text-[#2A2727] mb-2 flex items-center justify-between">
              <span className="flex items-center">
                <Database className="w-4 h-4 mr-1.5 text-blue-600" />
                Offline Write Buffer
              </span>
              <span className="text-[10px] bg-blue-50 text-blue-700 px-1 py-0.2 rounded font-mono font-bold">
                SUPABASE
              </span>
            </h4>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              App monitors connection. All modifications (products, cost shifts, linkages) write instantly to memory, queuing cloud synchronization tasks.
            </p>
            <div className="bg-gray-50 p-3 rounded text-xs font-mono max-h-[160px] overflow-y-auto divide-y divide-gray-200">
              {syncQueue.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-[11px]">
                  All local commits completely matched with cloud!
                </div>
              ) : (
                syncQueue.map((item: any) => (
                  <div key={item.id} className="py-1.5 text-[10px] text-gray-600 flex justify-between items-center">
                    <span className="truncate pr-2">{item.operation}</span>
                    <span className="text-gray-400 flex-shrink-0">{item.time}</span>
                  </div>
                ))
              )}
            </div>
            {syncQueue.length > 0 && (
              <button
                onClick={simulateSync}
                className="mt-3 w-full text-center text-[11px] text-[#0EA5E9] font-semibold hover:underline flex items-center justify-center space-x-1"
              >
                <span>Process synchronization buffer...</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
