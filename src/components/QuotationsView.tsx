import React, { useState, useEffect, useRef } from 'react';
import { db, normalizeCode } from '../data';
import { Product, CrossReference, Invoice, InvoiceItem, Party, Quotation, QuoteStatus } from '../types';
import { generateQuotationPDF } from '../utils/pdfGenerator';
import { 
  Search, 
  Plus, 
  Check, 
  Trash2, 
  ArrowLeft,
  ArrowRight,
  FileText,
  X,
  ChevronRight,
  RefreshCw,
  User,
  Share2,
  Clock,
  AlertTriangle,
  FileCheck,
  Ban,
  Archive,
  ShoppingCart,
  Download
} from 'lucide-react';

interface QuotationsViewProps {
  userRole: 'Owner' | 'Staff';
  onQuoteProcessed: () => void;
}

export default function QuotationsView({ userRole, onQuoteProcessed }: QuotationsViewProps) {
  // Navigation & View State
  // 'list' -> Show quotes list, stats and tabs
  // 'new' -> Create quotation screen
  // 'detail' -> Detail card + Conversion dialog + Timeline
  // 'success' -> Success screen of newly created quotation
  const [viewState, setViewState] = useState<'list' | 'new' | 'detail' | 'success'>('list');
  const [lastCreatedQuote, setLastCreatedQuote] = useState<Quotation | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null);

  // Raw Database States
  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [crossRefs, setCrossRefs] = useState<CrossReference[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // List search & tab selection
  type TabType = 'all' | 'active' | 'accepted' | 'expired_rejected';
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // New Quotation States (Step 5.3)
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  // Walk-In Manual input toggle
  const [showWalkInForm, setShowWalkInForm] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');

  // Cart
  const [cart, setCart] = useState<InvoiceItem[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Validity period & optional notes
  const [validityDays, setValidityDays] = useState<number>(7);
  const [customerNotes, setCustomerNotes] = useState('');

  // Conversion Workflow state
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [convertSelections, setConvertSelections] = useState<Record<string, boolean>>({});

  // UI Focus control
  const productSearchRef = useRef<HTMLInputElement>(null);

  // Reload local states
  const reloadData = () => {
    setParties(db.getParties());
    setProducts(db.getProducts());
    setCrossRefs(db.getCrossRefs());
    setQuotations(db.getQuotations());
    setInvoices(db.getInvoices());
  };

  useEffect(() => {
    reloadData();
  }, []);

  const handleRefresh = () => {
    reloadData();
    db.logPendingSync("Quotations view refreshed");
  };

  // Helper: check if validity passed
  const isExpired = (q: Quotation) => {
    if (q.status === 'converted' || q.status === 'accepted') return false;
    const expiryDate = new Date(q.expiry_date);
    return expiryDate.getTime() < Date.now();
  };

  // Status mapping
  const getQuoteStatus = (q: Quotation): QuoteStatus => {
    if (q.status === 'converted') return 'converted';
    if (q.status === 'accepted') return 'accepted';
    if (q.status === 'rejected') return 'rejected';
    if (isExpired(q)) return 'expired';
    return q.status;
  };

  // Helper for computing days left
  const getDaysLeft = (q: Quotation) => {
    const expiry = new Date(q.expiry_date);
    const diff = expiry.getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Filtered lists
  const getFilteredQuotations = () => {
    let list = [...quotations].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Filter by searchQuery
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item => 
        item.quote_number.toLowerCase().includes(q) ||
        item.customer_name.toLowerCase().includes(q)
      );
    }

    // Filter by tab
    if (activeTab === 'active') {
      list = list.filter(q => {
        const status = getQuoteStatus(q);
        return status === 'draft' || status === 'sent';
      });
    } else if (activeTab === 'accepted') {
      list = list.filter(q => {
        const status = getQuoteStatus(q);
        return status === 'accepted' || status === 'converted';
      });
    } else if (activeTab === 'expired_rejected') {
      list = list.filter(q => {
        const status = getQuoteStatus(q);
        return status === 'expired' || status === 'rejected';
      });
    }

    return list;
  };

  const displayedQuotes = getFilteredQuotations();

  // Metrics calculations
  const totalSentPending = quotations.filter(q => getQuoteStatus(q) === 'sent').length;
  const totalAccepted = quotations.filter(q => getQuoteStatus(q) === 'accepted').length;
  const valueReadyToConvert = quotations
    .filter(q => getQuoteStatus(q) === 'accepted')
    .reduce((acc, q) => acc + q.total_amount, 0);

  // Cart operations (identical to POS screen helper methods to preserve brand expectations)
  const handleAddProductToCart = (p: Product) => {
    // Check if product already exists
    const idx = cart.findIndex(it => it.product_id === p.id);
    if (idx >= 0) {
      const updated = [...cart];
      updated[idx].qty += 1;
      updated[idx].line_total = updated[idx].qty * updated[idx].sale_price;
      setCart(updated);
    } else {
      const lineItem: InvoiceItem = {
        id: "line-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
        product_id: p.id,
        part_number: p.part_number,
        brand: p.brand,
        sale_price: p.sale_price,
        qty: 1,
        line_total: p.sale_price
      };
      setCart([...cart, lineItem]);
    }
    setProductSearchQuery('');
    setShowProductDropdown(false);
    if (productSearchRef.current) {
      productSearchRef.current.focus();
    }
  };

  const handleUpdateCartQty = (lineId: string, val: number) => {
    const updated = cart.map(it => {
      if (it.id === lineId) {
        const cleanQty = Math.max(1, val);
        return {
          ...it,
          qty: cleanQty,
          line_total: cleanQty * it.sale_price
        };
      }
      return it;
    });
    setCart(updated);
  };

  const handleUpdateCartPrice = (lineId: string, price: number) => {
    const updated = cart.map(it => {
      if (it.id === lineId) {
        const cleanPrice = Math.max(0, price);
        return {
          ...it,
          sale_price: cleanPrice,
          line_total: it.qty * cleanPrice
        };
      }
      return it;
    });
    setCart(updated);
  };

  const handleUpdateCartPartNumber = (lineId: string, partNumber: string) => {
    const updated = cart.map(it => {
      if (it.id === lineId) {
        return {
          ...it,
          part_number: partNumber
        };
      }
      return it;
    });
    setCart(updated);
  };

  const handleRemoveFromCart = (lineId: string) => {
    setCart(cart.filter(it => it.id !== lineId));
  };

  const cartSubtotal = cart.reduce((acc, item) => acc + item.line_total, 0);

  // Handlers for customer select
  const handleSelectParty = (pty: Party) => {
    setSelectedPartyId(pty.id);
    setCustomerSearchQuery('');
    setShowCustomerDropdown(false);
    setShowWalkInForm(false);
  };

  const handleSelectWalkIn = () => {
    setSelectedPartyId('walk-in');
    setCustomerSearchQuery('');
    setShowCustomerDropdown(false);
    setShowWalkInForm(true);
  };

  // Save Quotation (as Draft or Mark Sent)
  const handleSaveQuotation = (targetStatus: 'draft' | 'sent') => {
    if (cart.length === 0) {
      alert("Please add at least one line item to generate a quote.");
      return;
    }

    let customerName = 'Walk-In Customer';
    if (selectedPartyId === 'walk-in') {
      customerName = walkInName.trim() ? `${walkInName.trim()} (Walk-In)` : 'Cash Walk-In';
    } else if (selectedPartyId) {
      const match = parties.find(p => p.id === selectedPartyId);
      if (match) customerName = match.name;
    } else {
      alert("Please select or input a targeted customer.");
      return;
    }

    setIsSaving(true);

    setTimeout(() => {
      try {
        const rawQuotes = db.getQuotations();
        const quoteNum = `QT-${new Date().getFullYear()}-${String(rawQuotes.length + 1).padStart(4, '0')}`;
        const quoteId = "qt-" + Date.now();
        
        // Expiry calculation
        const createdAt = new Date().toISOString();
        const expiryDate = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString();

        const matchParty = parties.find(p => p.id === selectedPartyId);

        const newQuote: Quotation = {
          id: quoteId,
          quote_number: quoteNum,
          customer_name: customerName,
          party_id: selectedPartyId === 'walk-in' ? null : selectedPartyId,
          customer_type: matchParty?.customer_type === 'shopkeeper' ? 'shopkeeper' : 'retail',
          items: cart,
          total_amount: cartSubtotal,
          validity_days: validityDays,
          expiry_date: expiryDate,
          notes: customerNotes.trim(),
          status: targetStatus,
          timestamp: createdAt,
          user: userRole,
          is_active: true
        };

        db.saveQuotation(newQuote);
        db.logPendingSync(`Created quotation ${quoteNum} for ${customerName}`);

        setLastCreatedQuote(newQuote);
        setViewState('success');
        
        // Reset state
        setCart([]);
        setSelectedPartyId(null);
        setWalkInName('');
        setWalkInPhone('');
        setCustomerNotes('');
        setValidityDays(7);
        
        reloadData();
        onQuoteProcessed();
      } catch (e: any) {
        alert("Verification check fails: " + e.message);
      } finally {
        setIsSaving(false);
      }
    }, 400);
  };

  // Mark Status accepted or rejected
  const handleUpdateStatus = (quote: Quotation, newStatus: QuoteStatus) => {
    const updated = {
      ...quote,
      status: newStatus
    };
    db.saveQuotation(updated);
    db.logPendingSync(`Quotation ${quote.quote_number} updated to ${newStatus}`);
    setSelectedQuote(updated);
    reloadData();
    onQuoteProcessed();
  };

  // Prepare conversion selections
  const triggerConvertWorkflow = (quote: Quotation) => {
    setSelectedQuote(quote);
    const initialSels: Record<string, boolean> = {};
    quote.items.forEach(itm => {
      initialSels[itm.id] = true; // precheck all
    });
    setConvertSelections(initialSels);
    setShowConvertDialog(true);
  };

  const handleToggleConvertSelection = (itemId: string) => {
    setConvertSelections(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // Convert to real Invoice Flow
  const handleConfirmInvoiceConversion = () => {
    if (!selectedQuote) return;

    const checkedItems = selectedQuote.items.filter(itm => convertSelections[itm.id]);
    if (checkedItems.length === 0) {
      alert("Please select at least one item to convert to an invoice.");
      return;
    }

    setIsSaving(true);

    setTimeout(() => {
      try {
        const rawInvoices = db.getInvoices();
        const invoiceNum = `KFH-${new Date().getFullYear()}-${String(rawInvoices.length + 1).padStart(4, '0')}`;
        const invoiceId = "inv-" + Date.now();

        const subtotal = checkedItems.reduce((acc, itm) => acc + itm.line_total, 0);

        // Save real Invoice Record
        const linkedInvoice: Invoice = {
          id: invoiceId,
          invoice_number: invoiceNum,
          party_id: selectedQuote.party_id,
          customer_name: selectedQuote.customer_name,
          items: checkedItems,
          total_amount: subtotal,
          discount: 0,
          net_amount: subtotal,
          received_amount: selectedQuote.customer_type === 'shopkeeper' ? 0 : subtotal, // default credit or cash
          status: 'confirmed',
          user: userRole,
          timestamp: new Date().toISOString(),
          is_active: true,
          payment_method: selectedQuote.customer_type === 'shopkeeper' ? 'credit' : 'cash',
          payment_status: selectedQuote.customer_type === 'shopkeeper' ? 'unpaid' : 'paid'
        };

        db.saveInvoice(linkedInvoice);

        // Deduct products count in stock inventory + audit movements
        const allProductsList = db.getAllProductsWithDeleted();
        checkedItems.forEach(cartLine => {
          const pIdx = allProductsList.findIndex(p => p.id === cartLine.product_id);
          if (pIdx >= 0) {
            allProductsList[pIdx].stock_qty = Math.max(0, allProductsList[pIdx].stock_qty - cartLine.qty);
            db.saveMovement({
              product_id: cartLine.product_id,
              qty_change: -cartLine.qty,
              from_status: 'sellable',
              to_status: 'none',
              type: 'sold',
              user: userRole,
              reason: `Decentralized dispatch via Quotation Convert ${selectedQuote.quote_number}`
            });
          }
        });
        db.saveProducts(allProductsList);

        // Update Party balances if not retail checkout
        if (selectedQuote.party_id && selectedQuote.customer_type === 'shopkeeper') {
          const partiesList = db.getParties();
          const pIdx = partiesList.findIndex(p => p.id === selectedQuote.party_id);
          if (pIdx >= 0) {
            partiesList[pIdx].credit_balance += subtotal;
            db.saveParties(partiesList);
          }
        }

        // Adjust remaining quotation lines
        const remainingItems = selectedQuote.items.filter(itm => !convertSelections[itm.id]);
        
        let targetQuoteStatus: QuoteStatus = 'converted';
        if (remainingItems.length > 0) {
          // Some items remain unconverted! It stays accepted
          targetQuoteStatus = 'accepted'; 
        }

        const updatedQuote: Quotation = {
          ...selectedQuote,
          items: remainingItems.length > 0 ? remainingItems : selectedQuote.items,
          total_amount: remainingItems.length > 0 
            ? remainingItems.reduce((acc, i) => acc + i.line_total, 0)
            : selectedQuote.total_amount,
          status: targetQuoteStatus,
          invoice_id: invoiceId,
          invoice_number: invoiceNum
        };

        db.saveQuotation(updatedQuote);
        db.logPendingSync(`Converted quotation ${selectedQuote.quote_number} items into Invoice ${invoiceNum}`);

        alert(`Quotation successfully converted to Invoice ${invoiceNum}! Stock updated.`);
        
        setShowConvertDialog(false);
        setViewState('list');
        setSelectedQuote(null);
        reloadData();
        onQuoteProcessed();
      } catch (e: any) {
        alert("Conversion error check: " + e.message);
      } finally {
        setIsSaving(false);
      }
    }, 450);
  };

  // WhatsApp share generation
  const handleWhatsAppShare = (quote: Quotation) => {
    const stored = localStorage.getItem('kfh_shop_info');
    const parsed = stored ? JSON.parse(stored) : null;
    const sName = (parsed?.name || 'King Filter House FSD').trim();

    const listLines = quote.items.map(i => `${i.part_number} (${i.brand}) x ${i.qty} = Rs. ${i.line_total.toLocaleString()}`).join('%0A');
    const introText = `*${sName.toUpperCase()} - QUOTATION %23${quote.quote_number}*%0A%0A`;
    const customer = `Customer: ${quote.customer_name}%0A`;
    const validityStr = `Validity: Valid until ${new Date(quote.expiry_date).toLocaleDateString()}%0A%0A`;
    const goods = `*Line Items:*%0A${listLines}%0A%0A`;
    const summary = `*Grand Total: Rs. ${quote.total_amount.toLocaleString()}*%0A`;
    const footer = `%0A_Note: ${quote.notes || 'Original items subject to prior supply.'}_%0A`;
    
    const fulUrl = `https://api.whatsapp.com/send?text=${introText}${customer}${validityStr}${goods}${summary}${footer}`;
    window.open(fulUrl, '_blank');
  };

  return (
    <div className="space-y-4" id="quotations-root-segment">

      {/* ========================================================
          VIEW 1: QUOTATIONS LIST STAGE
          ======================================================== */}
      {viewState === 'list' && (
        <div className="space-y-4 animate-fadeIn" id="quotations-list-canvas">
          
          {/* Topbar */}
          <div className="bg-white border p-4 flex justify-between items-center bg-slate-50/50 rounded-lg shadow-sm" id="quotes-topbar-pnl">
            <div>
              <span className="text-[10px] uppercase font-bold bg-[#0EA5E9] text-white px-2 py-0.5 rounded">
                B2B & B2C Proposals
              </span>
              <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight mt-1">Estimates & Quotations</h1>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={handleRefresh}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded"
                title="Reload Data"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setViewState('new');
                  setCart([]);
                  setSelectedPartyId(null);
                  setWalkInName('');
                  setWalkInPhone('');
                }}
                className="px-6 py-2.5 bg-[#E11A22] text-white font-extrabold text-xs uppercase tracking-wider rounded shadow hover:bg-sky-600 transition"
                id="btn-goto-new-quote"
              >
                + New Quotation
              </button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="quotes-stats-grid">
            
            <div className="bg-white p-4 border border-l-4 border-l-blue-500 rounded-lg shadow-sm flex justify-between items-center">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Sent / Pending Review</p>
                <h3 className="text-xl font-black text-blue-700 mt-1 font-mono">
                  {totalSentPending} Quotes
                </h3>
              </div>
              <div className="p-1 px-2 bg-blue-50 text-blue-600 rounded text-[9px] font-mono">Awaiting</div>
            </div>

            <div className="bg-white p-4 border border-l-4 border-l-green-600 rounded-lg shadow-sm flex justify-between items-center">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Accepted Proposals</p>
                <h3 className="text-xl font-black text-green-700 mt-1 font-mono">
                  {totalAccepted} Approved
                </h3>
              </div>
              <div className="p-1 px-2 bg-green-50 text-green-600 rounded text-[9px] font-mono">Ledger Ready</div>
            </div>

            <div className="bg-white p-4 border border-l-4 border-l-amber-500 rounded-lg shadow-sm flex justify-between items-center">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Value Ready to Convert</p>
                <h3 className="text-xl font-black text-amber-600 mt-1 font-mono">
                  Rs. {valueReadyToConvert.toLocaleString()}
                </h3>
              </div>
              <div className="p-1 px-2 bg-amber-50 text-amber-600 rounded text-[9px] font-mono">Open revenue</div>
            </div>

          </div>

          {/* Filter, search and tabs bar */}
          <div className="bg-white p-3 border rounded-lg shadow-sm space-y-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search quotes by reference sequence or client spec..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-xs p-2.5 pl-8 border rounded font-extrabold uppercase focus:border-sky-550 focus:outline-none"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-3.5" />
            </div>

            {/* Tab selector */}
            <div className="flex border-b border-[#E2DFDF] bg-slate-50/80 space-x-2 text-[9.5px] font-bold uppercase tracking-wider overflow-x-auto rounded-t scrollbar-none" id="quotes-tabs">
              {([
                { key: 'all', title: 'All Quotations', icon: FileText, iconColor: 'text-slate-500' },
                { key: 'active', title: 'Active (Draft + Sent)', icon: Clock, iconColor: 'text-amber-500 animate-pulse' },
                { key: 'accepted', title: 'Accepted', icon: FileCheck, iconColor: 'text-emerald-500' },
                { key: 'expired_rejected', title: 'Expired / Rejected', icon: Ban, iconColor: 'text-rose-500' }
              ] as const).map(tab => {
                const isSelected = activeTab === tab.key;
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 border-b-2 whitespace-nowrap transition-all -mb-[1px] outline-none flex items-center space-x-2 shrink-0 ${
                      isSelected 
                        ? 'border-[#0EA5E9] text-[#0EA5E9] bg-white border-x border-x-gray-250 font-black shadow-xs' 
                        : 'border-transparent text-gray-400 hover:text-slate-800 hover:bg-slate-100/60'
                    }`}
                  >
                    <IconComponent className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#0EA5E9]' : tab.iconColor}`} />
                    <span>{tab.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cards Grid / Display */}
          {displayedQuotes.length === 0 ? (
            <div className="p-16 bg-white border rounded-lg shadow-sm text-center flex flex-col items-center justify-center space-y-2 text-slate-400">
              <FileCheck className="w-12 h-12 opacity-30 text-indigo-600" />
              <p className="font-mono text-xs">No estimations matching criteria. Press "+ New Quotation" to setup a sheet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="quotes-cards-grid">
              {displayedQuotes.map(q => {
                const status = getQuoteStatus(q);
                const daysLeft = getDaysLeft(q);

                let statusColor = "bg-slate-100 text-slate-700";
                if (status === 'draft') statusColor = "bg-slate-100 text-slate-700 border border-slate-200";
                if (status === 'sent') statusColor = "bg-blue-50 text-blue-700 border border-blue-200";
                if (status === 'accepted') statusColor = "bg-emerald-50 text-emerald-800 border border-emerald-200";
                if (status === 'rejected') statusColor = "bg-sky-50 text-sky-700 border border-sky-200";
                if (status === 'expired') statusColor = "bg-amber-50 text-amber-700 border border-amber-200";
                if (status === 'converted') statusColor = "bg-purple-50 text-purple-700 border border-purple-200";

                return (
                  <div 
                    key={q.id}
                    onClick={() => {
                      setSelectedQuote(q);
                      setViewState('detail');
                    }}
                    className="bg-white border hover:border-red-650 hover:shadow-md rounded-lg p-5 cursor-pointer flex flex-col justify-between space-y-4 transition"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="font-mono text-[#0ea5e9] font-bold block bg-sky-50/50 px-2.5 py-1 text-xs rounded uppercase tracking-wider">
                          {q.quote_number}
                        </span>
                        <span className={`px-2.5 py-1 rounded text-[9px] uppercase font-black ${statusColor}`}>
                          {status}
                        </span>
                      </div>

                      <div className="mt-3">
                        <h4 className="font-black text-slate-850 text-sm truncate">{q.customer_name}</h4>
                        <span className="text-[9.5px] uppercase font-bold text-indigo-600 tracking-wide mt-0.5 block">
                          Client tier: {q.customer_type === 'shopkeeper' ? '🏠 Shopkeeper Ledger' : '👤 Retail Buyer'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 pt-3 border-t">
                      <div className="flex justify-between text-[10px] text-gray-400 font-medium">
                        <span>Created: {new Date(q.timestamp).toLocaleDateString()}</span>
                        <span>{q.items.length} units type</span>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <div>
                          <p className="text-[10px] uppercase font-extrabold text-slate-400">Total Valuation</p>
                          <span className="font-mono font-black text-slate-900 text-sm">
                            Rs. {q.total_amount.toLocaleString()}
                          </span>
                        </div>

                        {/* Validity marker */}
                        {status !== 'converted' && status !== 'rejected' && (
                          <div className="text-right">
                            {daysLeft <= 0 ? (
                              <span className="text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 p-1 px-2 rounded border border-rose-200">
                                Expired validity
                              </span>
                            ) : daysLeft <= 2 ? (
                              <span className="text-[9px] font-black uppercase tracking-wider bg-sky-100 text-sky-700 p-1 px-2 rounded animate-pulse">
                                ⚠️ Expiry: {daysLeft}d left
                              </span>
                            ) : daysLeft <= 5 ? (
                              <span className="text-[9px] font-black uppercase tracking-wider bg-[#FFF9E6] text-amber-700 p-1 px-2 rounded">
                                ⏳ Expiry: {daysLeft}d left
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold bg-slate-50 text-slate-500 p-1 px-2 rounded">
                                Valid {daysLeft} days
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ========================================================
          VIEW 2: QUOTE DETAIL PANEL & FLOWS
          ======================================================== */}
      {viewState === 'detail' && selectedQuote && (
        <div className="bg-white border rounded-lg shadow-sm p-6 space-y-6 animate-fadeIn" id="quote-detail-stage">
          
          {/* Header controls */}
          <div className="flex justify-between items-start pb-4 border-b">
            <div>
              <button
                onClick={() => setViewState('list')}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Quotations List</span>
              </button>

              <div className="flex items-center space-x-2 mt-2">
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight font-mono">
                  {selectedQuote.quote_number}
                </h2>
                <span className={`px-2.5 py-1 text-[9px] uppercase font-black rounded ${
                  getQuoteStatus(selectedQuote) === 'accepted' 
                    ? 'bg-emerald-50 text-emerald-800 border' 
                    : getQuoteStatus(selectedQuote) === 'converted' 
                      ? 'bg-purple-50 text-purple-700 border'
                      : 'bg-slate-100 text-slate-600'
                }`}>
                  {getQuoteStatus(selectedQuote)}
                </span>
              </div>
              <p className="text-xs font-bold text-gray-500 mt-1">
                Prepared by {selectedQuote.user} on {new Date(selectedQuote.timestamp).toLocaleString()}
              </p>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => generateQuotationPDF(selectedQuote)}
                className="px-4 py-2 bg-slate-800 text-white font-extrabold text-[10.5px] uppercase tracking-wider rounded shadow hover:bg-[#111C30] transition flex items-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>

              <button
                onClick={() => handleWhatsAppShare(selectedQuote)}
                className="px-4 py-2 bg-[#25D366] text-white font-extrabold text-[10.5px] uppercase tracking-wider rounded shadow hover:bg-emerald-600 transition flex items-center space-x-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>WhatsApp PDF Share</span>
              </button>
            </div>
          </div>

          {/* Action Bar changes by status */}
          <div className="p-4 bg-slate-50 border rounded-lg flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-sans">
            <div>
              <p className="font-extrabold text-slate-700 uppercase text-[10.5px] tracking-wide">
                Estimate Action Registry Flow
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Current status allows processing transitions indicated instantly.
              </p>
            </div>

            <div className="flex space-x-2 w-full md:w-auto justify-end">
              {getQuoteStatus(selectedQuote) === 'sent' && (
                <>
                  <button
                    onClick={() => handleUpdateStatus(selectedQuote, 'accepted')}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold uppercase text-[10px] tracking-wider rounded"
                  >
                    ✓ Mark Accepted
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedQuote, 'rejected')}
                    className="px-5 py-2 bg-red-655 hover:bg-sky-600 text-white font-extrabold uppercase text-[10px] tracking-wider rounded"
                  >
                    ✗ Mark Rejected
                  </button>
                </>
              )}

              {getQuoteStatus(selectedQuote) === 'draft' && (
                <button
                  onClick={() => handleUpdateStatus(selectedQuote, 'sent')}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold uppercase text-[10px] tracking-wider rounded"
                >
                  📤 Mark as Proposal Sent
                </button>
              )}

              {getQuoteStatus(selectedQuote) === 'accepted' && (
                <button
                  onClick={() => triggerConvertWorkflow(selectedQuote)}
                  className="px-6 py-2.5 bg-[#0EA5E9] hover:bg-sky-600 text-white font-black uppercase text-xs tracking-wider rounded shadow-md animate-bounce"
                >
                  Convert to Invoice →
                </button>
              )}

              {getQuoteStatus(selectedQuote) === 'converted' && (
                <div className="p-2 px-3 bg-purple-50 text-purple-800 font-mono font-bold border border-purple-200 rounded">
                  Linked Sales Invoicing Record: {selectedQuote.invoice_number || 'processed'}
                </div>
              )}
            </div>
          </div>

          {/* 4 Steps Timeline visual indicator */}
          <div className="bg-white p-4 border rounded-lg text-xs" id="quote-duration-timeline">
            <h4 className="text-[10px] uppercase font-black tracking-wider text-slate-500 mb-4 text-center">
              Proposal Validation & Fulfillment Lifecycle Timeline
            </h4>

            <div className="flex flex-col md:flex-row justify-between items-center max-w-2xl mx-auto gap-4 md:gap-0">
              {[
                { label: 'Created', done: true },
                { label: 'Sent Option', done: getQuoteStatus(selectedQuote) !== 'draft' },
                { label: 'Customer Approved', done: getQuoteStatus(selectedQuote) === 'accepted' || getQuoteStatus(selectedQuote) === 'converted' },
                { label: 'Convert Fulfilled', done: getQuoteStatus(selectedQuote) === 'converted' }
              ].map((step, idx) => (
                <React.Fragment key={idx}>
                  <div className="flex flex-col items-center space-y-1">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      step.done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {step.done ? '✓' : idx + 1}
                    </span>
                    <span className="font-extrabold py-0.5 text-[10px] uppercase text-slate-700">{step.label}</span>
                  </div>
                  {idx < 3 && (
                    <div className={`hidden md:block h-0.5 flex-1 mx-2 ${
                      step.done ? 'bg-emerald-400' : 'bg-slate-200'
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Items Table (Read Only) */}
          <div className="space-y-3" id="read-only-items">
            <h3 className="text-xs uppercase font-extrabold text-slate-700">Estimate Item Specifications Sheet</h3>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left divide-y">
                <thead className="bg-slate-100 uppercase tracking-tight text-[9px] text-slate-500 font-extrabold">
                  <tr>
                    <th className="p-3">Part Number specification</th>
                    <th className="p-3 text-right">Requested Qty</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-right">Subtotal amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white text-gray-800">
                  {selectedQuote.items.map((line, index) => (
                    <tr key={line.id || index} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-gray-950 text-[13px]">{line.part_number}</td>
                      <td className="p-3 text-right font-mono font-bold">{line.qty} pcs</td>
                      <td className="p-3 text-right font-mono">Rs. {line.sale_price.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono font-semibold">Rs. {line.line_total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="bg-slate-50 p-4 border-t flex justify-between items-center">
                <div className="max-w-md">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Customer Instructions & Notes</span>
                  <p className="text-[11px] text-slate-700 font-medium italic mt-0.5">
                    {selectedQuote.notes || "No special instructions captured during quotation drafting."}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-gray-400">Total Estimate Value</p>
                  <p className="text-lg font-mono font-black text-slate-900">
                    Rs. {selectedQuote.total_amount.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================
          VIEW 3: NEW QUOTATION DRAFT SCREEN
          ======================================================== */}
      {viewState === 'new' && (
        <div className="bg-white border rounded-lg shadow-sm p-6 space-y-6 animate-fadeIn" id="new-quote-terminal">
          
          <div className="flex justify-between items-center pb-4 border-b">
            <div>
              <button
                onClick={() => setViewState('list')}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Cancel & Back</span>
              </button>
              <h1 className="text-lg font-black uppercase text-slate-900 tracking-tight mt-1">
                Draft Quotation Estimate Sheet
              </h1>
            </div>

            <div className="flex items-center space-x-2 font-mono text-[10px]">
              <span className="px-3 py-1.5 bg-slate-100 font-bold border rounded">
                Drafting Module
              </span>
            </div>
          </div>

          {/* CUSTOMER SELECT PANEL (Same logic as InvoiceView) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            {/* Customer specs box */}
            <div className="md:col-span-8 space-y-4">
              
              <div className="bg-slate-50 border p-4 rounded-lg space-y-3">
                <label className="block text-slate-700 font-extrabold text-xs uppercase">
                  1. Customer / Wholesale Party Selection
                </label>

                {selectedPartyId ? (
                  <div className="bg-white border p-3 rounded flex justify-between items-center text-xs">
                    <div>
                      {selectedPartyId === 'walk-in' ? (
                        <div>
                          <p className="font-extrabold text-gray-900 bg-sky-50 text-[#0EA5E9] inline-block px-1.5 rounded uppercase text-[9.5px]">
                            Cash Walk-In Retail
                          </p>
                          <p className="font-bold text-gray-800 mt-1">Name: {walkInName || 'Unspecified Name'}</p>
                          {walkInPhone && <p className="text-gray-400">Phone: {walkInPhone}</p>}
                        </div>
                      ) : (
                        (() => {
                          const matching = parties.find(p => p.id === selectedPartyId);
                          return (
                            <div>
                              <p className="font-bold text-slate-900">{matching?.name}</p>
                              <p className="text-gray-400 font-mono text-[10.5px]">Contact: {matching?.mobile}</p>
                              <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 font-bold rounded mt-1 inline-block uppercase">
                                Trade Tier: {matching?.customer_type === 'shopkeeper' ? 'Shopkeeper Ledger' : 'Standard'}
                              </span>
                            </div>
                          );
                        })()
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setSelectedPartyId(null);
                        setWalkInName('');
                        setWalkInPhone('');
                      }}
                      className="text-slate-400 hover:text-red-655 p-1 hover:bg-slate-100 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type Wholesale party name or filter..."
                      value={customerSearchQuery}
                      onChange={e => {
                        setCustomerSearchQuery(e.target.value);
                        setShowCustomerDropdown(true);
                      }}
                      className="w-full text-xs p-3 pl-8 border rounded font-extrabold uppercase focus:border-sky-500 focus:outline-none"
                    />
                    <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-4" />

                    {showCustomerDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded shadow-xl max-h-56 overflow-y-auto divide-y z-30 font-sans text-xs">
                        {parties
                          .filter(p => p.name.toLowerCase().includes(customerSearchQuery.toLowerCase()))
                          .map(p => (
                            <div
                              key={p.id}
                              onClick={() => handleSelectParty(p)}
                              className="p-2.5 hover:bg-slate-50 cursor-pointer flex justify-between items-center"
                            >
                              <div>
                                <strong className="text-slate-900 uppercase">{p.name}</strong>
                                <span className="text-gray-400 block font-mono text-[9px]">{p.mobile}</span>
                              </div>
                              <span className="text-[8.5px] uppercase bg-green-50 text-green-800 border font-bold px-1 rounded">
                                {p.customer_type === 'shopkeeper' ? 'Shopkeeper' : 'Regular'}
                              </span>
                            </div>
                          ))
                        }
                        <div
                          onClick={handleSelectWalkIn}
                          className="p-3 text-center text-[#0ea5e9] bg-sky-50/50 hover:bg-sky-50 cursor-pointer font-bold uppercase text-[10px]"
                        >
                          + Set Walk-In Cash Client (Manual Name)
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {showWalkInForm && selectedPartyId === 'walk-in' && (
                  <div className="bg-white p-3 border rounded space-y-2 text-xs">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Manual Walk-In Information</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Client name statement"
                        value={walkInName}
                        onChange={e => setWalkInName(e.target.value)}
                        className="p-2 border rounded text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Contact number (WhatsApp)"
                        value={walkInPhone}
                        onChange={e => setWalkInPhone(e.target.value)}
                        className="p-2 border rounded text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* PRODUCT CART SELECTOR */}
              <div className="bg-slate-50 border p-4 rounded-lg space-y-3">
                <label className="block text-slate-700 font-extrabold text-xs uppercase">
                  2. Add Filter Products Specifications
                </label>

                <div className="relative">
                  <input
                    type="text"
                    ref={productSearchRef}
                    id="quote-product-search-input"
                    placeholder="Search by part number code (e.g., C-6204)... [Ctrl+F]"
                    value={productSearchQuery}
                    onChange={e => {
                      setProductSearchQuery(e.target.value);
                      setShowProductDropdown(true);
                    }}
                    className="w-full text-xs p-3 pl-8 border rounded font-mono font-bold uppercase focus:border-sky-500 focus:outline-none"
                  />
                  <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-4" />

                  {showProductDropdown && productSearchQuery.trim().length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded shadow-xl max-h-56 overflow-y-auto divide-y z-30 font-sans text-xs">
                      {products
                        .filter(p => (p.part_number_norm || '').includes(normalizeCode(productSearchQuery)))
                        .slice(0, 100)
                        .map(p => (
                          <div
                            key={p.id}
                            onClick={() => handleAddProductToCart(p)}
                            className="p-2.5 hover:bg-slate-50 cursor-pointer flex justify-between items-center"
                          >
                            <div>
                              <strong className="text-slate-900 font-mono text-[13px]">{p.part_number}</strong>
                              <span className="text-gray-400 block font-mono text-[9px]">
                                {p.brand} · Shelf: {p.shelf_location || 'unassigned'}
                              </span>
                            </div>

                            <div className="text-right">
                              <span className="font-mono text-slate-800 font-bold block">
                                Rs. {p.sale_price.toLocaleString()}
                              </span>
                              <span className="text-[9px] text-gray-400 font-bold">Stock available: {p.stock_qty} pcs</span>
                            </div>
                          </div>
                        ))
                      }
                      {products.filter(p => (p.part_number_norm || '').includes(normalizeCode(productSearchQuery))).length === 0 && (
                        <div className="p-3 text-center text-gray-400 italic">No exact product matched.</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Cart Lines list */}
                {cart.length === 0 ? (
                  <div className="p-12 text-center text-gray-400 font-mono text-[10.5px] bg-white border rounded border-dashed">
                    Quotation list is empty. Choose part rates using search.
                  </div>
                ) : (
                  <div className="border rounded bg-white overflow-hidden">
                    <table className="w-full text-xs text-left divide-y">
                      <thead className="bg-[#FAF9F9] text-slate-650 uppercase text-[9px] font-black tracking-wide">
                        <tr>
                          <th className="p-2.5">Specifications Line</th>
                          <th className="p-2.5 text-center w-28">Valuation price</th>
                          <th className="p-2.5 text-center w-24">Demand Qty</th>
                          <th className="p-2.5 text-right w-28">Subtotal</th>
                          <th className="p-2.5 text-center w-12">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-gray-800">
                        {cart.map(line => (
                          <tr key={line.id} className="hover:bg-slate-50/50 text-[11px]">
                            
                            <td className="p-2.5">
                              <input
                                type="text"
                                value={line.part_number}
                                onChange={e => handleUpdateCartPartNumber(line.id, e.target.value)}
                                className="font-mono font-bold text-slate-800 text-xs border-b border-dashed border-slate-300 focus:border-indigo-500 focus:outline-none bg-transparent w-full p-0.5"
                                placeholder="Edit item description/part number..."
                                title="Click to edit product name for this quotation only"
                              />
                            </td>

                            {/* Adjustable valuation price */}
                            <td className="p-2.5 text-center">
                              <input
                                type="number"
                                min={0}
                                value={line.sale_price}
                                onChange={e => handleUpdateCartPrice(line.id, parseFloat(e.target.value) || 0)}
                                className="w-20 text-center p-1 border rounded font-mono font-bold text-xs"
                              />
                            </td>

                            {/* Qty */}
                            <td className="p-2.5 text-center">
                              <input
                                type="number"
                                min={1}
                                value={line.qty}
                                onChange={e => handleUpdateCartQty(line.id, parseInt(e.target.value) || 1)}
                                className="w-16 text-center p-1 border rounded font-mono font-bold text-xs"
                              />
                            </td>

                            <td className="p-2.5 text-right font-mono font-bold text-slate-800">
                              Rs. {line.line_total.toLocaleString()}
                            </td>

                            <td className="p-2.5 text-center">
                              <button
                                onClick={() => handleRemoveFromCart(line.id)}
                                className="text-gray-400 hover:text-[#0EA5E9] transition p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>

                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

            {/* SIDEBAR FOR VALIDITY & SAVING (Step 5.3) */}
            <div className="md:col-span-4 space-y-4">
              
              <div className="bg-slate-50 border p-4 rounded-lg space-y-4">
                <h3 className="font-extrabold text-slate-700 text-xs uppercase tracking-tight">
                  3. Validity Period & Expiry Configuration
                </h3>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                    Select Validity Range
                  </label>
                  <select
                    value={validityDays}
                    onChange={e => setValidityDays(parseInt(e.target.value, 10))}
                    className="w-full text-xs p-2 bg-white border rounded font-black focus:border-[#E11A22]"
                  >
                    <option value={3}>3 Days (Urgent Spot rates)</option>
                    <option value={5}>5 Days</option>
                    <option value={7}>7 Days (Standard)</option>
                    <option value={10}>10 Days</option>
                    <option value={14}>14 Days (Wholesale standard)</option>
                    <option value={30}>30 Days (Maximum limit)</option>
                  </select>
                </div>

                <div className="p-2.5 bg-neutral-100 rounded text-[11px] font-medium text-slate-700">
                  <span className="block text-[9px] uppercase font-bold text-gray-400">Calculated Expiry Date</span>
                  <span className="font-mono font-bold text-[#0EA5E9]">
                    {new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
                  </span>
                </div>

                {/* Customer Notes */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                    Notes for Customer (Shown on PDF)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="E.g., Subject to material availability index. Delivery within 2 days from order acceptance."
                    value={customerNotes}
                    onChange={e => setCustomerNotes(e.target.value)}
                    className="w-full text-xs p-2 border rounded focus:outline-none"
                  />
                </div>
              </div>

              {/* SAVING BOX & GRAND TOTAL */}
              <div className="bg-white border rounded-lg p-4 space-y-4 shadow-sm">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Total Quotation Estimation</span>
                  <h2 className="text-2xl font-black text-slate-900 font-mono mt-0.5">
                    Rs. {cartSubtotal.toLocaleString()}
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => handleSaveQuotation('draft')}
                    disabled={isSaving}
                    className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-850 text-xs font-extrabold uppercase tracking-wide rounded border transition disabled:opacity-50"
                  >
                    💾 Save Draft
                  </button>

                  <button
                    onClick={() => handleSaveQuotation('sent')}
                    disabled={isSaving}
                    className="py-3 bg-[#0ea5e9] hover:bg-sky-600 text-white text-xs font-extrabold uppercase tracking-wide rounded shadow transition disabled:opacity-50"
                  >
                    📤 Save & Mark Sent
                  </button>
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* ========================================================
          VIEW 4: SUCCESS CONFIRMATION SLIP (Step 5.3 Success screen)
          ======================================================== */}
      {viewState === 'success' && lastCreatedQuote && (
        <div className="bg-emerald-50 border border-emerald-200 p-8 rounded-lg max-w-xl mx-auto space-y-6 text-center animate-fadeIn" id="quote-success-canvas">
          
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xl mb-3">
              ✓
            </div>
            <h2 className="text-xl font-black text-emerald-900 uppercase tracking-tight">
              Quotation Successfully Logged
            </h2>
            <p className="text-xs text-emerald-700 font-bold mt-1 uppercase">
              Assigned slip ID: <span className="font-mono">{lastCreatedQuote.quote_number}</span>
            </p>
          </div>

          <div className="bg-white p-4 rounded border text-left text-xs divide-y text-slate-800 font-sans space-y-2.5">
            
            <div className="flex justify-between items-center py-2">
              <span className="font-bold text-gray-400 uppercase text-[10px]">Client / Recipient</span>
              <span className="font-bold text-slate-900 uppercase">{lastCreatedQuote.customer_name}</span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="font-bold text-gray-400 uppercase text-[10px]">Total Valuation</span>
              <span className="font-mono font-black text-slate-950">
                Rs. {lastCreatedQuote.total_amount.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="font-bold text-gray-400 uppercase text-[10px]">Est expiry validity</span>
              <span className="font-mono font-bold text-[#0EA5E9]">
                {new Date(lastCreatedQuote.expiry_date).toLocaleDateString()}
              </span>
            </div>

          </div>

          <div className="flex flex-col gap-2 pt-2">
            
            <button
              onClick={() => generateQuotationPDF(lastCreatedQuote)}
              className="py-3 bg-slate-800 hover:bg-[#111C30] text-white text-xs font-black uppercase tracking-wider rounded shadow flex items-center justify-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF Document</span>
            </button>

            <button
              onClick={() => handleWhatsAppShare(lastCreatedQuote)}
              className="py-3 bg-[#25D366] hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-wider rounded shadow flex items-center justify-center space-x-2"
            >
              <Share2 className="w-4 h-4" />
              <span>WhatsApp PDF Share</span>
            </button>

            <button
              onClick={() => setViewState('list')}
              className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold uppercase tracking-wide rounded transition"
            >
              Return to Listing Panel
            </button>

          </div>

        </div>
      )}

      {/* ========================================================
          CONVERSION TO INVOICE DIALOG OVERLAY (Step 5.2)
          ======================================================== */}
      {showConvertDialog && selectedQuote && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all" id="convert-modal-overlay">
          
          <div className="bg-white border rounded-xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative animate-fadeIn">
            
            <button
              onClick={() => setShowConvertDialog(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                Partial or Full Invoice Conversion
              </h3>
              <p className="text-xs text-gray-400">
                Target Quotation: <span className="font-mono text-sky-600 font-bold">{selectedQuote.quote_number}</span> • Client: {selectedQuote.customer_name}
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-505 uppercase">
                Select items to include in this invoice generation cycle:
              </p>

              <div className="border rounded-lg overflow-hidden divide-y text-xs max-h-56 overflow-y-auto">
                {selectedQuote.items.map(itm => (
                  <div 
                    key={itm.id} 
                    className={`p-3 flex justify-between items-center hover:bg-slate-50/50 ${
                      convertSelections[itm.id] ? 'bg-sky-50/10' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={convertSelections[itm.id] || false}
                        onChange={() => handleToggleConvertSelection(itm.id)}
                        className="w-4 h-4 text-sky-600 rounded border-gray-300 focus:ring-sky-400 cursor-pointer"
                      />
                      <div>
                        <span className="font-mono font-bold text-slate-900 block">{itm.part_number}</span>
                      </div>
                    </div>

                    <div className="text-right flex items-center space-x-6">
                      <span className="font-bold text-slate-600 font-mono">{itm.qty} pcs</span>
                      <span className="font-mono font-black text-slate-900">
                        Rs. {itm.line_total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Price Calculations */}
            <div className="p-4 bg-slate-50 border rounded-lg flex justify-between items-center text-xs">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Consolidated Conversion Valuation</span>
                <p className="text-gray-500 mt-0.5 font-medium">
                  {selectedQuote.items.filter(itm => convertSelections[itm.id]).length} items selected for invoicing.
                </p>
              </div>

              <div className="text-right">
                <span className="text-[9.5px] uppercase text-gray-400 font-bold block">Invoicing net rate</span>
                <span className="font-mono font-black text-slate-900 text-lg">
                  Rs. {selectedQuote.items
                    .filter(itm => convertSelections[itm.id])
                    .reduce((acc, i) => acc + i.line_total, 0)
                    .toLocaleString()
                  }
                </span>
              </div>
            </div>

            {/* Footer triggers */}
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowConvertDialog(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold uppercase rounded transition"
              >
                Cancel Conversion
              </button>

              <button
                onClick={handleConfirmInvoiceConversion}
                disabled={isSaving}
                className="flex-1 py-3 bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-black uppercase rounded shadow transition disabled:opacity-50"
              >
                → Create Invoice
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
