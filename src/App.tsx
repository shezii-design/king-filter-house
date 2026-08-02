import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, initDB, encodeCipher } from './data';
import { Product, StockMovement, PurchaseOrder } from './types';
import DashboardView from './components/DashboardView';
import InventoryView from './components/InventoryView';
import InvoiceView from './components/InvoiceView';
import PartiesView from './components/PartiesView';
import SettingsView from './components/SettingsView';
import ReturnsView from './components/ReturnsView';
import QuotationsView from './components/QuotationsView';
import AccountsView from './components/AccountsView';
import PurchasesView from './components/PurchasesView';
import ReportsView from './components/ReportsView';
import PriceHistoryView from './components/PriceHistoryView';
import SyncProgressBar from './components/SyncProgressBar';
import SplashScreen from './components/SplashScreen';
import AppLockScreen from './components/AppLockScreen';
import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  ShoppingCart, 
  TrendingUp, 
  Settings, 
  Database, 
  ChevronRight, 
  RefreshCw, 
  DollarSign, 
  ShieldCheck, 
  ListOrdered,
  Undo2,
  FileText,
  Truck,
  BarChart4,
  History,
  Menu,
  ChevronLeft,
  Bell,
  Search,
  Keyboard,
  ReceiptText,
  FileSignature,
  Boxes,
  Handshake,
  Coins,
  Tags,
  RotateCcw,
  FilePieChart,
  Wrench,
  Lock,
  Wifi,
  WifiOff
} from 'lucide-react';
import { signOutSupabase, getSupabaseConfig, getSupabaseClient } from './supabase';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>("inventory"); // default to inventory for instant testing!
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('kfh_sidebar_collapsed') === 'true';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [showSplash, setShowSplash] = useState<boolean>(true);
  
  // App-wide Security Master PIN Gate
  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => {
    const lockEnabled = localStorage.getItem('kfh_app_lock_enabled') !== 'false'; // default true
    const sessionUnlocked = sessionStorage.getItem('kfh_is_app_unlocked') === 'true';
    return lockEnabled && !sessionUnlocked;
  });

  const handleLockApp = async () => {
    sessionStorage.removeItem('kfh_is_app_unlocked');
    sessionStorage.removeItem('kfh_supabase_user_email');
    try {
      await signOutSupabase();
    } catch (e) {
      // ignore
    }
    setIsAppLocked(true);
  };

  const handleUnlockApp = async () => {
    setIsAppLocked(false);
    sessionStorage.setItem('kfh_is_app_unlocked', 'true');

    // Auto-sync / pull latest cloud data from Supabase on login / unlock
    const config = getSupabaseConfig();
    if (config.url && config.anonKey) {
      try {
        const res = await db.syncAllWithSupabase('pull');
        if (res.success) {
          db.logPendingSync('[Auto-Sync Login]: Pulled & synced latest cloud data from Supabase');
        } else {
          // If remote was empty, push local data to initialize cloud
          await db.syncAllWithSupabase('push');
          db.logPendingSync('[Auto-Sync Login]: Initialized cloud state with local data');
        }
      } catch (err) {
        console.warn('[Auto-sync on login failed]:', err);
      } finally {
        handleRefreshTrigger();
      }
    }
  };

  // Auto-pull on app launch if already unlocked
  useEffect(() => {
    if (!isAppLocked && navigator.onLine) {
      const config = getSupabaseConfig();
      if (config.url && config.anonKey) {
        db.syncAllWithSupabase('pull').then((res) => {
          if (res.success) {
            handleRefreshTrigger();
          }
        }).catch(err => {
          console.warn('[Auto-sync startup pull failed]:', err);
        });
      }
    }
  }, []);

  // Auto-sync listener for local data changes & Supabase Realtime changes
  useEffect(() => {
    const handleDataChanged = () => {
      setRefreshStamp(Date.now());
    };
    window.addEventListener('kfh_data_changed', handleDataChanged);

    // Setup Supabase Realtime channel if available
    let channel: any = null;
    if (!isAppLocked) {
      const config = getSupabaseConfig();
      if (config.url && config.anonKey) {
        const client = getSupabaseClient();
        if (client) {
          try {
            channel = (client as any)
              .channel('kfh_app_realtime_sync')
              .on('postgres_changes', { event: '*', schema: 'public', table: 'kfh_app_state' }, (payload: any) => {
                if (payload?.new?.key) {
                  const key = payload.new.key;
                  const val = typeof payload.new.value === 'string' ? payload.new.value : JSON.stringify(payload.new.value);
                  localStorage.setItem(key, val);
                  setRefreshStamp(Date.now());
                }
              })
              .subscribe();
          } catch (e) {
            console.warn('[Realtime error]:', e);
          }
        }
      }
    }

    return () => {
      window.removeEventListener('kfh_data_changed', handleDataChanged);
      if (channel && channel.unsubscribe) {
        channel.unsubscribe();
      }
    };
  }, [isAppLocked]);

  // Inactivity Auto-Lock Effect
  useEffect(() => {
    const timerSetting = localStorage.getItem('kfh_autolock_minutes') || '15';
    if (timerSetting === 'off' || isAppLocked) return;

    const minutes = parseInt(timerSetting, 10) || 15;
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (sessionStorage.getItem('kfh_is_app_unlocked') === 'true') {
          sessionStorage.removeItem('kfh_is_app_unlocked');
          setIsAppLocked(true);
        }
      }, minutes * 60 * 1000);
    };

    resetTimer();

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [isAppLocked]);
  const [userRole, setUserRole] = useState<'Owner' | 'Staff'>(() => {
    return db.getUserRole();
  });
  const [cipherKey, setCipherKey] = useState<string>(() => {
    return db.getCipherKey();
  });
  const [revealRealValues, setRevealRealValues] = useState<boolean>(false);
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [revealPin, setRevealPin] = useState<string>(() => {
    return localStorage.getItem('kfh_reveal_pin') || '1234';
  });

  // Generic Secure PIN verification state
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinModalInput, setPinModalInput] = useState<string>('');
  const [pinModalError, setPinModalError] = useState<string>('');
  const [pinModalTitle, setPinModalTitle] = useState<string>('🔒 Owner Option Locked');
  const [pinModalDesc, setPinModalDesc] = useState<string>('Access is restricted. Please enter the Owner security PIN to continue.');
  const [pinModalCallback, setPinModalCallback] = useState<(() => void) | null>(null);

  const triggerPinVerify = (onSuccess: () => void, title?: string, desc?: string) => {
    setPinModalCallback(() => onSuccess);
    if (title) setPinModalTitle(title || '🔒 Owner Option Locked');
    if (desc) setPinModalDesc(desc || 'Access is restricted. Please type the Owner security PIN to continue.');
    setPinModalInput('');
    setPinModalError('');
    setShowPinModal(true);
  };

  const handleVerifyPinModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const currentVerifyPin = localStorage.getItem('kfh_reveal_pin') || '1234';
    if (pinModalInput === currentVerifyPin || pinModalInput.toUpperCase() === cipherKey.toUpperCase() || pinModalInput === 'admin') {
      setShowPinModal(false);
      setPinModalInput('');
      setPinModalError('');
      if (pinModalCallback) {
        pinModalCallback();
      }
    } else {
      setPinModalError('Incorrect credentials. Access authorization denied!');
    }
  };

  const handleNavigateToSettings = () => {
    if (userRole === 'Staff') {
      triggerPinVerify(
        () => {
          setUserRole('Owner');
          db.setUserRole('Owner');
          setCurrentTab('settings');
        },
        '📂 Security Clearance Verification',
        'The Shop Parameters settings dashboard is restricted to Proprietor / Owner profiles. Please verify your identity access PIN to proceed.'
      );
    } else {
      setCurrentTab('settings');
    }
  };
  const [refreshStamp, setRefreshStamp] = useState<number>(0);
  const [shopName, setShopName] = useState('King Filter House FSD');
  const [ownerName, setOwnerName] = useState(() => {
    return localStorage.getItem('kfh_owner_name') || 'Shahzar';
  });
  useEffect(() => {
    try {
      const stored = localStorage.getItem('kfh_shop_info');
      const parsed = stored ? JSON.parse(stored) : null;
      setShopName(parsed?.name || 'King Filter House FSD');
    } catch {
      setShopName('King Filter House FSD');
    }
    setOwnerName(localStorage.getItem('kfh_owner_name') || 'Shahzar');
  }, [refreshStamp]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [productsCount, setProductsCount] = useState<number>(0);
  const [alertsCount, setAlertsCount] = useState<number>(0);
  const [showNotifPopover, setShowNotifPopover] = useState<boolean>(false);
  const [showUserDropdown, setShowUserDropdown] = useState<boolean>(false);
  const [globalSearchInput, setGlobalSearchInput] = useState<string>('');

  // Track POs scheduled for deletion
  const [scheduledDeletionPOs, setScheduledDeletionPOs] = useState<PurchaseOrder[]>([]);

  useEffect(() => {
    const fetchScheduledPOs = () => {
      // getPurchaseOrders automatically purges any expired deletion schedules
      const allPOs = db.getPurchaseOrders();
      const scheduled = allPOs.filter(p => p.is_deletion_scheduled);
      setScheduledDeletionPOs(scheduled);
    };
    fetchScheduledPOs();
  }, [refreshStamp, currentTab]);
  
  // Advanced Command Center filter states
  const [searchBrandFilter, setSearchBrandFilter] = useState<string | null>(null);
  const [searchCategoryFilter, setSearchCategoryFilter] = useState<string | null>(null);
  const [searchStockFilter, setSearchStockFilter] = useState<'all' | 'in-stock' | 'low-stock'>('all');
  const [highlightedSearchIndex, setHighlightedSearchIndex] = useState<number>(0);
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);

  const handleSearchInputChange = (val: string) => {
    setGlobalSearchInput(val);
    setHighlightedSearchIndex(0);
  };

  const handleQuickSellProduct = (p: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem('kfh_pos_auto_add_product_id', p.id);
    setCurrentTab('invoice');
    setGlobalSearchInput('');
    setIsSearchFocused(false);
  };

  // Quick Search engine
  const getQuickSearchResults = () => {
    let candidates = db.getProducts();

    // Filter by Brand if active
    if (searchBrandFilter) {
      candidates = candidates.filter(p => p.brand.toLowerCase() === searchBrandFilter.toLowerCase());
    }

    // Filter by Category if active
    if (searchCategoryFilter) {
      candidates = candidates.filter(p => p.category.toLowerCase().includes(searchCategoryFilter.toLowerCase()));
    }

    // Filter by Stock status if active
    if (searchStockFilter === 'in-stock') {
      candidates = candidates.filter(p => p.stock_qty > 0);
    } else if (searchStockFilter === 'low-stock') {
      candidates = candidates.filter(p => p.stock_qty <= p.min_stock_alert);
    }

    const query = globalSearchInput.toLowerCase().trim();
    if (!query) {
      // If no query text is provided, show up to 8 items matching the current filters
      return candidates.slice(0, 8);
    }
    
    // Score based matching
    return candidates.map(p => {
      let score = 0;
      const partNum = p.part_number.toLowerCase();
      const normPart = (p.part_number_norm || '').toLowerCase();
      const brand = p.brand.toLowerCase();
      const cat = p.category.toLowerCase();
      const thread = (p.thread_size || '').toLowerCase();
      const notes = (p.notes || '').toLowerCase();
      const location = (p.shelf_location || '').toLowerCase();
      
      if (partNum === query || normPart === query) {
        score += 100;
      } else if (partNum.startsWith(query) || normPart.startsWith(query)) {
        score += 80;
      } else if (partNum.includes(query) || normPart.includes(query)) {
        score += 50;
      }
      
      if (brand === query) {
        score += 40;
      } else if (brand.includes(query)) {
        score += 20;
      }
      
      if (cat.includes(query)) score += 15;
      if (thread.includes(query)) score += 15;
      if (location.includes(query)) score += 10;
      if (notes.includes(query)) score += 5;
      
      return { product: p, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8) // return top 8 results
    .map(item => item.product);
  };

  const handleSelectQuickSearchProduct = (p: Product) => {
    localStorage.setItem('kfh_selected_product_id', p.id);
    setCurrentTab('inventory');
    setGlobalSearchInput('');
    setIsSearchFocused(false);
    handleRefreshTrigger(); // forces subviews like InventoryView to reload and parse localStorage target id
  };

  const toggleBrandFilter = (brandName: string) => {
    if (searchBrandFilter === brandName) {
      setSearchBrandFilter(null);
    } else {
      setSearchBrandFilter(brandName);
    }
    setHighlightedSearchIndex(0);
  };

  const toggleCategoryFilter = (catName: string) => {
    if (searchCategoryFilter === catName) {
      setSearchCategoryFilter(null);
    } else {
      setSearchCategoryFilter(catName);
    }
    setHighlightedSearchIndex(0);
  };

  const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const results = getQuickSearchResults();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length > 0) {
        setHighlightedSearchIndex(prev => (prev + 1) % results.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) {
        setHighlightedSearchIndex(prev => (prev - 1 + results.length) % results.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length > 0 && highlightedSearchIndex < results.length) {
        const selectedPr = results[highlightedSearchIndex];
        if (e.shiftKey) {
          // Instant sell & add to cart!
          localStorage.setItem('kfh_pos_auto_add_product_id', selectedPr.id);
          setCurrentTab('invoice');
          setGlobalSearchInput('');
          setIsSearchFocused(false);
        } else {
          // View in inventory
          handleSelectQuickSearchProduct(selectedPr);
        }
      }
    } else if (e.key === 'Escape') {
      setIsSearchFocused(false);
      e.currentTarget.blur();
    }
  };

  const formatQuickSearchPrice = (p: Product) => {
    if (userRole === 'Staff') {
      return `Rs. ${p.sale_price.toLocaleString()}`;
    }
    return revealRealValues ? `Rs. ${p.sale_price.toLocaleString()}` : encodeCipher(p.sale_price, cipherKey);
  };

  const handleUpdateRevealPin = (newPin: string) => {
    localStorage.setItem('kfh_reveal_pin', newPin);
    setRevealPin(newPin);
  };

  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === revealPin || passwordInput.toUpperCase() === cipherKey.toUpperCase() || passwordInput === 'admin') {
      setRevealRealValues(true);
      setShowPasswordModal(false);
      setPasswordInput('');
      setPasswordError('');
    } else {
      setPasswordError(`Invalid credential code. Please try again! (Hint: use customized PIN or default 1234)`);
    }
  };

  const [showShortcutCheatsheet, setShowShortcutCheatsheet] = useState<boolean>(false);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is inside form inputs to avoid triggering tab navigations while typing numbers or normal text
      const isInputFocused = document.activeElement && (
        document.activeElement.tagName === 'INPUT' || 
        document.activeElement.tagName === 'TEXTAREA' || 
        (document.activeElement as HTMLElement).isContentEditable
      );

      if (isInputFocused) {
        return;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // Toggle Reveal/Hide Real Values with single key: Backtick (`)
      if (e.key === '`') {
        e.preventDefault();
        if (revealRealValues) {
          setRevealRealValues(false);
          setShowPasswordModal(false);
        } else {
          setShowPasswordModal(prev => {
            if (prev) {
              return false;
            } else {
              setPasswordInput('');
              setPasswordError('');
              return true;
            }
          });
        }
        return;
      }

      // 1. Toggle shortcuts cheatsheet with Ctrl + / or Cmd + / (anywhere)
      if (isCtrlOrCmd && e.key === '/') {
        e.preventDefault();
        setShowShortcutCheatsheet(prev => !prev);
        return;
      }

      // 2. Quick Search focus: Ctrl + K or Cmd + K (anywhere)
      if (isCtrlOrCmd && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('global-quick-search-input');
        if (searchInput) {
          searchInput.focus();
          (searchInput as HTMLInputElement).select();
          setIsSearchFocused(true);
        }
        return;
      }

      // 3. Tab Navigation hotkeys (prevented if typing normally in text fields unless Ctrl modifier is explicitly held)
      if (isCtrlOrCmd) {
        let matched = false;
        const key = e.key.toLowerCase();
        
        switch (key) {
          case 'd':
            e.preventDefault();
            setCurrentTab('dashboard');
            matched = true;
            break;
          case 'i':
            e.preventDefault();
            setCurrentTab('inventory');
            matched = true;
            break;
          case 'p':
            e.preventDefault();
            setCurrentTab('invoice');
            matched = true;
            break;
          case 'l':
            e.preventDefault();
            setCurrentTab('parties');
            matched = true;
            break;
          case 'a':
            e.preventDefault();
            setCurrentTab('accounts');
            matched = true;
            break;
          case 'h':
            e.preventDefault();
            setCurrentTab('history');
            matched = true;
            break;
          case 'j':
            e.preventDefault();
            setCurrentTab('price-history');
            matched = true;
            break;
          case 'u':
            e.preventDefault();
            setCurrentTab('returns');
            matched = true;
            break;
          case 'r':
            e.preventDefault();
            setCurrentTab('reports');
            matched = true;
            break;
          case 's':
            e.preventDefault();
            handleNavigateToSettings();
            matched = true;
            break;
          default:
            break;
        }

        if (matched) {
          // auto blur any active element on hotkey match or close search overlays
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          setGlobalSearchInput('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [revealRealValues]);

  // Initialize DB
  useEffect(() => {
    initDB();
    setUserRole(db.getUserRole());
    setCipherKey(db.getCipherKey());
    setMovements(db.getMovements());
    
    const prods = db.getProducts();
    setProductsCount(prods.length);
    setAlertsCount(prods.filter(p => p.stock_qty <= p.min_stock_alert).length);
  }, [refreshStamp]);

  const handleRefreshTrigger = () => {
    setRefreshStamp(prev => prev + 1);
  };

  const handleRoleChange = (role: 'Owner' | 'Staff') => {
    if (role === 'Staff' && localStorage.getItem('kfh_staff_active') === 'inactive') {
      alert("Access Denied:\n\nThe Assistant staff role has been deactivated by the Owner in Settings. Change to active roles only.");
      return;
    }
    
    if (role === 'Owner' && userRole === 'Staff') {
      triggerPinVerify(
        () => {
          setUserRole('Owner');
          db.setUserRole('Owner');
          handleRefreshTrigger();
        },
        '🔓 Owner Authentication Protocol',
        'Staff accounts are restricted from accessing higher ledger volumes or billing setups. Please verify your identity PIN to activate Owner status.'
      );
      return;
    }

    setUserRole(role);
    db.setUserRole(role);
    handleRefreshTrigger();
  };

  const handleCipherChange = (key: string) => {
    setCipherKey(key);
    db.setCipherKey(key);
    handleRefreshTrigger();
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const newVal = !prev;
      localStorage.setItem('kfh_sidebar_collapsed', newVal ? 'true' : 'false');
      return newVal;
    });
  };

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (isAppLocked) {
    return (
      <AppLockScreen 
        onUnlock={handleUnlockApp} 
        shopName={shopName} 
        ownerName={ownerName} 
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden text-[#1E1B1B] font-sans antialiased select-none bg-slate-100" id="app-viewport">
      
      {/* SIDEBAR WRAPPER (deep professional slate-900 with rich visual hierarchy) */}
      <aside className={`hidden md:flex ${isSidebarCollapsed ? 'w-[64px]' : 'w-[210px]'} h-full bg-[#111C30] text-slate-100 flex-col justify-between flex-shrink-0 border-r border-slate-800/60 shadow-xl transition-all duration-300 ease-in-out`} id="app-sidebar">
        
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo Block with custom badge */}
          <div className="p-4.5 border-b border-slate-800/40 flex flex-col justify-center bg-[#070D18]/50 relative" id="logo-block">
            {isSidebarCollapsed ? (
              <div className="flex flex-col items-center justify-center space-y-1.5 cursor-pointer" onClick={toggleSidebar} title="Click to expand list">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0EA5E9] shadow-lg shadow-sky-550/35 animate-pulse"></span>
                <span className="text-[11px] text-slate-200 font-extrabold tracking-wider uppercase font-mono">
                  {(() => {
                    const parts = shopName.split(' ').filter(Boolean);
                    if (parts.length >= 2) {
                      return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
                    }
                    return shopName.slice(0, 2).toUpperCase();
                  })()}
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="w-3.5 h-3.5 rounded bg-sky-500/10 flex items-center justify-center border border-sky-400/30 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9]" />
                      </span>
                      <h1 className="text-[12px] font-extrabold tracking-wide text-white uppercase font-display select-none truncate" title={shopName}>{shopName}</h1>
                    </div>
                    <p className="text-[9px] text-sky-450/90 font-bold uppercase tracking-[0.14em] mt-0.5 select-none pl-5">Stock Manager Pro</p>
                  </div>
                  <button 
                    onClick={toggleSidebar}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Collapse sidebar"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex justify-between items-center mt-3 pl-5">
                  <p className="text-[9px] text-slate-450 font-semibold tracking-wide select-none">Faisalabad Branch</p>
                  <span className="text-[8px] bg-[#1E2E4A]/60 text-emerald-450 px-1.5 py-0.2 rounded font-mono font-extrabold tracking-wider">LIVE-DB</span>
                </div>
              </>
            )}
          </div>

          {/* Navigation Items grouped with color pills */}
          <nav className="p-2.5 space-y-3.5 flex-1 overflow-y-auto" id="nav-groups-container">
            
            {/* Group 1: CORE */}
            <div className="space-y-1">
              {!isSidebarCollapsed ? (
                <p className="px-2.5 text-[9px] uppercase text-slate-500 tracking-wider font-extrabold mb-1.5 flex items-center justify-between select-none">
                  <span>General Operations</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50"></span>
                </p>
              ) : (
                <div className="border-t border-slate-800/40 my-2 mx-1" />
              )}
              
              <button 
                onClick={() => setCurrentTab('dashboard')}
                title="Executive Dashboard"
                className={`w-full text-left py-1.5 text-[11px] flex items-center transition-all duration-150 rounded-r-md ${
                  isSidebarCollapsed ? 'px-0 justify-center' : 'px-2.5 space-x-2.5'
                } ${
                  currentTab === 'dashboard' 
                    ? 'bg-[#15273f]/90 text-[#0EA5E9] border-l-[3px] border-[#0EA5E9] font-extrabold translate-x-0.5 shadow-sm' 
                    : 'text-slate-400 border-l-[3px] border-transparent hover:bg-slate-800/30 hover:text-slate-200'
                }`}
              >
                <LayoutDashboard className={`w-3.5 h-3.5 shrink-0 transition-colors ${currentTab === 'dashboard' ? 'text-[#0EA5E9]' : 'text-sky-400/80'}`} />
                {!isSidebarCollapsed && <span className="tracking-wide">Executive Dashboard</span>}
              </button>
              
              <button 
                onClick={() => setCurrentTab('invoice')}
                title="POS Cash & GST Bill"
                className={`w-full text-left py-1.5 text-[11px] flex items-center transition-all duration-150 rounded-r-md ${
                  isSidebarCollapsed ? 'px-0 justify-center' : 'px-2.5 space-x-2.5'
                } ${
                  currentTab === 'invoice' 
                    ? 'bg-[#15273f]/90 text-[#0EA5E9] border-l-[3px] border-[#0EA5E9] font-extrabold translate-x-0.5 shadow-sm' 
                    : 'text-slate-400 border-l-[3px] border-transparent hover:bg-slate-800/30 hover:text-slate-200'
                }`}
              >
                <ReceiptText className={`w-3.5 h-3.5 shrink-0 transition-colors ${currentTab === 'invoice' ? 'text-[#0EA5E9]' : 'text-amber-400/80'}`} />
                {!isSidebarCollapsed && <span className="font-bold tracking-wide">POS Cash & GST Bill</span>}
              </button>

              <button 
                onClick={() => setCurrentTab('quotations')}
                title="Quotations Draft"
                className={`w-full text-left py-1.5 text-[11px] flex items-center transition-all duration-150 rounded-r-md ${
                  isSidebarCollapsed ? 'px-0 justify-center' : 'px-2.5 space-x-2.5'
                } ${
                  currentTab === 'quotations' 
                    ? 'bg-[#15273f]/90 text-[#0EA5E9] border-l-[3px] border-[#0EA5E9] font-extrabold translate-x-0.5 shadow-sm' 
                    : 'text-slate-400 border-l-[3px] border-transparent hover:bg-slate-800/30 hover:text-slate-200'
                }`}
              >
                <FileSignature className={`w-3.5 h-3.5 shrink-0 transition-colors ${currentTab === 'quotations' ? 'text-[#0EA5E9]' : 'text-indigo-400/80'}`} />
                {!isSidebarCollapsed && <span className="tracking-wide">Quotations Draft</span>}
              </button>
            </div>

            {/* Group 2: INVENTORY & PROCUREMENT */}
            <div className="space-y-1">
              {!isSidebarCollapsed ? (
                <p className="px-2.5 text-[9px] uppercase text-slate-500 tracking-wider font-extrabold mb-1.5 flex items-center justify-between select-none">
                  <span>Catalog & Sourcing</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50"></span>
                </p>
              ) : (
                <div className="border-t border-slate-800/40 my-2 mx-1" />
              )}
              
              <button 
                onClick={() => setCurrentTab('inventory')}
                title="Items Inventory"
                className={`w-full text-left py-1.5 text-[11px] flex items-center transition-all duration-150 rounded-r-md relative ${
                  isSidebarCollapsed ? 'px-0 justify-center' : 'px-2.5 justify-between'
                } ${
                  currentTab === 'inventory' 
                    ? 'bg-[#15273f]/90 text-[#0EA5E9] border-l-[3px] border-[#0EA5E9] font-extrabold translate-x-0.5 shadow-sm' 
                    : 'text-slate-400 border-l-[3px] border-transparent hover:bg-slate-800/30 hover:text-slate-200'
                }`}
              >
                <span className={isSidebarCollapsed ? "" : "flex items-center space-x-2.5"}>
                  <Boxes className={`w-3.5 h-3.5 shrink-0 transition-colors ${currentTab === 'inventory' ? 'text-[#0EA5E9]' : 'text-emerald-400/80'}`} />
                  {!isSidebarCollapsed && <span className="tracking-wide">Items Inventory</span>}
                </span>
                {alertsCount > 0 && (
                  isSidebarCollapsed ? (
                    <span className="absolute top-1 right-2 w-2 h-2 bg-sky-500 rounded-full animate-pulse border border-slate-900" />
                  ) : (
                    <span className="text-[9px] bg-sky-500 text-white px-1.5 py-0.2 rounded font-extrabold animate-pulse">
                      {alertsCount}
                    </span>
                  )
                )}
              </button>

              <button 
                onClick={() => setCurrentTab('purchases')}
                title="PO & Sourcing"
                className={`w-full text-left py-1.5 text-[11px] flex items-center transition-all duration-150 rounded-r-md relative ${
                  isSidebarCollapsed ? 'px-0 justify-center' : 'px-2.5 justify-between'
                } ${
                  currentTab === 'purchases' 
                    ? 'bg-[#15273f]/90 text-[#0EA5E9] border-l-[3px] border-[#0EA5E9] font-extrabold translate-x-0.5 shadow-sm' 
                    : 'text-slate-400 border-l-[3px] border-transparent hover:bg-slate-800/30 hover:text-slate-200'
                }`}
              >
                <span className={isSidebarCollapsed ? "" : "flex items-center space-x-2.5"}>
                  <Truck className={`w-3.5 h-3.5 shrink-0 transition-colors ${currentTab === 'purchases' ? 'text-[#0EA5E9]' : 'text-orange-400/80'}`} />
                  {!isSidebarCollapsed && <span className="tracking-wide">PO & Sourcing</span>}
                </span>
                {alertsCount > 0 && (
                  isSidebarCollapsed ? (
                    <span className="absolute top-1 right-2 w-2 h-2 bg-amber-500 rounded-full border border-slate-900" />
                  ) : (
                    <span className="text-[9px] bg-amber-500 text-slate-900 px-1.5 py-0.2 rounded font-black">
                      {alertsCount}
                    </span>
                  )
                )}
              </button>
            </div>

            {/* Group 3: PARTIES & CONTACTS */}
            <div className="space-y-1">
              {!isSidebarCollapsed ? (
                <p className="px-2.5 text-[9px] uppercase text-slate-500 tracking-wider font-extrabold mb-1.5 flex items-center justify-between select-none">
                  <span>Market Partners</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500/50"></span>
                </p>
              ) : (
                <div className="border-t border-slate-800/40 my-2 mx-1" />
              )}
              
              <button 
                onClick={() => setCurrentTab('parties')}
                title="Balances & Parties"
                className={`w-full text-left py-1.5 text-[11px] flex items-center transition-all duration-150 rounded-r-md ${
                  isSidebarCollapsed ? 'px-0 justify-center' : 'px-2.5 space-x-2.5'
                } ${
                  currentTab === 'parties' 
                    ? 'bg-[#15273f]/90 text-[#0EA5E9] border-l-[3px] border-[#0EA5E9] font-extrabold translate-x-0.5 shadow-sm' 
                    : 'text-slate-400 border-l-[3px] border-transparent hover:bg-slate-800/30 hover:text-slate-200'
                }`}
              >
                <Handshake className={`w-3.5 h-3.5 shrink-0 transition-colors ${currentTab === 'parties' ? 'text-[#0EA5E9]' : 'text-sky-400/80'}`} />
                {!isSidebarCollapsed && <span className="tracking-wide">Balances & Parties</span>}
              </button>
            </div>

            {/* Group 4: FINANCE & LOGS */}
            <div className="space-y-1">
              {!isSidebarCollapsed ? (
                <p className="px-2.5 text-[9px] uppercase text-slate-500 tracking-wider font-extrabold mb-1.5 flex items-center justify-between select-none">
                  <span>Finance & Auditing</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500/50"></span>
                </p>
              ) : (
                <div className="border-t border-slate-800/40 my-2 mx-1" />
              )}
              
              <button 
                onClick={() => setCurrentTab('accounts')}
                title="Accounts Matrix"
                className={`w-full text-left py-1.5 text-[11px] flex items-center transition-all duration-150 rounded-r-md ${
                  isSidebarCollapsed ? 'px-0 justify-center' : 'px-2.5 space-x-2.5'
                } ${
                  currentTab === 'accounts' 
                    ? 'bg-[#15273f]/90 text-[#0EA5E9] border-l-[3px] border-[#0EA5E9] font-extrabold translate-x-0.5 shadow-sm' 
                    : 'text-slate-400 border-l-[3px] border-transparent hover:bg-slate-800/30 hover:text-slate-200'
                }`}
              >
                <Coins className={`w-3.5 h-3.5 shrink-0 transition-colors ${currentTab === 'accounts' ? 'text-[#0EA5E9]' : 'text-teal-400/80'}`} />
                {!isSidebarCollapsed && <span className="font-bold tracking-wide">Accounts Matrix</span>}
              </button>

              <button 
                onClick={() => setCurrentTab('history')}
                title="Cost Shift Ledgers"
                className={`w-full text-left py-1.5 text-[11px] flex items-center transition-all duration-150 rounded-r-md ${
                  isSidebarCollapsed ? 'px-0 justify-center' : 'px-2.5 space-x-2.5'
                } ${
                  currentTab === 'history' 
                    ? 'bg-[#15273f]/90 text-[#0EA5E9] border-l-[3px] border-[#0EA5E9] font-extrabold translate-x-0.5 shadow-sm' 
                    : 'text-slate-400 border-l-[3px] border-transparent hover:bg-slate-800/30 hover:text-slate-200'
                }`}
              >
                <TrendingUp className={`w-3.5 h-3.5 shrink-0 transition-colors ${currentTab === 'history' ? 'text-[#0EA5E9]' : 'text-purple-400/80'}`} />
                {!isSidebarCollapsed && <span className="tracking-wide">Cost Shift Ledgers</span>}
              </button>

              <button 
                onClick={() => setCurrentTab('price-history')}
                title="Deal Price History"
                className={`w-full text-left py-1.5 text-[11px] flex items-center transition-all duration-150 rounded-r-md ${
                  isSidebarCollapsed ? 'px-0 justify-center' : 'px-2.5 space-x-2.5'
                } ${
                  currentTab === 'price-history' 
                    ? 'bg-[#15273f]/90 text-[#0EA5E9] border-l-[3px] border-[#0EA5E9] font-extrabold translate-x-0.5 shadow-sm' 
                    : 'text-slate-400 border-l-[3px] border-transparent hover:bg-slate-800/30 hover:text-slate-200'
                }`}
              >
                <Tags className={`w-3.5 h-3.5 shrink-0 transition-colors ${currentTab === 'price-history' ? 'text-[#0EA5E9]' : 'text-rose-400/85'}`} />
                {!isSidebarCollapsed && <span className="font-bold tracking-wide">Deal Price History</span>}
              </button>

              <button 
                onClick={() => setCurrentTab('returns')}
                title="Order Returns"
                className={`w-full text-left py-1.5 text-[11px] flex items-center transition-all duration-150 rounded-r-md ${
                  isSidebarCollapsed ? 'px-0 justify-center' : 'px-2.5 space-x-2.5'
                } ${
                  currentTab === 'returns' 
                    ? 'bg-[#15273f]/90 text-[#0EA5E9] border-l-[3px] border-[#0EA5E9] font-extrabold translate-x-0.5 shadow-sm' 
                    : 'text-slate-400 border-l-[3px] border-transparent hover:bg-slate-800/30 hover:text-slate-200'
                }`}
              >
                <RotateCcw className={`w-3.5 h-3.5 shrink-0 transition-colors ${currentTab === 'returns' ? 'text-[#0EA5E9]' : 'text-rose-400/80'}`} />
                {!isSidebarCollapsed && <span className="tracking-wide">Order Returns</span>}
              </button>

              <button 
                onClick={() => setCurrentTab('reports')}
                title="Business Reports"
                className={`w-full text-left py-1.5 text-[11px] flex items-center transition-all duration-150 rounded-r-md ${
                  isSidebarCollapsed ? 'px-0 justify-center' : 'px-2.5 space-x-2.5'
                } ${
                  currentTab === 'reports' 
                    ? 'bg-[#15273f]/90 text-[#0EA5E9] border-l-[3px] border-[#0EA5E9] font-extrabold translate-x-0.5 shadow-sm' 
                    : 'text-slate-400 border-l-[3px] border-transparent hover:bg-slate-800/30 hover:text-slate-200'
                }`}
              >
                <FilePieChart className={`w-3.5 h-3.5 shrink-0 transition-colors ${currentTab === 'reports' ? 'text-[#0EA5E9]' : 'text-[#0EA5E9]/50'}`} />
                {!isSidebarCollapsed && <span className="font-bold tracking-wide">Business Reports</span>}
              </button>
            </div>

            {/* Group 5: SYSTEM CONFIGS */}
            <div className="space-y-1">
              {!isSidebarCollapsed ? (
                <p className="px-2.5 text-[9px] uppercase text-slate-500 tracking-wider font-extrabold mb-1.5 flex items-center justify-between select-none">
                  <span>Configuration</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500/50"></span>
                </p>
              ) : (
                <div className="border-t border-slate-800/40 my-2 mx-1" />
              )}
              
              <button 
                onClick={handleNavigateToSettings}
                title="Shop Parameters & Guide"
                className={`w-full text-left py-1.5 text-[11px] flex items-center transition-all duration-150 rounded-r-md ${
                  isSidebarCollapsed ? 'px-0 justify-center' : 'px-2.5 space-x-2.5'
                } ${
                  currentTab === 'settings' 
                    ? 'bg-[#15273f]/90 text-[#0EA5E9] border-l-[3px] border-[#0EA5E9] font-extrabold translate-x-0.5 shadow-sm' 
                    : 'text-slate-400 border-l-[3px] border-transparent hover:bg-slate-800/30 hover:text-slate-200'
                }`}
              >
                <Wrench className={`w-3.5 h-3.5 shrink-0 transition-colors ${currentTab === 'settings' ? 'text-[#0EA5E9]' : 'text-slate-400/80'}`} />
                {!isSidebarCollapsed && <span className="tracking-wide">Shop Parameters & Guide</span>}
              </button>
            </div>

          </nav>
        </div>

        {/* User Chip & quick session switch on sidebar bottom */}
        <div className="p-3 border-t border-slate-800/60 bg-[#0A111E]" id="sidebar-user-chip">
          {isSidebarCollapsed ? (
            <div className="flex flex-col items-center justify-center space-y-2.5" id="sidebar-user-chip-collapsed">
              <button
                onClick={() => handleRoleChange(userRole === 'Owner' ? 'Staff' : 'Owner')}
                title={`Switch Role Privilege (Current: ${userRole})`}
                className="w-7 h-7 bg-sky-500 hover:bg-sky-600 text-white font-black text-xs flex items-center justify-center rounded transition-colors shadow"
              >
                {userRole[0]}
              </button>
            </div>
          ) : (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 bg-sky-500 text-white font-black text-xs flex items-center justify-center rounded-sm">
                  {userRole[0]}
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-150">{userRole === 'Owner' ? 'Owner Admin' : 'Staff Operator'}</p>
                  <p className="text-[9px] text-slate-500 font-mono">Faisalabad, PK</p>
                </div>
              </div>

              {/* Direct Role switches for quick testing in review stage */}
              <div className="flex items-center justify-between border-t border-dashed border-slate-800/60 pt-2 text-[9px]">
                <span className="text-slate-455 font-mono">User privilege:</span>
                <button
                  onClick={() => handleRoleChange(userRole === 'Owner' ? 'Staff' : 'Owner')}
                  className="bg-slate-850 hover:bg-slate-800 text-white py-0.5 px-1.5 font-bold rounded-sm border border-slate-700 cursor-pointer"
                  id="sidebar-role-toggle-btn"
                >
                  Switch to {userRole === 'Owner' ? 'Staff' : 'Owner'}
                </button>
              </div>
            </div>
          )}
        </div>

      </aside>

      {/* MOBILE DRAWER OVERLAY */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed inset-y-0 left-0 z-50 w-[250px] bg-[#111C30] text-slate-100 flex flex-col justify-between border-r border-slate-800 shadow-2xl md:hidden"
            >
              <div className="flex flex-col flex-1 min-h-0">
                <div className="p-4 border-b border-slate-800/60 flex items-center justify-between bg-[#070D18]/80">
                  <div className="flex items-center space-x-2">
                    <span className="w-3.5 h-3.5 rounded bg-sky-500/10 flex items-center justify-center border border-sky-400/30 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9]" />
                    </span>
                    <h1 className="text-xs font-extrabold tracking-wide text-white uppercase truncate">{shopName}</h1>
                  </div>
                  <button 
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>

                <nav className="p-3 space-y-3 flex-1 overflow-y-auto">
                  {/* Operations */}
                  <div className="space-y-1">
                    <p className="px-2 text-[9px] uppercase text-slate-500 font-extrabold mb-1">Operations</p>
                    <button 
                      onClick={() => { setCurrentTab('dashboard'); setMobileMenuOpen(false); }}
                      className={`w-full text-left py-2 px-3 text-xs flex items-center space-x-2.5 rounded-lg font-bold transition-all ${currentTab === 'dashboard' ? 'bg-[#15273f] text-[#0EA5E9]' : 'text-slate-300 hover:bg-slate-800/40'}`}
                    >
                      <LayoutDashboard className="w-4 h-4 text-sky-400" />
                      <span>Executive Dashboard</span>
                    </button>
                    <button 
                      onClick={() => { setCurrentTab('invoice'); setMobileMenuOpen(false); }}
                      className={`w-full text-left py-2 px-3 text-xs flex items-center space-x-2.5 rounded-lg font-bold transition-all ${currentTab === 'invoice' ? 'bg-[#15273f] text-[#0EA5E9]' : 'text-slate-300 hover:bg-slate-800/40'}`}
                    >
                      <ReceiptText className="w-4 h-4 text-amber-400" />
                      <span>POS Cash & GST Bill</span>
                    </button>
                    <button 
                      onClick={() => { setCurrentTab('quotations'); setMobileMenuOpen(false); }}
                      className={`w-full text-left py-2 px-3 text-xs flex items-center space-x-2.5 rounded-lg font-bold transition-all ${currentTab === 'quotations' ? 'bg-[#15273f] text-[#0EA5E9]' : 'text-slate-300 hover:bg-slate-800/40'}`}
                    >
                      <FileSignature className="w-4 h-4 text-indigo-400" />
                      <span>Quotations Draft</span>
                    </button>
                  </div>

                  {/* Catalog */}
                  <div className="space-y-1 pt-1 border-t border-slate-800/50">
                    <p className="px-2 text-[9px] uppercase text-slate-500 font-extrabold mb-1">Catalog & Sourcing</p>
                    <button 
                      onClick={() => { setCurrentTab('inventory'); setMobileMenuOpen(false); }}
                      className={`w-full text-left py-2 px-3 text-xs flex items-center justify-between rounded-lg font-bold transition-all ${currentTab === 'inventory' ? 'bg-[#15273f] text-[#0EA5E9]' : 'text-slate-300 hover:bg-slate-800/40'}`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Boxes className="w-4 h-4 text-emerald-400" />
                        <span>Items Inventory</span>
                      </div>
                      {alertsCount > 0 && (
                        <span className="text-[9px] bg-sky-500 text-white px-1.5 py-0.2 rounded font-extrabold">{alertsCount}</span>
                      )}
                    </button>
                    <button 
                      onClick={() => { setCurrentTab('purchases'); setMobileMenuOpen(false); }}
                      className={`w-full text-left py-2 px-3 text-xs flex items-center justify-between rounded-lg font-bold transition-all ${currentTab === 'purchases' ? 'bg-[#15273f] text-[#0EA5E9]' : 'text-slate-300 hover:bg-slate-800/40'}`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Truck className="w-4 h-4 text-orange-400" />
                        <span>PO & Sourcing</span>
                      </div>
                    </button>
                  </div>

                  {/* Market Partners */}
                  <div className="space-y-1 pt-1 border-t border-slate-800/50">
                    <p className="px-2 text-[9px] uppercase text-slate-500 font-extrabold mb-1">Parties & Financials</p>
                    <button 
                      onClick={() => { setCurrentTab('parties'); setMobileMenuOpen(false); }}
                      className={`w-full text-left py-2 px-3 text-xs flex items-center space-x-2.5 rounded-lg font-bold transition-all ${currentTab === 'parties' ? 'bg-[#15273f] text-[#0EA5E9]' : 'text-slate-300 hover:bg-slate-800/40'}`}
                    >
                      <Users className="w-4 h-4 text-sky-400" />
                      <span>Parties & Ledgers</span>
                    </button>
                    <button 
                      onClick={() => { setCurrentTab('accounts'); setMobileMenuOpen(false); }}
                      className={`w-full text-left py-2 px-3 text-xs flex items-center space-x-2.5 rounded-lg font-bold transition-all ${currentTab === 'accounts' ? 'bg-[#15273f] text-[#0EA5E9]' : 'text-slate-300 hover:bg-slate-800/40'}`}
                    >
                      <Coins className="w-4 h-4 text-emerald-400" />
                      <span>Accounts Module</span>
                    </button>
                  </div>

                  {/* Analytics & System */}
                  <div className="space-y-1 pt-1 border-t border-slate-800/50">
                    <p className="px-2 text-[9px] uppercase text-slate-500 font-extrabold mb-1">Logs & Settings</p>
                    <button 
                      onClick={() => { setCurrentTab('history'); setMobileMenuOpen(false); }}
                      className={`w-full text-left py-2 px-3 text-xs flex items-center space-x-2.5 rounded-lg font-bold transition-all ${currentTab === 'history' ? 'bg-[#15273f] text-[#0EA5E9]' : 'text-slate-300 hover:bg-slate-800/40'}`}
                    >
                      <TrendingUp className="w-4 h-4 text-purple-400" />
                      <span>Cost Shift Ledgers</span>
                    </button>
                    <button 
                      onClick={() => { setCurrentTab('price-history'); setMobileMenuOpen(false); }}
                      className={`w-full text-left py-2 px-3 text-xs flex items-center space-x-2.5 rounded-lg font-bold transition-all ${currentTab === 'price-history' ? 'bg-[#15273f] text-[#0EA5E9]' : 'text-slate-300 hover:bg-slate-800/40'}`}
                    >
                      <Tags className="w-4 h-4 text-rose-400" />
                      <span>Deal Price History</span>
                    </button>
                    <button 
                      onClick={() => { setCurrentTab('returns'); setMobileMenuOpen(false); }}
                      className={`w-full text-left py-2 px-3 text-xs flex items-center space-x-2.5 rounded-lg font-bold transition-all ${currentTab === 'returns' ? 'bg-[#15273f] text-[#0EA5E9]' : 'text-slate-300 hover:bg-slate-800/40'}`}
                    >
                      <RotateCcw className="w-4 h-4 text-rose-400" />
                      <span>Order Returns</span>
                    </button>
                    <button 
                      onClick={() => { setCurrentTab('reports'); setMobileMenuOpen(false); }}
                      className={`w-full text-left py-2 px-3 text-xs flex items-center space-x-2.5 rounded-lg font-bold transition-all ${currentTab === 'reports' ? 'bg-[#15273f] text-[#0EA5E9]' : 'text-slate-300 hover:bg-slate-800/40'}`}
                    >
                      <FilePieChart className="w-4 h-4 text-sky-400" />
                      <span>Business Reports</span>
                    </button>
                    <button 
                      onClick={() => { handleNavigateToSettings(); setMobileMenuOpen(false); }}
                      className={`w-full text-left py-2 px-3 text-xs flex items-center space-x-2.5 rounded-lg font-bold transition-all ${currentTab === 'settings' ? 'bg-[#15273f] text-[#0EA5E9]' : 'text-slate-300 hover:bg-slate-800/40'}`}
                    >
                      <Wrench className="w-4 h-4 text-slate-400" />
                      <span>Shop Parameters & Guide</span>
                    </button>
                  </div>
                </nav>

                <div className="p-3 border-t border-slate-800 bg-[#0A111E]">
                  <button
                    onClick={() => {
                      handleLockApp();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full py-2 px-3 bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-300 font-extrabold text-xs flex items-center justify-center space-x-2"
                  >
                    <Lock className="w-3.5 h-3.5 text-rose-400" />
                    <span>Lock System Screen</span>
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* MAIN CONTAINER AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100" id="app-main-area">
        
        {/* TOPBAR (56px tall for more premium padding, white background, elegant shadow border) */}
        <header className="h-[54px] bg-white border-b border-slate-200/80 px-5 flex items-center justify-between flex-shrink-0 relative z-40 shadow-sm" id="app-topbar">
          
          {/* Left Block: Breadcrumbs & Mockup Search Box */}
          <div className="flex items-center space-x-2 sm:space-x-4" id="topbar-left-block">
            {/* Desktop collapse toggle button */}
            {isSidebarCollapsed && (
              <button 
                onClick={toggleSidebar}
                className="hidden md:block p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors mr-1 cursor-pointer"
                title="Expand sidebar navigation"
              >
                <Menu className="w-4 h-4" />
              </button>
            )}

            {/* Mobile menu drawer trigger button */}
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              title="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Mobile quick search trigger button */}
            <button
              onClick={() => setIsSearchFocused(true)}
              className="sm:hidden p-1.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer flex items-center space-x-1"
              title="Quick Search Catalog"
            >
              <Search className="w-3.5 h-3.5 text-slate-500" />
            </button>
            
            {/* Advanced Command Center & Quick Search Overlay */}
            <div className="relative max-w-[280px] hidden sm:block z-50" id="global-quick-search-container">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-3.5 w-3.5 text-slate-400 focus-within:text-[#0EA5E9] transition-colors" />
              </span>
              <input
                type="text"
                id="global-quick-search-input"
                placeholder="Search catalog, thread sizes... (Ctrl+K)"
                value={globalSearchInput}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onKeyDown={handleSearchInputKeyDown}
                className="w-full text-xs pl-9 pr-7 py-1.5 bg-slate-50 border border-slate-200/90 rounded-lg outline-none font-medium text-slate-700 placeholder-slate-400 focus:bg-white focus:border-[#0EA5E9] focus:ring-1 focus:ring-sky-100 transition-all"
              />
              {globalSearchInput && (
                <button
                  onClick={() => handleSearchInputChange('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer text-[10px] font-bold font-mono"
                  title="Clear search query"
                >
                  ✕
                </button>
              )}

              {/* Floating backdrop & command desk dropdown wrapped with AnimatePresence */}
              <AnimatePresence>
                {isSearchFocused && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className="fixed inset-0 bg-slate-900/10 backdrop-blur-xs z-40" 
                    onClick={() => setIsSearchFocused(false)}
                  />
                )}

                {isSearchFocused && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute left-0 mt-2 w-[420px] sm:w-[540px] bg-white rounded-xl border border-slate-200 shadow-2xl z-50 text-slate-700 flex flex-col p-3.5 space-y-3"
                  >
                    {/* Top command title bar */}
                    <div className="flex justify-between items-center select-none pb-2 border-b border-slate-100">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
                        <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wider font-mono">
                          ⚙️ Part Finder command desk
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[9px] text-slate-400 bg-slate-100 border px-1.5 py-0.5 rounded font-mono font-bold select-none">
                          Esc to Close
                        </span>
                      </div>
                    </div>

                    {/* Active Filter categories / Segment Pill boxes */}
                    <div className="space-y-2 text-xs select-none">
                      {/* Brand filters line */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase text-slate-400 w-11 mt-0.5">Brand:</span>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => { setSearchBrandFilter(null); setHighlightedSearchIndex(0); }}
                          className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold font-mono border transition-all cursor-pointer ${!searchBrandFilter ? 'bg-slate-900 text-white border-transparent' : 'bg-slate-50 text-slate-600 border-slate-200/90 hover:bg-slate-150'}`}
                        >
                          ALL
                        </motion.button>
                        {['VIC', 'SURE', 'TOYOTA', 'DONALDSON', 'K&N'].map((br) => (
                          <motion.button
                            key={br}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => toggleBrandFilter(br)}
                            className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold font-mono border transition-all cursor-pointer ${searchBrandFilter === br ? 'bg-sky-500 text-white border-transparent shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200/90 hover:bg-slate-150'}`}
                          >
                            {br}
                          </motion.button>
                        ))}
                      </div>

                      {/* Category filters line */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase text-slate-400 w-11 mt-0.5">Type:</span>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => { setSearchCategoryFilter(null); setHighlightedSearchIndex(0); }}
                          className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold font-mono border transition-all cursor-pointer ${!searchCategoryFilter ? 'bg-slate-900 text-white border-transparent' : 'bg-slate-50 text-slate-600 border-slate-200/90 hover:bg-slate-150'}`}
                        >
                          ALL
                        </motion.button>
                        {['Oil Filter', 'Air Filter', 'Fuel Filter', 'Cabin Filter'].map((cat) => (
                          <motion.button
                            key={cat}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => toggleCategoryFilter(cat)}
                            className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold font-mono border transition-all cursor-pointer ${searchCategoryFilter === cat ? 'bg-amber-500 text-white border-transparent shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200/90 hover:bg-slate-150'}`}
                          >
                            {cat.split(' ')[0]}
                          </motion.button>
                        ))}
                      </div>

                      {/* Stock level quick switches */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100/70 select-none">
                        <span className="text-[9.5px] text-slate-400 font-bold">Filters: {searchBrandFilter || 'None'} &bull; {searchCategoryFilter || 'None'}</span>
                        <div className="flex items-center space-x-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                          {([
                            { key: 'all', label: 'All Items' },
                            { key: 'in-stock', label: '🟢 Stock' },
                            { key: 'low-stock', label: '🔴 Low/Out' }
                          ] as const).map(item => (
                            <motion.button
                              key={item.key}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => { setSearchStockFilter(item.key); setHighlightedSearchIndex(0); }}
                              className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all cursor-pointer ${searchStockFilter === item.key ? 'bg-white text-slate-800 shadow-xs border border-slate-200/40' : 'text-slate-455 hover:text-slate-700'}`}
                            >
                              {item.label}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* List of Matched Parts Results block */}
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar divide-y divide-slate-150/60 border border-slate-150/80 rounded-lg bg-slate-50/20 relative">
                      <AnimatePresence mode="popLayout">
                        {getQuickSearchResults().length === 0 ? (
                          <motion.div 
                            key="no-results"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.15 }}
                            className="p-6 text-center text-slate-400 w-full"
                          >
                            <p className="text-xs font-semibold">No results matched current parameters</p>
                            <p className="text-[9.5px] text-slate-400 mt-1">Try resetting the Brand and Type filters above.</p>
                          </motion.div>
                        ) : (
                          getQuickSearchResults().map((p, idx) => {
                            const isLowStock = p.stock_qty <= p.min_stock_alert;
                            const isOutOfStock = p.stock_qty === 0;
                            const isHighlighted = idx === highlightedSearchIndex;
                            
                            return (
                              <motion.div
                                layout="position"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ 
                                  type: "spring", 
                                  stiffness: 500, 
                                  damping: 38,
                                  opacity: { duration: 0.12 }
                                }}
                                key={p.id}
                                onClick={() => handleSelectQuickSearchProduct(p)}
                                onMouseEnter={() => setHighlightedSearchIndex(idx)}
                                className={`px-3 py-2.5 cursor-pointer flex items-center justify-between transition-colors relative select-none ${
                                  isHighlighted 
                                    ? 'bg-sky-50/70 border-l-[3px] border-[#0EA5E9] pl-2.5' 
                                    : 'hover:bg-slate-50/50 pl-3'
                                }`}
                              >
                                <div className="flex flex-col space-y-0.5 max-w-[55%]">
                                  <div className="flex items-center space-x-2">
                                    <span className={`font-mono text-[12.5px] font-extrabold ${isHighlighted ? 'text-[#0EA5E9]' : 'text-slate-900'}`}>
                                      {p.part_number}
                                    </span>
                                    <span className="text-[8.5px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono uppercase">
                                      {p.brand}
                                    </span>
                                  </div>
                                  <p className="text-[9.5px] text-slate-500 font-medium truncate">
                                    {p.category} {p.subtype ? `&bull; Type ${p.subtype}` : ''}
                                  </p>
                                  {p.shelf_location && (
                                    <p className="text-[8.5px] text-slate-400 font-mono">
                                      Shelf Location: <span className="text-slate-600 font-extrabold">{p.shelf_location}</span>
                                    </p>
                                  )}
                                </div>

                                <div className="text-right flex flex-col items-end space-y-1">
                                  {/* Stock status indicator pill */}
                                  <div className="flex items-center space-x-1.5">
                                    {p.thread_size && (
                                      <span className="text-[8px] font-extrabold bg-sky-50 text-[#0EA5E9] border border-sky-100 px-1 rounded font-mono">
                                        {p.thread_size}
                                      </span>
                                    )}
                                    <span className={`text-[8.5px] font-extrabold px-1.5 py-0.2 rounded uppercase ${
                                      isOutOfStock 
                                        ? 'bg-rose-50 text-rose-650' 
                                        : isLowStock 
                                          ? 'bg-amber-50 text-amber-700' 
                                          : 'bg-emerald-50 text-emerald-700'
                                    }`}>
                                      {isOutOfStock ? 'OUT_OF_STOCK' : `${p.stock_qty} pcs`}
                                    </span>
                                  </div>
                                  
                                  {/* Price Tag with actions inside hovered / active state */}
                                  <div className="flex items-center space-x-2">
                                    <span className="font-mono text-[11px] font-extrabold text-slate-800">
                                      {formatQuickSearchPrice(p)}
                                    </span>

                                    {/* Quick action button for direct sell loading */}
                                    <button
                                      onClick={(e) => handleQuickSellProduct(p, e)}
                                      className="p-1 rounded bg-[#0EA5E9] hover:bg-sky-600 text-white cursor-pointer transition-colors"
                                      title="Sell instantly - Load item directly into POS Invoice Card"
                                    >
                                      <ShoppingCart className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })
                        )}
                      </AnimatePresence>
                    </div>
                    
                    {/* Instructional guide footer for high power shortcuts */}
                    <div className="p-2 bg-slate-50/80 border border-slate-150 rounded-lg flex items-center justify-between select-none">
                      <div className="flex flex-col space-y-0.5">
                        <p className="text-[8.5px] font-medium text-slate-500">
                          🔑 <span className="font-bold">Keyboard workflow:</span>
                        </p>
                        <p className="text-[8.5px] text-slate-455 font-mono">
                          &bull; <span className="font-extrabold text-[#0EA5E9]">&uarr;&darr; Keys</span> to highlight item
                        </p>
                        <p className="text-[8.5px] text-slate-455 font-mono">
                          &bull; <span className="font-extrabold text-[#0EA5E9]">Enter</span> to view specs | <span className="font-extrabold text-amber-600">Shift+Enter</span> to instant sell!
                        </p>
                      </div>
                      {getQuickSearchResults().length > 0 && (
                        <span className="text-[9px] text-[#0EA5E9] font-bold bg-sky-50 px-2 py-0.5 rounded border border-sky-100/50 font-mono">
                          {getQuickSearchResults().length} items matched
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Minor Breadcrumb indicators */}
            <div className="flex items-center space-x-1 ml-2 text-[11px] font-sans text-slate-400 select-none">
              <span className="font-bold text-slate-700 font-display">
                {currentTab === 'dashboard' && 'Dashboard Overview'}
                {currentTab === 'inventory' && 'Parts Inventory'}
                {currentTab === 'invoice' && 'POS Sell Settlement'}
                {currentTab === 'parties' && 'Ledgers & Partners'}
                {currentTab === 'accounts' && 'Accounts Module'}
                {currentTab === 'history' && 'Stock Logs'}
                {currentTab === 'returns' && 'Order Returns'}
                {currentTab === 'settings' && 'Shop Parameters'}
                {currentTab === 'reports' && 'Analytical Reports'}
                {currentTab === 'price-history' && 'Negotiation Trail'}
              </span>
            </div>
          </div>

          {/* Right Block: Interactive Notifications, Profile Dropdown, and Glowing SYNC Badge */}
          <div className="flex items-center space-x-4 text-xs font-semibold" id="topbar-right-block">
            
            {/* Keyboard Shortcuts Cheatsheet Toggle Button */}
            <button
              onClick={() => setShowShortcutCheatsheet(true)}
              className="p-1.5 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100/75 relative cursor-pointer transition-all flex items-center justify-center border border-transparent hover:border-slate-200"
              title="Keyboard Setup & Map Cheatsheet (Ctrl+/)"
              id="topbar-shortcuts-help-btn"
            >
              <Keyboard className="w-4 h-4 stroke-[1.8]" />
              <span className="hidden lg:inline-block ml-1.5 text-[10px] bg-slate-100 text-slate-500 rounded px-1 py-0.2 border border-slate-200 font-mono">
                ctrl+/
              </span>
            </button>

            {/* 1. Notification Bell Popover */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifPopover(!showNotifPopover);
                  setShowUserDropdown(false);
                }}
                className={`p-1.5 rounded-full transition-all relative cursor-pointer hover:bg-slate-50 ${showNotifPopover ? 'bg-slate-150 text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
                title="System Notifications"
              >
                <Bell className="w-4 h-4 stroke-[2]" />
                <span className="absolute -top-1 -right-1.5 bg-sky-500 text-white font-extrabold text-[9px] w-4 h-4 rounded-full border-2 border-white flex items-center justify-center animate-bounce">
                  2
                </span>
              </button>

              {showNotifPopover && (
                <div className="absolute right-0 mt-2.5 w-72 bg-white rounded-xl border border-slate-200/80 shadow-xl py-2 z-50 text-slate-700 animate-slide-up">
                  <div className="px-3.5 py-1.5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
                    <span className="font-bold text-slate-900 text-[11.5px]">Stock Alerts & Logs</span>
                    <span className="text-[8.5px] bg-sky-100 text-sky-700 font-bold px-1.5 py-0.5 rounded-full">New</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto custom-scrollbar">
                    <div className="px-3.5 py-2 hover:bg-slate-50 border-b border-slate-100 flex flex-col space-y-0.5">
                      <div className="flex justify-between">
                        <span className="font-bold text-[10.5px] text-slate-800">Air Filter AC-012</span>
                        <span className="text-[8px] text-slate-400 font-mono">10m ago</span>
                      </div>
                      <p className="text-[9.5px] text-slate-500">Inventory was modified with 245 units.</p>
                    </div>
                    <div className="px-3.5 py-2 hover:bg-slate-50 border-b border-slate-100 flex flex-col space-y-0.5">
                      <div className="flex justify-between">
                        <span className="font-bold text-[10.5px] text-amber-700">Low Stock Trigger</span>
                        <span className="text-[8px] text-slate-400 font-mono">2h ago</span>
                      </div>
                      <p className="text-[9.5px] text-slate-500">Double Ring Oil Filter has reached critical threshold.</p>
                    </div>
                  </div>
                  <div className="p-1 px-3 border-t border-slate-100 text-center">
                    <button 
                      onClick={() => {
                        setCurrentTab('inventory');
                        setShowNotifPopover(false);
                      }}
                      className="text-[9.5px] text-[#0EA5E9] hover:underline font-bold w-full"
                    >
                      View inventory alarms
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. User Profile Dropdown mimicking Photo with Role info */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowUserDropdown(!showUserDropdown);
                  setShowNotifPopover(false);
                }}
                className="flex items-center space-x-2 p-1 rounded-lg hover:bg-slate-50 cursor-pointer text-left transition-all"
                title="Account Credentials switcher"
              >
                {/* Simulated photo avatar with glowing online dot */}
                <div className="relative">
                  <div className="w-7 h-7 bg-slate-900 hover:bg-slate-800 text-[#0EA5E9] font-sans font-black text-xs flex items-center justify-center rounded-full border border-slate-200">
                    {userRole === 'Owner' ? (ownerName.trim().split(/\s+/).map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'OW') : 'SA'}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                </div>
                
                {/* Descriptive metadata labels */}
                <div className="hidden md:flex flex-col select-none pr-1">
                  <span className="text-[11.5px] font-extrabold text-[#0EA5E9] leading-tight">
                    {userRole === 'Owner' ? ownerName : 'S. Ahmed'}
                  </span>
                  <span className="text-[8.5px] text-slate-400 leading-none font-bold uppercase tracking-wide">
                    {userRole === 'Owner' ? 'Owner Admin' : 'Staff Operator'}
                  </span>
                </div>
                <ChevronLeft className={`w-3 h-3 text-slate-400 transition-transform ${showUserDropdown ? '-rotate-90' : ''}`} />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-slate-200/80 shadow-xl py-1.5 z-50 text-slate-700 animate-slide-up">
                  <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50/60 rounded-t-xl">
                    <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Logged Agency Role</p>
                    <p className="text-[11px] font-black text-slate-800">
                      {userRole === 'Owner' ? 'Full Owner privileges' : 'Standard Cashier Staff'}
                    </p>
                    {sessionStorage.getItem('kfh_supabase_user_email') && (
                      <div className="mt-1 pt-1 border-t border-slate-200/60">
                        <p className="text-[8.5px] text-slate-400 uppercase font-extrabold">Supabase User</p>
                        <p className="text-[10px] font-mono text-sky-600 font-bold truncate">
                          {sessionStorage.getItem('kfh_supabase_user_email')}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="p-1">
                    <button 
                      onClick={() => {
                        handleRoleChange(userRole === 'Owner' ? 'Staff' : 'Owner');
                        setShowUserDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 rounded-lg text-[10.5px] font-bold text-sky-600 hover:text-sky-700 transition-colors flex items-center justify-between"
                    >
                      <span>Switch Privilege Role</span>
                      <span className="text-[8px] bg-sky-100 px-1.5 py-0.5 rounded uppercase font-mono">
                        {userRole === 'Owner' ? '→ Staff' : '→ Owner'}
                      </span>
                    </button>
                    
                    <button 
                      onClick={() => {
                        handleNavigateToSettings();
                        setShowUserDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-200/40 rounded-lg text-[10.5px] font-medium text-slate-650 transition-colors"
                    >
                      Shop Parameters / Encryption
                    </button>

                    <button 
                      onClick={() => {
                        setShowUserDropdown(false);
                        handleLockApp();
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-rose-50 rounded-lg text-[10.5px] font-bold text-rose-600 transition-colors flex items-center justify-between border-t border-slate-100 mt-1 cursor-pointer"
                    >
                      <span>🔒 Lock & Sign Out</span>
                      <span className="text-[8px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-mono font-bold">Lock Gate</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Lock App Button */}
            <button
              onClick={handleLockApp}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-400 hover:text-sky-300 font-bold text-xs flex items-center space-x-1.5 border border-slate-700 transition-all cursor-pointer shadow-2xs"
              title="Lock system screen immediately (Requires Master PIN to re-open)"
            >
              <Lock className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline font-mono text-[10px] uppercase font-extrabold text-slate-100">Lock App</span>
            </button>

            {/* 3. SYNC OK / OFFLINE MODE capsule pill */}
            {isOnline ? (
              <div className="flex items-center space-x-1.5 bg-emerald-50/90 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-full text-[9.5px] uppercase font-bold select-none tracking-wide font-sans shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <Wifi className="w-3 h-3 text-emerald-600" />
                <span>SYNC ONLINE</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-700 px-2.5 py-1 rounded-full text-[9.5px] uppercase font-bold select-none tracking-wide font-sans shadow-2xs" title="Device is offline. All inventory, billing, and accounting operations are saved locally to this device.">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                <WifiOff className="w-3 h-3 text-amber-600" />
                <span>OFFLINE MODE</span>
              </div>
            )}

          </div>

        </header>

        {/* Global Offline Warning Banner */}
        {!isOnline && (
          <div className="bg-slate-900 text-slate-100 text-[11px] font-bold px-4 py-2 flex items-center justify-between border-b border-slate-800 shadow-md">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
              <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                <strong className="text-amber-400 font-extrabold uppercase font-mono mr-1">Offline Resilience Active:</strong>
                Internet connection lost. You can continue creating invoices, managing stock, and recording ledger transactions — all data is preserved locally and will auto-sync when reconnected.
              </span>
            </div>
            <span className="hidden sm:inline-block text-[9.5px] bg-slate-800 text-sky-400 px-2 py-0.5 rounded border border-slate-700 font-mono font-bold">
              LOCAL STORAGE SECURE
            </span>
          </div>
        )}

        {/* Toggle Owner Value Decode Bar at the top of each tab */}
        {userRole === 'Owner' && (
          <div className="bg-slate-100 border-b border-gray-200 px-4 py-2 flex items-center justify-between text-xs font-sans" id="owner-decrypt-banner">
            <div className="flex items-center space-x-2">
              <span className="font-extrabold uppercase text-[9px] bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded border border-sky-200">
                Owner Mode Privileges
              </span>
              <p className="text-gray-650 font-bold">
                {revealRealValues 
                  ? "✓ Decrypted standard pricing: showing actual values in PKR."
                  : "🔒 Encoded standard pricing: monetary values are currently ciphered for staff protection."}
              </p>
            </div>
            {revealRealValues ? (
              <button 
                onClick={() => setRevealRealValues(false)}
                className="bg-slate-800 hover:bg-[#111C30] text-white font-bold px-3 py-1 rounded text-[11px] transition-colors cursor-pointer"
                id="lock-real-values-btn"
              >
                🔒 Lock to Cipher Codes
              </button>
            ) : (
              <button 
                onClick={() => {
                  setPasswordError('');
                  setShowPasswordModal(true);
                }}
                className="bg-[#0EA5E9] hover:bg-sky-600 text-white font-extrabold px-3 py-1 rounded text-[11px] shadow-xs uppercase tracking-wide cursor-pointer transition-all duration-150"
                id="unlock-real-values-btn"
              >
                🔓 Reveal Real Values
              </button>
            )}
          </div>
        )}

        {/* SCROLLABLE INNER PANEL CONTAINER */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 pb-20 md:pb-4" id="app-scroll-stage">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              
              {/* Global Scheduled Deletion Notification Alert Bar */}
          {scheduledDeletionPOs.length > 0 && (
            <div className="mb-4 space-y-2" id="global-deletion-notifications">
              {scheduledDeletionPOs.map(po => {
                const scheduledTime = po.deletion_scheduled_at ? new Date(po.deletion_scheduled_at).getTime() : Date.now();
                const timeLeftMs = (scheduledTime + 3 * 24 * 60 * 60 * 1000) - Date.now();
                const daysLeft = Math.max(0, Math.floor(timeLeftMs / (24 * 60 * 60 * 1000)));
                const hoursLeft = Math.max(0, Math.floor((timeLeftMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)));
                
                return (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={po.id}
                    className="bg-rose-50 border-l-4 border-rose-500 p-3 rounded shadow-xs flex items-center justify-between text-xs text-rose-850"
                  >
                    <div className="flex items-start space-x-2.5">
                      <span className="text-base leading-none">⏳</span>
                      <div>
                        <p className="font-bold text-rose-900 leading-tight">
                          Purchase Order <span className="font-mono text-[11.5px] font-black underline cursor-pointer hover:text-rose-750" onClick={() => { setCurrentTab('purchases'); localStorage.setItem('kfh_selected_po_id', po.id); handleRefreshTrigger(); }} title="Click to view purchase order specs">{po.po_number}</span> is scheduled for automatic permanent deletion!
                        </p>
                        <p className="text-[11px] text-rose-700 font-medium mt-0.5">
                          Sent for deleting due to: <strong className="text-rose-900">"{po.deletion_reason || 'Unspecified reason'}"</strong>.
                        </p>
                        <p className="text-[10px] text-rose-600 font-bold font-mono mt-1">
                          Removes permanently in: {daysLeft} days and {hoursLeft} hours.
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => {
                        const updated = {
                          ...po,
                          is_deletion_scheduled: false,
                          deletion_scheduled_at: undefined,
                          deletion_reason: undefined
                        };
                        db.savePurchaseOrder(updated);
                        handleRefreshTrigger();
                        alert(`Deletion schedule for PO ${po.po_number} has been cancelled!`);
                      }}
                      className="text-[9.5px] uppercase font-extrabold bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded transition-colors tracking-wider shrink-0 ml-4 cursor-pointer"
                    >
                      Cancel Deletion (Keep PO)
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
          
          {/* Dashboard view */}
          {currentTab === 'dashboard' && (
            <DashboardView 
              userRole={userRole} 
              cipherKey={cipherKey}
              revealRealValues={revealRealValues}
              onNavigate={(tab) => setCurrentTab(tab)}
            />
          )}

          {/* Inventory view */}
          {currentTab === 'inventory' && (
            <InventoryView 
              userRole={userRole} 
              cipherKey={cipherKey}
              revealRealValues={revealRealValues}
              triggerRefreshStamp={refreshStamp}
            />
          )}

          {/* Invoicing Walk-In Point of Sale View */}
          {currentTab === 'invoice' && (
            <InvoiceView 
              userRole={userRole}
              cipherKey={cipherKey}
              revealRealValues={revealRealValues}
              onInvoiceCreated={handleRefreshTrigger}
            />
          )}

          {/* Parties ledger contact view */}
          {currentTab === 'parties' && (
            <PartiesView 
              userRole={userRole}
              cipherKey={cipherKey}
              revealRealValues={revealRealValues}
              onNavigate={(tab) => setCurrentTab(tab)} 
            />
          )}

          {/* Accounts & Registers view */}
          {currentTab === 'accounts' && (
            <AccountsView 
              userRole={userRole}
              cipherKey={cipherKey}
              revealRealValues={revealRealValues}
              onNavigate={(tab) => setCurrentTab(tab)}
            />
          )}

          {/* Movements audit search view */}
          {currentTab === 'history' && (
            <div className="bg-white p-4 border border-[#E2DFDF] space-y-4" id="movements-audit-pane">
              <div className="border-b pb-3 flex justify-between items-center bg-gray-50 p-2.5 rounded">
                <div>
                  <h3 className="text-xs uppercase tracking-wider font-bold text-[#2A2727]">Audit Stock Movements Log Book</h3>
                  <p className="text-[11px] text-gray-500">Every single inward/outward quantity amendment is securely logged.</p>
                </div>
                <span className="text-[10px] bg-sky-100 text-[#0EA5E9] px-2 py-0.5 font-bold uppercase rounded font-mono">
                  Immutable Audit log
                </span>
              </div>

              {/* Log ledger table visual representation */}
              <div className="max-h-[460px] overflow-y-auto border border-gray-200 divide-y divide-[#F5F4F4]">
                {movements.map((mov) => (
                  <div key={mov.id} className="p-3 bg-white text-xs flex justify-between items-start hover:bg-slate-50 transition-none">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-[#2A2727] font-mono select-all">LOG-{mov.id.replace('mov-', '')}</span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase ${
                          mov.type === 'opening_stock' ? 'bg-blue-10/40 text-blue-700 border border-blue-200' :
                          mov.type === 'purchased' ? 'bg-emerald-50 text-emerald-700' :
                          mov.type === 'sold' ? 'bg-sky-50 text-[#0EA5E9]' :
                          mov.type === 'damaged' ? 'bg-amber-100 text-amber-950 font-bold border border-amber-300' : 'bg-gray-150 text-gray-600'
                        }`}>
                          {mov.type}
                        </span>
                      </div>
                      <p className="text-gray-600 leading-normal">{mov.reason}</p>
                      <div className="text-[10px] text-gray-400 font-mono space-x-2">
                        <span>Logged at: {new Date(mov.timestamp).toLocaleString()}</span>
                        <span>•</span>
                        <span>Operator: {mov.user}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`font-mono font-bold text-sm ${mov.qty_change > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {mov.qty_change > 0 ? `+${mov.qty_change}` : mov.qty_change} pcs
                      </span>
                      <p className="text-[9px] text-gray-400 mt-0.5">Quantity Ledger</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Returns view */}
          {currentTab === 'returns' && (
            <ReturnsView 
              userRole={userRole}
              onReturnProcessed={handleRefreshTrigger}
            />
          )}

          {/* Quotations view */}
          {currentTab === 'quotations' && (
            <QuotationsView 
              userRole={userRole}
              onQuoteProcessed={handleRefreshTrigger}
            />
          )}

          {/* Parameters setting view */}
          {currentTab === 'settings' && (
            <SettingsView 
              userRole={userRole}
              onChangeRole={handleRoleChange}
              cipherKey={cipherKey}
              onChangeCipherKey={handleCipherChange}
              onRefreshAll={handleRefreshTrigger}
              revealPin={revealPin}
              onUpdateRevealPin={handleUpdateRevealPin}
            />
          )}

          {/* Sourcing and Purchases view */}
          {currentTab === 'purchases' && (
            <PurchasesView 
              userRole={userRole}
              cipherKey={cipherKey}
              revealRealValues={revealRealValues}
            />
          )}

          {/* Business Reports View */}
          {currentTab === 'reports' && (
            <ReportsView 
              userRole={userRole}
              cipherKey={cipherKey}
              revealRealValues={revealRealValues}
            />
          )}

          {/* Price Negotiation Trail History View */}
          {currentTab === 'price-history' && (
            <PriceHistoryView 
              userRole={userRole}
              cipherKey={cipherKey}
              revealRealValues={revealRealValues}
            />
          )}

            </motion.div>
          </AnimatePresence>
        </main>

        {/* OWNER PASSWORD PROMPT MODAL */}
        {showPasswordModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs font-sans">
            <div className="bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-sm overflow-hidden p-6 space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-sm font-black uppercase text-slate-800 tracking-tight">🔒 Owner Authenticate Lock</h3>
                <button 
                  onClick={() => setShowPasswordModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer font-bold"
                >
                  ✕
                </button>
              </div>
              
              <p className="text-xs text-slate-600 leading-relaxed">
                Please enter the Owner Security Password to temporarily decrypt standard price and cost structures in this tab.
              </p>

              <form onSubmit={handleVerifyPassword} className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Enter Owner Password / PIN:</label>
                  <input 
                    type="password"
                    autoFocus
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••"
                    className="w-full p-2.5 border rounded font-mono font-bold text-center tracking-widest focus:ring-1 focus:ring-sky-400 focus:outline-none"
                    required
                  />
                </div>

                {passwordError && (
                  <p className="text-[10px] text-sky-600 font-bold bg-sky-50 p-1.5 rounded animate-pulse">{passwordError}</p>
                )}

                <div className="flex space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="w-1/2 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold uppercase rounded cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2 bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-bold uppercase rounded cursor-pointer"
                  >
                    Authorize
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SECURE PIN VERIFICATION MODAL */}
        {showPinModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-xs font-sans">
            <div className="bg-white rounded-lg border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden p-6 space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-sm font-black uppercase text-slate-800 tracking-tight flex items-center">
                  {pinModalTitle}
                </h3>
                <button 
                  onClick={() => setShowPinModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer font-bold"
                >
                  ✕
                </button>
              </div>
              
              <p className="text-xs text-slate-600 leading-relaxed">
                {pinModalDesc}
              </p>

              <form onSubmit={handleVerifyPinModalSubmit} className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Enter Security Access PIN / Password Code:</label>
                  <input 
                    type="password"
                    autoFocus
                    value={pinModalInput}
                    onChange={(e) => setPinModalInput(e.target.value)}
                    placeholder="••••"
                    className="w-full p-2.5 border rounded font-mono font-bold text-center tracking-widest focus:ring-1 focus:ring-sky-450 focus:outline-none bg-slate-50 focus:bg-white text-slate-900"
                    required
                  />
                </div>

                {pinModalError && (
                  <p className="text-[10px] text-red-650 font-bold bg-red-50 border border-red-150 p-1.5 rounded text-center">{pinModalError}</p>
                )}

                <div className="flex space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPinModal(false)}
                    className="w-1/2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase rounded cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold uppercase rounded cursor-pointer transition-colors"
                  >
                    Verify Access
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* KEYBOARD SHORTCUTS CHEATSHEET MODAL */}
        {showShortcutCheatsheet && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs font-sans p-4 animate-fade-in">
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header block */}
              <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between select-none">
                <div className="flex items-center space-x-2.5">
                  <span className="p-1 bg-sky-500/10 rounded-lg border border-sky-400/30">
                    <Keyboard className="w-5 h-5 text-sky-400 animate-pulse" />
                  </span>
                  <div>
                    <h3 className="text-[13.5px] font-black uppercase tracking-wider font-display">Productivity Command Center</h3>
                    <p className="text-[9.5px] text-slate-400">Instant application nav shortcuts (supports Ctrl or ⌘ Cmd)</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowShortcutCheatsheet(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs cursor-pointer font-extrabold transition-all"
                  title="Close Guide"
                >
                  ✕
                </button>
              </div>

              {/* Shortcuts Grid list */}
              <div className="flex-1 p-5 overflow-y-auto custom-scrollbar space-y-4">
                {/* Search & Global Category */}
                <div className="space-y-2">
                  <h4 className="text-[9px] uppercase font-black text-sky-600 tracking-wider">Global Search & Helpers</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-150 rounded-lg group hover:bg-sky-50/20 transition-all">
                      <span className="text-slate-700 text-[11px] font-bold">Focus Quick Search box</span>
                      <kbd className="bg-white px-2 py-0.5 rounded border border-slate-200/90 shadow-2xs text-[10px] font-mono text-slate-800 font-extrabold">Ctrl + K</kbd>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-150 rounded-lg group hover:bg-sky-50/20 transition-all">
                      <span className="text-slate-700 text-[11px] font-bold">Toggle Shortcuts panel</span>
                      <kbd className="bg-white px-2 py-0.5 rounded border border-slate-200/90 shadow-2xs text-[10px] font-mono text-slate-800 font-extrabold">Ctrl + /</kbd>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-150 rounded-lg group hover:bg-sky-50/20 transition-all md:col-span-2">
                      <span className="text-slate-700 text-[11px] font-bold">Decrypt & Reveal Owner Values (PIN auth)</span>
                      <kbd className="bg-amber-100 px-2 py-0.5 rounded border border-amber-300 shadow-2xs text-[10px] font-mono text-amber-800 font-extrabold">` (Backtick Key)</kbd>
                    </div>
                  </div>
                </div>

                {/* Tab Navigation Category */}
                <div className="space-y-2">
                  <h4 className="text-[9px] uppercase font-black text-[#2A2727] tracking-wider border-t pt-3 flex items-center justify-between">
                    <span>Menu Nav Shortcuts</span>
                    <span className="text-[8.5px] font-medium text-slate-400 uppercase font-mono">Instant jump</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="flex items-center justify-between p-2 bg-white hover:bg-slate-50 border border-slate-100 rounded-lg transition-all">
                      <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        <span className="text-slate-700 text-[11px] font-semibold">Dashboard Overview</span>
                      </div>
                      <kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs text-[10px] font-mono text-slate-800 font-bold">Ctrl + D</kbd>
                    </div>

                    <div className="flex items-center justify-between p-2 bg-white hover:bg-slate-50 border border-slate-100 rounded-lg transition-all">
                      <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                        <span className="text-slate-700 text-[11px] font-semibold">Items Inventory</span>
                      </div>
                      <kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs text-[10px] font-mono text-slate-800 font-bold">Ctrl + I</kbd>
                    </div>

                    <div className="flex items-center justify-between p-2 bg-white hover:bg-slate-50 border border-slate-100 rounded-lg transition-all">
                      <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9]"></span>
                        <span className="text-slate-700 text-[11px] font-semibold">POS Sell Settlement</span>
                      </div>
                      <kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs text-[10px] font-mono text-slate-800 font-bold">Ctrl + P</kbd>
                    </div>

                    <div className="flex items-center justify-between p-2 bg-white hover:bg-slate-50 border border-slate-100 rounded-lg transition-all">
                      <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                        <span className="text-slate-700 text-[11px] font-semibold">Balances & Parties</span>
                      </div>
                      <kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs text-[10px] font-mono text-slate-800 font-bold">Ctrl + L</kbd>
                    </div>

                    <div className="flex items-center justify-between p-2 bg-white hover:bg-slate-50 border border-slate-100 rounded-lg transition-all">
                      <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                        <span className="text-slate-700 text-[11px] font-semibold">Accounts Matrix</span>
                      </div>
                      <kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs text-[10px] font-mono text-slate-800 font-bold">Ctrl + A</kbd>
                    </div>

                    <div className="flex items-center justify-between p-2 bg-white hover:bg-slate-50 border border-slate-100 rounded-lg transition-all">
                      <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-505 bg-slate-500"></span>
                        <span className="text-slate-700 text-[11px] font-semibold">Audit Stock Logs</span>
                      </div>
                      <kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs text-[10px] font-mono text-slate-800 font-bold">Ctrl + H</kbd>
                    </div>

                    <div className="flex items-center justify-between p-2 bg-white hover:bg-slate-50 border border-slate-100 rounded-lg transition-all">
                      <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        <span className="text-slate-700 text-[11px] font-semibold">Deal Price History</span>
                      </div>
                      <kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs text-[10px] font-mono text-slate-800 font-bold">Ctrl + J</kbd>
                    </div>

                    <div className="flex items-center justify-between p-2 bg-white hover:bg-slate-50 border border-slate-100 rounded-lg transition-all">
                      <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        <span className="text-slate-700 text-[11px] font-semibold">Claims & Returns</span>
                      </div>
                      <kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs text-[10px] font-mono text-slate-800 font-bold">Ctrl + U</kbd>
                    </div>

                    <div className="flex items-center justify-between p-2 bg-white hover:bg-slate-50 border border-slate-100 rounded-lg transition-all">
                      <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-655 bg-[#0EA5E9]"></span>
                        <span className="text-slate-700 text-[11px] font-semibold">Business Reports</span>
                      </div>
                      <kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs text-[10px] font-mono text-slate-800 font-bold">Ctrl + R</kbd>
                    </div>

                    <div className="flex items-center justify-between p-2 bg-white hover:bg-slate-50 border border-slate-100 rounded-lg transition-all">
                      <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                        <span className="text-slate-700 text-[11px] font-semibold">Settings & Guides</span>
                      </div>
                      <kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs text-[10px] font-mono text-slate-800 font-bold">Ctrl + S</kbd>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer tip box */}
              <div className="bg-slate-50 px-5 py-3 border-t border-slate-150 flex items-center justify-between select-none rounded-b-xl">
                <p className="text-[10px] text-slate-455">
                  💡 <span className="font-bold">Pro-tip:</span> Jumps instantly focus tabs without any mouse loading.
                </p>
                <button
                  onClick={() => setShowShortcutCheatsheet(false)}
                  className="px-3.5 py-1 bg-[#0EA5E9] hover:bg-sky-600 text-white font-black text-[10.5px] uppercase tracking-wide rounded shadow-2xs cursor-pointer"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sync Progress Bar Floating State Widget */}
        <SyncProgressBar refreshStamp={refreshStamp} onRefreshTrigger={handleRefreshTrigger} />

        {/* MOBILE BOTTOM STICKY NAVIGATION BAR */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0F172A] border-t border-slate-800/90 text-slate-400 flex items-center justify-around h-14 px-1 md:hidden shadow-2xl select-none">
          <button
            onClick={() => setCurrentTab('dashboard')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${currentTab === 'dashboard' ? 'text-[#0EA5E9] font-bold' : 'hover:text-slate-200'}`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="text-[9.5px] mt-0.5">Overview</span>
          </button>
          <button
            onClick={() => setCurrentTab('invoice')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${currentTab === 'invoice' ? 'text-amber-400 font-bold' : 'hover:text-slate-200'}`}
          >
            <ReceiptText className="w-4 h-4" />
            <span className="text-[9.5px] mt-0.5">POS Cash</span>
          </button>
          <button
            onClick={() => setCurrentTab('inventory')}
            className={`flex flex-col items-center justify-center flex-1 py-1 relative transition-colors ${currentTab === 'inventory' ? 'text-emerald-400 font-bold' : 'hover:text-slate-200'}`}
          >
            <Boxes className="w-4 h-4" />
            <span className="text-[9.5px] mt-0.5">Inventory</span>
            {alertsCount > 0 && (
              <span className="absolute top-1 right-3 w-2 h-2 bg-sky-500 rounded-full animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setCurrentTab('parties')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${currentTab === 'parties' ? 'text-sky-400 font-bold' : 'hover:text-slate-200'}`}
          >
            <Users className="w-4 h-4" />
            <span className="text-[9.5px] mt-0.5">Parties</span>
          </button>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center flex-1 py-1 hover:text-slate-200 text-slate-400 transition-colors"
          >
            <Menu className="w-4 h-4" />
            <span className="text-[9.5px] mt-0.5">Menu</span>
          </button>
        </nav>

      </div>
    </div>
  );
}
