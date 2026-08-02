import React, { useState } from 'react';
import { Product } from '../types';
import { 
  X, 
  HelpCircle, 
  AlertOctagon, 
  Settings, 
  CornerDownRight, 
  Unlock 
} from 'lucide-react';

interface BulkEditModalProps {
  selectedProducts: Product[];
  userRole: string;
  onClose: () => void;
  onSave: (updates: Partial<Product>) => void;
}

export default function BulkEditModal({ selectedProducts, userRole, onClose, onSave }: BulkEditModalProps) {
  // Toggle switches to specify which fields should be modified
  const [updateCategory, setUpdateCategory] = useState(false);
  const [updateBrand, setUpdateBrand] = useState(false);
  const [updateShelfLocation, setUpdateShelfLocation] = useState(false);
  const [updateThreadSize, setUpdateThreadSize] = useState(false);
  const [updateMinStock, setUpdateMinStock] = useState(false);
  const [updateSalePrice, setUpdateSalePrice] = useState(false);
  const [updateCostPrice, setUpdateCostPrice] = useState(false);

  // Field values
  const [category, setCategory] = useState('Oil Filter');
  const [brand, setBrand] = useState('');
  const [shelfLocation, setShelfLocation] = useState('');
  const [threadSize, setThreadSize] = useState('');
  const [minStock, setMinStock] = useState('5');
  const [salePrice, setSalePrice] = useState('');
  const [costPrice, setCostPrice] = useState('');

  const isOwner = userRole === 'Owner';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const updates: Partial<Product> = {};

    if (updateCategory) {
      updates.category = category;
    }
    if (updateBrand) {
      if (!brand.trim()) {
        alert("Please enter a brand name or uncheck 'Update Brand'");
        return;
      }
      updates.brand = brand.trim();
    }
    if (updateShelfLocation) {
      updates.shelf_location = shelfLocation.trim();
    }
    if (updateThreadSize) {
      updates.thread_size = threadSize.trim();
    }
    if (updateMinStock) {
      const parsedMin = parseInt(minStock, 10);
      if (isNaN(parsedMin) || parsedMin < 0) {
        alert("Invalid minimum stock limit");
        return;
      }
      updates.min_stock_alert = parsedMin;
    }
    if (updateSalePrice) {
      const parsedSale = parseFloat(salePrice);
      if (isNaN(parsedSale) || parsedSale < 0) {
        alert("Invalid retail sale price value");
        return;
      }
      updates.sale_price = parsedSale;
    }
    if (updateCostPrice && isOwner) {
      const parsedCost = parseFloat(costPrice);
      if (isNaN(parsedCost) || parsedCost < 0) {
        alert("Invalid cost buying price value");
        return;
      }
      updates.cost_price = parsedCost;
    }

    if (Object.keys(updates).length === 0) {
      alert("Please check at least one field checkbox to bulk update!");
      return;
    }

    if (confirm(`Are you absolutely sure you want to bulk update ${selectedProducts.length} selected products? This action will merge coordinates instantly.`)) {
      onSave(updates);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-sans" id="bulk-amendments-dialog">
      <div className="bg-white w-full max-w-[550px] border-t-4 border-t-[#0EA5E9] shadow-2xl rounded-sm overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Title Header */}
        <div className="bg-[#111C30] text-white p-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-black uppercase tracking-wider flex items-center space-x-1.5">
              <Settings className="w-4 h-4 text-emerald-500" />
              <span>Bulk Operation: Edit Fields</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">Inject updates across {selectedProducts.length} filtered items in a single click.</p>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Outer Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          
          <div className="p-3 bg-slate-50 border rounded flex items-start space-x-2">
            <AlertOctagon className="w-4 h-4 text-amber-500 mr-1 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-[11px] font-black text-slate-850 uppercase block">Mass Attribute Overwrite</span>
              <p className="text-[10px] text-slate-500 leading-normal">
                Only parameters containing checked checkmarks on the left will be pushed. Remaining attributes for the target {selectedProducts.length} products will remain fully intact.
              </p>
            </div>
          </div>

          <div className="space-y-3.5">
            
            {/* Category selection row */}
            <div className="grid grid-cols-12 gap-2 items-center border-b border-gray-100 pb-2">
              <div className="col-span-1 text-center">
                <input 
                  type="checkbox" 
                  checked={updateCategory}
                  onChange={e => setUpdateCategory(e.target.checked)}
                  className="w-4 h-4 text-sky-600 focus:ring-sky-400 border-slate-300 rounded cursor-pointer"
                />
              </div>
              <div className="col-span-4">
                <label className="text-[11px] font-extrabold uppercase text-slate-700 tracking-wide">Category</label>
              </div>
              <div className="col-span-7">
                <select
                  disabled={!updateCategory}
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-250 bg-white rounded focus:outline-none focus:border-[#0EA5E9] disabled:bg-slate-100 disabled:text-gray-400"
                >
                  {[
                    'Oil Filter', 'Fuel Filter', 'Hydraulic Filter', 'Air Filter',
                    'Engine Oil', 'Hydraulic Oil', 'Gear Oil', 'Coolant', 'Grease',
                    'Tool/Opener', 'Accessory', 'Other'
                  ].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Brand Input row */}
            <div className="grid grid-cols-12 gap-2 items-center border-b border-gray-100 pb-2">
              <div className="col-span-1 text-center">
                <input 
                  type="checkbox" 
                  checked={updateBrand}
                  onChange={e => setUpdateBrand(e.target.checked)}
                  className="w-4 h-4 text-sky-600 focus:ring-sky-400 border-slate-300 rounded cursor-pointer"
                />
              </div>
              <div className="col-span-4">
                <label className="text-[11px] font-extrabold uppercase text-slate-700 tracking-wide">Brand Name</label>
              </div>
              <div className="col-span-7">
                <input 
                  type="text"
                  disabled={!updateBrand}
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                  placeholder="e.g. Sakura, Guard, Baldon"
                  className="w-full text-xs p-2 border border-slate-250 bg-white rounded font-mono focus:outline-none focus:border-[#0EA5E9] disabled:bg-slate-100 disabled:text-gray-400"
                />
              </div>
            </div>

            {/* Shelf location row */}
            <div className="grid grid-cols-12 gap-2 items-center border-b border-gray-100 pb-2">
              <div className="col-span-1 text-center">
                <input 
                  type="checkbox" 
                  checked={updateShelfLocation}
                  onChange={e => setUpdateShelfLocation(e.target.checked)}
                  className="w-4 h-4 text-red-655 focus:ring-sky-400 border-slate-300 rounded cursor-pointer"
                />
              </div>
              <div className="col-span-4">
                <label className="text-[11px] font-extrabold uppercase text-slate-700 tracking-wide">Shelf Rack Room</label>
              </div>
              <div className="col-span-7">
                <input 
                  type="text"
                  disabled={!updateShelfLocation}
                  value={shelfLocation}
                  onChange={e => setShelfLocation(e.target.value)}
                  placeholder="e.g. Row 4-A, Shell-C"
                  className="w-full text-xs p-2 border border-slate-250 bg-white rounded font-mono focus:outline-none focus:border-[#0EA5E9] disabled:bg-slate-100 disabled:text-gray-400"
                />
              </div>
            </div>

            {/* Thread Size row */}
            <div className="grid grid-cols-12 gap-2 items-center border-b border-gray-100 pb-2">
              <div className="col-span-1 text-center">
                <input 
                  type="checkbox" 
                  checked={updateThreadSize}
                  onChange={e => setUpdateThreadSize(e.target.checked)}
                  className="w-4 h-4 text-red-655 focus:ring-sky-400 border-slate-300 rounded cursor-pointer"
                />
              </div>
              <div className="col-span-4">
                <label className="text-[11px] font-extrabold uppercase text-slate-700 tracking-wide">Thread Spec</label>
              </div>
              <div className="col-span-7">
                <input 
                  type="text"
                  disabled={!updateThreadSize}
                  value={threadSize}
                  onChange={e => setThreadSize(e.target.value)}
                  placeholder="e.g. 1-12 UNF, M20x1.5"
                  className="w-full text-xs p-2 border border-slate-250 bg-white rounded font-mono focus:outline-none focus:border-[#0EA5E9] disabled:bg-slate-100 disabled:text-gray-400"
                />
              </div>
            </div>

            {/* Min Stock Alert limit */}
            <div className="grid grid-cols-12 gap-2 items-center border-b border-gray-100 pb-2">
              <div className="col-span-1 text-center">
                <input 
                  type="checkbox" 
                  checked={updateMinStock}
                  onChange={e => setUpdateMinStock(e.target.checked)}
                  className="w-4 h-4 text-red-655 focus:ring-sky-400 border-slate-300 rounded cursor-pointer"
                />
              </div>
              <div className="col-span-4">
                <label className="text-[11px] font-extrabold uppercase text-slate-700 tracking-wide">Min Stock limit</label>
              </div>
              <div className="col-span-7">
                <input 
                  type="number"
                  disabled={!updateMinStock}
                  value={minStock}
                  onChange={e => setMinStock(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full text-xs p-2 border border-slate-250 bg-white rounded font-mono focus:outline-none focus:border-[#0EA5E9] disabled:bg-slate-100 disabled:text-gray-400"
                />
              </div>
            </div>

            {/* Retail Price row */}
            <div className="grid grid-cols-12 gap-2 items-center border-b border-gray-100 pb-2">
              <div className="col-span-1 text-center">
                <input 
                  type="checkbox" 
                  checked={updateSalePrice}
                  onChange={e => setUpdateSalePrice(e.target.checked)}
                  className="w-4 h-4 text-red-655 focus:ring-sky-400 border-slate-300 rounded cursor-pointer"
                />
              </div>
              <div className="col-span-4">
                <label className="text-[11px] font-extrabold uppercase text-slate-700 tracking-wide">Sale Price (PKR)</label>
              </div>
              <div className="col-span-7">
                <input 
                  type="number"
                  disabled={!updateSalePrice}
                  value={salePrice}
                  onChange={e => setSalePrice(e.target.value)}
                  placeholder="e.g. 1500"
                  className="w-full text-xs p-2 border border-slate-250 bg-white rounded font-mono focus:outline-none focus:border-[#0EA5E9] disabled:bg-slate-100 disabled:text-gray-400"
                />
              </div>
            </div>

            {/* Buying Cost row (Locked to Owner only) */}
            <div className="grid grid-cols-12 gap-2 items-center border-b border-gray-100 pb-2">
              <div className="col-span-1 text-center">
                <input 
                  type="checkbox" 
                  disabled={!isOwner}
                  checked={updateCostPrice}
                  onChange={e => setUpdateCostPrice(e.target.checked)}
                  className="w-4 h-4 text-red-655 focus:ring-sky-400 border-slate-300 rounded cursor-pointer disabled:opacity-50"
                />
              </div>
              <div className="col-span-4 flex items-center space-x-1">
                <label className={`text-[11px] font-extrabold uppercase tracking-wide ${isOwner ? 'text-slate-700' : 'text-slate-400'}`}>Purchase Cost</label>
                {!isOwner && <Unlock className="w-2.5 h-2.5 text-gray-400" title="Restricted to Owner role only" />}
              </div>
              <div className="col-span-7">
                {isOwner ? (
                  <input 
                    type="number"
                    disabled={!updateCostPrice}
                    value={costPrice}
                    onChange={e => setCostPrice(e.target.value)}
                    placeholder="e.g. 1200"
                    className="w-full text-xs p-2 border border-slate-250 bg-white rounded font-mono focus:outline-none focus:border-[#0EA5E9] disabled:bg-slate-100 disabled:text-gray-400"
                  />
                ) : (
                  <div className="text-[10px] text-gray-400 italic bg-gray-50 p-2 border border-slate-200 border-dashed rounded leading-normal">
                    Owner privilege required to modify supplier cost rates structures.
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* List of target items */}
          <div className="space-y-1.5 font-sans pt-1">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Affected products ({selectedProducts.length} items):</span>
            <div className="border border-slate-200 p-2 rounded max-h-24 overflow-y-auto flex flex-wrap gap-1 bg-slate-50">
              {selectedProducts.map(p => (
                <div key={p.id} className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 font-mono rounded font-bold text-slate-800 flex items-center space-x-1 shadow-3xs">
                  <CornerDownRight className="w-2.5 h-2.5 text-red-550 mr-0.5" />
                  <span>{p.brand}</span>
                  <span className="text-[#0ea5e9] font-extrabold">{p.part_number}</span>
                </div>
              ))}
            </div>
          </div>

        </form>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs uppercase rounded cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2.5 bg-[#0ea5e9] hover:bg-sky-600 text-white font-extrabold text-xs uppercase tracking-wide rounded shadow-md cursor-pointer"
          >
            Apply Mass Updates
          </button>
        </div>

      </div>
    </div>
  );
}
