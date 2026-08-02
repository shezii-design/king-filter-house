import React, { useState, useEffect } from 'react';
import { db, normalizeCode } from '../data';
import { Product, Invoice, InvoiceItem, Return, ReturnItem, ReplacementItem, Party } from '../types';
import { 
  Search, 
  RotateCcw, 
  Check, 
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  FileText,
  User,
  Calendar,
  X,
  CreditCard,
  DollarSign,
  Undo2,
  Package,
  Activity,
  Grid,
  TrendingDown,
  ChevronRight,
  RefreshCw,
  Percent
} from 'lucide-react';

interface ReturnsViewProps {
  userRole: 'Owner' | 'Staff';
  onReturnProcessed: () => void;
}

export default function ReturnsView({ userRole, onReturnProcessed }: ReturnsViewProps) {
  // Navigation & View State
  // 'list' -> Show returns list, stats and tab filtration
  // 'new' -> Create return wizard
  const [viewState, setViewState] = useState<'list' | 'new'>('list');

  // New return creation flow step index: 1, 2, 3, 4
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Raw Database States cached
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);

  // List search & tab selection
  type TabType = 'all' | 'full' | 'partial' | 'exchange' | 'credit_note' | 'defective';
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Step 1 states
  const [step1Search, setStep1Search] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Step 2 states
  type ReturnType = 'full' | 'partial' | 'exchange' | 'credit_note' | 'defective';
  const [selectedType, setSelectedType] = useState<ReturnType | null>(null);

  // Step 3 states
  // We keep track of selection and details of return items inside a dictionary or array
  // mapped to the selected invoice items
  interface ReturnItemState {
    checked: boolean;
    qty_returned: number;
    condition: 'resellable' | 'damaged' | 'supplier_claim';
  }
  const [itemSelections, setItemSelections] = useState<Record<string, ReturnItemState>>({});

  // Exchange replacement product states
  const [replacementSearch, setReplacementSearch] = useState('');
  const [showReplacementDropdown, setShowReplacementDropdown] = useState(false);
  const [selectedReplacement, setSelectedReplacement] = useState<Product | null>(null);
  const [replacementQty, setReplacementQty] = useState<number>(1);

  // Reason & Notes states
  const [returnReason, setReturnReason] = useState('');
  const [returnNotes, setReturnNotes] = useState('');

  // Live Sync / Saving indicators
  const [isSaving, setIsSaving] = useState(false);

  // Load backend variables
  const reloadData = () => {
    setInvoices(db.getInvoices());
    setProducts(db.getProducts());
    setParties(db.getParties());
    setReturns(db.getReturns());
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Sync state modifications
  const handleRefresh = () => {
    reloadData();
    db.logPendingSync("Manually triggered returns data fetch");
  };

  // Helper to calculation of returns already processed for an invoice
  const getAlreadyReturnedQty = (invoiceNumber: string, productId: string) => {
    let count = 0;
    returns.forEach(ret => {
      if (ret.invoice_number === invoiceNumber) {
        ret.items.forEach(itm => {
          if (itm.product_id === productId) {
            count += itm.qty_returned;
          }
        });
      }
    });
    return count;
  };

  // Live calculations for Step 3 & 4
  const getReturnItemsToProcess = (): ReturnItem[] => {
    if (!selectedInvoice || selectedType === 'credit_note') return [];

    return selectedInvoice.items
      .filter(item => {
        const sel = itemSelections[item.id];
        return sel && sel.checked && sel.qty_returned > 0;
      })
      .map(item => {
        const sel = itemSelections[item.id]!;
        return {
          id: `ri-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          product_id: item.product_id,
          part_number: item.part_number,
          brand: item.brand,
          qty_returned: sel.qty_returned,
          unit_price: item.sale_price,
          credit_amount: sel.qty_returned * item.sale_price,
          condition: sel.condition
        };
      });
  };

  // Overall calculations
  const returnItems = getReturnItemsToProcess();
  const rawCreditAmount = returnItems.reduce((acc, itm) => acc + itm.credit_amount, 0);

  // If credit note type, credit amount is adjustable of invoice net amount
  const getFinalCreditAmount = () => {
    if (selectedType === 'credit_note') {
      return selectedInvoice ? selectedInvoice.net_amount : 0;
    }
    
    // For Exchange return type, we subtract the replacement value from credit issued:
    if (selectedType === 'exchange' && selectedReplacement) {
      const replacementTotal = selectedReplacement.sale_price * replacementQty;
      return Math.max(0, rawCreditAmount - replacementTotal);
    }

    return rawCreditAmount;
  };

  const finalCreditAmount = getFinalCreditAmount();

  // Condition checks
  const hasDamagedOrClaim = returnItems.some(itm => itm.condition === 'damaged' || itm.condition === 'supplier_claim');

  // ----------------------------------------------------------------------
  // ACTION HANDLERS
  // ----------------------------------------------------------------------

  // Selecting invoice during Step 1
  const handleSelectInvoice = (inv: Invoice) => {
    setSelectedInvoice(inv);
    
    // Auto-reset secondary states
    setSelectedType(null);
    setItemSelections({});
    setSelectedReplacement(null);
    setReplacementQty(1);
    setReturnReason('');
    setReturnNotes('');
    
    // Advance to Step 2
    setCurrentStep(2);
  };

  // Selecting type during Step 2
  const handleSelectType = (type: ReturnType) => {
    setSelectedType(type);

    // Bootstrap Step 3 selections depending on type chosen
    if (selectedInvoice) {
      const defaultSelections: Record<string, ReturnItemState> = {};
      
      selectedInvoice.items.forEach(item => {
        const returnedCount = getAlreadyReturnedQty(selectedInvoice.invoice_number, item.product_id);
        const maxAvailable = Math.max(0, item.qty - returnedCount);

        // For Full Return or Defective, we auto-check items initially
        const isAutoChecked = type === 'full' || type === 'defective';
        
        defaultSelections[item.id] = {
          checked: isAutoChecked && maxAvailable > 0,
          qty_returned: maxAvailable,
          condition: type === 'defective' ? 'supplier_claim' : 'resellable'
        };
      });
      setItemSelections(defaultSelections);
    }

    // Advance to Step 3
    setCurrentStep(3);
  };

  // Toggling line item selection in Step 3
  const handleToggleItemCheck = (lineId: string) => {
    setItemSelections(prev => {
      const current = prev[lineId];
      if (!current) return prev;
      return {
        ...prev,
        [lineId]: {
          ...current,
          checked: !current.checked
        }
      };
    });
  };

  // Updating return qty
  const handleUpdateItemQty = (lineId: string, value: number, maxVal: number) => {
    const cleanVal = Math.max(0, Math.min(maxVal, value));
    setItemSelections(prev => {
      const current = prev[lineId];
      if (!current) return prev;
      return {
        ...prev,
        [lineId]: {
          ...current,
          qty_returned: cleanVal,
          // Uncheck if set to 0 strictly
          checked: cleanVal > 0 ? current.checked : false
        }
      };
    });
  };

  const handleUpdateItemCondition = (lineId: string, condition: 'resellable' | 'damaged' | 'supplier_claim') => {
    setItemSelections(prev => {
      const current = prev[lineId];
      if (!current) return prev;
      return {
        ...prev,
        [lineId]: {
          ...current,
          condition
        }
      };
    });
  };

  // Replacement additions for Exchange type
  const handleSelectReplacementProduct = (prod: Product) => {
    setSelectedReplacement(prod);
    setReplacementSearch('');
    setShowReplacementDropdown(false);
  };

  // Final Action: Process checkout database mutation
  const handleProcessReturnSave = () => {
    if (!selectedInvoice) return;
    if (!selectedType) return;
    
    // For all types except Credit Note, we need at least one returned item
    if (selectedType !== 'credit_note' && returnItems.length === 0) {
      alert("Please select at least one item with a quantity to return.");
      return;
    }

    if (!returnReason.trim()) {
      alert("Return reason statement is required.");
      return;
    }

    setIsSaving(true);

    setTimeout(() => {
      try {
        const dateNow = new Date().toISOString();
        const retNumber = `RET-${new Date().getFullYear()}-${String(returns.length + 1).padStart(4, '0')}`;
        const retId = `ret-${Date.now()}`;

        // Prepare replacement item payload if Exchange chosen
        let replItem: ReplacementItem | null = null;
        if (selectedType === 'exchange' && selectedReplacement) {
          replItem = {
            product_id: selectedReplacement.id,
            part_number: selectedReplacement.part_number,
            brand: selectedReplacement.brand,
            qty: replacementQty,
            sale_price: selectedReplacement.sale_price,
            line_total: selectedReplacement.sale_price * replacementQty
          };
        }

        const finalizedReturn: Return = {
          id: retId,
          return_number: retNumber,
          invoice_id: selectedInvoice.id,
          invoice_number: selectedInvoice.invoice_number,
          customer_name: selectedInvoice.customer_name,
          party_id: selectedInvoice.party_id,
          type: selectedType,
          items: returnItems,
          replacement_item: replItem,
          credit_amount: finalCreditAmount,
          reason: returnReason.trim(),
          notes: returnNotes.trim(),
          status: hasDamagedOrClaim ? 'pending_claim' : 'processed',
          timestamp: dateNow,
          user: userRole,
          is_active: true
        };

        // Mutate and restore/adjust stocks of returned products
        const allProductsList = db.getAllProductsWithDeleted();
        
        // Restore returned items
        returnItems.forEach(retLine => {
          const pIdx = allProductsList.findIndex(p => p.id === retLine.product_id);
          if (pIdx >= 0) {
            const prod = allProductsList[pIdx];
            
            if (retLine.condition === 'resellable') {
              // Add to sellable stock
              prod.stock_qty += retLine.qty_returned;
              
              db.saveMovement({
                product_id: retLine.product_id,
                qty_change: retLine.qty_returned,
                from_status: 'none',
                to_status: 'sellable',
                type: 'returned',
                user: userRole,
                reason: `Item restored via return ${retNumber} (Resellable)`
              });
            } else {
              // Damaged stock increment
              prod.damaged_qty += retLine.qty_returned;
              
              db.saveMovement({
                product_id: retLine.product_id,
                qty_change: retLine.qty_returned,
                from_status: 'none',
                to_status: 'damaged',
                type: 'damaged',
                user: userRole,
                reason: `Damaged item added via return ${retNumber} - ${retLine.condition === 'supplier_claim' ? 'Claim flagged' : 'Defect item'}`
              });
            }
          }
        });

        // Deduct replacement items if exchange is performed
        if (selectedType === 'exchange' && selectedReplacement) {
          const pIdx = allProductsList.findIndex(p => p.id === selectedReplacement.id);
          if (pIdx >= 0) {
            allProductsList[pIdx].stock_qty = Math.max(0, allProductsList[pIdx].stock_qty - replacementQty);
            
            db.saveMovement({
              product_id: selectedReplacement.id,
              qty_change: -replacementQty,
              from_status: 'sellable',
              to_status: 'none',
              type: 'sold',
              user: userRole,
              reason: `Exchange dispatch line for return ${retNumber}`
            });
          }
        }

        // Apply product alterations
        db.saveProducts(allProductsList);

        // Adjust Customer Balance if they have a ledger profile
        if (selectedInvoice.party_id) {
          const allPartiesList = db.getParties();
          const partyIdx = allPartiesList.findIndex(p => p.id === selectedInvoice.party_id);
          if (partyIdx >= 0) {
            // Returns reduce their credit (Outstanding Debit) balance
            allPartiesList[partyIdx].credit_balance = Math.max(
              -500000, 
              allPartiesList[partyIdx].credit_balance - finalCreditAmount
            );
            db.saveParties(allPartiesList);
          }
        }

        // Save this Return to database
        db.saveReturn(finalizedReturn);

        // Update original invoice status if fully returned, and save it to synchronize state
        const updatedInvoice = { ...selectedInvoice };
        if (selectedType === 'full') {
          updatedInvoice.status = 'returned';
        }
        db.saveInvoice(updatedInvoice);

        // Reset and update visual dashboard counters
        db.logPendingSync(`Processed ${selectedType.toUpperCase()} return value of Rs. ${finalCreditAmount}`);
        
        // Return to main list screen
        setViewState('list');
        reloadData();
        onReturnProcessed();
      } catch (e: any) {
        alert("Verification failure during returns process: " + e.message);
      } finally {
        setIsSaving(false);
      }
    }, 450);
  };

  // ----------------------------------------------------------------------
  // FILTERS & DISPLAYS FOR LIST
  // ----------------------------------------------------------------------
  const getFilteredReturns = (): Return[] => {
    let list = [...returns].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => 
        r.return_number.toLowerCase().includes(q) ||
        r.invoice_number.toLowerCase().includes(q) ||
        r.customer_name.toLowerCase().includes(q)
      );
    }

    // Tabs
    if (activeTab !== 'all') {
      list = list.filter(r => r.type === activeTab);
    }

    return list;
  };

  const displayedReturns = getFilteredReturns();

  // Metrics Counters
  const totalReturnsCount = returns.length;
  const totalCreditIssued = returns.reduce((acc, r) => acc + r.credit_amount, 0);
  const pendingClaimsCount = returns.filter(r => r.status === 'pending_claim').length;

  return (
    <div className="space-y-4" id="returns-module-root">

      {/* =======================================================
          VIEW 1: LIST / STATS VIEW
          ======================================================= */}
      {viewState === 'list' && (
        <div className="space-y-4 animate-fadeIn" id="returns-list-stage">
          
          {/* TOPBAR */}
          <div className="bg-white border p-4 flex justify-between items-center bg-slate-50/50 rounded-lg shadow-sm" id="returns-list-topbar">
            <div>
              <span className="text-[10px] uppercase font-extrabold bg-indigo-600 text-white px-2 py-0.5 rounded">
                Returns & Exchanges
              </span>
              <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight mt-1">Order Returns</h1>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={handleRefresh}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded"
                title="Reload DB"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setViewState('new');
                  setCurrentStep(1);
                  setSelectedInvoice(null);
                  setSelectedType(null);
                  setItemSelections({});
                }}
                className="px-6 py-2.5 bg-[#0EA5E9] text-white font-extrabold text-xs uppercase tracking-wider rounded shadow hover:bg-sky-600 transition"
                id="btn-goto-new-return"
              >
                + New Return
              </button>
            </div>
          </div>

          {/* STATS ROW */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="returns-stats-row">
            <div className="bg-white p-4 border border-l-4 border-l-indigo-600 rounded-lg shadow-sm flex justify-between items-center">
              <div>
                <p className="text-[10px] uppercase font-extrabold text-slate-400">Total Returns Logged</p>
                <h3 className="text-xl font-black text-indigo-700 font-mono mt-1">
                  {totalReturnsCount} Slips Issued
                </h3>
              </div>
              <div className="p-2 bg-indigo-50 rounded text-indigo-600 font-mono text-[9px]">ERP Ledger</div>
            </div>

            <div className="bg-white p-4 border border-l-4 border-l-amber-500 rounded-lg shadow-sm flex justify-between items-center">
              <div>
                <p className="text-[10px] uppercase font-extrabold text-slate-400">Total Credits Settled / Credited</p>
                <h3 className="text-xl font-black text-amber-600 font-mono mt-1">
                  Rs. {totalCreditIssued.toLocaleString()}
                </h3>
              </div>
              <div className="p-2 bg-amber-50 rounded text-amber-600 font-mono text-[9px]">Adjusted A/R</div>
            </div>

            <div className="bg-white p-4 border border-l-4 border-l-red-500 rounded-lg shadow-sm flex justify-between items-center">
              <div>
                <p className="text-[10px] uppercase font-extrabold text-slate-400">Pending Supplier Claims (Defectives)</p>
                <h3 className="text-xl font-black text-[#0ea5e9] font-mono mt-1">
                  {pendingClaimsCount} Pending
                </h3>
              </div>
              <div className="p-2 bg-sky-50 rounded text-red-500 font-mono text-[9px]">Supplier Return Pool</div>
            </div>
          </div>

          {/* SEARCH BAR & FILTERS */}
          <div className="bg-white p-3 border rounded-lg shadow-sm space-y-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search returns by return code, original invoice, or customer..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-xs p-2.5 pl-8 border rounded font-bold uppercase focus:border-sky-550 focus:outline-none"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-3.5" />
            </div>

            {/* TAB FILTERS */}
            <div className="flex border-b border-[#E2DFDF] bg-slate-50/80 space-x-2 text-xs divide-x-0 overflow-x-auto rounded-t scrollbar-none" id="returns-tabs-list">
              {([
                { key: 'all', title: 'All Returns', icon: Grid, iconColor: 'text-slate-500' },
                { key: 'full', title: 'Full Returns', icon: Undo2, iconColor: 'text-indigo-500' },
                { key: 'partial', title: 'Partial Returns', icon: TrendingDown, iconColor: 'text-amber-500' },
                { key: 'exchange', title: 'Exchanges', icon: RefreshCw, iconColor: 'text-sky-500' },
                { key: 'credit_note', title: 'Credit Notes', icon: FileText, iconColor: 'text-blue-500' },
                { key: 'defective', title: 'Defectives', icon: AlertTriangle, iconColor: 'text-rose-500' }
              ] as const).map(tab => {
                const isSelected = activeTab === tab.key;
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 font-bold uppercase text-[9.5px] tracking-wider transition-all border-b-2 -mb-[1px] whitespace-nowrap outline-none flex items-center space-x-2 shrink-0 ${
                      isSelected 
                        ? 'border-[#0EA5E9] text-[#0EA5E9] bg-white border-x border-x-gray-250 font-black shadow-xs' 
                        : 'border-transparent text-gray-400 hover:text-slate-700 hover:bg-slate-100/60'
                    }`}
                  >
                    <IconComponent className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#0EA5E9]' : tab.iconColor}`} />
                    <span>{tab.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TABLE */}
          {displayedReturns.length === 0 ? (
            <div className="p-12 bg-white border border-slate-200 text-center text-gray-400 font-mono flex flex-col items-center justify-center space-y-2 rounded-lg shadow-sm">
              <Package className="w-10 h-10 opacity-25 text-indigo-500" />
              <span>No returns found in active ledger segment. Click "+ New Return" to start.</span>
            </div>
          ) : (
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden divide-y" id="records-table">
              {displayedReturns.map(ret => {
                let badgeColor = "bg-slate-100 text-slate-700";
                if (ret.type === "full") badgeColor = "bg-blue-100 text-blue-800";
                if (ret.type === "partial") badgeColor = "bg-yellow-100 text-yellow-800";
                if (ret.type === "exchange") badgeColor = "bg-green-100 text-green-800";
                if (ret.type === "credit_note") badgeColor = "bg-indigo-100 text-indigo-800";
                if (ret.type === "defective") badgeColor = "bg-sky-100 text-[#0ea5e9]";

                return (
                  <div key={ret.id} className="p-4 hover:bg-slate-50 transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs font-sans">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="font-mono font-bold text-[#0ea5e9] tracking-wider">
                          {ret.return_number}
                        </span>
                        <span className="text-slate-400 text-[10px] flex items-center">
                          <ArrowLeft className="w-3 h-3 mr-0.5" />
                          {ret.invoice_number}
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className={`px-2 py-0.5 rounded text-[8.5px] uppercase font-black tracking-normal ${badgeColor}`}>
                          {ret.type}
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className="text-slate-400 text-[10px] font-mono flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(ret.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-gray-800 text-sm">{ret.customer_name}</h4>
                      <p className="text-[10px] text-gray-500 italic">
                        <strong>Reason:</strong> {ret.reason} {ret.notes ? `| ${ret.notes}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center space-x-6 text-right w-full md:w-auto justify-between md:justify-end">
                      <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-gray-400">Credit Adjusted</p>
                        <p className="font-mono font-black text-amber-653 text-sm">
                          Rs. {ret.credit_amount.toLocaleString()}
                        </p>
                      </div>

                      <div className="flex flex-col items-end">
                        <span className="text-[9px] uppercase text-gray-400 font-bold mb-1">Claim Status</span>
                        {ret.status === 'pending_claim' ? (
                          <span className="px-2 py-0.5 text-[8.5px] uppercase font-black bg-rose-50 text-rose-700 border border-rose-200 rounded">
                            Claim Raised
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[8.5px] uppercase font-black bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                            Completed
                          </span>
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

      {/* =======================================================
          VIEW 2: CREATION WIZARD (4-STEP FLOW)
          ======================================================= */}
      {viewState === 'new' && (
        <div className="bg-white p-6 border rounded-lg shadow-sm space-y-6 animate-fadeIn" id="returns-wizard-stage">
          
          {/* Pos terminal top controls */}
          <div className="flex justify-between items-center pb-4 border-b">
            <div>
              <button
                onClick={() => setViewState('list')}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Return List</span>
              </button>
              <h2 className="text-lg font-black uppercase text-slate-800 tracking-tight mt-1">
                New Order Return Process
              </h2>
            </div>

            {/* Step Indicators */}
            <div className="flex items-center space-x-1 font-mono text-[10px]">
              {['1. Select Invoice', '2. Type', '3. Setup Items', '4. Confirm Slip'].map((stepStr, idx) => {
                const sNum = idx + 1;
                const isActive = currentStep === sNum;
                const isPassed = currentStep > sNum;
                return (
                  <div key={sNum} className="flex items-center">
                    <span className={`px-2 py-1 rounded font-bold uppercase tracking-wider ${
                      isActive 
                        ? 'bg-[#0ea5e9] text-white' 
                        : isPassed 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                          : 'bg-slate-100 text-slate-400'
                    }`}>
                      {stepStr}
                    </span>
                    {idx < 3 && <ChevronRight className="w-3.5 h-3.5 text-gray-300 mx-1" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* -----------------------------------------------------------------
              STEP 1: FIND ORIGINAL TRANSACTION INVOICE
              ----------------------------------------------------------------- */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-fadeIn" id="step-1-find-invoice">
              <div className="bg-slate-50 p-4 rounded border">
                <label className="block text-slate-700 font-extrabold text-xs uppercase mb-2">
                  Step 1: Locate Original King Filter House Invoice
                </label>
                
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by Invoice number (e.g. KFH-2026-0001) or customer name..."
                    value={step1Search}
                    onChange={e => setStep1Search(e.target.value)}
                    className="w-full text-xs p-3 pl-9 border rounded font-mono font-bold uppercase focus:border-sky-500 focus:outline-none"
                  />
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-4" />
                </div>
              </div>

              {/* Dynamic Droplist matches */}
              {step1Search.trim().length > 0 && (
                <div className="border rounded bg-white shadow-xl divide-y max-h-60 overflow-y-auto">
                  {invoices
                    .filter(inv => 
                      inv.invoice_number.toLowerCase().includes(step1Search.toLowerCase()) ||
                      inv.customer_name.toLowerCase().includes(step1Search.toLowerCase())
                    )
                    .map(inv => (
                      <div
                        key={inv.id}
                        onClick={() => handleSelectInvoice(inv)}
                        className="p-3 hover:bg-slate-50/80 cursor-pointer flex justify-between items-center transition"
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-[#0ea5e9] font-sans">{inv.invoice_number}</span>
                            <span className="text-[9px] bg-indigo-50 text-indigo-800 px-1 rounded uppercase font-bold">
                              {inv.payment_method || 'Paid'}
                            </span>
                            <span className="text-gray-300">•</span>
                            <span className="text-[10px] text-gray-500 font-mono">
                              {new Date(inv.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <strong className="text-gray-800 text-sm block mt-1">{inv.customer_name}</strong>
                          <span className="text-[10px] text-gray-400">
                            {inv.items.length} unique lines ({inv.items.reduce((acc, i) => acc + i.qty, 0)} items)
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-slate-800">
                            Rs. {inv.net_amount.toLocaleString()}
                          </p>
                          {inv.net_amount - inv.received_amount > 0 && (
                            <span className="text-[9.5px] bg-sky-50 text-sky-700 px-1 rounded font-bold font-mono">
                              Rs. {(inv.net_amount - inv.received_amount).toLocaleString()} Outstanding
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  }
                  {invoices.filter(inv => inv.invoice_number.toLowerCase().includes(step1Search.toLowerCase()) || inv.customer_name.toLowerCase().includes(step1Search.toLowerCase())).length === 0 && (
                    <div className="p-4 text-center text-gray-400 italic font-mono text-xs">
                      No invoices found matching keyword. Ensure proper code prefix.
                    </div>
                  )}
                </div>
              )}

              {/* RECENT INVOICES LIST FOR QUICK ACCESS */}
              <div className="space-y-2">
                <h4 className="text-[10px] uppercase font-black text-slate-500 tracking-wider">
                  Select from Recent Invoices List
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="recent-invoices-pos">
                  {invoices
                    .slice()
                    .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .slice(0, 6)
                    .map(inv => (
                      <div
                        key={inv.id}
                        onClick={() => handleSelectInvoice(inv)}
                        className="p-3 border rounded-lg bg-white hover:border-[#E11A22] hover:bg-slate-50 cursor-pointer transition flex justify-between items-center text-xs"
                      >
                        <div>
                          <strong className="font-mono text-[#0EA5E9] font-semibold">{inv.invoice_number}</strong>
                          <p className="font-bold text-gray-850 mt-1 truncate max-w-[180px]">{inv.customer_name}</p>
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5">{new Date(inv.timestamp).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-black text-slate-900 block">Rs. {inv.net_amount.toLocaleString()}</span>
                          <span className="text-[9px] text-slate-400">{inv.items.length} lines</span>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>

            </div>
          )}

          {/* -----------------------------------------------------------------
              STEP 2: RESOLVE RETURN TYPE
              ----------------------------------------------------------------- */}
          {currentStep === 2 && selectedInvoice && (
            <div className="space-y-4 animate-fadeIn" id="step-2-return-type">
              <div className="flex items-center justify-between bg-slate-100 p-3 rounded text-xs">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-500">Selected Invoice</span>
                  <p className="font-mono text-gray-900 font-bold">{selectedInvoice.invoice_number} — {selectedInvoice.customer_name}</p>
                </div>
                <button
                  onClick={() => setCurrentStep(1)}
                  className="text-blue-600 hover:text-blue-800 font-semibold"
                >
                  Change Invoice
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-slate-505 font-extrabold text-xs uppercase">
                  Step 2: Select Return Action Type
                </label>
                <p className="text-[11px] text-gray-500">Choose physical workflow structure of processing items in registers.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4" id="return-types-grid">
                
                {[
                  {
                    type: 'full' as const,
                    icon: '↩️',
                    label: 'Full Return',
                    desc: 'All items returned, full credit adjusted in accounting.'
                  },
                  {
                    type: 'partial' as const,
                    icon: '⚡',
                    label: 'Partial Return',
                    desc: 'Selected items returned, others kept by customer.'
                  },
                  {
                    type: 'exchange' as const,
                    icon: '🔄',
                    label: 'Exchange',
                    desc: 'Return item A, take different item B instead.'
                  },
                  {
                    type: 'credit_note' as const,
                    icon: '📋',
                    label: 'Credit Note',
                    desc: 'Issue digital ledger credit immediately without physical item return.'
                  },
                  {
                    type: 'defective' as const,
                    icon: '⚠️',
                    label: 'Defective',
                    desc: 'Damaged filter item. Raise supplier claim pool indicator.'
                  }
                ].map(card => {
                  const isSelected = selectedType === card.type;
                  return (
                    <div
                      key={card.type}
                      onClick={() => handleSelectType(card.type)}
                      className={`p-4 border rounded-lg cursor-pointer transition text-center space-y-2 flex flex-col justify-between ${
                        isSelected 
                          ? 'border-[#0EA5E9] bg-[#FFF1F2] shadow-sm scale-102 ring-1 ring-sky-400'
                          : 'bg-white hover:bg-slate-50 hover:border-gray-300'
                      }`}
                    >
                      <div className="space-y-1">
                        <span className="text-3xl block my-1">{card.icon}</span>
                        <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-tight">{card.label}</h4>
                        <p className="text-[10px] text-gray-400 leading-normal">{card.desc}</p>
                      </div>

                      <div className="pt-2">
                        <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded uppercase ${
                          isSelected ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {isSelected ? 'Selected' : 'Select'}
                        </span>
                      </div>
                    </div>
                  );
                })}

              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-5 py-2 bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200"
                >
                  Back Step
                </button>
              </div>
            </div>
          )}

          {/* -----------------------------------------------------------------
              STEP 3: CHOOSE ITEMS & INPUT CONDITION VALUES
              ----------------------------------------------------------------- */}
          {currentStep === 3 && selectedInvoice && selectedType && (
            <div className="space-y-4 animate-fadeIn" id="step-3-choose-items">
              
              {/* Context Block */}
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded text-xs border">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-500">Processing Slip Target</span>
                  <p className="font-mono text-gray-900 font-bold">
                    {selectedInvoice.invoice_number} ({selectedInvoice.customer_name}) • Return mode: <span className="uppercase text-[#0ea5e9] font-extrabold">{selectedType}</span>
                  </p>
                </div>
                <button
                  onClick={() => setCurrentStep(2)}
                  className="text-blue-600 hover:text-blue-800 font-semibold"
                >
                  Change Return Type
                </button>
              </div>

              {/* CREDIT NOTE NO ITEMS WARNING */}
              {selectedType === 'credit_note' ? (
                <div className="p-6 bg-indigo-50 border border-indigo-200 text-indigo-950 rounded-lg space-y-2 flex items-start space-x-3">
                  <span className="text-2xl mt-0.5">📋</span>
                  <div className="text-xs space-y-1">
                    <h4 className="font-black uppercase tracking-wider text-indigo-900 text-[11px]">Ledger Credit Adjustments Notice</h4>
                    <p>No physical items inventory table is required under Credit Note adjustments.</p>
                    <p className="text-gray-600">This action will issue a direct digital credit adjustments of <strong>Rs. {selectedInvoice.net_amount.toLocaleString()}</strong> back to customer <strong>{selectedInvoice.customer_name}</strong> immediately upon submission.</p>
                  </div>
                </div>
              ) : (
                // ITEMS TABLE FOR PHYSICAL RETURNS
                <div className="space-y-2">
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left divide-y">
                      <thead className="bg-slate-100 text-slate-600 uppercase text-[9.5px] tracking-wider font-extrabold">
                        <tr>
                          <th className="p-3 text-center w-12">Return</th>
                          <th className="p-3">Product Specifications</th>
                          <th className="p-3 text-center w-36">Returned / Max Sold</th>
                          <th className="p-3 text-center w-32">Return Qty Action</th>
                          <th className="p-3 text-center w-28">Credit Amount</th>
                          <th className="p-3 w-48">Condition Log</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y bg-white">
                        {selectedInvoice.items.map(item => {
                          const matchingSel = itemSelections[item.id] || { checked: false, qty_returned: 0, condition: 'resellable' };
                          const alreadyReturned = getAlreadyReturnedQty(selectedInvoice.invoice_number, item.product_id);
                          const maxToReturn = Math.max(0, item.qty - alreadyReturned);

                          return (
                            <tr key={item.id} className={`hover:bg-slate-50/50 ${matchingSel.checked ? 'bg-sky-50/10' : ''}`}>
                              
                              {/* Checkbox selector */}
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  disabled={maxToReturn <= 0}
                                  checked={matchingSel.checked}
                                  onChange={() => handleToggleItemCheck(item.id)}
                                  className="w-4 h-4 text-sky-600 rounded border-gray-300 focus:ring-sky-400 cursor-pointer disabled:cursor-not-allowed"
                                />
                              </td>

                              {/* Product info */}
                              <td className="p-3">
                                <span className="font-mono font-bold text-gray-900 text-sm select-all block">
                                  {item.part_number}
                                </span>
                                <span className="text-[10px] text-gray-400 block uppercase font-medium">
                                  Brand: {item.brand} • Unit rate: Rs. {item.sale_price.toLocaleString()}
                                </span>
                              </td>

                              {/* Already returned count */}
                              <td className="p-3 text-center font-mono">
                                <div className="space-y-0.5">
                                  <span className="text-gray-900 font-bold">{alreadyReturned} / {item.qty} pcs</span>
                                  <p className="text-[9.5px] text-gray-400">returned previously</p>
                                </div>
                              </td>

                              {/* Return Qty input */}
                              <td className="p-3 text-center">
                                <div className="inline-block space-y-1">
                                  <input
                                    type="number"
                                    disabled={!matchingSel.checked || maxToReturn <= 0}
                                    min={1}
                                    max={maxToReturn}
                                    value={matchingSel.qty_returned}
                                    onChange={e => handleUpdateItemQty(item.id, parseInt(e.target.value, 10) || 0, maxToReturn)}
                                    className="w-20 text-center p-1.5 border border-slate-300 rounded font-mono font-bold text-xs disabled:opacity-50 disabled:bg-slate-50"
                                  />
                                  <p className="text-[10px] text-red-500 font-bold">max {maxToReturn} pcs</p>
                                </div>
                              </td>

                              {/* Live Credit Amber */}
                              <td className="p-3 text-center font-mono text-[#DD5000] font-bold text-sm">
                                Rs. {(matchingSel.qty_returned * item.sale_price).toLocaleString()}
                              </td>

                              {/* Condition Dropdown Drop */}
                              <td className="p-3">
                                {matchingSel.checked ? (
                                  <select
                                    value={matchingSel.condition}
                                    onChange={e => handleUpdateItemCondition(item.id, e.target.value as any)}
                                    className="w-full p-1.5 border rounded text-xs font-semibold focus:border-[#E11A22] bg-slate-50/50"
                                  >
                                    <option value="resellable">🟢 Resellable (Back to shelf)</option>
                                    <option value="damaged">🔴 Damaged Defective</option>
                                    <option value="supplier_claim">⚠️ Supplier Claim (Lock stock)</option>
                                  </select>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-bold italic">Line excluded</span>
                                )}
                              </td>

                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* EXCHANGE EXTRA FIELD */}
              {selectedType === 'exchange' && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-3">
                  <div className="flex items-center space-x-1.5 pb-2 border-b border-emerald-200">
                    <span className="text-lg">🔄</span>
                    <h4 className="font-extrabold uppercase text-emerald-900 text-xs tracking-wide">
                      Exchange Replacement Item Allocation
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="exchange-setup-grid">
                    
                    {/* Search part number */}
                    <div className="relative">
                      <label className="block text-[9px] font-black uppercase text-emerald-800 mb-1">
                        Find replacement product code
                      </label>
                      <input
                        type="text"
                        placeholder="Sakura alternate part code..."
                        value={replacementSearch}
                        onChange={e => {
                          setReplacementSearch(e.target.value);
                          setShowReplacementDropdown(true);
                        }}
                        className="w-full text-xs p-2 border border-emerald-300 rounded font-sans uppercase font-medium focus:outline-none"
                      />
                      
                      {showReplacementDropdown && replacementSearch.trim().length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded shadow-xl z-20 max-h-48 overflow-y-auto divide-y font-sans text-xs">
                          {products
                            .filter(p => (p.part_number_norm || '').includes(normalizeCode(replacementSearch)))
                            .slice(0, 10)
                            .map(p => (
                              <div
                                key={p.id}
                                onClick={() => handleSelectReplacementProduct(p)}
                                className="p-2 hover:bg-emerald-50 cursor-pointer flex justify-between items-center"
                              >
                                <div>
                                  <strong className="text-gray-900 font-mono text-[11.5px]">{p.part_number}</strong>
                                  <span className="text-[9px] text-gray-400 block">Brand: {p.brand} · Stock: {p.stock_qty} pcs</span>
                                </div>
                                <span className="font-bold text-gray-700 font-mono text-[10.5px]">Rs. {p.sale_price.toLocaleString()}</span>
                              </div>
                            ))
                          }
                        </div>
                      )}
                    </div>

                    {/* Quantity required */}
                    <div>
                      <label className="block text-[9px] font-black uppercase text-emerald-800 mb-1">
                        Replacement Quantity
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={replacementQty}
                        onChange={e => setReplacementQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full text-xs p-2 border border-emerald-300 rounded font-mono font-bold"
                      />
                    </div>

                    {/* Selected replacement readblock */}
                    <div className="bg-white border rounded p-2 flex items-center justify-between border-emerald-350">
                      {selectedReplacement ? (
                        <div className="w-full flex justify-between items-center text-xs">
                          <div>
                            <span className="text-[8px] bg-emerald-100 uppercase text-emerald-800 px-1 font-bold">Resolved Exchange Code</span>
                            <strong className="block font-mono text-emerald-900 mt-0.5 text-sm">{selectedReplacement.part_number}</strong>
                            <span className="text-[10px] text-gray-400 uppercase font-medium">Rate: Rs. {selectedReplacement.sale_price.toFixed(0)}</span>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => setSelectedReplacement(null)}
                            className="text-sky-600 hover:underline hover:text-[#0ea5e9] text-[10px] uppercase font-bold"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-400 font-sans italic">No replacement product selected yet. Search code on left.</span>
                      )}
                    </div>

                  </div>

                </div>
              )}

              {/* REASON + NOTES (Always Shown) */}
              <div className="bg-slate-50 border p-4 rounded-lg space-y-4 shadow-xs">
                <div className="text-slate-700 font-extrabold text-xs uppercase border-b pb-1.5">
                  Reason & Audit Narrative
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Select reason */}
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-black text-slate-500">
                      Standard Return Reason <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      list="returns-common-reasons"
                      placeholder="e.g. Wrong filter specification"
                      value={returnReason}
                      onChange={e => setReturnReason(e.target.value)}
                      className="w-full text-xs p-2.5 border rounded font-semibold focus:border-sky-500"
                      required
                    />
                    <datalist id="returns-common-reasons">
                      <option value="Wrong filter model selected" />
                      <option value="Excess quantity ordered/supplied" />
                      <option value="Defective / Leakage issues" />
                      <option value="Customer changed mind / returned vehicle" />
                      <option value="Incompatible dimensions alternate" />
                    </datalist>
                  </div>

                  {/* Notes text area */}
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-black text-slate-500">
                      Internal Admin Notes (Optional)
                    </label>
                    <textarea
                      placeholder="Type additional parameters for audit trails..."
                      value={returnNotes}
                      onChange={e => setReturnNotes(e.target.value)}
                      className="w-full text-xs p-2.5 border rounded h-[42px] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Step navigation panel */}
              <div className="flex justify-between items-center pt-4 border-t">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-5 py-2 bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200"
                >
                  Back Step
                </button>

                <button
                  onClick={() => {
                    if (selectedType !== 'credit_note' && returnItems.length === 0) {
                      alert("Please check and select at least one item line to perform return.");
                      return;
                    }
                    if (!returnReason.trim()) {
                      alert("Standard Return Reason Statement is required to document invoice movements.");
                      return;
                    }
                    setCurrentStep(4);
                  }}
                  className="px-6 py-2 bg-[#0ea5e9] text-white font-extrabold text-xs uppercase tracking-wider rounded shadow hover:bg-sky-600"
                >
                  Confirm Summary & Preview
                </button>
              </div>

            </div>
          )}

          {/* -----------------------------------------------------------------
              STEP 4: SUMMARY & CONFIRM DEPOSIT TRANSACTION
              ----------------------------------------------------------------- */}
          {currentStep === 4 && selectedInvoice && selectedType && (
            <div className="space-y-4 animate-fadeIn" id="step-4-summary">
              
              <div className="bg-slate-50 border p-4 rounded-lg space-y-4 max-w-2xl mx-auto">
                <h3 className="text-sm font-black text-slate-900 border-b pb-2 uppercase tracking-tight text-center">
                  Review finalized Return Ledger changes
                </h3>

                {/* Return values info box */}
                <div className="grid grid-cols-2 gap-4 text-xs font-sans pb-4 border-b">
                  <div>
                    <span className="text-[9px] uppercase font-extrabold text-[#747070]">Original Invoice REF</span>
                    <p className="font-mono text-gray-950 font-bold block select-all mt-0.5">
                      {selectedInvoice.invoice_number}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase font-medium">Buyer: {selectedInvoice.customer_name}</p>
                  </div>

                  <div className="text-right">
                    <span className="text-[9px] uppercase font-extrabold text-[#747070]">Transaction Action Mode</span>
                    <p className="font-extrabold text-[#0ea5e9] uppercase block tracking-wider mt-0.5">
                      {selectedType}
                    </p>
                    <div className="text-[10px] text-slate-400 mt-1 uppercase font-mono">Date: {new Date().toLocaleDateString()}</div>
                  </div>
                </div>

                {/* Items Summarized list */}
                {selectedType !== 'credit_note' && (
                  <div className="space-y-2 pb-4 border-b">
                    <span className="text-[9px] uppercase font-extrabold text-gray-400">Items inside return slip ({returnItems.length})</span>
                    <div className="bg-white border rounded divide-y max-h-40 overflow-y-auto">
                      {returnItems.map(itm => (
                        <div key={itm.id} className="p-2.5 flex justify-between items-center text-xs">
                          <div>
                            <strong className="font-mono text-gray-800 text-[11.5px]">{itm.part_number}</strong>
                            <span className="text-gray-400 text-[10px] block uppercase font-medium">
                              Brand: {itm.brand} • Unit price: Rs. {itm.unit_price.toFixed(0)} • Return Condition: <span className="font-bold text-indigo-805 uppercase">{itm.condition}</span>
                            </span>
                          </div>
                          <div className="text-right font-mono">
                            <span className="font-bold text-gray-800">{itm.qty_returned} pcs</span>
                            <span className="text-amber-653 font-bold block">Rs. {itm.credit_amount.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Exchange dispatches summarized if exchange is active */}
                {selectedType === 'exchange' && selectedReplacement && (
                  <div className="p-3 bg-emerald-50 border border-emerald-250 rounded space-y-2 text-xs">
                    <span className="text-[9.5px] uppercase font-extrabold text-emerald-800 block">Dispatching replacement items (Exchange)</span>
                    <div className="flex justify-between items-center">
                      <div>
                        <strong className="font-mono text-emerald-900 block font-normal">{selectedReplacement.part_number}</strong>
                        <span className="text-[10px] text-gray-400 uppercase font-medium">Brand: {selectedReplacement.brand}</span>
                      </div>
                      <div className="text-right font-mono">
                        <strong className="text-emerald-900 text-sm block">{replacementQty} pcs</strong>
                        <span className="text-slate-400 text-[10px]">Value: Rs. {(selectedReplacement.sale_price * replacementQty).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-3 bg-white border rounded space-y-1.5 text-xs text-gray-700">
                  <div className="flex justify-between items-center py-1">
                    <span className="font-bold text-gray-500">Impacted unique lines:</span>
                    <span className="font-mono font-bold text-gray-900">{selectedType === 'credit_note' ? 'N/A' : returnItems.length} unique</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="font-bold text-gray-500">Gross returned units:</span>
                    <span className="font-mono font-bold text-gray-900">{selectedType === 'credit_note' ? 'N/A' : returnItems.reduce((acc, itm) => acc + itm.qty_returned, 0)} units</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-t border-dashed">
                    <span className="font-bold text-gray-500">Total Credit Adjustments:</span>
                    <span className="font-mono font-black text-amber-653 text-[15px]">Rs. {finalCreditAmount.toLocaleString()}</span>
                  </div>
                </div>

                {/* Audit Affirmation Checklist */}
                <div className="p-3 bg-[#FCFBFB] border border-dashed rounded-lg space-y-2 text-xs">
                  
                  {/* Rule 1: Original invoice never modified */}
                  <div className="flex items-start space-x-1.5 text-emerald-800">
                    <span className="font-bold">✓</span>
                    <span>Original invoice <strong>{selectedInvoice.invoice_number}</strong> will <strong>NOT</strong> be modified</span>
                  </div>

                  {/* Rule 2: Stock restored if resellable */}
                  {selectedType !== 'credit_note' && returnItems.some(itm => itm.condition === 'resellable') && (
                    <div className="flex items-start space-x-1.5 text-emerald-800">
                      <span className="font-bold">✓</span>
                      <span>Stock restored automatically for resellable items</span>
                    </div>
                  )}

                  {/* Rule 3: Supplier claim raised if defective/damaged */}
                  {selectedType !== 'credit_note' && hasDamagedOrClaim && (
                    <div className="flex items-start space-[#DD5000] text-[#B85C00]">
                      <span className="font-bold font-sans">⚠️</span>
                      <span className="font-semibold">Supplier claim will be raised for damaged items</span>
                    </div>
                  )}

                  {/* Accounts adjustment confirmation */}
                  {selectedInvoice.party_id && (
                    <div className="flex items-start space-x-1.5 text-blue-800 border-t pt-2 mt-2 border-dashed">
                      <span className="font-bold">ℹ️</span>
                      <span>Outstanding debit of customer <strong>{selectedInvoice.customer_name}</strong> will be reduced by <strong>Rs. {finalCreditAmount.toLocaleString()}</strong>.</span>
                    </div>
                  )}

                </div>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleProcessReturnSave}
                    disabled={isSaving}
                    className="w-full py-3 bg-[#0EA5E9] text-white font-extrabold text-xs uppercase tracking-wider rounded shadow hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Rebuilding Ledger logs...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>✓ Process Return — Rs. {finalCreditAmount.toLocaleString()} credit</span>
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => setCurrentStep(3)}
                    disabled={isSaving}
                    className="w-full py-2 bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 rounded"
                  >
                    Back to Setup Items
                  </button>
                </div>

              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
}
