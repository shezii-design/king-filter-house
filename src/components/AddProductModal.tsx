import React, { useState, useEffect } from 'react';
import { db, normalizeCode, ensureHttpsUrl } from '../data';
import { Product } from '../types';
import { AlertTriangle, Info, Check, Upload, Link, Image as ImageIcon, Trash2, Globe } from 'lucide-react';

interface AddProductModalProps {
  userRole: 'Owner' | 'Staff';
  onClose: () => void;
  onSave: (newProduct: Product) => void;
}

export default function AddProductModal({ userRole, onClose, onSave }: AddProductModalProps) {
  const [step, setStep] = useState(1);
  const [existingProducts, setExistingProducts] = useState<Product[]>([]);
  
  // Validation error state
  const [errorText, setErrorText] = useState<string | null>(null);

  // Form Fields - Step 1: Basic Info
  const [partNumber, setPartNumber] = useState('');
  const [brand, setBrand] = useState('Sakura');
  const [category, setCategory] = useState('Oil Filter');
  const [subtype, setSubtype] = useState('C');
  const [packSize, setPackSize] = useState('');
  const [grade, setGrade] = useState('standard');
  const [shelfLocation, setShelfLocation] = useState('');

  // Form Fields - Step 2: Specs
  const [threadSize, setThreadSize] = useState('');
  const [heightMm, setHeightMm] = useState<string>('');
  const [odMm, setOdMm] = useState<string>('');
  const [lengthInch, setLengthInch] = useState<string>('');
  const [widthInch, setWidthInch] = useState<string>('');
  const [innerDiameterInch, setInnerDiameterInch] = useState<string>('');
  const [gasketOdMm, setGasketOdMm] = useState<string>('');
  const [gasketIdMm, setGasketIdMm] = useState<string>('');
  const [smartSizeInput, setSmartSizeInput] = useState<string>('');

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

  const [micronRating, setMicronRating] = useState<string>('');
  const [cabinFilter, setCabinFilter] = useState('No');
  const [supplierCode, setSupplierCode] = useState('');
  const [notes, setNotes] = useState('');

  // Form Fields - Step 3: Stock & Pricing
  const [salePrice, setSalePrice] = useState<string>('');
  const [costPrice, setCostPrice] = useState<string>('');
  const [openingStock, setOpeningStock] = useState<string>('0');
  const [minStockAlert, setMinStockAlert] = useState<string>('5');

  // Form Fields - Optional references / media
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [manualImageUrl, setManualImageUrl] = useState('');
  const [productUrl, setProductUrl] = useState('');
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
    setExistingProducts(db.getProducts());
  }, []);

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

  // Update subtypes when category changes
  useEffect(() => {
    if (category === 'Oil Filter') setSubtype('C');
    else if (category === 'Fuel Filter') setSubtype('FC');
    else if (category === 'Hydraulic Filter') setSubtype('HC');
    else if (category === 'Air Filter') setSubtype('A');
  }, [category]);

  const isFilterCategory = ['Oil Filter', 'Fuel Filter', 'Hydraulic Filter', 'Air Filter'].includes(category);
  const isOilCategory = ['Engine Oil', 'Hydraulic Oil', 'Gear Oil', 'Coolant', 'Grease'].includes(category);

  // Validations per step
  const handleNext = () => {
    setErrorText(null);

    if (step === 1) {
      if (!partNumber.trim()) {
        setErrorText("Part number is required.");
        return;
      }
      
      const norm = normalizeCode(partNumber);
      const duplicate = existingProducts.find(p => p.part_number_norm === norm);
      if (duplicate) {
        setErrorText(`Duplicate code detected: Normalized part number "${norm}" already exists as filter "${duplicate.brand} ${duplicate.part_number}" located on "${duplicate.shelf_location || 'unassigned shelf'}".`);
        return;
      }

      if (!brand.trim()) {
        setErrorText("Brand is required.");
        return;
      }

      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handlePrev = () => {
    setErrorText(null);
    setStep(prev => prev - 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);

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

    if (parsedCost > parsedSale && userRole === 'Owner') {
      if (!window.confirm("Warning: cost price is higher than sale price. Save anyway?")) {
        return;
      }
    }

    const parsedStock = parseInt(openingStock, 10);
    if (isNaN(parsedStock) || parsedStock < 0) {
      setErrorText("Opening stock cannot be a negative value.");
      return;
    }

    const parsedMinStock = parseInt(minStockAlert, 10);
    if (isNaN(parsedMinStock) || parsedMinStock < 0) {
      setErrorText("Minimum stock alert level cannot be a negative value.");
      return;
    }

    // Prepare Base Object
    const norm = normalizeCode(partNumber);
    const newId = "prod-" + Date.now();
    
    // Simulate transactional structure
    try {
      const newProduct: Product = {
        id: newId,
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
        cost_price: userRole === 'Owner' ? parsedCost : Math.round(parsedSale * 0.8), // default helper cost if staff
        stock_qty: parsedStock,
        damaged_qty: 0,
        min_stock_alert: parsedMinStock,
        image_url: imageUrls[0] ? ensureHttpsUrl(imageUrls[0]) : undefined,
        image_urls: imageUrls.map(u => ensureHttpsUrl(u)).filter(Boolean),
        product_url: productUrl.trim() ? ensureHttpsUrl(productUrl.trim()) : undefined,
        is_active: true,
        created_at: new Date().toISOString()
      };

      // Call parent submit
      onSave(newProduct);
    } catch (err: any) {
      setErrorText("Database Transaction Failed: " + err.message);
    }
  };

  // Live profit margin calculation for Step 3
  const liveMargin = () => {
    const sale = parseFloat(salePrice);
    const cost = parseFloat(costPrice);
    if (!isNaN(sale) && !isNaN(cost) && sale > 0) {
      const margin = ((sale - cost) / sale) * 100;
      return margin.toFixed(1);
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in" id="add-product-modal-backdrop">
      <div className="bg-white w-full max-w-[560px] mx-4 border-t-4 border-t-[#0EA5E9] flex flex-col max-h-[90vh] shadow-2xl" id="add-product-modal">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E2DFDF] flex items-center justify-between">
          <div>
            <h3 className="text-sm uppercase tracking-wider font-bold text-[#2A2727]">New Catalog Product</h3>
            <p className="text-[11px] text-gray-500">Faisalabad Sakura & Local Shop ERP</p>
          </div>
          <div className="flex items-center space-x-1">
            <span className={`text-xs px-2 py-0.5 font-bold ${step === 1 ? 'bg-[#0EA5E9] text-white' : 'bg-gray-100 text-gray-500'}`}>1</span>
            <span className="text-xs text-gray-300">/</span>
            <span className={`text-xs px-2 py-0.5 font-bold ${step === 2 ? 'bg-[#0EA5E9] text-white' : 'bg-gray-100 text-gray-500'}`}>2</span>
            <span className="text-xs text-gray-300">/</span>
            <span className={`text-xs px-2 py-0.5 font-bold ${step === 3 ? 'bg-[#0EA5E9] text-white' : 'bg-gray-100 text-gray-500'}`}>3</span>
          </div>
        </div>

        {/* Core content scrolling boundary */}
        <div className="p-5 overflow-y-auto flex-1 text-xs space-y-4">
          {errorText && (
            <div className="bg-sky-50 text-sky-700 p-3 border border-sky-200 flex items-start space-x-2 font-medium" id="modal-error-block">
              <AlertTriangle className="w-4 h-4 mr-1 flex-shrink-0 mt-0.5" />
              <span>{errorText}</span>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3" id="step1-container">
              <p className="font-bold text-[#2A2727] border-b border-[#F5F4F4] pb-1">STEP 1: Primary Brand & Code Identification</p>
              
              <div>
                <label className="block text-gray-600 font-semibold mb-1">Part Number (e.g., C-6204, 1R-0739) <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={partNumber}
                  onChange={e => setPartNumber(e.target.value)}
                  placeholder="Enter part reference"
                  autoFocus
                  required
                  className="w-full text-xs p-2 border border-[#E2DFDF] focus:border-[#0EA5E9] focus:outline-none"
                  id="field-part-number"
                />
                <p className="text-[10px] text-gray-400 mt-1">Normalized live to: {normalizeCode(partNumber) || 'None'}</p>
              </div>

              <div>
                <label className="block text-gray-600 font-semibold mb-1">Brand Name <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                  list="brands-datalist"
                  required
                  placeholder="e.g. Sakura, Local, Fleetguard"
                  className="w-full text-xs p-2 border border-[#E2DFDF] focus:border-[#0EA5E9] focus:outline-none"
                  id="field-brand"
                />
                <datalist id="brands-datalist">
                  <option value="Sakura" />
                  <option value="Local" />
                  <option value="Total" />
                  <option value="Mobil" />
                  <option value="Caltex" />
                  <option value="Fleetguard" />
                  <option value="Baldwin" />
                  <option value="Donaldson" />
                  <option value="Mann" />
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 font-semibold mb-1">Product Category <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    list="categories-list"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full text-xs p-2 border border-[#E2DFDF] bg-white focus:outline-none placeholder-gray-400 font-mono"
                    placeholder="Enter/select category..."
                    id="field-category"
                    required
                  />
                  <datalist id="categories-list">
                    {dynamicCategories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                {isFilterCategory ? (
                  <div>
                    <label className="block text-gray-600 font-semibold mb-1">Sub-type Code</label>
                    <select
                      value={subtype}
                      onChange={e => setSubtype(e.target.value)}
                      className="w-full text-xs p-2 border border-[#E2DFDF] bg-white focus:outline-none"
                      id="field-subtype"
                    >
                      {category === 'Oil Filter' && (
                        <>
                          <option value="C">C (Spin-on Oil)</option>
                          <option value="O">O (Cartridge Oil)</option>
                          <option value="EO">EO (Elephant Oil)</option>
                        </>
                      )}
                      {category === 'Fuel Filter' && (
                        <>
                          <option value="FC">FC (Spin-on Fuel)</option>
                          <option value="F">F (Cartridge Fuel)</option>
                          <option value="EF">EF (Elephant Fuel)</option>
                        </>
                      )}
                      {category === 'Hydraulic Filter' && (
                        <>
                          <option value="HC">HC (Hydraulic Cartridge)</option>
                          <option value="H">H (Hydraulic Return)</option>
                          <option value="EH">EH (Elec/Heavy Hydraulic)</option>
                        </>
                      )}
                      {category === 'Air Filter' && (
                        <>
                          <option value="A">A (Main Air Element)</option>
                          <option value="AH">AH (Inner/Safety Element)</option>
                          <option value="AC">AC (Cabin Air filter)</option>
                        </>
                      )}
                    </select>
                  </div>
                ) : isOilCategory ? (
                  <div>
                    <label className="block text-gray-600 font-semibold mb-1">Pack Size (e.g. 4L can, 20L drum)</label>
                    <input 
                      type="text" 
                      value={packSize}
                      onChange={e => setPackSize(e.target.value)}
                      placeholder="e.g. 4L can"
                      className="w-full text-xs p-2 border border-[#E2DFDF] focus:border-[#0EA5E9] focus:outline-none"
                      id="field-pack-size"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-gray-400 font-semibold mb-1 cursor-not-allowed">Sub-type / Pack size</label>
                    <input 
                      type="text" 
                      disabled
                      placeholder="Not applicable for category" 
                      className="w-full text-xs p-2 border border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 font-semibold mb-1">Grade Level</label>
                  <select
                    value={grade}
                    onChange={e => setGrade(e.target.value)}
                    className="w-full text-xs p-2 border border-[#E2DFDF] bg-white focus:outline-none"
                    id="field-grade"
                  >
                    {['standard', 'SP', 'normal', 'high_temp', 'A', 'B', 'C'].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-600 font-semibold mb-1">Shelf Location Warehouse</label>
                  <input 
                    type="text" 
                    value={shelfLocation}
                    onChange={e => setShelfLocation(e.target.value)}
                    placeholder="e.g. Row 2-A"
                    className="w-full text-xs p-2 border border-[#E2DFDF] focus:border-[#0EA5E9] focus:outline-none"
                    id="field-shelf"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3" id="step2-container">
              <p className="font-bold text-[#2A2727] border-b border-[#F5F4F4] pb-1">STEP 2: Detailed Technical Specifications</p>
              
              {isFilterCategory ? (
                <div className="space-y-3" id="filters-spec-box">
                  
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
                      Typing <span className="font-mono font-black text-slate-900">4x4x2</span> saves numbers separately: Length (<span className="font-bold">4"</span>), Width/OD (<span className="font-bold font-mono">4"</span>), Inner Dia (<span className="font-bold font-mono">2"</span>) and auto-calculates millimeters (mm).
                    </p>
                  </div>

                  {/* Saved separate dimensions (Inches) */}
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-650 text-[11px] font-bold mb-1">Screw Thread Size</label>
                      <input 
                        type="text" 
                        value={threadSize}
                        onChange={e => setThreadSize(e.target.value)}
                        placeholder="e.g. 3/4-16, M20x1.5"
                        className="w-full text-xs p-2 border border-[#E2DFDF] rounded font-mono"
                        id="field-thread"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-600 font-semibold mb-1">Supplier (Optional)</label>
                      <select 
                        value={supplierCode}
                        onChange={e => setSupplierCode(e.target.value)}
                        className="w-full text-xs p-2 border border-[#E2DFDF] bg-white rounded font-sans cursor-pointer focus:ring-1 focus:ring-sky-450 focus:outline-none"
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

                  {category === 'Air Filter' && (
                    <div className="mt-3">
                      <label className="block text-[#0EA5E9] font-bold text-[11px] uppercase mb-1">Is Cabin Air Filter?</label>
                      <select
                        value={cabinFilter}
                        onChange={e => setCabinFilter(e.target.value)}
                        className="w-full text-xs p-2 border border-[#E2DFDF] bg-white rounded focus:outline-none"
                      >
                        <option value="No">No (Normal Engine Air Filter)</option>
                        <option value="Yes">Yes (Cabin AC Filter)</option>
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 p-3 border border-gray-100 text-gray-500 rounded flex items-center space-x-2">
                  <Info className="w-4 h-4 text-blue-600" />
                  <span>Technical dimensions (thread size, inches dimensions) apply exclusively to air, fuel, oil, and hydraulic filters. Click next.</span>
                </div>
              )}

              {/* Optional Gasket Dimensions */}
              <div className="bg-amber-50/40 p-3 border border-amber-200/50 rounded-md space-y-2">
                <span className="text-xs uppercase tracking-wider font-extrabold text-amber-800 flex items-center gap-1.5 font-sans">
                  ⭕ Gasket Dimensions (Optional)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-700 font-bold mb-1 uppercase tracking-wider">Gasket Outer Dia (mm)</label>
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
                    <label className="block text-[10px] text-gray-700 font-bold mb-1 uppercase tracking-wider">Gasket Inner Dia (mm)</label>
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
                <label className="block text-gray-600 font-semibold mb-1">Internal Notes (Shelf remarks, sub-fits)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Additional fit notes or local procurement records for this brand variant..."
                  className="w-full text-xs p-2 border border-[#E2DFDF] focus:outline-none"
                  id="field-notes"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3" id="step3-container">
              <p className="font-bold text-[#2A2727] border-b border-[#F5F4F4] pb-1">STEP 3: Commercial Rates & Launch Stock</p>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 font-semibold mb-1">Sale Retail Price (Rs.) <span className="text-red-500">*</span></label>
                  <input 
                    type="number" 
                    value={salePrice}
                    onChange={e => setSalePrice(e.target.value)}
                    placeholder="Rupees e.g. 1500"
                    required
                    className="w-full text-xs p-2 border border-[#E2DFDF] focus:outline-none font-mono font-bold text-[#0EA5E9]"
                    id="field-sale-price"
                  />
                </div>

                <div>
                  <label className="block text-gray-600 font-semibold mb-1">Cost Purchase Price (Rs.) <span className="text-red-500">*</span></label>
                  {userRole === 'Owner' ? (
                    <div>
                      <input 
                        type="number" 
                        value={costPrice}
                        onChange={e => setCostPrice(e.target.value)}
                        placeholder="Confidential cost"
                        required
                        className="w-full text-xs p-2 border border-[#E2DFDF] text-emerald-800 font-mono font-bold"
                        id="field-cost-price"
                      />
                      {liveMargin() && (
                        <p className="text-[10px] text-emerald-700 font-bold mt-1">Live Profit Margin: {liveMargin()}%</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <input 
                        type="text" 
                        value="•••• ENCRYPTED ••••" 
                        disabled 
                        className="w-full text-xs p-2 border border-gray-200 bg-gray-50 text-gray-400 font-bold font-mono cursor-not-allowed"
                      />
                      <p className="text-[9px] text-amber-600 mt-1">Pricing privileges disabled for Staff. Auto-mapped based on typical markup.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#2A2727] font-semibold mb-1">Opening Physical Sellables</label>
                  <input 
                    type="number" 
                    value={openingStock}
                    onChange={e => setOpeningStock(e.target.value)}
                    className="w-full text-xs p-2 border border-[#E2DFDF]"
                    id="field-opening-stock"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">Logs automatic `opening_stock` entry</p>
                </div>

                <div>
                  <label className="block text-[#2A2727] font-semibold mb-1">Low Stock Warning Point</label>
                  <input 
                    type="number" 
                    value={minStockAlert}
                    onChange={e => setMinStockAlert(e.target.value)}
                    className="w-full text-xs p-2 border border-[#E2DFDF]"
                    id="field-min-stock"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">Low-level badge pops at or below this value</p>
                </div>
              </div>

              {/* Optional References & Media Section */}
              <div className="border border-slate-200 rounded-md p-3.5 bg-slate-50/50 space-y-4">
                <span className="text-xs uppercase tracking-wider font-extrabold text-slate-500 block border-b pb-1.5 font-sans">🖼️ Optional References & Media Cataloging</span>
                
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
                    className={`relative border-2 border-dashed rounded-lg p-4 transition-colors flex flex-col items-center justify-center cursor-pointer ${
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

                  {/* Dynamic Gallery of Attached Images */}
                  {imageUrls.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 bg-white p-2 border border-slate-200 rounded-md">
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
                  <label className="block text-gray-750 font-extrabold text-xs uppercase mb-1 flex items-center space-x-1 font-sans">
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
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3.5 bg-gray-50 border-t border-[#E2DFDF] flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-[#E2DFDF] text-gray-600 hover:bg-gray-100 font-medium cursor-pointer"
          >
            Cancel
          </button>
          
          <div className="flex space-x-2">
            {step > 1 && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3 py-1.5 bg-[#2A2727] text-white hover:bg-[#3d3a3a] font-medium"
              >
                Previous Step
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-1.5 bg-[#0EA5E9] text-white font-bold hover:bg-sky-600"
                id="btn-next-step"
              >
                Next Step
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="px-4 py-1.5 bg-[#0EA5E9] text-white font-bold hover:bg-sky-600 flex items-center space-x-1"
                id="btn-save-product"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Registry</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
