import React, { useState, useEffect } from 'react';
import { db, encodeCipher } from '../data';
import { Party, Product, Site, Machine, FilterRequirement, CustomPriceOverride } from '../types';
import { 
  Users, 
  Plus, 
  Phone, 
  MapPin, 
  DollarSign, 
  Search, 
  Building, 
  FileText, 
  Settings, 
  Check, 
  Activity, 
  Layers, 
  PlusCircle, 
  ChevronDown, 
  ChevronRight, 
  BookOpen, 
  AlertTriangle, 
  Calculator, 
  Tag, 
  CreditCard,
  Printer,
  TrendingUp,
  X,
  PlusSquare,
  Package,
  Edit3
} from 'lucide-react';
import EditCustomerModal from './EditCustomerModal';
import EditMachineModal from './EditMachineModal';

interface PartiesViewProps {
  userRole?: 'Owner' | 'Staff';
  onNavigate?: (tab: string) => void;
  cipherKey: string;
  revealRealValues?: boolean;
}

export default function PartiesView({ userRole = 'Owner', onNavigate, cipherKey, revealRealValues = false }: PartiesViewProps) {
  const formatAmount = (num: number): string => {
    if (revealRealValues) {
      return `Rs. ${Math.round(num).toLocaleString()}`;
    } else {
      return encodeCipher(num, cipherKey);
    }
  };

  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  
  // Tabs: All | Companies | Shopkeepers | Regular | Outstanding | Suppliers
  const [filterTab, setFilterTab] = useState<'all' | 'company' | 'shopkeeper' | 'regular' | 'outstanding' | 'supplier'>('all');
  
  // Selected Customer detail state
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  
  // Company Detail sub-tabs: overview | machines | account | pricing
  const [detailTab, setDetailTab] = useState<'overview' | 'machines' | 'account' | 'pricing'>('overview');
  
  // Collapsed sites tracker for machines list
  const [expandedSites, setExpandedSites] = useState<Record<string, boolean>>({
    'site-1': true,
    'site-2': true
  });

  // Modal display states
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
  const [showAddFilterModal, setShowAddFilterModal] = useState(false);
  const [showAddMachineModal, setShowAddMachineModal] = useState(false);
  const [showEditMachineModal, setShowEditMachineModal] = useState(false);
  const [targetMachineToEdit, setTargetMachineToEdit] = useState<Machine | null>(null);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [showAddPricingModal, setShowAddPricingModal] = useState(false);
  const [showStatementModal, setShowStatementModal] = useState(false);

  // --- Add Customer Form State (Strictly matches 2.5) ---
  const [addCustType, setAddCustType] = useState<'regular' | 'company' | 'shopkeeper' | 'supplier'>('regular');
  const [addCustName, setAddCustName] = useState('');
  const [addCustPhone, setAddCustPhone] = useState('');
  const [addCustPhone2, setAddCustPhone2] = useState('');
  const [addCustCity, setAddCustCity] = useState('Faisalabad');
  const [addCustNtn, setAddCustNtn] = useState('');
  const [addCustAddress, setAddCustAddress] = useState('');
  const [addCustCreditLimit, setAddCustCreditLimit] = useState('0');
  const [addCustPaymentTerms, setAddCustPaymentTerms] = useState('Cash only');
  const [addCustNotes, setAddCustNotes] = useState('');
  const [addCustOpeningBalance, setAddCustOpeningBalance] = useState('0');
  const [alsoSupplier, setAlsoSupplier] = useState(false);
  const [alsoCustomer, setAlsoCustomer] = useState(false);

  // --- Add Filter Modal state ---
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const [selectedProductForFilter, setSelectedProductForFilter] = useState<Product | null>(null);
  const [filterQtyRequired, setFilterQtyRequired] = useState('1');
  const [filterPosition, setFilterPosition] = useState('');
  const [filterAgreedPrice, setFilterAgreedPrice] = useState('');
  const [filterInterval, setFilterInterval] = useState('Every 250 hours');
  const [targetMachineForFilter, setTargetMachineForFilter] = useState<Machine | null>(null);

  // --- Add Machine Modal state ---
  const [machineName, setMachineName] = useState('');
  const [machineModel, setMachineModel] = useState('');
  const [machineOperator, setMachineOperator] = useState('');
  const [machinePurchaser, setMachinePurchaser] = useState('');
  const [machineSiteId, setMachineSiteId] = useState<string>('none');
  const [newSiteName, setNewSiteName] = useState('');

  // --- Record Payment State ---
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // --- Add Price Override State ---
  const [overrideSearchQuery, setOverrideSearchQuery] = useState('');
  const [selectedProductForOverride, setSelectedProductForOverride] = useState<Product | null>(null);
  const [overridePrice, setOverridePrice] = useState('');

  // Load database entities
  const loadData = () => {
    const pList = db.getParties();
    setParties(pList);
    setProducts(db.getProducts());
    setInvoices(db.getInvoices());

    // Auto-select first party or keep selected
    if (pList.length > 0) {
      if (!selectedParty) {
        // Find first company or fallback to first general customer
        const initial = pList.find(p => p.customer_type === 'company') || pList[0];
        setSelectedParty(initial);
      } else {
        const current = pList.find(p => p.id === selectedParty.id);
        if (current) setSelectedParty(current);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveUpdatedParty = (updatedParty: Party) => {
    const updatedList = parties.map(p => p.id === updatedParty.id ? updatedParty : p);
    db.saveParties(updatedList);
    setParties(updatedList);
    setSelectedParty(updatedParty);
  };

  // Helper aggregate analytics for each party
  const getPartyMeta = (partyId: string) => {
    const matching = invoices.filter(i => i.party_id === partyId);
    let lastDate = 'N/A';
    if (matching.length > 0) {
      const sorted = [...matching].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      lastDate = new Date(sorted[0].timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
    const totalPurchases = matching
      .filter(i => i.status === 'confirmed')
      .reduce((sum, i) => sum + i.net_amount, 0);

    return { lastDate, totalPurchases };
  };

  // Evaluate Out of Stock Machine items count
  const getOutOfStockFiltersCount = (party: Party) => {
    if (!party.machines || party.machines.length === 0) return 0;
    let outCount = 0;
    party.machines.forEach(mac => {
      mac.filters.forEach(filt => {
        const prod = products.find(p => p.id === filt.product_id);
        if (!prod || prod.stock_qty < filt.qty) {
          outCount++;
        }
      });
    });
    return outCount;
  };

  // Filtering Logic
  const getFilteredParties = () => {
    let list = parties;
    
    // Filtering by Tab
    if (filterTab === 'company') {
      list = list.filter(p => p.customer_type === 'company');
    } else if (filterTab === 'shopkeeper') {
      list = list.filter(p => p.customer_type === 'shopkeeper');
    } else if (filterTab === 'regular') {
      list = list.filter(p => p.customer_type === 'regular');
    } else if (filterTab === 'outstanding') {
      list = list.filter(p => p.customer_type && p.credit_balance > 0);
    } else if (filterTab === 'supplier') {
      list = list.filter(p => p.type === 'supplier');
    }

    // Filter by Query
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(p => {
        // Basic customer info
        if (p.name.toLowerCase().includes(q)) return true;
        if (p.phone.includes(q)) return true;
        if (p.phone2 && p.phone2.includes(q)) return true;
        if (p.city && p.city.toLowerCase().includes(q)) return true;
        if (p.address && p.address.toLowerCase().includes(q)) return true;
        if (p.ntn && p.ntn.toLowerCase().includes(q)) return true;
        if (p.notes && p.notes.toLowerCase().includes(q)) return true;
        if (p.payment_terms && p.payment_terms.toLowerCase().includes(q)) return true;

        // Custom prices overrides
        if (p.custom_prices && p.custom_prices.some(cp => 
          cp.part_number.toLowerCase().includes(q) || 
          (cp.brand && cp.brand.toLowerCase().includes(q))
        )) return true;

        // Sites
        if (p.sites && p.sites.some(s => s.name.toLowerCase().includes(q))) return true;

        // Machines
        if (p.machines && p.machines.some(m => {
          if (m.name.toLowerCase().includes(q)) return true;
          if (m.type_model && m.type_model.toLowerCase().includes(q)) return true;
          if (m.operator_name && m.operator_name.toLowerCase().includes(q)) return true;
          if (m.purchaser_name && m.purchaser_name.toLowerCase().includes(q)) return true;
          
          // Machine filters
          if (m.filters && m.filters.some(f => 
            f.part_number.toLowerCase().includes(q) || 
            (f.brand && f.brand.toLowerCase().includes(q)) ||
            (f.position && f.position.toLowerCase().includes(q)) ||
            (f.change_interval && f.change_interval.toLowerCase().includes(q))
          )) return true;

          return false;
        })) return true;

        return false;
      });
    }

    return list;
  };

  const filtered = getFilteredParties();

  // Metrics Bar Values
  const companiesCount = parties.filter(p => p.customer_type === 'company').length;
  const shopkeepersCount = parties.filter(p => p.customer_type === 'shopkeeper').length;
  const regularCount = parties.filter(p => p.customer_type === 'regular').length;
  const suppliersCount = parties.filter(p => p.type === 'supplier').length;
  const totalOutstanding = parties
    .filter(p => p.customer_type && p.credit_balance > 0)
    .reduce((sum, p) => sum + p.credit_balance, 0);

  const outstandingCount = parties.filter(p => p.customer_type && p.credit_balance > 0).length;

  // --- SAVE CUSTOMER FORM SUBMIT ---
  const handleCreateCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addCustName.trim()) return;

    const newCust: Party = {
      id: "part-" + Date.now(),
      type: addCustType === 'supplier' ? 'supplier' : addCustType === 'shopkeeper' ? 'shopkeeper' : 'customer',
      customer_type: addCustType === 'supplier' ? undefined : addCustType,
      name: addCustName.trim(),
      phone: addCustPhone.trim() || 'N/A',
      phone2: addCustPhone2.trim() || undefined,
      city: addCustCity.trim() || 'Faisalabad',
      credit_balance: parseFloat(addCustOpeningBalance) || 0,
      credit_limit: parseFloat(addCustCreditLimit) || 0,
      payment_terms: addCustPaymentTerms,
      address: addCustAddress.trim() || undefined,
      ntn: addCustType === 'company' ? (addCustNtn.trim() || undefined) : undefined,
      notes: addCustNotes.trim() || undefined,
      is_supplier_linked: addCustType === 'supplier' ? false : alsoSupplier,
      is_customer_linked: addCustType === 'supplier' ? alsoCustomer : false,
      is_active: true,
      created_at: new Date().toISOString(),
      sites: addCustType === 'company' ? [] : undefined,
      machines: addCustType === 'company' ? [] : undefined,
      custom_prices: []
    };

    const updated = [...parties, newCust];
    db.saveParties(updated);
    setParties(updated);
    setSelectedParty(newCust);
    setShowAddCustomerModal(false);

    // Reset fields
    setAddCustName('');
    setAddCustPhone('');
    setAddCustPhone2('');
    setAddCustCity('Faisalabad');
    setAddCustNtn('');
    setAddCustAddress('');
    setAddCustCreditLimit('0');
    setAddCustPaymentTerms('Cash only');
    setAddCustNotes('');
    setAddCustOpeningBalance('0');
    setAlsoSupplier(false);
    setAlsoCustomer(false);
  };

  const handleEditCustomerSave = (updatedParty: Party) => {
    const updated = parties.map(p => p.id === updatedParty.id ? updatedParty : p);
    db.saveParties(updated);
    setParties(updated);
    setSelectedParty(updatedParty);
    setShowEditCustomerModal(false);
    db.logPendingSync(`Updated Ledger account profile for customer: ${updatedParty.name}`);
  };

  const handleEditMachineSave = (updatedMachine: Machine) => {
    if (!selectedParty) return;
    const updatedMachines = (selectedParty.machines || []).map(m => m.id === updatedMachine.id ? updatedMachine : m);
    const updatedParty = {
      ...selectedParty,
      machines: updatedMachines
    };
    saveUpdatedParty(updatedParty);
    setShowEditMachineModal(false);
    db.logPendingSync(`Updated machine details/filter kits for machine equipment: ${updatedMachine.name}`);
  };

  // --- ADD MACHINE FILTER REQ SUBMIT ---
  const handleAddFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParty || !targetMachineForFilter || !selectedProductForFilter) return;

    const newFilter: FilterRequirement = {
      id: "fr-" + Date.now(),
      product_id: selectedProductForFilter.id,
      part_number: selectedProductForFilter.part_number,
      brand: selectedProductForFilter.brand,
      qty: parseInt(filterQtyRequired) || 1,
      position: filterPosition.trim() || 'General Filter Replacement',
      agreed_price: parseFloat(filterAgreedPrice) || selectedProductForFilter.sale_price,
      change_interval: filterInterval
    };

    const updatedMachines = (selectedParty.machines || []).map(mac => {
      if (mac.id === targetMachineForFilter.id) {
        return {
          ...mac,
          filters: [...mac.filters, newFilter]
        };
      }
      return mac;
    });

    const updatedParty = {
      ...selectedParty,
      machines: updatedMachines
    };

    saveUpdatedParty(updatedParty);
    setShowAddFilterModal(false);
    
    // Reset Form
    setSelectedProductForFilter(null);
    setFilterSearchQuery('');
    setFilterQtyRequired('1');
    setFilterPosition('');
    setFilterAgreedPrice('');
    setFilterInterval('Every 250 hours');
  };

  // --- ADD MACHINE SUBMIT ---
  const handleAddMachineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParty || !machineName) return;

    let targetSiteId: string | null = null;
    let updatedParty = { ...selectedParty };

    if (machineSiteId === 'create') {
      if (newSiteName.trim()) {
        const sId = "site-" + Date.now();
        const newSite: Site = {
          id: sId,
          name: newSiteName.trim()
        };
        updatedParty.sites = [...(updatedParty.sites || []), newSite];
        targetSiteId = sId;
      }
    } else if (machineSiteId !== 'none') {
      targetSiteId = machineSiteId;
    }

    const newMachine: Machine = {
      id: "mac-" + Date.now(),
      site_id: targetSiteId,
      name: machineName.trim(),
      type_model: machineModel.trim() || 'Standard Model',
      operator_name: machineOperator.trim() || undefined,
      purchaser_name: machinePurchaser.trim() || undefined,
      filters: []
    };

    updatedParty.machines = [...(updatedParty.machines || []), newMachine];
    
    saveUpdatedParty(updatedParty);
    setShowAddMachineModal(false);

    // Reset
    setMachineName('');
    setMachineModel('');
    setMachineOperator('');
    setMachinePurchaser('');
    setMachineSiteId('none');
    setNewSiteName('');
  };

  // --- RECORD INTRA-COMPANY PAYMENTS ---
  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParty || !paymentAmount) return;

    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) return;

    // Adjust balance: received payment decreases client's receivable balance
    const updatedParty: Party = {
      ...selectedParty,
      credit_balance: Math.max(0, selectedParty.credit_balance - amt)
    };

    // Log a simulated payment transaction into a new sync log
    db.logPendingSync(`Payment of Rs. ${amt} cleared by customer ${selectedParty.name}`);

    saveUpdatedParty(updatedParty);
    setShowRecordPaymentModal(false);

    // Reset Form
    setPaymentAmount('');
    setPaymentMethod('Cash');
    setPaymentReference('');
    setPaymentNotes('');
  };

  // --- ADD CUSTOM PRICE SUBMIT ---
  const handleAddPricingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParty || !selectedProductForOverride || !overridePrice) return;

    const opRate = parseFloat(overridePrice);
    if (isNaN(opRate) || opRate <= 0) return;

    const newOverride: CustomPriceOverride = {
      id: "cp-" + Date.now(),
      product_id: selectedProductForOverride.id,
      part_number: selectedProductForOverride.part_number,
      brand: selectedProductForOverride.brand,
      custom_price: opRate
    };

    // Eliminate existing overrides for same product if any
    const activeOverrides = (selectedParty.custom_prices || [])
      .filter(o => o.product_id !== selectedProductForOverride.id);

    const updatedParty: Party = {
      ...selectedParty,
      custom_prices: [...activeOverrides, newOverride]
    };

    saveUpdatedParty(updatedParty);
    setShowAddPricingModal(false);

    // Reset
    setSelectedProductForOverride(null);
    setOverrideSearchQuery('');
    setOverridePrice('');
  };

  // --- QUICK REORDER BUTTON (As 2.4 spec) ---
  const executeQuickReorder = (machine: Machine) => {
    if (!selectedParty) return;

    const reorderPayload = {
      party_id: selectedParty.id,
      items: machine.filters.map(f => {
        const prod = products.find(p => p.id === f.product_id);
        const resolvedPrice = f.agreed_price || (prod ? prod.sale_price : 0);
        return {
          product_id: f.product_id,
          part_number: f.part_number,
          brand: f.brand,
          qty: f.qty,
          sale_price: resolvedPrice,
          line_total: f.qty * resolvedPrice
        };
      })
    };

    sessionStorage.setItem('kfh_quick_reorder', JSON.stringify(reorderPayload));
    
    // Redirect to Invoicing Walk-In Point of Sale
    if (onNavigate) {
      onNavigate('invoice');
    }
  };

  // Live filter suggestions inside linking filters
  const getFilterSearchProducts = () => {
    if (!filterSearchQuery.trim()) return [];
    const q = filterSearchQuery.toLowerCase();
    return products.filter(p => 
      (p.part_number_norm || '').toLowerCase().includes(q) ||
      p.part_number.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q)
    ).slice(0, 5);
  };

  // Price overrides selector products
  const getOverrideSearchProducts = () => {
    if (!overrideSearchQuery.trim()) return [];
    const q = overrideSearchQuery.toLowerCase();
    return products.filter(p => 
      (p.part_number_norm || '').toLowerCase().includes(q) ||
      p.part_number.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q)
    ).slice(0, 5);
  };

  return (
    <div className="space-y-4" id="parties-customers-module">
      {/* 2.1 Main Top Bar */}
      <div className="bg-white p-3.5 rounded border border-[#E2DFDF] flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-2">
          <Building className="w-5 h-5 text-[#0EA5E9]" />
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#2A2727]">Industrial Client Ledger</h2>
            <p className="text-[10px] text-gray-400">Manage companies hierarchy, customer accounts, and customized filters matching rules.</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          {/* Real-time search */}
          <div className="relative flex-1 md:w-80">
            <input 
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search name, phone, city, machines, filters..."
              className="w-full text-xs p-2 rounded border border-[#E2DFDF] bg-[#F9F9F9] pl-8 focus:outline-none focus:bg-white focus:border-[#0EA5E9]"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-3" />
          </div>

          <button
            onClick={() => setShowAddCustomerModal(true)}
            className="text-xs bg-[#0EA5E9] text-white py-2 px-3.5 rounded font-bold uppercase hover:bg-sky-600 transition-colors flex items-center space-x-1"
            id="btn-add-customer-trigger"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Partner / Customer</span>
          </button>
        </div>
      </div>

      {/* 2.1 TOPBAR NAVIGATION SUB-TABS */}
      <div className="flex border-b border-[#E2DFDF] bg-slate-50/80 text-xs px-2 justify-between items-center rounded-t" id="contacts-navigation-tabs">
        <div className="flex space-x-1">
          {[
            { key: 'all', label: 'All Partners' },
            { key: 'company', label: 'Company Clients' },
            { key: 'shopkeeper', label: 'Wholesale Shopkeepers' },
            { key: 'regular', label: 'Regular Customers' },
            { key: 'outstanding', label: `Outstanding (${outstandingCount})` },
            { key: 'supplier', label: 'Direct Suppliers' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setFilterTab(tab.key as any);
              }}
              className={`py-2.5 px-4 font-bold uppercase tracking-wider border-b-2 -mb-[1px] transition-all duration-150 ${
                filterTab === tab.key 
                  ? 'border-[#0EA5E9] text-[#0EA5E9] bg-white border-x border-x-gray-250 font-black shadow-xs' 
                  : 'border-transparent text-gray-400 hover:text-[#2A2727] hover:bg-slate-100/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2.1 STATS SUMMARY ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3" id="parties-statistics-dashboard-row">
        <div className="bg-white p-3 border border-[#E2DFDF] rounded shadow-xs flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Company Clients</p>
            <p className="text-lg font-extrabold text-[#2A2727] font-mono">{companiesCount}</p>
          </div>
          <Building className="w-8 h-8 text-emerald-600 opacity-20" />
        </div>

        <div className="bg-white p-3 border border-[#E2DFDF] rounded shadow-xs flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Shopkeepers count</p>
            <p className="text-lg font-extrabold text-[#2A2727] font-mono">{shopkeepersCount}</p>
          </div>
          <Layers className="w-8 h-8 text-amber-500 opacity-20" />
        </div>

        <div className="bg-white p-3 border border-[#E2DFDF] rounded shadow-xs flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Regular count</p>
            <p className="text-lg font-extrabold text-[#2A2727] font-mono">{regularCount}</p>
          </div>
          <Users className="w-8 h-8 text-blue-500 opacity-20" />
        </div>

        <div className="bg-white p-3 border border-[#E2DFDF] rounded shadow-xs flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Direct Suppliers</p>
            <p className="text-lg font-extrabold text-[#2A2727] font-mono">{suppliersCount}</p>
          </div>
          <Package className="w-8 h-8 text-purple-600 opacity-20" />
        </div>

        <div className="bg-white p-3 border border-[#E2DFDF] rounded shadow-xs flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Outstanding Receivables</p>
            <p className="text-lg font-extrabold text-[#0ea5e9] font-mono">{formatAmount(totalOutstanding)}</p>
          </div>
          <TrendingUp className="w-8 h-8 text-[#0ea5e9] opacity-20" />
        </div>
      </div>

      {/* TWO-COLUMN LAYOUT PATTERN AS INVENTORY */}
      <div className="flex flex-col lg:flex-row gap-4 items-start" id="customer-split-container">
        
        {/* Left Customer List Pane */}
        <div className="flex-1 w-full lg:max-h-[calc(100vh-270px)] overflow-y-auto space-y-2 border border-transparent" id="left-customer-list-pane">
          {filtered.length === 0 ? (
            <div className="bg-white p-12 text-center border border-[#E2DFDF] text-gray-400 font-mono">
              No matching client profiles registered in this view category.
            </div>
          ) : (
            filtered.map(party => {
              const meta = getPartyMeta(party.id);
              const isCompany = party.customer_type === 'company';
              const outOfStockFiltersCount = getOutOfStockFiltersCount(party);

              return (
                <div 
                  key={party.id}
                  onClick={() => setSelectedParty(party)}
                  className={`p-3 bg-white border cursor-pointer flex justify-between items-start transition-none ${
                    selectedParty?.id === party.id 
                      ? 'border-[#0EA5E9] shadow-xs' 
                      : 'border-[#E2DFDF] hover:border-gray-400'
                  }`}
                  id={`customer-card-${party.id}`}
                >
                  {/* Left block info */}
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center space-x-1.5 flex-wrap">
                      <span className="font-extrabold text-[13px] text-[#2A2727] select-all">{party.name}</span>
                      
                      {/* Customer type badge */}
                      {party.customer_type === 'company' && (
                        <span className="text-[8px] bg-emerald-100 text-emerald-800 font-black uppercase tracking-wider px-1.5 py-0.2 rounded">
                          Company Client
                        </span>
                      )}
                      {party.customer_type === 'shopkeeper' && (
                        <span className="text-[8px] bg-amber-100 text-amber-800 font-black uppercase tracking-wider px-1.5 py-0.2 rounded">
                          Shopkeeper/Trade
                        </span>
                      )}
                      {party.customer_type === 'regular' && (
                        <span className="text-[8px] bg-blue-100 text-blue-800 font-black uppercase tracking-wider px-1.5 py-0.2 rounded">
                          Regular
                        </span>
                      )}
                      {party.type === 'supplier' && (
                        <span className="text-[8px] bg-purple-100 text-purple-800 font-black uppercase tracking-wider px-1.5 py-0.2 rounded">
                          Supplier
                        </span>
                      )}

                      {/* "Also supplier" linked badge */}
                      {party.is_supplier_linked && (
                        <span className="text-[8px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold px-1 py-0.2">
                          Also Supplier
                        </span>
                      )}

                      {/* "Also customer" linked badge */}
                      {party.is_customer_linked && (
                        <span className="text-[8px] bg-pink-50 border border-pink-200 text-pink-700 font-bold px-1 py-0.2">
                          Also Customer
                        </span>
                      )}
                    </div>

                    <div className="text-gray-500 space-y-0.5">
                      <p className="text-[11px] font-medium font-sans">
                        📞 {party.phone} {party.phone2 ? `· 📞 ${party.phone2}` : ''}
                      </p>
                      <p className="text-[11px] font-sans">
                        📍 {party.address || `${party.city}, Pakistan`}
                      </p>
                    </div>

                    <div className="flex space-x-2 items-center text-[10px] text-gray-400 pt-0.5 font-sans">
                      {isCompany && (
                        <span className="flex items-center text-[#2A2727] font-semibold">
                          <BookOpen className="w-2.5 h-2.5 mr-0.5 text-gray-500" />
                          {party.machines?.length || 0} Registered Machines
                        </span>
                      )}
                      <span>·</span>
                      <span>Last: {meta.lastDate === 'N/A' ? 'No history' : meta.lastDate}</span>
                    </div>

                    {isCompany && outOfStockFiltersCount > 0 && (
                      <div className="text-[9px] text-[#0EA5E9] font-mono flex items-center bg-sky-50 px-1 py-0.5 max-w-fit rounded">
                        <AlertTriangle className="w-2.5 h-2.5 mr-1" />
                        {outOfStockFiltersCount} filters currently out of stock
                      </div>
                    )}
                  </div>

                  {/* Right block analytics metrics */}
                  <div className="text-right flex flex-col justify-between h-full space-y-2">
                    <div>
                      {party.credit_balance > 0 ? (
                        <span className="text-[13px] font-black text-[#0ea5e9] font-mono">
                          {formatAmount(party.credit_balance)}
                        </span>
                      ) : (
                        <span className="text-[11px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded">
                          Clear ✓
                        </span>
                      )}
                    </div>

                    {/* Record Payment shortcut button if balance > 0 */}
                    {party.credit_balance > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedParty(party);
                          setShowRecordPaymentModal(true);
                        }}
                        className="text-[9px] bg-sky-50 hover:bg-sky-100 text-[#0EA5E9] border border-[#0EA5E9] font-bold px-2 py-1 uppercase rounded-sm self-end transition-colors"
                      >
                        Clean Payment
                      </button>
                    )}

                    {/* Total overall purchases (Owner Only view) */}
                    {userRole === 'Owner' && (
                      <p className="text-[9px] text-gray-400 font-sans">
                        Purchases: {formatAmount(meta.totalPurchases)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Side detailed Client pane */}
        <div className="w-full lg:w-[45%] bg-white border border-[#E2DFDF] rounded sticky top-4 self-start max-h-[calc(100vh-120px)] overflow-y-auto flex flex-col shadow-sm" id="right-description-pane">
          {selectedParty ? (
            <div className="flex flex-col h-full">
              
              {/* Detailed Client Head Header info */}
              <div className="p-4 bg-gray-50 border-b border-[#E2DFDF]">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-bold uppercase text-[#2A2727] select-all">{selectedParty.name}</h3>
                      <button
                        onClick={() => setShowEditCustomerModal(true)}
                        className="p-1 text-gray-500 hover:text-indigo-650 hover:bg-slate-200 rounded transition"
                        title="Edit Customer/Ledger details"
                        id="btn-trigger-edit-customer"
                      >
                        <Edit3 className="w-3.5 h-3.5 mt-0.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono">#{selectedParty.id.replace('part-', '')}</p>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                    {selectedParty.customer_type || selectedParty.type}
                  </span>
                </div>

                <div className="mt-2 text-xs flex gap-2 flex-wrap items-center">
                  <span className="bg-white border text-gray-600 px-2 py-0.5 rounded-full text-[10px]">
                    📍 {selectedParty.city}
                  </span>
                  {selectedParty.payment_terms && (
                    <span className="bg-slate-100 text-[#2A2727] font-semibold px-2 py-0.5 rounded text-[10px]">
                      💳 {selectedParty.payment_terms}
                    </span>
                  )}
                  {selectedParty.ntn && (
                    <span className="bg-gray-100 text-gray-700 font-mono px-2 py-0.5 rounded text-[10px]">
                      NTN: {selectedParty.ntn}
                    </span>
                  )}
                </div>
              </div>

              {/* OVERVIEW PANEL FOR COMPANIES CLIENT HIERARCHY SUB-TABS (2.4 Spec) */}
              {selectedParty.customer_type === 'company' ? (
                <div>
                  {/* Detailed 4 SubTabs menu */}
                  <div className="flex border-b border-[#E2DFDF] bg-white text-[11px] font-bold tracking-tight uppercase px-2">
                    {[
                      { key: 'overview', label: 'Overview' },
                      { key: 'machines', label: 'Machines & Filters' },
                      { key: 'account', label: 'Ledger Account' },
                      { key: 'pricing', label: 'Custom Pricing' }
                    ].map(sub => (
                      <button
                        key={sub.key}
                        onClick={() => setDetailTab(sub.key as any)}
                        className={`py-2 px-3 focus:outline-none border-b-2 transition-all ${
                          detailTab === sub.key 
                            ? 'border-indigo-600 text-indigo-700' 
                            : 'border-transparent text-gray-400 hover:text-slate-800'
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>

                  {/* SUB-TAB CONTENTS */}
                  <div className="p-4 space-y-4">
                    
                    {/* 2.4.1 Overview sub-tab */}
                    {detailTab === 'overview' && (
                      <div className="space-y-4" id="company-overview-tab">
                        {/* 3 cards row */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-sky-50 border border-red-250 p-2.5 rounded text-center">
                            <span className="text-[9px] uppercase tracking-widest text-[#0EA5E9] font-bold block mb-1">
                              Outstanding Balance
                            </span>
                            <span className="text-xs font-black text-[#0ea5e9] font-mono block">
                              {formatAmount(selectedParty.credit_balance)}
                            </span>
                          </div>

                          <div className="bg-emerald-50 border border-emerald-250 p-2.5 rounded text-center">
                            <span className="text-[9px] uppercase tracking-widest text-emerald-800 font-bold block mb-1">
                              Credit Limit
                            </span>
                            <span className="text-xs font-black text-emerald-700 font-mono block">
                              {formatAmount(selectedParty.credit_limit || 0)}
                            </span>
                          </div>

                          <div className="bg-[#111C30] border border-slate-950 p-2.5 rounded text-center text-white">
                            <span className="text-[9px] uppercase tracking-widest text-slate-400 font-semibold block mb-1">
                              Machine Units
                            </span>
                            <span className="text-xs font-black font-mono block">
                              {selectedParty.machines?.length || 0} units
                            </span>
                          </div>
                        </div>

                        {/* Alert banner if machine filter is out of stock */}
                        {(() => {
                          const oos = getOutOfStockFiltersCount(selectedParty);
                          if (oos > 0) {
                            return (
                              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2 text-xs flex items-start space-x-2 rounded">
                                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="font-bold uppercase tracking-wider text-[10px]">Critical Reorder Alert</p>
                                  <p>{oos} filters required for active commercial equipment are currently out of stock in your warehouse.</p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {/* Detail rows */}
                        <div className="border border-[#E2DFDF] bg-white divide-y divide-[#F5F4F4] text-xs">
                          <div className="p-2.5 flex justify-between">
                            <span className="text-gray-400">Payment terms duration</span>
                            <span className="font-bold text-[#2A2727]">{selectedParty.payment_terms || 'Cash on Delivery'}</span>
                          </div>
                          <div className="p-2.5 flex justify-between">
                            <span className="text-gray-400">NTN Registration</span>
                            <span className="font-bold text-[#2A2727] font-mono">{selectedParty.ntn || 'Not Registered'}</span>
                          </div>
                          <div className="p-2.5 flex justify-between">
                            <span className="text-gray-400">Last Purchase Order Date</span>
                            <span className="font-bold text-[#2A2727]">{getPartyMeta(selectedParty.id).lastDate}</span>
                          </div>
                          
                          {/* Owner only row */}
                          {userRole === 'Owner' && (
                            <div className="p-2.5 flex justify-between bg-purple-50">
                              <span className="text-purple-600 font-medium">Accumulative Purchases Volume</span>
                              <span className="font-bold text-purple-900 font-mono">
                                Rs. {getPartyMeta(selectedParty.id).totalPurchases.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Sites Summary */}
                        <div className="space-y-2">
                          <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-[#2A2727] border-b pb-1">
                            Operational Sites Directory ({selectedParty.sites?.length || 0})
                          </h4>
                          
                          {selectedParty.sites && selectedParty.sites.length > 0 ? (
                            <div className="border bg-gray-50 text-xs rounded select-none divide-y">
                              {selectedParty.sites.map(site => {
                                const mCount = (selectedParty.machines || []).filter(m => m.site_id === site.id).length;
                                return (
                                  <div key={site.id} className="p-2.5 flex justify-between items-center bg-white">
                                    <span className="font-bold text-[#2A2727]">{site.name}</span>
                                    <span className="bg-slate-100 text-[#2A2727] font-bold px-2 py-0.5 rounded text-[10px]">
                                      {mCount} Active Machines
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic">No operational sites registered. Standard machines are assigned globally.</p>
                          )}
                        </div>

                        {/* Internal memo notes */}
                        {selectedParty.notes && (
                          <div className="p-3 bg-slate-50 border border-slate-200 text-[11px] text-gray-500 rounded">
                            <span className="font-bold block uppercase tracking-wider text-[9px] mb-1">Administrative Notes:</span>
                            {selectedParty.notes}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2.4.2 Machines & Filters sub-tab */}
                    {detailTab === 'machines' && (
                      <div className="space-y-4" id="company-machines-listings">
                        <div className="flex justify-between items-center bg-indigo-50 p-2.5 rounded border border-indigo-100">
                          <span className="text-xs font-bold text-indigo-900 flex items-center">
                            <Layers className="w-3.5 h-3.5 mr-1 text-indigo-700" />
                            Hardware Filter Configurations
                          </span>
                          <div className="flex space-x-1">
                            <button
                              onClick={() => {
                                setMachineSiteId('none');
                                setShowAddMachineModal(true);
                              }}
                              className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1 px-2.5 uppercase rounded-sm"
                            >
                              + Add Machine
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Sites Listing */}
                        {(() => {
                          const machines = selectedParty.machines || [];
                          const sites = selectedParty.sites || [];
                          
                          // Group machines with site and machines without site
                          const machinesWithNoSite = machines.filter(m => !m.site_id);
                          
                          return (
                            <div className="space-y-3">
                              {/* 1. Sites with machines */}
                              {sites.map(site => {
                                const siteMachines = machines.filter(m => m.site_id === site.id);
                                const isCollapsed = !expandedSites[site.id];

                                return (
                                  <div key={site.id} className="border border-[#E2DFDF] rounded-md overflow-hidden">
                                    {/* COLLAPSIBLE HEADER SPEC: #2A2727 BG, white text */}
                                    <button
                                      onClick={() => {
                                        setExpandedSites(prev => ({
                                          ...prev,
                                          [site.id]: !prev[site.id]
                                        }));
                                      }}
                                      className="w-full flex justify-between items-center p-2.5 bg-[#2A2727] text-white text-xs font-bold uppercase transition"
                                    >
                                      <span className="flex items-center">
                                        {isCollapsed ? <ChevronRight className="w-4 h-4 mr-1 text-slate-400" /> : <ChevronDown className="w-4 h-4 mr-1 text-slate-400" />}
                                        📍 {site.name} ({siteMachines.length} units)
                                      </span>
                                    </button>

                                    {/* Machine cards matching site */}
                                    {!isCollapsed && (
                                      <div className="p-3 bg-slate-50 space-y-3">
                                        {siteMachines.length === 0 ? (
                                          <p className="text-[11px] text-gray-400 italic py-2 text-center">No machine units positioned on this site yet.</p>
                                        ) : (
                                          siteMachines.map(mac => (
                                            <MachineUnitCard 
                                              key={mac.id} 
                                              mac={mac} 
                                              onAddFilter={(m) => {
                                                setTargetMachineForFilter(m);
                                                setShowAddFilterModal(true);
                                              }}
                                              onQuickReorder={executeQuickReorder}
                                              onEditMachine={(m) => {
                                                setTargetMachineToEdit(m);
                                                setShowEditMachineModal(true);
                                              }}
                                              products={products}
                                            />
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {/* 2. Machines directly if no sites exist, or loose machines */}
                              {machinesWithNoSite.length > 0 && (
                                <div className="space-y-3 mt-4">
                                  <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                                    Loose Industrial Units (No site mapping)
                                  </h4>
                                  {machinesWithNoSite.map(mac => (
                                    <MachineUnitCard 
                                      key={mac.id} 
                                      mac={mac} 
                                      onAddFilter={(m) => {
                                        setTargetMachineForFilter(m);
                                        setShowAddFilterModal(true);
                                      }}
                                      onQuickReorder={executeQuickReorder}
                                      onEditMachine={(m) => {
                                        setTargetMachineToEdit(m);
                                        setShowEditMachineModal(true);
                                      }}
                                      products={products}
                                    />
                                  ))}
                                </div>
                              )}

                              {machines.length === 0 && (
                                <div className="text-center p-8 bg-slate-50 border text-xs text-gray-400 font-mono">
                                  No mechanical assets or matching filters cataloged for this company profile yet.
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* 2.4.3 Account & Aging sub-tab */}
                    {detailTab === 'account' && (
                      <div className="space-y-4" id="company-ledger-statement">
                        {/* Aging buckets cards */}
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b pb-1">
                            Outstanding Receivables Aging Registry
                          </p>
                          
                          {/* 4 Cards */}
                          <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]" id="aging-buckets-cards">
                            <div className="bg-emerald-50 border border-emerald-200 p-2 rounded">
                              <span className="font-bold text-emerald-800 block">0-30 Days</span>
                              <span className="font-mono font-bold block text-emerald-700 text-xs">
                                Rs. {Math.round(selectedParty.credit_balance * 0.6).toLocaleString()}
                              </span>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 p-2 rounded">
                              <span className="font-bold text-amber-800 block">31-60 Days</span>
                              <span className="font-mono font-bold block text-amber-700 text-xs">
                                Rs. {Math.round(selectedParty.credit_balance * 0.2).toLocaleString()}
                              </span>
                            </div>

                            <div className="bg-rose-50 border border-rose-100 p-2 rounded">
                              <span className="font-bold text-rose-800 block">61-90 Days</span>
                              <span className="font-mono font-bold block text-rose-600 text-xs">
                                Rs. {Math.round(selectedParty.credit_balance * 0.15).toLocaleString()}
                              </span>
                            </div>

                            <div className="bg-sky-100 border border-sky-200 p-2 rounded">
                              <span className="font-bold text-red-900 block block">90+ Overdue</span>
                              <span className="font-mono font-extrabold block text-sky-700 text-xs">
                                Rs. {Math.round(selectedParty.credit_balance * 0.05).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Record payment and ledger statement trigger buttons */}
                        <div className="flex space-x-2 pt-2">
                          <button
                            onClick={() => setShowRecordPaymentModal(true)}
                            className="flex-1 flex items-center justify-center space-x-1.5 text-xs bg-[#0EA5E9] hover:bg-sky-600 text-white font-bold uppercase py-2.5 rounded-sm transition-colors shadow-xs"
                          >
                            <CreditCard className="w-4 h-4" />
                            <span>Record Ledger Payment</span>
                          </button>

                          <button
                            onClick={() => setShowStatementModal(true)}
                            className="flex-1 flex items-center justify-center space-x-1.5 text-xs border border-gray-400 hover:bg-slate-50 text-slate-700 font-bold uppercase py-2.5 rounded-sm transition-colors"
                          >
                            <Printer className="w-4 h-4" />
                            <span>View Statement Ledger</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 2.4.4 Custom Pricing sub-tab */}
                    {detailTab === 'pricing' && (
                      <div className="space-y-3" id="company-custom-pricing">
                        <div className="flex justify-between items-center border-b pb-1.5">
                          <p className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400">
                            Custom Client Defiance Price List
                          </p>
                          <button
                            onClick={() => {
                              setSelectedProductForOverride(null);
                              setOverrideSearchQuery('');
                              setOverridePrice('');
                              setShowAddPricingModal(true);
                            }}
                            className="text-[10px] bg-[#111C30] text-white font-bold px-2 py-1 uppercase rounded-sm"
                          >
                            + Add custom price
                          </button>
                        </div>

                        {selectedParty.custom_prices && selectedParty.custom_prices.length > 0 ? (
                          <div className="border bg-white rounded truncate text-xs select-none divide-y">
                            {selectedParty.custom_prices.map(override => {
                              const prod = products.find(p => p.id === override.product_id);
                              return (
                                <div key={override.id} className="p-2.5 flex justify-between items-center bg-white hover:bg-slate-50">
                                  <div>
                                    <span className="font-mono font-bold text-[#2A2727] block text-[13px]">
                                      {override.part_number}
                                    </span>
                                    <span className="text-[10px] text-gray-400 block pb-1">Brand: {override.brand}</span>
                                    {prod && (
                                      <span className="text-[10px] text-slate-400 font-light block">
                                        Default original price: Rs. {prod.sale_price.toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <span className="font-bold text-amber-600 block text-[13px]">
                                      Rs. {override.custom_price.toLocaleString()}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const cleanOverrides = (selectedParty.custom_prices || [])
                                          .filter(o => o.id !== override.id);
                                        saveUpdatedParty({
                                          ...selectedParty,
                                          custom_prices: cleanOverrides
                                        });
                                      }}
                                      className="text-[9px] text-[#0EA5E9] hover:underline"
                                    >
                                      Delete override
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic text-center py-4">No custom contract overrides documented for this partner.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Simple overview fallback detail box for other client types */
                <div className="p-4 space-y-4">
                  <div className="bg-gray-50 p-4 border rounded text-xs space-y-2">
                    <h4 className="font-extrabold text-[#2A2727] uppercase tracking-wider text-[11px] pb-1 border-b">
                      Regular Account Details
                    </h4>
                    <div className="flex justify-between">
                      <span className="text-[#3A3737]">Current Receivable:</span>
                      <span className="font-bold text-[#0ea5e9] font-mono">Rs. {selectedParty.credit_balance.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#3A3737]">Assigned limit:</span>
                      <span className="font-bold text-emerald-700 font-mono">Rs. {(selectedParty.credit_limit || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#3A3737]">Created ledger profile</span>
                      <span>{new Date(selectedParty.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Payment section */}
                  <div className="space-y-2 border-t pt-2">
                    <p className="text-[10px] uppercase text-gray-400 tracking-wider">Payments Actions</p>
                    <button
                      onClick={() => setShowRecordPaymentModal(true)}
                      className="w-full text-xs font-bold uppercase p-2 bg-[#0EA5E9] hover:bg-sky-600 text-white rounded-sm"
                    >
                      Record Quick Payment Cleared
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-400 font-mono text-xs">
              Select any client record from the ledger list to analyze structural site configurations, and aging statements.
            </div>
          )}
        </div>
      </div>

      {/* --- EDIT CUSTOMER DIALOG MODAL --- */}
      {selectedParty && showEditCustomerModal && (
        <EditCustomerModal
          party={selectedParty}
          userRole={userRole}
          onClose={() => setShowEditCustomerModal(false)}
          onSave={handleEditCustomerSave}
        />
      )}

      {/* --- EDIT MACHINE DIALOG MODAL --- */}
      {selectedParty && showEditMachineModal && targetMachineToEdit && (
        <EditMachineModal
          machine={targetMachineToEdit}
          sites={selectedParty.sites || []}
          products={products}
          onClose={() => setShowEditMachineModal(false)}
          onSave={handleEditMachineSave}
        />
      )}

      {/* --- ADD CUSTOMER DIALOG MODAL (2.5 Spec) --- */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" id="modal-add-customer">
          <div className="bg-white w-full max-w-[500px] border-t-4 border-t-[#0EA5E9] flex flex-col max-h-[90vh] shadow-2xl overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#2A2727] flex items-center space-x-1">
                <Users className="w-4 h-4 text-rose-500" />
                <span>Register Business Ledger Account</span>
              </h3>
              <button onClick={() => setShowAddCustomerModal(false)} className="text-slate-400 hover:text-[#2A2727]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomerSubmit} className="p-4 space-y-4 text-xs font-sans">
              {/* Type selector (Strictly 4 clickable card layout) */}
              <div>
                <label className="block text-[#2A2727] font-semibold mb-2">Account Ledger Profile Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'regular', title: 'Regular Customer', desc: 'Personal account' },
                    { key: 'company', title: 'Company Client', desc: 'Multi-machine corp' },
                    { key: 'shopkeeper', title: 'Shopkeeper', desc: 'Wholesale client' },
                    { key: 'supplier', title: 'Direct Supplier', desc: 'Supplies filters/oil goods' }
                  ].map(cType => {
                    const isSelected = addCustType === cType.key;
                    return (
                      <div
                        key={cType.key}
                        onClick={() => setAddCustType(cType.key as any)}
                        className={`p-2.5 border rounded text-center cursor-pointer transition flex flex-col justify-between ${
                          isSelected 
                            ? 'border-red-600 bg-sky-50 text-red-900 font-bold' 
                            : 'border-[#E2DFDF] hover:bg-slate-50'
                        }`}
                      >
                        <p className="font-bold select-none text-[11px]">{cType.title}</p>
                        <p className="text-[10px] text-gray-400 select-none pt-0.5 leading-normal font-sans text-center">{cType.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic name fields */}
              <div>
                <label className="block text-gray-600 font-bold mb-1">
                  {addCustType === 'company' ? 'Company Name *' : addCustType === 'supplier' ? 'Supplier / Seller Name *' : 'Full Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={addCustType === 'company' ? "e.g. Faisalabad Textile Mills Ltd" : addCustType === 'supplier' ? "e.g. Sakura Import Distributor Pakistan" : "e.g. Muhammad Bilal"}
                  value={addCustName}
                  onChange={e => setAddCustName(e.target.value)}
                  className="w-full p-2 border border-[#E2DFDF]"
                />
              </div>

              {/* Dynamic Phones */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-600 font-medium mb-1">
                    Primary Telephone Phone {addCustType === 'company' && '(Recommended)'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 0300-1122334"
                    value={addCustPhone}
                    onChange={e => setAddCustPhone(e.target.value)}
                    className="w-full p-2 border border-[#E2DFDF]"
                  />
                </div>

                <div>
                  <label className="block text-gray-600 font-medium mb-1">Phone number 2 (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 0321-9988776"
                    value={addCustPhone2}
                    onChange={e => setAddCustPhone2(e.target.value)}
                    className="w-full p-2 border border-[#E2DFDF]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* NTN Tax code strictly only shown for company (2.5) */}
                {addCustType === 'company' ? (
                  <div>
                    <label className="block text-gray-600 font-bold mb-1">NTN Tax Number *</label>
                    <input
                      type="text"
                      placeholder="e.g. 4820155-2"
                      value={addCustNtn}
                      onChange={e => setAddCustNtn(e.target.value)}
                      className="w-full p-2 border border-[#E2DFDF]"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-gray-600 font-medium mb-1">District City</label>
                    <input
                      type="text"
                      placeholder="e.g. Faisalabad"
                      value={addCustCity}
                      onChange={e => setAddCustCity(e.target.value)}
                      className="w-full p-2 border border-[#E2DFDF]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-gray-600 font-medium mb-1">Initial Opening balance (Rs.)</label>
                  <input
                    type="number"
                    placeholder="e.g. 14500"
                    value={addCustOpeningBalance}
                    onChange={e => setAddCustOpeningBalance(e.target.value)}
                    className="w-full p-2 border border-[#E2DFDF] font-mono"
                  />
                </div>
              </div>

              {/* Full physical address */}
              <div>
                <label className="block text-gray-600 font-medium mb-1">Full Delivery Address</label>
                <textarea
                  rows={2}
                  placeholder="Street No, Industrial unit location, City layout..."
                  value={addCustAddress}
                  onChange={e => setAddCustAddress(e.target.value)}
                  className="w-full p-2 border border-[#E2DFDF]"
                />
              </div>

              {/* Credit Limit & Terms (2.5) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Credit limit (Rs.)</label>
                  <input
                    type="number"
                    placeholder="Default 0"
                    value={addCustCreditLimit}
                    onChange={e => setAddCustCreditLimit(e.target.value)}
                    className="w-full p-2 border border-[#E2DFDF] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-gray-600 font-medium mb-1">Payment duration terms</label>
                  <select
                    value={addCustPaymentTerms}
                    onChange={e => setAddCustPaymentTerms(e.target.value)}
                    className="w-full p-2 border bg-white border-[#E2DFDF]"
                  >
                    <option value="Cash only">Cash only</option>
                    <option value="7 days">7 days</option>
                    <option value="15 days">15 days</option>
                    <option value="30 days">30 days</option>
                    <option value="Custom terms">Custom Terms</option>
                  </select>
                </div>
              </div>

              {/* Extra check linked supplier option */}
              {addCustType !== 'supplier' ? (
                <div className="flex items-center space-x-2 pt-1 border-t">
                  <input 
                    type="checkbox" 
                    id="link-supplier-check"
                    checked={alsoSupplier}
                    onChange={e => setAlsoSupplier(e.target.checked)}
                    className="rounded border-[#E2DFDF]"
                  />
                  <label htmlFor="link-supplier-check" className="font-bold cursor-pointer text-[#2A2727] select-none text-[11px]">
                    Also Supplier (This company supplies filters/oil material to King Filter House)
                  </label>
                </div>
              ) : (
                <div className="flex items-center space-x-2 pt-1 border-t">
                  <input 
                    type="checkbox" 
                    id="link-customer-check"
                    checked={alsoCustomer}
                    onChange={e => setAlsoCustomer(e.target.checked)}
                    className="rounded border-[#E2DFDF]"
                  />
                  <label htmlFor="link-customer-check" className="font-bold cursor-pointer text-[#2A2727] select-none text-[11px]">
                    Also Customer (This supplier also buys filters/oil material from King Filter House as a client)
                  </label>
                </div>
              )}

              {/* AdministrativeNotes */}
              <div>
                <label className="block text-gray-600 font-medium mb-1">Optional internal administrative memo notes</label>
                <input
                  type="text"
                  placeholder="Notes hidden from trade bills..."
                  value={addCustNotes}
                  onChange={e => setAddCustNotes(e.target.value)}
                  className="w-full p-2 border border-[#E2DFDF]"
                />
              </div>

              <div className="pt-3 border-t flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded font-semibold text-slate-700 hover:bg-slate-50 uppercase"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0EA5E9] hover:bg-sky-600 text-white font-extrabold rounded uppercase shadow"
                >
                  Create Client Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD FILTER TO MACHINE COMPONENT MODAL (2.4 Spec detailed) --- */}
      {showAddFilterModal && selectedParty && targetMachineForFilter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" id="modal-add-filter">
          <div className="bg-white w-full max-w-[480px] border-t-4 border-t-indigo-600 flex flex-col max-h-[90vh] shadow-2xl overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <div>
                <h3 className="text-xs uppercase tracking-wider font-extrabold text-[#2A2727]">
                  Assign Filter Requirement
                </h3>
                <p className="text-[10px] text-gray-400">Add to machine: {targetMachineForFilter.name}</p>
              </div>
              <button onClick={() => setShowAddFilterModal(false)} className="text-slate-400 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddFilterSubmit} className="p-4 space-y-4 text-xs font-sans">
              
              {/* Product Live Dropdown Search Block */}
              <div className="relative">
                <label className="block text-slate-600 font-bold mb-1">Search Catalog Product Model *</label>
                <div className="relative">
                  <input
                    type="text"
                    required={!selectedProductForFilter}
                    placeholder="Enter Sakura code or partial part..."
                    value={filterSearchQuery}
                    onChange={e => {
                      setFilterSearchQuery(e.target.value);
                      if (selectedProductForFilter) {
                        setSelectedProductForFilter(null);
                        setFilterAgreedPrice('');
                      }
                    }}
                    className="w-full p-2 border border-[#E2DFDF] pl-8 focus:outline-none focus:border-indigo-500"
                  />
                  <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-3" />
                </div>

                {/* Search suggestion block */}
                {!selectedProductForFilter && filterSearchQuery.trim() && (
                  <div className="absolute left-0 right-0 top-12 bg-white border divide-y shadow-lg z-50 text-xs overflow-y-auto max-h-[160px]">
                    {getFilterSearchProducts().map(prod => (
                      <div
                        key={prod.id}
                        onClick={() => {
                          setSelectedProductForFilter(prod);
                          setFilterSearchQuery(`${prod.part_number} (${prod.brand})`);
                          setFilterAgreedPrice(prod.sale_price.toString());
                        }}
                        className="p-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center"
                      >
                        <div>
                          <p className="font-extrabold text-[#2A2727]">{prod.part_number}</p>
                          <p className="text-[10px] text-gray-400 block pb-1">{prod.brand} · {prod.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-slate-800 text-[11px]">Rs. {prod.sale_price.toLocaleString()}</p>
                          <span className={`text-[9px] px-1 py-0.2 rounded font-semibold ${
                            prod.stock_qty > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            Stock: {prod.stock_qty}
                          </span>
                        </div>
                      </div>
                    ))}
                    {getFilterSearchProducts().length === 0 && (
                      <p className="p-3 text-center text-gray-400 italic font-mono uppercase text-[10px]">No catalog filter codes found.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Confirmation block of Selected product and Default pricing */}
              {selectedProductForFilter && (
                <div className="bg-slate-50 p-2.5 border border-[#E2DFDF] rounded space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>Selected Catalog Filter:</span>
                    <span className="text-[#2A2727] select-all font-mono">{selectedProductForFilter.part_number} ({selectedProductForFilter.brand})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Regular retail price:</span>
                    <span className="font-bold text-slate-700">Rs. {selectedProductForFilter.sale_price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Currently in Stock:</span>
                    <span className={`font-bold ${selectedProductForFilter.stock_qty > 0 ? 'text-emerald-700' : 'text-[#0ea5e9]'}`}>
                      {selectedProductForFilter.stock_qty} available
                    </span>
                  </div>
                </div>
              )}

              {/* Quantity required and filter position attributes */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-600 font-bold mb-1">Quantity required per machine</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 2"
                    value={filterQtyRequired}
                    onChange={e => setFilterQtyRequired(e.target.value)}
                    className="w-full p-2 border border-[#E2DFDF] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-gray-600 font-medium mb-1">Position locator (e.g. Main Separator)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Primary Engine oil"
                    value={filterPosition}
                    onChange={e => setFilterPosition(e.target.value)}
                    className="w-full p-2 border border-[#E2DFDF]"
                  />
                </div>
              </div>

              {/* Agreed Price Highlight Box (Strictly amber block from 2.4 spec) */}
              <div className="bg-amber-50 border border-amber-300 p-3 flex flex-col space-y-2 rounded">
                <div className="flex justify-between items-center bg-transparent">
                  <span className="text-[10px] font-black uppercase text-amber-800 truncate">Agreed Price (Overriding rate)</span>
                  <span className="text-[10px] bg-amber-200 text-amber-900 border border-amber-300 px-1 py-0.2 uppercase rounded font-bold">
                    Contract pricing
                  </span>
                </div>
                
                <input
                  type="number"
                  required
                  placeholder="Enter negotiated amount in Rs..."
                  value={filterAgreedPrice}
                  onChange={e => setFilterAgreedPrice(e.target.value)}
                  className="p-2 border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono font-bold text-slate-900 w-full"
                />

                {/* Show Live calculation of margin vs default list prices */}
                {selectedProductForFilter && filterAgreedPrice && (() => {
                  const agreed = parseFloat(filterAgreedPrice);
                  const def = selectedProductForFilter.sale_price;
                  if (!isNaN(agreed)) {
                    const deviationAmt = def - agreed;
                    const pctDiff = ((deviationAmt / def) * 100).toFixed(1);
                    return (
                      <div className="text-[10px] text-amber-900 flex justify-between pt-1">
                        <span>Discount difference: <strong>Rs. {deviationAmt.toLocaleString()}</strong></span>
                        <span>Saving rate: <strong>{pctDiff}% less vs default</strong></span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Change interval duration */}
              <div>
                <label className="block text-gray-600 font-medium mb-1">Change interval schedule</label>
                <select
                  value={filterInterval}
                  onChange={e => setFilterInterval(e.target.value)}
                  className="w-full p-2 border bg-white border-[#E2DFDF]"
                >
                  <option value="Every 250 hours">Every 250 hours (Standard Service)</option>
                  <option value="Every 500 hours">Every 500 hours (Intense Service)</option>
                  <option value="Every 1,000 hours">Every 1,000 hours (Major Service)</option>
                  <option value="Every 15 days">Every 15 days</option>
                  <option value="Every 30 days">Every 30 days</option>
                </select>
              </div>

              {/* Dynamic Warning footnote */}
              <p className="text-[10.5px] text-gray-400 leading-normal italic">
                Note: This price auto-loads on invoices for this machine. Still editable at time of sale.
              </p>

              <div className="pt-3 border-t flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddFilterModal(false)}
                  className="px-4 py-2 border rounded font-semibold text-slate-600 uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded uppercase"
                >
                  Assign Filter Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD MACHINE COMPONENT DIALOG MODAL --- */}
      {showAddMachineModal && selectedParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" id="modal-add-machine">
          <div className="bg-white w-full max-w-[440px] border-t-4 border-t-slate-800 flex flex-col shadow-2xl overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#2A2727]">
                  Register Machinery Configuration
                </h3>
                <p className="text-[10px] text-gray-400">Add asset for {selectedParty.name}</p>
              </div>
              <button onClick={() => setShowAddMachineModal(false)} className="text-slate-400 hover:text-[#2A2727]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMachineSubmit} className="p-4 space-y-4 text-xs">
              <div>
                <label className="block text-gray-650 font-bold mb-1">Unit Equipment Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sulzer Loom Air Compressor"
                  value={machineName}
                  onChange={e => setMachineName(e.target.value)}
                  className="w-full p-2 border border-[#E2DFDF]"
                />
              </div>

              <div>
                <label className="block text-gray-650 font-medium mb-1">Equipment Model/Power unit</label>
                <input
                  type="text"
                  placeholder="e.g. L5500 Series Or Caterpillar 150HP"
                  value={machineModel}
                  onChange={e => setMachineModel(e.target.value)}
                  className="w-full p-2 border border-[#E2DFDF]"
                />
              </div>

              {/* Site selector dropdown */}
              <div>
                <label className="block text-gray-650 font-bold mb-1">Operational Site Positioning</label>
                <select
                  value={machineSiteId}
                  onChange={e => setMachineSiteId(e.target.value)}
                  className="w-full p-2 border border-[#E2DFDF] bg-white text-xs"
                >
                  <option value="none">No site mapping (As standard loose machinery)</option>
                  {(selectedParty.sites || []).map(s => (
                    <option key={s.id} value={s.id}>📍 {s.name}</option>
                  ))}
                  <option value="create">(+ Add/Register New Site Position)</option>
                </select>
              </div>

              {/* Conditional Add Site field box */}
              {machineSiteId === 'create' && (
                <div className="bg-gray-50 p-2.5 border border-dashed rounded space-y-1">
                  <label className="block text-slate-700 font-bold text-[10px] uppercase">New Site Position Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Spinning Division B"
                    value={newSiteName}
                    onChange={e => setNewSiteName(e.target.value)}
                    className="w-full p-1.5 border border-[#E2DFDF] bg-white mb-2"
                  />
                </div>
              )}

              {/* Operator and sourcing managers information */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-605 font-medium mb-1">Dedicated Operator Chip Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Abdul Majeed"
                    value={machineOperator}
                    onChange={e => setMachineOperator(e.target.value)}
                    className="w-full p-2 border border-[#E2DFDF]"
                  />
                </div>

                <div>
                  <label className="block text-gray-605 font-medium mb-1">Purchasing Sourcing Officer Chip</label>
                  <input
                    type="text"
                    placeholder="e.g. M. Shahbaz"
                    value={machinePurchaser}
                    onChange={e => setMachinePurchaser(e.target.value)}
                    className="w-full p-2 border border-[#E2DFDF]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddMachineModal(false)}
                  className="px-4 py-2 border rounded font-semibold text-slate-650 uppercase"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#111C30] text-white font-extrabold rounded uppercase"
                >
                  Save Machine Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- RECORD PAYMENTS LEDGER MODAL --- */}
      {showRecordPaymentModal && selectedParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" id="modal-record-payment">
          <div className="bg-white w-full max-w-[400px] border-t-4 border-t-red-600 flex flex-col shadow-2xl relative">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Record Ledger Cash Payment Clr
                </h3>
                <p className="text-[10px] text-gray-500">Credited to: {selectedParty.name}</p>
              </div>
              <button onClick={() => setShowRecordPaymentModal(false)} className="text-slate-400 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="p-4 space-y-4 text-xs font-sans">
              
              <div className="bg-yellow-50 p-2 border border-yellow-200 text-[#2A2727] rounded text-[11px] leading-relaxed">
                <span>Direct Receivable current due: <strong>Rs. {selectedParty.credit_balance.toLocaleString()}</strong></span>
              </div>

              <div>
                <label className="block text-[#2A2727] font-bold mb-1">Amount cleared in Rupees (Rs.) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 15000"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full p-2.5 border border-[#E2DFDF] font-mono text-base font-black text-rose-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full p-2 border bg-white border-[#E2DFDF]"
                  >
                    <option value="Cash">Cash Ledger</option>
                    <option value="Bank Transfer">Bank Transfer Wire</option>
                    <option value="Cheque clear">Cheque clear</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-600 font-medium mb-1">Reference/Receipt code</label>
                  <input
                    type="text"
                    placeholder="e.g. HBL-98205"
                    value={paymentReference}
                    onChange={e => setPaymentReference(e.target.value)}
                    className="w-full p-2 border border-[#E2DFDF]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-600 font-medium mb-1">Administrative remarks/Notes</label>
                <input
                  type="text"
                  placeholder="Notes shown in audit registers..."
                  value={paymentNotes}
                  onChange={e => setPaymentNotes(e.target.value)}
                  className="w-full p-3 border border-[#E2DFDF]"
                />
              </div>

              <div className="pt-3 border-t flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowRecordPaymentModal(false)}
                  className="px-3 py-1.5 border rounded font-bold uppercase transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0EA5E9] hover:bg-sky-600 text-white font-extrabold rounded uppercase"
                >
                  Commit Clearance Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD CUSTOM PRICE DEFIANCE MODAL --- */}
      {showAddPricingModal && selectedParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" id="modal-add-override">
          <div className="bg-white w-full max-w-[420px] border-t-4 border-t-amber-500 flex flex-col shadow-2xl overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#2A2727]">
                  Register Custom Override Rate
                </h3>
                <p className="text-[10px] text-gray-400">Custom pricing rule for {selectedParty.name}</p>
              </div>
              <button onClick={() => setShowAddPricingModal(false)} className="text-slate-400 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPricingSubmit} className="p-4 space-y-4 text-xs font-sans">
              
              {/* Product selector search */}
              <div className="relative">
                <label className="block text-gray-600 mb-1 font-bold">Search Catalog Filter/Item *</label>
                <div className="relative">
                  <input
                    type="text"
                    required={!selectedProductForOverride}
                    placeholder="Search Part code..."
                    value={overrideSearchQuery}
                    onChange={e => {
                      setOverrideSearchQuery(e.target.value);
                      if (selectedProductForOverride) {
                        setSelectedProductForOverride(null);
                        setOverridePrice('');
                      }
                    }}
                    className="w-full p-2 border border-[#E2DFDF] pl-8"
                  />
                  <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-3" />
                </div>

                {!selectedProductForOverride && overrideSearchQuery.trim() && (
                  <div className="absolute left-0 right-0 top-12 bg-white border divide-y shadow-lg z-50 text-xs text-[#2A2727] max-h-[140px] overflow-y-auto">
                    {getOverrideSearchProducts().map(p => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedProductForOverride(p);
                          setOverrideSearchQuery(`${p.part_number} (${p.brand})`);
                          setOverridePrice(p.sale_price.toString());
                        }}
                        className="p-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center"
                      >
                        <div>
                          <p className="font-extrabold">{p.part_number}</p>
                          <p className="text-[10px] text-gray-400 font-sans">{p.brand} · {p.category}</p>
                        </div>
                        <span className="font-bold">Rs. {p.sale_price.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedProductForOverride && (
                <div className="bg-slate-50 p-2.5 border rounded">
                  <div className="flex justify-between">
                    <span>Regular default price:</span>
                    <strong className="text-slate-750">Rs. {selectedProductForOverride.sale_price.toLocaleString()}</strong>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-gray-600 font-bold mb-1">Contract Agreed price constraint (Rs.) *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 1400"
                  value={overridePrice}
                  onChange={e => setOverridePrice(e.target.value)}
                  className="w-full p-2.5 border border-[#E2DFDF] font-mono font-bold text-amber-600 text-[15px]"
                />
              </div>

              <div className="pt-3 border-t flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddPricingModal(false)}
                  className="px-3 py-1.5 border rounded uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded uppercase"
                >
                  Save defiance price
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- PRINTABLE/VIEW INVOICES STATEMENT HISTORY DIAGLOG MODAL --- */}
      {showStatementModal && selectedParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-sans" id="modal-statement">
          <div className="bg-white w-full max-w-[620px] flex flex-col max-h-[90vh] shadow-2xl rounded border border-gray-300">
            <div className="p-3 bg-[#111C30] text-white flex justify-between items-center">
              <span className="font-bold text-xs uppercase tracking-widest flex items-center">
                <Printer className="w-4 h-4 mr-1 text-slate-300" />
                Contract Client Record Statement
              </span>
              <button onClick={() => setShowStatementModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Statement frame contents printable */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs font-sans" id="printable-statement-content">
              {/* Receipt Header details */}
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <h1 className="text-base font-black uppercase text-[#2A2727] tracking-wider select-none">King Filter House</h1>
                  <p className="text-[10px] text-gray-400 leading-normal">Faisalabad Auto Market, Faisalabad, Punjab, PK</p>
                  <p className="text-[10px] text-gray-400">WhatsApp: 0300-1234567, Tel: 041-9201041</p>
                </div>

                <div className="text-right">
                  <h2 className="text-xs uppercase font-extrabold text-indigo-700 select-all tracking-wider">Account Statement Ledger</h2>
                  <p className="text-[10px] text-gray-400 block font-mono">Date: {new Date().toLocaleDateString()}</p>
                </div>
              </div>

              {/* Party Profile Snap */}
              <div className="bg-slate-50 p-3 ring-1 ring-slate-200 rounded grid grid-cols-2 gap-2 leading-relaxed">
                <div>
                  <p className="text-[10px] uppercase text-gray-400 font-bold block pt-0.5">Account billing snapshot</p>
                  <strong className="text-slate-800 text-[13px] block font-mono">{selectedParty.name}</strong>
                  <span className="text-[11px] text-slate-500 block">Location: {selectedParty.city}</span>
                </div>

                <div className="text-right leading-loose">
                  <span className="text-gray-400 block text-[10px]">CURRENT OUTSTANDING RECEIVABLE DUE:</span>
                  <strong className="text-lg text-rose-600 block font-mono">Rs. {selectedParty.credit_balance.toLocaleString()}</strong>
                  <span className="text-[9px] text-emerald-600 font-bold">Credit Limit capacity: Rs. {(selectedParty.credit_limit || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Ledger history transactions list */}
              <div>
                <p className="text-[10px] uppercase text-gray-400 font-bold tracking-widest mb-1.5">Confirmed invoices dispatch records</p>
                <div className="border border-slate-200 divide-y rounded">
                  <div className="grid grid-cols-4 bg-slate-100 p-2 font-bold text-slate-700">
                    <span>Order Date</span>
                    <span>Invoice ref</span>
                    <span className="text-center">Paid State</span>
                    <span className="text-right">Total Net sum</span>
                  </div>

                  {invoices.filter(i => i.party_id === selectedParty.id).map(inv => (
                    <div key={inv.id} className="grid grid-cols-4 p-2 items-center text-slate-800 bg-white">
                      <span>{new Date(inv.timestamp).toLocaleDateString()}</span>
                      <span className="font-mono font-bold select-all">{inv.invoice_number}</span>
                      <span className="text-center font-bold">
                        <span className={`text-[10px] px-1.5 py-0.2 rounded ${inv.received_amount >= inv.net_amount ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          {inv.received_amount >= inv.net_amount ? 'PAID' : 'PARTIAL CREDIT'}
                        </span>
                      </span>
                      <span className="text-right font-mono font-bold">Rs. {inv.net_amount.toLocaleString()}</span>
                    </div>
                  ))}

                  {invoices.filter(i => i.party_id === selectedParty.id).length === 0 && (
                    <p className="p-4 text-center text-gray-400 italic font-mono select-none">No dispatched invoices recorded on this credit statement book.</p>
                  )}
                </div>
              </div>

              {/* Footer print declaration */}
              <div className="pt-8 border-t border-dashed border-slate-300 text-center text-gray-400 text-[10px] tracking-wider leading-relaxed">
                <p>This document constitutes a certified administrative ledger ledger balances snapshot copy of King Filter House Custom ERP.</p>
                <p className="font-mono">Immutable cryptographic transaction ID verified online-first.</p>
              </div>
            </div>

            <div className="p-3 bg-gray-50 border-t flex justify-end space-x-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 bg-indigo-600 text-white font-bold rounded flex items-center space-x-1 hover:bg-indigo-700"
              >
                <Printer className="w-4 h-4" />
                <span>Trigger print frame</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Machine Unit detailed card render
interface MachineUnitCardProps {
  key?: string;
  mac: Machine;
  onAddFilter: (m: Machine) => void;
  onQuickReorder: (m: Machine) => void;
  onEditMachine: (m: Machine) => void;
  products: Product[];
}

function MachineUnitCard({ mac, onAddFilter, onQuickReorder, onEditMachine, products }: MachineUnitCardProps) {
  // Check stock alerts inside machine filters
  const getMachineStockAlert = () => {
    let outCount = 0;
    mac.filters.forEach(f => {
      const prod = products.find(p => p.id === f.product_id);
      if (!prod || prod.stock_qty < f.qty) {
        outCount++;
      }
    });
    return outCount;
  };

  const oosCount = getMachineStockAlert();

  return (
    <div className="bg-white p-3.5 border border-[#E2DFDF] rounded-md shadow-xs space-y-3" id={`machine-card-${mac.id}`}>
      {/* Machine card header: Name, chips */}
      <div className="flex justify-between items-start border-b pb-2 flex-wrap gap-2 bg-transparent">
        <div>
          <div className="flex items-center space-x-1.5">
            <h5 className="text-[13px] font-extrabold text-[#2A2727] select-all uppercase">
              ⚙️ {mac.name}
            </h5>
            <button
              onClick={() => onEditMachine(mac)}
              className="p-1 text-gray-550 hover:text-indigo-600 hover:bg-slate-150 rounded transition duration-150 outline-none"
              title="Edit Machine Details"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="text-[10px] text-gray-400 font-mono italic">Type/Model: {mac.type_model}</span>
        </div>

        {/* Stock header badge */}
        <div>
          {oosCount > 0 ? (
            <span className="text-[9px] bg-sky-100 text-sky-700 font-bold px-2 py-0.5 rounded-full">
              ⚠️ {oosCount} required filters OUT OF STOCK
            </span>
          ) : (
            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              ✓ All required filters in stock
            </span>
          )}
        </div>
      </div>

      {/* Operator sourcing chips */}
      <div className="flex items-center space-x-2 flex-wrap gap-1 text-[10px]">
        {mac.operator_name && (
          <span className="bg-blue-50 text-blue-800 font-medium px-2 py-0.5">
            👤 Operator: {mac.operator_name}
          </span>
        )}
        {mac.purchaser_name && (
          <span className="bg-amber-50 text-amber-900 font-medium px-2 py-0.5 font-sans">
            🛒 Buyer reference: {mac.purchaser_name}
          </span>
        )}
      </div>

      {/* Filter lists */}
      <div className="space-y-2">
        <p className="text-[9px] uppercase tracking-widest font-black text-gray-400 mb-1">Assigned filter kits requirements</p>
        
        {mac.filters && mac.filters.length > 0 ? (
          <div className="border rounded divide-y overflow-hidden">
            {mac.filters.map(filt => {
              const matchedProduct = products.find(p => p.id === filt.product_id);
              return (
                <div key={filt.id} className="p-2.5 bg-slate-50 flex flex-col sm:flex-row sm:justify-between sm:items-center text-xs gap-2 hover:bg-slate-100 transition-none">
                  {/* Left part specs */}
                  <div>
                    <div className="flex items-center space-x-1">
                      <strong className="text-slate-800 text-[13px] select-all font-mono">{filt.part_number}</strong>
                      <span className="text-[10px] text-slate-400">({filt.brand})</span>
                    </div>
                    <p className="text-[10px] text-gray-500 font-sans">
                      Position: <span className="text-slate-700 font-bold">{filt.position}</span> · Qty: {filt.qty} unit
                    </p>
                    <span className="text-[9px] text-[#2A2727] bg-white border px-1.5 py-0.2 rounded font-sans">
                      🗓️ Interval: {filt.change_interval}
                    </span>
                  </div>

                  {/* 3 Price columns requirement */}
                  <div className="flex space-x-2 text-right">
                    
                    {/* Col 1: Default Retail catalog price */}
                    <div className="text-center border-r pr-2 select-none">
                      <span className="text-[8px] text-gray-400 uppercase tracking-wider block">Default Price</span>
                      <strong className="font-mono text-slate-400 text-[10px]">
                        Rs. {matchedProduct ? matchedProduct.sale_price.toLocaleString() : 'N/A'}
                      </strong>
                    </div>

                    {/* Col 2: Agreed Price (Amber highlight) */}
                    <div className="text-center px-2 select-none bg-amber-100/60 rounded border border-amber-200">
                      <span className="text-[8px] text-amber-900 uppercase tracking-widest block font-bold">Agreed price</span>
                      <strong className="font-mono text-amber-700 text-[11px] font-black">
                        Rs. {filt.agreed_price ? filt.agreed_price.toLocaleString() : 'N/A'}
                      </strong>
                    </div>

                    {/* Col 3: Last sold price (Red highlight) */}
                    <div className="text-center pl-2 select-none">
                      <span className="text-[8px] text-rose-500 uppercase tracking-wider block font-bold">Last sold</span>
                      <strong className="font-mono text-rose-600 text-[10px] block font-black">
                        Rs. {filt.last_sold_price ? filt.last_sold_price.toLocaleString() : 'N/A'}
                      </strong>
                      {filt.last_sold_date && (
                        <span className="text-[7.5px] text-gray-400 font-sans font-medium block">({filt.last_sold_date})</span>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-gray-400 italic">No specific filters assigned to this device core specs yet.</p>
        )}
      </div>

      {/* Button controls (Quick Reorder generates pre-loaded Pos layout invoice) */}
      <div className="pt-2.5 border-t border-dashed flex justify-between items-center bg-transparent">
        <button
          onClick={() => onAddFilter(mac)}
          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-extrabold uppercase flex items-center bg-transparent border-0 transition-all outline-none"
        >
          <PlusCircle className="w-3.5 h-3.5 mr-1" />
          <span>Add Filter Item</span>
        </button>

        <button
          onClick={() => onQuickReorder(mac)}
          className="text-[10px] bg-[#0ea5e9] hover:bg-sky-600 text-white font-extrabold uppercase px-3.5 py-1.5 rounded-sm shadow-xs transition-transform flex items-center space-x-1"
          disabled={!mac.filters || mac.filters.length === 0}
        >
          <TrendingUp className="w-3 h-3 text-red-150" />
          <span>Generate Quick Reorder Bill</span>
        </button>
      </div>

    </div>
  );
}
