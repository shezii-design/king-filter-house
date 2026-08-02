import React, { useState, useEffect } from 'react';
import { db, encodeCipher } from '../data';
import { Party, Invoice, PaymentRecord, ChequeRecord, CashTransaction, SupplierBill } from '../types';
import { 
  DollarSign, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  User, 
  Check, 
  X, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight, 
  Coins, 
  Download,
  Building,
  History,
  Info,
  BookOpen,
  CreditCard
} from 'lucide-react';

interface AccountsViewProps {
  userRole: 'Owner' | 'Staff';
  onNavigate?: (tab: string) => void;
  cipherKey: string;
  revealRealValues?: boolean;
}

export default function AccountsView({ userRole, onNavigate, cipherKey, revealRealValues = false }: AccountsViewProps) {
  const formatAmount = (num: number): string => {
    if (revealRealValues) {
      return `Rs. ${Math.round(num).toLocaleString()}`;
    } else {
      return encodeCipher(num, cipherKey);
    }
  };

  // Base State Loaded from DB
  const [parties, setParties] = useState<Party[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [supplierBills, setSupplierBills] = useState<SupplierBill[]>([]);
  const [cheques, setCheques] = useState<ChequeRecord[]>([]);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  // Local View States
  const [activeSubTab, setActiveSubTab] = useState<'ar' | 'ap' | 'cashbook' | 'cheques'>(() => {
    return (localStorage.getItem('kfh_active_accounts_subtab') as any) || 'ar';
  });
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [chequeFilter, setChequeFilter] = useState<'all' | 'pending' | 'cleared' | 'bounced'>('all');

  // Record Payment Modal Control
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<{
    party: Party;
    type: 'receipt' | 'payment'; // receipt = from customer, payment = to supplier
  } | null>(null);

  // Modal Inputs
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payMethod, setPayMethod] = useState<'cash' | 'bank' | 'cheque'>('cash');
  const [payChequeNum, setPayChequeNum] = useState('');
  const [payChequeBank, setPayChequeBank] = useState('');
  const [payBankRef, setPayBankRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [modalError, setModalError] = useState('');

  // Hydrate Data from DB
  const reloadData = () => {
    const rawParties = db.getParties();
    const rawInvoices = db.getInvoices();
    const rawBills = db.getSupplierBills();
    const rawCheques = db.getCheques();
    const rawCash = db.getCashbook();
    const rawPayments = db.getPayments();

    setParties(rawParties);
    setInvoices(rawInvoices);
    setSupplierBills(rawBills);
    setCheques(rawCheques);
    setCashTransactions(rawCash);
    setPayments(rawPayments);
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Set default selected customer/supplier on load or change sub-tab
  useEffect(() => {
    if (activeSubTab === 'ar') {
      const customersList = parties.filter(p => p.type !== 'supplier' || p.is_customer_linked === true);
      if (customersList.length > 0) {
        setSelectedParty(customersList[0]);
      } else {
        setSelectedParty(null);
      }
    } else if (activeSubTab === 'ap') {
      const suppliersList = parties.filter(p => p.type === 'supplier' || p.is_supplier_linked === true);
      if (suppliersList.length > 0) {
        setSelectedParty(suppliersList[0]);
      } else {
        setSelectedParty(null);
      }
    }
  }, [activeSubTab, parties]);

  // =========================================================================
  // CALCULATE STATS (6.1) DYNAMICALLY
  // =========================================================================
  // 1. Total Receivables: Sum of positive customer credit balances
  const totalAR = parties
    .filter(p => (p.type !== 'supplier' || p.is_customer_linked === true) && p.credit_balance > 0)
    .reduce((sum, p) => sum + p.credit_balance, 0);

  // 2. Total Payables: Absolute value of negative supplier balances
  const totalAP = Math.abs(
    parties
      .filter(p => (p.type === 'supplier' || p.is_supplier_linked === true) && p.credit_balance < 0)
      .reduce((sum, p) => sum + p.credit_balance, 0)
  );

  // 3. Cash in Hand: running total of active cash book
  const currentCashInHand = cashTransactions.length > 0 
    ? cashTransactions[cashTransactions.length - 1].running_balance 
    : 0;

  // 4. Pending Cheques: Total amount of pending cheques
  const pendingChequesAmount = cheques
    .filter(c => c.status === 'pending')
    .reduce((sum, c) => sum + c.amount, 0);

  // =========================================================================
  // AGING CALCULATION HELPERS
  // =========================================================================
  const getDaysDifference = (timestamp: string) => {
    const today = new Date();
    const dateLogged = new Date(timestamp);
    const diffTime = Math.abs(today.getTime() - dateLogged.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // Get customer aging buckets based on unpaid invoices
  const getCustomerAging = (partyId: string) => {
    const outstandingInvoices = invoices.filter(
      inv => inv.party_id === partyId && inv.net_amount - inv.received_amount > 0
    );

    let b0_30 = 0;
    let b31_60 = 0;
    let b61_90 = 0;
    let b90_plus = 0;

    outstandingInvoices.forEach(inv => {
      const days = getDaysDifference(inv.timestamp);
      const due = inv.net_amount - inv.received_amount;
      if (days <= 30) b0_30 += due;
      else if (days <= 60) b31_60 += due;
      else if (days <= 90) b61_90 += due;
      else b90_plus += due;
    });

    const total = b0_30 + b31_60 + b61_90 + b90_plus;

    return { b0_30, b31_60, b61_90, b90_plus, total };
  };

  // Get supplier aging buckets based on unpaid POs/Bills
  const getSupplierAging = (partyId: string) => {
    const outstandingBills = supplierBills.filter(
      b => b.party_id === partyId && b.due_amount > 0
    );

    let b0_30 = 0;
    let b31_60 = 0;
    let b61_90 = 0;
    let b90_plus = 0;

    outstandingBills.forEach(b => {
      const days = getDaysDifference(b.timestamp);
      const due = b.due_amount;
      if (days <= 30) b0_30 += due;
      else if (days <= 60) b31_60 += due;
      else if (days <= 90) b61_90 += due;
      else b90_plus += due;
    });

    const total = b0_30 + b31_60 + b61_90 + b90_plus;

    return { b0_30, b31_60, b61_90, b90_plus, total };
  };

  // Global A/R Aging calculation across all customers
  const globalARAging = {
    b0_30: 0,
    b31_60: 0,
    b61_90: 0,
    b90_plus: 0,
    totalOverdue31: 0,
    uniqueCustomersCount31: 0,
    overduePartners31: new Set<string>()
  };

  parties.filter(p => p.type !== 'supplier' || p.is_customer_linked === true).forEach(p => {
    const aging = getCustomerAging(p.id);
    globalARAging.b0_30 += aging.b0_30;
    globalARAging.b31_60 += aging.b31_60;
    globalARAging.b61_90 += aging.b61_90;
    globalARAging.b90_plus += aging.b90_plus;
    
    if (aging.b31_60 + aging.b61_90 + aging.b90_plus > 0) {
      globalARAging.totalOverdue31 += (aging.b31_60 + aging.b61_90 + aging.b90_plus);
      globalARAging.overduePartners31.add(p.id);
    }
  });

  globalARAging.uniqueCustomersCount31 = globalARAging.overduePartners31.size;

  // =========================================================================
  // CHEQUE RESOLUTIONS (Cleared / Bounced)
  // =========================================================================
  const handleChequeStatusChange = (cheque: ChequeRecord, newStatus: 'cleared' | 'bounced') => {
    const updatedCheque: ChequeRecord = {
      ...cheque,
      status: newStatus
    };
    db.saveCheque(updatedCheque);

    if (newStatus === 'cleared') {
      // Clean deposit check
      if (cheque.type === 'receipt') {
        // Clear receipt into Cash Book balance
        db.addCashTransaction({
          date: new Date().toISOString().split('T')[0],
          description: `Cheque Cleared: ${cheque.cheque_number} (${cheque.bank_name}) from ${cheque.party_name}`,
          reference: `CHQ-${cheque.cheque_number}`,
          type: 'in',
          amount: cheque.amount
        });
      } else {
        // Issue payment from Cash Book
        db.addCashTransaction({
          date: new Date().toISOString().split('T')[0],
          description: `Issued Cheque Cleared: ${cheque.cheque_number} (${cheque.bank_name}) to ${cheque.party_name}`,
          reference: `CHQ-${cheque.cheque_number}`,
          type: 'out',
          amount: cheque.amount
        });
      }
    } else if (newStatus === 'bounced') {
      // 6.5 Bounced cheque: automatically re-opens outstanding balance in A/R
      const listParties = db.getParties();
      const pIdx = listParties.findIndex(p => p.id === cheque.party_id);
      if (pIdx >= 0) {
        if (cheque.type === 'receipt') {
          // Re-add to customer balance because receipt bounced
          listParties[pIdx].credit_balance += cheque.amount;
        } else {
          // Re-deduct from supplier balance because payment bounced
          listParties[pIdx].credit_balance -= cheque.amount;
        }
        db.saveParties(listParties);
      }
      
      // Also write back onto original invoice if possible
      if (cheque.type === 'receipt') {
        const clientInvoices = db.getInvoices().filter(i => i.party_id === cheque.party_id);
        if (clientInvoices.length > 0) {
          // Find most recently paid ones and subtract payment to restore due amount
          let amountToRestore = cheque.amount;
          clientInvoices.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          
          for (let i = 0; i < clientInvoices.length; i++) {
            if (amountToRestore <= 0) break;
            const inv = clientInvoices[i];
            const maxReopen = inv.received_amount;
            const reopenAmt = Math.min(amountToRestore, maxReopen);
            inv.received_amount -= reopenAmt;
            if (inv.payment_status === 'paid' && inv.received_amount < inv.net_amount) {
              inv.payment_status = inv.received_amount > 0 ? 'partial' : 'unpaid';
            }
            db.saveInvoice(inv);
            amountToRestore -= reopenAmt;
          }
        }
      } else {
        const supBills = db.getSupplierBills().filter(b => b.party_id === cheque.party_id);
        if (supBills.length > 0) {
          let amountToRestore = cheque.amount;
          supBills.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          for (let i = 0; i < supBills.length; i++) {
            if (amountToRestore <= 0) break;
            const b = supBills[i];
            const maxReopen = b.paid_amount;
            const reopenAmt = Math.min(amountToRestore, maxReopen);
            b.paid_amount -= reopenAmt;
            b.due_amount += reopenAmt;
            db.saveSupplierBill(b);
            amountToRestore -= reopenAmt;
          }
        }
      }

      db.logPendingSync(`Cheque ${cheque.cheque_number} BOUNCED. Outstanding balance restored in partner ledger.`);
    }

    reloadData();
  };

  // =========================================================================
  // SUBMISSION FOR RECORD PAYMENT MODAL (6.6)
  // =========================================================================
  const handleOpenPayment = (party: Party, type: 'receipt' | 'payment') => {
    setPaymentTarget({ party, type });
    // Outstanding balance to clear
    const maxBalance = type === 'receipt' ? party.credit_balance : Math.abs(party.credit_balance);
    setPayAmount(maxBalance > 0 ? maxBalance.toString() : '');
    setPayMethod('cash');
    setPayChequeNum('');
    setPayChequeBank('');
    setPayBankRef('');
    setPayNotes('');
    setModalError('');
    setShowPaymentModal(true);
  };

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTarget) return;

    const amountNum = parseFloat(payAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setModalError('Please enter a valid amount greater than Rs. 0.');
      return;
    }

    const { party, type } = paymentTarget;
    const maxBalance = type === 'receipt' ? party.credit_balance : Math.abs(party.credit_balance);

    if (amountNum > maxBalance) {
      setModalError(`Amount entered (Rs. ${amountNum.toLocaleString()}) exceeds the outstanding balance (Rs. ${maxBalance.toLocaleString()}).`);
      return;
    }

    if (payMethod === 'cheque' && (!payChequeNum.trim() || !payChequeBank.trim())) {
      setModalError('Both Bank Name and Cheque Number are strictly required for cheque registrations.');
      return;
    }

    // Process Ledger Update & Save Payment Record
    const newPaymentId = "pay-" + Date.now();
    const newPayment: PaymentRecord = {
      id: newPaymentId,
      party_id: party.id,
      party_name: party.name,
      amount: amountNum,
      timestamp: new Date().toISOString(),
      date: payDate,
      method: payMethod,
      cheque_number: payMethod === 'cheque' ? payChequeNum : undefined,
      bank_name: payMethod === 'cheque' ? payChequeBank : undefined,
      transaction_ref: payMethod === 'bank' ? payBankRef : undefined,
      notes: payNotes.trim() ? payNotes : undefined,
      user: userRole,
      type
    };

    // Save payment, sync with party ledger and cashbook
    db.savePaymentAndSync(newPayment);

    // Apply Payment to Outstanding Documents (FIFO Allocations)
    if (type === 'receipt') {
      // Allocate to oldest customer invoices
      const clientInvoices = db.getInvoices().filter(
        inv => inv.party_id === party.id && inv.net_amount - inv.received_amount > 0
      );
      // Sort oldest first
      clientInvoices.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      let remainingPayment = amountNum;
      for (let i = 0; i < clientInvoices.length; i++) {
        if (remainingPayment <= 0) break;
        const inv = clientInvoices[i];
        const outstanding = inv.net_amount - inv.received_amount;
        const applyAmt = Math.min(remainingPayment, outstanding);
        inv.received_amount += applyAmt;
        inv.payment_status = inv.received_amount >= inv.net_amount ? 'paid' : 'partial';
        db.saveInvoice(inv);
        remainingPayment -= applyAmt;
      }
    } else {
      // Allocate to supplier bills
      const supBills = db.getSupplierBills().filter(b => b.party_id === party.id && b.due_amount > 0);
      supBills.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      let remainingPayment = amountNum;
      for (let i = 0; i < supBills.length; i++) {
        if (remainingPayment <= 0) break;
        const b = supBills[i];
        const applyAmt = Math.min(remainingPayment, b.due_amount);
        b.paid_amount += applyAmt;
        b.due_amount -= applyAmt;
        db.saveSupplierBill(b);
        remainingPayment -= applyAmt;
      }
    }

    // Add Cheque if selected
    if (payMethod === 'cheque') {
      const newCheque: ChequeRecord = {
        id: "ch-" + Date.now(),
        cheque_number: payChequeNum,
        bank_name: payChequeBank,
        party_id: party.id,
        party_name: party.name,
        amount: amountNum,
        due_date: payDate, // date written on cheque
        received_date: new Date().toISOString().split('T')[0],
        status: 'pending',
        type: type === 'receipt' ? 'receipt' : 'payment',
        notes: payNotes
      };
      db.saveCheque(newCheque);
    } else if (payMethod === 'bank') {
      // Direct Bank Transfer logged to Cash Book if bank transactions are recorded
      db.addCashTransaction({
        date: payDate,
        description: `${type === 'receipt' ? 'Bank Receipt' : 'Bank Payment'} via Transfer: ${payBankRef} for ${party.name}`,
        reference: payBankRef,
        type: type === 'receipt' ? 'in' : 'out',
        amount: amountNum
      });
    }

    // Final Setup & Refresh
    setShowPaymentModal(false);
    reloadData();
  };

  // Filter cheques based on state tab
  const getFilteredCheques = () => {
    if (chequeFilter === 'all') return cheques;
    return cheques.filter(c => c.status === chequeFilter);
  };

  return (
    <div className="space-y-5 flex flex-col h-full overflow-y-auto pr-1" id="accounts-module">
      
      {/* 6.1 STATS VIEW ROW (ALWAYS VISIBLE ABOVE ALL SUB-TABS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="accounts-overview-stats">
        
        {/* Total A/R - red border */}
        <div className="bg-white border-l-4 border-l-[#0EA5E9] p-4 rounded-md shadow-sm border border-slate-200 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Accounts Receivable (A/R)</p>
            <h4 className="text-xl font-mono font-black text-[#2A2727] mt-1 select-all">
              {formatAmount(totalAR)}
            </h4>
            <p className="text-[9px] text-gray-400 mt-0.5">Active customer unpaid balances</p>
          </div>
          <div className="w-9 h-9 bg-sky-50 text-[#0EA5E9] rounded-full flex items-center justify-center font-bold text-sm">
            Rs
          </div>
        </div>

        {/* Total A/P - amber border */}
        <div className="bg-white border-l-4 border-l-amber-500 p-4 rounded-md shadow-sm border border-slate-200 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Accounts Payable (A/P)</p>
            <h4 className="text-xl font-mono font-black text-[#2A2727] mt-1 select-all">
              {formatAmount(totalAP)}
            </h4>
            <p className="text-[9px] text-gray-400 mt-0.5">Our outstanding supplier balances</p>
          </div>
          <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center font-bold text-sm">
            Cr
          </div>
        </div>

        {/* Cash in Hand - green border */}
        <div className="bg-white border-l-4 border-l-emerald-500 p-4 rounded-md shadow-sm border border-slate-200 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Running Cash in Hand</p>
            <h4 className="text-xl font-mono font-black text-emerald-700 mt-1 select-all">
              {formatAmount(currentCashInHand)}
            </h4>
            <p className="text-[9px] text-gray-400 mt-0.5">Live store register balance</p>
          </div>
          <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center font-bold text-sm">
            <Coins className="w-4 h-4" />
          </div>
        </div>

        {/* Pending Cheques - blue border */}
        <div className="bg-white border-l-4 border-l-blue-500 p-4 rounded-md shadow-sm border border-slate-200 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Unresolved Cheques Register</p>
            <h4 className="text-xl font-mono font-black text-blue-700 mt-1 select-all">
              {formatAmount(pendingChequesAmount)}
            </h4>
            <p className="text-[9px] text-gray-400 mt-0.5">Total outstanding cheque valuation</p>
          </div>
          <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
            <Calendar className="w-4 h-4" />
          </div>
        </div>

      </div>

      {/* SUB-TABS SELECT ROUTING */}
      <div className="border-b border-[#E2DFDF] bg-slate-50/80 flex flex-wrap gap-2 pt-1 px-2 rounded-t" id="accounts-subtabs-nav">
        {[
          { key: 'ar', label: 'A/R Receivables', icon: ArrowUpRight, iconColor: 'text-emerald-500' },
          { key: 'ap', label: 'A/P Payables', icon: ArrowDownRight, iconColor: 'text-rose-500' },
          { key: 'cashbook', label: 'Daily Cash Book', icon: BookOpen, iconColor: 'text-amber-500' },
          { key: 'cheques', label: 'Cheque Registers', icon: CreditCard, iconColor: 'text-blue-500' }
        ].map(subTab => {
          const IconComponent = subTab.icon;
          const isSelected = activeSubTab === subTab.key;
          return (
            <button
              key={subTab.key}
              onClick={() => {
                setActiveSubTab(subTab.key as any);
                localStorage.setItem('kfh_active_accounts_subtab', subTab.key);
              }}
              className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 -mb-[1px] transition-all duration-150 cursor-pointer flex items-center space-x-2 ${
                isSelected 
                  ? 'border-b-[#0EA5E9] text-[#0EA5E9] bg-white border-x border-x-gray-250 shadow-xs' 
                  : 'border-b-transparent text-gray-400 hover:text-gray-800 hover:bg-slate-100/60'
              }`}
            >
              <IconComponent className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#0EA5E9]' : subTab.iconColor}`} />
              <span>{subTab.label}</span>
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          6.2 DEBIT RECEIVABLES SUB-TAB (A/R)
          ===================================================================== */}
      {activeSubTab === 'ar' && (
        <div className="space-y-4" id="view-accounts-receivables">
          
          {/* Aging metrics breakdown top section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3 border rounded-lg shadow-sm">
            <div className="p-3 border rounded border-l-4 border-l-emerald-500 flex flex-col">
              <span className="text-[9px] text-gray-450 font-bold uppercase">0 - 30 Days Due</span>
              <span className="text-xs font-mono font-black text-slate-700 mt-1">Rs. {globalARAging.b0_30.toLocaleString()}</span>
              <span className="text-[8px] text-emerald-600 mt-0.5 font-medium">Standard terms status</span>
            </div>
            <div className="p-3 border rounded border-l-4 border-l-amber-500 flex flex-col">
              <span className="text-[9px] text-gray-450 font-bold uppercase">31 - 60 Days Due</span>
              <span className="text-xs font-mono font-black text-slate-700 mt-1">Rs. {globalARAging.b31_60.toLocaleString()}</span>
              <span className="text-[8px] text-amber-600 mt-0.5 font-medium">Mild alert followup</span>
            </div>
            <div className="p-3 border rounded border-l-4 border-l-orange-550 flex flex-col">
              <span className="text-[9px] text-gray-450 font-bold uppercase">61 - 90 Days Due</span>
              <span className="text-xs font-mono font-black text-slate-700 mt-1">Rs. {globalARAging.b61_90.toLocaleString()}</span>
              <span className="text-[8px] text-orange-600 mt-0.5 font-medium">Critical collector alert</span>
            </div>
            <div className="p-3 border rounded border-l-4 border-l-red-500 flex flex-col">
              <span className="text-[9px] text-gray-450 font-bold uppercase">90+ Days Past Due</span>
              <span className="text-xs font-mono font-black text-[#0EA5E9] mt-1">Rs. {globalARAging.b90_plus.toLocaleString()}</span>
              <span className="text-[8px] text-red-500 mt-0.5 font-bold">Severe legal reclaim limit</span>
            </div>
          </div>

          {/* Warning banner if overdue exceed 31+ days limit */}
          {globalARAging.totalOverdue31 > 0 && (
            <div className="bg-sky-50 border border-sky-200 rounded p-3 text-xs text-[#0ea5e9] flex items-center space-x-2 animate-fadeIn" id="ar-overdue-warning">
              <AlertTriangle className="w-4 h-4 text-[#0EA5E9] flex-shrink-0 animate-bounce" />
              <p className="font-medium">
                <strong>Outstanding Alert:</strong> Rs. {globalARAging.totalOverdue31.toLocaleString()} is overdue 31+ days across {globalARAging.uniqueCustomersCount31} key customers.
              </p>
            </div>
          )}

          {/* Split Panel view for Customer List & Selected customer ledger */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Left side list customers (7 columns) */}
            <div className="lg:col-span-7 space-y-2 max-h-[500px] overflow-y-auto" id="ar-customers-list">
              {parties.filter(p => p.type !== 'supplier' || p.is_customer_linked === true).map(customer => {
                const aging = getCustomerAging(customer.id);
                const hasCredit = customer.credit_balance > 0;
                
                // credit limit alert (more than 80%)
                const creditLimit = customer.credit_limit || 50000;
                const isNearLimit = customer.credit_balance > 0.8 * creditLimit;

                return (
                  <div 
                    key={customer.id}
                    onClick={() => setSelectedParty(customer)}
                    className={`bg-white p-4 rounded-lg border shadow-sm transition-all duration-150 cursor-pointer text-xs space-y-2 flex flex-col justify-between hover:border-l-4 hover:border-l-[#0EA5E9] ${
                      selectedParty?.id === customer.id ? 'border-l-4 border-l-[#0EA5E9] ring-1 ring-red-100' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-slate-800 text-sm select-all">{customer.name}</h4>
                          <span className="text-[8px] bg-slate-100 text-slate-500 uppercase px-1.5 py-0.2 rounded font-black font-mono">
                            {customer.customer_type || 'Retail'}
                          </span>
                          {isNearLimit && (
                            <span className="text-[8.5px] bg-sky-100 text-[#0EA5E9] px-2 py-0.2 rounded font-black uppercase flex items-center space-x-0.5 border border-sky-200">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span>Near Credit Limit</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 space-x-2 font-mono mt-1">
                          <span>Phone: {customer.phone}</span>
                          <span>•</span>
                          <span>Faisalabad Ledger</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`font-mono font-bold text-sm ${hasCredit ? 'text-sky-600' : 'text-slate-500'}`}>
                          Rs. {customer.credit_balance.toLocaleString()}
                        </span>
                        <p className="text-[9px] text-gray-400 mt-0.5 font-mono">Ledger Receivable</p>
                      </div>
                    </div>

                    {/* Mini aging bar below name */}
                    {hasCredit && (
                      <div className="space-y-1">
                        <div className="h-2 w-full bg-slate-100 rounded-full flex overflow-hidden">
                          {aging.b0_30 > 0 && (
                            <div 
                              title={`0-30 Days: Rs. ${aging.b0_30}`}
                              className="bg-emerald-500" 
                              style={{ width: `${(aging.b0_30 / aging.total) * 100}%` }}
                            />
                          )}
                          {aging.b31_60 > 0 && (
                            <div 
                              title={`31-60 Days: Rs. ${aging.b31_60}`}
                              className="bg-amber-400" 
                              style={{ width: `${(aging.b31_60 / aging.total) * 100}%` }}
                            />
                          )}
                          {aging.b61_90 > 0 && (
                            <div 
                              title={`61-90 Days: Rs. ${aging.b61_90}`}
                              className="bg-orange-400" 
                              style={{ width: `${(aging.b61_90 / aging.total) * 100}%` }}
                            />
                          )}
                          {aging.b90_plus > 0 && (
                            <div 
                              title={`90+ Days: Rs. ${aging.b90_plus}`}
                              className="bg-sky-500" 
                              style={{ width: `${(aging.b90_plus / aging.total) * 100}%` }}
                            />
                          )}
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-gray-500 font-mono">
                          <span className="text-emerald-600">0-30d: {Math.round((aging.b0_30/aging.total)*100 || 0)}%</span>
                          <span className="text-amber-600">31-60d: {Math.round((aging.b31_60/aging.total)*100 || 0)}%</span>
                          <span className="text-[#0ea5e9] font-bold">90+d: {Math.round((aging.b90_plus/aging.total)*100 || 0)}%</span>
                        </div>
                      </div>
                    )}

                    {/* Show Record Payment button instantly if outstanding balance exists */}
                    {hasCredit && (
                      <div className="flex justify-end pt-1.5 border-t border-dashed border-[#F5F4F4]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPayment(customer, 'receipt');
                          }}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9.5px] uppercase tracking-wider rounded transition shadow flex items-center space-x-1 cursor-pointer"
                        >
                          <Coins className="w-3 h-3" />
                          <span>Record Payment</span>
                        </button>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>

            {/* Right side Customer ledger invoice list (5 columns) */}
            <div className="lg:col-span-5 bg-white border rounded-lg p-4 shadow-sm flex flex-col justify-between max-h-[500px]" id="ar-customer-ledger-panel">
              {selectedParty ? (
                <div className="flex flex-col h-full justify-between">
                  <div className="space-y-4">
                    <div className="border-b pb-3 bg-slate-50/50 p-2 rounded">
                      <span className="text-[10px] text-gray-400 uppercase font-bold">Customer Ledger Directory</span>
                      <h4 className="font-extrabold text-sm text-slate-800 uppercase tracking-tight mt-0.5 select-all">
                        {selectedParty.name}
                      </h4>
                      <p className="text-[10px] text-gray-500 mt-1">Outstanding invoices list</p>
                    </div>

                    {/* Total Receivables value card */}
                    <div className="bg-sky-50/50 border border-sky-200 p-3 rounded-md text-center flex flex-col justify-center">
                      <span className="text-[10px] text-[#0EA5E9] font-extrabold uppercase tracking-wide">TOTAL CLIENT BALANCE DEBITED:</span>
                      <h5 className="text-xl font-mono font-black text-slate-800 mt-1 select-all">
                        Rs. {selectedParty.credit_balance.toLocaleString()}
                      </h5>
                    </div>

                    {/* Individual Invoice listings */}
                    <div className="space-y-2 overflow-y-auto max-h-[220px] pr-1">
                      {invoices.filter(inv => inv.party_id === selectedParty.id && inv.net_amount - inv.received_amount > 0).length === 0 ? (
                        <div className="text-center py-6 text-gray-450 border border-dashed rounded italic text-xs">
                          No unpaid commerce invoices registered for this customer.
                        </div>
                      ) : (
                        invoices
                          .filter(inv => inv.party_id === selectedParty.id && inv.net_amount - inv.received_amount > 0)
                          .map(inv => {
                            const days = getDaysDifference(inv.timestamp);
                            const due = inv.net_amount - inv.received_amount;
                            
                            // Left border colour selection
                            const borderCol = days <= 30 ? 'border-l-emerald-500' : (days <= 60 ? 'border-l-amber-500' : 'border-l-red-500');

                            return (
                              <div key={inv.id} className={`border border-gray-200 border-l-4 ${borderCol} p-2.5 rounded text-xs hover:bg-slate-50 flex items-center justify-between`}>
                                <div className="space-y-0.5">
                                  <div className="flex items-center space-x-1">
                                    <span className="font-mono font-bold text-[#0EA5E9]">{inv.invoice_number}</span>
                                    <span className="text-[9px] bg-slate-100 text-slate-500 px-1 font-mono">
                                      {days} days ago
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-gray-400 font-mono">Date: {new Date(inv.timestamp).toLocaleDateString()}</p>
                                </div>

                                <div className="text-right">
                                  <p className="font-mono font-black text-rose-700 select-all">Rs. {due.toLocaleString()}</p>
                                  <p className="text-[9px] text-gray-400 font-mono">Due of {inv.net_amount.toLocaleString()}</p>
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>

                  {selectedParty.credit_balance > 0 && (
                    <div className="pt-4 border-t">
                      <button
                        onClick={() => handleOpenPayment(selectedParty, 'receipt')}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded transition shadow flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <Coins className="w-4 h-4" />
                        <span>Record Receipt payment</span>
                      </button>
                    </div>
                  )}

                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 italic text-xs py-10">
                  Select a customer to visualize outstanding documents ledger.
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* =====================================================================
          6.3 SUPP PAYABLES SUB-TAB (A/P)
          ===================================================================== */}
      {activeSubTab === 'ap' && (
        <div className="space-y-4" id="view-accounts-payables">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Left sideSupplier cards (7 cols) */}
            <div className="lg:col-span-7 space-y-2 max-h-[500px] overflow-y-auto" id="ap-suppliers-list">
              {parties.filter(p => p.type === 'supplier' || p.is_supplier_linked === true).map(supplier => {
                const aging = getSupplierAging(supplier.id);
                const hasBalance = supplier.credit_balance < 0; // negative represents payables
                const absBalance = Math.abs(supplier.credit_balance);

                return (
                  <div 
                    key={supplier.id}
                    onClick={() => setSelectedParty(supplier)}
                    className={`bg-white p-4 rounded-lg border shadow-sm transition-all duration-150 cursor-pointer text-xs space-y-2 flex flex-col justify-between hover:border-l-4 hover:border-l-amber-500 ${
                      selectedParty?.id === supplier.id ? 'border-l-4 border-l-amber-500 ring-1 ring-amber-100' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm select-all">{supplier.name}</h4>
                        <p className="text-[10px] text-gray-400 font-mono mt-1">Contact: {supplier.phone} | City: {supplier.city}</p>
                      </div>

                      <div className="text-right">
                        <span className={`font-mono font-bold text-sm ${hasBalance ? 'text-amber-600' : 'text-slate-500'}`}>
                          Rs. {absBalance.toLocaleString()}
                        </span>
                        <p className="text-[9px] text-gray-400 mt-0.5 font-mono">Outstanding Payable</p>
                      </div>
                    </div>

                    {/* Same aging mini-bars */}
                    {hasBalance && (
                      <div className="space-y-1">
                        <div className="h-2 w-full bg-slate-100 rounded-full flex overflow-hidden">
                          {aging.b0_30 > 0 && (
                            <div 
                              title={`0-30 Days: Rs. ${aging.b0_30}`}
                              className="bg-emerald-500" 
                              style={{ width: `${(aging.b0_30 / aging.total) * 100}%` }}
                            />
                          )}
                          {aging.b31_60 > 0 && (
                            <div 
                              title={`31-60 Days: Rs. ${aging.b31_60}`}
                              className="bg-amber-400" 
                              style={{ width: `${(aging.b31_60 / aging.total) * 100}%` }}
                            />
                          )}
                          {aging.b61_90 > 0 && (
                            <div 
                              title={`61-90 Days: Rs. ${aging.b61_90}`}
                              className="bg-orange-400" 
                              style={{ width: `${(aging.b61_90 / aging.total) * 100}%` }}
                            />
                          )}
                          {aging.b90_plus > 0 && (
                            <div 
                              title={`90+ Days: Rs. ${aging.b90_plus}`}
                              className="bg-sky-500" 
                              style={{ width: `${(aging.b90_plus / aging.total) * 100}%` }}
                            />
                          )}
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-gray-500 font-mono">
                          <span className="text-emerald-600">0-30d: {Math.round((aging.b0_30/aging.total)*100 || 0)}%</span>
                          <span className="text-amber-600">31-60d: {Math.round((aging.b31_60/aging.total)*100 || 0)}%</span>
                          <span className="text-sky-600 font-bold">90+d: {Math.round((aging.b90_plus/aging.total)*100 || 0)}%</span>
                        </div>
                      </div>
                    )}

                    {hasBalance && (
                      <div className="flex justify-end pt-1.5 border-t border-dashed border-[#F5F4F4]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPayment(supplier, 'payment');
                          }}
                          className="px-3 py-1 bg-amber-550 hover:bg-amber-600 text-white font-black text-[9.5px] uppercase tracking-wider rounded transition shadow flex items-center space-x-1 cursor-pointer"
                        >
                          <Coins className="w-3 h-3" />
                          <span>Pay Supplier</span>
                        </button>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>

            {/* Right side Supplier Bills Panel (5 cols) */}
            <div className="lg:col-span-5 bg-white border rounded-lg p-4 shadow-sm flex flex-col justify-between max-h-[500px]" id="ap-supplier-bills-panel">
              {selectedParty ? (
                <div className="flex flex-col h-full justify-between">
                  <div className="space-y-4">
                    <div className="border-b pb-3 bg-slate-50/50 p-2 rounded">
                      <span className="text-[10px] text-gray-400 uppercase font-bold">Supplier Account Ledger</span>
                      <h4 className="font-extrabold text-sm text-slate-800 uppercase tracking-tight mt-0.5 select-all">
                        {selectedParty.name}
                      </h4>
                      <p className="text-[10px] text-gray-500 mt-1 font-mono">Balance Payable Tracker</p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-md text-center flex flex-col justify-center animate-fadeIn">
                      <span className="text-[10px] text-amber-600 font-extrabold uppercase tracking-wide">TOTAL OWING CREDIT PAYABLE:</span>
                      <h5 className="text-xl font-mono font-black text-slate-800 mt-1 select-all">
                        Rs. {Math.abs(selectedParty.credit_balance).toLocaleString()}
                      </h5>
                    </div>

                    {/* Bills (purchase orders with outstanding amounts) */}
                    <div className="space-y-2 overflow-y-auto max-h-[220px] pr-1">
                      {supplierBills.filter(b => b.party_id === selectedParty.id && b.due_amount > 0).length === 0 ? (
                        <div className="text-center py-6 text-gray-450 border border-dashed rounded italic text-xs">
                          No outstanding supplier bills logged in registry.
                        </div>
                      ) : (
                        supplierBills
                          .filter(b => b.party_id === selectedParty.id && b.due_amount > 0)
                          .map(b => {
                            const days = getDaysDifference(b.timestamp);
                            const borderCol = days <= 30 ? 'border-l-emerald-500' : (days <= 60 ? 'border-l-amber-500' : 'border-l-red-500');

                            return (
                              <div key={b.id} className={`border border-gray-200 border-l-4 ${borderCol} p-2.5 rounded text-xs hover:bg-slate-50 flex items-center justify-between`}>
                                <div className="space-y-0.5">
                                  <div className="flex items-center space-x-1">
                                    <span className="font-mono font-bold text-amber-600">{b.bill_number}</span>
                                    <span className="text-[9px] bg-slate-100 text-slate-500 px-1 font-mono">
                                      {days} days ago
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-gray-400 font-mono">Date: {b.date}</p>
                                </div>

                                <div className="text-right">
                                  <p className="font-mono font-black text-amber-700 select-all">Rs. {b.due_amount.toLocaleString()}</p>
                                  <p className="text-[9px] text-gray-400 font-mono">Bills Total: {b.amount.toLocaleString()}</p>
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>

                  {selectedParty.credit_balance < 0 && (
                    <div className="pt-4 border-t">
                      <button
                        onClick={() => handleOpenPayment(selectedParty, 'payment')}
                        className="w-full py-2.5 bg-amber-550 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wider rounded transition shadow flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <Coins className="w-4 h-4" />
                        <span>Record Supplier Payment</span>
                      </button>
                    </div>
                  )}

                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 italic text-xs py-10">
                  Select a supplier partner to visualize outstanding documents ledger.
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* =====================================================================
          6.4 DAILY CASH BOOK TODAY TAB
          ===================================================================== */}
      {activeSubTab === 'cashbook' && (
        <div className="space-y-4" id="view-accounts-cashbook">
          
          {/* Today Summary */}
          {(() => {
            const todayStr = new Date().toISOString().split('T')[0];
            const todayTxList = cashTransactions.filter(tx => tx.date === todayStr);
            const todayCashIn = todayTxList.filter(tx => tx.type === 'in').reduce((sum, tx) => sum + tx.amount, 0);
            const todayCashOut = todayTxList.filter(tx => tx.type === 'out').reduce((sum, tx) => sum + tx.amount, 0);

            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="cashbook-today-summary">
                
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg flex flex-col justify-center">
                  <span className="text-[10px] text-emerald-800 font-extrabold uppercase tracking-wide flex items-center space-x-1">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Today's Cash Ledger Inward:</span>
                  </span>
                  <p className="text-xl font-mono font-black text-emerald-900 mt-1 select-all">
                    Rs. {todayCashIn.toLocaleString()}
                  </p>
                  <p className="text-[8.5px] text-emerald-700 mt-0.5 font-medium">All cash checkout receipts today</p>
                </div>

                <div className="bg-rose-50 border border-rose-200 p-4 rounded-lg flex flex-col justify-center">
                  <span className="text-[10px] text-rose-800 font-extrabold uppercase tracking-wide flex items-center space-x-1">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    <span>Today's Cash Ledger Outward:</span>
                  </span>
                  <p className="text-xl font-mono font-black text-rose-900 mt-1 select-all">
                    Rs. {todayCashOut.toLocaleString()}
                  </p>
                  <p className="text-[8.5px] text-rose-700 mt-0.5 font-medium">All paid supply & cost expenses today</p>
                </div>

                <div className="bg-[#2A2727] p-4 text-white rounded-lg flex flex-col justify-center">
                  <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide">
                    Live Cash Balance Register
                  </span>
                  <p className="text-xl font-mono font-black text-emerald-400 mt-1 select-all">
                    Rs. {currentCashInHand.toLocaleString()}
                  </p>
                  <p className="text-[8.5px] text-gray-350 mt-0.5">Consolidated verified cash reservoir</p>
                </div>

              </div>
            );
          })()}

          {/* Transactions Table: Date | Description | Reference (red mono) | Cash In | Cash Out | Balance */}
          <div className="bg-white border rounded-lg shadow-sm overflow-hidden" id="cashbook-transactions-register">
            <div className="px-4 py-3 bg-slate-50 border-b flex justify-between items-center">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                Live Transaction Log & Cash Journals
              </h4>
              <span className="text-[9.5px] bg-[#0EA5E9] text-white px-2 py-0.5 font-mono font-black rounded uppercase">
                Synchronized Cash Registry
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 font-sans border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b font-extrabold text-[#2A2727]">
                    <th className="p-3">Log Date</th>
                    <th className="p-3">Description Context</th>
                    <th className="p-3">Reference Key</th>
                    <th className="p-3 text-right">Cash In (+)</th>
                    <th className="p-3 text-right">Cash Out (-)</th>
                    <th className="p-3 text-right">Running Register Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono">
                  {cashTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-400 italic font-sans">
                        No transactions found in cache storage.
                      </td>
                    </tr>
                  ) : (
                    cashTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-55 transition-none">
                        <td className="p-3 text-gray-500 whitespace-nowrap">{tx.date}</td>
                        <td className="p-3 font-sans text-slate-800">{tx.description}</td>
                        <td className="p-3 text-[#0EA5E9] font-extrabold whitespace-nowrap select-all">{tx.reference}</td>
                        <td className="p-3 text-right text-emerald-700 font-bold">
                          {tx.type === 'in' ? `Rs. ${tx.amount.toLocaleString()}` : '—'}
                        </td>
                        <td className="p-3 text-right text-[#0EA5E9] font-bold">
                          {tx.type === 'out' ? `Rs. ${tx.amount.toLocaleString()}` : '—'}
                        </td>
                        <td className="p-3 text-right text-slate-900 font-black">
                          Rs. {tx.running_balance.toLocaleString()}
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

      {/* =====================================================================
          6.5 CHEQUES REGISTER MANAGER
          ===================================================================== */}
      {activeSubTab === 'cheques' && (
        <div className="space-y-4" id="view-accounts-cheques">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="cheques-summary-row">
            {/* Incoming cheques */}
            <div className="bg-blue-50/50 border border-blue-200 p-4 rounded-lg flex justify-between items-center">
              <div>
                <span className="text-[10px] text-blue-800 font-extrabold uppercase tracking-wide">
                  Pending Incoming Receipts (Cheques):
                </span>
                <p className="text-xl font-mono font-black text-blue-900 mt-1 select-all">
                  Rs. {cheques.filter(c => c.type === 'receipt' && c.status === 'pending').reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
                </p>
                <p className="text-[8.5px] text-gray-500 mt-0.5">Cheques received from customers in hand</p>
              </div>
              <Coins className="w-8 h-8 text-blue-550 opacity-40" />
            </div>

            {/* Outgoing cheques */}
            <div className="bg-amber-50/50 border border-amber-200 p-4 rounded-lg flex justify-between items-center">
              <div>
                <span className="text-[10px] text-amber-800 font-extrabold uppercase tracking-wide">
                  Pending Outgoing Payments (Cheques):
                </span>
                <p className="text-xl font-mono font-black text-amber-900 mt-1 select-all">
                  Rs. {cheques.filter(c => c.type === 'payment' && c.status === 'pending').reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
                </p>
                <p className="text-[8.5px] text-gray-500 mt-0.5">Vendor cheques written not yet cleared</p>
              </div>
              <Building className="w-8 h-8 text-amber-550 opacity-40" />
            </div>
          </div>

          {/* Filter Toolbar: All | Pending | Cleared | Bounced */}
          <div className="bg-white border rounded-lg shadow-sm p-4 space-y-4" id="cheques-list-register">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 gap-3">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-850">
                  Cheque Clearance Registers & Ledger Logs
                </h4>
                <p className="text-[11px] text-gray-400">Manage post-dated merchant cheque assets</p>
              </div>

              {/* Status pill selector filters */}
              <div className="flex flex-wrap gap-1.5" id="cheque-status-filters">
                {(['all', 'pending', 'cleared', 'bounced'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setChequeFilter(f)}
                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wide rounded-sm border cursor-pointer ${
                      chequeFilter === f 
                        ? 'bg-[#0EA5E9] text-white border-transparent' 
                        : 'bg-white text-gray-500 hover:bg-slate-100'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Cheques Grid / List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="cheques-items-container">
              {getFilteredCheques().length === 0 ? (
                <div className="col-span-2 text-center py-10 italic text-xs text-gray-400 border border-dashed rounded">
                  No registered cheques match the select status filter ({chequeFilter.toUpperCase()}).
                </div>
              ) : (
                getFilteredCheques().map((cheque) => {
                  const today = new Date().toISOString().split('T')[0];
                  const overDays = Math.ceil((new Date(cheque.due_date).getTime() - new Date(today).getTime()) / (1000 * 3600 * 24));
                  const isOverdue = cheque.status === 'pending' && overDays < 0;

                  return (
                    <div 
                      key={cheque.id} 
                      className={`p-4 bg-white border rounded-lg shadow-sm flex flex-col justify-between space-y-3 relative hover:shadow transition ${
                        cheque.status === 'cleared' ? 'border-l-4 border-l-emerald-500 bg-emerald-50/10' : 
                        cheque.status === 'bounced' ? 'border-l-4 border-l-red-500 bg-sky-50/10' : 'border-l-4 border-l-blue-500 bg-blue-50/10'
                      }`}
                    >
                      {/* Top Row Bank/Num */}
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-mono text-[10px] uppercase font-bold text-slate-450 tracking-wider">
                            Ref: {cheque.cheque_number}
                          </p>
                          <h4 className="text-xs font-bold text-slate-800 mt-1">{cheque.bank_name}</h4>
                          <p className="text-[10px] text-slate-500">Partner: {cheque.party_name}</p>
                        </div>

                        <div className="text-right">
                          <p className="font-mono font-black text-slate-900 text-sm select-all">Rs. {cheque.amount.toLocaleString()}</p>
                          <span className={`text-[8.5px] uppercase font-black px-1.5 py-0.2 rounded inline-block mt-1 ${
                            cheque.status === 'cleared' ? 'bg-emerald-100 text-emerald-700' :
                            cheque.status === 'bounced' ? 'bg-sky-100 text-sky-600' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {cheque.status}
                          </span>
                        </div>
                      </div>

                      {/* Dates and counters */}
                      <div className="border-t border-dashed pt-2 flex flex-col sm:flex-row justify-between text-[10px] text-gray-500 gap-2">
                        <div>
                          <p>Written Due: {cheque.due_date}</p>
                          <p className="text-[9px] text-gray-400">Inward Date: {cheque.received_date}</p>
                        </div>
                        
                        {cheque.status === 'pending' && (
                          <div className="text-right flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            {isOverdue ? (
                              <span className="text-[#0EA5E9] font-black uppercase blink">OVERDUE BY {Math.abs(overDays)} DAYS</span>
                            ) : (
                              <span>Due in <strong className="font-mono font-bold text-slate-800">{overDays}</strong> days</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions for Cleared vs Bounced */}
                      {cheque.status === 'pending' && (
                        <div className="flex gap-2 pt-2 border-t mt-1">
                          <button
                            onClick={() => handleChequeStatusChange(cheque, 'cleared')}
                            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] uppercase tracking-wider rounded transition flex items-center justify-center space-x-1 cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                            <span>✓ Cleared</span>
                          </button>

                          <button
                            onClick={() => handleChequeStatusChange(cheque, 'bounced')}
                            className="flex-1 py-1.5 bg-sky-50 hover:bg-sky-100 text-[#0EA5E9] font-black text-[9px] uppercase tracking-wider rounded transition border border-sky-200 flex items-center justify-center space-x-1 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                            <span>✗ Bounced</span>
                          </button>
                        </div>
                      )}

                    </div>
                  );
                })
              )}
            </div>

          </div>

        </div>
      )}

      {/* =====================================================================
          6.6 RECORD PAYMENT MODAL (POPUP CONTROL)
          ===================================================================== */}
      {showPaymentModal && paymentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-sans animate-fadeIn" id="payModal-overlay">
          <form 
            onSubmit={handleRecordPaymentSubmit}
            className={`bg-white w-full max-w-[480px] rounded-lg border-t-4 shadow-2xl overflow-hidden flex flex-col justify-between ${
              paymentTarget.type === 'receipt' ? 'border-t-emerald-600' : 'border-t-amber-500'
            }`}
          >
            
            {/* Header */}
            <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between">
              <div>
                <span className={`text-[8px] uppercase font-black px-2 py-0.5 rounded-sm text-white ${
                  paymentTarget.type === 'receipt' ? 'bg-emerald-600' : 'bg-amber-500'
                }`}>
                  {paymentTarget.type === 'receipt' ? 'Customer Receipt' : 'Vendor Remittance'}
                </span>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight mt-1 select-all">
                  {paymentTarget.type === 'receipt' ? 'Record Receipt Payment' : 'Record Supplier Payment'}
                </h3>
                <p className="text-[10px] text-gray-500 mt-0.5">Partner: {paymentTarget.party.name}</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-650 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Error alerts if any */}
            {modalError && (
              <div className="mx-5 my-3 p-3 bg-sky-50 border border-slate-100 text-red-750 text-xs rounded font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-sky-600" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Form Fields Body */}
            <div className="p-5 text-slate-700 text-xs space-y-4">
              
              {/* Amount input */}
              <div className="space-y-1">
                <label className="block text-slate-800 font-bold">
                  Payment Amount (Rs.) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold font-mono text-gray-400">Rs.</span>
                  <input
                    type="number"
                    required
                    value={payAmount}
                    onChange={e => {
                      setPayAmount(e.target.value);
                      setModalError('');
                    }}
                    placeholder="Enter amount exactly..."
                    className="w-full pl-9 pr-3 py-2 border rounded font-mono font-bold text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="bg-slate-50 border p-2 rounded text-[10.5px] text-slate-500 flex justify-between items-center font-mono">
                  <span>Ledger balance outstanding:</span>
                  <strong className="text-slate-850">
                    Rs. {(paymentTarget.type === 'receipt' ? paymentTarget.party.credit_balance : Math.abs(paymentTarget.party.credit_balance)).toLocaleString()}
                  </strong>
                </div>
              </div>

              {/* Settlement Date picker */}
              <div className="space-y-1">
                <label className="block text-slate-800 font-bold">Settlement Date</label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={e => setPayDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded font-mono text-xs bg-slate-50 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Method choice pills: Cash | Bank | Cheque */}
              <div className="space-y-1.5">
                <label className="block text-slate-800 font-bold">Payment Channel Method</label>
                <div className="grid grid-cols-3 gap-2" id="modal-payment-method-selector">
                  {(['cash', 'bank', 'cheque'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setPayMethod(m);
                        setModalError('');
                      }}
                      className={`py-2 text-[10.5px] uppercase font-black tracking-wide rounded border cursor-pointer select-none ${
                        payMethod === m 
                          ? (paymentTarget.type === 'receipt' ? 'bg-emerald-600 text-white border-transparent' : 'bg-amber-500 text-white border-transparent')
                          : 'bg-white text-gray-500 hover:bg-slate-50'
                      }`}
                    >
                      {m === 'bank' ? 'Bank Transfer' : m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional Cheque elements */}
              {payMethod === 'cheque' && (
                <div className="grid grid-cols-2 gap-3 bg-blue-50/20 border-l-2 p-3 rounded border-l-blue-550 animate-fadeIn" id="cheque-conditional-form">
                  <div className="space-y-1">
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase">Cheque Number *</label>
                    <input
                      type="text"
                      placeholder="e.g. CHQ-99120"
                      value={payChequeNum}
                      onChange={e => setPayChequeNum(e.target.value)}
                      className="w-full px-2 py-1.5 border rounded font-mono font-bold uppercase text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] text-zinc-500 font-bold uppercase">Issuing Bank Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. MCB Bank"
                      value={payChequeBank}
                      onChange={e => setPayChequeBank(e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Conditional Bank Reference */}
              {payMethod === 'bank' && (
                <div className="space-y-1 bg-indigo-50/20 border-l-2 p-3 rounded border-l-indigo-500 animate-fadeIn" id="bank-conditional-form">
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase">Transaction Reference Key *</label>
                  <input
                    type="text"
                    placeholder="e.g. TRX-8822901S"
                    value={payBankRef}
                    onChange={e => setPayBankRef(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded font-mono font-bold uppercase text-xs"
                  />
                </div>
              )}

              {/* Notes descriptor */}
              <div className="space-y-1">
                <label className="block text-slate-800 font-bold">Memo / Narrative (Optional)</label>
                <textarea
                  placeholder="Payment allocation description, party comments, etc."
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-1.5 border rounded text-xs focus:outline-none"
                />
              </div>

            </div>

            {/* Footer buttons with responsive themed states */}
            <div className="px-5 py-4 bg-slate-50 border-t flex justify-end gap-2">
              <button 
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 border bg-white hover:bg-slate-100 text-gray-500 rounded font-bold uppercase tracking-wide text-[10.5px] cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                className={`px-5 py-2 text-white font-black uppercase text-[10.5px] tracking-wider rounded shadow cursor-pointer ${
                  paymentTarget.type === 'receipt' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-550 hover:bg-amber-600'
                }`}
              >
                {paymentTarget.type === 'receipt' ? 'Record Receipt' : 'Record Payment'}
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
}
