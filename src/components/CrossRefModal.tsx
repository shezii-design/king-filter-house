import React, { useState, useEffect } from 'react';
import { db, normalizeCode } from '../data';
import { Product, CrossReference } from '../types';
import { Search, Check, AlertTriangle, Link2, HelpCircle } from 'lucide-react';

interface CrossRefModalProps {
  sourceProduct: Product;
  onClose: () => void;
  onSaved: () => void;
}

export default function CrossRefModal({ sourceProduct, onClose, onSaved }: CrossRefModalProps) {
  const [targetType, setTargetType] = useState<'internal' | 'external'>('internal');
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [matchType, setMatchType] = useState<'exact_match' | 'compatible'>('exact_match');

  // External non-sell part states
  const [externalPartNumber, setExternalPartNumber] = useState('');
  const [externalBrand, setExternalBrand] = useState('');

  // Custom text labels along names
  const [customTextSource, setCustomTextSource] = useState('');
  const [customTextTarget, setCustomTextTarget] = useState('');

  useEffect(() => {
    // Exclude source product itself and soft deleted products
    setProducts(db.getProducts().filter(p => p.id !== sourceProduct.id));
  }, [sourceProduct]);

  // Handle Search Filtering
  const getFilteredProducts = () => {
    if (!query.trim()) return [];
    const normQuery = normalizeCode(query);
    return products.filter(p => {
      const brandMatch = p.brand.toLowerCase().includes(query.toLowerCase());
      const codeMatch = (p.part_number_norm || normalizeCode(p.part_number || '')).includes(normQuery);
      return brandMatch || codeMatch;
    });
  };

  const filtered = getFilteredProducts();

  const handleSave = () => {
    const crossRefs = db.getCrossRefs();

    if (targetType === 'internal') {
      if (!selectedProduct) return;
      
      // Create direct relation
      const ref1: CrossReference = {
        id: "cref-" + Date.now() + "-1",
        product_id_1: sourceProduct.id,
        product_id_2: selectedProduct.id,
        match_type: matchType,
        source: "manual",
        discovered_invoice_id: null,
        is_active: true,
        created_at: new Date().toISOString(),
        custom_text: customTextSource.trim() || undefined
      };

      // Create reverse relation
      const ref2: CrossReference = {
        id: "cref-" + Date.now() + "-2",
        product_id_1: selectedProduct.id,
        product_id_2: sourceProduct.id,
        match_type: matchType,
        source: "manual",
        discovered_invoice_id: null,
        is_active: true,
        created_at: new Date().toISOString(),
        custom_text: customTextTarget.trim() || undefined
      };

      const updated = [...crossRefs, ref1, ref2];
      db.saveCrossRefs(updated);

      db.logPendingSync(`Linked physical substitute: ${sourceProduct.part_number} (${sourceProduct.brand}) is now ${matchType === 'exact_match' ? 'exactly matching' : 'compatibly matching'} with ${selectedProduct.part_number} (${selectedProduct.brand})`);
    } else {
      if (!externalPartNumber.trim()) return;

      const ref1: CrossReference = {
        id: "cref-" + Date.now() + "-ext",
        product_id_1: sourceProduct.id,
        product_id_2: null,
        external_part_number: externalPartNumber.trim().toUpperCase(),
        external_brand: externalBrand.trim() || 'Other Brand',
        match_type: matchType,
        source: "manual",
        discovered_invoice_id: null,
        is_active: true,
        created_at: new Date().toISOString(),
        custom_text: customTextSource.trim() || undefined
      };

      const updated = [...crossRefs, ref1];
      db.saveCrossRefs(updated);

      db.logPendingSync(`Linked external non-sell cross ref: ${sourceProduct.part_number} (${sourceProduct.brand}) is now ${matchType === 'exact_match' ? 'exactly matching' : 'compatibly matching'} with non-stocked ${externalBrand || 'Other'} ${externalPartNumber}`);
    }

    onSaved();
  };

  const canSave = targetType === 'internal' ? !!selectedProduct : !!externalPartNumber.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" id="cross-ref-backdrop">
      <div className="bg-white w-full max-w-[500px] mx-4 border-t-4 border-t-indigo-600 flex flex-col max-h-[85vh] shadow-2xl rounded-sm" id="cross-ref-modal">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E2DFDF] flex items-center justify-between">
          <div>
            <h3 className="text-sm uppercase tracking-wider font-bold text-[#2A2727] flex items-center space-x-1">
              <Link2 className="w-4 h-4 text-indigo-600" />
              <span>Establish Product Cross-Reference Link</span>
            </h3>
            <p className="text-[11px] text-gray-500">Creating relation of codes with: <strong>{sourceProduct.brand} {sourceProduct.part_number}</strong></p>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {/* Target Type Selector Buttons */}
        <div className="px-5 pt-3 bg-gray-50 flex border-b border-[#E2DFDF]">
          <button
            type="button"
            onClick={() => setTargetType('internal')}
            className={`flex-1 py-2 text-xs text-center font-bold border-b-2 transition-all ${
              targetType === 'internal' 
                ? 'border-indigo-600 text-indigo-600 bg-white shadow-xs' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
            }`}
          >
            🏢 Link Store Product
          </button>
          <button
            type="button"
            onClick={() => setTargetType('external')}
            className={`flex-1 py-2 text-xs text-center font-bold border-b-2 transition-all ${
              targetType === 'external' 
                ? 'border-indigo-600 text-indigo-600 bg-white shadow-xs' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
            }`}
          >
            📑 Add Non-Sell Code (OEM / Competitor)
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto text-xs space-y-4">
          
          {targetType === 'internal' ? (
            // STORE PRODUCT LINK OPTIONS
            <div>
              {!selectedProduct ? (
                <div className="space-y-3" id="crossref-search-stage">
                  <label className="block text-gray-600 font-bold mb-1">Search Store Database for the Match Candidate</label>
                  <div className="relative">
                    <input 
                      type="text"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="Type code or brand (e.g., C6204, Sakura, Baldwin)..."
                      className="w-full text-xs p-2.5 pl-8 border border-[#E2DFDF] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      autoFocus
                    />
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-3.5" />
                  </div>

                  {query.trim().length > 0 && (
                    <div className="border border-[#E2DFDF] max-h-[200px] overflow-y-auto divide-y divide-[#F5F4F4] rounded bg-white shadow-inner" id="crossref-suggestions">
                      {filtered.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 font-mono">
                          No matching products registered in database.
                        </div>
                      ) : (
                        filtered.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedProduct(p)}
                            className="w-full text-left p-2.5 hover:bg-gray-50 flex justify-between items-center transition-none"
                          >
                            <div>
                              <p className="font-bold font-mono text-[#2A2727]">{p.part_number}</p>
                              <p className="text-[10px] text-gray-400">{p.brand} • {p.category} • Shelf: {p.shelf_location}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[#0EA5E9] font-semibold">Rs. {p.sale_price}</p>
                              <p className="text-[10px] text-gray-400 font-mono font-bold">Stock: {p.stock_qty} pcs</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4" id="crossref-relation-stage">
                  <div className="bg-emerald-50 p-3 border border-emerald-200 flex items-center justify-between rounded">
                    <div>
                      <p className="text-emerald-700 font-bold text-[9px] uppercase tracking-wider">Store Match Candidate Selected</p>
                      <p className="font-bold font-mono text-xs text-[#2A2727]">{selectedProduct.brand} {selectedProduct.part_number}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(null)}
                      className="text-xs text-[#0EA5E9] underline hover:text-sky-700 font-bold"
                    >
                      Change item
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // EXTERNAL NON-SELL PRODUCT PART OPTIONS
            <div className="space-y-3" id="external-non-sell-stage">
              <div className="bg-indigo-50/50 p-3 rounded border border-indigo-100 flex items-start space-x-2 text-[11px] text-indigo-900">
                <HelpCircle className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                <p>
                  Use this to register alternate codes/part numbers that you do <strong>not</strong> sell or stock, but are cross-references. When staff search for this external code at the counter, your product will show as a substitute.
                </p>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">External Brand / Maker we do NOT sell</label>
                <input
                  type="text"
                  value={externalBrand}
                  onChange={e => setExternalBrand(e.target.value)}
                  placeholder="e.g. Caterpillar, Fleetguard, Perkins, Cummins..."
                  className="w-full text-xs p-2.5 border border-[#E2DFDF] focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">External Part Number / OEM Code *</label>
                <input
                  type="text"
                  value={externalPartNumber}
                  onChange={e => setExternalPartNumber(e.target.value)}
                  placeholder="e.g. 1R-0716, LF670, 714/0000..."
                  className="w-full text-xs p-2.5 border border-[#E2DFDF] focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded font-mono uppercase"
                  required
                />
              </div>
            </div>
          )}

          {/* SHARED RELATIONSHIP TYPE SELECTOR (ONLY SHOW IF INTERNALS SELECTED, OR ALL TIMES FOR EXTERNAL) */}
          {(targetType === 'external' || selectedProduct) && (
            <div className="space-y-3 pt-2">
              <p className="font-bold text-[#2A2727] border-b border-[#F5F4F4] pb-1">Define Relationship Grade</p>

              <div className="grid grid-cols-2 gap-3" id="selection-cards">
                {/* Option 1: Exact Match */}
                <button
                  type="button"
                  onClick={() => setMatchType('exact_match')}
                  className={`p-3 text-left border rounded transition-all flex flex-col justify-between h-[115px] ${
                    matchType === 'exact_match' 
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-xs' 
                      : 'border-[#E2DFDF] hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                      Exact Match
                    </span>
                    {matchType === 'exact_match' && <Check className="w-4 h-4 text-emerald-700" />}
                  </div>
                  <p className="text-[9.5px] text-gray-500 mt-2 leading-relaxed">
                    Identical specifications. Drop-in, 100% duplicate filter element size or threads.
                  </p>
                </button>

                {/* Option 2: Compatible */}
                <button
                  type="button"
                  onClick={() => setMatchType('compatible')}
                  className={`p-3 text-left border rounded transition-all flex flex-col justify-between h-[115px] ${
                    matchType === 'compatible' 
                      ? 'border-amber-500 bg-amber-50/50 shadow-xs' 
                      : 'border-[#E2DFDF] hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                      Compatible
                    </span>
                    {matchType === 'compatible' && <Check className="w-4 h-4 text-amber-700" />}
                  </div>
                  <p className="text-[9.5px] text-gray-500 mt-2 leading-relaxed">
                    Similar mounting but minor specs difference (e.g. slight height variance, runs safely).
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* CUSTOM RELATIONSHIP LABELS / TEXTS */}
          {(targetType === 'external' || selectedProduct) && (
            <div className="space-y-3 pt-2 bg-slate-50 p-3.5 border border-slate-200 rounded">
              <p className="font-bold text-[#2A2727] border-b border-slate-200 pb-1 flex items-center justify-between">
                <span>🏷️ Add Custom Label / Note (Optional)</span>
                <span className="text-[10px] text-[#0EA5E9] font-bold">Shows on Product Cards</span>
              </p>
              
              {targetType === 'internal' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                      Label for {selectedProduct?.part_number} (when viewing {sourceProduct.part_number})
                    </label>
                    <input
                      type="text"
                      value={customTextSource}
                      onChange={e => setCustomTextSource(e.target.value)}
                      placeholder="e.g., Outer of A-1840-S, Outer Filter, etc."
                      className="w-full text-xs p-2 bg-white border border-[#E2DFDF] focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded font-medium"
                    />
                    <p className="text-[9px] text-slate-450 mt-0.5">Displays next to {selectedProduct?.part_number} on {sourceProduct.part_number}'s card.</p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                      Label for {sourceProduct.part_number} (when viewing {selectedProduct?.part_number})
                    </label>
                    <input
                      type="text"
                      value={customTextTarget}
                      onChange={e => setCustomTextTarget(e.target.value)}
                      placeholder="e.g., Set of A-1828, Inner of A-1828, etc."
                      className="w-full text-xs p-2 bg-white border border-[#E2DFDF] focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded font-medium"
                    />
                    <p className="text-[9px] text-slate-450 mt-0.5">Displays next to {sourceProduct.part_number} on {selectedProduct?.part_number}'s card.</p>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                    Label for {externalPartNumber || 'External Code'} (when viewing {sourceProduct.part_number})
                  </label>
                  <input
                    type="text"
                    value={customTextSource}
                    onChange={e => setCustomTextSource(e.target.value)}
                    placeholder="e.g., OEM Outer, Companion element, etc."
                    className="w-full text-xs p-2 bg-white border border-[#E2DFDF] focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded font-medium"
                  />
                  <p className="text-[9px] text-slate-450 mt-0.5">Displays next to {externalPartNumber || 'External Code'} on {sourceProduct.part_number}'s card.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 border-t border-[#E2DFDF] flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-[#E2DFDF] text-gray-650 hover:bg-gray-100 font-bold cursor-pointer rounded"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={`px-4 py-1.5 font-bold rounded ${
              canSave 
                ? 'bg-[#0EA5E9] text-white hover:bg-sky-600' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Establish Link
          </button>
        </div>
      </div>
    </div>
  );
}
