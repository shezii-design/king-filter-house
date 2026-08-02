import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db, normalizeCode, encodeCipher } from '../data';
import { Product, CrossReference, Invoice, InvoiceItem, Party, Return } from '../types';
import { generateInvoicePDF } from '../utils/pdfGenerator';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Check, 
  Printer, 
  AlertTriangle, 
  Info, 
  FileText, 
  ArrowRight,
  User,
  Link2,
  Calendar,
  X,
  CreditCard,
  CheckCircle2,
  Coins,
  Building,
  RefreshCw,
  Share2,
  Download,
  Undo2
} from 'lucide-react';

interface InvoiceViewProps {
  userRole: 'Owner' | 'Staff';
  onInvoiceCreated: () => void;
  cipherKey: string;
  revealRealValues?: boolean;
}

export default function InvoiceView({ userRole, onInvoiceCreated, cipherKey, revealRealValues = false }: InvoiceViewProps) {
  const formatAmount = (num: number): string => {
    if (revealRealValues) {
      return `Rs. ${Math.round(num).toLocaleString()}`;
    } else {
      return encodeCipher(num, cipherKey);
    }
  };

  // Navigation & View State
  // 'list' -> Show Invoice list, stats and tabs
  // 'new' -> Full page invoicing P.O.S terminal screen
  // 'success' -> Full page beautiful checkout complete slip
  const [viewState, setViewState] = useState<'list' | 'new' | 'success'>('list');
  const [lastCreatedInvoice, setLastCreatedInvoice] = useState<Invoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Raw Database States
  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [crossRefs, setCrossRefs] = useState<CrossReference[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  
  // Tab configuration
  type TabType = 'all' | 'unpaid' | 'partial' | 'paid' | 'today';
  const [activeTab, setActiveTab] = useState<TabType>('all');

  // New Invoice - Form Selection State
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null); // null means not selected yet
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  // Walk-In Manual input toggle
  const [showWalkInForm, setShowWalkInForm] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');

  // Invoice Items & Pricing States
  const [cart, setCart] = useState<InvoiceItem[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Discover & Save modal states
  const [showDiscoverModal, setShowDiscoverModal] = useState(false);

  // Batch Machine Invoicing States
  const [showMachineInvoicingModal, setShowMachineInvoicingModal] = useState(false);
  const [selectedMachineIds, setSelectedMachineIds] = useState<string[]>([]);
  const [modalCartItems, setModalCartItems] = useState<any[]>([]);
  const [unknownCode, setUnknownCode] = useState('');
  const [discoverSearchQuery, setDiscoverSearchQuery] = useState('');
  const [selectedMatchProduct, setSelectedMatchProduct] = useState<Product | null>(null);
  const [discoverBrand, setDiscoverBrand] = useState('Generic');
  const [discoverMatchType, setDiscoverMatchType] = useState<'exact_match' | 'compatible'>('exact_match');

  // Payment Setup States
  type PayMethod = 'cash' | 'credit' | 'partial' | 'bank' | 'cheque';
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>('cash');
  const [partialAmountPaid, setPartialAmountPaid] = useState<string>('');
  const [bankTransRef, setBankTransRef] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeBankName, setChequeBankName] = useState('');

  // FBR GST & NTN Support States
  const [isTaxInvoice, setIsTaxInvoice] = useState(false);
  const [taxRate, setTaxRate] = useState(18); // standard 18% PK Sales Tax
  const [customNtn, setCustomNtn] = useState('');

  // Align NTN and default Sales Tax based on Customer Profile
  useEffect(() => {
    if (selectedPartyId && selectedPartyId !== 'walk-in') {
      const party = parties.find(p => p.id === selectedPartyId);
      if (party) {
        setCustomNtn(party.ntn || '');
        if (party.type === 'company' || party.customer_type === 'company') {
          setIsTaxInvoice(true);
        } else {
          setIsTaxInvoice(false);
        }
      }
    } else {
      setCustomNtn('');
      setIsTaxInvoice(false);
    }
  }, [selectedPartyId, parties]);

  // UI Focus control
  const productSearchRef = useRef<HTMLInputElement>(null);

  // Reload local state variables from database storage
  const reloadData = () => {
    setParties(db.getParties());
    setProducts(db.getProducts());
    setCrossRefs(db.getCrossRefs());
    setInvoices(db.getInvoices());
    setReturns(db.getReturns());
  };

  useEffect(() => {
    reloadData();

    // Key event listener for Ctrl+F to focus product code search
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        const inp = document.getElementById('invoice-product-search-input');
        if (inp) {
          e.preventDefault();
          inp.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Check if there is a pending quick reorder in sessionStorage
    const pendingReorder = sessionStorage.getItem('kfh_quick_reorder');
    if (pendingReorder) {
      try {
        const payload = JSON.parse(pendingReorder);
        if (payload.party_id) {
          setSelectedPartyId(payload.party_id);
          setViewState('new');
        }
        if (payload.items && Array.isArray(payload.items)) {
          const reorderedCart: InvoiceItem[] = payload.items.map((it: any) => ({
            id: "line-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
            product_id: it.product_id,
            part_number: it.part_number,
            brand: it.brand,
            sale_price: it.sale_price,
            qty: it.qty,
            line_total: it.line_total
          }));
          setCart(reorderedCart);
        }
        sessionStorage.removeItem('kfh_quick_reorder');
      } catch (err) {
        console.error("Error loading quick reorder details: ", err);
      }
    }

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Quick auto-add product from the global top-bar quick search
  useEffect(() => {
    const handleCheckAutoAdd = () => {
      const autoAddId = localStorage.getItem('kfh_pos_auto_add_product_id');
      if (autoAddId) {
        localStorage.removeItem('kfh_pos_auto_add_product_id');
        const allProducts = db.getProducts();
        const p = allProducts.find(prod => prod.id === autoAddId);
        if (p) {
          setViewState('new');
          
          setCart(prevCart => {
            const existingIndex = prevCart.findIndex(item => item.product_id === p.id);
            if (existingIndex >= 0) {
              const updated = [...prevCart];
              const existing = updated[existingIndex];
              const nextQty = existing.qty + 1;
              existing.qty = nextQty;
              const discPercent = (existing as any).discount_percent || 0;
              existing.line_total = nextQty * existing.sale_price * (1 - discPercent / 100);
              return updated;
            } else {
              let loadedPrice = p.sale_price;
              if (selectedPartyId && selectedPartyId !== 'walk-in') {
                const lastSoldInfo = getCustomerLastSoldPrice(selectedPartyId, p.id);
                if (lastSoldInfo) {
                  loadedPrice = lastSoldInfo.price;
                }
              }
              
              const newItem: InvoiceItem = {
                id: "line-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
                product_id: p.id,
                part_number: p.part_number,
                brand: p.brand,
                sale_price: loadedPrice,
                qty: 1,
                line_total: loadedPrice
              };
              (newItem as any).discount_percent = 0;
              (newItem as any).original_default_price = p.sale_price;
              return [...prevCart, newItem];
            }
          });
        }
      }
    };

    // run once immediately on view/state match or change
    handleCheckAutoAdd();

    // Listen on localstorage updates or active navigation events
    window.addEventListener('storage', handleCheckAutoAdd);
    return () => window.removeEventListener('storage', handleCheckAutoAdd);
  }, [viewState, selectedPartyId]);

  const handleWhatsAppShare = (inv: Invoice) => {
    const stored = localStorage.getItem('kfh_shop_info');
    const parsed = stored ? JSON.parse(stored) : null;
    const sName = (parsed?.name || 'King Filter House FSD').trim();

    const listLines = inv.items.map(i => `${i.part_number} (${i.brand}) x ${i.qty} = Rs. ${i.line_total.toLocaleString()}`).join('%0A');
    const introText = `*${sName.toUpperCase()} - SALES INVOICE %23${inv.invoice_number}*%0A%0A`;
    const customer = `Customer: ${inv.customer_name}%0A`;
    const dateStr = `Date Issued: ${new Date(inv.timestamp).toLocaleDateString()}%0A`;
    const paymentStr = `Payment Method: ${inv.payment_method?.toUpperCase()} (${inv.payment_status?.toUpperCase()})%0A%0A`;
    const goods = `*Line Items:*%0A${listLines}%0A%0A`;
    const summary = `*Grand Total: Rs. ${inv.net_amount.toLocaleString()}*%0A`;
    const received = `Amount Received: Rs. ${inv.received_amount.toLocaleString()}%5A`;
    const balance = inv.net_amount - inv.received_amount > 0 
      ? `*Remaining Deferred Balance: Rs. ${(inv.net_amount - inv.received_amount).toLocaleString()}*%0A` 
      : '';
    const footer = `%0A_Thank you for your business! ${sName}._%0A`;
    
    const fulUrl = `https://api.whatsapp.com/send?text=${introText}${customer}${dateStr}${paymentStr}${goods}${summary}${received}${balance}${footer}`;
    window.open(fulUrl, '_blank');
  };

  // Check if a timestamp is of today
  const isDateToday = (dateStr: string) => {
    const invoiceDate = new Date(dateStr);
    const today = new Date();
    return invoiceDate.getDate() === today.getDate() &&
      invoiceDate.getMonth() === today.getMonth() &&
      invoiceDate.getFullYear() === today.getFullYear();
  };

  // Pricing Helpers
  // Loads last price if sold to this variant before, returns {price, date, invoice_number}
  const getCustomerLastSoldPrice = (partyId: string | null, productId: string) => {
    if (!partyId || partyId === 'walk-in') return null;
    
    // Sort recent first
    const sorted = [...invoices].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    for (const inv of sorted) {
      if (inv.party_id === partyId) {
        const item = inv.items.find(it => it.product_id === productId);
        if (item) {
          return {
            price: item.sale_price,
            date: new Date(inv.timestamp).toLocaleDateString(),
            invoice_number: inv.invoice_number
          };
        }
      }
    }
    
    // Fallback: Check custom_prices list inside party ledger definition
    const party = parties.find(p => p.id === partyId);
    if (party && party.custom_prices) {
      const customPriceMatch = party.custom_prices.find(cp => cp.product_id === productId);
      if (customPriceMatch) {
         return {
           price: customPriceMatch.custom_price,
           date: 'Pre-agreed profile rate',
           invoice_number: 'Custom Agreement'
         };
      }
    }
    return null;
  };

  // -----------------------------------------------------
  // SEARCH CANDIDATES FOR MAIN SALE PRODUCT ENTRY
  // -----------------------------------------------------
  const getProductSearchResults = () => {
    if (!productSearchQuery.trim()) return [];
    const qNorm = normalizeCode(productSearchQuery);

    const candidates = products.map(p => {
      let score = 99; // Lower score = better ranking priority
      let matchTypeBadge = '';
      let matchedCode = '';

      const pNorm = p.part_number_norm || normalizeCode(p.part_number || '');
      if (pNorm === qNorm) {
        score = p.stock_qty > 0 ? 1 : 5; // Rank 1: Direct in stock, Rank 5: Out of stock
        matchTypeBadge = 'Direct Exact';
      } else if (pNorm.includes(qNorm)) {
        score = p.stock_qty > 0 ? 2 : 5; // Rank 2: Partial in stock
        matchTypeBadge = 'Direct Partial';
      } else {
        // Evaluate Cross Reference replacements
        const links = crossRefs.filter(ref => ref.product_id_1 === p.id || ref.product_id_2 === p.id);
        for (const link of links) {
          if (link.product_id_2 === null && link.external_part_number) {
            const extNorm = normalizeCode(link.external_part_number);
            if (extNorm === qNorm || extNorm.includes(qNorm)) {
              matchedCode = `${link.external_part_number} (${link.external_brand || 'External'})`;
              if (link.match_type === 'exact_match') {
                score = p.stock_qty > 0 ? 3 : 5; // Rank 3: Exact substitute cross-ref
                matchTypeBadge = 'Exact Substitute';
              } else {
                score = p.stock_qty > 0 ? 4 : 5; // Rank 4: Compatible substitute cross-ref
                matchTypeBadge = 'Compatible Alternate';
              }
              break;
            }
          } else {
            const otherId = link.product_id_1 === p.id ? link.product_id_2 : link.product_id_1;
            const otherProd = products.find(op => op.id === otherId);
            const otherNorm = otherProd ? (otherProd.part_number_norm || normalizeCode(otherProd.part_number || '')) : '';
            if (otherProd && (otherNorm === qNorm || otherNorm.includes(qNorm))) {
              matchedCode = otherProd.part_number;
              if (link.match_type === 'exact_match') {
                score = p.stock_qty > 0 ? 3 : 5; // Rank 3: Exact substitute cross-ref
                matchTypeBadge = 'Exact Substitute';
              } else {
                score = p.stock_qty > 0 ? 4 : 5; // Rank 4: Compatible substitute cross-ref
                matchTypeBadge = 'Compatible Alternate';
              }
              break;
            }
          }
        }
      }

      // Check auto-loaded price history
      const lastSoldInfo = getCustomerLastSoldPrice(selectedPartyId, p.id);
      const isOverride = lastSoldInfo !== null;
      const loadedPrice = lastSoldInfo ? lastSoldInfo.price : p.sale_price;

      return { 
        product: p, 
        score, 
        matchTypeBadge, 
        matchedCode, 
        isOverride, 
        loadedPrice,
        originalPrice: p.sale_price 
      };
    }).filter(c => c.score < 99);

    // Sort scoring priorities
    return candidates.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return b.product.stock_qty - a.product.stock_qty;
    });
  };

  const productSearchResults = useMemo(
    () => getProductSearchResults(),
    [productSearchQuery, products, crossRefs, invoices, selectedPartyId]
  );

  // Add Item Click
  const handleAddProductToCart = (cand: typeof productSearchResults[0]) => {
    const prod = cand.product;
    const isCrossRef = cand.score === 3 || cand.score === 4;

    const existingIndex = cart.findIndex(item => item.product_id === prod.id);
    if (existingIndex >= 0) {
      const updated = [...cart];
      const existing = updated[existingIndex];
      const nextQty = existing.qty + 1;
      existing.qty = nextQty;
      // Re-calculate with local line discount if exists
      const discPercent = (existing as any).discount_percent || 0;
      existing.line_total = nextQty * existing.sale_price * (1 - discPercent / 100);
      setCart(updated);
    } else {
      const newItem: InvoiceItem = {
        id: "line-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
        product_id: prod.id,
        part_number: prod.part_number,
        brand: prod.brand,
        sale_price: cand.loadedPrice, // automatically loads last price
        qty: 1,
        line_total: cand.loadedPrice,
        searched_code: isCrossRef ? productSearchQuery.toUpperCase() : undefined,
        match_type: isCrossRef ? (cand.score === 3 ? 'exact_match' : 'compatible') : undefined,
        matched_code: isCrossRef ? cand.matchedCode : undefined
      };
      // attach custom optional discount attribute in object
      (newItem as any).discount_percent = 0;
      (newItem as any).original_default_price = cand.originalPrice; // saved for change color warning indicator
      setCart([...cart, newItem]);
    }

    setProductSearchQuery('');
    setShowProductDropdown(false);
    
    // Return focus to lookup box automatically for speed of entry
    if (productSearchRef.current) {
      productSearchRef.current.focus();
    }
  };

  // Keyboard shortcut - Enter adds first item
  const handleProductSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (productSearchResults.length > 0) {
        e.preventDefault();
        handleAddProductToCart(productSearchResults[0]);
      }
    }
  };

  // Item modifications in local state
  const handleRemoveFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const handleUpdateLinePrice = (id: string, newPrice: number) => {
    if (isNaN(newPrice) || newPrice < 0) return;
    setCart(cart.map(item => {
      if (item.id === id) {
        const discPercent = (item as any).discount_percent || 0;
        return {
          ...item,
          sale_price: newPrice,
          line_total: item.qty * newPrice * (1 - discPercent / 100)
        };
      }
      return item;
    }));
  };

  const handleUpdateLinePartNumber = (id: string, newPart: string) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        return {
          ...item,
          part_number: newPart
        };
      }
      return item;
    }));
  };

  const handleUpdateLineQty = (id: string, newQty: number) => {
    if (newQty < 1) return;
    setCart(cart.map(item => {
      if (item.id === id) {
        const discPercent = (item as any).discount_percent || 0;
        return {
          ...item,
          qty: newQty,
          line_total: newQty * item.sale_price * (1 - discPercent / 100)
        };
      }
      return item;
    }));
  };

  const handleUpdateLineDiscount = (id: string, percent: number) => {
    if (isNaN(percent) || percent < 0 || percent > 100) return;
    setCart(cart.map(item => {
      if (item.id === id) {
        return {
          ...item,
          discount_percent: percent,
          line_total: item.qty * item.sale_price * (1 - percent / 100)
        } as any;
      }
      return item;
    }));
  };

  // -----------------------------------------------------
  // CALCULATIONS
  // -----------------------------------------------------
  const totalSubtotal = cart.reduce((acc, item) => acc + (item.sale_price * item.qty), 0);
  const totalDiscount = cart.reduce((acc, item) => {
    const discPercent = (item as any).discount_percent || 0;
    return acc + (item.sale_price * item.qty * (discPercent / 100));
  }, 0);
  const baseNetInvoiceTotal = Math.max(0, totalSubtotal - totalDiscount);
  const taxAmount = isTaxInvoice ? Math.round(baseNetInvoiceTotal * (taxRate / 100)) : 0;
  const netInvoiceTotal = baseNetInvoiceTotal + taxAmount;

  // Derive cash/unpaid balance targets
  const getLiveBalanceDue = () => {
    if (paymentMethod === 'cash' || paymentMethod === 'bank' || paymentMethod === 'cheque') {
      return 0; // assumed fully cleared
    }
    if (paymentMethod === 'credit') {
      return netInvoiceTotal; // receivable full balance
    }
    if (paymentMethod === 'partial') {
      const paidNum = parseFloat(partialAmountPaid);
      if (isNaN(paidNum) || paidNum <= 0) return netInvoiceTotal;
      return Math.max(0, netInvoiceTotal - paidNum);
    }
    return 0;
  };

  const getLivePaidAmount = () => {
    if (paymentMethod === 'cash' || paymentMethod === 'bank' || paymentMethod === 'cheque') {
      return netInvoiceTotal;
    }
    if (paymentMethod === 'credit') {
      return 0;
    }
    if (paymentMethod === 'partial') {
      const paid = parseFloat(partialAmountPaid);
      return isNaN(paid) ? 0 : paid;
    }
    return 0;
  };

  // Find active buyer client
  const activeClient = useMemo(() => {
    if (!selectedPartyId || selectedPartyId === 'walk-in') return null;
    return parties.find(p => p.id === selectedPartyId) || null;
  }, [selectedPartyId, parties]);

  const getAggregatedMachineItems = (machineIds: string[]) => {
    if (!activeClient || !activeClient.machines) return [];
    
    const selectedMachines = activeClient.machines.filter(m => machineIds.includes(m.id));
    
    const map = new Map<string, {
      product_id: string;
      part_number: string;
      brand: string;
      qty: number;
      sale_price: number;
      original_default_price: number;
      machine_names: string[];
      checked: boolean;
    }>();
    
    selectedMachines.forEach(m => {
      m.filters.forEach(f => {
        const prod = products.find(p => p.id === f.product_id);
        const defaultPrice = prod ? prod.sale_price : 0;
        const agreedPrice = f.agreed_price || defaultPrice;
        
        const existing = map.get(f.product_id);
        if (existing) {
          existing.qty += f.qty;
          if (!existing.machine_names.includes(m.name)) {
            existing.machine_names.push(m.name);
          }
        } else {
          map.set(f.product_id, {
            product_id: f.product_id,
            part_number: f.part_number,
            brand: f.brand,
            qty: f.qty,
            sale_price: agreedPrice,
            original_default_price: defaultPrice,
            machine_names: [m.name],
            checked: true
          });
        }
      });
    });
    
    return Array.from(map.values());
  };

  useEffect(() => {
    if (showMachineInvoicingModal && activeClient) {
      const items = getAggregatedMachineItems(selectedMachineIds);
      setModalCartItems(items);
    }
  }, [showMachineInvoicingModal, selectedMachineIds, activeClient, products]);

  const handleUpdateModalItemQty = (prodId: string, newQty: number) => {
    if (newQty < 1) return;
    setModalCartItems(prev => prev.map(item => {
      if (item.product_id === prodId) {
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const handleUpdateModalItemPrice = (prodId: string, newPrice: number) => {
    if (isNaN(newPrice) || newPrice < 0) return;
    setModalCartItems(prev => prev.map(item => {
      if (item.product_id === prodId) {
        return { ...item, sale_price: newPrice };
      }
      return item;
    }));
  };

  const handleToggleModalItem = (prodId: string) => {
    setModalCartItems(prev => prev.map(item => {
      if (item.product_id === prodId) {
        return { ...item, checked: !item.checked };
      }
      return item;
    }));
  };

  const handleLoadModalItemsToCart = () => {
    const checkedItems = modalCartItems.filter(item => item.checked);
    if (checkedItems.length === 0) {
      alert("No items selected to load.");
      return;
    }
    
    const updatedCart = [...cart];
    checkedItems.forEach(modalItem => {
      const existingIdx = updatedCart.findIndex(item => item.product_id === modalItem.product_id);
      if (existingIdx >= 0) {
        updatedCart[existingIdx].qty += modalItem.qty;
        updatedCart[existingIdx].sale_price = modalItem.sale_price;
        const discPercent = (updatedCart[existingIdx] as any).discount_percent || 0;
        updatedCart[existingIdx].line_total = updatedCart[existingIdx].qty * modalItem.sale_price * (1 - discPercent / 100);
      } else {
        const newItem: InvoiceItem = {
          id: "line-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
          product_id: modalItem.product_id,
          part_number: modalItem.part_number,
          brand: modalItem.brand,
          sale_price: modalItem.sale_price,
          qty: modalItem.qty,
          line_total: modalItem.qty * modalItem.sale_price,
          searched_code: undefined,
          match_type: undefined,
          matched_code: undefined
        };
        (newItem as any).discount_percent = 0;
        (newItem as any).original_default_price = modalItem.original_default_price;
        (newItem as any).machine_names = modalItem.machine_names;
        updatedCart.push(newItem);
      }
    });
    
    setCart(updatedCart);
    setShowMachineInvoicingModal(false);
  };

  // -----------------------------------------------------
  // SAVE / CONFIRM BILL TRANSACTIONS
  // -----------------------------------------------------
  const handleConfirmInvoicingBill = () => {
    if (cart.length === 0) return;
    setIsSaving(true);

    // Mock quick spinner saving delay for premium ERP feedback feel
    setTimeout(() => {
      try {
        const rawInvoices = db.getInvoices();
        const invoiceNum = `KFH-${new Date().getFullYear()}-${String(rawInvoices.length + 1).padStart(4, '0')}`;
        const invoiceId = "inv-" + Date.now();

        // Resolve customer name
        let resolvedCustomerName = 'Walk-In Customer';
        if (selectedPartyId === 'walk-in') {
          resolvedCustomerName = walkInName.trim() || 'Cash Walk-In';
        } else {
          const matchParty = parties.find(p => p.id === selectedPartyId);
          if (matchParty) resolvedCustomerName = matchParty.name;
        }

        const paidVal = getLivePaidAmount();
        const balDue = getLiveBalanceDue();

        const finalizedInvoice: Invoice = {
          id: invoiceId,
          invoice_number: invoiceNum,
          party_id: selectedPartyId === 'walk-in' ? null : selectedPartyId,
          customer_name: resolvedCustomerName,
          items: cart,
          total_amount: totalSubtotal,
          discount: totalDiscount,
          net_amount: netInvoiceTotal,
          received_amount: paidVal,
          status: 'confirmed',
          user: userRole,
          timestamp: new Date().toISOString(),
          is_active: true,
          
          payment_method: paymentMethod,
          cheque_number: paymentMethod === 'cheque' ? chequeNumber : undefined,
          bank_name: paymentMethod === 'cheque' ? chequeBankName : undefined,
          transaction_ref: paymentMethod === 'bank' ? bankTransRef : undefined,
          payment_status: paidVal >= netInvoiceTotal ? 'paid' : (paidVal > 0 ? 'partial' : 'unpaid'),
          is_tax_invoice: isTaxInvoice,
          tax_amount: taxAmount,
          tax_rate: isTaxInvoice ? taxRate : undefined,
          ntn_number: isTaxInvoice ? customNtn.trim() : undefined
        };

        // Mutate and deduct Stock Inventories matching lines
        const allProductsList = db.getAllProductsWithDeleted();
        cart.forEach(cartLine => {
          const pIdx = allProductsList.findIndex(p => p.id === cartLine.product_id);
          if (pIdx >= 0) {
            const currentStock = allProductsList[pIdx].stock_qty;
            allProductsList[pIdx].stock_qty = Math.max(0, currentStock - cartLine.qty);

            // Log stock movement audit book
            db.saveMovement({
              product_id: cartLine.product_id,
              qty_change: -cartLine.qty,
              from_status: 'sellable',
              to_status: 'none',
              type: 'sold',
              user: userRole,
              reason: `Issued via invoice ${invoiceNum}`
            });
          }
        });
        db.saveProducts(allProductsList);

        // Update Client Accounts ledger balance A/R
        if (selectedPartyId && selectedPartyId !== 'walk-in') {
          const allPartiesList = db.getParties();
          const pIdx = allPartiesList.findIndex(p => p.id === selectedPartyId);
          if (pIdx >= 0) {
            // Adds unpaid value to Pakistan debit client ledger accounts receivable balance
            allPartiesList[pIdx].credit_balance += balDue;
            db.saveParties(allPartiesList);
          }
        }

        // Save Invoice transaction to DB
        db.saveInvoice(finalizedInvoice);

        // Reset inputs & direct to Success Complete Screen
        setLastCreatedInvoice(finalizedInvoice);
        setCart([]);
        setSelectedPartyId(null);
        setCustomerSearchQuery('');
        setProductSearchQuery('');
        setPaymentMethod('cash');
        setPartialAmountPaid('');
        setBankTransRef('');
        setChequeNumber('');
        setChequeBankName('');
        setWalkInName('');
        setWalkInPhone('');
        setShowWalkInForm(false);

        // Reload data
        reloadData();
        onInvoiceCreated();
        
        // Show success screen
        setViewState('success');
      } catch (e: any) {
        alert("Encountered error while saving bill: " + e.message);
      } finally {
        setIsSaving(false);
      }
    }, 550);
  };

  // -----------------------------------------------------
  // CLIENT SELECTION / ON-THE-FLY WALK-IN CREATION
  // -----------------------------------------------------
  const handleSelectCustomerTextResult = (party: Party) => {
    setSelectedPartyId(party.id);
    setCustomerSearchQuery('');
    setShowCustomerDropdown(false);
  };

  const handleWalkInProceedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = walkInName.trim();
    const cleanPhone = walkInPhone.trim();

    if (!cleanName && !cleanPhone) {
      // Proceed anonymous Walk-In
      setSelectedPartyId('walk-in');
      setShowWalkInForm(false);
      return;
    }

    const matched = parties.find(p => 
      (cleanName && p.name.toLowerCase() === cleanName.toLowerCase()) || 
      (cleanPhone && p.phone === cleanPhone)
    );

    if (matched) {
      setSelectedPartyId(matched.id);
      setShowWalkInForm(false);
    } else {
      // Create regular client profile instantly
      const newParty: Party = {
        id: "part-" + Date.now(),
        type: 'customer',
        customer_type: 'regular',
        name: cleanName || 'Cash Walk-In',
        phone: cleanPhone || 'N/A',
        city: 'Faisalabad',
        credit_balance: 0,
        is_active: true,
        created_at: new Date().toISOString()
      };
      const updatedList = [...parties, newParty];
      db.saveParties(updatedList);
      setParties(updatedList);
      setSelectedPartyId(newParty.id);
      db.logPendingSync(`On-The-Fly client registered: ${newParty.name}`);
      setShowWalkInForm(false);
    }
  };

  // -----------------------------------------------------
  // FILTERED INVOICES FOR LIST DISPLAY
  // -----------------------------------------------------
  const getFilteredInvoices = () => {
    let list = [...invoices].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    if (activeTab === 'unpaid') {
      return list.filter(inv => inv.payment_status === 'unpaid' || (inv.received_amount === 0 && inv.net_amount > 0));
    }
    if (activeTab === 'partial') {
      return list.filter(inv => inv.payment_status === 'partial' || (inv.received_amount > 0 && inv.received_amount < inv.net_amount));
    }
    if (activeTab === 'paid') {
      return list.filter(inv => inv.payment_status === 'paid' || (inv.received_amount >= inv.net_amount || inv.net_amount === 0));
    }
    if (activeTab === 'today') {
      return list.filter(inv => isDateToday(inv.timestamp));
    }
    return list;
  };

  const displayedInvoices = useMemo(
    () => getFilteredInvoices(),
    [invoices, activeTab]
  );

  // Stats Counters
  // Total Unpaid: sum of net_amount - received_amount where positive
  const totalUnpaidRs = useMemo(() => {
    return invoices.reduce((acc, inv) => {
      const due = inv.net_amount - inv.received_amount;
      return due > 0 ? acc + due : acc;
    }, 0);
  }, [invoices]);

  // Today's Returns: sum of credit_amount of returns logged today
  const todaysReturnsRs = useMemo(() => {
    return returns.reduce((acc, ret) => {
      if (isDateToday(ret.timestamp)) {
        return acc + ret.credit_amount;
      }
      return acc;
    }, 0);
  }, [returns]);

  // Today's Collection: sum of received_amount of invoices dated today minus returns logged today
  const todaysCollectionRs = useMemo(() => {
    const rawCollection = invoices.reduce((acc, inv) => {
      if (isDateToday(inv.timestamp)) {
        return acc + inv.received_amount;
      }
      return acc;
    }, 0);
    return Math.max(0, rawCollection - todaysReturnsRs);
  }, [invoices, todaysReturnsRs]);

  // -----------------------------------------------------
  // DISCOVER & SAVE FLOW ON-THE-FLY CREATION
  // -----------------------------------------------------
  const triggerOpenDiscoverModal = () => {
    setUnknownCode(productSearchQuery);
    setDiscoverSearchQuery('');
    setSelectedMatchProduct(null);
    setDiscoverBrand('Generic');
    setDiscoverMatchType('exact_match');
    setShowDiscoverModal(true);
  };

  const handleSaveDiscoveryAndAddLine = () => {
    if (!selectedMatchProduct) return;

    const rawUnknown = unknownCode.trim();
    const normUnknown = normalizeCode(rawUnknown);

    // Create a new product representing alternative on field
    const newProdId = "prod-disc-" + Date.now();
    const newProd: Product = {
      id: newProdId,
      part_number: rawUnknown,
      part_number_norm: normUnknown,
      brand: discoverBrand.trim() || 'Alternative import',
      category: selectedMatchProduct.category,
      subtype: selectedMatchProduct.subtype,
      pack_size: selectedMatchProduct.pack_size,
      grade: 'normal',
      shelf_location: selectedMatchProduct.shelf_location,
      thread_size: selectedMatchProduct.thread_size,
      height_mm: selectedMatchProduct.height_mm,
      od_mm: selectedMatchProduct.od_mm,
      micron_rating: selectedMatchProduct.micron_rating,
      cabin_filter: selectedMatchProduct.cabin_filter,
      supplier_code: 'DISCOVERED',
      notes: `Captured automatically in Point of Sale. Substitutes ${selectedMatchProduct.brand} ${selectedMatchProduct.part_number}.`,
      sale_price: selectedMatchProduct.sale_price,
      cost_price: selectedMatchProduct.cost_price,
      stock_qty: 0,
      damaged_qty: 0,
      min_stock_alert: 3,
      is_active: true,
      created_at: new Date().toISOString()
    };

    // Save product to database
    const allProds = db.getAllProductsWithDeleted();
    allProds.push(newProd);
    db.saveProducts(allProds);

    // Create cross-references
    const crossRefsList = db.getCrossRefs();
    const ref1: CrossReference = {
      id: "cref-" + Date.now() + "-da1",
      product_id_1: newProd.id,
      product_id_2: selectedMatchProduct.id,
      match_type: discoverMatchType,
      source: 'invoice',
      discovered_invoice_id: null,
      is_active: true,
      created_at: new Date().toISOString()
    };
    const ref2: CrossReference = {
      id: "cref-" + Date.now() + "-da2",
      product_id_1: selectedMatchProduct.id,
      product_id_2: newProd.id,
      match_type: discoverMatchType,
      source: 'invoice',
      discovered_invoice_id: null,
      is_active: true,
      created_at: new Date().toISOString()
    };
    db.saveCrossRefs([...crossRefsList, ref1, ref2]);

    // Force local reload
    reloadData();

    // Directly append this to checkout cart lines
    const item: InvoiceItem = {
      id: "line-" + Date.now(),
      product_id: newProd.id,
      part_number: newProd.part_number,
      brand: newProd.brand,
      sale_price: newProd.sale_price,
      qty: 1,
      line_total: newProd.sale_price,
      searched_code: rawUnknown.toUpperCase(),
      match_type: discoverMatchType,
      matched_code: selectedMatchProduct.part_number
    };
    (item as any).discount_percent = 0;
    (item as any).original_default_price = newProd.sale_price;

    setCart([...cart, item]);
    setShowDiscoverModal(false);
    setProductSearchQuery('');
  };

  return (
    <div className="space-y-4" id="invoices-module-container">

      {/* =======================================================
          VIEW STATE 1: VIEWING INVOICE RECORDS LIST
          ======================================================= */}
      {viewState === 'list' && (
        <div className="space-y-4" id="view-state-list">
          
          {/* TOPBAR */}
          <div className="bg-white border p-4 flex justify-between items-center bg-slate-50/50" id="invoices-topbar">
            <div>
              <span className="text-[10px] uppercase font-extrabold bg-[#0EA5E9] text-white px-2 py-0.5 rounded">
                Billing Central
              </span>
              <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight mt-1">Invoices</h1>
            </div>
            
            <button
              onClick={() => setViewState('new')}
              className="px-6 py-2.5 bg-[#0EA5E9] text-white font-extrabold text-xs uppercase tracking-wider rounded shadow hover:bg-sky-600 transition"
              id="btn-goto-new-invoice"
            >
              + New Invoice
            </button>
          </div>

          {/* STATS ROW */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="invoices-stats">
            <div className="bg-white p-4 border border-l-4 border-l-rose-500 rounded flex justify-between items-center shadow-xs">
              <div>
                <p className="text-[10px] uppercase font-extrabold text-slate-400">Total Outstanding Receivables (Unpaid)</p>
                <h3 className="text-xl font-black text-[#0ea5e9] font-mono mt-1">
                  {formatAmount(totalUnpaidRs)}
                </h3>
              </div>
              <div className="p-2 bg-rose-50 rounded text-rose-500 font-mono text-[9px]">LMR Balance</div>
            </div>

            <div className="bg-white p-4 border border-l-4 border-l-emerald-500 rounded flex justify-between items-center shadow-xs">
              <div>
                <p className="text-[10px] uppercase font-extrabold text-slate-400">Today's Secured Retail Collection</p>
                <h3 className="text-xl font-black text-emerald-700 font-mono mt-1">
                  {formatAmount(todaysCollectionRs)}
                </h3>
                {todaysReturnsRs > 0 && (
                  <span className="text-[9px] text-red-500 font-bold block mt-1 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 w-max">
                    Deducted Returns: {formatAmount(todaysReturnsRs)}
                  </span>
                )}
              </div>
              <div className="p-2 bg-emerald-50 rounded text-emerald-500 font-mono text-[9px]">Cash Register Today</div>
            </div>

            <div className="bg-white p-4 border border-l-4 border-l-slate-700 rounded flex justify-between items-center shadow-xs">
              <div>
                <p className="text-[10px] uppercase font-extrabold text-slate-400">Global Ledger Invoiced Records Count</p>
                <h3 className="text-xl font-black text-slate-800 font-mono mt-1">
                  {invoices.length} Bills Issued
                </h3>
              </div>
              <div className="p-2 bg-slate-100 rounded text-slate-600 font-mono text-[9px]">{displayedInvoices.length} Selected</div>
            </div>
          </div>

          {/* TAB BAR FILTER BUTTONS */}
          <div className="flex border-b border-[#E2DFDF] bg-slate-50/80 space-x-2 text-xs font-sans rounded-t overflow-x-auto scrollbar-none" id="invoices-tabs-bar">
            {([
              { key: 'all', title: 'All Invoices', icon: FileText, iconColor: 'text-slate-500' },
              { key: 'unpaid', title: 'Unpaid (A/R)', icon: AlertTriangle, iconColor: 'text-rose-500' },
              { key: 'partial', title: 'Partially Recovered', icon: Coins, iconColor: 'text-amber-500' },
              { key: 'paid', title: 'Fully Settled (Paid)', icon: CheckCircle2, iconColor: 'text-emerald-500' },
              { key: 'today', title: "Today's Ledger Entries", icon: Calendar, iconColor: 'text-blue-500' }
            ] as const).map(tab => {
              const isSelected = activeTab === tab.key;
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 font-bold uppercase text-[10px] tracking-wider transition-all border-b-2 -mb-[1px] outline-none flex items-center space-x-2 shrink-0 ${
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

          {/* INVOICES LIST TABLE */}
          {displayedInvoices.length === 0 ? (
            <div className="p-12 bg-white border border-[#E2DFDF] text-center font-mono text-gray-400 flex flex-col items-center justify-center space-y-2">
              <FileText className="w-10 h-10 opacity-20" />
              <span>No matching invoice entries found in current ledger section view.</span>
            </div>
          ) : (
            <div className="bg-white border rounded overflow-hidden divide-y" id="invoices-records-rows">
              {displayedInvoices.map((inv) => {
                const unpaid = Math.max(0, inv.net_amount - inv.received_amount);
                const isPaid = unpaid <= 0;
                const isUnpaid = inv.received_amount === 0;

                const invReturns = returns.filter(r => r.invoice_id === inv.id);
                const hasReturns = invReturns.length > 0;
                const isFullyReturned = hasReturns && (inv.status === 'returned' || invReturns.some(r => r.type === 'full'));

                let statusBadge = (
                  <span className="px-2 py-0.5 text-[9px] uppercase font-black tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-sm">
                    Paid
                  </span>
                );
                if (isUnpaid) {
                  statusBadge = (
                    <span className="px-2 py-0.5 text-[9px] uppercase font-black tracking-wider bg-sky-50 text-sky-700 border border-sky-200 rounded-sm">
                      Unpaid
                    </span>
                  );
                } else if (!isPaid) {
                  statusBadge = (
                    <span className="px-2 py-0.5 text-[9px] uppercase font-black tracking-wider bg-amber-50 text-amber-700 border border-amber-200 rounded-sm">
                      Partial
                    </span>
                  );
                }

                let returnBadge = null;
                if (isFullyReturned) {
                  returnBadge = (
                    <span className="px-2 py-0.5 text-[9px] uppercase font-black tracking-wider bg-red-100 text-red-850 border border-red-300 rounded-sm ml-1.5 font-bold">
                      Returned
                    </span>
                  );
                } else if (hasReturns) {
                  returnBadge = (
                    <span className="px-2 py-0.5 text-[9px] uppercase font-black tracking-wider bg-rose-50 text-rose-700 border border-rose-200 rounded-sm ml-1.5 font-bold">
                      Partial Return
                    </span>
                  );
                }

                // Customer type badge lookup
                const matchParty = parties.find(p => p.id === inv.party_id);
                const customerType = matchParty ? matchParty.customer_type : 'walkin';

                return (
                  <div 
                    key={inv.id} 
                    onClick={() => setSelectedInvoice(inv)}
                    className="p-4 hover:bg-slate-50 transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs font-sans cursor-pointer hover:border-l-4 hover:border-l-[#0EA5E9] transition-all duration-150"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-[#0ea5e9] tracking-wider">
                          {inv.invoice_number}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase bg-slate-100 text-slate-500">
                          {customerType === 'walkin' ? 'Walk-In' : (customerType || 'Customer')}
                        </span>
                        <span className="text-gray-400">•</span>
                        <div className="text-slate-400 font-mono text-[10px] flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(inv.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                      <h4 className="font-bold text-gray-800 text-sm mt-1">{inv.customer_name}</h4>
                    </div>

                    <div className="flex items-center space-x-6 text-right w-full md:w-auto justify-between md:justify-end">
                      <div>
                        <p className="text-[10.5px] uppercase font-bold text-gray-400">Invoice Total Amount</p>
                        <p className="font-mono font-bold text-gray-900 text-[13px] mt-0.5">
                          {formatAmount(inv.net_amount)}
                        </p>
                      </div>

                      <div className="flex flex-col items-end">
                        <span className="text-[9px] uppercase text-gray-400 font-bold mb-1">Status</span>
                        <div className="flex items-center">
                          {statusBadge}
                          {returnBadge}
                        </div>
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
          VIEW STATE 2: THE BULLET-FAST CREATION P.O.S PORTAL
          ======================================================= */}
      {viewState === 'new' && (
        <div className="bg-slate-100/50 p-2 border rounded-lg shadow-inner text-xs" id="view-state-new">
          
          {/* Pos terminal top controls */}
          <div className="p-3 border-b flex justify-between items-center bg-white rounded-lg shadow-sm mb-4">
            <h1 className="text-md font-bold tracking-tight text-slate-800 uppercase flex items-center space-x-1.5">
              <ShoppingCart className="w-4 h-4 text-[#0EA5E9]" />
              <span>Point of Sale Terminal</span>
            </h1>
            
            <button
              onClick={() => {
                setViewState('list');
                setCart([]);
                setSelectedPartyId(null);
              }}
              className="text-gray-400 hover:text-slate-800 hover:bg-slate-100 p-1.5 rounded-full transition"
              title="Close terminal, cancel draft"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4" id="pos-grid-layout">
            
            {/* Left panel (custom flex 3 spans wide) */}
            <div className="lg:col-span-3 space-y-4">
              
              {/* CUSTOMER SECTION */}
              <div className="bg-white p-4 rounded-lg shadow-sm border space-y-3 relative">
                
                {selectedPartyId ? (
                  // SELECTED CUSTOMER STATE
                  (() => {
                    const isWalkIn = selectedPartyId === 'walk-in';
                    const activeClient = isWalkIn ? null : parties.find(p => p.id === selectedPartyId);
                    const nameToDisplay = isWalkIn ? (walkInName.trim() || 'Anonymous Cash Walk-In') : (activeClient?.name || 'Unknown');
                    const phoneToDisplay = isWalkIn ? (walkInPhone || 'None Line') : (activeClient?.phone || 'N/A');
                    const profileType = isWalkIn ? 'Cash Client' : (activeClient?.customer_type || activeClient?.type || 'Standard Customer');
                    const balanceDue = isWalkIn ? 0 : (activeClient?.credit_balance || 0);

                    return (
                      <div className="flex justify-between items-start" id="selected-customer-box">
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase tracking-wider bg-indigo-50 border border-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded-sm">
                            Buyer Selected Account
                          </span>
                          <h4 className="text-[15px] font-extrabold text-[#2A2727] select-all mt-1">
                            {nameToDisplay}
                          </h4>
                          <p className="text-[10px] text-gray-500 font-mono">
                            ☎️ Connection: {phoneToDisplay} • Type Rank: <span className="uppercase font-bold">{profileType}</span>
                          </p>

                          {balanceDue > 0 && (
                            <div className="mt-2 p-2 bg-sky-50 border border-sky-200 text-[#0ea5e9] font-bold rounded flex items-center space-x-1 duration-150 animate-pulse text-[10px]">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Ledger account warning: This customer has an existing outstanding debt balance of <strong>Rs. {balanceDue.toLocaleString()}</strong>. Ensure credit capacity.</span>
                            </div>
                          )}

                          {/* Machine batch invoicing trigger */}
                          {activeClient?.machines && activeClient.machines.length > 0 && (
                            <div className="mt-4 pt-3.5 border-t border-dashed border-slate-200 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                ⚙️ {activeClient.machines.length} Machines Registered
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedMachineIds(activeClient.machines?.map(m => m.id) || []);
                                  setShowMachineInvoicingModal(true);
                                }}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-sm shadow-indigo-100"
                              >
                                <Building className="w-3.5 h-3.5" />
                                <span>Batch Machine Invoicing</span>
                              </button>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            setSelectedPartyId(null);
                            setWalkInName('');
                            setWalkInPhone('');
                            setShowWalkInForm(false);
                            setCart([]); // reset cart if switching customer for clean pricing logs
                          }}
                          className="text-[10px] uppercase font-extrabold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          Change
                        </button>
                      </div>
                    );
                  })()
                ) : (
                  // CUSTOMER SELECTION SEARCH STATE
                  <div className="space-y-3" id="select-customer-search-area">
                    <label className="block text-slate-500 font-extrabold text-[10px] uppercase">
                      Identify Customer Account Ledger
                    </label>
                    
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Type customer name or phone number..."
                        value={customerSearchQuery}
                        onChange={e => {
                          setCustomerSearchQuery(e.target.value);
                          setShowCustomerDropdown(true);
                        }}
                        onFocus={() => setShowCustomerDropdown(true)}
                        className="w-full text-xs p-2.5 pl-8 border border-slate-300 rounded font-bold uppercase focus:border-sky-550 focus:outline-none"
                      />
                      <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-3.5" />
                    </div>

                    {/* Customer Selection Dropdown */}
                    {showCustomerDropdown && customerSearchQuery.trim().length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded shadow-lg z-30 max-h-48 overflow-y-auto divide-y font-sans">
                        {parties
                          .filter(p => p.type !== 'supplier' || p.is_customer_linked === true)
                          .filter(p => 
                            p.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                            p.phone.includes(customerSearchQuery)
                          )
                          .map(p => {
                            const hasDebt = p.credit_balance > 0;
                            return (
                              <div
                                key={p.id}
                                onClick={() => handleSelectCustomerTextResult(p)}
                                className="p-2 hover:bg-sky-50/50 cursor-pointer flex justify-between items-center"
                              >
                                <div>
                                  <strong className="text-gray-900 block font-sans">{p.name}</strong>
                                  <span className="text-[9.5px] text-gray-400 font-mono">Phone: {p.phone} · City: {p.city}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[8px] bg-slate-100 text-slate-600 font-bold uppercase px-1 rounded block mb-1">
                                    {p.customer_type || p.type}
                                  </span>
                                  {hasDebt && (
                                    <span className="text-sky-600 font-bold font-mono text-[9px]">
                                      Rs. {p.credit_balance.toLocaleString()} A/R
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        }
                        {parties.filter(p => p.type !== 'supplier' || p.is_customer_linked === true).filter(p => p.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) || p.phone.includes(customerSearchQuery)).length === 0 && (
                          <div className="p-3 text-center text-gray-400 italic font-mono text-[10px]">
                            No search matches found. Type name to create on-the-fly walk-in regular below.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Walk-In Sale Toggle Form */}
                    {!showWalkInForm ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowWalkInForm(true);
                        }}
                        className="text-[10px] uppercase font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 hover:underline"
                        id="btn-walkin-toggle"
                      >
                        <User className="w-3 h-3" />
                        <span>Walk-In Sale (No Account Selection)</span>
                      </button>
                    ) : (
                      <form onSubmit={handleWalkInProceedSubmit} className="p-3 bg-indigo-50/50 border border-indigo-200 rounded text-xs space-y-3">
                        <p className="font-bold text-indigo-900 text-[10px] uppercase tracking-wider">
                          Proceed Walk-In Temporary Customer Setup
                        </p>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[9px] uppercase font-bold text-gray-400 mb-0.5">Custom Receipt Name (Optional)</label>
                            <input
                              type="text"
                              placeholder="e.g. M. Shahid"
                              value={walkInName}
                              onChange={e => setWalkInName(e.target.value)}
                              className="w-full text-xs p-1.5 border border-indigo-200 rounded"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] uppercase font-bold text-gray-400 mb-0.5">Buyer Contact Line (Optional)</label>
                            <input
                              type="text"
                              placeholder="e.g. 0300-1234567"
                              value={walkInPhone}
                              onChange={e => setWalkInPhone(e.target.value)}
                              className="w-full text-xs p-1.5 border border-indigo-200 rounded font-mono"
                            />
                          </div>
                        </div>

                        <div className="flex space-x-2">
                          <button
                            type="submit"
                            className="px-4 py-1.5 bg-indigo-600 text-white text-[10px] uppercase tracking-wider font-extrabold hover:bg-indigo-700 transition"
                          >
                            Proceed
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowWalkInForm(false);
                            }}
                            className="px-4 py-1.5 border border-gray-300 text-gray-500 text-[10px] uppercase hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}

                  </div>
                )}

              </div>

              {/* ITEMS SECTION */}
              <div className={`bg-white p-4 rounded-lg shadow-sm border space-y-4 ${!selectedPartyId ? 'opacity-40 pointer-events-none' : ''}`}>
                <div className="flex justify-between items-center pb-2 border-b">
                  <h4 className="text-[10px] uppercase font-extrabold text-slate-705">
                    Items & Filter Product Setup Lookup
                  </h4>
                  <span className="text-[9px] text-gray-400">Press <kbd className="bg-slate-100 p-0.5 border rounded">Ctrl+F</kbd> to focus lookup</span>
                </div>

                {/* Product Search Input Dropdown */}
                <div className="relative">
                  <input
                    id="invoice-product-search-input"
                    ref={productSearchRef}
                    type="text"
                    disabled={!selectedPartyId}
                    placeholder="Type part number or filter spec to add product..."
                    value={productSearchQuery}
                    onChange={e => {
                      setProductSearchQuery(e.target.value);
                      setShowProductDropdown(true);
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    onKeyDown={handleProductSearchKeyDown}
                    className="w-full text-xs p-2.5 pl-8 border border-slate-300 rounded font-mono font-bold uppercase focus:border-sky-550 focus:outline-none"
                  />
                  <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-3.5" />

                  {/* Product Search Results Dropdown */}
                  {showProductDropdown && productSearchQuery.trim().length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded shadow-xl z-20 max-h-56 overflow-y-auto divide-y font-sans">
                      {productSearchResults.length === 0 ? (
                        <div className="p-4 text-center">
                          {productSearchQuery.trim().length >= 3 ? (
                            <div className="space-y-2">
                              <p className="text-sky-600 font-bold">⚠️ Code "{productSearchQuery.toUpperCase()}" not found in local catalog.</p>
                              <button
                                type="button"
                                onClick={triggerOpenDiscoverModal}
                                className="px-3 py-1 bg-amber-500 text-white font-extrabold text-[9.5px] uppercase tracking-wider rounded shadow hover:bg-amber-600 cursor-pointer inline-flex items-center space-x-1"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                                <span>Link to existing product? (Discover & Save)</span>
                              </button>
                            </div>
                          ) : (
                            <p className="text-gray-400 text-[10px]">Keep typing element codes (3+ characters to discover on-the-fly)</p>
                          )}
                        </div>
                      ) : (
                        productSearchResults.map(cand => {
                          const p = cand.product;
                          const hasStock = p.stock_qty > 0;
                          
                          let rankBorder = 'border-l-4 border-l-slate-300';
                          if (cand.score === 1) rankBorder = 'border-l-4 border-l-blue-600';
                          else if (cand.score === 2) rankBorder = 'border-l-4 border-l-green-600';
                          else if (cand.score === 3) rankBorder = 'border-l-4 border-l-amber-500';
                          else if (cand.score === 4) rankBorder = 'border-l-4 border-l-amber-300';

                          return (
                            <div
                              key={p.id}
                              onClick={() => handleAddProductToCart(cand)}
                              className={`p-2.5 hover:bg-sky-50/50 cursor-pointer flex justify-between items-center transition ${rankBorder} ${!hasStock ? 'bg-slate-50 opacity-60' : ''}`}
                            >
                              <div className="space-y-0.5">
                                <p className="font-mono font-bold text-gray-800 text-[12px] flex items-wrap items-center gap-1">
                                  <span>{p.part_number}</span>
                                  <span className="text-[8px] bg-slate-100 text-slate-500 font-bold px-1 rounded font-sans uppercase">
                                    {p.brand}
                                  </span>
                                  {p.pack_size && (
                                    <span className="text-[8px] bg-blue-50 text-blue-600 font-bold px-1 rounded font-sans">
                                      {p.pack_size}
                                    </span>
                                  )}
                                  {p.grade && p.grade !== 'normal' && p.grade !== 'standard' && (
                                    <span className="text-[8px] bg-emerald-50 text-emerald-800 font-extrabold px-1 rounded font-sans">
                                      {p.grade.toUpperCase()}
                                    </span>
                                  )}
                                  
                                  {/* Subtitle cross reference tag marker */}
                                  {(cand.score === 3 || cand.score === 4) && (
                                    <span className="text-[8px] uppercase px-1 rounded-sm bg-amber-100 text-amber-700 font-bold tracking-tight">
                                      via CODE: {cand.matchedCode}
                                    </span>
                                  )}
                                </p>
                                <p className="text-[9px] text-slate-400">
                                  Category: {p.category} · subtype: {p.subtype || 'none'} • Loc: {p.shelf_location || 'N/A'}
                                </p>
                              </div>

                              <div className="text-right">
                                <p className="font-bold text-sky-600 font-mono">
                                  {formatAmount(cand.loadedPrice)} 
                                  {cand.isOverride && (
                                    <span className="text-[8px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded ml-1 font-sans uppercase select-none inline-block">
                                      last sold Override
                                    </span>
                                  )}
                                </p>
                                <span className={`text-[9.5px] font-mono font-bold block ${p.stock_qty <= p.min_stock_alert ? 'text-amber-600' : 'text-slate-400'}`}>
                                  Stock: {p.stock_qty} pcs
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                </div>

                {/* LINE ITEMS TABLE */}
                <div className="overflow-x-auto" id="line-items-table-container">
                  <table className="w-full text-xs font-sans text-left">
                    <thead>
                      <tr className="border-b bg-slate-50 font-extrabold text-slate-500 text-[10px] uppercase">
                        <th className="p-3 w-1/2">Product Details</th>
                        <th className="p-3 text-right">Unit Price (Rs)</th>
                        <th className="p-3 text-center w-28">Quantity</th>
                        <th className="p-3 text-center w-20">Disc %</th>
                        <th className="p-3 text-right w-24">Total line</th>
                        <th className="p-3 text-center w-10">✕</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {cart.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-12 text-center text-gray-400 font-mono italic">
                            Empty Billing Cart. Input product filters code above to load items.
                          </td>
                        </tr>
                      ) : (
                        cart.map(item => {
                          const lastSoldInfo = getCustomerLastSoldPrice(selectedPartyId, item.product_id);
                          const isUsingLastSoldPriceOverride = lastSoldInfo && item.sale_price === lastSoldInfo.price;
                          
                          // Determine if custom price mismatch
                          const isDefaultPrice = (item as any).original_default_price === item.sale_price;

                          return (
                            <React.Fragment key={item.id}>
                              <tr className="hover:bg-slate-50/50">
                                            {/* Product cell */}
                                <td className="p-3">
                                  <div className="space-y-1">
                                    <div className="flex items-wrap items-center gap-1.5">
                                      <input
                                        type="text"
                                        value={item.part_number}
                                        onChange={e => handleUpdateLinePartNumber(item.id, e.target.value)}
                                        className="font-mono font-bold text-slate-800 text-[13px] border-b border-dashed border-slate-300 focus:border-indigo-500 focus:outline-none bg-transparent w-full p-0.5"
                                        placeholder="Edit item description/part number..."
                                        title="Click to edit product name for this invoice only"
                                      />
                                      
                                      {item.searched_code && item.searched_code !== item.part_number.toUpperCase() && (
                                        <span className="text-[8px] bg-amber-100 border border-amber-300 text-amber-800 font-bold px-1.5 py-0.5 rounded uppercase">
                                          User Code: {item.searched_code}
                                        </span>
                                      )}

                                      {item.match_type && (
                                        <span className="text-[8px] bg-emerald-100/80 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded uppercase select-none tracking-tight">
                                          via CODE CrossFit
                                        </span>
                                      )}
                                    </div>
                                    {(item as any).machine_names && (item as any).machine_names.length > 0 && (
                                      <div className="mt-1 flex items-center">
                                        <span className="text-[9px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-bold font-mono">
                                          ⚙️ For: {(item as any).machine_names.join(', ')}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </td>

                                {/* Price cell */}
                                <td className="p-3 text-right">
                                  <input 
                                    type="number"
                                    min="0"
                                    value={item.sale_price || ''}
                                    onChange={e => handleUpdateLinePrice(item.id, parseFloat(e.target.value) || 0)}
                                    className={`w-24 p-1 text-right border rounded font-mono font-bold focus:outline-none ${
                                      !isDefaultPrice 
                                        ? 'text-amber-600 bg-amber-50/40 border-amber-300' 
                                        : 'border-slate-300'
                                    }`}
                                  />
                                </td>

                                {/* Qty cell */}
                                <td className="p-3">
                                  <div className="flex items-center justify-center space-x-1">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateLineQty(item.id, item.qty - 1)}
                                      className="w-6 h-6 border bg-slate-100 text-slate-600 rounded font-bold hover:bg-slate-200"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.qty || ''}
                                      onChange={e => handleUpdateLineQty(item.id, parseInt(e.target.value) || 1)}
                                      className="w-10 p-1 text-center border font-mono font-bold rounded"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateLineQty(item.id, item.qty + 1)}
                                      className="w-6 h-6 border bg-slate-100 text-slate-600 rounded font-bold hover:bg-slate-200"
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>

                                {/* Disc % cell */}
                                <td className="p-3 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    placeholder="0"
                                    value={(item as any).discount_percent || ''}
                                    onChange={e => handleUpdateLineDiscount(item.id, parseFloat(e.target.value) || 0)}
                                    className="w-12 p-1 text-center border border-slate-350 font-mono font-bold rounded focus:bg-[#FFFDF3] text-gray-700"
                                  />
                                </td>

                                {/* Total cell */}
                                <td className="p-3 text-right">
                                  <span className="font-mono font-extrabold text-[#0EA5E9] text-[13px]">
                                    {formatAmount(item.line_total)}
                                  </span>
                                </td>

                                {/* Delete button */}
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFromCart(item.id)}
                                    className="text-slate-400 hover:text-[#0ea5e9] hover:bg-slate-100 p-1 rounded transition"
                                    title="Deduct line"
                                  >
                                    ✕
                                  </button>
                                </td>

                              </tr>

                              {/* Last sold price override message bar */}
                              {lastSoldInfo && (
                                <tr className="bg-amber-50/20">
                                  <td colSpan={6} className="px-3 py-1 font-sans text-slate-500 font-bold border-b text-[10px]">
                                    <div className="flex justify-between items-center text-amber-700">
                                      <span>
                                        🗓️ Last sold to this customer: <strong>Rs. {lastSoldInfo.price.toLocaleString()}</strong> on {lastSoldInfo.date} (Invoiced No: {lastSoldInfo.invoice_number})
                                      </span>
                                      {!isUsingLastSoldPriceOverride && (
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateLinePrice(item.id, lastSoldInfo.price)}
                                          className="text-[10px] text-amber-800 hover:text-amber-900 underline font-extrabold outline-none"
                                        >
                                          Restore last price
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

              </div>

            </div>

            {/* Right column Summary & Checkout Payments setup (280px fixed width) */}
            <div className="w-full lg:w-[280px] shrink-0 space-y-4">
              
              {/* SUMMARY CARD */}
              <div className="bg-white p-4 border rounded-lg shadow-sm space-y-3 font-sans">
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-700 border-b pb-1.5">
                  Summary card billing
                </h3>
                
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-gray-500 font-medium">
                    <span>Subtotal Value:</span>
                    <span className="font-mono font-bold text-gray-700 font-bold">
                      {formatAmount(totalSubtotal)}
                    </span>
                  </div>

                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-amber-700 font-bold">
                      <span>Applied Discounts:</span>
                      <span className="font-mono">
                        -{formatAmount(totalDiscount)}
                      </span>
                    </div>
                  )}

                  {/* FBR Taxation Compliance Section */}
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-1.5 mt-2">
                    <label className="flex items-center space-x-2 text-[10px] font-bold text-slate-700 cursor-pointer user-select-none">
                      <input 
                        type="checkbox"
                        checked={isTaxInvoice}
                        onChange={(e) => setIsTaxInvoice(e.target.checked)}
                        className="rounded border-slate-300 text-[#0EA5E9] focus:ring-[#0EA5E9] w-3.5 h-3.5 cursor-pointer"
                        id="invoice-tax-toggle"
                      />
                      <span>FBR GST Invoicing (18%)</span>
                    </label>
                    {isTaxInvoice && (
                      <div className="space-y-1 mt-1 animate-fade-in" id="invoice-tax-details-box">
                        <div className="flex justify-between items-center text-[10px] text-slate-500">
                          <span>Calculated 18% GST:</span>
                          <span className="font-mono font-bold text-[#0EA5E9]">+{formatAmount(taxAmount)}</span>
                        </div>
                        <input
                          type="text"
                          placeholder="FBR NTN Number (Optional)"
                          value={customNtn}
                          onChange={(e) => setCustomNtn(e.target.value)}
                          className="w-full text-[10px] p-1 border border-slate-300 rounded font-mono uppercase bg-white focus:outline-none focus:border-sky-500"
                          id="invoice-custom-ntn-input"
                        />
                      </div>
                    )}
                  </div>

                  <div className="border-t border-dashed py-1"></div>

                  <div className="flex justify-between items-center text-sm font-black text-slate-800">
                    <span>Total Receivable:</span>
                    <span className="text-[15px] text-[#0EA5E9] font-mono font-black">
                      {formatAmount(netInvoiceTotal)}
                    </span>
                  </div>

                  <div className="flex justify-between text-emerald-700 font-bold py-0.5 border-t border-dotted">
                    <span>Paid Amount:</span>
                    <span className="font-mono">
                      {formatAmount(getLivePaidAmount())}
                    </span>
                  </div>

                  {getLiveBalanceDue() > 0 && (
                    <div className="flex justify-between text-sky-600 font-black text-[12px] bg-sky-50/50 p-1.5 rounded">
                      <span>Balance Due ledger:</span>
                      <span className="font-mono">
                        {formatAmount(getLiveBalanceDue())}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* PAYMENT METHODS BUTTONS WRAP */}
              <div className="bg-white p-4 border rounded-lg shadow-sm space-y-3">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Select payment configuration
                </h4>

                <div className="grid grid-cols-2 gap-2" id="payment-methods-grid">
                  {[
                    { key: 'cash', title: '💵 Cash', desc: 'Direct currency' },
                    { key: 'credit', title: '📝 Credit', desc: 'Add debit balance' },
                    { key: 'partial', title: '⚖️ Partial', desc: 'Split transaction' },
                    { key: 'bank', title: '🏦 Bank', desc: 'Wire transaction' },
                    { key: 'cheque', title: '📜 Cheque', desc: 'Clear Cheque' }
                  ].map(method => {
                    const isSelected = paymentMethod === method.key;
                    return (
                      <button
                        key={method.key}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(method.key as PayMethod);
                        }}
                        className={`p-2 border rounded text-center cursor-pointer transition flex flex-col items-center justify-center space-y-0.5 outline-none ${
                          isSelected 
                            ? 'border-red-600 bg-sky-50 text-sky-700 font-bold shadow-xs' 
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-[11px] font-bold">{method.title}</span>
                        <span className="text-[8px] text-gray-400 select-none block leading-tight">{method.desc}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Conditional Fields depending on Payment Configuration */}
                <div className="pt-2 border-t font-sans animate-fade-in text-[11px] space-y-3">
                  
                  {paymentMethod === 'credit' && selectedPartyId && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800 space-y-1">
                      <p className="font-bold uppercase text-[9px]">A/R Ledger Warnings</p>
                      <p>Full bill amount goes to client's accounts receivable ledger book.</p>
                      {(() => {
                        const party = parties.find(p => p.id === selectedPartyId);
                        if (!party) return null;
                        const creditLimit = party.credit_limit || 0;
                        const currBalance = party.credit_balance || 0;
                        const limitRemaining = creditLimit - currBalance - netInvoiceTotal;
                        return (
                          <div className="text-[10px] pt-1">
                            <p>Current balance: <strong>Rs. {currBalance.toLocaleString()}</strong></p>
                            <p>Credit capacity: <strong>Rs. {creditLimit.toLocaleString()}</strong></p>
                            {limitRemaining < 0 && (
                              <p className="text-[#0EA5E9] font-black tracking-tight mt-1">
                                ⚠️ Caution: Transaction exceeds client credit limit by Rs. {Math.abs(limitRemaining).toLocaleString()}!
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {paymentMethod === 'partial' && (
                    <div>
                      <label className="block text-slate-500 font-bold mb-1 col-span-1">Enter Cash Recovered now (Rs.) *</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 5000"
                        value={partialAmountPaid}
                        onChange={e => {
                          const val = e.target.value;
                          setPartialAmountPaid(val);
                        }}
                        className="w-full text-xs p-2 border border-slate-300 rounded font-mono font-bold font-black text-emerald-800"
                      />
                      {parseFloat(partialAmountPaid) >= netInvoiceTotal && (
                        <p className="text-[9.5px] text-sky-600 mt-1">Paid amount must be less than net invoice total value.</p>
                      )}
                    </div>
                  )}

                  {paymentMethod === 'bank' && (
                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Transaction Ref / IMFT Hash ID</label>
                      <input
                        type="text"
                        placeholder="e.g. HBL-12049102"
                        value={bankTransRef}
                        onChange={e => setBankTransRef(e.target.value)}
                        className="w-full text-xs p-2 border border-slate-350 rounded font-mono font-bold"
                      />
                    </div>
                  )}

                  {paymentMethod === 'cheque' && (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-slate-500 font-bold mb-0.5">Cheque Cleared Number *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. CHQ-9210-912"
                          value={chequeNumber}
                          onChange={e => setChequeNumber(e.target.value)}
                          className="w-full text-xs p-2 border border-slate-350 rounded font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 font-bold mb-0.5">Clearing Bank Name Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. MCB samundri, HBL FSD"
                          value={chequeBankName}
                          onChange={e => setChequeBankName(e.target.value)}
                          className="w-full text-xs p-2 border border-slate-350 rounded font-bold"
                        />
                      </div>
                      <span className="text-[9px] text-amber-700 block italic bg-[#FFFCEB] p-1.5 border border-amber-200">
                        * Marked as Pending in cheque register until physical clearance.
                      </span>
                    </div>
                  )}

                </div>

              </div>

              {/* ACTION CONFIRM BUTTON */}
              <button
                type="button"
                onClick={handleConfirmInvoicingBill}
                disabled={cart.length === 0 || isSaving || (paymentMethod === 'partial' && parseFloat(partialAmountPaid) >= netInvoiceTotal)}
                className="w-full py-3 rounded-lg bg-[#0EA5E9] text-white font-extrabold text-sm uppercase tracking-wider hover:bg-sky-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition flex items-center justify-center space-x-1 shadow-sm"
                id="btn-pos-complete-confirm"
              >
                {isSaving ? (
                  <span className="flex items-center space-x-1 font-sans">
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Clearing Transaction...</span>
                  </span>
                ) : (
                  <span>✓ Confirm — Rs. {netInvoiceTotal.toLocaleString()}</span>
                )}
              </button>

            </div>

          </div>

        </div>
      )}

      {/* =======================================================
          VIEW STATE 3: FULL PAGE SUCCESS SCREEN COMPLETE RECEIPT
          ======================================================= */}
      {viewState === 'success' && lastCreatedInvoice && (
        <div className="bg-white p-6 border rounded-lg shadow-lg flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-6 my-10 font-sans" id="invoice-checkout-success-pane">
          
          <div className="p-4 bg-emerald-50 rounded-full text-emerald-600">
            <CheckCircle2 className="w-16 h-16 animate-bounce" />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-black uppercase tracking-widest px-2 py-0.5 rounded">
              Immutable Settlement Lock
            </span>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight mt-2">
              Invoice Generated Successfully!
            </h2>
            <p className="text-sm font-mono text-ref-invoice text-sky-600 font-bold mt-1">
              Bill Reference: {lastCreatedInvoice.invoice_number}
            </p>
          </div>

          <div className="p-4 bg-slate-50 border rounded-lg w-full text-xs space-y-2 text-left">
            <div className="flex justify-between">
              <span className="text-gray-400">Ledger Client Name:</span>
              <strong className="text-slate-800">{lastCreatedInvoice.customer_name}</strong>
            </div>
            <div className="flex justify-between font-mono">
              <span className="text-gray-400">Total Net Amount:</span>
              <span className="font-bold text-gray-900">{formatAmount(lastCreatedInvoice.net_amount)}</span>
            </div>
            {lastCreatedInvoice.net_amount > lastCreatedInvoice.received_amount && (
              <div className="flex justify-between font-mono text-sky-600 bg-sky-50 p-1.5 rounded font-bold">
                <span>Accounts receivable balance due:</span>
                <span>{formatAmount(lastCreatedInvoice.net_amount - lastCreatedInvoice.received_amount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Selected payment method:</span>
              <span className="uppercase font-bold text-slate-600">{lastCreatedInvoice.payment_method}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full pt-2">
            <button
              onClick={() => generateInvoicePDF(lastCreatedInvoice)}
              className="w-full py-2 bg-slate-800 hover:bg-[#111C30] text-white text-xs font-black uppercase tracking-wider rounded shadow flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Invoice PDF</span>
            </button>

            <button
              onClick={() => handleWhatsAppShare(lastCreatedInvoice)}
              className="w-full py-2.5 bg-[#25D366] hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-wider rounded shadow flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Share on WhatsApp</span>
            </button>
          </div>

          <div className="flex space-x-3 w-full">
            <button
              onClick={() => setViewState('list')}
              className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded transition cursor-pointer"
            >
              Back to Invoices
            </button>
            <button
              onClick={() => {
                setViewState('new');
                setCart([]);
                setSelectedPartyId(null);
              }}
              className="flex-1 py-2 bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-bold uppercase tracking-wider rounded transition cursor-pointer"
            >
              + New Invoice
            </button>
          </div>

        </div>
      )}

      {/* BATCH MACHINE INVOICING MODAL */}
      {showMachineInvoicingModal && activeClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-sans" id="batch-machine-invoicing-modal-backdrop">
          <div className="bg-white w-full max-w-[800px] border-t-4 border-t-indigo-600 rounded-lg flex flex-col max-h-[90vh] shadow-2xl overflow-hidden animate-fadeIn">
            
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#E2DFDF] flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm uppercase tracking-wider font-bold text-[#2A2727] flex items-center space-x-1.5">
                  <Building className="w-4 h-4 text-indigo-600" />
                  <span>Batch Machine Invoicing</span>
                </h3>
                <p className="text-[10px] text-gray-400">Invoice requirements for multiple machines at once for <strong>{activeClient.name}</strong></p>
              </div>
              <button 
                onClick={() => setShowMachineInvoicingModal(false)} 
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Content body split into left list and right preview */}
            <div className="p-5 flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-5 gap-5 min-h-0">
              
              {/* Left Column: Machine Selector Checkboxes (2 columns wide) */}
              <div className="md:col-span-2 space-y-3 flex flex-col min-h-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  Step 1: Select 2 or More Machines
                </span>
                
                <div className="flex-1 overflow-y-auto border border-slate-200 rounded p-2.5 space-y-2 bg-slate-50/50 max-h-[50vh] md:max-h-full">
                  {activeClient.machines?.map(m => {
                    const isChecked = selectedMachineIds.includes(m.id);
                    return (
                      <label 
                        key={m.id} 
                        className={`flex items-start p-2 rounded border transition cursor-pointer select-none text-xs ${
                          isChecked 
                            ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900 font-bold' 
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedMachineIds(prev => prev.filter(id => id !== m.id));
                            } else {
                              setSelectedMachineIds(prev => [...prev, m.id]);
                            }
                          }}
                          className="mt-0.5 mr-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="space-y-0.5">
                          <span className="block font-sans text-[11px] leading-tight font-black">{m.name}</span>
                          <span className="block text-[9.5px] text-gray-400 font-mono font-medium">{m.type_model || 'Model N/A'}</span>
                          <span className="block text-[9px] text-indigo-500 font-mono font-bold">
                            📦 {m.filters?.length || 0} Filter Requirements
                          </span>
                        </div>
                      </label>
                    );
                  })}
                  {(!activeClient.machines || activeClient.machines.length === 0) && (
                    <p className="text-center text-gray-400 italic py-6 text-[11px]">No machines registered for this client.</p>
                  )}
                </div>
              </div>

              {/* Right Column: Aggregated Items Preview & Adjuster (3 columns wide) */}
              <div className="md:col-span-3 space-y-3 flex flex-col min-h-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  Step 2: Preview, Deselect & Adjust Prices/Quantities
                </span>
                
                <div className="flex-1 overflow-y-auto border border-slate-200 rounded bg-white min-h-[30vh] max-h-[50vh] md:max-h-full">
                  <table className="w-full text-[11px] font-mono text-left divide-y divide-slate-100">
                    <thead className="bg-slate-50 text-[9.5px] font-black text-slate-500 uppercase sticky top-0 z-10">
                      <tr>
                        <th className="p-2 w-8 text-center">Include</th>
                        <th className="p-2">Item Info</th>
                        <th className="p-2 text-center w-24">Qty</th>
                        <th className="p-2 text-right w-24">Price (Rs.)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {modalCartItems.map(item => (
                        <tr 
                          key={item.product_id} 
                          className={`hover:bg-slate-50/50 ${!item.checked ? 'opacity-40 bg-slate-50/30' : ''}`}
                        >
                          {/* Toggle Include */}
                          <td className="p-2 text-center">
                            <input 
                              type="checkbox"
                              checked={item.checked}
                              onChange={() => handleToggleModalItem(item.product_id)}
                              className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          
                          {/* Info */}
                          <td className="p-2 font-sans">
                            <span className="font-mono font-bold text-slate-800 block text-[11.5px] leading-tight">
                              {item.part_number}
                            </span>
                            <span className="text-[9px] text-slate-400 block mt-0.5 font-medium">
                              Brand: <strong className="text-gray-500">{item.brand}</strong>
                            </span>
                            <span className="text-[8.5px] text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded font-bold inline-block mt-1 font-mono">
                              ⚙️ {item.machine_names.join(', ')}
                            </span>
                          </td>
                          
                          {/* Qty edit */}
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                type="button"
                                disabled={!item.checked}
                                onClick={() => handleUpdateModalItemQty(item.product_id, item.qty - 1)}
                                className="w-5 h-5 border bg-slate-100 text-slate-600 rounded font-bold hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                disabled={!item.checked}
                                value={item.qty}
                                onChange={e => handleUpdateModalItemQty(item.product_id, parseInt(e.target.value) || 1)}
                                className="w-8 p-0.5 text-center border font-mono font-bold rounded text-xs disabled:opacity-40"
                              />
                              <button
                                type="button"
                                disabled={!item.checked}
                                onClick={() => handleUpdateModalItemQty(item.product_id, item.qty + 1)}
                                className="w-5 h-5 border bg-slate-100 text-slate-600 rounded font-bold hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          
                          {/* Price edit */}
                          <td className="p-2 text-right">
                            <input 
                              type="number"
                              min="0"
                              disabled={!item.checked}
                              value={item.sale_price}
                              onChange={e => handleUpdateModalItemPrice(item.product_id, parseFloat(e.target.value) || 0)}
                              className="w-20 p-1 text-right border rounded font-mono font-bold text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-40"
                            />
                            {item.sale_price !== item.original_default_price && item.checked && (
                              <span className="text-[8px] text-amber-600 font-bold block mt-0.5">
                                Std: Rs.{item.original_default_price}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {modalCartItems.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-gray-400 italic text-[11px] font-sans">
                            {selectedMachineIds.length === 0 
                              ? 'Select at least one machine from the left panel.' 
                              : 'No requirements defined for selected machines.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Footer with actions and summary */}
            <div className="px-5 py-3 border-t border-[#E2DFDF] bg-slate-50 flex flex-wrap items-center justify-between gap-3 font-sans">
              <div className="text-xs">
                <span className="text-slate-500">Selected Machines:</span>{' '}
                <strong className="text-slate-800 font-bold">{selectedMachineIds.length}</strong>
                <span className="mx-2 text-slate-300">|</span>
                <span className="text-slate-500">Aggregated Items:</span>{' '}
                <strong className="text-indigo-700 font-bold">
                  {modalCartItems.filter(item => item.checked).reduce((sum, item) => sum + item.qty, 0)} units
                </strong>
                <span className="mx-2 text-slate-300">|</span>
                <span className="text-slate-500">Batch Value:</span>{' '}
                <strong className="text-emerald-700 font-bold font-mono">
                  Rs. {modalCartItems.filter(item => item.checked).reduce((sum, item) => sum + (item.sale_price * item.qty), 0).toLocaleString()}
                </strong>
              </div>
              
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowMachineInvoicingModal(false)}
                  className="px-4 py-2 border border-slate-350 hover:bg-slate-100 text-[#2A2727] text-xs font-bold uppercase rounded cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLoadModalItemsToCart}
                  disabled={modalCartItems.filter(item => item.checked).length === 0}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white text-xs font-bold uppercase rounded cursor-pointer transition shadow-md shadow-indigo-100 flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Load into Invoice Cart</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* DISCOVER & SAVE FLOW ON-THE-FLY CROSS REF MODAL */}
      {showDiscoverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-sans" id="discover-modal-backdrop">
          <div className="bg-white w-full max-w-[500px] border-t-4 border-t-amber-500 rounded-lg flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
            
            <div className="px-5 py-4 border-b border-[#E2DFDF] flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm uppercase tracking-wider font-bold text-[#2A2727] flex items-center space-x-1">
                  <Link2 className="w-4 h-4 text-amber-500 text-amber-600" />
                  <span>On-The-Fly cross-reference maker</span>
                </h3>
                <p className="text-[10px] text-gray-400">Connecting unregistered buyer items permanently</p>
              </div>
              <button 
                onClick={() => setShowDiscoverModal(false)} 
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto text-xs space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-3 text-amber-800 rounded flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                <span>Product code <strong>"{unknownCode.toUpperCase()}"</strong> was brought by customer. Link to existing standard equivalent database entry below:</span>
              </div>

              <div>
                <label className="block text-gray-600 font-bold mb-1">Set code/spec manufacturer brand</label>
                <input 
                  type="text" 
                  value={discoverBrand}
                  onChange={e => setDiscoverBrand(e.target.value)}
                  placeholder="e.g. CAT, Cummins, Baldwin, Perkins"
                  className="w-full text-xs p-2 border border-[#E2DFDF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-600 font-bold mb-1">Search stock catalog equivalent</label>
                <div className="relative">
                  <input 
                    type="text"
                    value={discoverSearchQuery}
                    onChange={e => setDiscoverSearchQuery(e.target.value)}
                    placeholder="Search Sakura stock code or grade (e.g. C-6204)..."
                    className="w-full text-xs p-2 pl-8 border border-[#E2DFDF]"
                  />
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-3" />
                </div>

                {discoverSearchQuery.trim().length > 0 && !selectedMatchProduct && (
                  <div className="mt-1 border border-[#E2DFDF] max-h-36 overflow-y-auto divide-y bg-white rounded-sm">
                    {products
                      .filter(p => (p.part_number_norm || normalizeCode(p.part_number || '')).includes(normalizeCode(discoverSearchQuery)))
                      .map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedMatchProduct(p)}
                          className="w-full text-left p-2 hover:bg-slate-50 flex justify-between items-center"
                        >
                          <span className="font-bold font-mono text-gray-800">{p.brand} {p.part_number}</span>
                          <span className="text-gray-400 text-[10px]">Shelf location: {p.shelf_location || 'N/A'}</span>
                        </button>
                      ))}
                    {products.filter(p => (p.part_number_norm || normalizeCode(p.part_number || '')).includes(normalizeCode(discoverSearchQuery))).length === 0 && (
                      <p className="p-2 text-center text-gray-400 italic font-mono text-[10px]">No catalog match found</p>
                    )}
                  </div>
                )}
              </div>

              {selectedMatchProduct && (
                <div className="mt-3 space-y-3">
                  <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded text-emerald-800 flex justify-between items-center">
                    <div>
                      <p className="text-[9px] uppercase font-bold text-emerald-700">Matched Catalog Equivalent</p>
                      <p className="font-bold font-mono text-sm">{selectedMatchProduct.brand} {selectedMatchProduct.part_number}</p>
                    </div>
                    <button 
                      onClick={() => setSelectedMatchProduct(null)} 
                      className="text-xs text-[#0ea5e9] underline font-semibold cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  <p className="font-bold text-[#2A2727] text-[10px] uppercase">Specify substitute match sincerity</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setDiscoverMatchType('exact_match')}
                      className={`p-2 border rounded text-left transition ${
                        discoverMatchType === 'exact_match' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200'
                      }`}
                    >
                      <p className="font-bold text-emerald-700">Exact match substitution</p>
                      <p className="text-[9px] text-gray-400 pt-0.5 leading-normal">Identical design parameters.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDiscoverMatchType('compatible')}
                      className={`p-2 border rounded text-left transition ${
                        discoverMatchType === 'compatible' ? 'border-amber-500 bg-amber-50' : 'border-slate-200'
                      }`}
                    >
                      <p className="font-bold text-amber-700">Compatible alternate</p>
                      <p className="text-[9px] text-gray-400 pt-0.5 leading-normal">Different build casing but functions.</p>
                    </button>
                  </div>
                </div>
              )}

            </div>

            <div className="px-5 py-3 bg-slate-50 border-t flex justify-end space-x-2">
              <button 
                onClick={() => setShowDiscoverModal(false)} 
                className="px-3 py-1.5 border hover:bg-slate-100 text-gray-500 rounded"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveDiscoveryAndAddLine} 
                disabled={!selectedMatchProduct}
                className="px-5 py-1.5 bg-[#0EA5E9] text-white font-bold hover:bg-sky-600 disabled:bg-slate-150 disabled:text-slate-400 rounded transition"
              >
                Assemble & Add to Cart
              </button>
            </div>

          </div>
        </div>
      )}

      {/* =======================================================
          VIEW STATE EXTRA: DETAILED INVOICE DIALOG OVERLAY
          ======================================================= */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-sans" id="invoice-detail-backdrop">
          <div className="bg-white w-full max-w-[640px] border-t-4 border-t-[#0EA5E9] rounded-lg flex flex-col max-h-[90vh] shadow-2xl overflow-hidden animate-fadeIn">
            
            <div className="px-5 py-4 border-b border-[#E2DFDF] flex items-center justify-between bg-slate-50">
              <div>
                <span className="text-[9px] uppercase font-black bg-[#0EA5E9] text-white px-2 py-0.5 rounded-sm">
                  Ledger Archives
                </span>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight mt-1">
                  Invoice {selectedInvoice.invoice_number}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedInvoice(null)} 
                className="text-gray-400 hover:text-gray-650 font-bold p-1 cursor-pointer text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto text-xs space-y-4">
              {/* Top Row grid */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50/50 p-3 border rounded-lg">
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-400">Recipient Name</p>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedInvoice.customer_name}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-400">Date Logged</p>
                  <p className="font-bold text-slate-800 mt-0.5">{new Date(selectedInvoice.timestamp).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-400">Payment Status / Method</p>
                  <p className="font-bold text-[#0EA5E9] mt-0.5 uppercase">
                    {selectedInvoice.payment_method || 'cash'} - {selectedInvoice.payment_status || 'paid'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-400">Sales Operator</p>
                  <p className="font-bold text-slate-800 mt-0.5">staff ({selectedInvoice.user})</p>
                </div>
                {selectedInvoice.is_tax_invoice && selectedInvoice.ntn_number && (
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400">NTN Number</p>
                    <p className="font-bold text-slate-800 mt-0.5 font-mono select-all uppercase">{selectedInvoice.ntn_number}</p>
                  </div>
                )}
              </div>

              {/* Items List inside Modal */}
              <div className="space-y-2">
                <p className="font-bold uppercase tracking-wider text-[10px] text-gray-400">Line Items Registry</p>
                <div className="border rounded overflow-hidden divide-y">
                  <div className="grid grid-cols-12 gap-2 bg-slate-100 p-2 font-bold text-slate-700">
                    <span className="col-span-8">Specs / Part Number</span>
                    <span className="col-span-1 text-right">Qty</span>
                    <span className="col-span-3 text-right">Total</span>
                  </div>
                  {selectedInvoice.items.map((it) => (
                    <div key={it.id} className="grid grid-cols-12 gap-2 p-2 text-slate-800 font-mono items-center hover:bg-slate-50">
                      <span className="col-span-8 font-bold">{it.part_number}</span>
                      <span className="col-span-1 text-right">{it.qty}</span>
                      <span className="col-span-3 text-right font-bold text-slate-900">
                        {formatAmount(it.line_total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sales Returns History inside Modal */}
              {returns.filter(r => r.invoice_id === selectedInvoice.id).length > 0 && (
                <div className="space-y-3 bg-red-50/40 p-4 border border-red-200/60 rounded-lg animate-fadeIn">
                  <p className="font-bold uppercase tracking-wider text-[10px] text-red-800 flex items-center">
                    <Undo2 className="w-3.5 h-3.5 mr-1" /> Returns & Credit Notes History
                  </p>
                  
                  <div className="space-y-3.5 divide-y divide-red-100">
                    {returns.filter(r => r.invoice_id === selectedInvoice.id).map((ret, idx) => (
                      <div key={ret.id} className={`space-y-2 text-xs ${idx > 0 ? 'pt-3' : ''}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-mono font-bold text-red-900">{ret.return_number}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase bg-red-100 text-red-850">
                            {ret.type}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-600 font-mono">
                          Date: {new Date(ret.timestamp).toLocaleString()} • Credit Issued: <strong className="text-red-950">{formatAmount(ret.credit_amount)}</strong>
                        </div>
                        <div className="bg-white p-2.5 border border-red-100 rounded text-[11px] space-y-1">
                          <div>
                            <span className="font-semibold text-gray-500 uppercase tracking-wider text-[9px] block">Reason for Return</span>
                            <span className="text-gray-800 font-medium">{ret.reason}</span>
                          </div>
                          {ret.notes && (
                            <div>
                              <span className="font-semibold text-gray-500 uppercase tracking-wider text-[9px] block">Notes</span>
                              <span className="text-gray-750 font-mono text-[10px] italic">{ret.notes}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Returned Items */}
                        <div className="space-y-1.5 pl-1">
                          <span className="text-[9px] font-black uppercase text-red-700 block">Returned Items Ledger:</span>
                          <div className="space-y-1 font-mono text-[10px]">
                            {ret.items.map(itm => (
                              <div key={itm.id} className="flex justify-between text-red-950 bg-red-50/50 p-1.5 rounded-sm border border-red-100/30">
                                <span>{itm.part_number}</span>
                                <span className="font-bold text-red-900">Qty Returned: {itm.qty_returned} ({itm.condition})</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Replacement Item if any */}
                        {ret.replacement_item && (
                          <div className="space-y-1.5 pl-1">
                            <span className="text-[9px] font-black uppercase text-emerald-700 block">Dispatched Replacement:</span>
                            <div className="flex justify-between text-emerald-950 font-mono text-[10px] bg-emerald-50/50 p-1.5 rounded-sm border border-emerald-100/50">
                              <span>{ret.replacement_item.part_number}</span>
                              <span className="font-bold text-emerald-800">Qty Sent: {ret.replacement_item.qty}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary Valuation */}
              <div className="flex justify-end pt-2">
                <div className="w-1/2 space-y-1.5 font-mono text-right text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Subtotal:</span>
                    <span className="text-slate-800">{formatAmount(selectedInvoice.total_amount)}</span>
                  </div>
                  {selectedInvoice.discount > 0 && (
                    <div className="flex justify-between text-sky-600">
                      <span>Discount:</span>
                      <span>-{formatAmount(selectedInvoice.discount)}</span>
                    </div>
                  )}
                  {selectedInvoice.is_tax_invoice && selectedInvoice.tax_amount && (
                    <div className="flex justify-between text-[#0EA5E9] font-semibold">
                      <span>FBR GST ({selectedInvoice.tax_rate ?? 18}%):</span>
                      <span>+{formatAmount(selectedInvoice.tax_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold border-t pt-1.5 text-slate-900">
                    <span>Net Valuation:</span>
                    <span>{formatAmount(selectedInvoice.net_amount)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5 text-emerald-800 font-bold bg-emerald-50/50 p-1 rounded">
                    <span>Amount Paid:</span>
                    <span>{formatAmount(selectedInvoice.received_amount)}</span>
                  </div>
                  {selectedInvoice.net_amount - selectedInvoice.received_amount > 0 && (
                    <div className="flex justify-between text-sky-600 font-bold bg-sky-50 p-1 rounded">
                      <span>Ref Deferred Due:</span>
                      <span>{formatAmount(selectedInvoice.net_amount - selectedInvoice.received_amount)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 bg-slate-50 border-t flex flex-col sm:flex-row justify-between gap-3">
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => generateInvoicePDF(selectedInvoice)}
                  className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 text-white font-extrabold text-[10.5px] uppercase tracking-wider rounded shadow hover:bg-[#111C30] transition flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>

                <button
                  onClick={() => handleWhatsAppShare(selectedInvoice)}
                  className="flex-1 sm:flex-none px-4 py-2 bg-[#25D366] text-white font-extrabold text-[10.5px] uppercase tracking-wider rounded shadow hover:bg-emerald-600 transition flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>WhatsApp Share</span>
                </button>
              </div>

              <button 
                onClick={() => setSelectedInvoice(null)} 
                className="px-4 py-2 border hover:bg-slate-100 text-gray-500 rounded font-bold uppercase tracking-wide text-[10px] cursor-pointer"
              >
                Close View
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
