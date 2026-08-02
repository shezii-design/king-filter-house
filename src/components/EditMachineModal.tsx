import React, { useState } from 'react';
import { Machine, FilterRequirement, Product, Site } from '../types';
import { Settings, X, Plus, Trash2, Search, AlertTriangle, Check } from 'lucide-react';

interface EditMachineModalProps {
  machine: Machine;
  sites: Site[];
  products: Product[];
  onClose: () => void;
  onSave: (updatedMachine: Machine) => void;
}

export default function EditMachineModal({ machine, sites, products, onClose, onSave }: EditMachineModalProps) {
  const [errorText, setErrorText] = useState<string | null>(null);

  // Machine basic fields
  const [name, setName] = useState(machine.name);
  const [typeModel, setTypeModel] = useState(machine.type_model);
  const [operatorName, setOperatorName] = useState(machine.operator_name || '');
  const [purchaserName, setPurchaserName] = useState(machine.purchaser_name || '');
  const [siteId, setSiteId] = useState<string>(machine.site_id || 'none');

  // Filter Requirements in local state
  const [filters, setFilters] = useState<FilterRequirement[]>(
    machine.filters ? JSON.parse(JSON.stringify(machine.filters)) : []
  );

  // State for search dropdowns per filter row if they want to swap product
  const [activeFiltSearchId, setActiveFiltSearchId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Handle saving the entire machine details
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);

    if (!name.trim()) {
      setErrorText("Equipment Name is required.");
      return;
    }

    // Validate filters
    for (let i = 0; i < filters.length; i++) {
      const f = filters[i];
      if (!f.part_number) {
        setErrorText(`Filter at position "${f.position || (i + 1)}" must have a valid selected product/part number.`);
        return;
      }
      if (f.qty <= 0) {
        setErrorText(`Quantity for filter "${f.part_number}" must be 1 or more.`);
        return;
      }
      if (f.agreed_price < 0) {
        setErrorText(`Agreed price for filter "${f.part_number}" cannot be negative.`);
        return;
      }
    }

    const updatedMachine: Machine = {
      ...machine,
      name: name.trim(),
      type_model: typeModel.trim(),
      operator_name: operatorName.trim() || undefined,
      purchaser_name: purchaserName.trim() || undefined,
      site_id: siteId === 'none' ? null : siteId,
      filters: filters
    };

    onSave(updatedMachine);
  };

  // Add an empty filter requirement line
  const handleAddNewFilterRow = () => {
    const newF: FilterRequirement = {
      id: "fr-" + Date.now() + Math.random().toString(36).substr(2, 5),
      product_id: '',
      part_number: '',
      brand: '',
      qty: 1,
      position: 'Primary Filter',
      agreed_price: 0,
      change_interval: 'Every 250 hours'
    };
    setFilters([...filters, newF]);
  };

  // Update a single field in a filter row
  const handleUpdateFilterRow = (id: string, updates: Partial<FilterRequirement>) => {
    setFilters(filters.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  // Delete a filter row
  const handleDeleteFilterRow = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  // Select a product for a specific filter row
  const handleSelectProduct = (filterId: string, prod: Product) => {
    handleUpdateFilterRow(filterId, {
      product_id: prod.id,
      part_number: prod.part_number,
      brand: prod.brand,
      agreed_price: prod.sale_price // default to product price
    });
    setActiveFiltSearchId(null);
    setSearchQuery('');
  };

  // Filtered product options based on search query
  const filteredProducts = products.filter(p => {
    const q = searchQuery.toLowerCase();
    return (
      p.part_number.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }).slice(0, 5); // limit output to 5 items for speed and layout space

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto" id="modal-edit-machine-backdrop">
      <div className="bg-white w-full max-w-3xl border-t-4 border-t-slate-800 rounded-lg shadow-xl overflow-hidden flex flex-col my-8 max-h-[90vh]" id="modal-edit-machine-container">
        
        {/* Header */}
        <div className="bg-slate-50 border-b border-[#E2DFDF] p-4 flex justify-between items-center flex-shrink-0">
          <div>
            <span className="text-[10px] bg-slate-200 text-slate-800 font-extrabold px-2 py-0.5 rounded uppercase tracking-wider">
              Asset Configuration
            </span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#2A2727] flex items-center space-x-1.5 mt-1">
              <Settings className="w-4 h-4 text-slate-500" />
              <span>Edit Asset Machinery: {machine.name}</span>
            </h3>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 font-bold"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
          
          {errorText && (
            <div className="p-3 bg-sky-50 border border-sky-200 rounded flex items-start space-x-2 text-[#0ea5e9] text-xs">
              <AlertTriangle className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
              <span>{errorText}</span>
            </div>
          )}

          {/* Section 1: Equipment Identifiers */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-indigo-700 tracking-wider border-b pb-1">
              1. Machinery Identifiers & Location
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-500 font-bold mb-1 col-span-1">Equipment Name *</label>
                <input 
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded font-bold"
                  placeholder="e.g. Caterpillar Excavator 320D"
                />
              </div>

              <div>
                <label className="block text-gray-500 font-semibold mb-1 col-span-1">Equipment Model / Power Rating</label>
                <input 
                  type="text"
                  value={typeModel}
                  onChange={e => setTypeModel(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded"
                  placeholder="e.g. Cat C6.4 ACERT 148HP"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-gray-405 font-medium mb-1">Operator Chip Name</label>
                <input 
                  type="text"
                  value={operatorName}
                  onChange={e => setOperatorName(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded"
                  placeholder="e.g. Abdul Majeed"
                />
              </div>

              <div>
                <label className="block text-gray-405 font-medium mb-1">Purchaser/Buyer Reference</label>
                <input 
                  type="text"
                  value={purchaserName}
                  onChange={e => setPurchaserName(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded"
                  placeholder="e.g. Haji Bashir"
                />
              </div>

              <div>
                <label className="block text-gray-550 font-bold mb-1">Operational Site Positioning</label>
                <select
                  value={siteId}
                  onChange={e => setSiteId(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 bg-white rounded"
                >
                  <option value="none">No site mapping (Loose machinery)</option>
                  {(sites || []).map(s => (
                    <option key={s.id} value={s.id}>📍 {s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Filter kits mapping configuration */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-1">
              <h4 className="text-[10px] font-black uppercase text-indigo-700 tracking-wider">
                2. Filter Kits Mapping & Price Agreements ({filters.length})
              </h4>
              <button
                type="button"
                onClick={handleAddNewFilterRow}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded flex items-center space-x-1 text-[10px] uppercase shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add filter requirement</span>
              </button>
            </div>

            {filters.length === 0 ? (
              <div className="p-6 bg-slate-50 border rounded text-center text-gray-450 italic">
                No filters currently assigned. Click the button above to add filter requirements.
              </div>
            ) : (
              <div className="space-y-3">
                {filters.map((f, index) => {
                  const matchedProduct = products.find(p => p.id === f.product_id);
                  const isSearching = activeFiltSearchId === f.id;

                  return (
                    <div key={f.id} className="p-3 border border-slate-200 bg-slate-50 rounded-lg space-y-3 relative">
                      
                      {/* Top Bar inside requirement row */}
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] bg-slate-200 text-slate-700 font-extrabold px-1.5 py-0.5 rounded-sm">
                          Filter #{index + 1}
                        </span>
                        
                        <button
                          type="button"
                          onClick={() => handleDeleteFilterRow(f.id)}
                          className="text-red-500 hover:text-sky-700 font-bold flex items-center"
                          title="Remove filter requirement"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-0.5" />
                          <span className="text-[10px] uppercase font-bold text-red-500 hover:underline">Remove</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end">
                        
                        {/* Column 1 & 2: Search Input / Selector */}
                        <div className="col-span-1 md:col-span-3 relative">
                          <label className="block text-gray-500 font-bold text-[9px] uppercase mb-1">
                            Associated Filter Product Catalog Item *
                          </label>
                          
                          {f.part_number ? (
                            <div className="flex items-center justify-between border border-[#E2DFDF] bg-white p-2 rounded">
                              <div>
                                <span className="font-mono font-bold text-gray-800 text-[12px] block">
                                  {f.part_number}
                                </span>
                                <span className="text-[9px] text-gray-400">
                                  Brand: {f.brand || matchedProduct?.brand || 'Generic'}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveFiltSearchId(f.id);
                                  setSearchQuery('');
                                }}
                                className="text-[9.5px] font-black text-indigo-650 hover:underline uppercase"
                              >
                                Swap Item
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveFiltSearchId(f.id);
                                setSearchQuery('');
                              }}
                              className="w-full text-left p-2 border border-sky-200 bg-sky-50/20 text-[#0ea5e9] font-bold rounded flex items-center justify-between"
                            >
                              <span>⚠️ Choose filter product code...</span>
                              <Search className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Float Search Dropdown */}
                          {isSearching && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded shadow-lg z-10 p-2 space-y-2">
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="Search part # or brand name..."
                                  value={searchQuery}
                                  onChange={e => setSearchQuery(e.target.value)}
                                  className="w-full p-1.5 pl-6 border border-[#E2DFDF] text-[11px] rounded bg-[#F9F9F9] focus:outline-none"
                                  autoFocus
                                />
                                <Search className="w-3 h-3 text-gray-400 absolute left-2 top-2.5" />
                              </div>

                              <div className="max-h-36 overflow-y-auto divide-y">
                                {filteredProducts.map(p => (
                                  <div
                                    key={p.id}
                                    onClick={() => handleSelectProduct(f.id, p)}
                                    className="p-1.5 text-[11px] hover:bg-slate-100 cursor-pointer flex justify-between font-mono"
                                  >
                                    <div>
                                      <strong className="text-gray-900">{p.part_number}</strong>
                                      <span className="text-gray-400 text-[10px] ml-1">({p.brand})</span>
                                    </div>
                                    <span className="text-slate-500 text-[10px]">Rs. {p.sale_price.toLocaleString()}</span>
                                  </div>
                                ))}
                                {filteredProducts.length === 0 && (
                                  <p className="p-2 text-center text-gray-400 italic text-[10px]">No matches found</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Column 3: Position / Segment */}
                        <div className="col-span-1 md:col-span-1.5">
                          <label className="block text-gray-500 font-bold text-[9px] uppercase mb-1">
                            Position / Area
                          </label>
                          <input
                            type="text"
                            value={f.position}
                            onChange={e => handleUpdateFilterRow(f.id, { position: e.target.value })}
                            className="w-full text-xs p-1.5 border border-gray-300 rounded"
                            placeholder="e.g. Engine, Return Line"
                          />
                        </div>

                        {/* Column 4: Qty */}
                        <div className="col-span-1">
                          <label className="block text-gray-500 font-bold text-[9px] uppercase mb-1">
                            Qty Unit
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={f.qty}
                            onChange={e => handleUpdateFilterRow(f.id, { qty: parseInt(e.target.value) || 1 })}
                            className="w-full text-xs p-1.5 border border-gray-300 rounded font-mono font-bold"
                          />
                        </div>

                        {/* Column 5: Agreed Price */}
                        <div className="col-span-1 md:col-span-1.5">
                          <label className="block text-indigo-700 font-black text-[9px] uppercase mb-1">
                            Agreed Price (Rs.)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={f.agreed_price}
                            onChange={e => handleUpdateFilterRow(f.id, { agreed_price: parseFloat(e.target.value) || 0 })}
                            className="w-full text-xs p-1.5 border border-[#0EA5E9] text-[#0EA5E9] font-mono font-black rounded"
                          />
                        </div>

                        {/* Column 6: Change Interval */}
                        <div className="col-span-1 md:col-span-7 mt-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-gray-400 font-medium text-[9px] uppercase mb-0.5">
                              Change interval/Lifespan Limit
                            </label>
                            <select
                              value={f.change_interval}
                              onChange={e => handleUpdateFilterRow(f.id, { change_interval: e.target.value })}
                              className="w-full text-xs p-1 border border-gray-300 rounded bg-white text-gray-700"
                            >
                              <option value="Every 250 hours">Every 250 operational hours</option>
                              <option value="Every 500 hours">Every 500 operational hours</option>
                              <option value="Every 1000 hours">Every 1,000 operational hours</option>
                              <option value="Monthly cycle">Monthly cycle interval</option>
                              <option value="Seasonal / 6 months">Seasonal / 6 months change</option>
                              <option value="Semi-annual change">Semi-annual change</option>
                              <option value="On status check / diagnostic">On status check / diagnostic</option>
                            </select>
                          </div>

                          <div className="bg-white/80 border p-1 rounded-sm text-[10px] flex items-center justify-between text-gray-500 px-2 font-sans select-none">
                            <span>Catalog price limit:</span> 
                            <strong className="text-gray-800 font-mono">
                              Rs. {matchedProduct ? matchedProduct.sale_price.toLocaleString() : 'N/A'}
                            </strong>
                          </div>
                        </div>

                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer action */}
          <div className="pt-4 border-t border-[#E2DFDF] flex justify-end space-x-2 flex-shrink-0">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 border border-gray-300 rounded text-xs font-semibold text-gray-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-6 py-2 bg-slate-800 hover:bg-[#111C30] text-white text-xs font-bold uppercase rounded shadow-sm"
            >
              Save Machinery Updates
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
