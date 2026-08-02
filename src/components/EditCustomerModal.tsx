import React, { useState } from 'react';
import { Party } from '../types';
import { Users, X, AlertTriangle } from 'lucide-react';

interface EditCustomerModalProps {
  party: Party;
  userRole: 'Owner' | 'Staff';
  onClose: () => void;
  onSave: (updatedParty: Party) => void;
}

export default function EditCustomerModal({ party, userRole, onClose, onSave }: EditCustomerModalProps) {
  const [errorText, setErrorText] = useState<string | null>(null);

  // Form Fields initialized from existing party data
  const [custType, setCustType] = useState<'regular' | 'company' | 'shopkeeper' | 'supplier'>(
    party.type === 'supplier' ? 'supplier' : party.customer_type || (party.type === 'shopkeeper' ? 'shopkeeper' : 'regular')
  );
  const [name, setName] = useState(party.name);
  const [phone, setPhone] = useState(party.phone);
  const [phone2, setPhone2] = useState(party.phone2 || '');
  const [city, setCity] = useState(party.city || 'Faisalabad');
  const [ntn, setNtn] = useState(party.ntn || '');
  const [address, setAddress] = useState(party.address || '');
  const [creditLimit, setCreditLimit] = useState(party.credit_limit?.toString() || '0');
  const [paymentTerms, setPaymentTerms] = useState(party.payment_terms || 'Cash only');
  const [notes, setNotes] = useState(party.notes || '');
  const [creditBalance, setCreditBalance] = useState(party.credit_balance.toString());
  const [alsoSupplier, setAlsoSupplier] = useState(party.is_supplier_linked || false);
  const [alsoCustomer, setAlsoCustomer] = useState(party.is_customer_linked || false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);

    if (!name.trim()) {
      setErrorText("Full Name/Company Name is required.");
      return;
    }

    const parsedLimit = parseFloat(creditLimit);
    if (isNaN(parsedLimit) || parsedLimit < 0) {
      setErrorText("Credit limit must be a valid non-negative number.");
      return;
    }

    const parsedBalance = parseFloat(creditBalance);
    if (isNaN(parsedBalance) || parsedBalance < 0) {
      setErrorText("Credit balance must be a valid non-negative number.");
      return;
    }

    try {
      const updatedParty: Party = {
        ...party,
        name: name.trim(),
        phone: phone.trim() || 'N/A',
        phone2: phone2.trim() || undefined,
        city: city.trim() || 'Faisalabad',
        credit_balance: parsedBalance,
        credit_limit: parsedLimit,
        payment_terms: paymentTerms,
        address: address.trim() || undefined,
        ntn: custType === 'company' ? (ntn.trim() || undefined) : undefined,
        notes: notes.trim() || undefined,
        customer_type: custType === 'supplier' ? undefined : custType,
        type: custType === 'supplier' ? 'supplier' : custType === 'shopkeeper' ? 'shopkeeper' : 'customer',
        is_supplier_linked: custType === 'supplier' ? false : alsoSupplier,
        is_customer_linked: custType === 'supplier' ? alsoCustomer : false
      };

      onSave(updatedParty);
    } catch (err: any) {
      setErrorText("Save Error: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto" id="modal-edit-customer-backdrop">
      <div className="bg-white w-full max-w-[500px] border-t-4 border-t-indigo-600 flex flex-col max-h-[90vh] shadow-2xl rounded-lg overflow-hidden" id="modal-edit-customer-container">
        
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-slate-50 flex-shrink-0">
          <div>
            <span className="text-[10px] bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.5 rounded uppercase tracking-wider">
              Edit Account Ledger
            </span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#2A2727] flex items-center space-x-1 mt-1">
              <Users className="w-4 h-4 text-indigo-500" />
              <span>Edit Customer: {party.name}</span>
            </h3>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 font-bold"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-5 flex-1 overflow-y-auto space-y-4 text-xs font-sans">
          {errorText && (
            <div className="p-3 bg-sky-50 border border-sky-200 rounded flex items-start space-x-2 text-[#0ea5e9] text-xs">
              <AlertTriangle className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
              <span>{errorText}</span>
            </div>
          )}

          {/* Type Selector */}
          <div>
            <label className="block text-[#2A2727] font-semibold mb-2">Account Profile Type</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'regular', title: 'Regular Customer', desc: 'Personal account' },
                { key: 'company', title: 'Company Client', desc: 'Multi-machine corp' },
                { key: 'shopkeeper', title: 'Shopkeeper', desc: 'Wholesale client' },
                { key: 'supplier', title: 'Direct Supplier', desc: 'Supplies filters/goods' }
              ].map(cType => {
                const isSelected = custType === cType.key;
                return (
                  <div
                    key={cType.key}
                    onClick={() => setCustType(cType.key as any)}
                    className={`p-2.5 border rounded text-center cursor-pointer transition flex flex-col justify-between ${
                      isSelected 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold' 
                        : 'border-[#E2DFDF] hover:bg-slate-50'
                    }`}
                  >
                    <p className="font-bold select-none text-[11px]">{cType.title}</p>
                    <p className="text-[9px] text-gray-400 select-none pt-0.5 leading-normal">{cType.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form inputs */}
          <div>
            <label className="block text-gray-600 font-bold mb-1">
              {custType === 'company' ? 'Company Name *' : custType === 'supplier' ? 'Supplier Name *' : 'Full Name *'}
            </label>
            <input
              type="text"
              required
              className="w-full text-xs p-2 border border-[#E2DFDF] rounded focus:outline-none focus:border-indigo-600 font-bold text-gray-800"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-650 font-semibold mb-1">Primary Phone</label>
              <input
                type="text"
                className="w-full text-xs p-2 border border-[#E2DFDF] rounded font-mono"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-gray-650 font-semibold mb-1">Secondary Phone (Optional)</label>
              <input
                type="text"
                className="w-full text-xs p-2 border border-[#E2DFDF] rounded font-mono"
                value={phone2}
                onChange={e => setPhone2(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-650 font-semibold mb-1">City Location</label>
              <input
                type="text"
                required
                className="w-full text-xs p-2 border border-[#E2DFDF] rounded"
                value={city}
                onChange={e => setCity(e.target.value)}
              />
            </div>
            {custType === 'company' ? (
              <div>
                <label className="block text-[#0EA5E9] font-bold mb-1">Regulatory NTN / Company ID</label>
                <input
                  type="text"
                  placeholder="e.g. 1234567-8"
                  className="w-full text-xs p-2 border border-[#E2DFDF] rounded font-mono font-bold"
                  value={ntn}
                  onChange={e => setNtn(e.target.value)}
                />
              </div>
            ) : (
              <div className="opacity-50">
                <label className="block text-gray-400 font-semibold mb-1">NTN Tax Number</label>
                <input
                  type="text"
                  disabled
                  placeholder="Not required for standard users"
                  className="w-full text-xs p-2 border border-gray-100 rounded bg-gray-50 text-gray-400"
                />
              </div>
            )}
          </div>

          {/* Balance adjusting (Owner has absolute power, staff can read/write too as requested) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#0EA5E9] font-bold mb-1">Outstanding Debt Balance (Rs.)</label>
              <input
                type="number"
                required
                className="w-full text-xs p-2 border border-sky-200 rounded font-mono font-bold text-sky-700 bg-sky-50/20"
                value={creditBalance}
                onChange={e => setCreditBalance(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-gray-650 font-semibold mb-1">Credit Limit (Rs.)</label>
              <input
                type="number"
                required
                className="w-full text-xs p-2 border border-[#E2DFDF] rounded font-mono"
                value={creditLimit}
                onChange={e => setCreditLimit(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-650 font-semibold mb-1">Billing Street Address</label>
            <input
              type="text"
              className="w-full text-xs p-2 border border-[#E2DFDF] rounded"
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-gray-650 font-semibold mb-1">Payment terms & credit duration</label>
            <select
              className="w-full text-xs p-2 border border-[#E2DFDF] bg-white rounded font-medium"
              value={paymentTerms}
              onChange={e => setPaymentTerms(e.target.value)}
            >
              <option value="Cash only">Cash only (No short credit terms)</option>
              <option value="Net 15 days">Net 15 days terms</option>
              <option value="Net 30 days">Net 30 days terms</option>
              <option value="Post-dated Cheque (PDC)">Post-dated Cheque (PDC)</option>
              <option value="Special contract schedule">Special contract schedule</option>
            </select>
          </div>

          {/* Cross-role settings toggle */}
          {custType !== 'supplier' ? (
            <div className="flex items-center space-x-2 p-2 border border-dashed border-sky-200 bg-sky-50/50 rounded">
              <input
                type="checkbox"
                id="edit-link-supplier-check"
                checked={alsoSupplier}
                onChange={e => setAlsoSupplier(e.target.checked)}
                className="rounded border-[#E2DFDF]"
              />
              <label htmlFor="edit-link-supplier-check" className="font-bold cursor-pointer text-[#2A2727] select-none text-[10px]">
                Also Supplier (Supplies filter elements/oil goods to King Filter House)
              </label>
            </div>
          ) : (
            <div className="flex items-center space-x-2 p-2 border border-dashed border-purple-200 bg-purple-50/50 rounded">
              <input
                type="checkbox"
                id="edit-link-customer-check"
                checked={alsoCustomer}
                onChange={e => setAlsoCustomer(e.target.checked)}
                className="rounded border-[#E2DFDF]"
              />
              <label htmlFor="edit-link-customer-check" className="font-bold cursor-pointer text-[#2A2727] select-none text-[10px]">
                Also Customer (Buys filters/oil items from King Filter House as a client)
              </label>
            </div>
          )}

          <div>
            <label className="block text-gray-650 font-semibold mb-1">Internal Remarks / Office notes</label>
            <textarea
              className="w-full text-xs p-2 border border-[#E2DFDF] rounded"
              rows={2}
              placeholder="Store notes, default discounts, or machine service profiles..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Footer action buttons */}
          <div className="pt-3 border-t flex justify-end space-x-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 border border-gray-300 rounded text-slate-500 font-semibold hover:bg-slate-50 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 bg-indigo-600 text-white rounded font-bold uppercase hover:bg-indigo-700 text-xs shadow-sm"
            >
              Save Customer Details
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
