import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Product } from '../types';
import { db, normalizeCode, ensureHttpsUrl } from '../data';
import { 
  Download, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Globe, 
  FileJson, 
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface BulkImportExportModalProps {
  products: Product[]; // Currently active products
  userRole: string;
  onClose: () => void;
  onImport: (imported: Product[], mode: 'merge' | 'skip' | 'overwrite') => void;
}

interface ParsedRecord {
  index: number;
  data: Partial<Product>;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  willOverwrite: boolean;
}

export default function BulkImportExportModal({ products, userRole, onClose, onImport }: BulkImportExportModalProps) {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [dragActive, setDragActive] = useState(false);
  const [inputText, setInputText] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'skip' | 'overwrite'>('merge'); 
  // 'merge' = add stock to existing & update specs, 'skip' = ignore if SKU matches, 'overwrite' = replace pricing & specs completely
  
  const [parsedRecords, setParsedRecords] = useState<ParsedRecord[]>([]);
  const [parseSummary, setParseSummary] = useState<{
    total: number;
    valid: number;
    invalid: number;
    overwrites: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper: Try to parse CSV in a robust formatted structure
  const robustParseCSV = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [];
    let currentField = '';
    let insideQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];
      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentField += '"';
          i++; // Skip escape char
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        row.push(currentField.trim());
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        row.push(currentField.trim());
        if (row.some(c => c !== '') || row.length > 1) {
          lines.push(row);
        }
        row = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
    if (currentField || row.length > 0) {
      row.push(currentField.trim());
      lines.push(row);
    }
    return lines;
  };

  // Convert raw CSV grids to structured records
  const processRawData = (textStr: string) => {
    if (!textStr.trim()) {
      alert("Please provide valid content first!");
      return;
    }

    let recordsToProcess: any[] = [];
    const normalizedExisting = products.map(p => normalizeCode(p.part_number));

    // Determine if JSON or CSV
    if (textStr.trim().startsWith('[') || textStr.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(textStr.trim());
        recordsToProcess = Array.isArray(parsed) ? parsed : [parsed];
      } catch (e: any) {
        alert("Failed to parse JSON text content: " + e.message);
        return;
      }
    } else {
      // Parse as CSV
      const rows = robustParseCSV(textStr.trim());
      if (rows.length < 2) {
        alert("Empty or missing CSV structure! The first line must represent column headers.");
        return;
      }

      const rawHeaders = rows[0].map(h => h.toLowerCase().trim().replace(/[-_\s]/g, ''));
      const dataRows = rows.slice(1);

      // Map standard fields based on header similarity with numeric cleaning
      recordsToProcess = dataRows.map(row => {
        const item: any = {};
        
        const cleanStr = (raw: any): string => {
          if (raw === null || raw === undefined) return '';
          return raw.toString().trim();
        };

        const cleanNum = (raw: any): number => {
          if (raw === null || raw === undefined) return NaN;
          if (typeof raw === 'number') return raw;
          const cleaned = raw.toString().replace(/[^0-9.-]/g, ''); // keeps digits, decimals, minuses
          const parsed = parseFloat(cleaned);
          return isNaN(parsed) ? NaN : parsed;
        };

        const cleanInt = (raw: any): number => {
          if (raw === null || raw === undefined) return NaN;
          if (typeof raw === 'number') return Math.floor(raw);
          const cleaned = raw.toString().replace(/[^0-9-]/g, ''); // keeps digits, minuses
          const parsed = parseInt(cleaned, 10);
          return isNaN(parsed) ? NaN : parsed;
        };

        rawHeaders.forEach((header, idx) => {
          const val = row[idx];
          
          if (header === 'partnumber' || header === 'partno' || header === 'sku' || header === 'code' || header === 'part') {
            item.part_number = cleanStr(val);
          } else if (header === 'brand' || header === 'manufacturer' || header === 'make') {
            item.brand = cleanStr(val);
          } else if (header === 'category' || header === 'categories' || header === 'catagory' || header === 'catogary' || header === 'catogaries' || header === 'type') {
            item.category = cleanStr(val);
          } else if (header === 'shelflocation' || header === 'location' || header === 'rack' || header === 'shelf') {
            item.shelf_location = cleanStr(val);
          } else if (header === 'saleprice' || header === 'price' || header === 'retail' || header === 'sell' || header === 'sellprice' || header === 'pricing') {
            item.sale_price = cleanNum(val);
          } else if (header === 'costprice' || header === 'cost' || header === 'purchase' || header === 'buy' || header === 'buyprice') {
            item.cost_price = cleanNum(val);
          } else if (header === 'stockqty' || header === 'qty' || header === 'stock' || header === 'quantity' || header === 'onhand' || header === 'count') {
            item.stock_qty = cleanInt(val);
          } else if (header === 'minstockalert' || header === 'alert' || header === 'minstock' || header === 'min' || header === 'reorder') {
            item.min_stock_alert = cleanInt(val);
          } else if (header === 'threadsize' || header === 'thread') {
            item.thread_size = cleanStr(val);
          } else if (header === 'subtype' || header === 'sub') {
            item.subtype = cleanStr(val);
          } else if (header === 'micronrating' || header === 'micron') {
            item.micron_rating = cleanInt(val);
          } else if (header === 'notes' || header === 'desc' || header === 'description' || header === 'remarks') {
            item.notes = cleanStr(val);
          } else if (header === 'packsize' || header === 'pack') {
            item.pack_size = cleanStr(val);
          } else if (header === 'suppliercode' || header === 'suppcode' || header === 'supplier') {
            item.supplier_code = cleanStr(val);
          } else if (header === 'producturl' || header === 'link' || header === 'url') {
            item.product_url = cleanStr(val);
          } else if (header === 'imageurl' || header === 'image' || header === 'picture' || header === 'photo' || header === 'productimage' || header === 'image_url' || header === 'product_image') {
            item.image_url = cleanStr(val);
          } else if (header === 'imageurls' || header === 'images' || header === 'pictures' || header === 'photos' || header === 'productimages' || header === 'image_urls' || header === 'product_images') {
            item.image_urls = cleanStr(val);
          } else if (header === 'grade') {
            item.grade = cleanStr(val);
          } else if (header === 'heightmm' || header === 'height') {
            item.height_mm = cleanNum(val);
          } else if (header === 'odmm' || header === 'od' || header === 'outerdiameter') {
            item.od_mm = cleanNum(val);
          } else if (header === 'lengthinch' || header === 'length') {
            item.length_inch = cleanNum(val);
          } else if (header === 'widthinch' || header === 'width') {
            item.width_inch = cleanNum(val);
          } else if (header === 'innerdiameterinch' || header === 'innerdiameter' || header === 'id') {
            item.inner_diameter_inch = cleanNum(val);
          } else if (header === 'gasketodmm' || header === 'gasketod' || header === 'gasket_od_mm' || header === 'gasket_od' || header === 'outergasket') {
            item.gasket_od_mm = cleanNum(val);
          } else if (header === 'gasketidmm' || header === 'gasketid' || header === 'gasket_id_mm' || header === 'gasket_id' || header === 'innergasket') {
            item.gasket_id_mm = cleanNum(val);
          } else if (header === 'cabinfilter' || header === 'cabin') {
            item.cabin_filter = cleanStr(val);
          } else if (header === 'crossreferences' || header === 'crossreference' || header === 'crossrefs' || header === 'links' || header === 'reference' || header === 'cross_references') {
            item.cross_references = cleanStr(val);
          }
        });
        return item;
      });
    }

    // Process and validate all products
    const evaluated: ParsedRecord[] = recordsToProcess.map((item, index) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const data: Partial<Product> = {};

      // Required checks
      const part_number = (item.part_number || item.partNo || '').toString().trim();
      if (!part_number) {
        errors.push("Missing core part_number identifier");
      }

      data.part_number = part_number;
      data.part_number_norm = normalizeCode(part_number);
      data.brand = (item.brand || 'Generic').toString().trim();
      
      // Category verification
      let category = (item.category || '').toString().trim();
      if (!category) {
        category = 'Other';
      } else {
        // Capitalize words for nice displaying if desired, or keep as is
        category = category.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
      data.category = category;

      data.shelf_location = (item.shelf_location || item.location || 'Row A-1').toString().trim();
      data.thread_size = (item.thread_size || item.thread || '').toString().trim();
      data.subtype = (item.subtype || '').toString().trim();
      data.pack_size = (item.pack_size || '').toString().trim();
      data.grade = (item.grade || 'standard').toString().trim();
      
      // Dimensions and other detailed specifications
      const height = parseFloat(item.height_mm);
      data.height_mm = isNaN(height) ? null : height;

      const od = parseFloat(item.od_mm);
      data.od_mm = isNaN(od) ? null : od;

      const len_inch = parseFloat(item.length_inch);
      data.length_inch = isNaN(len_inch) ? null : len_inch;

      const wid_inch = parseFloat(item.width_inch);
      data.width_inch = isNaN(wid_inch) ? null : wid_inch;

      const id_inch = parseFloat(item.inner_diameter_inch);
      data.inner_diameter_inch = isNaN(id_inch) ? null : id_inch;

      const gasket_od = parseFloat(item.gasket_od_mm);
      data.gasket_od_mm = isNaN(gasket_od) ? null : gasket_od;

      const gasket_id = parseFloat(item.gasket_id_mm);
      data.gasket_id_mm = isNaN(gasket_id) ? null : gasket_id;

      const micron = parseInt(item.micron_rating, 10);
      data.micron_rating = isNaN(micron) ? null : micron;

      data.cabin_filter = (item.cabin_filter || 'No').toString().trim();
      data.notes = (item.notes || '').toString().trim();
      data.supplier_code = (item.supplier_code || '').toString().trim();
      data.product_url = ensureHttpsUrl((item.product_url || '').toString().trim());
      data.image_url = ensureHttpsUrl((item.image_url || '').toString().trim());

      // Handle multiple image URLs parsed from string or array
      let img_urls: string[] = [];
      if (Array.isArray(item.image_urls)) {
        img_urls = item.image_urls.map(u => ensureHttpsUrl(u)).filter(Boolean);
      } else {
        const image_urls_str = (item.image_urls || '').toString().trim();
        img_urls = image_urls_str ? image_urls_str.split(';').map((s: string) => ensureHttpsUrl(s.trim())).filter(Boolean) : [];
      }
      
      if (img_urls.length === 0 && data.image_url) {
        img_urls = [data.image_url];
      } else if (img_urls.length > 0 && !data.image_url) {
        data.image_url = img_urls[0];
      }
      data.image_urls = img_urls;

      // Handle crossreferences from string or array
      let cross_refs_str = '';
      if (Array.isArray(item.cross_references)) {
        cross_refs_str = item.cross_references.join(';');
      } else {
        cross_refs_str = (item.cross_references || '').toString().trim();
      }
      data.cross_references = cross_refs_str;

      const cleanNumStrOrVal = (raw: any): number => {
        if (raw === null || raw === undefined) return NaN;
        if (typeof raw === 'number') return raw;
        const cleaned = raw.toString().replace(/[^0-9.-]/g, ''); // keeps digits, decimals, minuses
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? NaN : parsed;
      };

      const cleanIntStrOrVal = (raw: any): number => {
        if (raw === null || raw === undefined) return NaN;
        if (typeof raw === 'number') return Math.floor(raw);
        const cleaned = raw.toString().replace(/[^0-9-]/g, ''); // keeps digits, minuses
        const parsed = parseInt(cleaned, 10);
        return isNaN(parsed) ? NaN : parsed;
      };

      // Pricing conversions
      const sale = cleanNumStrOrVal(item.sale_price);
      data.sale_price = isNaN(sale) || sale < 0 ? 0 : sale;
      if (isNaN(sale)) {
        warnings.push("Sale price was missing or non-numerical; defaulted to 0");
      }

      const cost = cleanNumStrOrVal(item.cost_price);
      data.cost_price = isNaN(cost) || cost < 0 ? 0 : cost;
      if (isNaN(cost)) {
        warnings.push("Cost price was missing or non-numerical; defaulted to 0");
      }

      const stock = cleanIntStrOrVal(item.stock_qty);
      data.stock_qty = isNaN(stock) || stock < 0 ? 0 : stock;
      if (isNaN(stock)) {
        warnings.push("Starting Stock count missing; defaulted to 0");
      }

      const alertVal = cleanIntStrOrVal(item.min_stock_alert);
      data.min_stock_alert = isNaN(alertVal) || alertVal < 0 ? 5 : alertVal;

      data.damaged_qty = 0;
      data.is_active = true;
      data.created_at = new Date().toISOString();

      // Check for sku duplicate collision inside King Filter House collection
      const isExisting = part_number ? normalizedExisting.includes(data.part_number_norm) : false;

      return {
        index,
        data,
        isValid: errors.length === 0,
        errors,
        warnings,
        willOverwrite: isExisting
      };
    });

    const total = evaluated.length;
    const valid = evaluated.filter(r => r.isValid).length;
    const invalid = total - valid;
    const overwrites = evaluated.filter(r => r.isValid && r.willOverwrite).length;

    setParsedRecords(evaluated);
    setParseSummary({ total, valid, invalid, overwrites });
  };

  // Drag and Drop support
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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) {
            alert("The selected Excel file is empty or has no worksheets!");
            return;
          }
          const csvText = XLSX.utils.sheet_to_csv(worksheet);
          setInputText(csvText);
          processRawData(csvText);
        } catch (err: any) {
          alert("Failed to parse Excel file: " + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setInputText(text);
        processRawData(text);
      };
      reader.readAsText(file);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Final Action: Commit Import
  const handleCommitImport = () => {
    if (!parseSummary || parseSummary.valid === 0) {
      alert("No valid items parsed to write to database!");
      return;
    }

    const validNewProducts = parsedRecords
      .filter(r => r.isValid)
      .map(r => r.data as Product);

    if (confirm(`Write ${validNewProducts.length} items to database? Mode chosen: ${
      importMode === 'merge' ? 'Update stocks/details on matches' : 
      importMode === 'skip' ? 'Skip existing matches' : 'Replace existing matches completely'
    }`)) {
      onImport(validNewProducts, importMode);
    }
  };

  // Helper template CSV generator
  const downloadCSVSample = () => {
    const headers = [
      'part_number', 'brand', 'category', 'subtype', 'pack_size', 'grade',
      'shelf_location', 'thread_size', 'length_inch',
      'width_inch', 'inner_diameter_inch', 'gasket_od_mm', 'gasket_id_mm', 'cabin_filter',
      'supplier_code', 'notes', 'sale_price', 'cost_price', 'stock_qty',
      'min_stock_alert', 'image_url', 'image_urls', 'product_url', 'cross_references'
    ];
    const sampleRow = [
      'C-1011', 'Sakura', 'Oil Filter', 'C', '', 'standard',
      'Rack 4-C', '3/4-16 UNF', '3.3', '2.7', '1.2', '72.5', '62.0', 'No',
      'SAK-C1011', 'Compatible with Suzuki models', '1650', '1350', '35',
      '5', 'https://example.com/c1011.jpg', 'https://example.com/c1011.jpg;https://example.com/c1011-back.jpg', 'https://example.com/item/c1011', 'C-6204:exact_match;ext:Baldwin:B2-C:compatible'
    ];

    const formattedRow = sampleRow.map(cell => {
      if (cell === undefined || cell === null) return '""';
      return `"${cell.replace(/"/g, '""')}"`;
    });

    const fileContent = [
      headers.map(h => `"${h}"`).join(","),
      formattedRow.join(",")
    ].join("\n");

    const blob = new Blob([fileContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "kfh_product_import_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export full/filtered items
  const downloadClientCatalog = (format: 'json' | 'csv') => {
    if (products.length === 0) {
      alert("No active catalog entries available for download.");
      return;
    }

    let fileContent = "";
    let mimeType = "";
    let filename = "";

    if (format === 'json') {
      fileContent = JSON.stringify(products, null, 2);
      mimeType = "application/json";
      filename = `kfh_catalog_export_${new Date().toISOString().split('T')[0]}.json`;
    } else {
      // Export as CSV
      const headers = [
        'part_number', 'brand', 'category', 'subtype', 'pack_size', 'grade',
        'shelf_location', 'thread_size', 'length_inch',
        'width_inch', 'inner_diameter_inch', 'gasket_od_mm', 'gasket_id_mm', 'cabin_filter',
        'supplier_code', 'notes', 'sale_price', 'cost_price', 'stock_qty',
        'min_stock_alert', 'image_url', 'image_urls', 'product_url', 'cross_references'
      ];
      
      const allCrossRefs = db.getCrossRefs();

      const rows = products.map(p => {
        // Query bi-directional or uni-directional links where this is product_1
        const refs = allCrossRefs.filter(r => r.product_id_1 === p.id && r.is_active);
        const serializedRefs = refs.map(r => {
          if (r.product_id_2) {
            const targetProd = db.getProducts().find(prod => prod.id === r.product_id_2);
            if (targetProd) {
              const base = `${targetProd.part_number}:${r.match_type}`;
              return r.custom_text ? `${base}:${r.custom_text}` : base;
            }
            return '';
          } else if (r.external_part_number) {
            const base = `ext:${r.external_brand || 'Other'}:${r.external_part_number}:${r.match_type}`;
            return r.custom_text ? `${base}:${r.custom_text}` : base;
          }
          return '';
        }).filter(Boolean).join(';');

        const formatCell = (val: any) => {
          if (val === null || val === undefined) return '""';
          return `"${val.toString().replace(/"/g, '""')}"`;
        };

        return [
          formatCell(p.part_number),
          formatCell(p.brand),
          formatCell(p.category),
          formatCell(p.subtype),
          formatCell(p.pack_size),
          formatCell(p.grade),
          formatCell(p.shelf_location),
          formatCell(p.thread_size),
          p.length_inch !== null && p.length_inch !== undefined ? p.length_inch : '',
          p.width_inch !== null && p.width_inch !== undefined ? p.width_inch : '',
          p.inner_diameter_inch !== null && p.inner_diameter_inch !== undefined ? p.inner_diameter_inch : '',
          p.gasket_od_mm !== null && p.gasket_od_mm !== undefined ? p.gasket_od_mm : '',
          p.gasket_id_mm !== null && p.gasket_id_mm !== undefined ? p.gasket_id_mm : '',
          formatCell(p.cabin_filter),
          formatCell(p.supplier_code),
          formatCell(p.notes),
          p.sale_price,
          p.cost_price,
          p.stock_qty,
          p.min_stock_alert,
          formatCell(p.image_url),
          formatCell((p.image_urls || []).join(';')),
          formatCell(p.product_url),
          formatCell(serializedRefs)
        ].join(",");
      });

      fileContent = [headers.map(h => `"${h}"`).join(","), ...rows].join("\n");
      mimeType = "text/csv;charset=utf-8;";
      filename = `kfh_catalog_export_${new Date().toISOString().split('T')[0]}.csv`;
    }

    const blob = new Blob([fileContent], { type: mimeType });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-sans" id="bulk-excel-io-modal">
      <div className="bg-white w-full max-w-[850px] max-h-[92vh] flex flex-col border-t-4 border-t-[#0EA5E9] shadow-2xl rounded-sm overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#111C30] text-white p-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-sm font-black uppercase tracking-wider flex items-center space-x-1.5 font-mono">
              <Sparkles className="w-4 h-4 text-[#0EA5E9]" />
              <span>Bulk Data Control Panel</span>
            </h2>
            <p className="text-[10px] text-slate-400 font-medium">Sync, import or download entire industrial catalog registries securely.</p>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-slate-450 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Row Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 select-none">
          <button
            onClick={() => setActiveTab('import')}
            className={`py-3.5 px-5 text-xs font-extrabold uppercase tracking-widest border-b-2 -mb-[1px] flex items-center space-x-2 ${
              activeTab === 'import'
                ? 'border-[#0EA5E9] text-[#0EA5E9] font-black'
                : 'border-transparent text-slate-500 hover:text-slate-905 hover:bg-slate-100'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Sync Tool</span>
          </button>
          
          <button
            onClick={() => setActiveTab('export')}
            className={`py-3.5 px-5 text-xs font-extrabold uppercase tracking-widest border-b-2 -mb-[1px] flex items-center space-x-2 ${
              activeTab === 'export'
                ? 'border-[#0EA5E9] text-[#0EA5E9] font-black'
                : 'border-transparent text-slate-500 hover:text-slate-905 hover:bg-slate-100'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export & Download</span>
          </button>
        </div>

        {/* Content Pane */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {activeTab === 'import' ? (
            <div className="space-y-4">
              
              {/* Introduction bar */}
              <div className="flex flex-col md:flex-row justify-between gap-3 bg-slate-50 border border-slate-200 p-3 items-start md:items-center rounded-sm">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-800 uppercase block">CSV / XLSX / JSON Column Mapping Standard</span>
                  <p className="text-[10px] text-slate-500 max-w-xl">
                    Import supports Excel files (.xlsx, .xls), CSV grids, or JSON arrays. Headers mapped dynamically based on parameters like: <code className="bg-slate-200 px-1 font-bold text-slate-900 rounded-xs">part_number</code>, <code className="bg-slate-200 px-1 font-bold text-slate-905">brand</code>, <code className="bg-slate-200 px-1 font-bold text-slate-905">category</code>, <code className="bg-slate-200 px-1 font-bold text-slate-905">gasket_od_mm</code>, <code className="bg-slate-200 px-1 font-bold text-slate-905">gasket_id_mm</code>, <code className="bg-slate-200 px-1 font-bold text-slate-905">sale_price</code>, <code className="bg-slate-200 px-1 font-bold text-slate-905">stock_qty</code>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadCSVSample}
                  className="text-[10px] bg-slate-800 hover:bg-[#111C30] text-white font-extrabold py-2 px-3 rounded uppercase tracking-wider whitespace-nowrap inline-flex items-center space-x-1"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Download Sample CSV
                </button>
              </div>

              {/* Special interactive guide for CSV product-linking and external cross-references */}
              <div className="bg-[#FAF9F6] border-l-4 border-l-[#0EA5E9] border border-slate-200 p-3.5 rounded shadow-xs text-xs space-y-2">
                <div className="flex items-center space-x-1.5 text-slate-900 font-extrabold uppercase tracking-wide text-[11px]">
                  <span>🔗 AUTOMATED CROSS-REFERENCE LINKING GUIDE (via "cross_references" column)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] text-slate-700 leading-relaxed pt-1">
                  <div className="bg-white p-2.5 rounded border border-slate-205 space-y-1">
                    <span className="font-extrabold text-blue-800 uppercase text-[9.5px] block">1. Linking Existing Products We Sell</span>
                    <p className="text-slate-500">To form bi-directional links (cross-references) between products defined in your catalog, write their exact part numbers separated by semicolons as <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold text-slate-800">PART_NUMBER:TYPE:LABEL</code>.</p>
                    <p className="text-slate-500 text-[10px]">Add optional labels like <strong className="text-emerald-700 font-bold">Outer</strong>, <strong className="text-amber-700 font-bold">Set</strong>, or <strong className="text-slate-700 font-bold">Other</strong> at the end:</p>
                    <p className="font-mono text-[10px] text-rose-800 mt-1.5 bg-slate-50 p-1 rounded font-bold">
                      Format: <span className="text-slate-750 font-normal">C-6204:exact_match:Outer;C-1815:compatible:Set</span>
                    </p>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-slate-205 space-y-1">
                    <span className="font-extrabold text-[#0EA5E9] uppercase text-[9.5px] block">2. Referencing Unsold / Out-of-Stock Products</span>
                    <p className="text-slate-500">To list cross-references for OEM/competitor products we <span className="underline font-semibold">do not sell or carry in stock</span>, prefix with <code className="bg-sky-50 text-sky-700 px-1 py-0.5 rounded font-mono font-bold">ext:</code> as <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold text-slate-800">ext:BRAND:PART_NUMBER:TYPE:LABEL</code>.</p>
                    <p className="text-slate-500 text-[10px]">Add optional labels like <strong className="text-emerald-700 font-bold">Outer</strong>, <strong className="text-amber-700 font-bold">Set</strong>, or <strong className="text-slate-700 font-bold">Other</strong> at the end:</p>
                    <p className="font-mono text-[10px] text-rose-800 mt-1.5 bg-slate-50 p-1 rounded font-bold">
                      Format: <span className="text-slate-750 font-normal">ext:Baldwin:B2-C:compatible:Outer;ext:Donaldson:P550388:exact_match:Set</span>
                    </p>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-mono italic">
                  * Note: Allowed match type values are either <code className="font-bold font-sans not-italic text-slate-600 bg-slate-100 px-1 rounded">exact_match</code> or <code className="font-bold font-sans not-italic text-slate-600 bg-slate-100 px-1 rounded">compatible</code>. Labels like "Outer", "Set", or "Other" are optional and can be appended as a 3rd parameter (or 4th for external). Separate multiple references using a semicolon (;) symbol.
                </div>
              </div>

              {/* Drag/Drop and Paste zone split */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* File Dropzone */}
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all ${
                    dragActive 
                      ? 'border-sky-500 border-l-[3px] bg-sky-50/15' 
                      : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50/90'
                  }`}
                  onClick={triggerFileSelect}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".csv, .json, .xlsx, .xls, text/csv, application/json, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    className="hidden" 
                  />
                  <Upload className="w-8 h-8 text-slate-450 mb-2.5" />
                  <span className="text-xs font-bold text-slate-850">Drag & Drop Catalog File Here</span>
                  <span className="text-[10.5px] text-blue-600 hover:underline mt-1 font-bold">or Browse files on system</span>
                  <span className="text-[9px] text-gray-400 mt-2">Allows Excel (.xlsx, .xls), .csv, or .json files up to 5MB</span>
                </div>

                {/* Paste Area */}
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-400 uppercase mb-1">Directly Paste CSV/JSON rows:</span>
                  <textarea
                    value={inputText}
                    onChange={e => {
                      setInputText(e.target.value);
                      if (e.target.value.trim().length > 10) {
                        processRawData(e.target.value);
                      }
                    }}
                    placeholder="part_number,brand,category,sale_price,cost_price,stock_qty&#10;C-6204,Sakura,Oil Filter,1450,1180,45&#10;C-1815,Sakura,Oil Filter,560,420,12"
                    className="w-full flex-1 min-h-[120px] p-2.5 border border-slate-3.5 rounded font-mono text-[11px] bg-slate-50 focus:bg-white focus:border-sky-500 border-l-[3px] focus:outline-none focus:ring-0 leading-normal"
                  />
                </div>
              </div>

              {/* Import Deduplication Configurations */}
              <div className="bg-slate-50 p-3.5 border rounded border-slate-200">
                <span className="text-[10.5px] font-extrabold text-slate-850 uppercase tracking-wide block mb-2">📦 SKU / Product Matching Collision Control</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-1">
                  {[
                    {
                      id: 'merge',
                      title: 'Append Quantities',
                      desc: 'Adds stocks together + updates shelf locations/notes of existing items.',
                    },
                    {
                      id: 'overwrite',
                      title: 'Replace Attributes',
                      desc: 'Replaces pricing, specs & attributes of existing records on SKU match.',
                    },
                    {
                      id: 'skip',
                      title: 'Skip Matches',
                      desc: 'Ignores duplicates entirely. Imports only brand-new part numbers.',
                    }
                  ].map(mode => (
                    <label 
                      key={mode.id} 
                      className={`block p-2.5 border rounded cursor-pointer transition-all ${
                        importMode === mode.id 
                          ? 'border-red-650 bg-sky-50/15 text-slate-905 ring-2 ring-sky-400/10' 
                          : 'border-slate-250 bg-white hover:border-slate-350'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <input 
                          type="radio" 
                          name="importModeRadio"
                          checked={importMode === mode.id}
                          onChange={() => setImportMode(mode.id as any)}
                          className="text-[#0ea5e9] focus:ring-sky-400" 
                        />
                        <span className="text-xs font-bold tracking-tight">{mode.title}</span>
                      </div>
                      <span className="text-[10px] text-gray-500 block mt-1 leading-normal pl-5">{mode.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Validation Summary Reports preview */}
              {parseSummary && (
                <div className="space-y-3 font-sans" id="parsed-records-preview">
                  
                  {/* Summary bar */}
                  <div className="grid grid-cols-4 gap-2.5">
                    <div className="p-3 bg-slate-50 border rounded text-center">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Parsed Rows</span>
                      <p className="text-lg font-black font-mono mt-0.5 text-slate-800">{parseSummary.total}</p>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-150 rounded text-center">
                      <span className="text-[10px] uppercase font-bold text-emerald-800">Valid</span>
                      <p className="text-lg font-black font-mono mt-0.5 text-emerald-700">{parseSummary.valid}</p>
                    </div>
                    <div className="p-3 bg-rose-50 border border-rose-150 rounded text-center">
                      <span className="text-[10px] uppercase font-bold text-red-500">Invalid SKU</span>
                      <p className={`text-lg font-black font-mono mt-0.5 ${parseSummary.invalid > 0 ? 'text-sky-600' : 'text-slate-400'}`}>{parseSummary.invalid}</p>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-150 rounded text-center">
                      <span className="text-[10px] uppercase font-bold text-amber-800">SKU Collisions</span>
                      <p className="text-lg font-black font-mono mt-0.5 text-amber-700">{parseSummary.overwrites}</p>
                    </div>
                  </div>

                  {/* Dry preview table */}
                  <div className="space-y-1.5">
                    <span className="text-[10.5px] font-extrabold uppercase text-slate-500 tracking-wider">📋 Dry-Run Simulation Logs ({parsedRecords.length} Products Loaded)</span>
                    <div className="border rounded overflow-hidden max-h-80 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                            <th className="p-2 w-12 text-center">Row</th>
                            <th className="p-2">Part Number</th>
                            <th className="p-2">Brand</th>
                            <th className="p-2">Category</th>
                            <th className="p-2 text-right">Price</th>
                            <th className="p-2 text-right">Stock</th>
                            <th className="p-2 text-center">Collision?</th>
                            <th className="p-2">Message</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {parsedRecords.map((rec, i) => {
                            const isNew = !rec.willOverwrite;
                            return (
                              <tr key={i} className={`hover:bg-slate-50/50 ${!rec.isValid ? 'bg-sky-50/20' : ''}`}>
                                <td className="p-2 text-center text-gray-400 font-mono">#{i + 1}</td>
                                <td className="p-2 font-bold font-mono text-slate-800">{rec.data.part_number || <span className="text-red-500 italic">[Empty]</span>}</td>
                                <td className="p-2 text-slate-600">{rec.data.brand}</td>
                                <td className="p-2 text-slate-500">{rec.data.category}</td>
                                <td className="p-2 text-right font-mono text-slate-700">Rs. {rec.data.sale_price}</td>
                                <td className="p-2 text-right font-mono text-slate-700 font-semibold">{rec.data.stock_qty} pcs</td>
                                <td className="p-2 text-center">
                                  {rec.isValid ? (
                                    rec.willOverwrite ? (
                                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-850 font-bold text-[9px] rounded-xs uppercase tracking-wide">
                                        Match {importMode === 'skip' ? 'Skip' : importMode === 'merge' ? 'Merge' : 'Overwrite'}
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 bg-green-100 text-green-800 font-bold text-[9px] rounded-xs uppercase tracking-wide">
                                        New Record
                                      </span>
                                    )
                                  ) : (
                                    <span className="px-1.5 py-0.5 bg-sky-100 text-sky-700 font-bold text-[9px] rounded-xs uppercase tracking-wide">
                                      Skip (Error)
                                    </span>
                                  )}
                                </td>
                                <td className="p-2 max-w-[200px] truncate">
                                  {rec.errors.length > 0 && (
                                    <span className="text-sky-600 flex items-center text-[10px] font-bold">
                                      <AlertTriangle className="w-3.5 h-3.5 mr-1 text-red-500" />
                                      {rec.errors.join(', ')}
                                    </span>
                                  )}
                                  {rec.errors.length === 0 && rec.warnings.length > 0 && (
                                    <span className="text-amber-700 flex items-center text-[10px]">
                                      <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-500" />
                                      {rec.warnings.join(', ')}
                                    </span>
                                  )}
                                  {rec.errors.length === 0 && rec.warnings.length === 0 && (
                                    <span className="text-emerald-700 flex items-center text-[10px]">
                                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                                      Validated OK
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {parsedRecords.length > 15 && (
                      <p className="text-[10px] text-slate-400 font-medium text-right font-mono">... and {parsedRecords.length - 15} other parsed rows omitted from raw preview list.</p>
                    )}
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="space-y-4">
              
              <div className="p-3.5 bg-[#0EA5E9]/5 border border-[#0EA5E9]/10 rounded text-slate-800 leading-relaxed font-medium text-xs">
                🎨 Bulk catalogs downloads represent active non-deleted database rows. Utilize this to keep offline backups or transfer files back and forth to spreadsheets like Google Sheets or Microsoft Excel.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Option 2: JSON file format */}
                <div className="border border-slate-200 bg-white p-5 rounded hover:border-[#0EA5E9]/40 transition-colors space-y-3.5 text-center flex flex-col justify-between">
                  <div className="space-y-1 mt-1">
                    <FileJson className="w-10 h-10 text-[#0EA5E9] mx-auto opacity-80" />
                    <h3 className="font-bold text-slate-900 text-sm">Download JSON catalog</h3>
                    <p className="text-[11px] text-gray-500 leading-normal max-w-xs mx-auto">
                      Best for developers or full ERP replication backup files. Includes sub-specs and complex arrays like image referencing list.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadClientCatalog('json')}
                    className="w-full py-2.5 bg-[#2A2727] hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded cursor-pointer"
                  >
                    Download and Save JSON ({products.length} products)
                  </button>
                </div>

                {/* Option 1: Microsoft Excel CSV */}
                <div className="border border-slate-200 bg-white p-5 rounded hover:border-[#0EA5E9]/40 transition-colors space-y-3.5 text-center flex flex-col justify-between">
                  <div className="space-y-1 mt-1">
                    <FileText className="w-10 h-10 text-emerald-600 mx-auto opacity-80" />
                    <h3 className="font-bold text-slate-900 text-sm">Download Excel CSV</h3>
                    <p className="text-[11px] text-gray-500 leading-normal max-w-xs mx-auto">
                      Best format for editing inside Microsoft Excel or Google Sheets. Columns match the sync structure perfectly!
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadClientCatalog('csv')}
                    className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider rounded cursor-pointer animate-pulse-slow"
                  >
                    Download Excel CSV ({products.length} products)
                  </button>
                </div>

              </div>
              
              <div className="border-t border-slate-100 pt-3">
                <p className="text-[10px] text-gray-400 font-medium text-center">Catalog serialization encodes Rs. Pricing metrics as flat numerical decimals compatible with external systems.</p>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 font-sans flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-medium font-mono">
            King Filter House Database Sync Controller v2.6.4
          </div>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs uppercase rounded cursor-pointer"
            >
              Cancel
            </button>
            {activeTab === 'import' && parseSummary && parseSummary.valid > 0 && (
              <button
                type="button"
                onClick={handleCommitImport}
                className="px-4 py-2 bg-[#0EA5E9] hover:bg-sky-600 text-white font-extrabold text-xs uppercase tracking-wide rounded shadow-md cursor-pointer flex items-center space-x-1"
              >
                <span>Commit Sync Data</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
