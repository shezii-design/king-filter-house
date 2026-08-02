import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Cloud, 
  CloudOff, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  ChevronUp, 
  ChevronDown, 
  Minus,
  Wifi, 
  WifiOff, 
  AlertCircle,
  Database
} from 'lucide-react';
import { getSupabaseConfig, getSupabaseClient } from '../supabase';
import { db } from '../data';

interface SyncProgressBarProps {
  refreshStamp: number;
  onRefreshTrigger: () => void;
}

const KEYS_TO_SYNC = [
  { key: 'kfh_products', label: 'Products Stock' },
  { key: 'kfh_cross_refs', label: 'Cross References' },
  { key: 'kfh_movements', label: 'Stock Movements' },
  { key: 'kfh_parties', label: 'Clients & Ledgers' },
  { key: 'kfh_invoices', label: 'Invoices Issued' },
  { key: 'kfh_returns', label: 'Sales Returns' },
  { key: 'kfh_quotations', label: 'Quotations' },
  { key: 'kfh_payments', label: 'Payment Records' },
  { key: 'kfh_cheques', label: 'Post-Dated Cheques' },
  { key: 'kfh_cashbook', label: 'Cash Book' },
  { key: 'kfh_supplier_bills', label: 'Supplier Bills' },
  { key: 'kfh_purchase_orders', label: 'Purchase Orders' },
  { key: 'kfh_procurement_jobs', label: 'Procurement' },
  { key: 'kfh_rare_demands', label: 'Rare Demands' },
  { key: 'kfh_cipher_key', label: 'Encryption Key' },
  { key: 'kfh_shop_info', label: 'Shop Details & Phones' },
  { key: 'kfh_owner_name', label: 'Owner Profile Name' },
  { key: 'kfh_manager_name', label: 'Manager Profile Name' },
  { key: 'kfh_signature_pad_data', label: 'Owner Digital Signature' },
  { key: 'kfh_manager_signature_pad_data', label: 'Manager Digital Signature' }
];

// Custom deep comparison function to reliably compare local & remote JSON states
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i])) return false;
      }
      return true;
    }
    const keysA = Object.keys(a).filter(k => a[k] !== undefined);
    const keysB = Object.keys(b).filter(k => b[k] !== undefined);
    if (keysA.length !== keysB.length) return false;
    for (const k of keysA) {
      if (!keysB.includes(k)) return false;
      if (!deepEqual(a[k], b[k])) return false;
    }
    return true;
  }
  return false;
}

export default function SyncProgressBar({ refreshStamp, onRefreshTrigger }: SyncProgressBarProps) {
  const [viewState, setViewState] = useState<'expanded' | 'collapsed' | 'retracted'>(() => {
    const saved = localStorage.getItem('kfh_sync_indicator_state');
    if (saved === 'expanded' || saved === 'collapsed' || saved === 'retracted') {
      return saved as any;
    }
    return 'collapsed';
  });
  const [config, setConfig] = useState(getSupabaseConfig());
  const [syncPercentage, setSyncPercentage] = useState<number>(0);
  const [syncedCount, setSyncedCount] = useState<number>(0);
  const [keyStates, setKeyStates] = useState<Record<string, { inSync: boolean; localEmpty: boolean; remoteEmpty: boolean }>>({});
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [lastChecked, setLastChecked] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Handle online/offline events & auto-check on reconnection and data changes
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setTimeout(() => {
        analyzeSyncStatus();
      }, 1000);
    };
    const handleOffline = () => setIsOnline(false);

    let debounceTimer: any;
    const handleDataChange = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        analyzeSyncStatus();
      }, 600);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('kfh_data_changed', handleDataChange);

    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('kfh_data_changed', handleDataChange);
    };
  }, []);

  // Update config when refreshStamp changes
  useEffect(() => {
    setConfig(getSupabaseConfig());
  }, [refreshStamp]);

  // Run analysis when config or refreshStamp updates
  useEffect(() => {
    analyzeSyncStatus();
  }, [config.isActive, config.url, refreshStamp]);

  // Auto-schedule checks if Supabase is active
  useEffect(() => {
    if (!config.isActive) return;
    const interval = setInterval(() => {
      analyzeSyncStatus();
    }, 45000); // Check every 45s silently

    return () => clearInterval(interval);
  }, [config.isActive, config.url]);

  const analyzeSyncStatus = async () => {
    const freshConfig = getSupabaseConfig();
    if (!freshConfig.isActive || !freshConfig.url || !freshConfig.anonKey) {
      setSyncPercentage(0);
      setSyncedCount(0);
      setKeyStates({});
      setErrorMsg('Supabase offline/not configured in Settings');
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg('');
    try {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error("Could not instantiate Supabase client");
      }

      // Fetch unified state rows in one single efficient query
      const { data, error } = await (client as any)
        .from('kfh_app_state')
        .select('key, value');

      if (error) {
        // Handle postgres schema not existing yet
        if (error.code === 'PGRST116' || error.message.includes('not found') || error.message.includes('relation "kfh_app_state" does not exist')) {
          setErrorMsg('kfh_app_state table is missing in Supabase. Run SQL query in Supabase Editor.');
          setSyncPercentage(0);
          setSyncedCount(0);
          return;
        }
        throw error;
      }

      // Map remote state by key
      const remoteState: Record<string, any> = {};
      if (data) {
        for (const row of data) {
          remoteState[row.key] = row.value;
        }
      }

      const states: Record<string, { inSync: boolean; localEmpty: boolean; remoteEmpty: boolean }> = {};
      let matchCount = 0;

      for (const item of KEYS_TO_SYNC) {
        const localRaw = localStorage.getItem(item.key);
        
        let localParsed: any = null;
        let isLocalEmpty = true;
        if (localRaw) {
          try {
            localParsed = JSON.parse(localRaw);
            isLocalEmpty = !localParsed || (Array.isArray(localParsed) && localParsed.length === 0);
          } catch {
            localParsed = localRaw;
            isLocalEmpty = !localRaw;
          }
        }

        const remoteValue = remoteState[item.key];
        const isRemoteEmpty = remoteValue === undefined || remoteValue === null || (Array.isArray(remoteValue) && remoteValue.length === 0);

        // Standardize default cases for pristine states
        let finalLocalCompare = localParsed;
        if (localParsed === null) {
          if (item.key === 'kfh_cipher_key') {
            finalLocalCompare = 'SAKURYFLOW';
          } else if (item.key === 'kfh_owner_name') {
            finalLocalCompare = 'Shahzar';
          } else if (item.key === 'kfh_manager_name') {
            finalLocalCompare = 'Shop Manager';
          } else if (item.key === 'kfh_signature_pad_data' || item.key === 'kfh_manager_signature_pad_data') {
            finalLocalCompare = '';
          } else if (item.key === 'kfh_shop_info') {
            finalLocalCompare = {};
          } else {
            finalLocalCompare = [];
          }
        }

        let inSync = false;
        if (remoteValue === undefined) {
          // If neither exists, they are technically in sync (both pristine empty)
          inSync = isLocalEmpty;
        } else {
          inSync = deepEqual(finalLocalCompare, remoteValue);
        }

        if (inSync) {
          matchCount++;
        }

        states[item.key] = {
          inSync,
          localEmpty: isLocalEmpty,
          remoteEmpty: isRemoteEmpty
        };
      }

      setSyncedCount(matchCount);
      setKeyStates(states);
      setSyncPercentage(Math.round((matchCount / KEYS_TO_SYNC.length) * 100));
      setLastChecked(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err: any) {
      const errMsg = err?.message || '';
      const isFetchError = errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('fetch failed') || errMsg.includes('Failed to execute');
      
      if (isFetchError) {
        setErrorMsg('Sync server unreachable (Network offline or blocked)');
      } else {
        console.warn('[Sync Analysis error]:', errMsg);
        setErrorMsg(errMsg || 'Handshake issue. Check internet or Supabase status.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleManualPushSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await (db as any).syncAllWithSupabase('push');
      if (res.success) {
        onRefreshTrigger();
        await analyzeSyncStatus();
      } else {
        alert(`Push Sync issue: ${res.message}`);
      }
    } catch (err: any) {
      alert(`Transmission failed: ${err?.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualPullSync = async () => {
    if (isSyncing) return;
    if (!confirm("⚠️ RESTORE CLOUD BACKUP INTO BROWSER?\n\nThis will download the entire state from Supabase, overwriting all current local lists in this browser. This action is irreversible.")) {
      return;
    }
    setIsSyncing(true);
    try {
      const res = await (db as any).syncAllWithSupabase('pull');
      if (res.success) {
        alert("🎉 CLOUD DATA RESTORED SUCCESSFULLY!\nBrowser cache updated. The application will now reload.");
        window.location.reload();
      } else {
        alert(`Pull Sync issue: ${res.message}`);
      }
    } catch (err: any) {
      alert(`Pull failed: ${err?.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Determine progress bar styling colors
  const getBarColorClass = () => {
    if (!config.isActive) return 'bg-gray-300';
    if (syncPercentage === 100) return 'bg-emerald-500';
    if (syncPercentage >= 70) return 'bg-indigo-500';
    if (syncPercentage >= 35) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const getPercentageTextColorClass = () => {
    if (!config.isActive) return 'text-gray-500';
    if (syncPercentage === 100) return 'text-emerald-600';
    if (syncPercentage >= 70) return 'text-indigo-600';
    if (syncPercentage >= 35) return 'text-amber-600';
    return 'text-rose-600';
  };

  return (
    <div 
      id="sync-progress-bar-widget" 
      className={`fixed bottom-4 right-4 z-50 font-sans select-none transition-all duration-300 ${
        viewState === 'retracted' ? 'w-auto' : 'max-w-sm w-80 md:w-96'
      }`}
    >
      <AnimatePresence mode="wait">
        {viewState === 'retracted' ? (
          /* Retracted Tiny Floating Action Circle */
          <motion.button
            key="retracted"
            initial={{ opacity: 0, scale: 0.8, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 15 }}
            onClick={() => {
              setViewState('collapsed');
              localStorage.setItem('kfh_sync_indicator_state', 'collapsed');
            }}
            className="group relative flex items-center justify-center w-10 h-10 bg-[#111C30] text-white rounded-full shadow-2xl hover:bg-slate-800 transition-all border border-slate-700/50 cursor-pointer"
            title="Show Sync Indicator"
          >
            {/* Main Cloud icon */}
            {config.isActive && isOnline ? (
              <Cloud className={`w-5 h-5 text-sky-400 ${isAnalyzing || isSyncing ? 'animate-bounce' : ''}`} />
            ) : (
              <CloudOff className="w-5 h-5 text-gray-400" />
            )}
            
            {/* Tiny indicator badge on the top right of the circle */}
            <span className={`absolute top-0 right-0 w-3 h-3 rounded-full border border-slate-900 ${
              config.isActive && isOnline 
                ? (syncPercentage === 100 ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse') 
                : 'bg-rose-500'
            }`} />

            {/* Hover tooltip */}
            <div className="absolute right-12 bottom-0 bg-slate-950 text-white text-[10px] uppercase font-mono tracking-wider px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none scale-95 group-hover:scale-100 duration-150 border border-slate-800">
              {config.isActive ? `${syncPercentage}% Synced` : 'Offline Mode'}
            </div>
          </motion.button>
        ) : viewState === 'collapsed' ? (
          /* Collapsed Floating Pill */
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            onClick={() => {
              setViewState('expanded');
              localStorage.setItem('kfh_sync_indicator_state', 'expanded');
            }}
            className="flex items-center justify-between w-full bg-[#111C30] text-white rounded-full px-4 py-2.5 shadow-xl hover:bg-slate-800 transition-all border border-slate-700/50 cursor-pointer"
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="relative">
                {config.isActive && isOnline ? (
                  <Cloud className={`w-4 h-4 text-sky-400 ${isAnalyzing || isSyncing ? 'animate-bounce' : ''}`} />
                ) : (
                  <CloudOff className="w-4 h-4 text-gray-400" />
                )}
                <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-slate-900 ${
                  config.isActive && isOnline 
                    ? (syncPercentage === 100 ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse') 
                    : 'bg-rose-500'
                }`} />
              </div>
              
              <div className="flex flex-col text-left min-w-0">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono">
                  {config.isActive ? 'Supabase Sync' : 'LocalStorage Only'}
                </span>
                <span className="text-[10px] text-slate-400 truncate font-mono">
                  {config.isActive 
                    ? `${syncPercentage}% Synced (${syncedCount}/${KEYS_TO_SYNC.length} lists)` 
                    : 'Configure in Settings'
                  }
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 ml-2 shrink-0">
              {config.isActive && (
                <div className={`h-1.5 w-12 bg-slate-800 rounded-full overflow-hidden`}>
                  <div 
                    className={`h-full transition-all duration-500 ${getBarColorClass()}`} 
                    style={{ width: `${syncPercentage}%` }} 
                  />
                </div>
              )}
              
              <div className="flex items-center space-x-1">
                {/* Minimize button to minimize to simple indicator */}
                <span
                  title="Retract / Hide of Screen"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewState('retracted');
                    localStorage.setItem('kfh_sync_indicator_state', 'retracted');
                  }}
                  className="p-1 hover:bg-slate-700 rounded transition text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </span>
                
                <span
                  title="Expand detail view"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewState('expanded');
                    localStorage.setItem('kfh_sync_indicator_state', 'expanded');
                  }}
                  className="p-1 hover:bg-slate-700 rounded transition text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                </span>
              </div>
            </div>
          </motion.button>
        ) : (
          /* Expanded Panel View */
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-[#111C30] text-white px-4 py-3.5 flex items-center justify-between border-b border-slate-800/60">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-[#0EA5E9]" />
                <div>
                  <h4 className="text-xs font-bold font-mono tracking-wider uppercase">Cloud Synchronization</h4>
                  <p className="text-[9px] text-slate-400">Offline-first Hybrid State Tracker</p>
                </div>
              </div>
              <div className="flex items-center space-x-1.5">
                <button 
                  title="Hide to corner indicator"
                  onClick={() => {
                    setViewState('retracted');
                    localStorage.setItem('kfh_sync_indicator_state', 'retracted');
                  }}
                  className="p-1 hover:bg-slate-800 rounded transition text-slate-400 hover:text-white cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button 
                  title="Collapse to pill bar"
                  onClick={() => {
                    setViewState('collapsed');
                    localStorage.setItem('kfh_sync_indicator_state', 'collapsed');
                  }}
                  className="p-1 hover:bg-slate-800 rounded transition text-slate-400 hover:text-white cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Panel Body */}
            <div className="p-4 space-y-3.5 max-h-[340px] overflow-y-auto custom-scrollbar">
              {/* Online indicator & errors */}
              <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                <div className="flex items-center space-x-1">
                  {isOnline ? (
                    <span className="flex items-center text-emerald-600 font-bold">
                      <Wifi className="w-3.5 h-3.5 mr-1" /> ONLINE
                    </span>
                  ) : (
                    <span className="flex items-center text-rose-500 font-bold">
                      <WifiOff className="w-3.5 h-3.5 mr-1 animate-pulse" /> OFFLINE
                    </span>
                  )}
                  {config.isActive && <span className="text-gray-300">|</span>}
                  {config.isActive && (
                    <span className="text-[9px] max-w-[150px] truncate" title={config.url}>
                      Host: {config.url.replace('https://', '').split('.')[0]}
                    </span>
                  )}
                </div>
                {lastChecked && (
                  <span>Refreshed: {lastChecked}</span>
                )}
              </div>

              {/* Progress and percentage summary */}
              {config.isActive ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-gray-700 font-mono uppercase tracking-tight">Overall Progress</span>
                    <span className={`text-base font-extrabold font-mono ${getPercentageTextColorClass()}`}>
                      {syncPercentage}%
                    </span>
                  </div>
                  <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <motion.div 
                      key="progress-bar-inner"
                      initial={{ width: 0 }}
                      animate={{ width: `${syncPercentage}%` }}
                      transition={{ type: 'spring', stiffness: 60, damping: 15 }}
                      className={`h-full rounded-full ${getBarColorClass()}`}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                    <span>{syncedCount} of {KEYS_TO_SYNC.length} databases identical</span>
                    <span>{Math.max(0, KEYS_TO_SYNC.length - syncedCount)} pending updates</span>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-center space-y-1">
                  <AlertCircle className="w-5 h-5 text-amber-500 mx-auto" />
                  <p className="text-[11px] font-bold text-amber-800">Supabase Integration Unconfigured</p>
                  <p className="text-[10px] text-amber-700 leading-relaxed">
                    Data is safely cached locally in your Browser, but you haven't activated permanent Cloud synchronization yet. Navigate to <strong>Settings Tab</strong> to define credentials.
                  </p>
                </div>
              )}

              {errorMsg && (
                <div className="bg-rose-50 rounded-lg p-2.5 border border-rose-200 flex items-start space-x-2 text-[10px] text-rose-700">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span className="font-semibold leading-relaxed shrink min-w-0 break-words">{errorMsg}</span>
                </div>
              )}

              {/* Grid of keys mapped status */}
              {config.isActive && Object.keys(keyStates).length > 0 && (
                <div className="space-y-1">
                  <div className="text-[9px] font-extrabold uppercase text-slate-400 font-mono tracking-wider">
                    Collection Alignment Matrix
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                    {KEYS_TO_SYNC.map((item) => {
                      const state = keyStates[item.key];
                      if (!state) return null;
                      return (
                        <div 
                          key={item.key} 
                          className="flex items-center justify-between p-1.5 rounded bg-slate-50 border border-slate-100 min-w-0"
                        >
                          <span className="text-gray-700 font-semibold truncate max-w-[110px]" title={item.label}>
                            {item.label}
                          </span>
                          <span className="flex items-center shrink-0 ml-1">
                            {state.inSync ? (
                              <span className="h-2 w-2 rounded-full bg-emerald-500" title="Identical" />
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" title="Differences pending sync" />
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons panel footer */}
            {config.isActive && (
              <div className="bg-slate-50 border-t border-slate-205 px-4 py-2.5 flex items-center justify-between">
                <button
                  disabled={isAnalyzing || isSyncing}
                  onClick={analyzeSyncStatus}
                  className="flex items-center space-x-1 text-[10px] font-extrabold uppercase text-gray-500 hover:text-black transition disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  <span>Check</span>
                </button>

                <div className="flex space-x-2">
                  <button
                    disabled={isSyncing}
                    onClick={handleManualPullSync}
                    className="px-2.5 py-1 text-[10px] font-extrabold uppercase text-indigo-600 hover:bg-indigo-50 rounded transition border border-indigo-200 disabled:opacity-50 cursor-pointer"
                  >
                    Pull Restore
                  </button>
                  <button
                    disabled={isSyncing}
                    onClick={handleManualPushSync}
                    className="px-3 py-1 text-[10px] font-extrabold uppercase text-white bg-[#111C30] border border-slate-900 hover:bg-slate-800 rounded transition shadow-sm disabled:opacity-50 flex items-center space-x-1 cursor-pointer"
                  >
                    {isSyncing && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                    <span>{isSyncing ? 'Syncing...' : 'Push Backup'}</span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
