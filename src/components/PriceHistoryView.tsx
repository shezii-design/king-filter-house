import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Calendar, 
  Download, 
  Filter, 
  HelpCircle,
  TrendingDown,
  Percent,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  History,
  UserCheck,
  ShoppingBag
} from 'lucide-react';
import { db, encodeCipher } from '../data';
import { Product, Party, Invoice } from '../types';

interface PriceHistoryViewProps {
  userRole: 'Owner' | 'Staff';
  cipherKey: string;
  revealRealValues: boolean;
}

type ModeType = 'customer' | 'shopkeeper';
type DateFilterType = 'week' | 'month' | 'year' | 'custom';

export default function PriceHistoryView({ 
  userRole, 
  cipherKey, 
  revealRealValues 
}: PriceHistoryViewProps) {
  
  // Tabs: 'customer' vs 'shopkeeper'
  const [activeMode, setActiveMode] = useState<ModeType>('customer');

  // Input Filters
  const [searchQuery, setSearchQuery] = useState<string>(''); // matches Customer name OR Part Number
  const [dateFilter, setDateFilter] = useState<DateFilterType>('month');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // DB datasets
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [parties, setParties] = useState<Party[]>([]);

  useEffect(() => {
    setInvoices(db.getInvoices().filter(i => i.is_active));
    setProducts(db.getProducts());
    setParties(db.getParties());
  }, []);

  // Update date selector range on change
  const handleDateFilterChange = (val: DateFilterType) => {
    setDateFilter(val);
    const today = new Date();
    let start = new Date();

    if (val === 'week') {
      start.setDate(today.getDate() - 7);
    } else if (val === 'month') {
      start.setDate(today.getDate() - 30);
    } else if (val === 'year') {
      start.setFullYear(today.getFullYear() - 1);
    } else {
      return; 
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  };

  // Helper inside range
  const isDateInBounds = (isoStr: string) => {
    const d = new Date(isoStr.split('T')[0]).getTime();
    return d >= new Date(startDate).getTime() && d <= new Date(endDate).getTime();
  };

  // Flattens invoices into list of sold items for pricing audit
  const compileHistoryRows = () => {
    const rows: {
      date: string;
      invoiceNumber: string;
      customerName: string;
      partNumber: string;
      brand: string;
      qty: number;
      priceCharged: number;
      defaultPrice: number;
      variance: number;
      isWhaleDiscount: boolean;
      partyId: string | null;
      partyObj: Party | undefined;
    }[] = [];

    invoices.forEach(inv => {
      // Date filter checks
      if (!isDateInBounds(inv.timestamp)) return;

      // Resolve party details
      const party = parties.find(p => p.id === inv.party_id);
      const isShopType = party?.type === 'shopkeeper' || party?.customer_type === 'shopkeeper';

      // Section filtering criteria:
      // mode customer => non-shopkeeper party or walk-in.
      // mode shopkeeper => only shopkeeper party.
      if (activeMode === 'customer' && isShopType) return;
      if (activeMode === 'shopkeeper' && !isShopType) return;

      inv.items.forEach(item => {
        // Find product reference to resolve standard default retail price
        const prod = products.find(p => p.id === item.product_id);
        const defaultPrice = prod?.sale_price || item.sale_price;
        const variance = item.sale_price - defaultPrice;

        // Smart Query filter: search customer name OR part number of product
        if (searchQuery.trim() !== '') {
          const matchQuery = searchQuery.toLowerCase();
          const matchesCustomer = inv.customer_name.toLowerCase().includes(matchQuery);
          const matchesPart = item.part_number.toLowerCase().includes(matchQuery);
          if (!matchesCustomer && !matchesPart) return;
        }

        rows.push({
          date: inv.timestamp.split('T')[0],
          invoiceNumber: inv.invoice_number,
          customerName: inv.customer_name,
          partNumber: item.part_number,
          brand: item.brand,
          qty: item.qty,
          priceCharged: item.sale_price,
          defaultPrice: defaultPrice,
          variance: variance,
          isWhaleDiscount: item.sale_price < defaultPrice,
          partyId: inv.party_id,
          partyObj: party
        });
      });
    });

    // Chronological order (newest first)
    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const historyRows = compileHistoryRows();

  // Export spreadsheet matching filters
  const handleExportHistoryCSV = () => {
    const headers = ['Date', 'Invoice No', 'Client Name', 'Part Number', 'Brand', 'Qty Sold', 'Wholesale/Retail Price Charged', 'Standard Default Retail', 'Price Variance', 'Discount Status'];
    const formattedRows = historyRows.map(row => [
      row.date,
      row.invoiceNumber,
      row.customerName,
      row.partNumber,
      row.brand,
      row.qty.toString(),
      row.priceCharged.toString(),
      row.defaultPrice.toString(),
      row.variance.toString(),
      row.isWhaleDiscount ? 'Below list price (discounted)' : 'Standard list or premium margin'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...formattedRows.map(e => e.map(v => `"${v.replace(/"/g, '""')}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${activeMode}_price_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4" id="price-history-root">
      
      {/* 8.6 TWO SECTIONS NAVIGATION HEADER */}
      <div className="bg-white p-4 border border-[#E2DFDF] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black uppercase text-slate-800 tracking-tight flex items-center select-none">
            <History className="w-5 h-5 mr-2 text-[#0EA5E9]" />
            Negotiation Trail & Price History Auditor
          </h2>
          <p className="text-[11px] text-gray-500 font-extrabold uppercase tracking-tight">
            Comprehensive audit logs — verify previous discounts & compare shopkeeper wholesale quotes
          </p>
        </div>

        {/* Export and action row */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportHistoryCSV}
            disabled={historyRows.length === 0}
            className="bg-green-700 hover:bg-green-800 text-white font-black uppercase rounded-xs px-3 py-2 text-[11px] tracking-wider flex items-center cursor-pointer transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 mr-1" /> Export History XLS
          </button>
        </div>
      </div>

      {/* SEGMENT TOGGLES */}
      <div className="flex border-b border-[#E2DFDF] bg-slate-50 p-1 rounded-sm gap-2">
        <button
          onClick={() => { setActiveMode('customer'); setSearchQuery(''); }}
          className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-sm flex items-center justify-center space-x-2 transition ${
            activeMode === 'customer' 
              ? 'bg-white text-slate-800 shadow-sm border border-slate-200' 
              : 'text-gray-500 hover:text-slate-800'
          }`}
          id="btn-customer-price-history"
        >
          <ShoppingBag className="w-4 h-4 text-[#0EA5E9]" />
          <span>Customer Price History Audit</span>
        </button>

        <button
          onClick={() => { setActiveMode('shopkeeper'); setSearchQuery(''); }}
          className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-sm flex items-center justify-center space-x-2 transition ${
            activeMode === 'shopkeeper' 
              ? 'bg-white text-slate-800 shadow-sm border border-slate-200' 
              : 'text-gray-500 hover:text-slate-800'
          }`}
          id="btn-shopkeeper-price-history"
        >
          <UserCheck className="w-4 h-4 text-[#0EA5E9]" />
          <span>Shopkeeper Wholesale Price History</span>
        </button>
      </div>

      {/* FILTER CHEST ROW */}
      <div className="bg-white p-3.5 border border-[#E2DFDF] grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Instant Search Bar */}
        <div className="md:col-span-6 relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-3.5 h-3.5 text-gray-400" />
          </span>
          <input
            type="text"
            placeholder={
              activeMode === 'customer' 
                ? "Search by Customer Name or Product Part Number..." 
                : "Search by Shopkeeper Wholesale Name or Product Part Number..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-250 rounded p-2.5 pl-9 font-bold placeholder-gray-405 focus:bg-white text-slate-800"
          />
        </div>

        {/* Chronological filters */}
        <div className="md:col-span-3 flex items-center space-x-1.5 justify-end">
          <span className="text-[10px] text-gray-400 font-extrabold uppercase">Date range:</span>
          <select
            value={dateFilter}
            onChange={(e) => handleDateFilterChange(e.target.value as DateFilterType)}
            className="text-xs border rounded p-2 font-bold text-slate-705 bg-white cursor-pointer"
          >
            <option value="week">Past Week</option>
            <option value="month">Past Month</option>
            <option value="year">Past Year</option>
            <option value="custom">-- Custom from/to --</option>
          </select>
        </div>

        {/* Custom manual dates */}
        {dateFilter === 'custom' && (
          <div className="md:col-span-3 flex items-center space-x-1 justify-end text-xs font-mono">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border p-1.5 rounded bg-slate-50"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border p-1.5 rounded bg-slate-50"
            />
          </div>
        )}
      </div>

      {/* DESCRIPTION ADVISORY BOX OF METHODOLOGY */}
      <div className="bg-[#FFFCEB] border border-[#FBE39A] p-3 text-amber-900 rounded-sm flex items-start space-x-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
        <div className="text-[11px] leading-relaxed">
          <p className="font-bold uppercase tracking-tight text-amber-850">
            {activeMode === 'customer' 
              ? 'Complete negotiation trail details (Standard Retail & Partial Deals)' 
              : 'Exclusive Shopkeeper / Wholesale Trader pricing analysis'
            }
          </p>
          <p className="font-medium text-amber-800 mt-0.5">
            Compare transaction pricing directly against default Catalog retail list price. Rows where 
            the actual price booked is **strictly below default** are highlighted <span className="bg-amber-100 text-amber-850 px-1 py-0.2 rounded font-black font-mono">amber</span>, 
            empowering you to track negotiation margins, map seller leakage, and preserve healthy product profitability.
          </p>
        </div>
      </div>

      {/* TABLE AUDIT LISTING */}
      <div className="bg-white border border-[#E2DFDF] overflow-x-auto">
        <table className="w-full text-left text-xs font-medium">
          <thead>
            <tr className="bg-slate-100 border-b uppercase text-[9px] text-gray-500 font-extrabold select-none select-none">
              <th className="p-3">Transaction Date</th>
              <th className="p-3">Reference Invoice</th>
              <th className="p-3">Customer / Shop Name</th>
              <th className="p-3">Engine/Filter Part</th>
              <th className="p-3">Brand</th>
              <th className="p-3 text-center">Qty Booked</th>
              <th className="p-3 text-right">Price Charged</th>
              <th className="p-3 text-right">Default Catalog Retail</th>
              <th className="p-3 text-right">Profit variance Delta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150 font-medium">
            {historyRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-12 text-center text-gray-400">
                  No previous negotiation history matches selected parameters. Use the filters to query name files.
                </td>
              </tr>
            ) : (
              historyRows.map((row, idx) => {
                const isUnderBooked = row.priceCharged < row.defaultPrice;
                return (
                  <tr 
                    key={idx} 
                    className={`hover:bg-slate-50 transition-colors ${
                      isUnderBooked ? 'bg-[#FFFDF4]' : ''
                    }`}
                  >
                    <td className="p-3 font-mono font-extrabold text-gray-600">{row.date}</td>
                    <td className="p-3 font-mono font-black text-[#0EA5E9]">{row.invoiceNumber}</td>
                    <td className="p-3 font-bold text-slate-800 flex items-center space-x-1">
                      <span>{row.customerName}</span>
                      {row.partyObj?.customer_type === 'shopkeeper' && (
                        <span className="text-[8px] bg-indigo-50 border border-indigo-150 text-indigo-700 px-1 rounded font-black">WS</span>
                      )}
                    </td>
                    <td className="p-3 font-mono font-black text-slate-700">{row.partNumber}</td>
                    <td className="p-3 font-bold text-gray-500 uppercase text-[10px]">{row.brand}</td>
                    <td className="p-3 text-center font-bold font-mono">{row.qty}</td>
                    <td className="p-3 text-right font-mono font-extrabold text-slate-800">
                      Rs. {row.priceCharged.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-mono text-gray-400">
                      Rs. {row.defaultPrice.toLocaleString()}
                    </td>
                    <td className="p-3 text-right">
                      {row.variance === 0 ? (
                        <span className="text-[10px] font-mono text-gray-400 uppercase font-black">standard list price</span>
                      ) : row.variance > 0 ? (
                        <span className="text-xs font-mono text-emerald-600 font-extrabold">
                          +Rs. {row.variance.toLocaleString()} (upbooked)
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-amber-600 font-black">
                          -Rs. {Math.abs(row.variance).toLocaleString()} (underbooked)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
