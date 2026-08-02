import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  Plus, 
  Search, 
  DollarSign, 
  Calendar, 
  Clock, 
  Ban, 
  Check, 
  Building, 
  Undo2, 
  Package,
  Eye,
  EyeOff,
  ShoppingBag,
  ArrowRight,
  Calculator,
  AlertCircle
} from 'lucide-react';
import { db, saveItem, encodeCipher } from '../data';
import { 
  Product, 
  Party, 
  PurchaseOrder, 
  PurchaseOrderItem, 
  ProcurementJob, 
  StockMovement,
  PaymentRecord,
  RareImportDemand
} from '../types';

interface PurchasesViewProps {
  userRole: 'Owner' | 'Staff';
  cipherKey: string;
  revealRealValues: boolean;
}

type TabType = 'po' | 'suppliers' | 'proc_jobs' | 'reorder' | 'rare_demands';
type SubViewType = 'list' | 'new_po' | 'new_proc_job';

export default function PurchasesView({ 
  userRole, 
  cipherKey, 
  revealRealValues 
}: PurchasesViewProps) {
  // Navigation tabs & subviews
  const [activeTab, setActiveTab] = useState<TabType>('po');
  const [subView, setSubView] = useState<SubViewType>('list');

  // Core list datasets
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [procurementJobs, setProcurementJobs] = useState<ProcurementJob[]>([]);
  const [rareDemands, setRareDemands] = useState<RareImportDemand[]>([]);

  // Rare Demands states
  const [rareSearchQuery, setRareSearchQuery] = useState<string>('');
  const [rareStatusFilter, setRareStatusFilter] = useState<'all' | 'pending' | 'sourced' | 'ordered' | 'completed'>('all');
  
  // New Sourcing Demand Form
  const [newDemCustomerName, setNewDemCustomerName] = useState<string>('');
  const [newDemPhone, setNewDemPhone] = useState<string>('');
  const [newDemCompany, setNewDemCompany] = useState<string>('');
  const [newDemItemNumber, setNewDemItemNumber] = useState<string>('');
  const [newDemQtyDescr, setNewDemQtyDescr] = useState<string>('1 piece after every 1 month');
  const [newDemNotes, setNewDemNotes] = useState<string>('');
  const [newDemBrandTargeted, setNewDemBrandTargeted] = useState<string>('Baldwin');

  // Selection states
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Party | null>(null);

  // Goods receiving process state
  const [isReceivingMode, setIsReceivingMode] = useState<boolean>(false);
  const [receivingQuantities, setReceivingQuantities] = useState<{[key: string]: number}>({});
  const [receivingCosts, setReceivingCosts] = useState<{[key: string]: number}>({});
  const [costNotIdentifiedHold, setCostNotIdentifiedHold] = useState<boolean>(false);

  // Reorder list checkboxes and custom quantities
  const [selectedReorderIds, setSelectedReorderIds] = useState<string[]>([]);
  const [reorderQuantities, setReorderQuantities] = useState<{[key: string]: number}>({});

  // Payment popup logic
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<'cash' | 'bank' | 'cheque'>('cash');
  const [payNotes, setPayNotes] = useState<string>('');

  // Creation forms states (New PO & New Job)
  const [newPoSupplier, setNewPoSupplier] = useState<string>('');
  const [newPoSearchProduct, setNewPoSearchProduct] = useState<string>('');
  const [newPoLines, setNewPoLines] = useState<{
    product_id: string;
    part_number: string;
    brand: string;
    qty: number;
    agreed_cost: number;
  }[]>([]);
  const [newPoDeliveryDate, setNewPoDeliveryDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [newPoDiscount, setNewPoDiscount] = useState<number>(0);
  const [newPoNotes, setNewPoNotes] = useState<string>('');

  // Delete/Cancel PO states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [deleteReason, setDeleteReason] = useState<string>('Ordered by Mistake / Wrong Items');
  const [deleteCustomReason, setDeleteCustomReason] = useState<string>('');

  const [newJobClient, setNewJobClient] = useState<string>('');
  const [newJobDesc, setNewJobDesc] = useState<string>('');
  const [newJobQty, setNewJobQty] = useState<number>(1);
  const [newJobCost, setNewJobCost] = useState<number>(0);
  const [newJobBill, setNewJobBill] = useState<number>(0);
  const [newJobNotes, setNewJobNotes] = useState<string>('');

  // Loaded alerts counts
  const [reorderSuggestionsCount, setReorderSuggestionsCount] = useState<number>(0);

  // Load backend data
  const loadData = () => {
    const pos = db.getPurchaseOrders();
    const parties = db.getParties().filter(p => p.type === 'supplier' || p.is_supplier_linked === true);
    const prods = db.getProducts();
    const jobs = db.getProcurementJobs();
    const demands = db.getRareImportDemands();

    setPurchaseOrders(pos);
    setSuppliers(parties);
    setProducts(prods);
    setProcurementJobs(jobs);
    setRareDemands(demands);

    // Filter reorder suggestions
    const reorderItems = prods.filter(p => p.stock_qty <= p.min_stock_alert);
    setReorderSuggestionsCount(reorderItems.length);

    // If there's a selected PO, refresh it from source
    if (selectedPO) {
      const refreshed = pos.find(p => p.id === selectedPO.id);
      if (refreshed) {
        setSelectedPO(refreshed);
      }
    }

    // Refresh selected supplier too
    if (selectedSupplier) {
      const refreshedSupp = db.getParties().find(p => p.id === selectedSupplier.id);
      if (refreshedSupp) {
        setSelectedSupplier(refreshedSupp);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [subView, activeTab]);

  useEffect(() => {
    const selectedPoId = localStorage.getItem('kfh_selected_po_id');
    if (selectedPoId) {
      const found = purchaseOrders.find(p => p.id === selectedPoId);
      if (found) {
        setSelectedPO(found);
        localStorage.removeItem('kfh_selected_po_id');
      }
    }
  }, [purchaseOrders]);

  // Pre-fill reorder suggestions on tab open
  useEffect(() => {
    if (activeTab === 'reorder') {
      const lowStockProds = products.filter(p => p.stock_qty <= p.min_stock_alert);
      setSelectedReorderIds(lowStockProds.map(p => p.id));
      
      const defaultQties: {[key: string]: number} = {};
      lowStockProds.forEach(p => {
        defaultQties[p.id] = Math.max(5, (p.min_stock_alert || 5) * 3);
      });
      setReorderQuantities(defaultQties);
    }
  }, [activeTab, products]);

  // Special rare/imported demands management
  const handleCreateRareDemand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDemCustomerName || !newDemPhone || !newDemItemNumber) {
      alert("Please enter Customer Name, Phone Number, and their brought Item/Part Number.");
      return;
    }

    const newDemand: RareImportDemand = {
      id: "dem-" + Date.now(),
      demand_number: "DEM-" + new Date().getFullYear() + "-" + String(rareDemands.length + 1).padStart(4, '0'),
      customer_name: newDemCustomerName,
      phone: newDemPhone,
      company_name: newDemCompany || 'Walk-in Workshop',
      customer_item_number: newDemItemNumber,
      demand_qty_descr: newDemQtyDescr,
      notes: newDemNotes,
      status: 'pending',
      brand_targeted: newDemBrandTargeted,
      date: new Date().toISOString().split('T')[0],
      user: userRole,
      is_active: true
    };

    db.saveRareImportDemand(newDemand);
    
    // Clear form
    setNewDemCustomerName('');
    setNewDemPhone('');
    setNewDemCompany('');
    setNewDemItemNumber('');
    setNewDemQtyDescr('1 piece after every 1 month');
    setNewDemNotes('');
    setNewDemBrandTargeted('Baldwin');

    loadData();
    db.logPendingSync(`New Imported demand ${newDemand.demand_number} for ${newDemand.customer_name} added`);
  };

  const handleUpdateRareDemandStatus = (id: string, newStatus: 'pending' | 'sourced' | 'ordered' | 'completed') => {
    const raw = localStorage.getItem('kfh_rare_demands') || '[]';
    try {
      const demands = JSON.parse(raw);
      const idx = demands.findIndex((d: any) => d.id === id);
      if (idx >= 0) {
        demands[idx].status = newStatus;
        saveItem('kfh_rare_demands', JSON.stringify(demands), `Rare Demand status changed to ${newStatus}`);
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRareDemand = (id: string) => {
    const raw = localStorage.getItem('kfh_rare_demands') || '[]';
    try {
      const demands = JSON.parse(raw);
      const idx = demands.findIndex((d: any) => d.id === id);
      if (idx >= 0) {
        demands[idx].is_active = false;
        saveItem('kfh_rare_demands', JSON.stringify(demands), `Rare Demand deleted`);
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Pricing cipher/reveal helper method
  const formatCostValue = (val: number) => {
    return revealRealValues ? `Rs. ${val.toLocaleString()}` : encodeCipher(val, cipherKey);
  };

  // Switch to Receive Goods mode
  const startReceiving = (po: PurchaseOrder) => {
    const qtys: {[key: string]: number} = {};
    const costs: {[key: string]: number} = {};
    po.items.forEach(item => {
      // prefill remaining items to receive
      const remaining = Math.max(0, item.qty_ordered - item.qty_received);
      qtys[item.id] = remaining;
      costs[item.id] = item.actual_cost || item.agreed_cost;
    });
    setReceivingQuantities(qtys);
    setReceivingCosts(costs);
    
    // Auto-hold if any item cost was flagged as not identified
    const hasUnidentified = po.cost_not_identified_on_hold || po.items.some(item => item.cost_not_identified);
    setCostNotIdentifiedHold(hasUnidentified);
    setIsReceivingMode(true);
  };

  // Finish goods receipt processing
  const handleConfirmReceipt = (po: PurchaseOrder) => {
    const allProducts = db.getAllProductsWithDeleted();
    
    const updatedItems = po.items.map(item => {
      const inputQty = Number(receivingQuantities[item.id] || 0);
      const inputCost = Number(receivingCosts[item.id] || item.agreed_cost);
      
      if (inputQty > 0) {
        // Find product index to increase standard sellable stock
        const pIdx = allProducts.findIndex(p => p.id === item.product_id);
        if (pIdx >= 0) {
          allProducts[pIdx].stock_qty = (allProducts[pIdx].stock_qty || 0) + inputQty;
        }

        // Save a stock movement log
        db.saveMovement({
          product_id: item.product_id,
          qty_change: inputQty,
          from_status: 'none',
          to_status: 'sellable',
          type: 'purchased',
          user: userRole,
          reason: `Goods receipt for PO ${po.po_number}`
        });
      }

      return {
        ...item,
        qty_received: item.qty_received + inputQty,
        actual_cost: inputCost
      };
    });

    // Check new overall status
    const totalOrdered = updatedItems.reduce((acc, current) => acc + current.qty_ordered, 0);
    const totalReceived = updatedItems.reduce((acc, current) => acc + current.qty_received, 0);
    
    let newStatus: 'draft' | 'in_progress' | 'received' = po.status;
    if (totalReceived >= totalOrdered) {
      newStatus = 'received';
    } else if (totalReceived > 0) {
      newStatus = 'in_progress';
    }

    // Accumulate actual total receipt bills if we want, but keeping it simpler:
    // Update supplier outstanding credit balance: negative represents credit owing (we owe them more)
    // Every time we receive goods, our payable increases. Therefore we deduct from credit_balance (make it more negative).
    const differenceValue = updatedItems.reduce((sum, item) => {
      const receivedThisTime = Number(receivingQuantities[item.id] || 0);
      const costUsed = Number(receivingCosts[item.id] || item.agreed_cost);
      return sum + (receivedThisTime * costUsed);
    }, 0);

    const updatedParties = db.getParties();
    const sIdx = updatedParties.findIndex(p => p.id === po.supplier_id);
    
    let postedPayable = differenceValue;
    let deferredPayable = 0;

    if (costNotIdentifiedHold) {
      postedPayable = 0;
      deferredPayable = differenceValue;
    }

    if (sIdx >= 0 && postedPayable > 0) {
      updatedParties[sIdx].credit_balance -= postedPayable;
      db.saveParties(updatedParties);
    }

    const updatedPO: PurchaseOrder = {
      ...po,
      items: updatedItems,
      status: newStatus,
      received_amount: po.received_amount + differenceValue,
      cost_not_identified_on_hold: po.cost_not_identified_on_hold || costNotIdentifiedHold,
      held_deferred_amount: (po.held_deferred_amount || 0) + deferredPayable
    };

    db.saveProducts(allProducts);
    db.savePurchaseOrder(updatedPO);
    
    setIsReceivingMode(false);
    setSelectedPO(updatedPO);
    loadData();
    
    if (costNotIdentifiedHold) {
      alert(`Goods received successfully! Stock levels for received items have increased immediately. Financial payable of Rs. ${deferredPayable.toLocaleString()} is placed ON HOLD (No payment is yet owed to ${po.supplier_name} for this receive).`);
    } else {
      alert('Goods received successfully! Stock levels and supplier payable accounts updated.');
    }
  };

  // Release previously deferred cost not identified bill hold
  const handleReleaseDeferredCost = (po: PurchaseOrder) => {
    if (!po.cost_not_identified_on_hold || !po.held_deferred_amount || po.held_deferred_amount <= 0) {
      alert("This purchase order has no pending deferred bill costs on hold.");
      return;
    }

    const confirmRelease = window.confirm(
      `Are you sure you want to release the deferred accounts payable of Rs. ${po.held_deferred_amount.toLocaleString()} for PO ${po.po_number}?\n\nThis will post the outstanding dues to the supplier's balance, recording that you owe this amount.`
    );

    if (!confirmRelease) return;

    const updatedParties = db.getParties();
    const sIdx = updatedParties.findIndex(p => p.id === po.supplier_id);
    if (sIdx >= 0) {
      updatedParties[sIdx].credit_balance -= po.held_deferred_amount;
      db.saveParties(updatedParties);
    }

    const updatedPO: PurchaseOrder = {
      ...po,
      cost_not_identified_on_hold: false,
      held_deferred_amount: 0
    };

    db.savePurchaseOrder(updatedPO);
    setSelectedPO(updatedPO);
    loadData();
    alert(`Accounts payable of Rs. ${po.held_deferred_amount.toLocaleString()} has been successfully posted to ${po.supplier_name}'s account ledger!`);
  };

  // Schedule Purchase Order for Deletion
  const handleScheduleDeletion = () => {
    if (!selectedPO) return;
    const finalReason = deleteReason === 'Other' ? (deleteCustomReason.trim() || 'Manual deletion request') : deleteReason;
    
    const updatedPO: PurchaseOrder = {
      ...selectedPO,
      is_deletion_scheduled: true,
      deletion_scheduled_at: new Date().toISOString(),
      deletion_reason: finalReason
    };
    
    db.savePurchaseOrder(updatedPO);
    setSelectedPO(updatedPO);
    setShowDeleteConfirm(false);
    setDeleteCustomReason('');
    
    db.logPendingSync(`Scheduled PO ${selectedPO.po_number} for deletion due to: ${finalReason}`);
    loadData();
    alert(`Purchase order ${selectedPO.po_number} has been successfully scheduled for automated deletion. It is marked as 'sent for deleting' and will be permanently deleted after 3 days.`);
  };

  // Cancel Deletion Schedule
  const handleCancelDeletion = (po: PurchaseOrder) => {
    const updatedPO: PurchaseOrder = {
      ...po,
      is_deletion_scheduled: false,
      deletion_scheduled_at: undefined,
      deletion_reason: undefined
    };
    db.savePurchaseOrder(updatedPO);
    setSelectedPO(updatedPO);
    db.logPendingSync(`Cancelled deletion schedule for PO ${po.po_number}`);
    loadData();
    alert(`Deletion schedule for PO ${po.po_number} has been cancelled successfully.`);
  };

  // Create Supplier Payment
  const handlePaySupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    const amount = Number(payAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Kindly enter a valid payment amount greater than zero.');
      return;
    }

    const newPayment: PaymentRecord = {
      id: "pay-" + Date.now(),
      party_id: selectedSupplier.id,
      party_name: selectedSupplier.name,
      amount,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      method: payMethod,
      notes: payNotes,
      user: userRole,
      type: 'payment' // outgoing to supplier
    };

    db.savePaymentAndSync(newPayment);

    // Add cash Transaction to Cash Book (automatic inside savePaymentAndSync if cash, 
    // but handle accounts & registers integration automatically)
    setShowPaymentModal(false);
    setPayAmount('');
    setPayNotes('');
    loadData();
    alert(`Payment of Rs. ${amount.toLocaleString()} logged correctly for ${selectedSupplier.name}. Outstanding payable reduced.`);
  };

  // New PO Screen logic
  const handleAddNewPoLine = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    // Check if duplicate
    if (newPoLines.some(line => line.product_id === productId)) {
      alert("This product is already selected in the items table grid below.");
      return;
    }

    setNewPoLines([
      ...newPoLines,
      {
        product_id: prod.id,
        part_number: prod.part_number,
        brand: prod.brand,
        qty: 10,
        agreed_cost: prod.cost_price || 0,
        cost_not_identified: false
      }
    ]);
    setNewPoSearchProduct('');
  };

  const handleCreatePurchaseOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPoSupplier) {
      alert("Please select a active Supplier to initiate the Purchase Order.");
      return;
    }
    if (newPoLines.length === 0) {
      alert("Please select at least one Product item to create the PO listing.");
      return;
    }

    const selectedSupp = db.getParties().find(p => p.id === newPoSupplier);
    if (!selectedSupp) return;

    // Build PO
    const finalLines: PurchaseOrderItem[] = newPoLines.map((line, idx) => ({
      id: `poi-custom-${Date.now()}-${idx}`,
      product_id: line.product_id,
      part_number: line.part_number,
      brand: line.brand,
      qty_ordered: line.qty,
      qty_received: 0,
      agreed_cost: line.cost_not_identified ? 0 : line.agreed_cost,
      line_total: line.cost_not_identified ? 0 : (line.qty * line.agreed_cost),
      cost_not_identified: line.cost_not_identified
    }));

    const rawTotal = finalLines.reduce((acc, curr) => acc + curr.line_total, 0);
    const netTotal = Math.max(0, rawTotal - newPoDiscount);

    // If any item is flagged as cost not identified, we can note it at PO level as well
    const hasCostHolding = finalLines.some(item => item.cost_not_identified);

    const newPO: PurchaseOrder = {
      id: `po-${Date.now()}`,
      po_number: `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      supplier_id: selectedSupp.id,
      supplier_name: selectedSupp.name,
      status: 'in_progress', // immediately in_progress as active tracking
      order_date: new Date().toISOString().split('T')[0],
      expected_date: newPoDeliveryDate,
      items: finalLines,
      total_amount: rawTotal,
      discount: newPoDiscount,
      net_amount: netTotal,
      received_amount: 0,
      is_active: true,
      user: userRole,
      cost_not_identified_on_hold: hasCostHolding,
      held_deferred_amount: 0 // initially 0 until items are received
    };

    db.savePurchaseOrder(newPO);

    // Reset fields
    setNewPoLines([]);
    setNewPoSupplier('');
    setNewPoDiscount(0);
    setNewPoNotes('');
    setSubView('list');
    setActiveTab('po');
    setSelectedPO(newPO);
    loadData();
    alert(`Purchase Order ${newPO.po_number} draft successfully created.`);
  };

  // Convert selected Reorder Suggestions items to a Purchase Order
  const handleBulkReorderPO = () => {
    if (selectedReorderIds.length === 0) return;

    // For simplicity, find the most frequent supplier, or let them pick the supplier.
    // We will group suggested products by their supplier or group them onto one PO.
    // Let's grab all products that match selected checkboxes
    const targetProds = products.filter(p => selectedReorderIds.includes(p.id));
    
    // We can auto-fill this into the New PO Screen! This is much more flexible.
    // Set lines:
    const autoLines = targetProds.map(p => ({
      product_id: p.id,
      part_number: p.part_number,
      brand: p.brand,
      qty: reorderQuantities[p.id] || (p.min_stock_alert * 3),
      agreed_cost: p.cost_price || 0
    }));

    setNewPoLines(autoLines);

    // Try to auto-resolve supplier from the first code suffix or ask supplier selection
    const potentialSupplierCode = targetProds[0]?.supplier_code || '';
    const matchedSupp = suppliers.find(s => 
      s.name.toLowerCase().includes(potentialSupplierCode.toLowerCase()) || 
      potentialSupplierCode.toLowerCase().includes(s.name.toLowerCase().slice(0, 5))
    );

    if (matchedSupp) {
      setNewPoSupplier(matchedSupp.id);
    }

    setSubView('new_po');
    alert("Reorder suggestions loaded securely! Please review the items list, select/confirm your supplier, and dispatch the PO.");
  };

  // Create Procurement Job logic
  const handleCreateProcurementJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobClient.trim()) {
      alert("Please specify a client/customer name for this job.");
      return;
    }
    if (!newJobDesc.trim()) {
      alert("Please describe the procurement item/materials to supply.");
      return;
    }

    const job_number = `JOB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newJob: ProcurementJob = {
      id: `job-${Date.now()}`,
      job_number,
      customer_name: newJobClient.trim(),
      item_description: newJobDesc.trim(),
      qty: newJobQty,
      status: 'pending',
      date: new Date().toISOString().split('T')[0],
      purchase_cost: newJobCost,
      billed_amount: newJobBill,
      notes: newJobNotes.trim(),
      user: userRole,
      is_active: true
    };

    db.saveProcurementJob(newJob);

    // Reset fields
    setNewJobClient('');
    setNewJobDesc('');
    setNewJobQty(1);
    setNewJobCost(0);
    setNewJobBill(0);
    setNewJobNotes('');

    setSubView('list');
    setActiveTab('proc_jobs');
    loadData();
    alert(`Procurement Job ${job_number} created successfully.`);
  };

  // Toggle completion of a Procurement Job
  const handleToggleJobStatus = (job: ProcurementJob, nextStatus: 'pending' | 'completed' | 'cancelled') => {
    const updatedJob: ProcurementJob = {
      ...job,
      status: nextStatus
    };
    db.saveProcurementJob(updatedJob);
    loadData();
    alert(`Procurement job status changed to ${nextStatus}.`);
  };

  // Calculations for stats rows
  const poDraftsCount = purchaseOrders.filter(p => p.status === 'draft').length;
  const poInProgressCount = purchaseOrders.filter(p => p.status === 'in_progress').length;
  const poReceivedCount = purchaseOrders.filter(p => p.status === 'received').length;
  const poTotalValue = purchaseOrders.reduce((sum, p) => sum + p.net_amount, 0);

  const totalPayableAmount = suppliers.reduce((sum, s) => {
    return sum + (s.credit_balance < 0 ? Math.abs(s.credit_balance) : 0);
  }, 0);

  const totalPurchasedValue = purchaseOrders
    .filter(p => p.status === 'received' || p.status === 'in_progress')
    .reduce((sum, p) => sum + p.received_amount, 0);

  const activeJobsCount = procurementJobs.length;
  const totalJobBilled = procurementJobs.reduce((sum, j) => sum + (j.billed_amount * j.qty), 0);
  const totalJobCost = procurementJobs.reduce((sum, j) => sum + (j.purchase_cost * j.qty), 0);
  const totalJobProfit = totalJobBilled - totalJobCost;

  return (
    <div className="space-y-4" id="purchases-module-root">
      
      {/* 7.1 Page Layout TOPBAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 border border-[#E2DFDF]" id="purchases-topbar">
        <div>
          <h2 className="text-base font-black uppercase text-slate-800 tracking-tight flex items-center">
            <Truck className="w-5 h-5 mr-2 text-[#0EA5E9]" />
            Purchases & Procurement Manage
          </h2>
          <p className="text-[11px] text-gray-500 font-medium">
            Manage purchase orders, goods receipt log sheets, suppliers payable, and customized procurement orders.
          </p>
        </div>

        {subView === 'list' ? (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setSubView('new_proc_job');
              }}
              className="bg-slate-100 hover:bg-slate-250 border border-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded text-xs uppercase tracking-wider flex items-center cursor-pointer transition-colors"
              id="new-job-topbar-btn"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              + Procurement Job
            </button>
            <button
              onClick={() => {
                setSubView('new_po');
              }}
              className="bg-[#0EA5E9] hover:bg-sky-600 text-white font-black px-4 py-1.5 rounded text-xs uppercase tracking-wider flex items-center cursor-pointer transition-colors"
              id="new-po-topbar-btn"
            >
              <Plus className="w-3.5 h-3.5 mr-1 text-white" />
              + Purchase Order
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSubView('list')}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold px-4 py-1.5 rounded text-xs uppercase flex items-center cursor-pointer"
            id="back-to-purchase-dashboard"
          >
            <Undo2 className="w-3.5 h-3.5 mr-1" />
            Back to Dashboard
          </button>
        )}
      </div>

      {subView === 'list' ? (
        <>
          {/* TABS SELECTOR */}
          <div className="flex border-b border-[#E2DFDF] bg-slate-50/80 px-2 rounded-t" id="purchases-tabs-container">
            <button
              onClick={() => { setActiveTab('po'); setSelectedPO(null); }}
              className={`py-3 px-4 font-bold text-xs uppercase border-b-2 -mb-[1px] tracking-wider transition-all duration-150 ${
                activeTab === 'po' 
                  ? 'border-[#0EA5E9] text-[#0EA5E9] bg-white border-x border-x-gray-250 font-black shadow-xs' 
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-slate-100/60'
              }`}
            >
              Purchase Orders
            </button>
            <button
              onClick={() => { setActiveTab('suppliers'); setSelectedSupplier(null); }}
              className={`py-3 px-4 font-bold text-xs uppercase border-b-2 -mb-[1px] tracking-wider transition-all duration-150 ${
                activeTab === 'suppliers' 
                  ? 'border-[#0EA5E9] text-[#0EA5E9] bg-white border-x border-x-gray-250 font-black shadow-xs' 
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-slate-100/60'
              }`}
            >
              Suppliers List
            </button>
            <button
              onClick={() => { setActiveTab('proc_jobs'); }}
              className={`py-3 px-4 font-bold text-xs uppercase border-b-2 -mb-[1px] tracking-wider transition-all duration-150 ${
                activeTab === 'proc_jobs' 
                  ? 'border-[#0EA5E9] text-[#0EA5E9] bg-white border-x border-x-gray-250 font-black shadow-xs' 
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-slate-100/60'
              }`}
            >
              Procurement Jobs
            </button>
            <button
              onClick={() => { setActiveTab('reorder'); }}
              className={`py-3 px-4 font-bold text-xs uppercase border-b-2 -mb-[1px] tracking-wider flex items-center transition-all duration-150 ${
                activeTab === 'reorder' 
                  ? 'border-[#0EA5E9] text-[#0EA5E9] bg-white border-x border-x-gray-250 font-black shadow-xs' 
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-slate-100/60'
              }`}
            >
              Reorder Suggestions
              {reorderSuggestionsCount > 0 && (
                <span className="ml-1.5 bg-[#0EA5E9] text-white px-1.5 py-0.2 text-[9px] rounded-full font-extrabold animate-pulse">
                  {reorderSuggestionsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab('rare_demands'); }}
              className={`py-3 px-4 font-bold text-xs uppercase border-b-2 -mb-[1px] tracking-wider flex items-center transition-all duration-150 ${
                activeTab === 'rare_demands' 
                  ? 'border-[#0EA5E9] text-[#0EA5E9] bg-white border-x border-x-gray-250 font-black shadow-xs' 
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-slate-100/60'
              }`}
            >
              ⭐ Imported Rare Demands
              {rareDemands.filter(d => d.status === 'pending').length > 0 && (
                <span className="ml-1.5 bg-amber-500 text-slate-900 px-1.5 py-0.2 text-[9px] rounded-full font-extrabold animate-bounce">
                  {rareDemands.filter(d => d.status === 'pending').length}
                </span>
              )}
            </button>
          </div>

          {/* 7.2 PURCHASE ORDERS TAB CONTENT */}
          {activeTab === 'po' && (
            <div className="space-y-4" id="po-tab-pane">
              {/* STATS ROW */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white p-3 border border-[#E2DFDF] rounded-xs flex flex-col justify-between">
                  <span className="text-[10px] text-gray-400 font-extrabold uppercase">PO Drafts</span>
                  <span className="text-xl font-black text-gray-800">{poDraftsCount}</span>
                </div>
                <div className="bg-white p-3 border border-[#E2DFDF] rounded-xs flex flex-col justify-between">
                  <span className="text-[10px] text-[#0EA5E9] font-extrabold uppercase">In Progress</span>
                  <span className="text-xl font-black text-[#0EA5E9]">{poInProgressCount}</span>
                </div>
                <div className="bg-white p-3 border border-[#E2DFDF] rounded-xs flex flex-col justify-between">
                  <span className="text-[10px] text-green-600 font-extrabold uppercase">Received/Fulfilled</span>
                  <span className="text-xl font-black text-green-600">{poReceivedCount}</span>
                </div>
                <div className="bg-white p-3 border border-[#E2DFDF] rounded-xs flex flex-col justify-between">
                  <span className="text-[10px] text-gray-400 font-extrabold uppercase">Total Dispatched Value</span>
                  <span className="text-xl font-black text-blue-700 font-mono">
                    {formatCostValue(poTotalValue)}
                  </span>
                </div>
              </div>

              {/* TWO COLUMN WORKFLOW PANEL */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* List view left column */}
                <div className="lg:col-span-6 space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Dispatch List</h3>
                  {purchaseOrders.length === 0 ? (
                    <div className="bg-white p-8 text-center border text-gray-400 text-xs">
                      No Purchase Orders found in the system.
                    </div>
                  ) : (
                    purchaseOrders.map(po => {
                      // Check actual vs agreed price variance
                      const hasVariance = po.items.some(item => 
                        item.actual_cost !== undefined && item.actual_cost !== item.agreed_cost
                      );

                      // Units progress received percentage
                      const totalOrderedUnits = po.items.reduce((sum, i) => sum + i.qty_ordered, 0);
                      const totalReceivedUnits = po.items.reduce((sum, i) => sum + i.qty_received, 0);
                      const progressPct = totalOrderedUnits > 0 
                        ? Math.round((totalReceivedUnits / totalOrderedUnits) * 100) 
                        : 0;

                      return (
                        <div 
                          key={po.id}
                          onClick={() => { setSelectedPO(po); setIsReceivingMode(false); }}
                          className={`p-3 bg-white border cursor-pointer transition-all hover:border-sky-400 flex flex-col justify-between space-y-2 rounded-xs ${
                            selectedPO?.id === po.id ? 'border-sky-500 border-l-[3px] bg-sky-50/10 ring-1 ring-sky-400/10' : 'border-[#E2DFDF]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-[#0EA5E9] font-mono uppercase">
                              {po.po_number}
                            </span>
                            <span className={`text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded ${
                              po.status === 'received' ? 'bg-green-100 text-green-700' :
                              po.status === 'in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {po.status}
                            </span>
                          </div>

                          <div className="text-xs font-bold text-slate-800 leading-tight">
                            {po.supplier_name}
                          </div>

                          <div className="flex flex-wrap items-center gap-y-1 gap-x-2 text-[10px] text-gray-500">
                            <span>Ordered: <span className="font-semibold text-gray-700">{po.order_date}</span></span>
                            <span>•</span>
                            <span>Expected: <span className="font-semibold text-gray-750">{po.expected_date}</span></span>
                            <span>•</span>
                            <span className="font-bold text-slate-705 uppercase">{po.items.length} items</span>
                          </div>

                          {/* Price variance badge */}
                          {hasVariance && (
                            <span className="inline-flex self-start bg-amber-50 text-amber-800 border border-amber-200 text-[8px] uppercase tracking-wider px-1.5 py-0.2 rounded font-black animate-pulse">
                              ⚠ Price Variance Detected
                            </span>
                          )}

                          {/* Progress bar */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[9px] text-gray-500 font-bold">
                              <span>Received ({totalReceivedUnits}/{totalOrderedUnits} units)</span>
                              <span>{progressPct}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-orange-500 h-1.5 rounded-full" 
                                style={{ width: `${progressPct}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Detail view right column */}
                <div className="lg:col-span-6">
                  {selectedPO ? (
                    <div className="bg-white border border-[#E2DFDF] p-4 space-y-4 rounded-xs" id="po-details-right-panel">
                      {/* Detail Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                        <div>
                          <p className="text-[10px] text-gray-400 font-extrabold uppercase">Purchase Order</p>
                          <h4 className="text-sm font-black text-[#0EA5E9] font-mono tracking-tight">
                            {selectedPO.po_number}
                          </h4>
                        </div>
                        <div className="flex items-center space-x-2">
                          {selectedPO.cost_not_identified_on_hold && (
                            <span className="text-[10px] uppercase font-extrabold px-2 py-1 rounded bg-amber-500 text-white animate-pulse">
                              ⚠ Bill Cost Held
                            </span>
                          )}
                          <span className={`text-[10px] uppercase font-black px-2 py-1 rounded ${
                            selectedPO.status === 'received' ? 'bg-green-100 text-green-700' :
                            selectedPO.status === 'in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {selectedPO.status}
                          </span>
                          {selectedPO.status !== 'received' && !isReceivingMode && (
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => startReceiving(selectedPO)}
                                className="bg-blue-700 hover:bg-blue-800 text-white font-extrabold uppercase shadow-xs px-3 py-1 rounded text-[11px] cursor-pointer"
                                id="receive-goods-btn"
                              >
                                Receive Goods
                              </button>
                              
                              {selectedPO.is_deletion_scheduled ? (
                                <button
                                  onClick={() => handleCancelDeletion(selectedPO)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold uppercase px-2.5 py-1 rounded text-[11px] cursor-pointer"
                                  title="Cancel Scheduled Deletion"
                                >
                                  Keep PO
                                </button>
                              ) : (
                                <button
                                  onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                                  className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold uppercase px-2.5 py-1 rounded text-[11px] cursor-pointer"
                                  title="Schedule PO Deletion"
                                >
                                  🗑️ Delete PO
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Scheduled for Deletion Banner */}
                      {selectedPO.is_deletion_scheduled && (
                        <div className="bg-rose-50 border border-rose-300 p-3.5 space-y-2 rounded-xs" id="po-scheduled-deletion-banner">
                          <div className="flex items-start space-x-2.5">
                            <span className="text-base">⏳</span>
                            <div className="space-y-1">
                              <p className="text-xs font-black uppercase text-rose-800 tracking-tight">Sent for Deleting (Scheduled Permanently)</p>
                              <p className="text-[11px] leading-relaxed font-semibold text-rose-700">
                                This uncompleted PO is scheduled for automatic permanent deletion in 3 days.
                              </p>
                              <div className="text-[10px] text-rose-900 bg-rose-105/60 p-2 rounded space-y-0.5 font-medium">
                                <p><strong>Scheduled on:</strong> {new Date(selectedPO.deletion_scheduled_at || '').toLocaleString()}</p>
                                <p><strong>Estimated Deletion:</strong> {new Date(new Date(selectedPO.deletion_scheduled_at || '').getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleString()}</p>
                                <p><strong>Reason:</strong> {selectedPO.deletion_reason}</p>
                              </div>
                            </div>
                          </div>
                          <div className="pt-2 flex items-center justify-between border-t border-rose-200">
                            <span className="text-[9px] text-rose-600 font-bold font-mono uppercase">
                              Grace Period Active
                            </span>
                            <button
                              onClick={() => handleCancelDeletion(selectedPO)}
                              className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold uppercase px-2 py-1 rounded text-[10px] cursor-pointer"
                            >
                              Cancel Deletion & Keep PO
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Deletion Form Box */}
                      {showDeleteConfirm && !selectedPO.is_deletion_scheduled && (
                        <div className="bg-slate-50 border border-rose-300 p-4 rounded-xs space-y-3" id="po-deletion-confirm-form">
                          <div className="flex items-center space-x-2 text-rose-700 font-bold">
                            <span className="text-base">🗑️</span>
                            <span className="text-xs uppercase font-extrabold tracking-wide">Schedule PO Deletion</span>
                          </div>
                          
                          <p className="text-[11.5px] text-slate-600 leading-relaxed">
                            To delete this uncompleted purchase order, you must provide a reason. The PO will be marked as <strong>"sent for deleting"</strong> and automatically purged permanently in <strong>3 days</strong>.
                          </p>

                          <div className="space-y-2">
                            <label className="block text-[10px] font-extrabold uppercase text-slate-500">Reason for deleting</label>
                            <select
                              value={deleteReason}
                              onChange={(e) => setDeleteReason(e.target.value)}
                              className="w-full text-xs p-2 bg-white border border-slate-300 rounded font-medium text-slate-700 outline-none focus:border-rose-500"
                            >
                              <option value="Ordered by Mistake / Wrong Items">Ordered by Mistake / Wrong Items</option>
                              <option value="Supplier Cancelled / Out of Stock">Supplier Cancelled / Out of Stock</option>
                              <option value="Duplicate Order Entered">Duplicate Order Entered</option>
                              <option value="Customer Cancelled Requirements">Customer Cancelled Requirements</option>
                              <option value="Pricing Mismatch / Negotiation Failed">Pricing Mismatch / Negotiation Failed</option>
                              <option value="Other">Other (Describe below)</option>
                            </select>

                            {deleteReason === 'Other' && (
                              <textarea
                                value={deleteCustomReason}
                                onChange={(e) => setDeleteCustomReason(e.target.value)}
                                placeholder="Please type detailed cancellation reason..."
                                className="w-full text-xs p-2 bg-white border border-slate-300 rounded font-medium text-slate-700 outline-none focus:border-rose-500 h-16 resize-none"
                              />
                            )}
                          </div>

                          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
                            <button
                              type="button"
                              onClick={() => { setShowDeleteConfirm(false); setDeleteCustomReason(''); }}
                              className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold uppercase rounded cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleScheduleDeletion}
                              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold uppercase rounded shadow-sm cursor-pointer"
                            >
                              Confirm Schedule Deletion
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Cost Not Identified / Hold draft financials banner */}
                      {selectedPO.cost_not_identified_on_hold && (
                        <div className="bg-amber-50 border border-amber-300 p-3 rounded-xs space-y-2 text-amber-950" id="deferred-payable-alert-box">
                          <div className="flex items-start space-x-2">
                            <span className="text-sm mt-0.5">⚠️</span>
                            <div>
                              <p className="text-xs font-black uppercase tracking-tight">Draft Cost Hold (Supplier Balance Deferred)</p>
                              <p className="text-[11px] font-semibold leading-relaxed text-amber-900">
                                This purchase order's bill is partially on hold because some costs are not identified yet. Items have been successfully added to standard warehouse inventory, but the accounts payable balance of <strong>Rs. {Number(selectedPO.held_deferred_amount || 0).toLocaleString()}</strong> was NOT posted to the supplier's balance (you do not owe this debt yet).
                              </p>
                            </div>
                          </div>
                          
                          {/* Action button to release and post payable */}
                          <div className="pt-1 flex items-center justify-between border-t border-amber-200">
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100/50 px-2 py-0.5 rounded">
                              Deferred Balance: Rs. {Number(selectedPO.held_deferred_amount || 0).toLocaleString()}
                            </span>
                            <button
                              onClick={() => handleReleaseDeferredCost(selectedPO)}
                              className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold uppercase px-2.5 py-1 rounded text-[10px] tracking-wider cursor-pointer"
                              id="release-payable-btn"
                            >
                              ✓ Release & Post to Ledger
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Summary statistics */}
                      <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2 border border-slate-150">
                        <div>
                          <p className="text-[9px] uppercase font-bold text-gray-400">Supplier Account</p>
                          <p className="text-xs font-extrabold text-[#2A2727]">{selectedPO.supplier_name}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase font-bold text-gray-400 font-mono text-right">Order Date</p>
                          <p className="text-xs font-black text-gray-700 text-right">{selectedPO.order_date}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="border border-slate-200 p-2.5 bg-slate-50">
                          <p className="text-[9px] uppercase font-extrabold text-blue-800">Delivery Status</p>
                          <p className="text-[11px] font-bold text-slate-700 mt-1">Expected: {selectedPO.expected_date}</p>
                        </div>
                        <div className="border border-slate-200 p-2.5 bg-slate-50">
                          <p className="text-[9px] uppercase font-extrabold text-[#0EA5E9]">Consolidated Cost</p>
                          <p className="text-xs font-black text-slate-800 mt-1">{formatCostValue(selectedPO.net_amount)}</p>
                        </div>
                      </div>

                      {/* Items table */}
                      <div className="space-y-2">
                        <h5 className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Ordered Stock Line items</h5>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-slate-100 text-gray-500 uppercase text-[9px] font-extrabold">
                                <th className="p-2">Part Number</th>
                                <th className="p-2 text-center">Ordered</th>
                                <th className="p-2 text-center">Received</th>
                                <th className="p-2 text-right">Agreed Cost</th>
                                {isReceivingMode && (
                                  <>
                                    <th className="p-2 text-center bg-blue-50 text-blue-800 w-16">Recv Qty</th>
                                    <th className="p-2 text-right bg-blue-50 text-blue-800 w-24">Act Cost</th>
                                  </>
                                )}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-150">
                              {selectedPO.items.map(item => {
                                const remaining = Math.max(0, item.qty_ordered - item.qty_received);
                                return (
                                  <tr key={item.id} className="hover:bg-slate-50/50">
                                    <td className="p-2 font-mono font-bold text-slate-800">
                                      {item.part_number}
                                      <span className="block text-[9px] text-gray-400 font-sans">{item.brand}</span>
                                    </td>
                                    <td className="p-2 text-center font-bold text-slate-700">{item.qty_ordered}</td>
                                    <td className="p-2 text-center font-bold text-slate-700">
                                      <span className={`px-1.5 py-0.2 rounded font-mono ${
                                        item.qty_received >= item.qty_ordered 
                                          ? 'bg-emerald-50 text-emerald-700 font-bold' 
                                          : 'bg-orange-50 text-orange-700'
                                      }`}>
                                        {item.qty_received}
                                      </span>
                                    </td>
                                    <td className="p-2 text-right font-mono text-slate-650">
                                      {item.cost_not_identified ? (
                                        <span className="text-amber-700 font-extrabold bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-[9px] rounded uppercase">
                                          Cost Unknown
                                        </span>
                                      ) : (
                                        formatCostValue(item.agreed_cost)
                                      )}
                                    </td>
                                    
                                    {/* RECEIVING MODE INPUT FORM ROW */}
                                    {isReceivingMode && (
                                      <>
                                        <td className="p-2 bg-blue-50/25">
                                          <input 
                                            type="number" 
                                            min="0"
                                            value={receivingQuantities[item.id] ?? 0}
                                            onChange={(e) => {
                                              const typed = Math.max(0, Number(e.target.value));
                                              setReceivingQuantities({
                                                ...receivingQuantities,
                                                [item.id]: typed
                                              });
                                            }}
                                            className="w-full text-center border p-1 bg-white rounded font-mono font-bold text-xs"
                                          />
                                        </td>
                                        <td className="p-2 bg-blue-50/25">
                                          <div className="flex flex-col items-end">
                                            <input 
                                              type="number" 
                                              min="0"
                                              value={receivingCosts[item.id] ?? item.agreed_cost}
                                              onChange={(e) => {
                                                const costTyped = Math.max(0, Number(e.target.value));
                                                setReceivingCosts({
                                                  ...receivingCosts,
                                                  [item.id]: costTyped
                                                });
                                              }}
                                              className={`w-full text-right border p-1 bg-white rounded font-mono font-bold text-xs ${
                                                Number(receivingCosts[item.id] ?? item.agreed_cost) !== item.agreed_cost 
                                                  ? 'border-amber-400 bg-amber-50/30' 
                                                  : ''
                                              }`}
                                            />
                                            {Number(receivingCosts[item.id] ?? item.agreed_cost) !== item.agreed_cost && (
                                              <span className="text-[8px] text-amber-700 font-sans uppercase font-bold text-right pt-0.5 animate-pulse">
                                                ⚠ varies
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                      </>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Cost Not Identified / Hold draft financials banner */}
                      {isReceivingMode && (
                        <div className="bg-amber-50 border-l-4 border-amber-500 p-3.5 space-y-2 rounded-xs" id="hold-cost-deferred-receiving-container">
                          <label className="flex items-start space-x-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={costNotIdentifiedHold}
                              onChange={(e) => setCostNotIdentifiedHold(e.target.checked)}
                              className="w-4.5 h-4.5 text-amber-600 focus:ring-amber-500 border-gray-300 rounded mt-0.5"
                              id="cost-hold-checkbox"
                            />
                            <div className="space-y-0.5">
                              <span className="text-xs font-extrabold text-amber-950 uppercase tracking-tight flex items-center">
                                ⚠️ Postpone Bill Costs (Hold Accounts Payable)
                              </span>
                              <p className="text-[11px] text-amber-800 leading-relaxed font-sans">
                                Check this option if you received items but do not have the complete or final costing details yet (e.g., 1 of 10 items cost is unknown). 
                                <strong> This increases physical inventory units immediately</strong> so selling processes can proceed smoothly, but <strong>keeps the bill draft on hold</strong> with Rs. 0 added to the outstanding debt you owe to the supplier.
                              </p>
                            </div>
                          </label>
                        </div>
                      )}

                      {/* receiving mode action handlers */}
                      {isReceivingMode && (
                        <div className="flex items-center space-x-2 bg-blue-50 border border-blue-200 p-3">
                          <button
                            onClick={() => setIsReceivingMode(false)}
                            className="bg-slate-200 hover:bg-slate-350 text-slate-850 text-xs font-bold uppercase py-2 px-3 rounded cursor-pointer transition-colors"
                          >
                            Cancel Recv
                          </button>
                          <button
                            onClick={() => handleConfirmReceipt(selectedPO)}
                            className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-extrabold uppercase py-2 px-4 rounded cursor-pointer flex-1 transition-colors text-center"
                          >
                            ✓ Confirm Receipt — Update {costNotIdentifiedHold ? "Stock Only (Hold Bill)" : "Stock & Post Balance"}
                          </button>
                        </div>
                      )}

                      {/* PO actions for print-out or reference */}
                      {!isReceivingMode && (
                        <div className="border-t pt-3 flex justify-between text-[11px] text-gray-500">
                          <span>Dispatched by: <span className="font-bold text-slate-800 uppercase">{selectedPO.user}</span></span>
                          <span className="font-mono text-gray-400">ID: {selectedPO.id.slice(-8)}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-dashed border-gray-300 p-8 text-center text-gray-450 text-xs h-full flex flex-col items-center justify-center space-y-2 rounded-xs">
                      <Package className="w-8 h-8 text-gray-350" />
                      <span>Kindly select any Purchase Order card to inspect goods receipt levels and detailed variant pricing.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 7.3 SUPPLIERS TAB CONTENT */}
          {activeTab === 'suppliers' && (
            <div className="space-y-4" id="suppliers-tab-pane">
              {/* STATS ROW */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="bg-white p-3 border border-[#E2DFDF] rounded-xs flex flex-col justify-between">
                  <span className="text-[10px] text-gray-400 font-extrabold uppercase">Total Registered Suppliers</span>
                  <span className="text-xl font-black text-gray-800">{suppliers.length}</span>
                </div>
                <div className="bg-white p-3 border border-[#E2DFDF] rounded-xs flex flex-col justify-between">
                  <span className="text-[10px] text-amber-600 font-extrabold uppercase">Total Outstanding Payables</span>
                  <span className="text-xl font-black text-amber-600 font-mono">
                    Rs. {totalPayableAmount.toLocaleString()}
                  </span>
                </div>
                <div className="bg-white p-3 border border-[#E2DFDF] rounded-xs flex flex-col justify-between">
                  <span className="text-[10px] text-gray-400 font-extrabold uppercase">Total Received Goods Purchase Value</span>
                  <span className="text-xl font-black text-blue-700 font-mono">
                    {userRole === 'Owner' ? formatCostValue(totalPurchasedValue) : "Owner Only Protected"}
                  </span>
                </div>
              </div>

              {/* TWO COLUMN PANEL */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* List View Left */}
                <div className="lg:col-span-6 space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Registered Accounts</h3>
                  {suppliers.length === 0 ? (
                    <div className="bg-white p-8 text-center border text-gray-400 text-xs">
                      No suppliers registered. Create them in Balances & Parties.
                    </div>
                  ) : (
                    suppliers.map(sup => {
                      const isPayable = sup.credit_balance < 0;
                      return (
                        <div 
                          key={sup.id}
                          onClick={() => setSelectedSupplier(sup)}
                          className={`p-3 bg-white border cursor-pointer transition-all hover:border-sky-400 flex flex-col justify-between space-y-2 rounded-xs ${
                            selectedSupplier?.id === sup.id ? 'border-sky-500 border-l-[3px] bg-sky-50/10 ring-1 ring-sky-400/10' : 'border-[#E2DFDF]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-800">
                              {sup.name}
                            </span>
                            <span className="text-[9px] font-mono text-gray-400 uppercase">
                              {sup.city}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-gray-500">
                            {sup.phone ? <span>{sup.phone}</span> : ""}
                            {sup.payment_terms ? (
                              <>
                                <span>·</span>
                                <span>Terms: <strong>{sup.payment_terms}</strong></span>
                              </>
                            ) : ""}
                            {sup.is_supplier_linked && (
                              <span className="bg-purple-100 text-purple-700 font-bold px-1 rounded text-[8px] uppercase">
                                Also Customer
                              </span>
                            )}
                          </div>

                          <div className="flex justify-between items-center text-xs font-bold font-sans">
                            <span className="text-gray-450 text-[10px]">Outstanding Payable:</span>
                            <span className={isPayable ? "text-amber-500 font-mono" : "text-emerald-600"}>
                              {isPayable ? `Rs. ${Math.abs(sup.credit_balance).toLocaleString()}` : 'Cleared'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Supplier detail panel right */}
                <div className="lg:col-span-6">
                  {selectedSupplier ? (
                    <div className="bg-white border border-[#E2DFDF] p-4 space-y-4 rounded-xs" id="supplier-detail-panel">
                      {/* Name Card */}
                      <div className="border-b pb-3 flex justify-between items-start">
                        <div>
                          <p className="text-[9px] text-gray-400 font-extrabold uppercase">Supplier Information</p>
                          <h4 className="text-base font-black text-slate-800 tracking-tight">{selectedSupplier.name}</h4>
                          <p className="text-[10px] font-mono text-gray-500 mt-0.5">{selectedSupplier.address || 'No registered street address'}</p>
                        </div>
                      </div>

                      {/* Balance & aggregate purchases */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className={`p-3 border rounded-xs ${
                          selectedSupplier.credit_balance < 0 
                            ? 'bg-amber-50 border-amber-200 text-amber-800' 
                            : 'bg-green-50 border-green-200 text-green-800'
                        }`}>
                          <p className="text-[9px] uppercase font-bold text-gray-500">Active Balance Due</p>
                          <p className="text-sm font-black font-mono mt-1">
                            {selectedSupplier.credit_balance < 0 
                              ? `Rs. ${Math.abs(selectedSupplier.credit_balance).toLocaleString()} (OWED)` 
                              : 'Rs. 0 (Fully Clear)'}
                          </p>
                        </div>

                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xs">
                          <p className="text-[9px] uppercase font-bold text-gray-500">Total Purchase Volume</p>
                          <p className="text-sm font-black text-slate-800 font-mono mt-1">
                            {formatCostValue(
                              purchaseOrders
                                .filter(p => p.supplier_id === selectedSupplier.id)
                                .reduce((acc, curr) => acc + curr.received_amount, 0)
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Contact items list */}
                      <div className="space-y-2 border-t pt-3">
                        <h5 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Contact & Registration Details</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-400 block text-[9px] uppercase">Primary phone</span>
                            <span className="font-extrabold text-slate-800">{selectedSupplier.phone || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block text-[9px] uppercase">City / Hub</span>
                            <span className="font-extrabold text-[#0EA5E9]">{selectedSupplier.city}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block text-[9px] uppercase">Payment terms</span>
                            <span className="font-bold text-slate-700">{selectedSupplier.payment_terms || 'No registered cash guidelines'}</span>
                          </div>
                          <div>
                            <span className="text-gray-450 block text-[9px] uppercase">Supplier Code</span>
                            <span className="font-mono text-slate-650">{selectedSupplier.id.slice(-6).toUpperCase()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Is Linked Customer details block */}
                      {selectedSupplier.is_supplier_linked && (
                        <div className="bg-purple-50/50 border border-purple-200 p-2 text-xs flex items-center justify-between text-purple-900 rounded-xs">
                          <div>
                            <p className="font-bold uppercase text-[9px] tracking-wide text-purple-700">✓ Fully Connected Account</p>
                            <p className="text-[10px] text-purple-800 leading-normal">This vendor is also registered as a buyer/customer. Cross-ledger balances are fully supported in transactions history.</p>
                          </div>
                        </div>
                      )}

                      {/* Button Panel actions */}
                      <div className="border-t pt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          onClick={() => {
                            setNewPoSupplier(selectedSupplier.id);
                            setSubView('new_po');
                          }}
                          className="bg-[#0EA5E9] hover:bg-sky-600 text-white font-extrabold uppercase py-1.5 px-3 rounded text-[11px] text-center cursor-pointer transition-colors"
                        >
                          New PO Request
                        </button>
                        <button
                          onClick={() => {
                            setActiveTab('po');
                            // Filter POs
                            const filtered = purchaseOrders.filter(p => p.supplier_id === selectedSupplier.id);
                            if (filtered.length > 0) {
                              setSelectedPO(filtered[0]);
                            } else {
                              alert("No purchase history PO recorded for this vendor yet.");
                            }
                          }}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-300 py-1.5 px-2 rounded text-[11px] text-center cursor-pointer"
                        >
                          History POs
                        </button>
                        <button
                          onClick={() => {
                            setPayAmount(String(Math.abs(selectedSupplier.credit_balance || 0)));
                            setShowPaymentModal(true);
                          }}
                          className="bg-blue-700 hover:bg-blue-800 text-white font-extrabold uppercase py-1.5 px-2 rounded text-[11px] text-center cursor-pointer transition-colors"
                        >
                          Record Payment
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-dashed border-gray-300 p-8 text-center text-gray-450 text-xs h-full flex flex-col items-center justify-center space-y-2 rounded-xs">
                      <Building className="w-8 h-8 text-gray-350" />
                      <span>Select a registered active Supplier wholesale partner to record payment entries, trigger orders, or inspect outstanding values.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 7.4 PROCUREMENT JOBS TAB CONTENT */}
          {activeTab === 'proc_jobs' && (
            <div className="space-y-4" id="proc-jobs-tab-pane">
              {/* STATS ROW */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white p-3 border border-[#E2DFDF] rounded-xs flex flex-col justify-between">
                  <span className="text-[10px] text-gray-400 font-extrabold uppercase">Total Sourcing Jobs</span>
                  <span className="text-xl font-black text-gray-800">{activeJobsCount}</span>
                </div>
                <div className="bg-white p-3 border border-[#E2DFDF] rounded-xs flex flex-col justify-between">
                  <span className="text-[10px] text-amber-600 font-extrabold uppercase">Total Cost Allocation</span>
                  <span className="text-xl font-black text-amber-605 font-mono">
                    Rs. {totalJobCost.toLocaleString()}
                  </span>
                </div>
                <div className="bg-white p-3 border border-[#E2DFDF] rounded-xs flex flex-col justify-between">
                  <span className="text-[10px] text-blue-700 font-extrabold uppercase">Total Client Billed</span>
                  <span className="text-xl font-black text-blue-700 font-mono">
                    Rs. {totalJobBilled.toLocaleString()}
                  </span>
                </div>
                <div className="bg-white p-3 border border-[#E2DFDF] rounded-xs flex flex-col justify-between">
                  <span className="text-[10px] text-green-600 font-extrabold uppercase">Total Net Profit</span>
                  <span className="text-xl font-black text-green-600 font-mono">
                    {userRole === 'Owner' ? `Rs. ${totalJobProfit.toLocaleString()}` : "Owner Only Protected"}
                  </span>
                </div>
              </div>

              {/* LIST OF JOBS */}
              <div className="bg-white border border-[#E2DFDF]" id="procurement-jobs-grid">
                <div className="p-3 border-b border-[#E2DFDF] bg-slate-50 flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-slate-800">Direct Client Procurement Jobs</span>
                  <span className="text-[10px] text-gray-500 font-bold">Track custom orders and direct purchase fulfillment loops</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-gray-500 uppercase text-[9px] font-extrabold">
                        <th className="p-3">Job Number</th>
                        <th className="p-3">Client Account</th>
                        <th className="p-3">Item Description</th>
                        <th className="p-3 text-center">Qty Ordered</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-right">Cost Price</th>
                        <th className="p-3 text-right">Billed Invoice</th>
                        <th className="p-3 text-right">Spread Margin (Profit)</th>
                        <th className="p-3 text-center w-36">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {procurementJobs.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-10 text-center text-gray-400 text-xs">
                            No custom procurement jobs found in the system database. Get started by clicking "+ Procurement Job".
                          </td>
                        </tr>
                      ) : (
                        procurementJobs.map(job => {
                          const costSum = job.purchase_cost * job.qty;
                          const billedSum = job.billed_amount * job.qty;
                          const profitSum = billedSum - costSum;

                          return (
                            <tr key={job.id} className="hover:bg-slate-50/50">
                              <td className="p-3 font-mono font-black text-[#0EA5E9] uppercase select-all">
                                {job.job_number}
                                <span className="block text-[8px] text-gray-400 font-sans tracking-normal font-bold">Logged: {job.date}</span>
                              </td>
                              <td className="p-3 font-bold text-slate-850">{job.customer_name}</td>
                              <td className="p-3 text-slate-700 leading-normal max-w-sm">
                                {job.item_description}
                                {job.notes ? (
                                  <span className="block text-[10px] italic text-[#0EA5E9] font-semibold mt-0.5">Note: {job.notes}</span>
                                ) : ""}
                              </td>
                              <td className="p-3 text-center font-bold text-slate-800">{job.qty}</td>
                              <td className="p-3 text-center">
                                <span className={`text-[8px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full ${
                                  job.status === 'completed' ? 'bg-green-100 text-green-700' :
                                  job.status === 'cancelled' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700 animate-pulse'
                                }`}>
                                  {job.status}
                                </span>
                              </td>
                              <td className="p-3 text-right font-mono font-semibold text-gray-550">
                                {formatCostValue(job.purchase_cost)}
                                <span className="block text-[9px] font-sans text-gray-400">Total: {formatCostValue(costSum)}</span>
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-blue-700">
                                Rs. {job.billed_amount.toLocaleString()}
                                <span className="block text-[9px] font-sans text-gray-400 font-semibold text-right">Total: Rs. {billedSum.toLocaleString()}</span>
                              </td>
                              <td className="p-3 text-right font-mono text-green-600 font-extrabold">
                                {userRole === 'Owner' ? `Rs. ${profitSum.toLocaleString()}` : 'Owner Protected'}
                                {userRole === 'Owner' && (
                                  <span className="block text-[9px] font-sans text-gray-400 font-light text-right">
                                    {billedSum > 0 ? `${Math.round((profitSum / billedSum) * 100)}% Margin` : '0%'}
                                  </span>
                                )}
                              </td>
                              <td className="p-3">
                                <div className="flex justify-center space-x-1">
                                  {job.status === 'pending' && (
                                    <>
                                      <button
                                        onClick={() => handleToggleJobStatus(job, 'completed')}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[9px] uppercase px-1.5 py-1 rounded cursor-pointer transition-colors"
                                      >
                                        ✓ Complete
                                      </button>
                                      <button
                                        onClick={() => handleToggleJobStatus(job, 'cancelled')}
                                        className="bg-rose-50 hover:bg-rose-150 text-rose-700 border border-slate-200 font-bold text-[9px] uppercase px-1.5 py-1 rounded cursor-pointer"
                                      >
                                        ✕ Cancel
                                      </button>
                                    </>
                                  )}
                                  {job.status !== 'pending' && (
                                    <span className="text-[10px] text-gray-400 font-bold italic">Archived</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 7.5 REORDER SUGGESTIONS TAB CONTENT */}
          {activeTab === 'reorder' && (
            <div className="space-y-4" id="reorder-suggestions-pane">
              {/* Alert banner */}
              <div className="bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800 rounded-xs flex items-center space-x-3" id="reorder-alert-banner">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <h4 className="font-extrabold uppercase">Reorder Sourcing Suggestions Queue</h4>
                  <p className="font-medium text-[11px] leading-relaxed mt-0.5">
                    We've scanned your items directory. There are currently <strong>{reorderSuggestionsCount} items</strong> that have dropped to or below their alert quantities threshold. Auto-purchase orders are ready for assembly below.
                  </p>
                </div>
              </div>

              {/* LIST & CONTROLS */}
              <div className="bg-white border border-[#E2DFDF]" id="reorder-table-list">
                <div className="p-3 border-b border-[#E2DFDF] bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-black uppercase text-slate-800">Critical Low Stock Items</span>
                    <span className="text-[10px] bg-sky-100 text-[#0EA5E9] font-extrabold px-2 py-0.5 rounded-full select-none">
                      {reorderSuggestionsCount} items
                    </span>
                  </div>
                  
                  <button
                    onClick={handleBulkReorderPO}
                    disabled={selectedReorderIds.length === 0}
                    className={`font-black uppercase text-xs px-4 py-2 rounded text-center cursor-pointer transition-all ${
                      selectedReorderIds.length === 0 
                        ? 'bg-slate-100 text-gray-400 border border-slate-200 cursor-not-allowed' 
                        : 'bg-[#0EA5E9] hover:bg-sky-600 text-white shadow-xs'
                    }`}
                    id="bulk-reorder-create-po-btn"
                  >
                    Create Purchase Order for {selectedReorderIds.length} items
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-gray-500 uppercase text-[9px] font-extrabold">
                        <th className="p-3 w-10 text-center">
                          <input 
                            type="checkbox" 
                            checked={selectedReorderIds.length === products.filter(p => p.stock_qty <= p.min_stock_alert).length && reorderSuggestionsCount > 0}
                            onChange={(e) => {
                              const lowS = products.filter(p => p.stock_qty <= p.min_stock_alert);
                              if (e.target.checked) {
                                setSelectedReorderIds(lowS.map(p => p.id));
                              } else {
                                setSelectedReorderIds([]);
                              }
                            }}
                            className="cursor-pointer"
                          />
                        </th>
                        <th className="p-3">Part Number</th>
                        <th className="p-3">Brand</th>
                        <th className="p-3 text-center">Current Stock</th>
                        <th className="p-3 text-center">Min Threshold</th>
                        <th className="p-3">Suggested Supplier Code</th>
                        <th className="p-3 text-right">Agreed Cost</th>
                        <th className="p-3 text-center w-28">Order Qty Suggestion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {products.filter(p => p.stock_qty <= p.min_stock_alert).length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-10 text-center text-gray-400 text-xs">
                            ✓ All product items are above minimum stock levels. Excellent inventory health!
                          </td>
                        </tr>
                      ) : (
                        products.filter(p => p.stock_qty <= p.min_stock_alert).map(product => {
                          const isCheckboxSet = selectedReorderIds.includes(product.id);
                          const isOutOfStock = product.stock_qty === 0;
                          
                          return (
                            <tr 
                              key={product.id} 
                              className={`hover:bg-slate-50/50 ${
                                isOutOfStock ? 'border-l-4 border-l-rose-500' : 'border-l-4 border-l-amber-500'
                              }`}
                            >
                              <td className="p-3 text-center">
                                <input 
                                  type="checkbox" 
                                  checked={isCheckboxSet}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedReorderIds([...selectedReorderIds, product.id]);
                                    } else {
                                      setSelectedReorderIds(selectedReorderIds.filter(id => id !== product.id));
                                    }
                                  }}
                                  className="cursor-pointer"
                                />
                              </td>
                              <td className="p-3 font-mono font-black text-slate-800">{product.part_number}</td>
                              <td className="p-3 font-bold text-slate-650">{product.brand}</td>
                              <td className="p-3 text-center">
                                <span className={`font-mono font-bold px-1.5 py-0.2 rounded-full ${
                                  product.stock_qty === 0 
                                    ? 'bg-rose-100 text-rose-700 animate-pulse' 
                                    : 'bg-amber-100 text-amber-700 font-extrabold'
                                }`}>
                                  {product.stock_qty} unit(s)
                                </span>
                              </td>
                              <td className="p-3 text-center font-bold font-mono text-gray-500">
                                {product.min_stock_alert}
                              </td>
                              <td className="p-3 text-slate-600 font-semibold select-all">
                                {product.supplier_code || 'LOCAL_RESO'}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-slate-705">
                                {formatCostValue(product.cost_price)}
                              </td>
                              <td className="p-3">
                                <input 
                                  type="number"
                                  min="1"
                                  value={reorderQuantities[product.id] ?? 1}
                                  onChange={(e) => {
                                    setReorderQuantities({
                                      ...reorderQuantities,
                                      [product.id]: Math.max(1, Number(e.target.value))
                                    });
                                  }}
                                  className="w-full text-center border p-1 rounded font-mono font-black text-xs"
                                  title="pre-filled alert alert_qty * 3"
                                />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rare_demands' && (
            <div className="space-y-4" id="rare-demands-tab-pane">
              {/* STATS HEADER */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white p-3 border border-[#E2DFDF] rounded-xs flex flex-col justify-between">
                  <span className="text-[10px] text-gray-400 font-extrabold uppercase">Total Demands Logged</span>
                  <span className="text-xl font-black text-gray-800">{rareDemands.length}</span>
                </div>
                <div className="bg-white p-3 border border-[#E2DFDF] rounded-xs flex flex-col justify-between">
                  <span className="text-[10px] text-[#0ea5e9] font-extrabold uppercase">Waiting for Brands</span>
                  <span className="text-xl font-black text-[#0ea5e9]">{rareDemands.filter(d => d.status === 'pending').length}</span>
                </div>
                <div className="bg-white p-3 border border-[#E2DFDF] rounded-xs flex flex-col justify-between">
                  <span className="text-[10px] text-amber-600 font-extrabold uppercase">Quoted &amp; Contacted</span>
                  <span className="text-xl font-black text-amber-600">
                    {rareDemands.filter(d => d.status === 'sourced' || d.status === 'ordered').length}
                  </span>
                </div>
                <div className="bg-white p-3 border border-[#E2DFDF] rounded-xs flex flex-col justify-between">
                  <span className="text-[10px] text-emerald-600 font-extrabold uppercase font-sans">Custom Orders Fulfilled</span>
                  <span className="text-xl font-black text-emerald-600">
                    {rareDemands.filter(d => d.status === 'completed').length}
                  </span>
                </div>
              </div>

              {/* TWO COLUMN GRID FOR LIST & LOGGING FORM */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* COLUMN 1: INTERACTIVE DIRECTORY LIST (8 Columns) */}
                <div className="lg:col-span-8 bg-white border border-[#E2DFDF] p-4 space-y-4 rounded-xs flex flex-col">
                  
                  {/* SEARCH AND FILTERS ROW */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                    <div className="flex-1 relative">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search customer, phone, company, or part number..."
                        value={rareSearchQuery}
                        onChange={(e) => setRareSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 border border-slate-200 outline-none focus:border-sky-500 border-l-[3px] rounded text-xs transition-colors"
                      />
                    </div>
                    
                    {/* Status Selectors */}
                    <div className="flex flex-wrap gap-1 bg-slate-50 p-0.5 rounded border border-slate-200 text-[10px] font-bold">
                      {(['all', 'pending', 'sourced', 'ordered', 'completed'] as const).map(f => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setRareStatusFilter(f)}
                          className={`px-2 py-1 rounded-sm uppercase transition-colors capitalize ${
                            rareStatusFilter === f
                              ? 'bg-[#111C30] text-white shadow-xs'
                              : 'text-gray-500 hover:bg-slate-200/50 hover:text-slate-900'
                          }`}
                        >
                          {f === 'all' ? 'All' : f}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SUBTITLE */}
                  <div className="flex justify-between items-center text-[10px] text-gray-400 uppercase tracking-wider font-extrabold px-1">
                    <span>Rare Marketplace Demands List</span>
                    <span>Showing {
                      rareDemands.filter(d => {
                        const matchesSearch = d.customer_name.toLowerCase().includes(rareSearchQuery.toLowerCase()) ||
                                              d.phone.includes(rareSearchQuery) ||
                                              d.company_name.toLowerCase().includes(rareSearchQuery.toLowerCase()) ||
                                              d.customer_item_number.toLowerCase().includes(rareSearchQuery.toLowerCase()) ||
                                              (d.notes && d.notes.toLowerCase().includes(rareSearchQuery.toLowerCase()));
                        const matchesStatus = rareStatusFilter === 'all' || d.status === rareStatusFilter;
                        return matchesSearch && matchesStatus;
                      }).length
                    } demands</span>
                  </div>

                  {/* LIST BODY */}
                  <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1">
                    {rareDemands.filter(d => {
                      const matchesSearch = d.customer_name.toLowerCase().includes(rareSearchQuery.toLowerCase()) ||
                                            d.phone.includes(rareSearchQuery) ||
                                            d.company_name.toLowerCase().includes(rareSearchQuery.toLowerCase()) ||
                                            d.customer_item_number.toLowerCase().includes(rareSearchQuery.toLowerCase()) ||
                                            (d.notes && d.notes.toLowerCase().includes(rareSearchQuery.toLowerCase()));
                      const matchesStatus = rareStatusFilter === 'all' || d.status === rareStatusFilter;
                      return matchesSearch && matchesStatus;
                    }).length === 0 ? (
                      <div className="border border-dashed p-12 text-center text-gray-400 text-xs rounded bg-slate-50">
                        No active demands found. Enter a special hard-to-find demand in the intake desk on the right!
                      </div>
                    ) : (
                      rareDemands.filter(d => {
                        const matchesSearch = d.customer_name.toLowerCase().includes(rareSearchQuery.toLowerCase()) ||
                                              d.phone.includes(rareSearchQuery) ||
                                              d.company_name.toLowerCase().includes(rareSearchQuery.toLowerCase()) ||
                                              d.customer_item_number.toLowerCase().includes(rareSearchQuery.toLowerCase()) ||
                                              (d.notes && d.notes.toLowerCase().includes(rareSearchQuery.toLowerCase()));
                        const matchesStatus = rareStatusFilter === 'all' || d.status === rareStatusFilter;
                        return matchesSearch && matchesStatus;
                      }).map(item => {
                        return (
                          <div key={item.id} className="border border-slate-200 hover:border-sky-500 border-l-[3px] rounded bg-slate-50/40 p-3 flex flex-col justify-between space-y-3 transition-colors relative group">
                            
                            {/* Demand Row Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
                              <div className="space-y-0.5">
                                <div className="flex items-center space-x-2">
                                  <span className="text-[10px] font-black font-mono text-[#0EA5E9] bg-white border border-[#E2DFDF] px-1 py-0.2 rounded">
                                    {item.demand_number}
                                  </span>
                                  <h4 className="text-xs font-black text-gray-800">
                                    {item.customer_name}
                                  </h4>
                                </div>
                                <div className="text-[10px] text-slate-500 font-medium flex flex-wrap gap-x-2">
                                  <span>📞 {item.phone}</span>
                                  {item.company_name && <span className="font-bold border-l pl-2 text-slate-600">🏢 {item.company_name}</span>}
                                  <span className="border-l pl-2">📅 Logged: {item.date}</span>
                                </div>
                              </div>

                              {/* Status Badges */}
                              <div className="flex items-center space-x-1">
                                <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded shadow-2xs ${
                                  item.status === 'pending' ? 'bg-sky-100 text-sky-700 font-extrabold animate-pulse' :
                                  item.status === 'sourced' ? 'bg-amber-100 text-amber-700' :
                                  item.status === 'ordered' ? 'bg-indigo-100 text-indigo-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {item.status === 'pending' ? '⏳ Sourcing Required' :
                                   item.status === 'sourced' ? '📞 Supplier Contacted' :
                                   item.status === 'ordered' ? '🚢 Custom Booking Ordered' :
                                   '✅ Fulfilled in Pakistan'}
                                </span>
                              </div>
                            </div>

                            {/* Demanded Specs Block */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-2 border border-slate-150 rounded">
                              
                              <div className="space-y-1">
                                <span className="text-[8px] uppercase tracking-wider text-slate-400 font-black block">Item Brand &amp; Part Number Brought</span>
                                <div className="text-xs font-black text-slate-900 bg-sky-50/40 border border-slate-100 p-1.5 rounded flex items-center justify-between">
                                  <span>{item.customer_item_number}</span>
                                  <span className="float-right text-[8px] uppercase bg-black text-white px-1 py-0.2 rounded font-mono font-bold tracking-widest">{item.brand_targeted || 'MULTIPLE'}</span>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <span className="text-[8px] uppercase tracking-wider text-slate-400 font-black block">Est. Demand Size &amp; Frequency</span>
                                <div className="text-xs font-gray-800 font-black bg-slate-50 border border-slate-200 p-1.5 rounded">
                                  📦 {item.demand_qty_descr}
                                </div>
                              </div>

                            </div>

                            {/* Custom Notes / Client Frustrations */}
                            {item.notes && (
                              <div className="bg-amber-50/20 p-2 border border-dashed border-amber-200 rounded text-xs text-amber-900 flex flex-col">
                                <span className="text-[8.5px] font-black uppercase text-amber-700 tracking-wider">⚠️ Sourcing Details &amp; Critical Feedback:</span>
                                <p className="text-slate-600 font-semibold mt-1">"{item.notes}"</p>
                              </div>
                            )}

                            {/* Operational Actions */}
                            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                              <span className="text-[9px] text-gray-400 font-bold">
                                Operator: {item.user === 'Owner' ? 'Owner Admin' : 'Staff Operator'}
                              </span>

                              <div className="flex items-center space-x-1.5">
                                {item.status === 'pending' && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateRareDemandStatus(item.id, 'sourced')}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-extrabold uppercase px-2 py-1 rounded border transition-all cursor-pointer"
                                    title="Contact imported brand supplier to ask about custom/bulk order"
                                  >
                                    📞 Contact Importer / Brand
                                  </button>
                                )}
                                {item.status === 'sourced' && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateRareDemandStatus(item.id, 'ordered')}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold uppercase px-2 py-1 rounded transition-all cursor-pointer shadow-2xs"
                                    title="Add to upcoming custom sea/air cargo bulk shipment order"
                                  >
                                    🚢 Book Cargo / Order Brand
                                  </button>
                                )}
                                {(item.status === 'sourced' || item.status === 'ordered') && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateRareDemandStatus(item.id, 'completed')}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold uppercase px-2 py-1 rounded transition-all cursor-pointer shadow-2xs"
                                    title="Custom high-quality filter has arrived; provided to client"
                                  >
                                    ✅ Fulfill Custom Sourcing
                                  </button>
                                )}
                                {item.status === 'completed' && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateRareDemandStatus(item.id, 'pending')}
                                    className="bg-slate-100 text-slate-600 hover:bg-slate-200 text-[10px] font-bold px-2 py-1 rounded border cursor-pointer"
                                    title="Set back to pending"
                                  >
                                    Reset
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    if(window.confirm("Are you sure you want to dismiss this custom demand?")) {
                                      handleDeleteRareDemand(item.id);
                                    }
                                  }}
                                  className="text-[10px] text-red-500 hover:bg-sky-50 font-black px-1.5 py-1 rounded-sm border border-transparent hover:border-sky-200 cursor-pointer transition-colors"
                                  title="Dismiss demand"
                                >
                                  ❌ Dismiss
                                </button>
                              </div>
                            </div>

                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* COLUMN 2: FAST INTAKE DESK (4 Columns) */}
                <div className="lg:col-span-4 bg-white border border-[#E2DFDF] p-4 rounded-xs space-y-3 flex flex-col justify-between">
                  <form onSubmit={handleCreateRareDemand} className="space-y-3 flex-1">
                    <div className="border-b pb-2 mb-2">
                      <h3 className="text-xs font-black uppercase text-[#0EA5E9] flex items-center space-x-1">
                        <span>🌟 Sourcing Intake Desk</span>
                      </h3>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                        Log demand of scarce imported filters brought by frustrated clients.
                      </p>
                    </div>

                    {/* Customer Name */}
                    <div>
                      <label className="block text-[9px] uppercase font-black text-gray-500 mb-1">
                        Customer Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Yousaf Hydraulic Workshop"
                        value={newDemCustomerName}
                        onChange={(e) => setNewDemCustomerName(e.target.value)}
                        className="w-full text-xs p-2 border border-slate-200 rounded outline-none focus:border-sky-500 border-l-[3px] font-bold bg-slate-50/50"
                      />
                    </div>

                    {/* Phone & Company */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] uppercase font-black text-gray-500 mb-1">
                          Phone Number *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 0300-7654321"
                          value={newDemPhone}
                          onChange={(e) => setNewDemPhone(e.target.value)}
                          className="w-full text-xs p-2 border border-slate-200 rounded outline-none focus:border-sky-500 border-l-[3px] font-bold font-mono bg-slate-50/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-black text-gray-500 mb-1">
                          Company Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Yousaf Brothers Ghee Mills"
                          value={newDemCompany}
                          onChange={(e) => setNewDemCompany(e.target.value)}
                          className="w-full text-xs p-2 border border-slate-200 rounded outline-none focus:border-sky-500 border-l-[3px] font-bold bg-slate-50/50"
                        />
                      </div>
                    </div>

                    {/* Customer Item Number Brought */}
                    <div>
                      <label className="block text-[9px] uppercase font-black text-gray-500 mb-1">
                        Customer Brought Item Number &amp; Brand *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. H-8512 Baldwin Spec / Rusted Sample"
                        value={newDemItemNumber}
                        onChange={(e) => setNewDemItemNumber(e.target.value)}
                        className="w-full text-xs p-2 border border-slate-200 rounded outline-none focus:border-sky-500 border-l-[3px] font-semibold bg-sky-50/20"
                      />
                      <p className="text-[8px] text-gray-400 mt-0.5">
                        Specify part number printed on the client's original imported filter.
                      </p>
                    </div>

                    {/* Required Qty Frequency */}
                    <div>
                      <label className="block text-[9px] uppercase font-black text-gray-500 mb-1">
                        Required Amount &amp; Interval *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 1 piece after every 1 month"
                        value={newDemQtyDescr}
                        onChange={(e) => setNewDemQtyDescr(e.target.value)}
                        className="w-full text-xs p-2 border border-slate-200 rounded outline-none focus:border-sky-500 border-l-[3px] font-semibold bg-slate-50/50"
                      />
                    </div>

                    {/* Targeted Brand Sourcing Dropdown */}
                    <div>
                      <label className="block text-[9px] uppercase font-black text-gray-500 mb-1">
                        Target Imported Brand / Importer
                      </label>
                      <select
                        value={newDemBrandTargeted}
                        onChange={(e) => setNewDemBrandTargeted(e.target.value)}
                        className="w-full text-xs p-2 border border-slate-200 rounded outline-none focus:border-sky-500 border-l-[3px] font-bold text-slate-800 bg-slate-50"
                      >
                        <option value="Baldwin">Baldwin USA Importers</option>
                        <option value="Sakura">Sakura Filters (Indonesia/Malaysia)</option>
                        <option value="Donaldson">Donaldson Sourcing Group</option>
                        <option value="Fleetguard">Fleetguard Heavy Duty USA</option>
                        <option value="JS Asakashi">JS Asakashi Genuine Japan</option>
                        <option value="Vic Japan">Vic Japan Premium</option>
                        <option value="Soly Filter">Soly Industrial Filtration</option>
                        <option value="Custom Brand">Other Custom Imported Brand</option>
                      </select>
                    </div>

                    {/* Intrinsic Details & Client Frustration Note */}
                    <div>
                      <label className="block text-[9px] uppercase font-black text-gray-500 mb-1">
                        Sourcing notes / Client Frustration feedback
                      </label>
                      <textarea
                        rows={3}
                        placeholder="e.g., Client came in frustrated. Local copies burn seals or leak oil in high temp. Sourcing genuine USA-imported Baldwin spec only."
                        value={newDemNotes}
                        onChange={(e) => setNewDemNotes(e.target.value)}
                        className="w-full text-xs p-2 border border-slate-200 rounded outline-none focus:border-sky-500 border-l-[3px] font-semibold bg-slate-50/50"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-[#111C30] hover:bg-[#0A111E] text-white font-black text-xs uppercase rounded transition-colors shadow-xs hover:shadow cursor-pointer tracking-wider"
                    >
                      💾 Log Demanded Item &amp; Sync Ledger
                    </button>
                  </form>
                </div>

              </div>
            </div>
          )}
        </>
      ) : subView === 'new_po' ? (
        
        /* 7.6 NEW PURCHASE ORDER SCREEN */
        <div id="new-po-screen" className="space-y-4">
          <div className="bg-white p-3 border border-[#E2DFDF] flex items-center space-x-2 rounded-xs select-none">
            <span className="text-[10px] uppercase font-black bg-sky-100 text-[#0EA5E9] px-1.5 py-0.5 rounded">
              PO Intake Desk
            </span>
            <p className="text-xs text-slate-755 font-bold">
              Dispatch standard or reorder sheets directly to registered vendors.
            </p>
          </div>

          <form onSubmit={handleCreatePurchaseOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Col - Select supplier & Search products grid inputs */}
            <div className="lg:col-span-8 bg-white border border-[#E2DFDF] p-4 space-y-4 rounded-xs">
              <h3 className="text-xs font-black uppercase text-slate-800 border-b pb-2">Supplier & items roster</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Supplier selection */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">
                    Select Active Supplier Account
                  </label>
                  <select
                    value={newPoSupplier}
                    onChange={e => setNewPoSupplier(e.target.value)}
                    required
                    className="w-full p-2 border border-[#E2DFDF] font-sans text-xs bg-white focus:outline-none"
                  >
                    <option value="">-- Choose Supplier --</option>
                    {suppliers.map(s => {
                      const payable = s.credit_balance < 0 ? Math.abs(s.credit_balance) : 0;
                      return (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.city}) • Payable: Rs. {payable.toLocaleString()}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Search Active Products to drop in */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">
                    Search Product to add line item
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type Part Number or Brand..."
                      value={newPoSearchProduct}
                      onChange={e => setNewPoSearchProduct(e.target.value)}
                      className="w-full p-2 border border-[#E2DFDF] font-sans text-xs"
                    />
                    
                    {newPoSearchProduct.trim() && (
                      <div className="absolute left-0 right-0 max-h-40 bg-white border mt-1 shadow-lg overflow-y-auto z-40 text-xs">
                        {products
                          .filter(p => 
                            p.part_number.toLowerCase().includes(newPoSearchProduct.toLowerCase()) || 
                            p.brand.toLowerCase().includes(newPoSearchProduct.toLowerCase())
                          )
                          .map(p => (
                            <div 
                              key={p.id}
                              onClick={() => handleAddNewPoLine(p.id)}
                              className="p-2 cursor-pointer hover:bg-slate-100 flex justify-between font-mono font-bold"
                            >
                              <span>{p.part_number} • <span className="font-sans font-medium text-gray-500">{p.brand}</span></span>
                              <span className="text-emerald-700">{formatCostValue(p.cost_price)}</span>
                            </div>
                          ))}
                        {products.filter(p => 
                          p.part_number.toLowerCase().includes(newPoSearchProduct.toLowerCase()) || 
                          p.brand.toLowerCase().includes(newPoSearchProduct.toLowerCase())
                        ).length === 0 && (
                          <div className="p-2 text-gray-400">No matching products found.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Added Lines Table grid */}
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-400">Current Items list</span>
                <div className="overflow-x-auto min-h-40">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-gray-500 uppercase text-[9px] font-extrabold border-b">
                        <th className="p-2">Part Number</th>
                        <th className="p-2">Brand</th>
                        <th className="p-2 text-center w-24">Order Qty</th>
                        <th className="p-2 text-center w-28 text-amber-600">Cost Unknown?</th>
                        <th className="p-2 text-right w-36">Agreed Cost (PKR)</th>
                        <th className="p-2 text-right">Line Total</th>
                        <th className="p-2 text-center w-10">✕</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {newPoLines.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-gray-400">
                            Search and select products above to compile purchasing sheet entries.
                          </td>
                        </tr>
                      ) : (
                        newPoLines.map((line, idx) => (
                          <tr key={line.product_id} className="hover:bg-slate-50/50">
                            <td className="p-2 font-mono font-bold text-slate-800">{line.part_number}</td>
                            <td className="p-2 text-slate-700 font-semibold">{line.brand}</td>
                            <td className="p-2">
                              <input 
                                type="number"
                                min="1"
                                value={line.qty}
                                onChange={(e) => {
                                  const updated = [...newPoLines];
                                  updated[idx].qty = Math.max(1, Number(e.target.value));
                                  setNewPoLines(updated);
                                }}
                                className="w-full text-center border p-1 font-mono font-bold text-xs"
                                required
                              />
                            </td>
                            <td className="p-2 text-center">
                              <label className="inline-flex items-center space-x-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!line.cost_not_identified}
                                  onChange={(e) => {
                                    const updated = [...newPoLines];
                                    updated[idx].cost_not_identified = e.target.checked;
                                    setNewPoLines(updated);
                                  }}
                                  className="w-4.5 h-4.5 text-amber-600 focus:ring-amber-500 border-gray-300 rounded cursor-pointer"
                                />
                                <span className="text-[10px] font-black text-amber-700 uppercase tracking-tight bg-amber-100 px-1.5 py-0.5 rounded-sm">Hold Cost</span>
                              </label>
                            </td>
                            <td className="p-2">
                              {line.cost_not_identified ? (
                                <div className="text-right p-1 text-xs font-mono font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded text-center">
                                  Held (Pending)
                                </div>
                              ) : (
                                <input 
                                  type="number"
                                  min="0"
                                  value={line.agreed_cost}
                                  onChange={(e) => {
                                    const updated = [...newPoLines];
                                    updated[idx].agreed_cost = Math.max(0, Number(e.target.value));
                                    setNewPoLines(updated);
                                  }}
                                  className="w-full text-right border p-1 font-mono font-bold text-xs"
                                  required
                                />
                              )}
                            </td>
                            <td className="p-2 text-right font-mono font-semibold text-slate-700">
                              {line.cost_not_identified ? (
                                <span className="text-amber-700 font-bold bg-amber-100/50 px-2 py-1 rounded text-[10px]">
                                  Rs. 0 (Draft Hold)
                                </span>
                              ) : (
                                `Rs. ${(line.qty * line.agreed_cost).toLocaleString()}`
                              )}
                            </td>
                            <td className="p-2 text-center text-gray-400 hover:text-[#0ea5e9] font-bold transition-colors">
                              <button
                                type="button"
                                onClick={() => setNewPoLines(newPoLines.filter(l => l.product_id !== line.product_id))}
                                className="cursor-pointer"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right summary card sidebar column */}
            <div className="lg:col-span-4 bg-white border border-[#E2DFDF] p-4 space-y-4 rounded-xs flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-800 border-b pb-2">Calculation summary</h3>
                
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newPoDeliveryDate}
                    onChange={e => setNewPoDeliveryDate(e.target.value)}
                    className="w-full p-2 border border-[#E2DFDF] text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">
                    Bulk discount (Rs.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newPoDiscount}
                    onChange={e => setNewPoDiscount(Math.max(0, Number(e.target.value)))}
                    className="w-full p-2 border border-[#E2DFDF] text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">
                    Remarks / special packaging instructions
                  </label>
                  <textarea
                    rows={3}
                    value={newPoNotes}
                    onChange={e => setNewPoNotes(e.target.value)}
                    placeholder="Provide container instructions, driver detail, transit code etc."
                    className="w-full p-2 border border-[#E2DFDF] text-xs"
                  />
                </div>

                {/* Live total widget */}
                <div className="bg-slate-50 border p-3 font-sans space-y-1.5 rounded-xs select-none">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500">Gross Total Cost:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      Rs. {newPoLines.reduce((acc, c) => acc + (c.qty * (c.cost_not_identified ? 0 : c.agreed_cost)), 0).toLocaleString()}
                    </span>
                  </div>
                  {newPoDiscount > 0 && (
                    <div className="flex justify-between items-center text-xs text-rose-600 font-bold">
                      <span>Discount (Bulk):</span>
                      <span className="font-mono">
                        - Rs. {newPoDiscount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="border-t pt-1.5 flex justify-between items-center text-sm font-black text-slate-800">
                    <span>Net Dispatch Value:</span>
                    <span className="font-mono text-[#0EA5E9]">
                      Rs. {Math.max(0, newPoLines.reduce((acc, c) => acc + (c.qty * (c.cost_not_identified ? 0 : c.agreed_cost)), 0) - newPoDiscount).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* dispatch action */}
              <div className="space-y-2 pt-4">
                <button
                  type="submit"
                  className="w-full bg-[#0EA5E9] hover:bg-sky-600 text-white font-extrabold uppercase py-2 px-4 rounded text-xs select-none cursor-pointer transition-colors tracking-wide shadow-xs"
                  id="confirm-po-generation-btn"
                >
                  ✓ Dispatch Purchase Order
                </button>
                <button
                  type="button"
                  onClick={() => setSubView('list')}
                  className="w-full bg-slate-100 hover:bg-slate-200 border border-slate-350 text-slate-700 font-bold py-2 px-4 rounded text-xs uppercase"
                >
                  Cancel PO Setup
                </button>
              </div>
            </div>
          </form>
        </div>

      ) : (
        
        /* 7.7 NEW PROCUREMENT JOB SCREEN */
        <div id="new-proc-job-screen" className="max-w-xl mx-auto bg-white border border-[#E2DFDF] p-6 space-y-5 rounded-xs">
          
          {/* Header */}
          <div className="border-b pb-2 flex items-center space-x-2">
            <Calculator className="w-5 h-5 text-blue-700" />
            <div>
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-tight">New Client Procurement Sourcing Contract</h3>
              <p className="text-[10px] text-gray-500">Track bespoke items requested by regular site operators or shopkeepers.</p>
            </div>
          </div>

          {/* Sourcing flow notification */}
          <div className="bg-amber-50/50 border border-amber-200 p-3 italic text-[11px] text-amber-800 rounded-xs leading-normal select-none">
            <strong>Procurement Loop Flow:</strong> You purchase items/custom materials from vendor wholesale. You then bill/invoice the client at retail rates. Profit is securely calculated based on the pricing matrix.
          </div>

          {/* Form */}
          <form onSubmit={handleCreateProcurementJob} className="space-y-4">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Client name with datalist dropdown */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">
                  Client / Customer Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Faisalabad Textile Mills Ltd"
                  value={newJobClient}
                  onChange={e => setNewJobClient(e.target.value)}
                  className="w-full p-2 border border-[#E2DFDF] text-xs font-semibold"
                  list="already-customers-list"
                />
                <datalist id="already-customers-list">
                  {db.getParties().filter(p => p.type !== 'supplier' || p.is_customer_linked === true).map(c => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">
                  Procurement Quantity
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newJobQty}
                  onChange={e => setNewJobQty(Math.max(1, Number(e.target.value)))}
                  className="w-full p-2 border border-[#E2DFDF] font-mono text-xs font-bold"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">
                Material / Item Description (Free Text)
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 5 Packets USA Heavy Air Purifier elements - Baldwins"
                value={newJobDesc}
                onChange={e => setNewJobDesc(e.target.value)}
                className="w-full p-2 border border-[#E2DFDF] text-xs"
              />
            </div>

            {/* Pricing Matrix with Live Calculations */}
            <div className="bg-amber-50/20 border border-amber-200 p-4 rounded-xs space-y-3">
              <span className="text-[9px] uppercase font-black text-amber-800 tracking-wider block">Bespoke Financial Matrix</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-800 mb-1">
                    Your Wholesale Purchase Cost (Per Unit)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Enter cost..."
                    value={newJobCost}
                    onChange={e => setNewJobCost(Math.max(0, Number(e.target.value)))}
                    className="w-full p-2 border border-[#E2DFDF] bg-white font-mono text-xs font-bold text-rose-700"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-800 mb-1">
                    Bill To Client Retail Rate (Per Unit)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Enter retail..."
                    value={newJobBill}
                    onChange={e => setNewJobBill(Math.max(0, Number(e.target.value)))}
                    className="w-full p-2 border border-[#E2DFDF] bg-white font-mono text-xs font-bold text-blue-700"
                  />
                </div>
              </div>

              {/* Live calculations */}
              <div className="border-t pt-2 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-white/50 p-2 border">
                  <span className="text-[8px] text-gray-400 font-bold block uppercase">Est. Cost</span>
                  <span className="font-mono font-bold text-slate-800">
                    Rs. {(newJobCost * newJobQty).toLocaleString()}
                  </span>
                </div>
                <div className="bg-white/50 p-2 border">
                  <span className="text-[8px] text-gray-400 font-bold block uppercase">Est. Revenue</span>
                  <span className="font-mono font-bold text-blue-700">
                    Rs. {(newJobBill * newJobQty).toLocaleString()}
                  </span>
                </div>
                <div className="bg-white/50 p-2 border">
                  <span className="text-[8px] text-gray-400 font-bold block uppercase">Live Net Profit</span>
                  <span className="font-mono font-black text-green-600">
                    {userRole === 'Owner' 
                      ? `Rs. ${((newJobBill - newJobCost) * newJobQty).toLocaleString()}` 
                      : 'Owner Protected'}
                  </span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">
                Additional Notes
              </label>
              <textarea
                rows={2}
                value={newJobNotes}
                onChange={e => setNewJobNotes(e.target.value)}
                placeholder="Pick-up deadline, carrier details, client reference numbers etc."
                className="w-full p-2 border border-[#E2DFDF] text-xs"
              />
            </div>

            {/* Submit btn */}
            <div className="flex space-x-2 pt-3">
              <button
                type="button"
                onClick={() => setSubView('list')}
                className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold uppercase py-2.5 rounded cursor-pointer text-center"
              >
                Cancel Setup
              </button>
              <button
                type="submit"
                className="w-1/2 bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-extrabold uppercase py-2.5 rounded cursor-pointer text-center"
              >
                ✓ Create Job
              </button>
            </div>

          </form>
        </div>
      )}

      {/* RECORD SUPPLIER OUTGOING PAYMENT MODAL */}
      {showPaymentModal && selectedSupplier && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-tight flex items-center">
                <DollarSign className="w-4 h-4 text-amber-500 mr-1" />
                Record Supplier Outgoing Payment
              </h3>
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              Log payments made to <strong>{selectedSupplier.name}</strong>. This entry decreases outstanding supplier payables and logs the credit shift ledger automatically.
            </p>

            <form onSubmit={handlePaySupplier} className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">
                  Outstanding: Rs. {Math.abs(selectedSupplier.credit_balance).toLocaleString()}
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-500">Rs.</span>
                  <input 
                    type="number"
                    autoFocus
                    required
                    min="1"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    placeholder="Enter amount to pay..."
                    className="w-full p-2 pl-9 border rounded font-mono font-bold text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value as 'cash' | 'bank' | 'cheque')}
                  className="w-full p-2 border rounded font-sans text-xs bg-white"
                >
                  <option value="cash">Cash Outflow</option>
                  <option value="bank">Bank Wire / Online Transfer</option>
                  <option value="cheque">Cheque Settlement</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Remarks / Transaction Reference</label>
                <input 
                  type="text"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  placeholder="e.g. Online transfer to Habib Bank, HBL slip #8822"
                  className="w-full p-2 border rounded text-xs"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="w-1/2 py-2 bg-slate-250 hover:bg-slate-300 text-slate-800 text-xs font-bold uppercase rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold uppercase rounded cursor-pointer"
                >
                  ✓ Record Outflow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
