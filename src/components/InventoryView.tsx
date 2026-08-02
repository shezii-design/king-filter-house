import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, normalizeCode, encodeCipher, ensureHttpsUrl } from '../data';
import { Product, CrossReference, StockMovement } from '../types';
import { 
  Search, 
  Plus, 
  Filter, 
  Info, 
  Link2, 
  AlertTriangle, 
  Check, 
  TrendingUp, 
  BookOpen, 
  Settings, 
  Clock, 
  PenTool, 
  Edit3,
  Trash2,
  Image as ImageIcon,
  Globe,
  Download,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  X,
  LayoutGrid,
  Droplet,
  Archive,
  Scale,
  Table
} from 'lucide-react';
import AddProductModal from './AddProductModal';
import EditProductModal from './EditProductModal';
import CrossRefModal from './CrossRefModal';
import BulkImportExportModal from './BulkImportExportModal';
import BulkEditModal from './BulkEditModal';
import SizeMatcherModal from './SizeMatcherModal';
import CellGridInventoryView from './CellGridInventoryView';

interface InventoryViewProps {
  userRole: 'Owner' | 'Staff';
  cipherKey: string;
  triggerRefreshStamp: number; // to sync with invoice stock changes
  revealRealValues?: boolean;
}

export default function InventoryView({ userRole, cipherKey, triggerRefreshStamp, revealRealValues = false }: InventoryViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [crossRefs, setCrossRefs] = useState<CrossReference[]>([]);
  
  // Image Hover & Click overlays
  const [hoveredImageId, setHoveredImageId] = useState<string | null>(null);
  const [previewImageId, setPreviewImageId] = useState<string | null>(null);
  const [activeImageIndices, setActiveImageIndices] = useState<{[key: string]: number}>({});
  const [lightboxProduct, setLightboxProduct] = useState<Product | null>(null);
  const [lightboxImageIndex, setLightboxImageIndex] = useState<number>(0);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const listPaneRef = React.useRef<HTMLDivElement>(null);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [activeTab, setActiveTab] = useState<'all' | 'filters' | 'oils' | 'other' | 'low_stock'>(() => {
    return (localStorage.getItem('kfh_active_inventory_tab') as any) || 'all';
  });

  // Selection
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'details' | 'cross_refs' | 'stock' | 'pricing'>('details');

  // Modals Toggles
  const [showAddModal, setShowAddModal] = useState(() => {
    const trigger = localStorage.getItem('kfh_open_add_product_modal') === 'true';
    if (trigger) {
      localStorage.removeItem('kfh_open_add_product_modal');
    }
    return trigger;
  });
  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  
  // Quick Edit Modals on Detailed Pane
  const [showStockAdjustModal, setShowStockAdjustModal] = useState(false);
  const [newStockVal, setNewStockVal] = useState<string>('');
  const [stockAdjustReason, setStockAdjustReason] = useState('Counter check');

  const [showDamageModal, setShowDamageModal] = useState(false);
  const [damageQtyVal, setDamageQtyVal] = useState<string>('1');
  const [damageReason, setDamageReason] = useState('Spilled/Dropped package');

  const [showPricingEditModal, setShowPricingEditModal] = useState(false);
  const [editSalePrice, setEditSalePrice] = useState<string>('');
  const [editCostPrice, setEditCostPrice] = useState<string>('');

  // Bulk selection and actions state managers
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showSizeMatcher, setShowSizeMatcher] = useState(false);
  const [inventoryDisplayMode, setInventoryDisplayMode] = useState<'cards' | 'cell_grid'>('cards');

  const reloadData = () => {
    setProducts(db.getProducts());
    setCrossRefs(db.getCrossRefs());
  };

  useEffect(() => {
    reloadData();
    
    const targetId = localStorage.getItem('kfh_selected_product_id');
    if (targetId) {
      setSelectedProductId(targetId);
      setActiveTab('all');
      setSearchQuery('');
      setCategoryFilter('All');
      localStorage.removeItem('kfh_selected_product_id');
    }
  }, [triggerRefreshStamp]);

  // Track last selected product to restore scroll position when details pane is closed
  const lastSelectedProductIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (selectedProductId) {
      lastSelectedProductIdRef.current = selectedProductId;
    }
  }, [selectedProductId]);

  // Autoscroll to the selected product when it changes, or scroll back to it when closed
  useEffect(() => {
    if (selectedProductId) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`product-card-${selectedProductId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 350);
      return () => clearTimeout(timer);
    } else if (lastSelectedProductIdRef.current) {
      const targetId = lastSelectedProductIdRef.current;
      // Small timeout to allow the transition/layout change to complete
      const timer = setTimeout(() => {
        const element = document.getElementById(`product-card-${targetId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedProductId]);

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Dynamically compute list of unique categories from the database to support custom uploaded ones
  const dynamicCategories = React.useMemo(() => {
    // Extract unique active categories from active products
    const existing = products
      .map(p => p.category)
      .filter((cat): cat is string => typeof cat === 'string' && cat.trim() !== '');

    const uniqueExisting = Array.from(new Set(existing)) as string[];
    if (uniqueExisting.length > 0) {
      return uniqueExisting.sort((a, b) => a.localeCompare(b));
    }

    // Fallback defaults if the database currently has no products
    const defaults = [
      'Oil Filter', 'Fuel Filter', 'Hydraulic Filter', 'Air Filter',
      'Engine Oil', 'Hydraulic Oil', 'Gear Oil', 'Coolant', 'Grease',
      'Tool/Opener', 'Accessory', 'Other'
    ];
    return defaults.sort((a, b) => a.localeCompare(b));
  }, [products]);

  // Tab counts
  const lowStockCount = useMemo(
    () => products.filter(p => (p.stock_qty || 0) <= (p.min_stock_alert || 0)).length,
    [products]
  );
  
  const filtersCount = React.useMemo(() => {
    return products.filter(p => {
      const cat = (p.category || '').toLowerCase();
      return ['oil filter', 'fuel filter', 'hydraulic filter', 'air filter', 'filter', 'filtr', 'separator', 'seperator'].some(term => cat.includes(term));
    }).length;
  }, [products]);

  const oilsCount = React.useMemo(() => {
    return products.filter(p => {
      const cat = (p.category || '').toLowerCase();
      if (cat.includes('filter') || cat.includes('filtr') || cat.includes('separator') || cat.includes('seperator')) return false;
      return ['oil', 'grease', 'coolant', 'fluid', 'lubricant'].some(term => cat.includes(term));
    }).length;
  }, [products]);

  const othersCount = React.useMemo(() => {
    return products.filter(p => {
      const cat = (p.category || '').toLowerCase();
      const isFilter = ['oil filter', 'fuel filter', 'hydraulic filter', 'air filter', 'filter', 'filtr', 'separator', 'seperator'].some(term => cat.includes(term));
      const isOil = !isFilter && ['oil', 'grease', 'coolant', 'fluid', 'lubricant'].some(term => cat.includes(term));
      return !isFilter && !isOil;
    }).length;
  }, [products]);

  const allCount = products.length;

  

  const processedItems = useMemo(() => {
    let list = [...products];

    if (activeTab === 'filters') {
      list = list.filter(p => {
        const cat = (p.category || '').toLowerCase();
        return ['oil filter', 'fuel filter', 'hydraulic filter', 'air filter', 'filter', 'filtr', 'separator', 'seperator'].some(term => cat.includes(term));
      });
    } else if (activeTab === 'oils') {
      list = list.filter(p => {
        const cat = (p.category || '').toLowerCase();
        if (cat.includes('filter') || cat.includes('filtr') || cat.includes('separator') || cat.includes('seperator')) return false;
        return ['oil', 'grease', 'coolant', 'fluid', 'lubricant'].some(term => cat.includes(term));
      });
    } else if (activeTab === 'other') {
      list = list.filter(p => {
        const cat = (p.category || '').toLowerCase();
        const isFilter = ['oil filter', 'fuel filter', 'hydraulic filter', 'air filter', 'filter', 'filtr', 'separator', 'seperator'].some(term => cat.includes(term));
        const isOil = !isFilter && ['oil', 'grease', 'coolant', 'fluid', 'lubricant'].some(term => cat.includes(term));
        return !isFilter && !isOil;
      });
    } else if (activeTab === 'low_stock') {
      list = list.filter(p => (p.stock_qty || 0) <= (p.min_stock_alert || 0));
    }

    if (categoryFilter !== 'All') {
      list = list.filter(p => (p.category || '').toLowerCase() === categoryFilter.toLowerCase());
    }

    if (!searchQuery.trim()) {
      return list.map(p => ({ product: p, rank: 0, matchedBadge: '', viaCode: '' }))
                 .sort((a, b) => a.product.part_number.normalize().localeCompare(b.product.part_number.normalize()));
    }

    const sizeMatch3 = searchQuery.match(/^\s*([0-9.]+)\s*[xX*\/,-]\s*([0-9.]+)\s*[xX*\/,-]\s*([0-9.]+)\s*$/);
    const sizeMatch2 = !sizeMatch3 ? searchQuery.match(/^\s*([0-9.]+)\s*[xX*\/,-]\s*([0-9.]+)\s*$/) : null;

    if (sizeMatch3) {
      const targetL = parseFloat(sizeMatch3[1]);
      const targetW = parseFloat(sizeMatch3[2]);
      const targetID = parseFloat(sizeMatch3[3]);
      const sizeMatchedList = list.map(p => {
        if (!p.length_inch || !p.width_inch || !p.inner_diameter_inch) return { product: p, rank: 99, matchedBadge: '', viaCode: '', dist: 999 };
        const diffL = Math.abs(p.length_inch - targetL);
        const diffW = Math.abs(p.width_inch - targetW);
        const diffID = Math.abs(p.inner_diameter_inch - targetID);
        if (diffL <= 1.0 && diffW <= 0.8 && diffID <= 0.6) {
          const totalDiff = diffL + diffW + diffID;
          const closeness = totalDiff < 0.25 ? 'Near exact' : totalDiff > 1.0 ? 'Approx' : 'Good fit';
          const rank = totalDiff < 0.3 ? 1 : totalDiff < 0.75 ? 2 : 3;
          return { product: p, rank, matchedBadge: `📐 Size Match (${closeness})`, viaCode: `${p.length_inch}"x${p.width_inch}"x${p.inner_diameter_inch}"`, dist: totalDiff };
        }
        return { product: p, rank: 99, matchedBadge: '', viaCode: '', dist: 999 };
      }).filter(item => item.rank < 99);
      return sizeMatchedList.sort((a, b) => a.rank !== b.rank ? a.rank - b.rank : a.dist - b.dist);
    }

    if (sizeMatch2) {
      const targetL = parseFloat(sizeMatch2[1]);
      const targetW = parseFloat(sizeMatch2[2]);
      const sizeMatchedList = list.map(p => {
        if (!p.length_inch || !p.width_inch) return { product: p, rank: 99, matchedBadge: '', viaCode: '', dist: 999 };
        const diffL = Math.abs(p.length_inch - targetL);
        const diffW = Math.abs(p.width_inch - targetW);
        if (diffL <= 1.0 && diffW <= 0.8) {
          const totalDiff = diffL + diffW;
          const closeness = totalDiff < 0.25 ? 'Near exact' : totalDiff > 1.0 ? 'Approx' : 'Good fit';
          const rank = totalDiff < 0.3 ? 1 : totalDiff < 0.75 ? 2 : 3;
          return { product: p, rank, matchedBadge: `📐 Size Match (${closeness})`, viaCode: `${p.length_inch}"x${p.width_inch}"`, dist: totalDiff };
        }
        return { product: p, rank: 99, matchedBadge: '', viaCode: '', dist: 999 };
      }).filter(item => item.rank < 99);
      return sizeMatchedList.sort((a, b) => a.rank !== b.rank ? a.rank - b.rank : a.dist - b.dist);
    }

    const qNorm = normalizeCode(searchQuery);
    const searchTerms = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);

    const rankedList = list.map(p => {
      let rank = 99;
      let matchedBadge = '';
      let viaCode = '';
      const pNorm = p.part_number_norm || normalizeCode(p.part_number || '');

      if (pNorm === qNorm) {
        rank = p.stock_qty > 0 ? 1 : 5;
        matchedBadge = 'Direct Match';
      } else if (pNorm.includes(qNorm)) {
        rank = p.stock_qty > 0 ? 2 : 5;
        matchedBadge = 'Direct Partial';
      } else {
        const links = crossRefs.filter(ref => ref.product_id_1 === p.id || ref.product_id_2 === p.id);
        let foundCrossRef = false;
        for (const link of links) {
          if (link.product_id_2 === null && link.external_part_number) {
            const extNorm = normalizeCode(link.external_part_number);
            if (extNorm === qNorm || extNorm.includes(qNorm)) {
              viaCode = `${link.external_part_number} (${link.external_brand || 'External'})`;
              rank = p.stock_qty > 0 ? (link.match_type === 'exact_match' ? 3 : 4) : 5;
              matchedBadge = link.match_type === 'exact_match' ? 'Exact Cross-Ref' : 'Compatible Cross-Ref';
              foundCrossRef = true;
              break;
            }
          } else {
            const otherId = link.product_id_1 === p.id ? link.product_id_2 : link.product_id_1;
            const otherProd = products.find(op => op.id === otherId);
            if (otherProd) {
              const otherNorm = otherProd.part_number_norm || normalizeCode(otherProd.part_number || '');
              if (otherNorm === qNorm || otherNorm.includes(qNorm)) {
                viaCode = otherProd.part_number;
                rank = p.stock_qty > 0 ? (link.match_type === 'exact_match' ? 3 : 4) : 5;
                matchedBadge = link.match_type === 'exact_match' ? 'Exact Cross-Ref' : 'Compatible Cross-Ref';
                foundCrossRef = true;
                break;
              }
            }
          }
        }

        if (!foundCrossRef && searchTerms.length > 0) {
          const fields = [p.brand, p.category, p.notes, p.shelf_location, p.supplier_code, p.part_number, p.grade, p.subtype]
            .map(f => (f || '').toLowerCase());
          const isMatch = searchTerms.every(term => fields.some(f => f.includes(term)));
          if (isMatch) {
            rank = p.stock_qty > 0 ? 6 : 8;
            matchedBadge = 'Text Match';
          }
        }
      }

      return { product: p, rank, matchedBadge, viaCode };
    }).filter(item => item.rank < 99);

    return rankedList.sort((a, b) => a.rank !== b.rank ? a.rank - b.rank : b.product.stock_qty - a.product.stock_qty);
  }, [products, crossRefs, searchQuery, categoryFilter, activeTab]);

  // Statistics summaries
  const totalShownQty = processedItems.length;
  const totalStockSaleValue = processedItems.reduce((acc, item) => {
    const sale = typeof item.product.sale_price === 'number' ? item.product.sale_price : Number(item.product.sale_price) || 0;
    const stock = typeof item.product.stock_qty === 'number' ? item.product.stock_qty : Number(item.product.stock_qty) || 0;
    return acc + (sale * stock);
  }, 0);
  const totalStockCostValue = processedItems.reduce((acc, item) => {
    const cost = typeof item.product.cost_price === 'number' ? item.product.cost_price : Number(item.product.cost_price) || 0;
    const stock = typeof item.product.stock_qty === 'number' ? item.product.stock_qty : Number(item.product.stock_qty) || 0;
    return acc + (cost * stock);
  }, 0);
  const lowLevelShownAlerts = processedItems.filter(item => {
    const stock = typeof item.product.stock_qty === 'number' ? item.product.stock_qty : Number(item.product.stock_qty) || 0;
    const minAlert = typeof item.product.min_stock_alert === 'number' ? item.product.min_stock_alert : Number(item.product.min_stock_alert) || 0;
    return stock <= minAlert;
  }).length;

  const handleSaveProduct = (newProduct: Product) => {
    const updatedList = db.getAllProductsWithDeleted();
    updatedList.push(newProduct);
    db.saveProducts(updatedList);
    
    // Auto-select and refresh
    setProducts(db.getProducts());
    setSelectedProductId(newProduct.id);
    setShowAddModal(false);
    
    // Log sync cue
    db.logPendingSync(`Added new brand product catalog registry: ${newProduct.part_number} (${newProduct.brand})`);
  };

  const handleEditProductSave = (updatedProduct: Product) => {
    const currentAll = db.getAllProductsWithDeleted();
    const idx = currentAll.findIndex(p => p.id === updatedProduct.id);
    if (idx >= 0) {
      currentAll[idx] = updatedProduct;
      db.saveProducts(currentAll);
      
      // Refresh
      reloadData();
      setShowEditDetailsModal(false);
      
      db.logPendingSync(`Updated product details for: ${updatedProduct.part_number} (${updatedProduct.brand})`);
    }
  };

  const handleBulkDelete = () => {
    if (selectedProductIds.length === 0) return;
    if (!confirm(`Are you sure you want to soft-delete ${selectedProductIds.length} selected products? This will preserve general ledger histories but remove items from active inventory.`)) {
      return;
    }
    
    const currentAll = db.getAllProductsWithDeleted();
    selectedProductIds.forEach(id => {
      const idx = currentAll.findIndex(p => p.id === id);
      if (idx >= 0) {
        currentAll[idx].is_active = false;
      }
    });
    
    db.saveProducts(currentAll);
    setSelectedProductIds([]);
    reloadData();
    db.logPendingSync(`Bulk soft-deleted ${selectedProductIds.length} catalog items`);
  };

  const handleBulkEditSave = (updates: Partial<Product>) => {
    const currentAll = db.getAllProductsWithDeleted();
    selectedProductIds.forEach(id => {
      const idx = currentAll.findIndex(p => p.id === id);
      if (idx >= 0) {
        currentAll[idx] = {
          ...currentAll[idx],
          ...updates
        };
      }
    });

    db.saveProducts(currentAll);
    setSelectedProductIds([]);
    setShowBulkEditModal(false);
    reloadData();
    db.logPendingSync(`Bulk updated attributes of ${selectedProductIds.length} items`);
  };

  const handleBulkImportSave = (importedList: Product[], mode: 'merge' | 'skip' | 'overwrite') => {
    const currentAll = db.getAllProductsWithDeleted();
    let addCount = 0;
    let updateCount = 0;
    let skipCount = 0;

    importedList.forEach(imp => {
      const existingIdx = currentAll.findIndex(p => p.part_number_norm === imp.part_number_norm);

      if (existingIdx >= 0) {
        if (mode === 'skip') {
          skipCount++;
          return;
        } else if (mode === 'merge') {
          // Add stocks together
          currentAll[existingIdx].stock_qty = (currentAll[existingIdx].stock_qty || 0) + (imp.stock_qty || 0);
          
          // Merge other non-empty fields
          if (imp.shelf_location) currentAll[existingIdx].shelf_location = imp.shelf_location;
          if (imp.thread_size) currentAll[existingIdx].thread_size = imp.thread_size;
          if (imp.notes) currentAll[existingIdx].notes = imp.notes;
          if (imp.category && imp.category !== 'Other') currentAll[existingIdx].category = imp.category;
          if (imp.sale_price > 0) currentAll[existingIdx].sale_price = imp.sale_price;
          if (userRole === 'Owner' && imp.cost_price > 0) currentAll[existingIdx].cost_price = imp.cost_price;
          
          if (imp.subtype) currentAll[existingIdx].subtype = imp.subtype;
          if (imp.pack_size) currentAll[existingIdx].pack_size = imp.pack_size;
          if (imp.grade) currentAll[existingIdx].grade = imp.grade;
          if (imp.height_mm !== null && imp.height_mm !== undefined) currentAll[existingIdx].height_mm = imp.height_mm;
          if (imp.od_mm !== null && imp.od_mm !== undefined) currentAll[existingIdx].od_mm = imp.od_mm;
          if (imp.length_inch !== null && imp.length_inch !== undefined) currentAll[existingIdx].length_inch = imp.length_inch;
          if (imp.width_inch !== null && imp.width_inch !== undefined) currentAll[existingIdx].width_inch = imp.width_inch;
          if (imp.inner_diameter_inch !== null && imp.inner_diameter_inch !== undefined) currentAll[existingIdx].inner_diameter_inch = imp.inner_diameter_inch;
          if (imp.gasket_od_mm !== null && imp.gasket_od_mm !== undefined) currentAll[existingIdx].gasket_od_mm = imp.gasket_od_mm;
          if (imp.gasket_id_mm !== null && imp.gasket_id_mm !== undefined) currentAll[existingIdx].gasket_id_mm = imp.gasket_id_mm;
          if (imp.micron_rating !== null && imp.micron_rating !== undefined) currentAll[existingIdx].micron_rating = imp.micron_rating;
          if (imp.cabin_filter) currentAll[existingIdx].cabin_filter = imp.cabin_filter;
          if (imp.supplier_code) currentAll[existingIdx].supplier_code = imp.supplier_code;
          if (imp.product_url) currentAll[existingIdx].product_url = imp.product_url;
          if (imp.image_url) currentAll[existingIdx].image_url = imp.image_url;
          if (imp.image_urls && imp.image_urls.length > 0) currentAll[existingIdx].image_urls = imp.image_urls;
          
          updateCount++;
        } else if (mode === 'overwrite') {
          // Replace matching properties
          currentAll[existingIdx] = {
            ...currentAll[existingIdx],
            ...imp,
            id: currentAll[existingIdx].id, // preserve ID
            is_active: true // ensure active
          };
          updateCount++;
        }
      } else {
        // Create as brand new item
        const brandNew: Product = {
          ...imp,
          id: "prod-" + Date.now() + "-" + Math.floor(Math.random() * 1000)
        };
        currentAll.push(brandNew);
        addCount++;
      }
    });

    // Handle Cross-Reference Linking after database entries are resolved
    const crossRefs = db.getCrossRefs();
    let linkCount = 0;

    const processImportedCrossRefs = (
      currentProduct: Product, 
      rawRefsStr: string, 
      allProducts: Product[], 
      existingCrossRefs: any[]
    ) => {
      if (!rawRefsStr) return;
      const parts = rawRefsStr.split(';').map(s => s.trim()).filter(Boolean);
      
      parts.forEach(part => {
        if (part.startsWith('ext:')) {
          const extParts = part.substring(4).split(':');
          const brand = extParts[0]?.trim() || 'Other';
          const partNum = extParts[1]?.trim() || '';
          const matchTypeRaw = extParts[2]?.trim().toLowerCase();
          const matchType: 'exact_match' | 'compatible' = matchTypeRaw === 'compatible' ? 'compatible' : 'exact_match';
          const customText = extParts[3]?.trim() || undefined;
          
          if (!partNum) return;
          
          const existingIdx = existingCrossRefs.findIndex(r => 
            r.product_id_1 === currentProduct.id && 
            r.product_id_2 === null && 
            r.external_part_number === partNum.toUpperCase() && 
            r.external_brand?.toLowerCase() === brand.toLowerCase() &&
            r.is_active
          );
          
          if (existingIdx === -1) {
            existingCrossRefs.push({
              id: "cref-" + Date.now() + "-" + Math.floor(Math.random() * 10000) + "-ext",
              product_id_1: currentProduct.id,
              product_id_2: null,
              external_part_number: partNum.toUpperCase(),
              external_brand: brand,
              match_type: matchType,
              source: "manual",
              discovered_invoice_id: null,
              is_active: true,
              created_at: new Date().toISOString(),
              custom_text: customText
            });
            linkCount++;
          } else if (customText) {
            existingCrossRefs[existingIdx].custom_text = customText;
          }
        } else {
          const subparts = part.split(':');
          const targetPartNum = subparts[0]?.trim();
          const matchTypeRaw = subparts[1]?.trim().toLowerCase();
          const matchType: 'exact_match' | 'compatible' = matchTypeRaw === 'compatible' ? 'compatible' : 'exact_match';
          const customText = subparts[2]?.trim() || undefined;
          
          if (!targetPartNum) return;
          
          const normTarget = normalizeCode(targetPartNum);
          const targetProd = allProducts.find(p => p.part_number_norm === normTarget);
          
          if (targetProd) {
            // Point 1 -> Point 2
            const idx1 = existingCrossRefs.findIndex(r => 
              r.product_id_1 === currentProduct.id && 
              r.product_id_2 === targetProd.id && 
              r.is_active
            );
            if (idx1 === -1 && currentProduct.id !== targetProd.id) {
              existingCrossRefs.push({
                id: "cref-" + Date.now() + "-" + Math.floor(Math.random() * 10000) + "-1",
                product_id_1: currentProduct.id,
                product_id_2: targetProd.id,
                match_type: matchType,
                source: "manual",
                discovered_invoice_id: null,
                is_active: true,
                created_at: new Date().toISOString(),
                custom_text: customText
              });
              linkCount++;
            } else if (idx1 !== -1 && customText) {
              existingCrossRefs[idx1].custom_text = customText;
            }
            
            // Point 2 -> Point 1
            const idx2 = existingCrossRefs.findIndex(r => 
              r.product_id_1 === targetProd.id && 
              r.product_id_2 === currentProduct.id && 
              r.is_active
            );
            if (idx2 === -1 && currentProduct.id !== targetProd.id) {
              existingCrossRefs.push({
                id: "cref-" + Date.now() + "-" + Math.floor(Math.random() * 10000) + "-2",
                product_id_1: targetProd.id,
                product_id_2: currentProduct.id,
                match_type: matchType,
                source: "manual",
                discovered_invoice_id: null,
                is_active: true,
                created_at: new Date().toISOString()
              });
              linkCount++;
            }
          } else {
            const idxFallback = existingCrossRefs.findIndex(r => 
              r.product_id_1 === currentProduct.id && 
              r.product_id_2 === null && 
              r.external_part_number === targetPartNum.toUpperCase() &&
              r.is_active
            );
            
            if (idxFallback === -1) {
              existingCrossRefs.push({
                id: "cref-" + Date.now() + "-" + Math.floor(Math.random() * 10000) + "-ext-fallback",
                product_id_1: currentProduct.id,
                product_id_2: null,
                external_part_number: targetPartNum.toUpperCase(),
                external_brand: "Other Brand",
                match_type: matchType,
                source: "manual",
                discovered_invoice_id: null,
                is_active: true,
                created_at: new Date().toISOString(),
                custom_text: customText
              });
              linkCount++;
            } else if (idxFallback !== -1 && customText) {
              existingCrossRefs[idxFallback].custom_text = customText;
            }
          }
        }
      });
    };

    importedList.forEach(imp => {
      const matchingProduct = currentAll.find(p => p.part_number_norm === imp.part_number_norm && p.is_active);
      if (matchingProduct && imp.cross_references) {
        processImportedCrossRefs(matchingProduct, imp.cross_references, currentAll, crossRefs);
      }
    });

    db.saveProducts(currentAll);
    if (linkCount > 0) {
      db.saveCrossRefs(crossRefs);
    }

    setShowBulkImportModal(false);
    setSelectedProductIds([]);
    reloadData();
    db.logPendingSync(`Bulk import complete. Synchronized: +${addCount} new records, updated: ${updateCount} matches, skipped: ${skipCount} duplicates. Linked: ${linkCount} cross-references.`);
  };

  // Stock Adjust Action
  const handleStockAdjustSave = () => {
    if (!selectedProduct) return;
    const parsedStock = parseInt(newStockVal, 10);
    if (isNaN(parsedStock) || parsedStock < 0) return;

    const currentAll = db.getAllProductsWithDeleted();
    const idx = currentAll.findIndex(p => p.id === selectedProduct.id);
    if (idx >= 0) {
      const oldQty = currentAll[idx].stock_qty;
      currentAll[idx].stock_qty = parsedStock;
      db.saveProducts(currentAll);

      db.saveMovement({
        product_id: selectedProduct.id,
        qty_change: parsedStock - oldQty,
        from_status: 'sellable',
        to_status: 'sellable',
        type: 'adjusted',
        user: userRole,
        reason: stockAdjustReason + ` (Quantity shifted ${oldQty} → ${parsedStock})`
      });

      reloadData();
      setShowStockAdjustModal(false);
    }
  };

  // Mark Damaged Action
  const handleMarkDamagedSave = () => {
    if (!selectedProduct) return;
    const damageQty = parseInt(damageQtyVal, 10);
    if (isNaN(damageQty) || damageQty <= 0 || damageQty > selectedProduct.stock_qty) {
      alert("Invalid damaged quantity or exceeds current stock levels!");
      return;
    }

    const currentAll = db.getAllProductsWithDeleted();
    const idx = currentAll.findIndex(p => p.id === selectedProduct.id);
    if (idx >= 0) {
      currentAll[idx].stock_qty -= damageQty;
      currentAll[idx].damaged_qty += damageQty;
      db.saveProducts(currentAll);

      db.saveMovement({
        product_id: selectedProduct.id,
        qty_change: -damageQty,
        from_status: 'sellable',
        to_status: 'damaged',
        type: 'damaged',
        user: userRole,
        reason: damageReason + ` (${damageQty} items reported fractured/broken)`
      });

      reloadData();
      setShowDamageModal(false);
    }
  };

  // Edit pricing Action
  const handlePricingSave = () => {
    if (!selectedProduct) return;
    const sale = parseFloat(editSalePrice);
    const cost = parseFloat(editCostPrice);

    if (isNaN(sale) || sale < 0) return;
    if (userRole === 'Owner' && (isNaN(cost) || cost < 0)) return;

    const currentAll = db.getAllProductsWithDeleted();
    const idx = currentAll.findIndex(p => p.id === selectedProduct.id);
    if (idx >= 0) {
      currentAll[idx].sale_price = sale;
      if (userRole === 'Owner') {
        currentAll[idx].cost_price = cost;
      }
      db.saveProducts(currentAll);

      db.logPendingSync(`Pricing structures updated for ${selectedProduct.part_number}: Sale Rs. ${sale}`);

      reloadData();
      setShowPricingEditModal(false);
    }
  };

  // Open Adjust dialogs prefilled
  const openAdjustModal = () => {
    if (!selectedProduct) return;
    setNewStockVal(selectedProduct.stock_qty.toString());
    setStockAdjustReason('Routine counter check');
    setShowStockAdjustModal(true);
  };

  const openDamageModal = () => {
    if (!selectedProduct) return;
    setDamageQtyVal('1');
    setDamageReason('Dropped shelf casing / leaking seal');
    setShowDamageModal(true);
  };

  const openPricingEditModal = () => {
    if (!selectedProduct) return;
    setEditSalePrice((selectedProduct.sale_price || 0).toString());
    setEditCostPrice((selectedProduct.cost_price || 0).toString());
    setShowPricingEditModal(true);
  };

  // Cross Reference linkage visual components
  const getProductCrossRefs = (prodId: string) => {
    const list = crossRefs.filter(ref => ref.product_id_1 === prodId || ref.product_id_2 === prodId);
    const uniqueRefs: { [key: string]: boolean } = {};
    
    return list.map(ref => {
      if (ref.product_id_2 === null) {
        return {
          refId: ref.id,
          isExternal: true,
          externalPartNumber: ref.external_part_number,
          externalBrand: ref.external_brand,
          matchType: ref.match_type,
          createdAt: ref.created_at,
          customText: ref.custom_text
        };
      }
      const otherId = ref.product_id_1 === prodId ? ref.product_id_2 : ref.product_id_1;
      const otherProd = products.find(p => p.id === otherId);
      
      // Look up custom_text specifically for looking from prodId -> otherId
      const directRef = crossRefs.find(r => r.product_id_1 === prodId && r.product_id_2 === otherId);
      const customText = directRef?.custom_text || ref.custom_text;

      return {
        refId: ref.id,
        isExternal: false,
        linkedProduct: otherProd,
        matchType: ref.match_type,
        createdAt: ref.created_at,
        customText: customText
      };
    }).filter(item => {
      if (item.isExternal) return true;
      if (!item.linkedProduct) return false;
      const key = item.linkedProduct.id;
      if (uniqueRefs[key]) return false;
      uniqueRefs[key] = true;
      return true;
    });
  };

  const handleUnlinkCrossRef = (refId: string) => {
    const updated = crossRefs.map(ref => {
      if (ref.id === refId) {
        return { ...ref, is_active: false };
      }
      return ref;
    });
    db.saveCrossRefs(updated);
    setCrossRefs(db.getCrossRefs());
    db.logPendingSync("Cross reference unlinked");
  };

  return (
    <div className="space-y-4" id="inventory-module">
      
      {/* Top action bar */}
      <div className="bg-white p-3.5 border border-[#E2DFDF] flex flex-col md:flex-row md:items-center justify-between gap-3" id="inventory-topbar-controls">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-[#0EA5E9]" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#2A2727]">Industrial Stock Book</h2>
        </div>
        
        <div className="flex flex-1 flex-wrap items-center gap-2 justify-end">
          {/* Query Field */}
          <div className="relative flex-1 max-w-[360px]" id="query-input-wrapper">
            <input 
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              placeholder="Search normalized number (e.g. C-6204)..."
              className="w-full text-xs p-2.5 pl-8 rounded border border-[#E2DFDF] bg-[#F9F9F9] focus:border-[#0EA5E9] focus:bg-white focus:outline-none placeholder-gray-400 font-mono"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-3.5" />
          </div>

          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="text-xs p-2.5 bg-white border border-[#E2DFDF] rounded focus:outline-none min-w-[160px]"
            id="category-dropdown-picker"
          >
            <option value="All">All Categories</option>
            {dynamicCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Add Product Button */}
          <button
            onClick={() => setShowAddModal(true)}
            id="add-product-btn"
            className="text-xs bg-[#0EA5E9] text-white py-2.5 px-4 rounded font-bold uppercase tracking-wider hover:bg-sky-600 transition-none flex items-center space-x-1 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>

          {/* Bulk Import/Export Button */}
          <button
            onClick={() => setShowBulkImportModal(true)}
            id="bulk-import-export-btn"
            className="text-xs bg-slate-800 hover:bg-[#111C30] text-white py-2.5 px-4 rounded font-bold uppercase tracking-wider transition-all flex items-center space-x-1 cursor-pointer border border-slate-700 shadow-xs"
          >
            <Settings className="w-3.5 h-3.5 mr-1 text-amber-400" />
            <span>Bulk I/O</span>
          </button>

          {/* 3D Size Matcher Button */}
          <button
            onClick={() => setShowSizeMatcher(true)}
            id="3d-size-matcher-btn"
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded font-bold uppercase tracking-wider transition-all flex items-center space-x-1 cursor-pointer shadow-xs border border-emerald-500"
          >
            <Scale className="w-3.5 h-3.5 mr-1 text-emerald-100 animate-pulse" />
            <span>3D Size Matcher</span>
          </button>

          {/* View Mode Toggle: Standard Cards vs Live Cell Grid */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded border border-[#E2DFDF]">
            <button
              onClick={() => setInventoryDisplayMode('cards')}
              className={`px-3 py-1.5 text-xs font-bold uppercase rounded flex items-center gap-1 cursor-pointer transition-all ${
                inventoryDisplayMode === 'cards'
                  ? 'bg-white text-slate-800 shadow-xs border border-slate-300 font-extrabold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Standard Card & Details View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </button>
            <button
              onClick={() => setInventoryDisplayMode('cell_grid')}
              className={`px-3 py-1.5 text-xs font-bold uppercase rounded flex items-center gap-1 cursor-pointer transition-all ${
                inventoryDisplayMode === 'cell_grid'
                  ? 'bg-emerald-600 text-white shadow-xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Live Spreadsheet & Cell Grid View"
            >
              <Table className="w-3.5 h-3.5 text-amber-300" />
              <span>Cell Grid</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs navigation row */}
      <div className="flex border-b border-[#E2DFDF] bg-slate-50/80 px-2 rounded-t overflow-x-auto scrollbar-none" id="inventory-subtabs">
        {[
          { key: 'all', label: `All Products (${allCount})`, icon: LayoutGrid, iconColor: 'text-slate-500' },
          { key: 'filters', label: `Filters Only (${filtersCount})`, icon: Filter, iconColor: 'text-sky-500 animate-pulse' },
          { key: 'oils', label: `Oils & Grease (${oilsCount})`, icon: Droplet, iconColor: 'text-amber-500' },
          { key: 'other', label: `Others/Misc (${othersCount})`, icon: Archive, iconColor: 'text-indigo-400' },
          { key: 'low_stock', label: `Low Stock alerts (${lowStockCount})`, icon: AlertTriangle, iconColor: 'text-rose-500' }
        ].map(tab => {
          const IconComponent = tab.icon;
          const isSelected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as any);
                localStorage.setItem('kfh_active_inventory_tab', tab.key);
                setSelectedProductId(null); // Clear selection on tab change
              }}
              className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 -mb-[1px] transition-all duration-150 flex items-center space-x-2 shrink-0 ${
                isSelected 
                  ? 'border-[#0EA5E9] text-[#0EA5E9] bg-white border-x border-x-gray-250 font-black shadow-xs' 
                  : 'border-transparent text-gray-500 hover:text-[#2A2727] hover:bg-slate-100/60'
              }`}
            >
              <IconComponent className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#0EA5E9]' : tab.iconColor}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs" id="quick-stats-row">
        <div className="bg-white p-3 border border-[#E2DFDF] text-center" id="stat-count">
          <p className="text-[10px] uppercase font-bold text-gray-400">Total Items Shown</p>
          <p className="text-xl font-extrabold text-[#2A2727] font-mono">{totalShownQty}</p>
        </div>
        
        <div className="bg-white p-3 border border-[#E2DFDF] text-center" id="stat-sale-valuation">
          <p className="text-[10px] uppercase font-bold text-gray-400">Retail Value (PKR)</p>
          {revealRealValues ? (
            <p className="text-xl font-extrabold text-[#2A2727] font-mono">Rs. {totalStockSaleValue.toLocaleString()}</p>
          ) : (
            <p className="text-xl font-extrabold text-blue-700 font-mono tracking-widest">{encodeCipher(totalStockSaleValue, cipherKey)}</p>
          )}
        </div>

        <div className="bg-white p-3 border border-[#E2DFDF] text-center" id="stat-cost-valuation">
          <p className="text-[10px] uppercase font-bold text-gray-400">Owner Valuation (Cost)</p>
          {revealRealValues ? (
            <p className="text-xl font-extrabold text-emerald-700 font-mono">Rs. {totalStockCostValue.toLocaleString()}</p>
          ) : (
            <p className="text-xl font-extrabold text-amber-600 font-mono tracking-widest">{encodeCipher(totalStockCostValue, cipherKey)}</p>
          )}
        </div>

        <div className="bg-white p-3 border border-[#E2DFDF] text-center" id="stat-[#0EA5E9]-alerts">
          <p className="text-[10px] uppercase font-bold text-[#0EA5E9]">Alerts Level</p>
          <p className={`text-xl font-extrabold font-mono ${lowLevelShownAlerts > 0 ? 'text-[#0EA5E9]' : 'text-gray-400'}`}>
            {lowLevelShownAlerts}
          </p>
        </div>
      </div>

      {/* Main 2-column or 1-column responsive layout based on selected item */}
      <div className="flex flex-col lg:flex-row gap-4 items-start w-full" id="inventory-split-container">
        
        {/* Left list view */}
        <div className="w-full lg:w-0 lg:flex-1 space-y-2" id="left-product-list-pane" ref={listPaneRef} key={`${searchQuery}||${activeTab}||${categoryFilter}||${inventoryDisplayMode}`}>
          
          {inventoryDisplayMode === 'cell_grid' ? (
            <CellGridInventoryView 
              products={products}
              userRole={userRole}
              cipherKey={cipherKey}
              revealRealValues={revealRealValues}
              selectedProductIds={selectedProductIds}
              onSelectProductIds={setSelectedProductIds}
              onProductSelect={(id) => setSelectedProductId(id)}
              selectedProductId={selectedProductId}
              onProductUpdate={reloadData}
            />
          ) : (
            <>
              {/* BULK SELECTION STATUS BAR BANNER */}
              {selectedProductIds.length > 0 && (
            <div className="bg-[#111C30] border border-slate-950 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white rounded shadow-md font-sans mb-1" id="bulk-controls-toolbar">
              <div className="flex items-center space-x-2">
                <span className="bg-sky-500 text-white font-extrabold text-[9px] uppercase px-2 py-0.5 rounded tracking-widest">Selection Mode</span>
                <p className="text-xs font-bold font-mono text-slate-300">
                  {selectedProductIds.length} of {processedItems.length} products flagged
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allShownIds = processedItems.map(item => item.product.id);
                    setSelectedProductIds(allShownIds);
                  }}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 font-extrabold text-[10px] uppercase rounded border border-slate-700 cursor-pointer"
                >
                  Select All Shown ({processedItems.length})
                </button>

                <button
                  type="button"
                  onClick={() => setShowBulkEditModal(true)}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-[10px] uppercase rounded flex items-center mb-0 cursor-pointer"
                >
                  <PenTool className="w-3 h-3 mr-1" />
                  <span>Bulk Edit</span>
                </button>

                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="px-3 py-1.5 bg-[#0EA5E9] hover:bg-sky-600 text-white font-extrabold text-[10px] uppercase rounded flex items-center mb-0 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  <span>Bulk Delete ({selectedProductIds.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const targetProducts = products.filter(p => selectedProductIds.includes(p.id));
                    const headers = [
                      'part_number', 'brand', 'category', 'shelf_location', 'sale_price', 
                      'cost_price', 'stock_qty', 'min_stock_alert'
                    ];
                    const rows = targetProducts.map(p => [
                      `"${(p.part_number || '').replace(/"/g, '""')}"`,
                      `"${(p.brand || '').replace(/"/g, '""')}"`,
                      `"${(p.category || '').replace(/"/g, '""')}"`,
                      `"${(p.shelf_location || '').replace(/"/g, '""')}"`,
                      p.sale_price,
                      p.cost_price,
                      p.stock_qty,
                      p.min_stock_alert
                    ].join(","));
                    
                    const csvText = [headers.join(","), ...rows].join("\n");
                    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.setAttribute("href", url);
                    link.setAttribute("download", `kfh_selection_export_${selectedProductIds.length}_items.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 font-extrabold text-[10px] uppercase rounded border border-slate-700 cursor-pointer"
                  title="Export checked products to Excel CSV format"
                >
                  <Download className="w-3 h-3 text-emerald-400 inline mr-1" />
                  <span>Export ({selectedProductIds.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedProductIds([])}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-[#0ea5e9] font-extrabold text-[10px] uppercase rounded border border-slate-700 cursor-pointer text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          
          {/* Force full re-render on search change */}
          {processedItems.length === 0 ? (
            <div className="bg-white p-12 text-center border border-[#E2DFDF] text-gray-400 font-mono">
              No product catalog entries matches the applied filter conditions.
            </div>
          ) : (
            processedItems.map(({ product: p, rank, matchedBadge, viaCode }) => {
              const saleVal = typeof p.sale_price === 'number' ? p.sale_price : Number(p.sale_price) || 0;
              const costVal = typeof p.cost_price === 'number' ? p.cost_price : Number(p.cost_price) || 0;
              const stockVal = typeof p.stock_qty === 'number' ? p.stock_qty : Number(p.stock_qty) || 0;
              const minAlertVal = typeof p.min_stock_alert === 'number' ? p.min_stock_alert : Number(p.min_stock_alert) || 0;

              const matchesSelected = selectedProductId === p.id;
              const hasLowStock = stockVal <= minAlertVal;

              const cardImageUrls: string[] = [];
              if (p.image_urls && p.image_urls.length > 0) {
                cardImageUrls.push(...p.image_urls.map(u => ensureHttpsUrl(u)));
              } else if (p.image_url) {
                cardImageUrls.push(ensureHttpsUrl(p.image_url));
              }

              let rankBorder = 'border-l-4 border-l-gray-300';
              let rankBg = 'bg-white';
              
              if (searchQuery.trim().length > 0) {
                if (rank === 1 || rank === 2) {
                  rankBorder = 'border-l-[5px] border-l-blue-600';
                } else if (rank === 3) {
                  rankBorder = 'border-l-[5px] border-l-green-600';
                } else if (rank === 4) {
                  rankBorder = 'border-l-[5px] border-l-amber-500';
                } else if (rank === 5) {
                  rankBorder = 'border-l-[5px] border-l-gray-300 opacity-60';
                }
              }

              if (selectedProduct) {
                // Return a simplified, elegant, compact card since the detail pane is open!
                const activeImg = cardImageUrls[activeImageIndices[p.id] || 0] || (p.image_urls && p.image_urls[0]) || p.image_url || "https://placehold.co/100x100/f1f5f9/64748b?text=N/A";
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedProductId(prev => prev === p.id ? null : p.id)}
                    id={`product-card-${p.id}`}
                    className={`relative p-2.5 border transition-all duration-150 cursor-pointer hover:bg-slate-50 flex items-center justify-between gap-3 rounded-md hover:scale-[1.005] hover:-translate-y-[0.5px] ${
                      matchesSelected 
                        ? 'border-[#0EA5E9] bg-sky-50/20 shadow-xs ring-2 ring-sky-400/10' 
                        : 'border-[#E2DFDF] bg-white hover:shadow-xs hover:border-slate-400'
                    } ${rankBorder}`}
                  >
                    {/* Checkbox + Image + Basic text Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Checkbox */}
                      <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox"
                          checked={selectedProductIds.includes(p.id)}
                          onChange={e => {
                            const checked = e.target.checked;
                            if (checked) {
                              setSelectedProductIds(prev => [...prev, p.id]);
                            } else {
                              setSelectedProductIds(prev => prev.filter(id => id !== p.id));
                            }
                          }}
                          className="w-4 h-4 text-[#0ea5e9] focus:ring-sky-400 border-slate-350 rounded cursor-pointer transition-all"
                        />
                      </div>

                      {/* Small compact image */}
                      <div className="w-14 h-14 bg-white border border-slate-200 rounded flex-shrink-0 flex items-center justify-center p-0.5 shadow-3xs overflow-hidden">
                        <img 
                          src={activeImg} 
                          alt={p.part_number} 
                          className="w-full h-full object-contain pointer-events-none select-none"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = "https://placehold.co/100x100/f1f5f9/64748b?text=N/A";
                          }}
                        />
                      </div>

                      {/* Title & Brand info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm font-black font-mono text-slate-800 tracking-tight leading-none truncate">
                            {p.part_number}
                          </h4>
                          <span className="text-[9px] bg-[#111C30] text-white px-1.5 py-0.2 font-black rounded-sm shadow-3xs uppercase tracking-wider">{p.brand}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                          {p.category} {p.subtype ? `• ${p.subtype}` : ''}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Loc: {p.shelf_location || 'Row A'}
                        </p>
                      </div>
                    </div>

                    {/* Compact Pricing & Stock section */}
                    <div className="text-right flex-shrink-0 flex flex-col items-end space-y-1">
                      <p className="text-xs font-black text-[#0EA5E9] font-mono leading-none">
                        {revealRealValues ? `Rs. ${saleVal.toLocaleString()}` : encodeCipher(saleVal, cipherKey)}
                      </p>
                      <div>
                        {stockVal === 0 ? (
                          <span className="text-[9px] bg-sky-100 text-[#0EA5E9] font-bold px-1.5 py-0.5 rounded-sm border border-sky-150 font-mono">OUT</span>
                        ) : hasLowStock ? (
                          <span className="text-[9px] bg-amber-50 text-amber-900 font-bold px-1.5 py-0.5 rounded-sm border border-amber-200 font-mono animate-pulse">LOW: {stockVal}</span>
                        ) : (
                          <span className="text-[9px] bg-emerald-50 text-emerald-800 font-bold px-1.5 py-0.5 rounded-sm border border-emerald-150 font-mono">STK: {stockVal}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProductId(prev => prev === p.id ? null : p.id)}
                  id={`product-card-${p.id}`}
                  className={`relative p-4 border transition-all duration-150 cursor-pointer hover:bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-md hover:scale-[1.005] hover:-translate-y-[0.5px] ${
                    matchesSelected 
                      ? 'border-[#0EA5E9] bg-sky-50/20 shadow-md ring-2 ring-sky-400/10' 
                      : 'border-[#E2DFDF] bg-white shadow-xs hover:shadow-md hover:border-slate-400'
                  } ${rankBorder}`}
                >
                  {/* Left row selector check & info segment */}
                  <div className="flex flex-col sm:flex-row items-start gap-4 flex-1 min-w-0">
                    {/* Checkbox trigger block */}
                    <div className="pt-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <input 
                        type="checkbox"
                        checked={selectedProductIds.includes(p.id)}
                        onChange={e => {
                          const checked = e.target.checked;
                          if (checked) {
                            setSelectedProductIds(prev => [...prev, p.id]);
                          } else {
                            setSelectedProductIds(prev => prev.filter(id => id !== p.id));
                          }
                        }}
                        className="w-4 h-4 text-[#0ea5e9] focus:ring-sky-400 border-slate-350 rounded cursor-pointer transition-all"
                      />
                    </div>

                    {/* Highly Prominent Multi-Image Carousel / Gallery */}
                    {cardImageUrls.length > 0 && (
                      <div 
                        className="flex-shrink-0 flex flex-col items-center p-2.5 bg-slate-50 border border-slate-200 rounded-lg hover:border-sky-300 hover:shadow-md transition-all relative group w-full sm:w-52 md:w-56 lg:w-60"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent product card selection toggle
                        }}
                      >
                        <div 
                          className="relative w-full h-52 sm:h-52 md:h-56 lg:h-60 bg-white rounded overflow-hidden border border-slate-150 flex items-center justify-center shadow-3xs cursor-zoom-in"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setLightboxProduct(p);
                            setLightboxImageIndex(activeImageIndices[p.id] || 0);
                          }}
                        >
                          <img 
                            src={cardImageUrls[activeImageIndices[p.id] || 0]} 
                            alt={`${p.part_number} view`} 
                            className="w-full h-full object-contain p-2 select-none pointer-events-none transition-all duration-350 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = "https://placehold.co/600x400/f1f5f9/64748b?text=N/A";
                            }}
                          />

                          {/* Hover Overlay: Zoom/Enlarge prompt */}
                          <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <div className="bg-white/95 text-slate-900 border border-slate-200/50 px-3.5 py-2 rounded-full shadow-lg flex items-center space-x-2 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 text-xs font-black">
                              <ZoomIn className="w-4 h-4 text-[#0EA5E9] animate-pulse" />
                              <span>Click to Zoom</span>
                            </div>
                          </div>

                          {/* Zoom Indicator Icon (Constant helper) */}
                          <div className="absolute bottom-2 left-2 bg-slate-900/70 text-white p-1.5 rounded-full backdrop-blur-xs opacity-80 group-hover:opacity-100 transition-all z-10" title="Enlarge Image">
                            <ZoomIn className="w-3.5 h-3.5" />
                          </div>

                          {/* Pagination Counter Badge */}
                          {cardImageUrls.length > 1 && (
                            <span className="absolute top-2 right-2 bg-slate-900/80 text-white text-[9.5px] font-mono px-2.5 py-0.5 rounded-full backdrop-blur-xs font-black select-none z-10">
                              {(activeImageIndices[p.id] || 0) + 1}/{cardImageUrls.length}
                            </span>
                          )}

                          {/* Navigation chevrons */}
                          {cardImageUrls.length > 1 && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const curr = activeImageIndices[p.id] || 0;
                                  const nextIdx = (curr - 1 + cardImageUrls.length) % cardImageUrls.length;
                                  setActiveImageIndices(prev => ({ ...prev, [p.id]: nextIdx }));
                                }}
                                className="absolute left-2.5 top-1/2 -translate-y-1/2 bg-white/95 hover:bg-white text-slate-850 border border-slate-200 p-2 rounded-full shadow-md transition-all opacity-0 group-hover:opacity-100 hover:scale-115 active:scale-95 cursor-pointer z-15"
                                title="Previous Image"
                              >
                                <ChevronLeft className="w-4 h-4 stroke-[3.5]" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const curr = activeImageIndices[p.id] || 0;
                                  const nextIdx = (curr + 1) % cardImageUrls.length;
                                  setActiveImageIndices(prev => ({ ...prev, [p.id]: nextIdx }));
                                }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-white/95 hover:bg-white text-slate-850 border border-slate-200 p-2 rounded-full shadow-md transition-all opacity-0 group-hover:opacity-100 hover:scale-115 active:scale-95 cursor-pointer z-15"
                                title="Next Image"
                              >
                                <ChevronRight className="w-4 h-4 stroke-[3.5]" />
                              </button>
                            </>
                          )}
                        </div>

                        {/* Thumbnail strips or indicator dots */}
                        {cardImageUrls.length > 1 ? (
                          <div className="flex items-center justify-start gap-1.5 mt-2 w-full overflow-x-auto py-1 scrollbar-thin">
                            {cardImageUrls.map((url, idx) => {
                              const isActive = (activeImageIndices[p.id] || 0) === idx;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setActiveImageIndices(prev => ({ ...prev, [p.id]: idx }));
                                  }}
                                  className={`relative w-11 h-11 rounded border bg-white flex-shrink-0 overflow-hidden transition-all duration-150 p-0.5 ${
                                    isActive 
                                      ? 'border-[#0EA5E9] ring-2 ring-[#0EA5E9]/20 scale-105 shadow-2xs' 
                                      : 'border-slate-200 hover:border-slate-350'
                                  }`}
                                >
                                  <img 
                                    src={url} 
                                    alt="thumbnail" 
                                    className="w-full h-full object-contain pointer-events-none"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.src = "https://placehold.co/100x100/f1f5f9/64748b?text=N/A";
                                    }}
                                  />
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-400 font-mono mt-1 font-bold select-none uppercase tracking-wider">Catalog View</span>
                        )}
                      </div>
                    )}

                    {/* Left info segment */}
                    <div className="space-y-3 flex-1 min-w-0 pr-1 flex flex-col justify-between self-stretch">
                    <div className="flex items-center flex-wrap gap-2">
                      <h4 className="text-xl sm:text-2xl font-black tracking-tight text-[#2A2727] font-mono leading-none">
                        {p.part_number}
                      </h4>
                      <span className="text-xs bg-[#111C30] text-white px-3 py-1 uppercase font-black rounded-sm shadow-2xs">{p.brand}</span>
                      <span className="text-xs bg-slate-100 text-slate-850 px-3 py-1 rounded-sm font-extrabold border border-slate-200">{p.category}</span>
                      
                      {p.subtype && (
                        <span className="text-xs bg-sky-100 text-sky-900 px-3 py-1 rounded-sm font-black border border-sky-200">TYPE: {p.subtype}</span>
                      )}
                      {p.grade && p.grade !== 'standard' && (
                        <span className="text-xs bg-indigo-105 text-indigo-805 px-3 py-1 rounded-sm font-black border border-indigo-200 bg-indigo-50 capitalize">{p.grade} Grade</span>
                      )}
                      {p.pack_size && (
                        <span className="text-xs bg-amber-105 text-amber-805 px-3 py-1 rounded-sm font-black border border-amber-200 bg-amber-50">{p.pack_size}</span>
                      )}

                      {matchesSelected && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedProductId(null);
                          }}
                          className="ml-auto text-[10px] bg-[#0ea5e9] hover:bg-sky-600 text-white px-3 py-1.5 font-bold rounded uppercase tracking-wider flex items-center shadow-md cursor-pointer transition-colors hover:scale-[1.02] active:scale-[0.98]"
                        >
                          ✕ Close Details
                        </button>
                      )}

                      {/* Rank Tag */}
                      {matchedBadge && (
                        <span className={`text-[10px] uppercase font-black px-2.5 py-1 rounded shadow-2xs ${
                          rank === 1 || rank === 2 ? 'bg-blue-100 text-blue-700' :
                          rank === 3 ? 'bg-green-100 text-green-700' :
                          rank === 4 ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {matchedBadge} {viaCode && `via ${viaCode}`}
                        </span>
                      )}

                      {/* Optional Interactive External link */}
                      {p.product_url && (
                        <a
                          href={p.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white transition-all text-[11px] font-black cursor-pointer shadow-3xs"
                        >
                          <Globe className="w-3 h-3" />
                          <span>Open Link</span>
                        </a>
                      )}
                    </div>

                    {/* Highly prominent Thread, Sizing and Subtype Specs Block with high-contrast, larger text */}
                    {(p.length_inch || p.width_inch || p.inner_diameter_inch || p.thread_size) && (
                      <div className="p-3 bg-slate-50 border border-slate-250 rounded-md flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                        {p.length_inch || p.width_inch || p.inner_diameter_inch ? (
                          <div className="flex items-center space-x-2 text-slate-900">
                            <span className="text-lg">📐</span>
                            <span className="font-extrabold text-[#0EA5E9] uppercase tracking-wide text-xs">Size Metrics (Inches):</span>
                            <span className="font-mono font-black text-rose-900 bg-white border border-slate-250 px-3 py-1 rounded shadow-sm text-sm sm:text-base">
                              {p.length_inch || '0'}" <span className="text-slate-400 font-sans text-xs">Length</span> × {p.width_inch || '0'}" <span className="text-slate-400 font-sans text-xs">OD/Width</span> × {p.inner_diameter_inch || '0'}" <span className="text-slate-400 font-sans text-xs">ID</span>
                            </span>
                          </div>
                        ) : null}

                        {p.thread_size ? (
                          <div className="flex items-center space-x-2 text-slate-900">
                            <span className="text-lg">🔩</span>
                            <span className="font-extrabold text-blue-700 uppercase tracking-wide text-xs">Screw Thread:</span>
                            <span className="font-mono font-black text-[#0EA5E9] bg-white border border-slate-250 px-3 py-1 rounded shadow-sm text-sm sm:text-base">
                              {p.thread_size}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Secondary Millimeter Specifications & Health Grid */}
                    {(p.height_mm || p.od_mm || p.micron_rating || p.cabin_filter === 'Yes' || p.damaged_qty > 0 || p.gasket_od_mm || p.gasket_id_mm) && (
                      <div className="flex flex-wrap items-center gap-2">
                        {p.height_mm ? (
                          <span className="text-xs bg-slate-100 text-slate-850 border border-slate-200 px-2.5 py-1 rounded font-extrabold font-mono flex items-center gap-1 shadow-3xs">
                            <span className="text-slate-450">Height:</span> {p.height_mm} mm
                          </span>
                        ) : null}
                        {p.od_mm ? (
                          <span className="text-xs bg-slate-100 text-slate-850 border border-slate-200 px-2.5 py-1 rounded font-extrabold font-mono flex items-center gap-1 shadow-3xs">
                            <span className="text-slate-450">OD:</span> {p.od_mm} mm
                          </span>
                        ) : null}
                        {p.gasket_od_mm ? (
                          <span className="text-xs bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded font-extrabold font-mono flex items-center gap-1 shadow-3xs">
                            <span className="text-amber-600">Gasket OD:</span> {p.gasket_od_mm} mm
                          </span>
                        ) : null}
                        {p.gasket_id_mm ? (
                          <span className="text-xs bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded font-extrabold font-mono flex items-center gap-1 shadow-3xs">
                            <span className="text-amber-600">Gasket ID:</span> {p.gasket_id_mm} mm
                          </span>
                        ) : null}
                        {p.micron_rating ? (
                          <span className="text-xs bg-purple-50 text-purple-900 border border-purple-200 px-2.5 py-1 rounded font-extrabold font-mono flex items-center gap-1 shadow-3xs">
                            <span className="text-purple-400">Micron:</span> {p.micron_rating} µm
                          </span>
                        ) : null}
                        {p.cabin_filter === 'Yes' && (
                          <span className="text-xs bg-teal-50 text-teal-900 border border-teal-200 px-2.5 py-1 rounded font-black uppercase tracking-wider flex items-center gap-1 shadow-3xs">
                            🍃 Cabin Filter
                          </span>
                        )}
                        {p.damaged_qty > 0 && (
                          <span className="text-xs bg-rose-50 text-rose-900 border border-rose-200 px-2.5 py-1 rounded font-black uppercase tracking-wider flex items-center gap-1 shadow-3xs animate-pulse">
                            ⚠️ Damaged stock: {p.damaged_qty} pcs
                          </span>
                        )}
                      </div>
                    )}

                    {/* Highly aesthetic Product Notes block */}
                    {p.notes && (
                      <div className="text-xs text-slate-650 bg-amber-50/40 border border-amber-200/50 rounded-md p-2.5 leading-relaxed italic max-w-2xl shadow-3xs">
                        📝 <span className="font-black not-italic text-slate-750 mr-1">Notes:</span> {p.notes}
                      </div>
                    )}

                    {/* Sub title details */}
                    <div className="text-xs text-gray-550 truncate space-y-2">
                      {getProductCrossRefs(p.id).length > 0 && (
                        <div className="flex items-center space-x-2 flex-wrap gap-1">
                          <span className="text-xs text-gray-400 font-black uppercase tracking-wider">Subs / Cross References:</span>
                          {getProductCrossRefs(p.id).map(r => (
                            <span 
                              key={r.refId} 
                              className={`text-xs font-mono px-2.5 py-1 rounded font-bold border flex items-center gap-1.5 ${
                                r.matchType === 'exact_match' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                              title={r.isExternal ? `External: ${r.externalBrand}${r.customText ? ` - ${r.customText}` : ''}` : `Store Product: ${r.linkedProduct?.brand}${r.customText ? ` - ${r.customText}` : ''}`}
                            >
                              <span>{r.isExternal ? r.externalPartNumber : r.linkedProduct?.part_number} ({r.isExternal ? r.externalBrand : r.linkedProduct?.brand})</span>
                              {r.customText && (
                                <span className="text-[10px] text-indigo-750 bg-indigo-50/70 border border-indigo-200 px-1 py-0.2 rounded font-sans font-black">
                                  {r.customText}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-4 text-xs text-slate-600 font-extrabold mt-2">
                        <span>Shelf Location: <span className="font-mono text-base font-black text-[#0EA5E9] bg-white border border-sky-200 px-2.5 py-1 rounded shadow-2xs ml-1">{p.shelf_location || 'Unassigned'}</span></span>
                        <span>•</span>
                        <span>Supplier Ref: <span className="font-mono text-slate-900 bg-slate-150 px-2 py-0.5 rounded ml-1">{p.supplier_code || 'N/A'}</span></span>
                      </div>
                    </div>
                  </div>
                  </div>



                  {/* Right side pricing & stock */}
                  <div className="text-right flex-shrink-0 space-y-3 min-w-[155px] bg-slate-50 p-3 border border-slate-205 rounded-md shadow-2xs" id={`card-stats-${p.id}`}>
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block">Selling Price</span>
                      <p className="text-xl sm:text-2xl font-black text-[#0EA5E9] font-mono leading-none">
                        {revealRealValues ? `Rs. ${saleVal.toLocaleString()}` : encodeCipher(saleVal, cipherKey)}
                      </p>
                    </div>
                    
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block">Cost Price</span>
                      <p className="text-xs sm:text-sm font-mono font-black text-slate-800 bg-white border border-slate-200 px-2 py-1 rounded inline-block leading-none shadow-2xs">
                        {revealRealValues ? `Rs. ${costVal.toLocaleString()}` : encodeCipher(costVal, cipherKey)}
                      </p>
                    </div>

                    <div className="block mt-1">
                      {stockVal === 0 ? (
                        <span className="text-xs bg-sky-100 text-[#0EA5E9] font-black px-2.5 py-1 rounded-sm border border-sky-200 font-mono shadow-2xs">OUT OF STOCK</span>
                      ) : hasLowStock ? (
                        <span className="text-xs bg-amber-100 text-amber-900 font-black px-2.5 py-1 rounded-sm border border-amber-250 font-mono animate-pulse shadow-2xs">LOW: {stockVal} pcs</span>
                      ) : (
                        <span className="text-xs bg-emerald-50 text-emerald-800 font-black px-2.5 py-1 rounded-sm border border-emerald-200 font-mono shadow-2xs">In Stock: {stockVal} pcs</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
            </>
          )}
        </div>

        {/* Right side detailed pane if selected */}
        <AnimatePresence mode="wait">
          {selectedProduct && (
            <motion.div 
              key={selectedProduct.id}
              initial={{ opacity: 0, x: 20, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="w-full lg:w-[45%] flex-shrink-0 bg-white border border-[#E2DFDF] rounded sticky top-4 self-start max-h-[calc(100vh-100px)] overflow-y-auto flex flex-col shadow-sm" 
              id="right-description-pane"
            >
            
            {/* Detailed Head */}
            <div className="p-4 bg-gray-50 border-b border-[#E2DFDF] flex justify-between items-start">
              <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{selectedProduct.brand} Brand Reference</p>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-extrabold font-mono text-[#2A2727]">{selectedProduct.part_number}</h3>
                  <button
                    onClick={() => setShowEditDetailsModal(true)}
                    className="p-1 text-gray-500 hover:text-[#0EA5E9] hover:bg-slate-200 rounded transition-colors"
                    title="Edit Product Details"
                    id="btn-trigger-edit-product"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <button
                onClick={() => setSelectedProductId(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm"
              >
                ✕ Close
              </button>
            </div>

            {/* Inner sub-tabs nav */}
            <div className="flex bg-slate-50 border-b border-[#E2DFDF] text-[11px] font-bold uppercase tracking-wider rounded-t" id="panel-subtabs">
              {[
                { key: 'details', label: 'Tech Details' },
                { key: 'cross_refs', label: 'Cross Refs' },
                { key: 'stock', label: 'Stocks Adjust' },
                { key: 'pricing', label: 'Rates & Profits' }
              ].map(sub => (
                <button
                  key={sub.key}
                  onClick={() => setDetailTab(sub.key as any)}
                  className={`flex-1 text-center py-2.5 border-b-2 -mb-[1px] transition-all duration-150 ${
                    detailTab === sub.key 
                      ? 'border-[#0EA5E9] text-[#0EA5E9] bg-white border-x border-x-gray-200 font-black shadow-xs' 
                      : 'border-transparent text-gray-500 hover:text-[#2A2727] hover:bg-slate-100/60'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* Sub-tab content display */}
            <div className="p-4 text-xs divide-y divide-[#F5F4F4]">
                       {/* DETAILS SUBTAB */}
              {detailTab === 'details' && (
                <div className="grid grid-cols-2 gap-y-4 py-2" id="tab-specs">
                  <div className="pr-2">
                    <div className="text-[10px] uppercase text-gray-400 font-bold">Brand</div>
                    <div className="text-[13px] font-medium text-[#2A2727]">{selectedProduct.brand}</div>
                  </div>
                  <div className="pr-2">
                    <div className="text-[10px] uppercase text-gray-400 font-bold">Category</div>
                    <div className="text-[13px] font-medium text-[#2A2727]">{selectedProduct.category}</div>
                  </div>
                  {selectedProduct.subtype && (
                    <div className="pr-2">
                      <div className="text-[10px] uppercase text-gray-400 font-bold">Filter Sub-type Code</div>
                      <div className="text-[13px] font-medium text-[#0EA5E9] font-mono">{selectedProduct.subtype}</div>
                    </div>
                  )}
                  {selectedProduct.pack_size && (
                    <div className="pr-2">
                      <div className="text-[10px] uppercase text-gray-400 font-bold">Liquid Pack Size</div>
                      <div className="text-[13px] font-medium text-[#2A2727]">{selectedProduct.pack_size}</div>
                    </div>
                  )}
                  <div className="pr-2">
                    <div className="text-[10px] uppercase text-gray-400 font-bold">Product Grade Level</div>
                    <div className="text-[13px] font-medium text-[#2A2727]">{selectedProduct.grade}</div>
                  </div>
                  <div className="pr-2">
                    <div className="text-[10px] uppercase text-gray-400 font-bold">Shelf Warehouse Row</div>
                    <div className="text-[13px] font-medium text-[#0EA5E9] font-mono">{selectedProduct.shelf_location || 'Row A'}</div>
                  </div>
                  
                  {/* Sizing (filters only) */}
                  {(selectedProduct.length_inch || selectedProduct.width_inch || selectedProduct.inner_diameter_inch) && (
                    <div className="col-span-2 p-3 bg-sky-50/20 border border-sky-200 rounded-md my-1">
                      <div className="text-[10px] uppercase text-[#0EA5E9] font-black tracking-wider mb-2">📐 Filter Metric Dimensions (Inches)</div>
                      <div className="grid grid-cols-3 gap-2 text-center text-slate-800 font-mono">
                        <div className="bg-white p-2 border border-slate-200 rounded-sm">
                          <span className="block text-[9px] text-gray-400 font-bold uppercase">Length (L)</span>
                          <span className="text-base sm:text-lg font-black text-rose-900">{selectedProduct.length_inch || '- '}"</span>
                        </div>
                        <div className="bg-white p-2 border border-slate-200 rounded-sm">
                          <span className="block text-[9px] text-gray-400 font-bold uppercase">Width / OD</span>
                          <span className="text-base sm:text-lg font-black text-rose-900">{selectedProduct.width_inch || '- '}"</span>
                        </div>
                        <div className="bg-white p-2 border border-slate-200 rounded-sm">
                          <span className="block text-[9px] text-gray-400 font-bold uppercase">Inner Dia (ID)</span>
                          <span className="text-base sm:text-lg font-black text-[#0EA5E9]">{selectedProduct.inner_diameter_inch || '- '}"</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Gasket Dimensions Specs (Optional) */}
                  {(selectedProduct.gasket_od_mm || selectedProduct.gasket_id_mm) && (
                    <div className="col-span-2 p-3 bg-amber-50/35 border border-amber-200 rounded-md my-1">
                      <div className="text-[10px] uppercase text-amber-800 font-black tracking-wider mb-2 flex items-center gap-1.5 font-sans">⭕ Gasket Metric Dimensions (Millimeters)</div>
                      <div className="grid grid-cols-2 gap-2 text-center text-slate-800 font-mono">
                        <div className="bg-white p-2 border border-slate-200 rounded-sm">
                          <span className="block text-[9px] text-gray-400 font-bold uppercase">Gasket OD</span>
                          <span className="text-base font-black text-amber-900">{selectedProduct.gasket_od_mm ? `${selectedProduct.gasket_od_mm} mm` : '-'}</span>
                        </div>
                        <div className="bg-white p-2 border border-slate-200 rounded-sm">
                          <span className="block text-[9px] text-gray-400 font-bold uppercase">Gasket ID</span>
                          <span className="text-base font-black text-amber-900">{selectedProduct.gasket_id_mm ? `${selectedProduct.gasket_id_mm} mm` : '-'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedProduct.thread_size && (
                    <div className="pr-2">
                      <div className="text-[10px] uppercase text-gray-400 font-bold">Screw Thread Metrics</div>
                      <div className="text-[14px] font-black font-mono text-[#0EA5E9] bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-sm inline-block">{selectedProduct.thread_size}</div>
                    </div>
                  )}
                  {selectedProduct.cabin_filter === 'Yes' && (
                    <div className="pr-2 col-span-2 bg-yellow-50 p-1.5 rounded">
                      <div className="text-[10px] uppercase text-gray-500 font-bold">Cabin Air Filter</div>
                      <div className="text-[13px] font-extrabold text-blue-700">YES (AC standard)</div>
                    </div>
                  )}
                  {selectedProduct.supplier_code && (
                    <div className="pr-2">
                      <div className="text-[10px] uppercase text-gray-400 font-bold">Wholesaler Code</div>
                      <div className="text-[13px] font-medium font-mono">{selectedProduct.supplier_code}</div>
                    </div>
                  )}

                  {selectedProduct.notes && (
                    <div className="col-span-2 py-2 mt-2 bg-gray-50 p-2.5 rounded text-[11px] leading-relaxed text-gray-600 border border-gray-100 italic" id="product-detail-notes">
                      <strong>Fit Remarks:</strong> {selectedProduct.notes}
                    </div>
                  )}

                  {/* Media attachment block inside details drawer */}
                  {((selectedProduct.image_urls && selectedProduct.image_urls.length > 0) || selectedProduct.image_url || selectedProduct.product_url) && (
                    <div className="col-span-2 border-t border-dashed border-slate-200 mt-2.5 pt-3.5 space-y-3 font-sans">
                      <div className="text-[10px] uppercase text-slate-500 font-extrabold tracking-wider">📁 Attached Support Catalog Media & Links</div>
                      <div className="grid grid-cols-1 gap-3">
                        {/* Dynamic Multi-image layout */}
                        {selectedProduct.image_urls && selectedProduct.image_urls.length > 0 ? (
                          <div className="space-y-3">
                            <span className="text-[10px] text-gray-500 font-bold block mb-0.5 uppercase">📷 Linked Catalog Reference Images ({selectedProduct.image_urls.length})</span>
                            <div className="grid grid-cols-1 gap-3">
                              {selectedProduct.image_urls.map((imgUrl, idx) => (
                                <div key={idx} className="bg-slate-50 p-2.5 border rounded-md flex flex-col items-center">
                                  <img 
                                    src={imgUrl} 
                                    alt={`Product spec view ${idx + 1}`} 
                                    className="max-h-72 object-contain rounded border shadow-3xs bg-white w-full" 
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.src = "https://placehold.co/600x400/f1f5f9/475569?text=Image+Not+Available";
                                    }}
                                  />
                                  <span className="text-[9px] text-gray-400 font-mono mt-1 font-bold">Image #{idx + 1}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : selectedProduct.image_url ? (
                          <div className="bg-slate-50 p-2.5 border rounded-md flex flex-col items-center">
                            <span className="text-[10px] text-gray-500 font-bold block mb-1.5 uppercase self-start">📷 Linked Catalog Reference Image</span>
                            <img 
                              src={selectedProduct.image_url} 
                              alt="product specs" 
                              className="max-h-72 object-contain rounded border shadow-3xs bg-white w-full" 
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = "https://placehold.co/600x400/f1f5f9/475569?text=Image+Not+Available";
                              }}
                            />
                          </div>
                        ) : null}

                        {selectedProduct.product_url && (
                          <div className="flex items-center justify-between bg-blue-50/40 p-2.5 border border-blue-150 rounded-md">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-blue-800 font-black uppercase">External web link attached</span>
                              <span className="text-[9px] text-gray-500 font-mono truncate max-w-[200px]" title={selectedProduct.product_url}>{selectedProduct.product_url}</span>
                            </div>
                            <a 
                              href={selectedProduct.product_url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded flex items-center space-x-1 uppercase"
                            >
                              <Globe className="w-3.5 h-3.5" />
                              <span>Go to link</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CROSS REFS SUBTAB */}
              {detailTab === 'cross_refs' && (
                <div className="space-y-3 py-1" id="tab-cross-refs">
                  <div className="flex justify-between items-center pb-2">
                    <span className="font-bold text-[#2A2727]">Registered Alternates & Substitutes</span>
                    <button
                      onClick={() => setShowLinkModal(true)}
                      className="text-[10px] bg-[#0EA5E9] text-white px-2 py-1 font-bold rounded uppercase tracking-wider flex items-center hover:bg-sky-600"
                    >
                      <Plus className="w-3 h-3 mr-0.5" />
                      Link product
                    </button>
                  </div>

                  {getProductCrossRefs(selectedProduct.id).length === 0 ? (
                    <div className="p-6 text-center text-gray-400 font-mono bg-gray-50 border border-gray-100 rounded">
                      No alternate substitute linkages registered for this code yet.
                    </div>
                  ) : (
                    <div className="space-y-2" id="crossrefs-expanded-list">
                      {getProductCrossRefs(selectedProduct.id).map(r => (
                        <div 
                          key={r.refId} 
                          className={`p-2 border flex justify-between items-center bg-white ${
                            r.matchType === 'exact_match' ? 'border-l-4 border-l-emerald-600' : 'border-l-4 border-l-amber-500'
                          }`}
                        >
                          <div className="flex-1 min-w-0 pr-3">
                            {r.isExternal ? (
                              <div>
                                <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                                  <p className="font-bold font-mono text-[#2A2727] text-xs">{r.externalPartNumber}</p>
                                  <span className="text-[8px] bg-indigo-50 border border-indigo-200 text-indigo-700 px-1 py-0.2 rounded font-extrabold uppercase shrink-0">
                                    Non-Sell OEM Alt
                                  </span>
                                  {r.customText && (
                                    <span className="text-[10px] text-indigo-750 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded font-sans font-black">
                                      💡 {r.customText}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-500 font-bold">
                                  Brand: {r.externalBrand} • (Unstocked code for catalog query redirection)
                                </p>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                                  <p className="font-bold font-mono text-[#2A2727] text-xs">{r.linkedProduct?.part_number}</p>
                                  {r.customText && (
                                    <span className="text-[10px] text-indigo-750 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded font-sans font-black">
                                      💡 {r.customText}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-400">
                                  {r.linkedProduct?.brand} • Unit: {revealRealValues ? `Rs. ${r.linkedProduct?.sale_price}` : encodeCipher(r.linkedProduct?.sale_price || 0, cipherKey)}
                                </p>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-3 text-right">
                            <div>
                              <span className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${
                                r.matchType === 'exact_match' 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {r.matchType === 'exact_match' ? 'Exact Match' : 'Compatible'}
                              </span>
                              {!r.isExternal && (
                                <p className="text-[9px] text-gray-400 font-mono mt-1">Stock: {r.linkedProduct?.stock_qty} pcs</p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleUnlinkCrossRef(r.refId)}
                              title="Delete Cross reference" 
                              className="text-gray-400 hover:text-sky-600 p-1 rounded hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* STOCK ADJUST SUBTAB */}
              {detailTab === 'stock' && (
                <div className="space-y-4 py-2" id="tab-stock-counts">
                  
                  {/* Two Main Boxes */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 border border-slate-200 p-3 text-center rounded">
                      <p className="text-[10px] uppercase font-bold text-gray-400">Sellable Units</p>
                      <h4 className={`text-2xl font-black font-mono my-1 ${selectedProduct.stock_qty <= selectedProduct.min_stock_alert ? 'text-amber-600' : 'text-emerald-700'}`}>
                        {selectedProduct.stock_qty}
                      </h4>
                      <button 
                        onClick={openAdjustModal} 
                        className="text-[10px] mt-1 text-[#0EA5E9] font-bold uppercase underline"
                      >
                        Adjust stock
                      </button>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-3 text-center rounded">
                      <p className="text-[10px] uppercase font-bold text-gray-400">Damaged Units</p>
                      <h4 className={`text-2xl font-black font-mono my-1 ${selectedProduct.damaged_qty > 0 ? 'text-[#0EA5E9]' : 'text-gray-400'}`}>
                        {selectedProduct.damaged_qty}
                      </h4>
                      <button 
                        onClick={openDamageModal} 
                        disabled={selectedProduct.stock_qty === 0}
                        className="text-[10px] mt-1 text-gray-500 font-bold uppercase underline disabled:opacity-40 disabled:no-underline"
                      >
                        Mark Damaged
                      </button>
                    </div>
                  </div>

                  <div className="text-[11px] bg-slate-50 p-2 border border-slate-100 space-y-1.5 text-gray-600">
                    <p><strong>Min stock alert warning level:</strong> {selectedProduct.min_stock_alert} items</p>
                    <p><strong>Shelf Warehouse Location:</strong> {selectedProduct.shelf_location}</p>
                  </div>
                </div>
              )}

              {/* PRICING & PROFITS SUBTAB */}
              {detailTab === 'pricing' && (
                <div className="space-y-4 py-2" id="tab-commerce">
                  
                  {/* Sale and Cost card grids */}
                  {(() => {
                    const dSaleVal = typeof selectedProduct.sale_price === 'number' ? selectedProduct.sale_price : Number(selectedProduct.sale_price) || 0;
                    const dCostVal = typeof selectedProduct.cost_price === 'number' ? selectedProduct.cost_price : Number(selectedProduct.cost_price) || 0;
                    const dMarginVal = dSaleVal > 0 ? (((dSaleVal - dCostVal) / dSaleVal) * 100).toFixed(1) : '0';

                    return (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-sky-50/20 border border-slate-100 p-3 text-center rounded">
                          <p className="text-[10px] uppercase font-bold text-gray-400">Sale Price Retail</p>
                          <h4 className="text-xl font-extrabold text-[#0EA5E9] font-mono my-1">
                            {revealRealValues ? `Rs. ${dSaleVal.toLocaleString()}` : encodeCipher(dSaleVal, cipherKey)}
                          </h4>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 p-3 text-center rounded flex flex-col justify-center">
                          <p className="text-[10px] uppercase font-bold text-gray-400">Cost Purchase Price</p>
                          {revealRealValues ? (
                            <div>
                              <h4 className="text-xl font-extrabold text-emerald-700 font-mono my-0.5">
                                Rs. {dCostVal.toLocaleString()}
                              </h4>
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1 rounded-full font-mono">
                                Margin: {dMarginVal}%
                              </span>
                            </div>
                          ) : (
                            <div>
                              <h4 className="text-lg font-bold text-gray-400 tracking-wider font-mono my-1">
                                {encodeCipher(dCostVal, cipherKey)}
                              </h4>
                              <span className="text-[9px] bg-amber-50 text-amber-600 font-bold font-mono px-1 rounded">
                                CIPHERED
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {userRole === 'Owner' ? (
                    <button
                      onClick={openPricingEditModal}
                      className="w-full text-center py-2 bg-[#2A2727] text-white hover:bg-gray-800 font-bold uppercase tracking-wider text-[11px]"
                      id="btn-edit-details-price"
                    >
                      Edit prices structures
                    </button>
                  ) : (
                    <div className="p-2 bg-yellow-50 border border-yellow-100 rounded text-[11px] text-gray-500 leading-normal flex items-start space-x-1">
                      <Info className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <span>Commercial modifications (purchase cost pricing, gross margin reports) require exclusive privilege permissions. Switch to Owner role above to alter rates.</span>
                    </div>
                  )}
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {/* RENDER MODAL: ADD PRODUCT */}
      {showAddModal && (
        <AddProductModal 
          userRole={userRole}
          onClose={() => setShowAddModal(false)}
          onSave={handleSaveProduct}
        />
      )}

      {/* RENDER MODAL: EDIT PRODUCT DETAILS */}
      {selectedProduct && showEditDetailsModal && (
        <EditProductModal
          product={selectedProduct}
          userRole={userRole}
          onClose={() => setShowEditDetailsModal(false)}
          onSave={handleEditProductSave}
        />
      )}

      {/* RENDER MODAL: LINK PRODUCT CROSS-REF */}
      {selectedProduct && showLinkModal && (
        <CrossRefModal 
          sourceProduct={selectedProduct}
          onClose={() => setShowLinkModal(false)}
          onSaved={() => {
            reloadData();
            setShowLinkModal(false);
          }}
        />
      )}

      {/* RENDER DIALOGS: ADJUST STOCK */}
      {selectedProduct && showStockAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" id="modal-adjust-stock-backdrop">
          <div className="bg-white w-full max-w-[400px] mx-4 border-t-4 border-t-[#0EA5E9] p-5 space-y-3">
            <h3 className="text-sm font-bold uppercase text-[#2A2727] tracking-wider mb-2">Adjust Sellable Inventory Qty</h3>
            <div>
              <label className="block text-gray-400 font-bold text-[10px] uppercase mb-1">Product reference</label>
              <p className="font-bold font-mono text-xs">{selectedProduct.brand} {selectedProduct.part_number}</p>
            </div>
            <div>
              <label className="block text-gray-600 font-bold mb-1">Set New Sellable Count</label>
              <input 
                type="number"
                value={newStockVal}
                onChange={e => setNewStockVal(e.target.value)}
                className="w-full text-xs p-2 border border-[#E2DFDF]"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-gray-600 font-bold mb-1">Reason for Stock Amendment</label>
              <input 
                type="text"
                value={stockAdjustReason}
                onChange={e => setStockAdjustReason(e.target.value)}
                placeholder="Counter audit, distributor returns etc."
                className="w-full text-xs p-2 border border-[#E2DFDF]"
              />
            </div>
            <div className="pt-3 flex justify-end space-x-2">
              <button onClick={() => setShowStockAdjustModal(false)} className="px-3 py-1.5 text-gray-500 border border-[#E2DFDF] text-xs font-semibold">Cancel</button>
              <button onClick={handleStockAdjustSave} className="px-4 py-1.5 bg-[#0EA5E9] text-white text-xs font-bold uppercase">Save Adjustment</button>
            </div>
          </div>
        </div>
      )}

      {/* RENDER DIALOGS: MARK DAMAGED */}
      {selectedProduct && showDamageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" id="modal-report-damage-backdrop">
          <div className="bg-white w-full max-w-[400px] mx-4 border-t-4 border-t-amber-500 p-5 space-y-3">
            <h3 className="text-sm font-bold uppercase text-[#2A2727] tracking-wider mb-2">Report Damaged Stock Fracture</h3>
            <div>
              <label className="block text-gray-400 font-bold text-[10px] uppercase mb-1">Product reference</label>
              <p className="font-bold font-mono text-xs">{selectedProduct.brand} {selectedProduct.part_number}</p>
              <p className="text-[10px] text-gray-400">Current Sellable Stock: {selectedProduct.stock_qty} units</p>
            </div>
            <div>
              <label className="block text-gray-600 font-bold mb-1">Subtract Damaged Quantity</label>
              <input 
                type="number"
                min="1"
                max={selectedProduct.stock_qty}
                value={damageQtyVal}
                onChange={e => setDamageQtyVal(e.target.value)}
                className="w-full text-xs p-2 border border-[#E2DFDF]"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-gray-600 font-bold mb-1">Reason / Event notes</label>
              <input 
                type="text"
                value={damageReason}
                onChange={e => setDamageReason(e.target.value)}
                placeholder="Dropped package, thread bent"
                className="w-full text-xs p-2 border border-[#E2DFDF]"
              />
            </div>
            <div className="pt-3 flex justify-end space-x-2">
              <button onClick={() => setShowDamageModal(false)} className="px-3 py-1.5 text-gray-500 border border-[#E2DFDF] text-xs font-semibold">Cancel</button>
              <button onClick={handleMarkDamagedSave} className="px-4 py-1.5 bg-amber-500 text-white text-xs font-bold uppercase">Report Damage</button>
            </div>
          </div>
        </div>
      )}

      {/* RENDER DIALOGS: EDIT PRICING */}
      {selectedProduct && showPricingEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" id="modal-edit-pricing-backdrop">
          <div className="bg-white w-full max-w-[400px] mx-4 border-t-4 border-t-[#2A2727] p-5 space-y-3">
            <h3 className="text-sm font-bold uppercase text-[#2A2727] tracking-wider mb-2">Update Commerce Pricing Rates</h3>
            <div>
              <label className="block text-gray-400 font-bold text-[10px] uppercase mb-1">Product reference</label>
              <p className="font-bold font-mono text-xs">{selectedProduct.brand} {selectedProduct.part_number}</p>
            </div>
            <div>
              <label className="block text-gray-600 font-bold mb-1">New Sale Price Retail (Rs.)</label>
              <input 
                type="number"
                value={editSalePrice}
                onChange={e => setEditSalePrice(e.target.value)}
                className="w-full text-xs p-2 border border-[#E2DFDF] font-mono font-bold"
                autoFocus
              />
            </div>
            {userRole === 'Owner' && (
              <div>
                <label className="block text-[#0EA5E9] font-bold mb-1">New Confidential Cost Price (Rs.)</label>
                <input 
                  type="number"
                  value={editCostPrice}
                  onChange={e => setEditCostPrice(e.target.value)}
                  className="w-full text-xs p-2 border border-[#E2DFDF] font-mono font-bold"
                />
              </div>
            )}
            <div className="pt-3 flex justify-end space-x-2">
              <button onClick={() => setShowPricingEditModal(false)} className="px-3 py-1.5 text-gray-500 border border-[#E2DFDF] text-xs font-semibold">Cancel</button>
              <button onClick={handlePricingSave} className="px-4 py-1.5 bg-[#2A2727] text-white text-xs font-bold uppercase">Save Prices</button>
            </div>
          </div>
        </div>
      )}

      {/* RENDER MODAL: BULK IMPORT EXPORT */}
      {showBulkImportModal && (
        <BulkImportExportModal
          products={products}
          userRole={userRole}
          onClose={() => setShowBulkImportModal(false)}
          onImport={handleBulkImportSave}
        />
      )}

      {/* RENDER MODAL: BULK EDIT FIELD BATCH */}
      {showSizeMatcher && (
        <SizeMatcherModal
          products={products}
          onClose={() => setShowSizeMatcher(false)}
        />
      )}

      {/* RENDER MODAL: BULK EDIT FIELD BATCH */}
      {showBulkEditModal && (
        <BulkEditModal
          selectedProducts={products.filter(p => selectedProductIds.includes(p.id))}
          userRole={userRole}
          onClose={() => setShowBulkEditModal(false)}
          onSave={handleBulkEditSave}
        />
      )}

      {/* FULLSCREEN RESPONSIVE LIGHTBOX MODAL */}
      {lightboxProduct && (
        <div 
          className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-slate-950/95 backdrop-blur-md p-4 md:p-6 animate-fade-in select-none"
          id="product-image-lightbox-overlay"
          onClick={() => setLightboxProduct(null)}
        >
          {/* Lightbox Header */}
          <div className="w-full max-w-6xl flex justify-between items-start text-white pt-2 pb-4 border-b border-white/10 z-10" onClick={e => e.stopPropagation()}>
            <div className="space-y-1">
              <span className="text-[10px] bg-sky-500 text-white font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Full-Size Image Inspector
              </span>
              <h2 className="text-lg md:text-xl font-bold font-sans tracking-tight">
                {lightboxProduct.brand} <span className="font-mono text-sky-400 font-black">{lightboxProduct.part_number}</span>
              </h2>
              {lightboxProduct.name && (
                <p className="text-xs md:text-sm text-slate-400 font-medium">
                  {lightboxProduct.name}
                </p>
              )}
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setLightboxProduct(null)}
              className="p-2.5 bg-white/10 hover:bg-white/20 border border-white/10 text-slate-300 hover:text-white rounded-full transition-all duration-200 cursor-pointer shadow-lg active:scale-95 flex items-center justify-center"
              title="Close (Esc)"
            >
              <X className="w-5.5 h-5.5 stroke-[2.5]" />
            </button>
          </div>

          {/* Lightbox Main Stage */}
          <div className="relative flex-1 w-full max-w-5xl flex items-center justify-center py-4" onClick={e => e.stopPropagation()}>
            {/* Left Chevron Button */}
            {(() => {
              const urls: string[] = [];
              if (lightboxProduct.image_urls && lightboxProduct.image_urls.length > 0) {
                urls.push(...lightboxProduct.image_urls);
              } else if (lightboxProduct.image_url) {
                urls.push(lightboxProduct.image_url);
              }

              if (urls.length <= 1) return null;

              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxImageIndex(prev => (prev - 1 + urls.length) % urls.length);
                  }}
                  className="absolute left-2 md:left-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 p-3.5 rounded-full shadow-2xl transition-all hover:scale-110 active:scale-90 cursor-pointer z-20 flex items-center justify-center"
                  title="Previous Image"
                >
                  <ChevronLeft className="w-6 h-6 stroke-[3.5]" />
                </button>
              );
            })()}

            {/* Central High-Res Image View */}
            {(() => {
              const urls: string[] = [];
              if (lightboxProduct.image_urls && lightboxProduct.image_urls.length > 0) {
                urls.push(...lightboxProduct.image_urls);
              } else if (lightboxProduct.image_url) {
                urls.push(lightboxProduct.image_url);
              }
              const currentUrl = urls[lightboxImageIndex] || lightboxProduct.image_url;

              return (
                <div className="w-full h-full max-h-[68vh] flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6 overflow-hidden shadow-2xl relative">
                  <img
                    src={currentUrl}
                    alt={`${lightboxProduct.part_number} Enlarged view`}
                    className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-xl select-none"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "https://placehold.co/800x600/1e293b/cbd5e1?text=Image+Not+Available";
                    }}
                  />
                  
                  {/* Floating Pagination Tracker */}
                  {urls.length > 1 && (
                    <span className="absolute bottom-4 bg-black/75 text-white/90 text-xs font-mono px-3.5 py-1 rounded-full border border-white/10 tracking-widest font-black select-none">
                      IMAGE {lightboxImageIndex + 1} OF {urls.length}
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Right Chevron Button */}
            {(() => {
              const urls: string[] = [];
              if (lightboxProduct.image_urls && lightboxProduct.image_urls.length > 0) {
                urls.push(...lightboxProduct.image_urls);
              } else if (lightboxProduct.image_url) {
                urls.push(lightboxProduct.image_url);
              }

              if (urls.length <= 1) return null;

              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxImageIndex(prev => (prev + 1) % urls.length);
                  }}
                  className="absolute right-2 md:right-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 p-3.5 rounded-full shadow-2xl transition-all hover:scale-110 active:scale-90 cursor-pointer z-20 flex items-center justify-center"
                  title="Next Image"
                >
                  <ChevronRight className="w-6 h-6 stroke-[3.5]" />
                </button>
              );
            })()}
          </div>

          {/* Lightbox Footer (Thumbnail strip + Keyboard instruction) */}
          {(() => {
            const urls: string[] = [];
            if (lightboxProduct.image_urls && lightboxProduct.image_urls.length > 0) {
              urls.push(...lightboxProduct.image_urls);
            } else if (lightboxProduct.image_url) {
              urls.push(lightboxProduct.image_url);
            }

            return (
              <div className="w-full max-w-2xl flex flex-col items-center space-y-3 pb-2 z-10" onClick={e => e.stopPropagation()}>
                {urls.length > 1 && (
                  <div className="flex items-center justify-center gap-2 max-w-full overflow-x-auto py-2 scrollbar-thin">
                    {urls.map((url, idx) => {
                      const isActive = lightboxImageIndex === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setLightboxImageIndex(idx)}
                          className={`relative w-14 h-14 rounded-lg border flex-shrink-0 overflow-hidden transition-all duration-250 p-0.5 shadow-md ${
                            isActive
                              ? 'border-sky-400 ring-4 ring-sky-500/30 scale-110 bg-white'
                              : 'border-white/20 hover:border-white/50 bg-white/10 hover:bg-white/20'
                          }`}
                        >
                          <img
                            src={url}
                            alt="thumbnail"
                            className="w-full h-full object-contain pointer-events-none rounded"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = "https://placehold.co/100x100/1e293b/cbd5e1?text=N/A";
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-[10px] text-slate-500 font-mono font-bold tracking-wider uppercase select-none text-center">
                  💡 Tip: Click outside image or press X button to close view.
                </p>
              </div>
            );
          })()}
        </div>
      )}

    </div>
  );
}
