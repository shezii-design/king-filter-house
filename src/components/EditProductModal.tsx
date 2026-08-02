import React, { useState, useEffect } from 'react';
import { db, normalizeCode, ensureHttpsUrl } from '../data';
import { Product } from '../types';
import { AlertTriangle, Info, Check, Upload, Link, Image as ImageIcon, Trash2, Globe } from 'lucide-react';

interface EditProductModalProps {
  product: Product;
  userRole: 'Owner' | 'Staff';
  onClose: () => void;
  onSave: (updatedProduct: Product) => void;
}

export default function EditProductModal({ product, userRole, onClose, onSave }: EditProductModalProps) {
  const [existingProducts, setExistingProducts] = useState<Product[]>([]);
  
  // Validation error state
  const [errorText, setErrorText] = useState<string | null>(null);

  // Form Fields - Basic Info
  const [partNumber, setPartNumber] = useState(product.part_number);
  const [brand, setBrand] = useState(product.brand);
  const [category, setCategory] = useState(product.category);
  const [subtype, setSubtype] = useState(product.subtype || 'C');
  const [packSize, setPackSize] = useState(product.pack_size || '');
  const [grade, setGrade] = useState(product.grade || 'standard');
  const [shelfLocation, setShelfLocation] = useState(product.shelf_location || '');

  // Form Fields - Specs
  const [threadSize, setThreadSize] = useState(product.thread_size || '');
  const [heightMm, setHeightMm] = useState<string>(product.height_mm !== null ? product.height_mm.toString() : '');
  const [odMm, setOdMm] = useState<string>(product.od_mm !== null ? product.od_mm.toString() : '');
  const initialLength = product.length_inch !== undefined && product.length_inch !== null 
    ? product.length_inch.toString() 
    : (product.height_mm ? parseFloat((product.height_mm / 25.4).toFixed(2)).toString() : '');
  const initialWidth = product.width_inch !== undefined && product.width_inch !== null 
    ? product.width_inch.toString() 
    : (product.od_mm ? parseFloat((product.od_mm / 25.4).toFixed(2)).toString() : '');
  const initialInner = product.inner_diameter_inch !== undefined && product.inner_diameter_inch !== null 
    ? product.inner_diameter_inch.toString() 
    : (product.thread_size ? '2.1' : '1.8');

  const [lengthInch, setLengthInch] = useState<string>(initialLength);
  const [widthInch, setWidthInch] = useState<string>(initialWidth);
  const [innerDiameterInch, setInnerDiameterInch] = useState<string>(initialInner);
  const [gasketOdMm, setGasketOdMm] = useState<string>(product.gasket_od_mm !== undefined && product.gasket_od_mm !== null ? product.gasket_od_mm.toString() : '');
  const [gasketIdMm, setGasketIdMm] = useState<string>(product.gasket_id_mm !== undefined && product.gasket_id_mm !== null ? product.gasket_id_mm.toString() : '');
  const [smartSizeInput, setSmartSizeInput] = useState<string>(
    initialLength && initialWidth && initialInner 
      ? `${initialLength}x${initialWidth}x${initialInner}`
      : ''
  );

  const handleSmartSizeChange = (val: string) => {
    setSmartSizeInput(val);
    const match = val.match(/^\s*([0-9.]+)\s*[xX*\/,-]\s*([0-9.]+)\s*[xX*\/,-]\s*([0-9.]+)\s*$/);
    if (match) {
      setLengthInch(match[1]);
      setWidthInch(match[2]);
      setInnerDiameterInch(match[3]);
      setHeightMm(Math.round(parseFloat(match[1]) * 25.4).toString());
      setOdMm(Math.round(parseFloat(match[2]) * 25.4).toString());
    } else {
      const match2 = val.match(/^\s*([0-9.]+)\s*[xX*\/,-]\s*([0-9.]+)\s*$/);
      if (match2) {
        setLengthInch(match2[1]);
        setWidthInch(match2[2]);
        setHeightMm(Math.round(parseFloat(match2[1]) * 25.4).toString());
        setOdMm(Math.round(parseFloat(match2[2]) * 25.4).toString());
      }
    }
  };

  const [micronRating, setMicronRating] = useState<string>(product.micron_rating !== null ? product.micron_rating.toString() : '');
  const [cabinFilter, setCabinFilter] = useState(product.cabin_filter || 'No');
  const [supplierCode, setSupplierCode] = useState(product.supplier_code || '');
  const [notes, setNotes] = useState(product.notes || '');

  // Form Fields - Stock & Pricing
  const [salePrice, setSalePrice] = useState<string>(product.sale_price.toString());
  const [costPrice, setCostPrice] = useState<string>(product.cost_price.toString());
  const [stockQty, setStockQty] = useState<string>(product.stock_qty.toString());
  const [damagedQty, setDamagedQty] = useState<string>(product.damaged_qty.toString());
  const [minStockAlert, setMinStockAlert] = useState<string>(product.min_stock_alert.toString());

  // Form Fields - Optional references / media
  const [imageUrls, setImageUrls] = useState<string[]>(product.image_urls || (product.image_url ? [product.image_url] : []));
  const [manualImageUrl, setManualImageUrl] = useState('');
  const [productUrl, setProductUrl] = useState(product.product_url || '');
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Image should be smaller than 2MB to ensure good performance");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrls(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Image should be smaller than 2MB to ensure good performance");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrls(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    }
  };

  const addManualImageUrl = () => {
    if (manualImageUrl.trim()) {
      setImageUrls(prev => [...prev, manualImageUrl.trim()]);
      setManualImageUrl('');
    }
  };

  const removeImageUrlIndex = (index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    setExistingProducts(db.getProducts().filter(p => p.id !== product.id));
  }, [product.id]);

  const dynamicCategories = React.useMemo(() => {
    const existing = existingProducts
      .map(p => p.category)
      .filter((cat): cat is string => typeof cat === 'string' && cat.trim() !== '');

    const uniqueExisting = Array.from(new Set(existing)) as string[];
    
    // Default categories to ensure they always exist as options
    const defaults = [
      'Oil Filter', 'Fuel Filter', 'Hydraulic Filter', 'Air Filter',
      'Engine Oil', 'Hydraulic Oil', 'Gear Oil', 'Coolant', 'Grease',
      'Tool/Opener', 'Accessory', 'Other'
    ];
    
    const combined = Array.from(new Set([...defaults, ...uniqueExisting]));
    return combined.sort((a, b) => a.localeCompare(b));
  }, [existingProducts]);

  const isFilterCategory = ['Oil Filter', 'Fuel Filter', 'Hydraulic Filter', 'Air Filter'].includes(category);
  const isOilCategory = ['Engine Oil', 'Hydraulic Oil', 'Gear Oil', 'Coolant', 'Grease'].includes(category);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);

    if (!partNumber.trim()) {
      setErrorText("Part number is required.");
      return;
    }

    const norm = normalizeCode(partNumber);
    const duplicate = existingProducts.find(p => p.part_number_norm === norm);
    if (duplicate) {
      setErrorText(`Duplicate code detected: Normalized part number "${norm}" already exists as filter "${duplicate.brand} ${duplicate.part_number}".`);
      return;
    }

    if (!brand.trim()) {
      setErrorText("Brand is required.");
      return;
    }

    const parsedSale = parseFloat(salePrice);
    if (isNaN(parsedSale) || parsedSale < 0) {
      setErrorText("Sale price must be a valid, positive number.");
      return;
    }

    const parsedCost = parseFloat(costPrice) || 0;
    if (userRole === 'Owner' && (isNaN(parsedCost) || parsedCost < 0)) {
      setErrorText("Cost price must be a valid, positive number.");
      return;
    }

    const parsedStock = parseInt(stockQty, 10);
    if (isNaN(parsedStock) || parsedStock < 0) {
      setErrorText("Stock qty cannot be a negative value.");
      return;
    }

    const parsedDamaged = parseInt(damagedQty, 10);
    if (isNaN(parsedDamaged) || parsedDamaged < 0) {
      setErrorText("Damaged stock qty cannot be a negative value.");
      return;
    }

    const parsedMinStock = parseInt(minStockAlert, 10);
    if (isNaN(parsedMinStock) || parsedMinStock < 0) {
      setErrorText("Minimum stock alert level cannot be a negative value.");
      return;
    }

    try {
      const updatedProduct: Product = {
        ...product,
        part_number: partNumber.trim(),
        part_number_norm: norm,
        brand: brand.trim(),
        category,
        subtype: isFilterCategory ? subtype : '',
        pack_size: isOilCategory ? packSize : '',
        grade,
        shelf_location: shelfLocation.trim() || 'Unassigned',
        thread_size: isFilterCategory ? threadSize.trim() : '',
        length_inch: isFilterCategory && lengthInch ? parseFloat(lengthInch) : null,
        width_inch: isFilterCategory && widthInch ? parseFloat(widthInch) : null,
        inner_diameter_inch: isFilterCategory && innerDiameterInch ? parseFloat(innerDiameterInch) : null,
        gasket_od_mm: gasketOdMm ? parseFloat(gasketOdMm) : null,
        gasket_id_mm: gasketIdMm ? parseFloat(gasketIdMm) : null,
        cabin_filter: category === 'Air Filter' ? cabinFilter : 'No',
        supplier_code: supplierCode.trim(),
        notes: notes.trim(),
        sale_price: parsedSale,
        cost_price: userRole === 'Owner' ? parsedCost : product.cost_price,
        stock_qty: parsedStock,
        damaged_qty: parsedDamaged,
        min_stock_alert: parsedMinStock,
        image_url: imageUrls[0] ? ensureHttpsUrl(imageUrls[0]) : undefined,
        image_urls: imageUrls.map(u => ensureHttpsUrl(u)).filter(Boolean),
        product_url: productUrl.trim() ? ensureHttpsUrl(productUrl.trim()) : undefined,
      };

      onSave(updatedProduct);
    } catch (err: any) {
      setErrorText("Save Error: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto" id="modal-edit-product-backdrop">
      <div className="bg-white w-full max-w-2xl border-t-4 border-t-[#0EA5E9] rounded-lg shadow-xl overflow-hidden flex flex-col my-8 max-h-[90vh]" id="modal-edit-product-container">
        
        {/* Header decoration */}
        <div className="bg-slate-50 border-b border-[#E2DFDF] p-4 flex justify-between items-center flex-shrink-0">
          <div>
            <span className="text-[10px] bg-sky-100 text-[#0ea5e9] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider">
              Edit Registry
            </span>
            <h3 className="text-base font-extrabold uppercase text-[#2A2727] tracking-wider mt-1">
              Edit Product: {product.brand} - {product.part_number}
            </h3>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 font-bold text-sm"
          >
            ✕ Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorText && (
            <div className="p-3 bg-sky-50 border border-sky-200 rounded flex items-start space-x-2 text-[#0ea5e9] text-xs" id="edit-prod-error">
              <AlertTriangle className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
              <span>{errorText}</span>
            </div>
          )}

          {/* Section 1: Standard Brand Details */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-black uppercase text-indigo-700 tracking-wider border-b pb-1">
              1. Basic Identifiers & Category
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-gray-500 font-extrabold text-[10px] uppercase mb-1">Part Number (FSD code)</label>
                <input 
                  type="text" 
                  value={partNumber}
                  onChange={e => setPartNumber(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded font-mono font-bold uppercase focus:outline-none focus:border-[#0EA5E9]"
                  placeholder="e.g. C-6204"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-500 font-extrabold text-[10px] uppercase mb-1">Brand Manufacturer</label>
                <input 
                  type="text" 
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded font-bold focus:outline-none focus:border-[#0EA5E9]"
                  placeholder="e.g. Sakura, Guard, Baldon"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-500 font-extrabold text-[10px] uppercase mb-1">Stock Category</label>
                  <input 
                    type="text"
                    list="categories-list-edit"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full text-xs p-2 border border-gray-300 rounded focus:outline-none focus:border-[#0EA5E9] font-mono"
                    placeholder="Enter/select category..."
                    required
                  />
                  <datalist id="categories-list-edit">
                    {dynamicCategories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {isFilterCategory && (
                <div>
                  <label className="block text-gray-500 font-extrabold text-[10px] uppercase mb-1">Filter Code Sub-type</label>
                  <input 
                    type="text"
                    value={subtype}
                    onChange={e => setSubtype(e.target.value)}
                    className="w-full text-xs p-2 border border-gray-300 rounded font-mono font-bold"
                  />
                </div>
              )}

              {isOilCategory && (
                <div>
                  <label className="block text-gray-500 font-extrabold text-[10px] uppercase mb-1">Pack Size Capacity</label>
                  <input 
                    type="text"
                    value={packSize}
                    onChange={e => setPackSize(e.target.value)}
                    className="w-full text-xs p-2 border border-gray-300 rounded"
                    placeholder="e.g. 4L can, 20L bucket"
                  />
                </div>
              )}

              <div>
                <label className="block text-gray-500 font-extrabold text-[10px] uppercase mb-1">Product Grade Level</label>
                <select 
                  value={grade}
                  onChange={e => setGrade(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded"
                >
                  <option value="standard">Standard Duty</option>
                  <option value="SP">Premium SP Plus</option>
                  <option value="normal">Normal / Generic</option>
                  <option value="high_temp">High Temperature</option>
                  <option value="A">Class-A Genuine</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-500 font-extrabold text-[10px] uppercase mb-1">Shelf Warehouse Location</label>
                <input 
                  type="text"
                  value={shelfLocation}
                  onChange={e => setShelfLocation(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded font-mono"
                  placeholder="e.g. Row 4-C"
                />
              </div>
            </div>
          </div>

           {/* Section 2: Technical specifications details */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-black uppercase text-indigo-700 tracking-wider border-b pb-1">
              2. Technical Specifications & OEM Parameters
            </h4>
            {isFilterCategory && (
              <div className="space-y-3 mb-4">
                {/* Smart size parser bar */}
                <div className="bg-sky-50/40 p-3 border border-sky-200/60 rounded">
                  <label className="block text-slate-800 font-extrabold text-sm uppercase mb-1">
                    ⚡ Quick Smart Size Parser (Inches)
                  </label>
                  <input 
                    type="text" 
                    value={smartSizeInput}
                    onChange={e => handleSmartSizeChange(e.target.value)}
                    placeholder="Type e.g. 4.5x3.9x2.1 (Length x Width x Inner)"
                    className="w-full text-sm font-black p-3 border-2 border-sky-200 focus:outline-none focus:border-sky-500 border-l-[3px] rounded bg-white shadow-2xs"
                  />
                  <p className="text-[11px] text-gray-500 font-medium mt-1">
                    Typing <span className="font-mono font-black text-slate-900">4x4x2</span> saves numbers separately: Length (<span className="font-bold font-mono">4"</span>), Width/OD (<span className="font-bold font-mono">4"</span>), Inner Dia (<span className="font-bold font-mono">2"</span>) and auto-calculates millimeters (mm).
                  </p>
                </div>

                {/* Separate saved dimensions (Inches) */}
                <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 border border-slate-200 rounded-md">
                  <div>
                    <label className="block text-xs text-gray-700 font-extrabold mb-1 uppercase tracking-wider">Length (inch)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={lengthInch}
                      onChange={e => setLengthInch(e.target.value)}
                      placeholder="e.g. 4.5"
                      className="w-full text-sm font-bold p-2.5 border border-[#E2DFDF] bg-white rounded shadow-2xs focus:border-sky-500 border-l-[3px] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-700 font-extrabold mb-1 uppercase tracking-wider">Width/OD (inch)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={widthInch}
                      onChange={e => setWidthInch(e.target.value)}
                      placeholder="e.g. 3.9"
                      className="w-full text-sm font-bold p-2.5 border border-[#E2DFDF] bg-white rounded shadow-2xs focus:border-sky-500 border-l-[3px] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-700 font-extrabold mb-1 uppercase tracking-wider">Inner Dia (inch)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={innerDiameterInch}
                      onChange={e => setInnerDiameterInch(e.target.value)}
                      placeholder="e.g. 2.1"
                      className="w-full text-sm font-bold p-2.5 border border-[#E2DFDF] bg-white rounded shadow-2xs focus:border-sky-500 border-l-[3px] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isFilterCategory && (
                <div>
                  <label className="block text-gray-400 font-bold text-[10px] uppercase mb-1">Screw Thread Size</label>
                  <input 
                    type="text"
                    value={threadSize}
                    onChange={e => setThreadSize(e.target.value)}
                    className="w-full text-xs p-2 border border-gray-300 rounded font-mono"
                    placeholder="e.g. 3/4-16, M20x1.5"
                  />
                </div>
              )}

              {category === 'Air Filter' && (
                <div>
                  <label className="block text-gray-400 font-bold text-[10px] uppercase mb-1">AC Cabin Standard Type</label>
                  <select 
                    value={cabinFilter}
                    onChange={e => setCabinFilter(e.target.value)}
                    className="w-full text-xs p-2 border border-gray-300 rounded"
                  >
                    <option value="No">No (Engine Air Filter)</option>
                    <option value="Yes">Yes (Interior Cabin AC Filter)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-gray-500 font-extrabold text-[10px] uppercase mb-1">Supplier/Wholesaler</label>
                <select 
                  value={supplierCode}
                  onChange={e => setSupplierCode(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded bg-white font-sans cursor-pointer focus:ring-1 focus:ring-sky-400 focus:outline-none"
                >
                  <option value="">-- Select Supplier --</option>
                  {db.getParties()
                    .filter(p => p.type === 'supplier' || p.is_supplier_linked === true)
                    .map(sup => (
                      <option key={sup.id} value={sup.name}>
                        {sup.name} {sup.city ? `(${sup.city})` : ''}
                      </option>
                    ))
                  }
                  {supplierCode && !db.getParties().filter(p => p.type === 'supplier' || p.is_supplier_linked === true).some(sup => sup.name === supplierCode) && (
                    <option value={supplierCode}>{supplierCode}</option>
                  )}
                </select>
              </div>
            </div>

            {/* Optional Gasket Dimensions */}
            <div className="bg-amber-50/40 p-3 border border-amber-200/50 rounded-md space-y-2">
              <span className="text-xs uppercase tracking-wider font-extrabold text-amber-800 flex items-center gap-1.5 font-sans">
                ⭕ Gasket Dimensions (Optional)
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-750 font-bold mb-1 uppercase tracking-wider">Gasket Outer Dia (mm)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={gasketOdMm}
                    onChange={e => setGasketOdMm(e.target.value)}
                    placeholder="e.g. 72.5"
                    className="w-full text-xs p-2 border border-amber-200 bg-white rounded shadow-2xs focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-750 font-bold mb-1 uppercase tracking-wider">Gasket Inner Dia (mm)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={gasketIdMm}
                    onChange={e => setGasketIdMm(e.target.value)}
                    placeholder="e.g. 62.0"
                    className="w-full text-xs p-2 border border-amber-200 bg-white rounded shadow-2xs focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-gray-500 font-extrabold text-[10px] uppercase mb-1">Compatible Machinery / Notes</label>
              <textarea 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full text-xs p-2 border border-gray-300 rounded"
                placeholder="List excavator models, tractor types, or engines this filter is compatible with..."
              />
            </div>
          </div>

          {/* Section 3: Quantity Stocks, Prices and Alerts */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-black uppercase text-indigo-700 tracking-wider border-b pb-1">
              3. Pricing, Quantities & Level Alerts
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-600 font-bold mb-1 col-span-1 text-[11px]">Retail Sale Price (Rs.) *</label>
                <input 
                  type="number"
                  value={salePrice}
                  onChange={e => setSalePrice(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded font-mono font-bold"
                  required
                />
              </div>

              {userRole === 'Owner' ? (
                <div>
                  <label className="block text-[#0EA5E9] font-bold mb-1 text-[11px]">Confidential Purchase Cost (Rs.) *</label>
                  <input 
                    type="number"
                    value={costPrice}
                    onChange={e => setCostPrice(e.target.value)}
                    className="w-full text-xs p-2 border border-gray-300 rounded font-mono font-bold"
                    required
                  />
                </div>
              ) : (
                <div className="bg-yellow-50 p-2 border rounded self-end">
                  <span className="text-[10px] text-gray-500 font-semibold block uppercase">CONFIDENTIAL COST RATE</span>
                  <span className="text-[11px] text-gray-400 italic">Access locked. Owner role can adjust item purchase costs.</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-gray-600 font-bold mb-1 text-[11px]">Available Sellable Stock</label>
                <input 
                  type="number"
                  value={stockQty}
                  onChange={e => setStockQty(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-sky-600 font-bold mb-1 text-[11px]">Damaged/Fracture Stock</label>
                <input 
                  type="number"
                  value={damagedQty}
                  onChange={e => setDamagedQty(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-600 font-bold mb-1 text-[11px]">Minimum Stock Alert Threshold</label>
                <input 
                  type="number"
                  value={minStockAlert}
                  onChange={e => setMinStockAlert(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded font-mono"
                  required
                />
              </div>
            </div>

            {/* Optional References & Media Section */}
            <div className="border border-slate-200 rounded-md p-3.5 bg-slate-50/50 space-y-4 my-2">
              <span className="text-xs uppercase tracking-wider font-extrabold text-slate-500 block border-b pb-1.5">🖼️ Optional References & Media Cataloging</span>
              
              {/* Image Upload / Drag Drop & Image link */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-gray-700 font-extrabold text-xs uppercase font-sans">Product Image References</label>
                  <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 text-slate-700 font-bold font-sans rounded-xs">
                    {imageUrls.length} Attached
                  </span>
                </div>
                
                {/* Drag-drop zone */}
                <div 
                  onDragEnter={handleDrag} 
                  onDragOver={handleDrag} 
                  onDragLeave={handleDrag} 
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-lg p-4 transition-all flex flex-col items-center justify-center cursor-pointer ${
                    dragActive ? 'border-sky-500 border-l-[3px] bg-sky-50/20' : 'border-slate-300 hover:border-slate-400 bg-white'
                  }`}
                >
                  <label className="w-full flex flex-col items-center justify-center cursor-pointer space-y-1.5 py-2">
                    <Upload className="w-6 h-6 text-slate-450" />
                    <span className="text-xs font-bold text-slate-700 font-sans">Drag & Drop Image Here, or <span className="text-blue-600 hover:underline">Browse</span></span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange} 
                      className="hidden" 
                    />
                    <span className="text-[10px] text-gray-400 font-sans">PNG or JPEG up to 2MB (Allows multiple)</span>
                  </label>
                </div>

                {/* Gallery of images */}
                {imageUrls.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 bg-white p-2 border border-slate-200 rounded-md font-sans">
                    {imageUrls.map((url, idx) => (
                      <div key={idx} className="relative group border rounded p-1.5 bg-slate-50 shadow-3xs flex flex-col items-center">
                        <img 
                          src={url} 
                          alt={`Preview ${idx + 1}`} 
                          className="max-h-24 w-full object-contain rounded bg-white border" 
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = "https://placehold.co/600x400/f1f5f9/475569?text=Image+Not+Available";
                          }}
                        />
                        <button 
                          type="button" 
                          onClick={() => removeImageUrlIndex(idx)}
                          className="absolute top-1.5 right-1.5 p-1 bg-[#0ea5e9] hover:bg-sky-600 text-white rounded-full shadow-md transition-all"
                          title="Remove Image"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <div className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[8px] font-mono font-bold px-1 rounded-sm">
                          Img #{idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Or Manual Direct URL link */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-extrabold uppercase flex items-center space-x-1 font-sans">
                    <ImageIcon className="w-3 h-3 text-slate-450" />
                    <span>Attach image via web link:</span>
                  </label>
                  <div className="flex space-x-1.5">
                    <input 
                      type="url"
                      value={manualImageUrl}
                      onChange={e => setManualImageUrl(e.target.value)}
                      placeholder="https://example.com/filter-image.jpg"
                      className="flex-1 text-xs p-2 border border-[#E2DFDF] bg-white rounded font-mono shadow-2xs focus:outline-none focus:border-sky-500 border-l-[3px]"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addManualImageUrl();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={addManualImageUrl}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-[#111C30] text-white text-[11px] font-black rounded uppercase tracking-wider font-sans whitespace-nowrap cursor-pointer"
                    >
                      Add URL
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-400 font-medium font-sans">Paste link and click "Add URL" to append to the product gallery.</p>
                </div>
              </div>

              {/* External Product Web URL / Link */}
              <div>
                <label className="block text-gray-755 font-extrabold text-xs uppercase mb-1 flex items-center space-x-1">
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                  <span>External Product / Catalog Web Link (Optional)</span>
                </label>
                <input 
                  type="url"
                  value={productUrl}
                  onChange={e => setProductUrl(e.target.value)}
                  placeholder="https://sakurafilter.com/catalog/spec/C-6204"
                  className="w-full text-xs p-2.5 border border-[#E2DFDF] bg-white rounded font-mono shadow-2xs focus:outline-none focus:border-sky-500 border-l-[3px]"
                />
                <p className="text-[10px] text-gray-400 mt-1 font-sans">Direct link to product description page or supplier spec sheets.</p>
              </div>
            </div>
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
              className="px-6 py-2 bg-[#0EA5E9] text-white hover:bg-sky-600 text-xs font-bold uppercase rounded shadow-sm"
            >
              Save Product Updates
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
