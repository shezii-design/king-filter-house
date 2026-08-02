import React, { useState, useMemo } from 'react';
import { Product } from '../types';
import { db, encodeCipher } from '../data';
import { 
  Table, 
  Search, 
  ArrowUpDown, 
  Check, 
  Edit2, 
  Save, 
  X, 
  Download, 
  Plus, 
  RefreshCw, 
  Tag, 
  MapPin, 
  Layers, 
  DollarSign, 
  Box,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface CellGridInventoryViewProps {
  products: Product[];
  userRole: 'Owner' | 'Staff';
  cipherKey: string;
  revealRealValues: boolean;
  selectedProductIds: string[];
  onSelectProductIds: (ids: string[]) => void;
  onProductSelect: (productId: string | null) => void;
  selectedProductId: string | null;
  onProductUpdate: () => void;
}

type SortField = 'part_number' | 'brand' | 'category' | 'shelf_location' | 'stock_qty' | 'cost_price' | 'sale_price';

export default function CellGridInventoryView({
  products,
  userRole,
  cipherKey,
  revealRealValues,
  selectedProductIds,
  onSelectProductIds,
  onProductSelect,
  selectedProductId,
  onProductUpdate
}: CellGridInventoryViewProps) {
  // Sort state
  const [sortField, setSortField] = useState<SortField>('part_number');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Column quick text filters
  const [columnFilterBrand, setColumnFilterBrand] = useState<string>('All');
  const [columnFilterLocation, setColumnFilterLocation] = useState<string>('All');
  const [columnFilterCategory, setColumnFilterCategory] = useState<string>('All');
  const [gridQuery, setGridQuery] = useState<string>('');

  // Editing state for inline cell edit
  const [editingCell, setEditingCell] = useState<{ productId: string; field: keyof Product } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Unique brand list for column filter
  const brands = useMemo(() => {
    const list = Array.from(new Set(products.map(p => p.brand).filter(Boolean))).sort();
    return ['All', ...list];
  }, [products]);

  // Unique category list for column filter
  const categories = useMemo(() => {
    const list = Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort();
    return ['All', ...list];
  }, [products]);

  // Unique shelf/rack locations for column filter
  const locations = useMemo(() => {
    const list = Array.from(new Set(products.map(p => p.shelf_location).filter(Boolean))).sort();
    return ['All', ...list];
  }, [products]);

  // Process and sort filtered products
  const filteredProducts = useMemo(() => {
    let list = [...products];

    if (gridQuery.trim()) {
      const q = gridQuery.toLowerCase().trim();
      list = list.filter(p => 
        p.part_number.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.shelf_location && p.shelf_location.toLowerCase().includes(q)) ||
        (p.supplier_code && p.supplier_code.toLowerCase().includes(q)) ||
        (p.thread_size && p.thread_size.toLowerCase().includes(q))
      );
    }

    if (columnFilterBrand !== 'All') {
      list = list.filter(p => p.brand.toLowerCase() === columnFilterBrand.toLowerCase());
    }

    if (columnFilterCategory !== 'All') {
      list = list.filter(p => p.category.toLowerCase() === columnFilterCategory.toLowerCase());
    }

    if (columnFilterLocation !== 'All') {
      list = list.filter(p => (p.shelf_location || '').toLowerCase() === columnFilterLocation.toLowerCase());
    }

    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [products, gridQuery, columnFilterBrand, columnFilterCategory, columnFilterLocation, sortField, sortAsc]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const startEditCell = (productId: string, field: keyof Product, currentValue: any) => {
    setEditingCell({ productId, field });
    setEditValue(currentValue !== null && currentValue !== undefined ? String(currentValue) : '');
  };

  const cancelEditCell = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveEditCell = (product: Product) => {
    if (!editingCell) return;

    const { field } = editingCell;
    const allProducts = db.getAllProductsWithDeleted();
    const idx = allProducts.findIndex(p => p.id === product.id);

    if (idx === -1) return;

    const target = { ...allProducts[idx] };
    let oldValue = target[field];

    if (field === 'stock_qty' || field === 'min_stock_alert' || field === 'cost_price' || field === 'sale_price' || field === 'height_mm' || field === 'od_mm') {
      const parsedNum = parseFloat(editValue);
      if (isNaN(parsedNum)) {
        alert("Please enter a valid numeric value!");
        return;
      }
      (target as any)[field] = parsedNum;
    } else {
      (target as any)[field] = editValue.trim();
    }

    allProducts[idx] = target;
    db.saveProducts(allProducts);

    // If stock qty changed, log movement
    if (field === 'stock_qty') {
      const qtyDiff = (target.stock_qty || 0) - (Number(oldValue) || 0);
      if (qtyDiff !== 0) {
        db.saveMovement({
          product_id: target.id,
          qty_change: qtyDiff,
          from_status: 'sellable',
          to_status: 'sellable',
          type: 'adjusted',
          user: userRole,
          reason: `Cell Grid Edit: Stock adjusted (${oldValue} → ${target.stock_qty})`
        });
      }
    }

    setEditingCell(null);
    setEditValue('');
    setSaveSuccessMsg(`Updated Cell '${String(field)}' for ${product.part_number}`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);

    onProductUpdate();
  };

  // Select / Deselect all
  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every(p => selectedProductIds.includes(p.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      onSelectProductIds([]);
    } else {
      onSelectProductIds(filteredProducts.map(p => p.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedProductIds.includes(id)) {
      onSelectProductIds(selectedProductIds.filter(i => i !== id));
    } else {
      onSelectProductIds([...selectedProductIds, id]);
    }
  };

  return (
    <div className="bg-white border border-[#E2DFDF] rounded-lg shadow-sm overflow-hidden flex flex-col w-full">
      
      {/* Grid Top Bar Controls */}
      <div className="p-3 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Table className="w-5 h-5 text-emerald-400" />
          <span className="font-bold text-xs uppercase tracking-wider text-slate-100">Live Cell Grid & Spreadsheet Manager</span>
          <span className="text-[10px] bg-slate-800 text-emerald-300 font-mono px-2 py-0.5 rounded border border-slate-700">
            {filteredProducts.length} Cells Active
          </span>
        </div>

        {/* Quick Filter Inputs */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Quick Search */}
          <div className="relative">
            <input 
              type="text"
              value={gridQuery}
              onChange={e => setGridQuery(e.target.value)}
              placeholder="Search cells..."
              className="text-xs bg-slate-800 text-slate-100 border border-slate-700 rounded px-2.5 py-1.5 pl-7 focus:outline-none focus:border-emerald-500 w-40 font-mono"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
          </div>

          {/* Cell Rack Filter */}
          <select 
            value={columnFilterLocation}
            onChange={e => setColumnFilterLocation(e.target.value)}
            className="text-xs bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            <option value="All">All Cell Racks</option>
            {locations.map(loc => loc !== 'All' && <option key={loc} value={loc}>Cell Rack: {loc}</option>)}
          </select>

          {/* Brand Filter */}
          <select 
            value={columnFilterBrand}
            onChange={e => setColumnFilterBrand(e.target.value)}
            className="text-xs bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            <option value="All">All Brands</option>
            {brands.map(b => b !== 'All' && <option key={b} value={b}>{b}</option>)}
          </select>

          {/* Reset Filters */}
          {(gridQuery || columnFilterBrand !== 'All' || columnFilterCategory !== 'All' || columnFilterLocation !== 'All') && (
            <button
              onClick={() => {
                setGridQuery('');
                setColumnFilterBrand('All');
                setColumnFilterCategory('All');
                setColumnFilterLocation('All');
              }}
              className="text-[10px] bg-slate-800 hover:bg-slate-700 text-amber-300 px-2 py-1.5 rounded border border-slate-700 uppercase font-bold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Save Success Alert Notification */}
      {saveSuccessMsg && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs font-mono text-emerald-800 font-bold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{saveSuccessMsg}</span>
          </div>
        </div>
      )}

      {/* Interactive Spreadsheet Table Container */}
      <div className="overflow-x-auto overflow-y-auto max-h-[620px] scrollbar-thin">
        <table className="w-full text-left border-collapse min-w-[980px] font-mono text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-700 text-[10px] uppercase font-black tracking-wider border-b border-slate-300 sticky top-0 z-10 shadow-xs">
              <th className="p-2.5 w-10 text-center border-r border-slate-200 bg-slate-100">
                <input 
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  className="w-3.5 h-3.5 text-emerald-600 rounded cursor-pointer"
                />
              </th>
              <th className="p-2.5 w-12 text-center border-r border-slate-200 bg-slate-100 text-slate-500">
                Row
              </th>
              <th 
                onClick={() => toggleSort('part_number')}
                className="p-2.5 border-r border-slate-200 bg-slate-100 cursor-pointer hover:bg-slate-200 transition-colors select-none"
              >
                <div className="flex items-center justify-between">
                  <span>Cell A: Part Number</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th 
                onClick={() => toggleSort('brand')}
                className="p-2.5 border-r border-slate-200 bg-slate-100 cursor-pointer hover:bg-slate-200 transition-colors select-none"
              >
                <div className="flex items-center justify-between">
                  <span>Cell B: Brand</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th 
                onClick={() => toggleSort('category')}
                className="p-2.5 border-r border-slate-200 bg-slate-100 cursor-pointer hover:bg-slate-200 transition-colors select-none"
              >
                <div className="flex items-center justify-between">
                  <span>Cell C: Category / Subtype</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th 
                onClick={() => toggleSort('shelf_location')}
                className="p-2.5 border-r border-slate-200 bg-slate-100 cursor-pointer hover:bg-slate-200 transition-colors select-none bg-amber-50/60 text-amber-900"
              >
                <div className="flex items-center justify-between">
                  <span>Cell D: Shelf/Rack Cell</span>
                  <ArrowUpDown className="w-3 h-3 text-amber-600" />
                </div>
              </th>
              <th 
                onClick={() => toggleSort('stock_qty')}
                className="p-2.5 border-r border-slate-200 bg-slate-100 cursor-pointer hover:bg-slate-200 transition-colors select-none text-right"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Cell E: Stock Qty</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th 
                onClick={() => toggleSort('sale_price')}
                className="p-2.5 border-r border-slate-200 bg-slate-100 cursor-pointer hover:bg-slate-200 transition-colors select-none text-right"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Cell F: Sale Price</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th 
                onClick={() => toggleSort('cost_price')}
                className="p-2.5 border-r border-slate-200 bg-slate-100 cursor-pointer hover:bg-slate-200 transition-colors select-none text-right text-emerald-800"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Cell G: Cost Price</span>
                  <ArrowUpDown className="w-3 h-3 text-emerald-600" />
                </div>
              </th>
              <th className="p-2.5 border-r border-slate-200 bg-slate-100">
                Cell H: Thread / Spec
              </th>
              <th className="p-2.5 text-center bg-slate-100">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-800">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-slate-400 font-sans">
                  No cell records match the active search or filters.
                </td>
              </tr>
            ) : (
              filteredProducts.map((p, idx) => {
                const isSelected = selectedProductId === p.id;
                const isChecked = selectedProductIds.includes(p.id);
                const isEditingThis = (field: keyof Product) => editingCell?.productId === p.id && editingCell?.field === field;

                return (
                  <tr 
                    key={p.id}
                    className={`hover:bg-sky-50/50 transition-colors group ${
                      isSelected ? 'bg-sky-100/60 font-bold' : isChecked ? 'bg-slate-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="p-2 text-center border-r border-slate-200" onClick={e => e.stopPropagation()}>
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelectOne(p.id)}
                        className="w-3.5 h-3.5 text-emerald-600 rounded cursor-pointer"
                      />
                    </td>

                    {/* Row Index */}
                    <td className="p-2 text-center border-r border-slate-200 text-[10px] text-slate-400 select-none">
                      #{idx + 1}
                    </td>

                    {/* CELL A: Part Number */}
                    <td className="p-2 border-r border-slate-200 font-bold text-slate-900 group-hover:text-sky-700">
                      {isEditingThis('part_number') ? (
                        <div className="flex items-center gap-1">
                          <input 
                            type="text" 
                            value={editValue} 
                            onChange={e => setEditValue(e.target.value)} 
                            className="w-full text-xs p-1 border border-sky-500 rounded bg-white font-mono focus:outline-none"
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && saveEditCell(p)}
                          />
                          <button onClick={() => saveEditCell(p)} className="p-1 bg-emerald-600 text-white rounded"><Save className="w-3 h-3" /></button>
                          <button onClick={cancelEditCell} className="p-1 bg-slate-400 text-white rounded"><X className="w-3 h-3" /></button>
                        </div>
                      ) : (
                        <div 
                          className="flex items-center justify-between cursor-pointer hover:underline"
                          onDoubleClick={() => startEditCell(p.id, 'part_number', p.part_number)}
                          onClick={() => onProductSelect(p.id)}
                        >
                          <span>{p.part_number}</span>
                          <Edit2 className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )}
                    </td>

                    {/* CELL B: Brand */}
                    <td className="p-2 border-r border-slate-200">
                      {isEditingThis('brand') ? (
                        <div className="flex items-center gap-1">
                          <input 
                            type="text" 
                            value={editValue} 
                            onChange={e => setEditValue(e.target.value)} 
                            className="w-full text-xs p-1 border border-sky-500 rounded bg-white font-mono focus:outline-none"
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && saveEditCell(p)}
                          />
                          <button onClick={() => saveEditCell(p)} className="p-1 bg-emerald-600 text-white rounded"><Save className="w-3 h-3" /></button>
                          <button onClick={cancelEditCell} className="p-1 bg-slate-400 text-white rounded"><X className="w-3 h-3" /></button>
                        </div>
                      ) : (
                        <div 
                          className="flex items-center justify-between cursor-pointer"
                          onDoubleClick={() => startEditCell(p.id, 'brand', p.brand)}
                        >
                          <span className="bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded uppercase font-bold">{p.brand}</span>
                          <Edit2 className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )}
                    </td>

                    {/* CELL C: Category / Subtype */}
                    <td className="p-2 border-r border-slate-200">
                      {isEditingThis('category') ? (
                        <div className="flex items-center gap-1">
                          <input 
                            type="text" 
                            value={editValue} 
                            onChange={e => setEditValue(e.target.value)} 
                            className="w-full text-xs p-1 border border-sky-500 rounded bg-white font-mono focus:outline-none"
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && saveEditCell(p)}
                          />
                          <button onClick={() => saveEditCell(p)} className="p-1 bg-emerald-600 text-white rounded"><Save className="w-3 h-3" /></button>
                          <button onClick={cancelEditCell} className="p-1 bg-slate-400 text-white rounded"><X className="w-3 h-3" /></button>
                        </div>
                      ) : (
                        <div 
                          className="flex items-center justify-between cursor-pointer text-slate-600"
                          onDoubleClick={() => startEditCell(p.id, 'category', p.category)}
                        >
                          <span>{p.category} {p.subtype ? `(${p.subtype})` : ''}</span>
                          <Edit2 className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )}
                    </td>

                    {/* CELL D: Shelf / Rack Cell Location */}
                    <td className="p-2 border-r border-slate-200 bg-amber-50/40">
                      {isEditingThis('shelf_location') ? (
                        <div className="flex items-center gap-1">
                          <input 
                            type="text" 
                            value={editValue} 
                            onChange={e => setEditValue(e.target.value)} 
                            className="w-full text-xs p-1 border border-amber-500 rounded bg-white font-mono focus:outline-none"
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && saveEditCell(p)}
                          />
                          <button onClick={() => saveEditCell(p)} className="p-1 bg-emerald-600 text-white rounded"><Save className="w-3 h-3" /></button>
                          <button onClick={cancelEditCell} className="p-1 bg-slate-400 text-white rounded"><X className="w-3 h-3" /></button>
                        </div>
                      ) : (
                        <div 
                          className="flex items-center justify-between cursor-pointer font-bold text-amber-900"
                          onDoubleClick={() => startEditCell(p.id, 'shelf_location', p.shelf_location)}
                        >
                          <span>📍 {p.shelf_location || 'Row A-1'}</span>
                          <Edit2 className="w-2.5 h-2.5 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )}
                    </td>

                    {/* CELL E: Stock Qty */}
                    <td className="p-2 border-r border-slate-200 text-right">
                      {isEditingThis('stock_qty') ? (
                        <div className="flex items-center gap-1 justify-end">
                          <input 
                            type="number" 
                            value={editValue} 
                            onChange={e => setEditValue(e.target.value)} 
                            className="w-20 text-xs p-1 border border-sky-500 rounded bg-white font-mono text-right focus:outline-none"
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && saveEditCell(p)}
                          />
                          <button onClick={() => saveEditCell(p)} className="p-1 bg-emerald-600 text-white rounded"><Save className="w-3 h-3" /></button>
                          <button onClick={cancelEditCell} className="p-1 bg-slate-400 text-white rounded"><X className="w-3 h-3" /></button>
                        </div>
                      ) : (
                        <div 
                          className="flex items-center justify-end space-x-1 cursor-pointer font-bold"
                          onDoubleClick={() => startEditCell(p.id, 'stock_qty', p.stock_qty)}
                        >
                          <span className={p.stock_qty === 0 ? 'text-rose-600 font-extrabold' : p.stock_qty <= p.min_stock_alert ? 'text-amber-600 font-extrabold' : 'text-emerald-700'}>
                            {p.stock_qty}
                          </span>
                          <Edit2 className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )}
                    </td>

                    {/* CELL F: Sale Price */}
                    <td className="p-2 border-r border-slate-200 text-right font-bold text-sky-700">
                      {isEditingThis('sale_price') ? (
                        <div className="flex items-center gap-1 justify-end">
                          <input 
                            type="number" 
                            value={editValue} 
                            onChange={e => setEditValue(e.target.value)} 
                            className="w-24 text-xs p-1 border border-sky-500 rounded bg-white font-mono text-right focus:outline-none"
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && saveEditCell(p)}
                          />
                          <button onClick={() => saveEditCell(p)} className="p-1 bg-emerald-600 text-white rounded"><Save className="w-3 h-3" /></button>
                          <button onClick={cancelEditCell} className="p-1 bg-slate-400 text-white rounded"><X className="w-3 h-3" /></button>
                        </div>
                      ) : (
                        <div 
                          className="flex items-center justify-end space-x-1 cursor-pointer"
                          onDoubleClick={() => startEditCell(p.id, 'sale_price', p.sale_price)}
                        >
                          <span>{revealRealValues ? `Rs. ${p.sale_price}` : encodeCipher(p.sale_price, cipherKey)}</span>
                          <Edit2 className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )}
                    </td>

                    {/* CELL G: Cost Price */}
                    <td className="p-2 border-r border-slate-200 text-right text-slate-600">
                      {isEditingThis('cost_price') ? (
                        <div className="flex items-center gap-1 justify-end">
                          <input 
                            type="number" 
                            value={editValue} 
                            onChange={e => setEditValue(e.target.value)} 
                            className="w-24 text-xs p-1 border border-emerald-500 rounded bg-white font-mono text-right focus:outline-none"
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && saveEditCell(p)}
                          />
                          <button onClick={() => saveEditCell(p)} className="p-1 bg-emerald-600 text-white rounded"><Save className="w-3 h-3" /></button>
                          <button onClick={cancelEditCell} className="p-1 bg-slate-400 text-white rounded"><X className="w-3 h-3" /></button>
                        </div>
                      ) : (
                        <div 
                          className="flex items-center justify-end space-x-1 cursor-pointer"
                          onDoubleClick={() => startEditCell(p.id, 'cost_price', p.cost_price)}
                        >
                          <span>{revealRealValues ? `Rs. ${p.cost_price}` : encodeCipher(p.cost_price, cipherKey)}</span>
                          <Edit2 className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )}
                    </td>

                    {/* CELL H: Thread / Dimensions */}
                    <td className="p-2 border-r border-slate-200 text-slate-500 text-[11px]">
                      {p.thread_size || (p.height_mm ? `H:${p.height_mm} OD:${p.od_mm}` : 'Standard')}
                    </td>

                    {/* Actions */}
                    <td className="p-2 text-center">
                      <button
                        onClick={() => onProductSelect(isSelected ? null : p.id)}
                        className={`px-2 py-1 text-[10px] uppercase font-bold rounded cursor-pointer transition-colors ${
                          isSelected ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        {isSelected ? 'Opened' : 'Inspect'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Grid Bottom Info Bar */}
      <div className="p-2.5 bg-slate-100 border-t border-slate-200 text-[11px] font-mono text-slate-600 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>💡 <strong>Tip:</strong> Double-click any cell (Part Number, Brand, Category, Rack/Location, Stock, Price) to perform instant inline cell edits.</span>
        <span>Showing {filteredProducts.length} row cells</span>
      </div>
    </div>
  );
}
