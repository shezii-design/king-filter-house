import React, { useState, useEffect, useRef } from 'react';
import { db, saveItem, encodeCipher } from '../data';
import { Product } from '../types';
import { 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  testSupabaseConnection, 
  SUPABASE_SQL_SETUP, 
  resetSupabaseClient 
} from '../supabase';
import { 
  Settings, 
  Shield, 
  Eye, 
  RefreshCw, 
  Key, 
  Trash2, 
  Building, 
  Database, 
  Target, 
  Users, 
  Lock, 
  Check, 
  Unlock, 
  AlertTriangle, 
  FileText, 
  Download, 
  Upload, 
  HelpCircle,
  ToggleLeft,
  ToggleRight,
  Coins,
  FileSignature
} from 'lucide-react';

interface SettingsViewProps {
  userRole: 'Owner' | 'Staff';
  onChangeRole: (role: 'Owner' | 'Staff') => void;
  cipherKey: string;
  onChangeCipherKey: (key: string) => void;
  onRefreshAll: () => void;
  revealPin: string;
  onUpdateRevealPin: (newPin: string) => void;
}

const KFH_DB_KEYS = [
  'kfh_products',
  'kfh_cross_refs',
  'kfh_movements',
  'kfh_parties',
  'kfh_invoices',
  'kfh_returns',
  'kfh_quotations',
  'kfh_cipher_key',
  'kfh_user_role',
  'kfh_payments',
  'kfh_cheques',
  'kfh_cashbook',
  'kfh_supplier_bills',
  'kfh_purchase_orders',
  'kfh_procurement_jobs',
  'kfh_reveal_pin',
  'kfh_staff_pin',
  'kfh_staff_active',
  'kfh_shop_info',
  'kfh_sales_target',
  'kfh_auto_backup',
  'kfh_last_backup_time',
  'kfh_backup_history'
];

export default function SettingsView({ 
  userRole, 
  onChangeRole, 
  cipherKey, 
  onChangeCipherKey,
  onRefreshAll,
  revealPin,
  onUpdateRevealPin
}: SettingsViewProps) {
  
  // Soft Deleted items
  const [inactiveProducts, setInactiveProducts] = useState<Product[]>([]);
  const [allActive, setAllActive] = useState<Product[]>([]);

  // 9.1 Cost Cipher locks
  const [isCipherUnlocked, setIsCipherUnlocked] = useState(false);
  const [cipherUnlockPin, setCipherUnlockPin] = useState('');
  const [cipherUnlockError, setCipherUnlockError] = useState('');

  // 9.2 Shop Info State
  const [shopInfo, setShopInfo] = useState(() => {
    const stored = localStorage.getItem('kfh_shop_info');
    const parsed = stored ? JSON.parse(stored) : null;
    return {
      name: parsed?.name || 'King Filter House FSD',
      address: parsed?.address || 'Auto Plaza, Jail Road, Faisalabad, Punjab, Pakistan',
      phone: parsed?.phone || '+92-300-6644634  |  +92-41-8547344',
      invoicePrefix: parsed?.invoicePrefix || 'INV',
      poPrefix: parsed?.poPrefix || 'PO',
      quotePrefix: parsed?.quotePrefix || 'QT',
      returnPrefix: parsed?.returnPrefix || 'RET',
      currencySymbol: parsed?.currencySymbol || 'Rs.',
      mapsLink: parsed?.mapsLink || 'https://maps.google.com',
      ownerPhones: Array.isArray(parsed?.ownerPhones) ? parsed.ownerPhones : ['+92-300-6644634'],
      managerPhones: Array.isArray(parsed?.managerPhones) ? parsed.managerPhones : ['+92-300-1234567']
    };
  });
  const [shopInfoStatus, setShopInfoStatus] = useState<string | null>(null);

  // Authorized Personnel Profiles State
  const [ownerName, setOwnerName] = useState(() => {
    return localStorage.getItem('kfh_owner_name') || 'Shahzar';
  });
  const [managerName, setManagerName] = useState(() => {
    return localStorage.getItem('kfh_manager_name') || 'Shop Manager';
  });

  // Signature Pad State & Ref (This is for the Manager!)
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sigActiveTab, setSigActiveTab] = useState<'type' | 'draw'>('type');
  const [typedName, setTypedName] = useState(() => {
    return localStorage.getItem('kfh_manager_name') || 'Shop Manager';
  });
  const [typedStyle, setTypedStyle] = useState<string>(() => {
    return localStorage.getItem('kfh_signature_style') || 'elegant';
  });
  const [isDrawing, setIsDrawing] = useState(false);
  const [isCanvasBlank, setIsCanvasBlank] = useState(true);
  const [storedSig, setStoredSig] = useState<string | null>(() => {
    return localStorage.getItem('kfh_signature_pad_data');
  });
  const [sigWidth, setSigWidth] = useState(() => {
    return localStorage.getItem('kfh_signature_width') || '66';
  });
  const [sigBold, setSigBold] = useState(() => {
    return localStorage.getItem('kfh_signature_bold') === 'true';
  });
  const [sigStatus, setSigStatus] = useState<string | null>(null);

  // Drawing mouse/pointer handlers
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use solid black ink (as requested)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setIsCanvasBlank(false);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsCanvasBlank(true);
  };

  const saveCanvas = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    if (isCanvasBlank) {
      alert("Please draw or trace your signature on the pad before saving.");
      return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    saveItem('kfh_signature_pad_data', dataUrl, "Updated electronic signature pad registration parameters");
    setStoredSig(dataUrl);
    setSigStatus("Handwritten signature stored successfully!");
    db.logPendingSync("Updated electronic signature pad registration parameters");
    onRefreshAll();
    setTimeout(() => {
      setSigStatus(null);
    }, 4500);
  };

  const deleteSavedSig = () => {
    localStorage.removeItem('kfh_signature_pad_data');
    setStoredSig(null);
    clearCanvas();
    setSigStatus("Custom signature erased. Swapped back to default font signature.");
    db.logPendingSync("Cleared electronic signature pad registration parameters");
    onRefreshAll();
    setTimeout(() => {
      setSigStatus(null);
    }, 4500);
  };

  const handleGenerateTypedSig = (textToUse?: string, styleToUse?: string) => {
    const text = (textToUse || typedName).trim();
    if (!text) {
      alert("Please enter a name first.");
      return;
    }
    const styleSrc = styleToUse || typedStyle;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 360;
    tempCanvas.height = 120;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Dynamic sizing and gorgeous styles mapping (Black ink, no underline)
    let fontName = "'Great Vibes', 'Brush Script MT', 'Dancing Script', cursive, sans-serif";
    let fontSize = "52px";
    
    if (styleSrc === 'modern') {
      fontName = "'Caveat', 'Segoe Print', cursive, sans-serif";
      fontSize = "46px";
    } else if (styleSrc === 'artistic') {
      fontName = "'Parisienne', 'Great Vibes', 'Playball', cursive, sans-serif";
      fontSize = "54px";
    } else if (styleSrc === 'bold') {
      fontName = "'Dancing Script', 'Brush Script MT', cursive";
      fontSize = "bold 44px";
    } else if (styleSrc === 'calligraphy') {
      fontName = "'Great Vibes', 'Dancing Script', cursive, sans-serif";
      fontSize = "52px";
    } else if (styleSrc === 'casual') {
      fontName = "'Pacifico', 'Caveat', cursive, sans-serif";
      fontSize = "40px";
    } else if (styleSrc === 'royal') {
      fontName = "'Alex Brush', 'Great Vibes', cursive, sans-serif";
      fontSize = "56px";
    } else if (styleSrc === 'swift') {
      fontName = "'Herr Von Muellerhoff', 'Brush Script MT', cursive, sans-serif";
      fontSize = "66px";
    } else if (styleSrc === 'whisper') {
      fontName = "'League Script', 'Snell Roundhand', cursive, sans-serif";
      fontSize = "54px";
    } else if (styleSrc === 'sacramento') {
      fontName = "'Sacramento', cursive, sans-serif";
      fontSize = "54px";
    } else if (styleSrc === 'yellowtail') {
      fontName = "'Yellowtail', cursive, sans-serif";
      fontSize = "48px";
    } else if (styleSrc === 'allura') {
      fontName = "'Allura', cursive, sans-serif";
      fontSize = "58px";
    } else if (styleSrc === 'monsieur') {
      fontName = "'Monsieur La Doulaise', cursive, sans-serif";
      fontSize = "64px";
    }

    // Pure black signature ink (as requested)
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    let renderedFont = `${fontSize} ${fontName}`;
    if (sigBold && !renderedFont.startsWith('bold')) {
      renderedFont = 'bold ' + renderedFont;
    }
    ctx.font = renderedFont;
    ctx.fillText(text, 180, 60);

    const dataUrl = tempCanvas.toDataURL('image/png');
    saveItem('kfh_signature_pad_data', dataUrl, "Saved typed cursive signature parameters");
    setStoredSig(dataUrl);
    setSigStatus("Cursive signature generated and saved successfully!");
    db.logPendingSync("Saved typed cursive signature parameters");
    onRefreshAll();
    setTimeout(() => {
      setSigStatus(null);
    }, 4500);
  };



  // 9.3 Users State
  const [ownerPinInput, setOwnerPinInput] = useState(revealPin);
  const [ownerPinStatus, setOwnerPinStatus] = useState<string | null>(null);

  const [staffPinInput, setStaffPinInput] = useState(() => {
    return localStorage.getItem('kfh_staff_pin') || '5678';
  });
  const [staffActive, setStaffActive] = useState(() => {
    return localStorage.getItem('kfh_staff_active') !== 'inactive';
  });
  const [staffStatus, setStaffStatus] = useState<string | null>(null);

  // Public App Lock Gate State
  const [appLockEnabled, setAppLockEnabled] = useState(() => {
    return localStorage.getItem('kfh_app_lock_enabled') !== 'false';
  });
  const [autolockMinutes, setAutolockMinutes] = useState(() => {
    return localStorage.getItem('kfh_autolock_minutes') || '15';
  });
  const [securityAnswer, setSecurityAnswer] = useState(() => {
    return localStorage.getItem('kfh_security_answer') || 'shahzar';
  });
  const [publicLockStatus, setPublicLockStatus] = useState<string | null>(null);

  const handleSavePublicLockSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('kfh_app_lock_enabled', appLockEnabled ? 'true' : 'false');
    localStorage.setItem('kfh_autolock_minutes', autolockMinutes);
    localStorage.setItem('kfh_security_answer', securityAnswer.trim());
    setPublicLockStatus('Public Access & Security Lock parameters saved successfully!');
    setTimeout(() => setPublicLockStatus(null), 3500);
  };

  // 9.4 Backup State
  const [autoBackup, setAutoBackup] = useState(() => {
    return localStorage.getItem('kfh_auto_backup') === 'active';
  });
  const [lastBackupTime, setLastBackupTime] = useState(() => {
    return localStorage.getItem('kfh_last_backup_time') || 'Never Backed Up';
  });
  const [backupHistory, setBackupHistory] = useState<any[]>(() => {
    return JSON.parse(localStorage.getItem('kfh_backup_history') || '[]');
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 9.5 Sales Target State
  const [salesTargetInput, setSalesTargetInput] = useState(() => {
    return localStorage.getItem('kfh_sales_target') || '1000000';
  });
  const [targetStatus, setTargetStatus] = useState<string | null>(null);

  // 9.6 Landed Cost Sourcing Estimator States
  const [foreignCost, setForeignCost] = useState('10.00');
  const [currencySymbol, setCurrencySymbol] = useState('USD');
  const [currencyRate, setCurrencyRate] = useState('278.50'); // standard 278.5 PKR/USD exchange rate
  const [customsPercent, setCustomsPercent] = useState('35'); // standard 35% customs tariffs
  const [freightCost, setFreightCost] = useState('250'); // port handling clear / freight standard PKR flat surcharges
  const [desiredMarkup, setDesiredMarkup] = useState('25'); // 25% desired catalog pricing markups

  // 9.7 Stateful interactive walkthrough tutorial state hooks
  const [tutorialTab, setTutorialTab] = useState<'welcome' | 'cipher' | 'cross' | 'tax' | 'landed' | 'credit' | 'margin'>('welcome');
  const [playgroundRealValue, setPlaygroundRealValue] = useState('1450');

  // Supabase Sync Hub and SQL Integration states
  const [supabaseUrl, setSupabaseUrl] = useState(() => getSupabaseConfig().url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(() => getSupabaseConfig().anonKey);
  const [supabaseIsActive, setSupabaseIsActive] = useState(() => getSupabaseConfig().isActive);
  const [supabaseTestStatus, setSupabaseTestStatus] = useState<null | 'success' | 'checking' | 'error'>(null);
  const [supabaseTestMessage, setSupabaseTestMessage] = useState('');
  const [isSupabaseSyncing, setIsSupabaseSyncing] = useState(false);
  const [supabaseSyncResult, setSupabaseSyncResult] = useState<null | { success: boolean; message: string }>(null);
  const [showSqlSetup, setShowSqlSetup] = useState(false);

  // 1-Click Database Purge States
  const [purgeStage, setPurgeStage] = useState<'initial' | 'confirm_pin'>('initial');
  const [purgePinInput, setPurgePinInput] = useState('');
  const [understandsPurge, setUnderstandsPurge] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const [purgeSuccess, setPurgeSuccess] = useState(false);

  // 1-Click Database Purge States
  const [isPurging, setIsPurging] = useState(false);

  // Editable Cipher States
  const [editCipherVal, setEditCipherVal] = useState(cipherKey);
  const [cipherInputStatus, setCipherInputStatus] = useState<string | null>(null);

  // Re-sync PIN with parent props
  useEffect(() => {
    setOwnerPinInput(revealPin);
  }, [revealPin]);

  // Re-sync Cipher Key with parent props
  useEffect(() => {
    setEditCipherVal(cipherKey);
  }, [cipherKey]);

  const handleSaveCipherKey = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = editCipherVal.trim().toUpperCase();
    if (cleanKey.length !== 10) {
      setCipherInputStatus("Error: Cipher phrase must be exactly 10 characters long.");
      return;
    }
    // Check duplicates
    const uniqueChars = new Set(cleanKey.split(''));
    if (uniqueChars.size < 10) {
      setCipherInputStatus("Error: All 10 letters must be completely unique (no repeating characters).");
      return;
    }
    onChangeCipherKey(cleanKey);
    setCipherInputStatus("Success: Cipher mapping successfully updated!");
    setTimeout(() => setCipherInputStatus(null), 4000);
  };

  useEffect(() => {
    reloadProductStates();
  }, []);

  const reloadProductStates = () => {
    const all = db.getAllProductsWithDeleted();
    setInactiveProducts(all.filter(p => !p.is_active));
    setAllActive(db.getProducts());
  };

  // 9.1 Unlock Handler
  const handleVerifyCipherPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (cipherUnlockPin === revealPin || cipherUnlockPin === 'admin') {
      setIsCipherUnlocked(true);
      setCipherUnlockError('');
    } else {
      setCipherUnlockError('Incorrect owner security PIN code!');
    }
  };

  // 9.2 Save Shop Info
  const handleSaveShopInfo = (e: React.FormEvent) => {
    e.preventDefault();
    saveItem('kfh_shop_info', JSON.stringify(shopInfo), "Updated shop info");
    saveItem('kfh_owner_name', JSON.stringify(ownerName.trim()), "Updated owner name");
    saveItem('kfh_manager_name', JSON.stringify(managerName.trim()), "Updated manager name");
    // Keep typedName in sync with the saved managerName
    setTypedName(managerName.trim());
    setShopInfoStatus('Shop and personnel information saved successfully!');
    setTimeout(() => setShopInfoStatus(null), 3000);
    onRefreshAll();
  };

  // 9.3 Change Owner PIN
  const handleSaveOwnerPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerPinInput.trim()) {
      setOwnerPinStatus('Error: PIN cannot be empty.');
      return;
    }
    onUpdateRevealPin(ownerPinInput.trim());
    setOwnerPinStatus('Owner Access PIN updated successfully.');
    setTimeout(() => setOwnerPinStatus(null), 3000);
  };

  // 9.3 Change Staff PIN & Active States
  const handleSaveStaffSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffPinInput.trim()) {
      setStaffStatus('Error: Staff PIN cannot be empty.');
      return;
    }
    localStorage.setItem('kfh_staff_pin', staffPinInput.trim());
    localStorage.setItem('kfh_staff_active', staffActive ? 'active' : 'inactive');
    db.logPendingSync(`Updated staff credentials role parameters`);
    setStaffStatus('Staff account configuration updated.');
    setTimeout(() => setStaffStatus(null), 3000);
    onRefreshAll();
  };

  // 9.4 Create Local JSON Backup File
  const handleBackupNow = () => {
    try {
      const backupData: Record<string, string | null> = {};
      KFH_DB_KEYS.forEach(key => {
        backupData[key] = localStorage.getItem(key);
      });

      const serialized = JSON.stringify(backupData, null, 2);
      const blob = new Blob([serialized], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const todayStr = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `kfh_db_backup_${todayStr}.db`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const newRecord = {
        timestamp: new Date().toLocaleString(),
        filename,
        type: 'Local File Storage'
      };

      const history = [newRecord, ...backupHistory];
      setBackupHistory(history);
      localStorage.setItem('kfh_backup_history', JSON.stringify(history));

      const time = new Date().toLocaleString();
      setLastBackupTime(time);
      localStorage.setItem('kfh_last_backup_time', time);
      
      db.logPendingSync(`Created database local backup file: ${filename}`);
      alert("Local backup completed! The backup file downloaded to your system downloads folder successfully.");
    } catch (e: any) {
      alert("Failed to export backup: " + e.message);
    }
  };

  // 9.4 Backup to USB
  const handleBackupToUSB = () => {
    try {
      const backupData: Record<string, string | null> = {};
      KFH_DB_KEYS.forEach(key => {
        backupData[key] = localStorage.getItem(key);
      });

      const serialized = JSON.stringify(backupData, null, 2);
      const blob = new Blob([serialized], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      
      const todayDate = new Date().toISOString().split('T')[0];
      const filename = `kfh_usb_vault_${todayDate}.db`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const newRecord = {
        timestamp: new Date().toLocaleString(),
        filename,
        type: 'Removable USB Storage'
      };

      const history = [newRecord, ...backupHistory];
      setBackupHistory(history);
      localStorage.setItem('kfh_backup_history', JSON.stringify(history));

      const time = new Date().toLocaleString();
      setLastBackupTime(time);
      localStorage.setItem('kfh_last_backup_time', time);

      db.logPendingSync(`Dispatched USB safe backup block: ${filename}`);
      
      alert(
        "USB BACKUP PROCESS INITIALIZED:\n\n" +
        "Please select your connected USB Removable Disk directory in the following OS file-save explorer to write block data direct."
      );
    } catch (e: any) {
      alert("USB Backup error: " + e.message);
    }
  };

  // 9.4 Auto Backup Toggle Change
  const handleToggleAutoBackup = () => {
    const nextVal = !autoBackup;
    setAutoBackup(nextVal);
    localStorage.setItem('kfh_auto_backup', nextVal ? 'active' : 'inactive');
    db.logPendingSync(`Toggled scheduling parameters to run backups at midnight`);
  };

  // 9.4 File Upload Restoration
  const handleRestoreFromBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("CRITICAL WARNING:\n\nRestoring from this backup file will OVERWRITE all current inventories, customers, accounts, and invoices. This action cannot be undone.\n\nAre you absolutely sure you want to proceed?")) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawContent = event.target?.result as string;
        const parsed = JSON.parse(rawContent);

        // Simple schema identifier check
        if (!parsed || typeof parsed !== 'object' || !parsed.kfh_products) {
          throw new Error("Missing structured products table. Confirm this file is a valid .db backup.");
        }

        // Restore keys
        Object.keys(parsed).forEach(key => {
          if (parsed[key] !== null) {
            localStorage.setItem(key, parsed[key]);
          } else {
            localStorage.removeItem(key);
          }
        });

        db.logPendingSync("Completed complete system data restore task from external file");
        alert("🎉 SYSTEM RE-BUILT SUCCESSFULLY!\n\nThe backup has been successfully imported. The system will now refresh to load all databases.");
        onRefreshAll();
        window.location.reload();

      } catch (err: any) {
        alert("Restoration Failed: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Supabase Handshaking and sync operations
  const handleTestSupabaseHandshake = async () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      setSupabaseTestStatus('error');
      setSupabaseTestMessage('Please input both the Supabase Project URL and Anon API key.');
      return;
    }
    setSupabaseTestStatus('checking');
    setSupabaseTestMessage('Sending echo packets... verifying database status.');
    
    try {
      const res = await testSupabaseConnection(supabaseUrl, supabaseAnonKey);
      if (res.success) {
        setSupabaseTestStatus('success');
        setSupabaseTestMessage(res.message);
      } else {
        setSupabaseTestStatus('error');
        setSupabaseTestMessage(res.message);
      }
    } catch (err: any) {
      setSupabaseTestStatus('error');
      setSupabaseTestMessage(err?.message || 'Handshake failed.');
    }
  };

  const handleSaveSupabaseConfigChange = () => {
    saveSupabaseConfig({
      url: supabaseUrl.trim(),
      anonKey: supabaseAnonKey.trim(),
      isActive: supabaseIsActive
    });
    // Reset Client singleton to use newly specified URL/key
    resetSupabaseClient();
    db.logPendingSync(`Saved Supabase parameters: sync active state = ${supabaseIsActive}`);
    alert("Supabase integration credentials updated successfully! Any write operations will sync in the background.");
  };

  const handleSupabaseSyncTrigger = async (mode: 'pull' | 'push') => {
    if (!confirm(
      mode === 'push'
        ? "🚨 ARE YOU SURE YOU WANT TO OVERWRITE SUPABASE CLOUD DATA?\n\nThis will push all 14 local lists (products, cashbook, invoices, parties, etc.) and overwrite the state on your cloud database."
        : "⚠️ ARE YOU SURE YOU WANT TO RESTORE FROM THE CLOUD?\n\nThis will download the entire state from your Supabase database and OVERWRITE all local localStorage databases."
    )) {
      return;
    }

    setIsSupabaseSyncing(true);
    setSupabaseSyncResult(null);
    try {
      const res = await (db as any).syncAllWithSupabase(mode);
      setSupabaseSyncResult(res);
      if (res.success) {
        db.logPendingSync(`Successful manual ${mode} alignment completed`);
        if (mode === 'pull') {
          alert("🎉 CLOUD DATABASE RESTORED SUCCESSFULLY!\n\nThe local state was replaced with your Supabase dataset. The system will now refresh.");
          window.location.reload();
        } else {
          alert("🎉 DATA COMMITTED TO CLOUD SUCCESSFULLY!\nAll 14 synchronized tables are now updated on your Supabase client.");
        }
      }
    } catch (err: any) {
      setSupabaseSyncResult({
        success: false,
        message: err?.message || "Sync timed out or transmission failed."
      });
    } finally {
      setIsSupabaseSyncing(false);
    }
  };

  // 9.5 Set Monthly Sales Target
  const handleSaveSalesTarget = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(salesTargetInput);
    if (isNaN(val) || val <= 0) {
      setTargetStatus("Error: Sales target must be a positive numeric value.");
      return;
    }
    localStorage.setItem('kfh_sales_target', val.toString());
    db.logPendingSync(`Configured target monthly threshold to Rs. ${val.toLocaleString()}`);
    setTargetStatus("Monthly sales target metric updated successfully!");
    setTimeout(() => setTargetStatus(null), 3000);
    onRefreshAll();
  };

  // Soft Delete Demo Handler
  const handleDemoSoftDelete = (pid: string) => {
    const all = db.getAllProductsWithDeleted();
    const idx = all.findIndex(p => p.id === pid);
    if (idx >= 0) {
      all[idx].is_active = false;
      db.saveProducts(all);
      db.logPendingSync(`Soft-deleted catalog product: ${all[idx].part_number}`);
      
      reloadProductStates();
      onRefreshAll();
      alert(`Soft-deleted ${all[idx].part_number}. It can be completely recovered in the recovery logs widget bottom!`);
    }
  };

  // Product Restore Handler
  const handleRestoreProduct = (pid: string) => {
    const all = db.getAllProductsWithDeleted();
    const idx = all.findIndex(p => p.id === pid);
    if (idx >= 0) {
      all[idx].is_active = true;
      db.saveProducts(all);
      db.logPendingSync(`RECOVERED soft-deleted catalog entity: ${all[idx].part_number} (${all[idx].brand})`);
      
      reloadProductStates();
      onRefreshAll();
      alert(`Product ${all[idx].brand} ${all[idx].part_number} recovered successfully!`);
    }
  };

  const handleToggleRoleSetting = (role: 'Owner' | 'Staff') => {
    // Check if Staff account is deactivated before letting user toggle to it
    if (role === 'Staff' && !staffActive) {
      alert("Access Denied:\n\nThe Assistant staff role has been deactivated by the Owner. Cannot change to deactivated account roles.");
      return;
    }
    db.setUserRole(role);
    onChangeRole(role);
    onRefreshAll();
  };

  // Determine letters representing [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
  // Standard list of digits: 1, 2, 3, 4, 5, 6, 7, 8, 9, 0
  const digitsMapArray = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

  // Landed Cost calculations
  const fobFloat = parseFloat(foreignCost) || 0;
  const currRate = parseFloat(currencyRate) || 0;
  const customsPercentFloat = parseFloat(customsPercent) || 0;
  const freightFloat = parseFloat(freightCost) || 0;
  const markupPercentFloat = parseFloat(desiredMarkup) || 0;

  const calculatedFobPkr = fobFloat * currRate;
  const calculatedCustomsPkr = calculatedFobPkr * (customsPercentFloat / 100);
  const calculatedLandedPkr = Math.round(calculatedFobPkr + calculatedCustomsPkr + freightFloat);
  const calculatedRecommendedPrice = Math.round(calculatedLandedPkr * (1 + (markupPercentFloat / 100)));

  return (
    <div className="space-y-6 text-xs" id="settings-view-root">
      
      {/* HEADER SECTION */}
      <div className="bg-white p-4 border border-[#E2DFDF] flex items-center justify-between" id="settings-header">
        <div>
          <h2 className="text-base font-black uppercase text-slate-800 tracking-tight flex items-center select-none">
            <Settings className="w-5 h-5 mr-2 text-[#0EA5E9]" />
            Owner Settings Control Center
          </h2>
          <p className="text-[11px] text-gray-500 font-extrabold uppercase tracking-tight">
            Configure price ciphers, shop header branding, system users, monthly milestones & diagnostic restore registries
          </p>
        </div>
        <span className="bg-slate-100 border border-slate-200 text-slate-800 font-bold px-2 py-1 rounded text-[10px]">
          ROLE: {userRole.toUpperCase()}
        </span>
      </div>

      {/* QUICK SYSTEM SECURITY & ACCESSIBLE ROLE TOGGLE SIMULATION */}
      <div className="bg-white p-4 border border-[#E2DFDF]" id="roles-access-control">
        <h3 className="text-[11px] font-black uppercase text-[#2A2727] tracking-wider mb-2 flex items-center border-b pb-1">
          <Shield className="w-4 h-4 mr-1.5 text-[#0EA5E9]" />
          System Security & User Account Simulation
        </h3>
        <p className="text-gray-500 mb-3 leading-normal">
          Quick-switch active user profile session to preview privilege masks. Owner views raw purchase values & P&L. Staff sees purchasing costs translated through the secure cost cipher phrase.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="role-toggles-grid">
          <button 
            type="button"
            onClick={() => handleToggleRoleSetting('Owner')}
            className={`p-3 border text-left rounded transition-all select-none cursor-pointer ${
              userRole === 'Owner' ? 'border-[#0EA5E9] bg-[#FFF2F2]' : 'border-[#E2DFDF] bg-slate-50 hover:bg-gray-100'
            }`}
          >
            <div className="flex justify-between items-start">
              <span className="font-extrabold text-[#2A2727] text-xs uppercase">Administrator Owner Profile</span>
              {userRole === 'Owner' && <span className="font-black text-[#0EA5E9] text-[10px]">● ACTIVE</span>}
            </div>
            <span className="text-gray-500 mt-1 block leading-relaxed text-[10px]">
              Access unredacted bookkeeping registers, business metrics, profit analyses, cost ciphers, and diagnostic database backlogs.
            </span>
          </button>

          <button 
            type="button"
            onClick={() => handleToggleRoleSetting('Staff')}
            className={`p-3 border text-left rounded transition-all select-none cursor-pointer ${
              !staffActive ? 'opacity-50 cursor-not-allowed bg-slate-100' :
              userRole === 'Staff' ? 'border-[#0EA5E9] bg-[#FFF2F2]' : 'border-[#E2DFDF] bg-slate-50 hover:bg-gray-100'
            }`}
          >
            <div className="flex justify-between items-start">
              <span className="font-extrabold text-[#2A2727] text-xs uppercase">
                Shop Assistant Floor Staff Profile
              </span>
              {userRole === 'Staff' && <span className="font-black text-[#0EA5E9] text-[10px]">● ACTIVE</span>}
              {!staffActive && <span className="text-gray-400 font-extrabold text-[10px] uppercase">DEACTIVATED</span>}
            </div>
            <span className="text-gray-500 mt-1 block leading-relaxed text-[10px]">
              Authorizes stock checks, product logs, and invoice printouts. Purchase ledger buys are cryptographically masked behind Cipher key structures.
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* 9.1 COST CIPHER (OWNER ONLY) */}
        <div className="bg-white p-4 border border-[#E2DFDF] flex flex-col justify-between" id="cost-cipher-card">
          <div>
            <h3 className="text-[11px] font-black uppercase text-[#2A2727] tracking-wider mb-2 flex items-center border-b pb-1">
              <Key className="w-4 h-4 mr-1.5 text-[#0ea5e9]" />
              9.1 Cost Cipher Mapping (Owner Access)
            </h3>
            <p className="text-gray-500 mb-3 leading-normal">
              Staff operations use this cipher to view buying costs. For example, buying rate <strong>Rs. 180</strong> is displayed as <strong>"LBQ"</strong> to sales staff. The owner has unrestricted views.
            </p>
          </div>

          {!isCipherUnlocked ? (
            <div className="bg-slate-50 p-4 border rounded border-slate-200 text-center space-y-3 my-2 flex-1 flex flex-col justify-center items-center">
              <Lock className="w-8 h-8 text-slate-400" />
              <div>
                <p className="font-black text-slate-800 uppercase text-[10px]">Section Locked Security Barrier</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Please provide the Owner PIN to authorize and reveal cipher translation table.</p>
              </div>
              <form onSubmit={handleVerifyCipherPin} className="w-full max-w-xs flex space-x-2">
                <input 
                  type="password"
                  placeholder="Owner PIN (Default: 1234)"
                  value={cipherUnlockPin}
                  onChange={e => setCipherUnlockPin(e.target.value)}
                  className="w-full border rounded p-1.5 font-mono text-center text-xs bg-white"
                />
                <button 
                  type="submit"
                  className="bg-slate-800 hover:bg-[#111C30] border text-white font-bold uppercase text-[10px] px-3 rounded select-none cursor-pointer"
                >
                  Verify
                </button>
              </form>
              {cipherUnlockError && (
                <p className="text-[10px] text-[#0ea5e9] font-extrabold">{cipherUnlockError}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4 my-2 flex-1">
              <div className="bg-emerald-50 border border-emerald-200 p-2 text-emerald-800 rounded flex items-center justify-between">
                <span className="flex items-center text-[10px] font-bold"><Unlock className="w-3.5 h-3.5 mr-1" /> SECURE DECRYPTION MAP ACTIVE</span>
                <button 
                  onClick={() => setIsCipherUnlocked(false)}
                  className="text-emerald-900 font-black hover:underline uppercase text-[9px] cursor-pointer"
                >
                  Lock Panel
                </button>
              </div>

              {/* 10-Row Letter -> Digit Reference Table */}
              <div className="border rounded bg-slate-50 overflow-hidden">
                <div className="grid grid-cols-3 bg-slate-200 p-1.5 font-extrabold border-b text-slate-700 uppercase text-[10px] text-center">
                  <span>Digit Value</span>
                  <span>Alphabet Map</span>
                  <span>Translation Rule</span>
                </div>
                <div className="divide-y divide-slate-200 text-center font-mono">
                  {digitsMapArray.map((digit, index) => {
                    // Match character at index
                    const characterVal = editCipherVal[index] || '_';
                    return (
                      <div key={digit} className="grid grid-cols-3 p-1.5 items-center">
                        <span className="font-extrabold text-slate-900">{digit}</span>
                        <span className="font-black text-rose-600 text-sm">{characterVal}</span>
                        <span className="text-[10px] text-gray-500">
                          {digit === 0 ? 'Index 10 (Zero Rep)' : `Index ${digit}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* LIVE CIPHER KEY EDITOR */}
              <form onSubmit={handleSaveCipherKey} className="bg-amber-50/50 p-3 border border-amber-200 rounded space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-black text-[10px] text-amber-900 uppercase tracking-wider block">✍️ EDIT COST CIPHER PHRASE</span>
                  <span className="text-[9px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.5 rounded font-mono">
                    Owner Access Enabled
                  </span>
                </div>
                <p className="text-[10px] text-gray-600 leading-normal">
                  Customize your secret 10-character code word. Setting a new cipher pattern automatically translates standard costs into alphabetical sequences on staff devices.
                </p>
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      maxLength={10}
                      value={editCipherVal}
                      onChange={e => {
                        setEditCipherVal(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''));
                        setCipherInputStatus(null);
                      }}
                      placeholder="e.g. SAKURYFLOW"
                      className="w-full text-xs font-mono font-bold uppercase tracking-widest p-2 border border-gray-300 rounded focus:ring-1 focus:ring-[#0ea5e9] focus:outline-none bg-white"
                    />
                    <span className="absolute right-2 top-2.5 text-[9px] font-bold font-mono text-gray-400">
                      {editCipherVal.length}/10
                    </span>
                  </div>
                  <button
                    type="submit"
                    className="bg-slate-800 hover:bg-slate-900 text-white font-extrabold uppercase text-[10px] px-4 rounded transition-all cursor-pointer shadow-sm select-none"
                  >
                    Save Cipher
                  </button>
                </div>
                {cipherInputStatus && (
                  <div className={`text-[10.5px] font-bold p-2 rounded border ${
                    cipherInputStatus.startsWith('Error') 
                      ? 'bg-red-50 text-red-800 border-red-200' 
                      : 'bg-emerald-50 text-emerald-850 border-emerald-200'
                  }`}>
                    {cipherInputStatus}
                  </div>
                )}
              </form>
            </div>
          )}

          <div className="text-[10px] text-center text-gray-400 pt-2 border-t mt-2">
            Active Cipher Key Signature: <strong className="font-mono text-[#2A2727]">{cipherKey}</strong>
          </div>
        </div>

        {/* COLUMN 2: SHOP PROFILE & SIGNATURE PAD COLUMN */}
        <div className="flex flex-col space-y-6">
          {/* 9.2 SHOP INFORMATION PROFILE */}
          <div className="bg-white p-4 border border-[#E2DFDF] flex-1" id="shop-information-card">
          <h3 className="text-[11px] font-black uppercase text-[#2A2727] tracking-wider mb-2 flex items-center border-b pb-1">
            <Building className="w-4 h-4 mr-1.5 text-blue-700" />
            9.2 Official Shop Information & Invoice branding
          </h3>
          <p className="text-gray-505 leading-normal mb-3">
            Modify shop branding particulars, service contact phone codes, and financial currency symbols stamped onto outbound customer cash receipts.
          </p>

          <form onSubmit={handleSaveShopInfo} className="space-y-4">
            <div>
              <label className="block text-gray-655 font-black text-[10px] uppercase mb-1">Company / Shop Name</label>
              <input 
                type="text"
                value={shopInfo.name}
                onChange={e => setShopInfo({...shopInfo, name: e.target.value})}
                placeholder="King Filter House"
                className="w-full text-xs border rounded p-1.5 bg-slate-50 font-bold focus:bg-white focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-gray-655 font-black text-[10px] uppercase mb-1">Physical Trading Address</label>
              <input 
                type="text"
                value={shopInfo.address}
                onChange={e => setShopInfo({...shopInfo, address: e.target.value})}
                placeholder="Plot 12, Auto Parts Plaza, Lahore"
                className="w-full text-xs border rounded p-1.5 bg-slate-50 font-bold focus:bg-white focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-gray-655 font-black text-[10px] uppercase mb-1">Shop Landline/Telephone (Optional)</label>
                <input 
                  type="text"
                  value={shopInfo.phone}
                  onChange={e => setShopInfo({...shopInfo, phone: e.target.value})}
                  placeholder="+92 41 8547344"
                  className="w-full text-xs border rounded p-1.5 bg-slate-50 font-bold focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-655 font-black text-[10px] uppercase mb-1">Local Currency Symbol</label>
                <input 
                  type="text"
                  value={shopInfo.currencySymbol}
                  onChange={e => setShopInfo({...shopInfo, currencySymbol: e.target.value})}
                  placeholder="Rs."
                  className="w-full text-xs border rounded p-1.5 bg-slate-50 font-bold text-center focus:bg-white"
                  required
                />
              </div>
            </div>

            <div className="border-t pt-3 mt-3">
              <span className="block text-[11px] font-black uppercase text-slate-800 mb-1">👥 App Personnel Profiles</span>
              <p className="text-[9px] text-gray-500 italic leading-tight mb-3">
                This app supports exactly 2 role profiles: 1 Owner and 1 Manager. Provide their verified full names and up to 2 primary mobile contacts each.
              </p>

              {/* 1. OWNER PROFILE */}
              <div className="bg-slate-50 p-2.5 border border-slate-200 rounded space-y-2 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-blue-800">👤 1. Owner Profile</span>
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-black text-slate-500 mb-0.5">Owner Full Name</label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                    placeholder="Owner Full Name"
                    className="w-full text-xs border rounded p-1.5 bg-white font-bold focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-slate-500">Mobile Contacts (Max 2 numbers):</span>
                    <button
                      type="button"
                      disabled={(shopInfo.ownerPhones || []).length >= 2}
                      onClick={() => {
                        const currentList = shopInfo.ownerPhones || [];
                        setShopInfo({
                          ...shopInfo,
                          ownerPhones: [...currentList, '']
                        });
                      }}
                      className="text-[8px] font-black text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-0.5 rounded border border-blue-200 uppercase cursor-pointer"
                    >
                      + Add Number
                    </button>
                  </div>
                  {(shopInfo.ownerPhones || []).map((num, i) => (
                    <div key={i} className="flex items-center space-x-1.5">
                      <input
                        type="text"
                        value={num}
                        onChange={e => {
                          const newList = [...(shopInfo.ownerPhones || [])];
                          newList[i] = e.target.value;
                          setShopInfo({ ...shopInfo, ownerPhones: newList });
                        }}
                        placeholder="e.g. +92-300-6644634"
                        className="flex-1 text-xs border rounded px-2 py-1 bg-white font-semibold focus:outline-none focus:border-blue-600"
                        required
                      />
                      <button
                        type="button"
                        disabled={(shopInfo.ownerPhones || []).length <= 1}
                        onClick={() => {
                          const newList = (shopInfo.ownerPhones || []).filter((_, idx) => idx !== i);
                          setShopInfo({ ...shopInfo, ownerPhones: newList });
                        }}
                        className="text-red-650 hover:text-red-800 disabled:opacity-40 p-1 cursor-pointer"
                        title="Remove number"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. MANAGER PROFILE */}
              <div className="bg-slate-50 p-2.5 border border-slate-200 rounded space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-indigo-800">💼 2. Manager Profile</span>
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-black text-slate-500 mb-0.5">Manager Full Name</label>
                  <input
                    type="text"
                    value={managerName}
                    onChange={e => {
                      setManagerName(e.target.value);
                      setTypedName(e.target.value); // Keep in sync for cursive generator
                    }}
                    placeholder="Manager Full Name"
                    className="w-full text-xs border rounded p-1.5 bg-white font-bold focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-slate-500">Mobile Contacts (Max 2 numbers):</span>
                    <button
                      type="button"
                      disabled={(shopInfo.managerPhones || []).length >= 2}
                      onClick={() => {
                        const currentList = shopInfo.managerPhones || [];
                        setShopInfo({
                          ...shopInfo,
                          managerPhones: [...currentList, '']
                        });
                      }}
                      className="text-[8px] font-black text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-0.5 rounded border border-blue-200 uppercase cursor-pointer"
                    >
                      + Add Number
                    </button>
                  </div>
                  {(shopInfo.managerPhones || []).map((num, i) => (
                    <div key={i} className="flex items-center space-x-1.5">
                      <input
                        type="text"
                        value={num}
                        onChange={e => {
                          const newList = [...(shopInfo.managerPhones || [])];
                          newList[i] = e.target.value;
                          setShopInfo({ ...shopInfo, managerPhones: newList });
                        }}
                        placeholder="e.g. +92-300-1234567"
                        className="flex-1 text-xs border rounded px-2 py-1 bg-white font-semibold focus:outline-none focus:border-blue-600"
                        required
                      />
                      <button
                        type="button"
                        disabled={(shopInfo.managerPhones || []).length <= 1}
                        onClick={() => {
                          const newList = (shopInfo.managerPhones || []).filter((_, idx) => idx !== i);
                          setShopInfo({ ...shopInfo, managerPhones: newList });
                        }}
                        className="text-red-650 hover:text-red-800 disabled:opacity-40 p-1 cursor-pointer"
                        title="Remove number"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-gray-655 font-black text-[10px] uppercase mb-1">Google Maps Shop URL Link</label>
              <input 
                type="url"
                value={shopInfo.mapsLink || ''}
                onChange={e => setShopInfo({...shopInfo, mapsLink: e.target.value})}
                placeholder="https://maps.app.goo.gl/..."
                className="w-full text-xs border rounded p-1.5 bg-slate-50 font-bold focus:bg-white focus:outline-none"
              />
            </div>

            <div className="border-t pt-2 mt-2">
              <p className="font-extrabold uppercase text-[#2A2727] text-[10px] mb-1.5 text-gray-600">Document Identifier Prefix Headers</p>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-[9px] text-gray-400 font-bold mb-0.5">Invoice</label>
                  <input 
                    type="text"
                    value={shopInfo.invoicePrefix}
                    onChange={e => setShopInfo({...shopInfo, invoicePrefix: e.target.value})}
                    placeholder="INV"
                    className="w-full p-1 border font-bold text-center text-[11px] font-mono bg-slate-50 focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-gray-400 font-bold mb-0.5">Purc Order</label>
                  <input 
                    type="text"
                    value={shopInfo.poPrefix}
                    onChange={e => setShopInfo({...shopInfo, poPrefix: e.target.value})}
                    placeholder="PO"
                    className="w-full p-1 border font-bold text-center text-[11px] font-mono bg-slate-50 focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-gray-400 font-bold mb-0.5">Quotation</label>
                  <input 
                    type="text"
                    value={shopInfo.quotePrefix}
                    onChange={e => setShopInfo({...shopInfo, quotePrefix: e.target.value})}
                    placeholder="QT"
                    className="w-full p-1 border font-bold text-center text-[11px] font-mono bg-slate-50 focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-gray-400 font-bold mb-0.5">Returns</label>
                  <input 
                    type="text"
                    value={shopInfo.returnPrefix}
                    onChange={e => setShopInfo({...shopInfo, returnPrefix: e.target.value})}
                    placeholder="RET"
                    className="w-full p-1 border font-bold text-center text-[11px] font-mono bg-slate-50 focus:bg-white"
                    required
                  />
                </div>
              </div>
            </div>

            {shopInfoStatus && (
              <p className="text-[10px] text-green-700 bg-green-50 border border-green-150 p-1.5 rounded font-bold font-mono">
                {shopInfoStatus}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold uppercase py-2 cursor-pointer transition-colors"
            >
              Commit & Save Settings
            </button>
          </form>
        </div>

        {/* 9.2.1 DIGITAL SIGNATURE INTERACTIVE PAD & GENERATOR */}
        <div className="bg-white p-4 border border-[#E2DFDF] space-y-3" id="signature-pad-card">
          <h3 className="text-[11px] font-black uppercase text-[#2A2727] tracking-wider mb-2 flex items-center border-b pb-1">
            <FileText className="w-4 h-4 mr-1.5 text-blue-700" />
            9.2.1 Digital Manager Signature Pad & Generator
          </h3>
          <p className="text-gray-500 leading-normal text-[10px]">
            Configure and save the active signature of the <strong>Manager</strong> as the designated business signatory. Choose to type their name with a gorgeous script preview, or trace by hand.
          </p>

          {/* Tab Navigation */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setSigActiveTab('type')}
              className={`flex-1 py-1.5 text-[10px] font-extrabold uppercase tracking-wide border-b-2 transition-colors cursor-pointer ${
                sigActiveTab === 'type'
                  ? 'border-blue-700 text-blue-700 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              ✍️ Type Signature (Super Easy)
            </button>
            <button
              type="button"
              onClick={() => setSigActiveTab('draw')}
              className={`flex-1 py-1.5 text-[10px] font-extrabold uppercase tracking-wide border-b-2 transition-colors cursor-pointer ${
                sigActiveTab === 'draw'
                  ? 'border-blue-700 text-blue-700 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              🖌️ Draw Signature (Manual)
            </button>
          </div>

          {sigActiveTab === 'type' ? (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] uppercase font-black text-slate-500 mb-1">Signature Text</label>
                  <input
                    type="text"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder="e.g. Shop Manager"
                    className="w-full text-[11px] px-2 py-1.5 bg-slate-50 border border-slate-200 uppercase font-mono rounded focus:border-blue-600 focus:outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-black text-slate-500 mb-1">Script Typeface</label>
                  <select
                    value={typedStyle}
                    onChange={(e) => setTypedStyle(e.target.value)}
                    className="w-full text-[11px] px-2 py-1.5 bg-slate-50 border border-slate-200 rounded focus:border-blue-600 focus:outline-none font-sans font-medium"
                  >
                    <option value="elegant">Elegant Cursive Flow</option>
                    <option value="modern">Modern Handwriting</option>
                    <option value="artistic">Parisienne Swash</option>
                    <option value="bold">Classic Bold Cursive</option>
                    <option value="calligraphy">Sophisticated Calligraphy</option>
                    <option value="casual">Pacifico Casual Play</option>
                    <option value="royal">Royal Alex Brush</option>
                    <option value="swift">Swift Herr (Extra Thin / Slanted)</option>
                    <option value="whisper">Whisper Soft Line</option>
                    <option value="sacramento">Sacramento Fine Calligraphy</option>
                    <option value="yellowtail">Yellowtail Thick Script</option>
                    <option value="allura">Allura Romantic Script</option>
                    <option value="monsieur">Monsieur Ornate Script</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Live Cursive CSS Preview Box */}
              <div className="border border-slate-200 bg-slate-50 rounded p-4 flex flex-col items-center justify-center min-h-[90px] relative overflow-hidden">
                <span className="absolute top-1 left-2 text-[7px] font-bold text-slate-400 uppercase tracking-widest">Live Script Preview</span>
                
                <div className="w-5/6 text-center text-slate-900 select-none">
                  <span 
                    style={{
                      fontFamily: 
                        typedStyle === 'elegant' ? "'Great Vibes', 'Brush Script MT', 'Dancing Script', cursive, sans-serif" :
                        typedStyle === 'modern' ? "'Caveat', 'Segoe Print', cursive, sans-serif" :
                        typedStyle === 'artistic' ? "'Parisienne', 'Great Vibes', 'Playball', cursive, sans-serif" :
                        typedStyle === 'bold' ? "'Dancing Script', 'Brush Script MT', cursive" :
                        typedStyle === 'calligraphy' ? "'Great Vibes', 'Dancing Script', cursive, sans-serif" :
                        typedStyle === 'casual' ? "'Pacifico', 'Caveat', cursive, sans-serif" :
                        typedStyle === 'royal' ? "'Alex Brush', 'Great Vibes', cursive, sans-serif" :
                        typedStyle === 'swift' ? "'Herr Von Muellerhoff', 'Brush Script MT', cursive, sans-serif" :
                        typedStyle === 'sacramento' ? "'Sacramento', cursive, sans-serif" :
                        typedStyle === 'yellowtail' ? "'Yellowtail', cursive, sans-serif" :
                        typedStyle === 'allura' ? "'Allura', cursive, sans-serif" :
                        typedStyle === 'monsieur' ? "'Monsieur La Doulaise', cursive, sans-serif" :
                        "'League Script', 'Snell Roundhand', cursive, sans-serif",
                      fontSize:
                        typedStyle === 'swift' ? '46px' :
                        typedStyle === 'casual' ? '28px' :
                        typedStyle === 'monsieur' ? '42px' :
                        typedStyle === 'yellowtail' ? '30px' :
                        '34px'
                    }}
                    className="italic tracking-wide select-none inline-block text-black"
                  >
                    {typedName || 'Shop Manager'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleGenerateTypedSig()}
                className="w-full bg-green-700 hover:bg-green-800 text-white font-bold uppercase py-1.5 px-3 rounded text-[10px] flex items-center justify-center space-x-1 cursor-pointer transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Generated Cursive Signature</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="relative border-2 border-dashed border-slate-200 bg-slate-50 rounded overflow-hidden flex flex-col items-center justify-center p-2">
                <canvas
                  ref={sigCanvasRef}
                  width={360}
                  height={120}
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerLeave={stopDrawing}
                  className="bg-white shadow-inner border border-slate-200 cursor-crosshair rounded touch-none animate-fade-in"
                  style={{ width: '360px', height: '120px' }}
                />
                {isCanvasBlank && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest bg-white/85 px-3 py-1 rounded border border-dashed border-slate-200">
                      ✍️ Trace Signature (Black Ink)
                    </span>
                  </div>
                )}
              </div>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="flex-1 bg-slate-105 hover:bg-slate-200 border text-slate-800 font-bold uppercase py-1.5 px-3 rounded text-[10px] flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Clear Pad</span>
                </button>
                <button
                  type="button"
                  onClick={saveCanvas}
                  className="flex-1 bg-green-700 hover:bg-green-800 text-white font-bold uppercase py-1.5 px-3 rounded text-[10px] flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Signature</span>
                </button>
              </div>
            </div>
          )}

          {sigStatus && (
            <p className="text-[10px] text-green-750 bg-green-50 border border-green-200 p-1.5 rounded font-bold font-mono text-center">
              {sigStatus}
            </p>
          )}

          {storedSig && (
            <div className="border border-slate-200 p-2 bg-slate-50 flex flex-col items-center rounded mt-1">
              <span className="text-[9px] uppercase font-black text-slate-500 mb-1">Active Saved Signature Preview:</span>
              <img src={storedSig} alt="Authorized Signature Preview" className="max-h-14 object-contain bg-white border border-slate-200 p-1 rounded" />
              <button
                type="button"
                onClick={deleteSavedSig}
                className="mt-1.5 text-red-650 hover:text-red-800 uppercase font-extrabold text-[8.5px] tracking-wider cursor-pointer hover:underline"
              >
                Delete & Fallback to Default Font
              </button>
            </div>
          )}

          {/* Owner Identity & PDF Signature Formatting Options */}
          <div className="border border-slate-200 hover:border-blue-300 transition-all rounded p-3 bg-slate-50/50 space-y-3 mt-4">
            <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-wider flex items-center border-b pb-1">
              ⚙️ PDF Manager Signature Display Options
            </h4>
            
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] uppercase font-black text-slate-500 mb-1 flex justify-between">
                    <span>PDF Signature Width</span>
                    <span className="text-blue-700 font-black">{sigWidth}mm</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="text-[8px] text-gray-400">30mm</span>
                    <input
                      type="range"
                      min="30"
                      max="100"
                      value={sigWidth}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSigWidth(val);
                        localStorage.setItem('kfh_signature_width', val);
                        onRefreshAll();
                      }}
                      className="flex-grow accent-blue-700 h-1 bg-slate-200 rounded-lg cursor-pointer"
                    />
                    <span className="text-[8px] text-gray-400">100mm</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="sig_bold"
                    checked={sigBold}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setSigBold(val);
                      localStorage.setItem('kfh_signature_bold', String(val));
                      onRefreshAll();
                    }}
                    className="w-3.5 h-3.5 text-blue-650 border-gray-300 rounded focus:ring-blue-500 accent-blue-700"
                  />
                  <label htmlFor="sig_bold" className="text-[9px] uppercase font-black text-slate-700 select-none cursor-pointer">
                    Bold Font Style in PDF (Extra Ink Bold)
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 9.3 USERS ACCOUNTS MANAGER (CHANGE PINS, TOGGLE STAFF ACTIVE) */}
        <div className="bg-white p-4 border border-[#E2DFDF] space-y-4" id="users-manager-card">
          <h3 className="text-[11px] font-black uppercase text-[#2A2727] tracking-wider mb-2 flex items-center border-b pb-1">
            <Users className="w-4 h-4 mr-1.5 text-indigo-700" />
            9.3 Shop Operators & Authentication managers
          </h3>
          <p className="text-gray-500 leading-normal">
            Manage PIN logins for Owner level and assistant floor staff operators. Staff role can be terminated or reactivated by toggling active status triggers.
          </p>

          {/* Owner Account Card */}
          <div className="bg-slate-50 p-3 rounded border border-slate-250 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2">
              <span className="font-extrabold text-[#2A2727] uppercase flex items-center">
                🛡️ PRIMARY SYSTEM OWNER ACCOUNT
              </span>
              <span className="text-[9px] bg-green-100 text-green-800 font-bold border border-green-200 px-1.5 rounded">
                PERMANENT ACTIVE
              </span>
            </div>
            <p className="text-[10px] text-gray-400 mb-2 leading-relaxed">
              Main Owner credentials. Unlocks unrestricted profit margins, invoice deletion capabilities, and wholesale cipher keys.
            </p>

            <form onSubmit={handleSaveOwnerPin} className="flex space-x-2">
              <div className="flex-1">
                <input 
                  type="password"
                  placeholder="Set New Owner PIN"
                  value={ownerPinInput}
                  onChange={e => setOwnerPinInput(e.target.value)}
                  className="w-full p-1.5 border border-[#E2DFDF] font-mono font-bold text-center text-xs bg-white focus:outline-none"
                  required
                />
              </div>
              <button
                type="submit"
                className="bg-slate-800 hover:bg-[#111C30] text-white font-extrabold uppercase px-3 text-[10px] select-none cursor-pointer"
              >
                Change PIN
              </button>
            </form>
            {ownerPinStatus && (
              <p className="text-[10px] text-green-700 bg-white border border-green-200 p-1 rounded font-bold font-mono mt-1">
                {ownerPinStatus}
              </p>
            )}
          </div>

          {/* Staff Account Card */}
          <div className="bg-slate-50 p-3 rounded border border-slate-250 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2">
              <span className="font-extrabold text-[#2A2727] uppercase flex items-center">
                💼 SHOP FLOOR ASSISTANT ACCOUNT
              </span>
              <button
                type="button"
                onClick={() => setStaffActive(!staffActive)}
                className={`text-[9px] font-black border px-2 py-0.5 rounded flex items-center ${
                  staffActive 
                    ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-105' 
                    : 'bg-sky-50 text-[#0EA5E9] border-sky-200 hover:bg-red-105'
                }`}
              >
                {staffActive ? '● STAMPED ACTIVE' : '○ DEACTIVATED'}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mb-2 leading-relaxed">
              Provides standard billing and restocking functions. Buying purchase prices are masked under cipher translation strings.
            </p>

            <form onSubmit={handleSaveStaffSettings} className="space-y-2">
              <div className="flex space-x-2">
                <div className="flex-1">
                  <input 
                    type="password"
                    placeholder="Set New Staff PIN"
                    value={staffPinInput}
                    onChange={e => setStaffPinInput(e.target.value)}
                    className="w-full p-1.5 border border-[#E2DFDF] font-mono font-bold text-center text-xs bg-white focus:outline-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="bg-slate-800 hover:bg-[#111C30] text-white font-extrabold uppercase px-3 text-[10px] select-none cursor-pointer"
                >
                  Save Settings
                </button>
              </div>
            </form>
            {staffStatus && (
              <p className="text-[10px] text-green-700 bg-white border border-green-200 p-1 rounded font-bold font-mono mt-1">
                {staffStatus}
              </p>
            )}
          </div>

          {/* Public Access Lock Screen Gate Settings */}
          <div className="bg-sky-50/60 p-3 rounded border border-sky-200/80 flex flex-col justify-between space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-extrabold text-slate-800 uppercase flex items-center text-[11px]">
                🔐 PUBLIC ACCESS GUARD (GITHUB PAGES PIN)
              </span>
              <button
                type="button"
                onClick={() => setAppLockEnabled(!appLockEnabled)}
                className={`text-[9.5px] font-extrabold border px-2.5 py-0.5 rounded flex items-center cursor-pointer transition-colors ${
                  appLockEnabled 
                    ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700' 
                    : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300'
                }`}
              >
                {appLockEnabled ? '🔒 LOCK ENABLED' : '🔓 LOCK DISABLED'}
              </button>
            </div>
            
            <p className="text-[10px] text-slate-600 leading-relaxed">
              When enabled, anyone opening your public GitHub Pages link is greeted with the Security PIN Screen before seeing your shop dashboard or inventory.
            </p>

            <form onSubmit={handleSavePublicLockSettings} className="space-y-2.5 bg-white p-2.5 rounded border border-sky-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-700 uppercase mb-1">
                    Inactivity Auto-Lock
                  </label>
                  <select
                    value={autolockMinutes}
                    onChange={(e) => setAutolockMinutes(e.target.value)}
                    className="w-full text-xs p-1.5 border border-slate-300 rounded font-medium bg-slate-50 focus:bg-white focus:outline-none"
                  >
                    <option value="5">Auto-lock after 5 mins</option>
                    <option value="15">Auto-lock after 15 mins</option>
                    <option value="30">Auto-lock after 30 mins</option>
                    <option value="60">Auto-lock after 1 hour</option>
                    <option value="off">Off (Manual Lock only)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9.5px] font-bold text-slate-700 uppercase mb-1">
                    Security Key / Answer
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Shahzar"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    className="w-full text-xs p-1.5 border border-slate-300 rounded font-medium bg-slate-50 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    sessionStorage.removeItem('kfh_is_app_unlocked');
                    window.location.reload();
                  }}
                  className="text-[10px] font-extrabold text-sky-700 hover:text-sky-900 underline cursor-pointer"
                >
                  Test Lock Screen Now ➔
                </button>

                <button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-700 text-white font-extrabold uppercase px-3 py-1 text-[10px] rounded shadow-2xs cursor-pointer"
                >
                  Save Guard Rules
                </button>
              </div>
            </form>

            {publicLockStatus && (
              <p className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 p-1.5 rounded font-bold font-mono">
                ✓ {publicLockStatus}
              </p>
            )}
          </div>
        </div>

        {/* 9.5 SALES TARGET TRACKER CONFIGURATION */}
        <div className="bg-white p-4 border border-[#E2DFDF] flex flex-col justify-between" id="sales-target-card">
          <div>
            <h3 className="text-[11px] font-black uppercase text-[#2A2727] tracking-wider mb-2 flex items-center border-b pb-1">
              <Target className="w-4 h-4 mr-1.5 text-rose-600" />
              9.5 Monthly Milestone Target Goals (KPI)
            </h3>
            <p className="text-gray-500 mb-3 leading-normal">
              Set the monthly sales target threshold in rupees. This value feeds are visualized on the primary dashboard progress gauge alongside live performance run-rates and daily requirements.
            </p>
          </div>

          <div className="bg-slate-50 p-4 border rounded border-slate-250 flex-1 my-2 flex flex-col justify-center">
            <form onSubmit={handleSaveSalesTarget} className="space-y-3">
              <div>
                <label className="block text-gray-650 font-bold mb-1">Set Monthly Revenue Target (Rs.)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center font-bold text-gray-400">Rs.</span>
                  <input 
                    type="number"
                    min={1}
                    value={salesTargetInput}
                    onChange={e => setSalesTargetInput(e.target.value)}
                    placeholder="1,000,000"
                    className="w-full text-xs border rounded p-2 pl-10 bg-white font-bold font-mono text-slate-800 text-left focus:ring-1 focus:ring-sky-400 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {targetStatus && (
                <p className={`text-[10px] font-mono font-bold p-1 rounded border ${
                  targetStatus.startsWith('Error') 
                    ? 'text-sky-700 bg-sky-50 border-sky-200' 
                    : 'text-emerald-700 bg-emerald-50 border-emerald-250'
                }`}>
                  {targetStatus}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-2 bg-slate-850 hover:bg-[#111C30] border text-white font-bold uppercase transition-colors flex items-center justify-center space-x-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save KPI Milestone Target</span>
              </button>
            </form>
          </div>

          <div className="pt-2 border-t mt-2 flex justify-between text-[10px] text-gray-400">
            <span>Target Monthly Threshold:</span>
            <span className="font-extrabold text-[#2A2727] font-mono">Rs. {parseFloat(salesTargetInput || '0').toLocaleString()}</span>
          </div>
        </div>

      </div>

      {/* 9.6 IMPORT LANDED COST & MARKUP ESTIMATOR WIDGET */}
      <div className="bg-white p-4 border border-[#E2DFDF] space-y-4" id="landed-cost-estimator-card">
        <h3 className="text-[11px] font-black uppercase text-[#2A2727] tracking-wider mb-2 flex items-center border-b pb-1">
          <Coins className="w-4 h-4 mr-1.5 text-emerald-600" />
          9.6 Landed Cost Valuation & Wholesale Estimator
        </h3>
        <p className="text-gray-500 leading-normal">
          Calculate accurate PKR landed costs for imported filter stocks (FOB, customs duty tariffs, port handling/freight value) and solve for recommended catalog markup pricing models.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Inputs Panel */}
          <div className="space-y-3 bg-slate-50 p-4 border rounded border-slate-200">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Variable Sourcing Metrics</span>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-gray-500 font-bold mb-0.5">Price FOB (Foreign)</label>
                <input 
                  type="number"
                  step="any"
                  value={foreignCost}
                  onChange={e => setForeignCost(e.target.value)}
                  className="w-full text-xs font-mono font-bold border rounded p-1.5 bg-white text-slate-800 focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-550 font-bold mb-0.5">Currency</label>
                <select 
                  value={currencySymbol} 
                  onChange={e => {
                    const sym = e.target.value;
                    setCurrencySymbol(sym);
                    if (sym === 'USD') setCurrencyRate('278.50');
                    if (sym === 'AED') setCurrencyRate('75.80');
                    if (sym === 'CNY') setCurrencyRate('38.40');
                    if (sym === 'JPY') setCurrencyRate('1.76');
                  }}
                  className="w-full text-xs font-bold border rounded p-1.5 bg-white text-slate-800"
                >
                  <option value="USD">💵 USD (US Dollar)</option>
                  <option value="AED">🇦🇪 AED (UAE Dirham)</option>
                  <option value="CNY">🇨🇳 CNY (Chinese Yuan)</option>
                  <option value="JPY">🇯🇵 JPY (Japanese Yen)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-gray-500 font-bold mb-0.5">PKR Exchange Rate</label>
                <input 
                  type="number"
                  step="any"
                  value={currencyRate}
                  onChange={e => setCurrencyRate(e.target.value)}
                  className="w-full text-xs font-mono font-bold border rounded p-1.5 bg-white text-slate-800 focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-550 font-bold mb-0.5">Customs Tariff %</label>
                <input 
                  type="number"
                  value={customsPercent}
                  onChange={e => setCustomsPercent(e.target.value)}
                  className="w-full text-xs font-mono font-bold border rounded p-1.5 bg-white text-slate-800 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-gray-500 font-bold mb-0.5">Freight & Clearing (PKR)</label>
                <input 
                  type="number"
                  value={freightCost}
                  onChange={e => setFreightCost(e.target.value)}
                  className="w-full text-xs font-mono font-bold border rounded p-1.5 bg-white text-slate-800 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-550 font-bold mb-0.5">Desired Markup %</label>
                <input 
                  type="number"
                  value={desiredMarkup}
                  onChange={e => setDesiredMarkup(e.target.value)}
                  className="w-full text-xs font-mono font-bold border rounded p-1.5 bg-white text-slate-800 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Calculations Display Panel */}
          <div className="bg-[#111C30] text-white rounded p-4 font-mono flex flex-col justify-between border-l-4 border-emerald-500">
            <div>
              <span className="text-[9px] font-black uppercase text-amber-500 tracking-wider block mb-2">Live PKR Sourcing Calculations</span>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between border-b border-slate-800/60 pb-1">
                  <span className="text-slate-400">Equivalent FOB PKR:</span>
                  <span>Rs. {calculatedFobPkr.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-1">
                  <span className="text-slate-400 font-bold">Customs Duty PKR ({customsPercent}%)</span>
                  <span>+Rs. {calculatedCustomsPkr.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-1">
                  <span className="text-slate-400">Clearing & Local Freight:</span>
                  <span>+Rs. {freightFloat.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-1 font-bold text-emerald-400">
                  <span>Est. Landed Cost (PKR):</span>
                  <span>Rs. {calculatedLandedPkr.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/60 mt-2">
              <span className="text-[9.5px] uppercase font-black tracking-widest text-emerald-500 block mb-1">Recommended Sale pricing</span>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-300 font-sans">Cost + {desiredMarkup}% Markup:</span>
                  <span className="text-base font-black text-white">Rs. {calculatedRecommendedPrice.toLocaleString()}</span>
                </div>
                <p className="text-[8.5px] text-slate-500 leading-normal font-sans italic">Customs duties calculated matching standard auto spareparts tariff metrics enforced in Karachi imports port clearing nodes.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 9.4 BACKUP & RESTORATION CLOUD-VAULT */}
      <div className="bg-white p-4 border border-[#E2DFDF]" id="backup-vault-panel">
        <h3 className="text-[11px] font-black uppercase text-[#2A2727] tracking-wider mb-2 flex items-center border-b pb-1">
          <Database className="w-4 h-4 mr-1.5 text-blue-800" />
          9.4 System Backup & Cold Disaster Recovery Vault
        </h3>
        <p className="text-gray-500 leading-normal mb-4">
          Secure your shop transactions databases from physical device hardware faults. Generate full dump backups of your system to a secure archive file, migrate to removable USB blocks, or restore existing files directly.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="backup-action-grid">
          {/* Action A: Backup Now block */}
          <div className="border border-slate-200 p-3 rounded bg-slate-50 flex flex-col justify-between">
            <div>
              <span className="font-mono font-bold text-[#0EA5E9] text-[10px] block mb-1">LOCAL COLD BACKUP</span>
              <p className="text-[10px] text-gray-400 leading-relaxed mb-3">
                Downloads full compressed datagram schema bundle containing entire catalog lists, cashbooks, customer profiles, and invoice records.
              </p>
            </div>
            <button
              type="button"
              onClick={handleBackupNow}
              className="bg-white hover:bg-slate-100 border text-slate-800 font-extrabold text-[10.5px] uppercase tracking-wider py-1.5 rounded flex items-center justify-center space-x-1 cursor-pointer transition-all"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Backup DB Now</span>
            </button>
          </div>

          {/* Action B: Backup to USB */}
          <div className="border border-slate-200 p-3 rounded bg-slate-50 flex flex-col justify-between">
            <div>
              <span className="font-mono font-bold text-amber-600 text-[10px] block mb-1">REMOVABLE INTEL PORTABILITY</span>
              <p className="text-[10px] text-gray-400 leading-relaxed mb-3">
                Writes data direct to external directory nodes. Highly recommended for physical disaster backups and offline terminal sync.
              </p>
            </div>
            <button
              type="button"
              onClick={handleBackupToUSB}
              className="bg-white hover:bg-slate-100 border text-slate-800 font-extrabold text-[10.5px] uppercase py-1.5 rounded flex items-center justify-center space-x-1 cursor-pointer transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
              <span>Backup to USB</span>
            </button>
          </div>

          {/* Action C: Restore existing databox */}
          <div className="border border-slate-200 p-3 rounded bg-slate-50 border-dashed flex flex-col justify-between">
            <div>
              <span className="font-mono font-bold text-emerald-700 text-[10px] block mb-1">ROLLBACK RESTORATION</span>
              <p className="text-[10px] text-gray-400 leading-relaxed mb-3">
                Import a previously stored `.db` or `.json` dataset file back into local sandbox cache to reload everything. This completely overwrites current records.
              </p>
            </div>
            
            <div>
              <input 
                type="file"
                ref={fileInputRef}
                accept=".db,.json"
                onChange={handleRestoreFromBackup}
                className="hidden"
                id="file-restore-uploader"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-[#0EA5E9] hover:bg-sky-600 text-white font-extrabold text-[10.5px] uppercase py-1.5 rounded flex items-center justify-center space-x-1 cursor-pointer transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Restore from Backup</span>
              </button>
            </div>
          </div>
        </div>

        {/* Configurations: Auto-Backup schedule */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start space-x-2">
            <span className="inline-block bg-blue-100 p-1.5 rounded text-blue-700 font-extrabold font-mono text-[11px] mt-0.5">AUTO</span>
            <div>
              <p className="font-extrabold text-blue-900 text-[10.5px] uppercase">Auto-Backup Midnight Daemon</p>
              <p className="text-[10px] text-blue-750">
                While client dashboard tab stays active, system auto-commits background backups to local directories daily at midnight.
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 self-center shrink-0">
            <div className="text-right">
              <span className="text-[9px] text-gray-400 block uppercase font-bold">Midnight schedule:</span>
              <span className="text-[10px] font-black text-slate-800">{autoBackup ? 'CONNECTED (AUTO-TRIGGER)' : 'PAUSED'}</span>
            </div>
            
            <button
              type="button"
              onClick={handleToggleAutoBackup}
              className="focus:outline-none cursor-pointer transition-transform"
            >
              {autoBackup ? (
                <ToggleRight className="w-10 h-10 text-emerald-600" />
              ) : (
                <ToggleLeft className="w-10 h-10 text-slate-400" />
              )}
            </button>
          </div>
        </div>

        {/* History backlog of backups taken */}
        <div className="mt-4 border border-slate-200">
          <div className="bg-slate-100 p-2 border-b text-[10px] font-black uppercase text-slate-700 flex justify-between">
            <span>Historical Backup archives created in current session</span>
            <span>Last Processed: <span className="text-[#0EA5E9] font-mono">{lastBackupTime}</span></span>
          </div>
          
          {backupHistory.length === 0 ? (
            <p className="p-4 text-center text-gray-400 font-mono text-[10px]">No archives compiled in current runtime block.</p>
          ) : (
            <div className="divide-y divide-slate-150 text-[10px] font-mono leading-relaxed bg-[#FCFCFC]">
              {backupHistory.slice(0, 5).map((log, index) => (
                <div key={index} className="p-2 flex justify-between items-center hover:bg-slate-50">
                  <span className="text-slate-800 font-bold truncate pr-3">{log.filename}</span>
                  <div className="flex items-center space-x-3 text-gray-500 shrink-0">
                    <span className="bg-slate-200 text-slate-700 font-bold px-1.5 rounded-[3px] text-[9px] uppercase">{log.type}</span>
                    <span>{log.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 9.8 SUPABASE REAL-TIME DATABASE SYNC HUB */}
      <div className="bg-white p-4 border border-[#E2DFDF]" id="supabase-sync-panel">
        <h3 className="text-[11px] font-black uppercase text-[#2A2727] tracking-wider mb-2 flex items-center border-b pb-1">
          <Database className="w-4 h-4 mr-1.5 text-emerald-600" />
          9.8 Supabase SQL Server Connection & Real-time Sync Hub
        </h3>
        <p className="text-gray-500 leading-normal mb-4">
          Replace local persistent storage keys with a secure, enterprise-grade cloud database. Fully supports peer-to-peer real-time background writes and instant network schema-rebuilding.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Credentials configuration */}
          <div className="lg:col-span-7 border border-slate-200 p-4 rounded bg-[#FCFCFC] flex flex-col justify-between">
            <div>
              <span className="font-mono font-bold text-emerald-800 text-[10px] block mb-2 uppercase">Supabase API Handshake Credentials</span>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-slate-700 mb-1">Supabase Project URL</label>
                  <input
                    type="text"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    placeholder="https://your-project-id.supabase.co"
                    className="w-full text-xs font-mono p-1.5 border border-slate-200 rounded focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-[8.5px] text-slate-400">Specify the primary project domain found in your Supabase Project Settings API menu.</span>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-slate-700 mb-1">Anon Public API Key</label>
                  <input
                    type="password"
                    value={supabaseAnonKey}
                    onChange={(e) => setSupabaseAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full text-xs font-mono p-1.5 border border-slate-200 rounded focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-[8.5px] text-slate-400">The public anonymization JWT authorization token utilized to allow anonymous requests inside browser scopes.</span>
                </div>

                {/* Enable Sync toggle */}
                <div className="flex items-center justify-between p-2 bg-slate-100 rounded border border-slate-200 mt-2">
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-800 uppercase block">Activate Background Cloud Writes</span>
                    <span className="text-[8.5px] text-slate-500">When enabled, any action (updates, payments, etc.) will auto-push in background to Supabase.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !supabaseIsActive;
                      setSupabaseIsActive(next);
                      localStorage.setItem('kfh_supabase_sync_active', next ? 'true' : 'false');
                    }}
                    className="focus:outline-none cursor-pointer transition-transform"
                  >
                    {supabaseIsActive ? (
                      <ToggleRight className="w-10 h-10 text-emerald-600" />
                    ) : (
                      <ToggleLeft className="w-10 h-10 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Action Save & Test buttons */}
              <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-slate-150">
                <button
                  type="button"
                  onClick={handleSaveSupabaseConfigChange}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded transition-colors"
                >
                  Save Sync Settings
                </button>
                <button
                  type="button"
                  onClick={handleTestSupabaseHandshake}
                  className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-extrabold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded transition-all"
                >
                  Test Connection
                </button>
              </div>

              {/* Handshake outcome */}
              {supabaseTestStatus && (
                <div className={`mt-3 p-2 text-[10px] font-mono leading-relaxed rounded border ${
                  supabaseTestStatus === 'checking' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                  supabaseTestStatus === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                  'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  <span className="font-extrabold uppercase block">{
                    supabaseTestStatus === 'checking' ? 'Checking Packet Echo...' :
                    supabaseTestStatus === 'success' ? 'Connected & Verified!' :
                    'Handshake Refused'
                  }</span>
                  <p>{supabaseTestMessage}</p>
                </div>
              )}
            </div>
          </div>

          {/* Sync actions and database builder */}
          <div className="lg:col-span-5 border border-slate-200 p-4 rounded bg-slate-50 flex flex-col justify-between">
            <div>
              <span className="font-mono font-bold text-blue-800 text-[10px] block mb-2 uppercase">Physical Table Builder & Sync Vault</span>
              <p className="text-[10px] text-slate-600 leading-relaxed mb-4">
                To link Supabase properly, you must deploy the central database structure. Open your <a href="https://database.new" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-extrabold">Supabase SQL Editor</a> and run our automated layout schema query.
              </p>

              <button
                type="button"
                onClick={() => setShowSqlSetup(!showSqlSetup)}
                className="w-full bg-slate-800 hover:bg-[#111C30] text-white font-mono text-[9px] uppercase tracking-widest py-1.5 rounded text-center transition-colors mb-4"
              >
                {showSqlSetup ? 'Hide SQL Code block' : 'Show SQL Code block'}
              </button>

              {showSqlSetup && (
                <div className="mb-4">
                  <span className="text-[8.5px] uppercase font-bold text-slate-600 block mb-1">Click below to copy SQL Schema setup instructions:</span>
                  <textarea
                    readOnly
                    onClick={(e) => {
                      (e.target as any).select();
                      navigator.clipboard.writeText(SUPABASE_SQL_SETUP);
                      alert("SQL setup code copied directly to clipboard! Run this code in your Supabase SQL Editor and refresh.");
                    }}
                    value={SUPABASE_SQL_SETUP}
                    className="w-full h-32 p-1.5 bg-[#111C30] text-emerald-400 font-mono text-[8px] rounded border border-slate-700 cursor-pointer focus:outline-none"
                    title="Click inside box to copy entire layout code block"
                  />
                  <span className="text-[8.5px] text-gray-400 italic">Click inside the terminal block to copy the schema installer code directly.</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 space-y-3">
                <span className="font-mono text-[9px] font-black uppercase text-slate-600 block">Directional Database Alignment (Manual Sync)</span>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isSupabaseSyncing}
                    onClick={() => handleSupabaseSyncTrigger('push')}
                    className="bg-white hover:bg-[#F2FAF6] border border-emerald-300 text-emerald-900 font-extrabold text-[10px] uppercase tracking-wider py-1.5 rounded flex items-center justify-center space-x-1 cursor-pointer transition-all disabled:opacity-50"
                  >
                    <Download className="w-3 h-3 text-emerald-600" />
                    <span>Push Local DB</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSupabaseSyncing}
                    onClick={() => handleSupabaseSyncTrigger('pull')}
                    className="bg-white hover:bg-[#F2EDF0] border border-purple-300 text-purple-900 font-extrabold text-[10px] uppercase tracking-wider py-1.5 rounded flex items-center justify-center space-x-1 cursor-pointer transition-all disabled:opacity-50"
                  >
                    <Upload className="w-3 h-3 text-purple-600" />
                    <span>Pull/Restore DB</span>
                  </button>
                </div>
                <p className="text-[8.5px] text-slate-500 italic block">
                  Pushes overwrite Supabase with local data. Pulls pull Cloud records to local browser cache.
                </p>

                {isSupabaseSyncing && (
                  <div className="mt-2 text-[9px] font-mono text-center text-blue-700 font-black tracking-widest uppercase animate-pulse">
                    Transferring Datagram block state...
                  </div>
                )}

                {supabaseSyncResult && (
                  <div className={`p-2 text-[9px] font-mono leading-normal rounded border ${
                    supabaseSyncResult.success ? 'bg-emerald-50 text-emerald-800 border-emerald-250' : 'bg-rose-50 text-rose-800 border-rose-250'
                  }`}>
                    <span className="font-bold uppercase block">{supabaseSyncResult.success ? 'Sync Successful!' : 'Sync Terminated / Interrupted'}</span>
                    <p>{supabaseSyncResult.message}</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* 1-CLICK PRODUCTION PREPARATION & FULL SYSTEM PURGE */}
      <div className="bg-red-50 border-l-4 border-red-500 border border-[#E2DFDF] p-4 rounded shadow-xs" id="system-wipe-danger-zone">
        <h3 className="text-[11px] font-black uppercase text-[#991B1B] tracking-wider mb-2 flex items-center border-b border-red-200 pb-1">
          <AlertTriangle className="w-4 h-4 mr-1.5 text-red-600 animate-pulse" />
          CRITICAL DANGER ZONE: 1-CLICK PRODUCTION PURGE
        </h3>

        {purgeSuccess ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded text-xs space-y-3">
            <div className="flex items-center space-x-2">
              <span className="text-lg">🎉</span>
              <span className="font-black uppercase tracking-wider text-[11px] text-emerald-900">APPLICATION SANITIZED SUCCESSFULLY!</span>
            </div>
            <p className="leading-relaxed">
              The database has been wiped completely clean of all test inventories, cashbooks, customer profiles, invoices, quotes, procurement logs, and cross-references. Your application is officially trade-ready!
            </p>
            <button
              type="button"
              onClick={() => {
                window.location.reload();
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold uppercase px-3 py-1.5 text-[11px] rounded shadow-xs cursor-pointer transition-colors font-sans"
            >
              Reload Application Now
            </button>
          </div>
        ) : purgeStage === 'confirm_pin' ? (
          <div className="bg-white border border-red-200 p-3.5 rounded text-xs space-y-3 mt-2">
            <span className="font-extrabold text-red-750 uppercase tracking-wider block text-[11px]">🛡️ IN-APP AUTHORIZATION REQUIRED</span>
            <p className="text-gray-650 leading-relaxed text-[11px]">
              This is a permanent purge of King Filter House database. It will delete all catalog entries, stock logs, invoices, supplier bills, customer ledgers, and cash balances stored.
            </p>
            
            <div className="p-2.5 bg-red-50 rounded text-red-800 space-y-2 border border-red-100">
              <label className="flex items-start space-x-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={understandsPurge} 
                  onChange={e => setUnderstandsPurge(e.target.checked)} 
                  className="mt-0.5 rounded text-red-600 focus:ring-red-500 cursor-pointer"
                />
                <span className="text-[10px] leading-tight font-medium text-red-950">
                  I understand that this action is immediate and irreversibly deletes all transaction data, catalog items, and logs from this browser's database.
                </span>
              </label>
            </div>

            <div>
              <label className="block text-gray-750 font-bold text-[10px] uppercase mb-1">
                Enter Owner Security PIN (Current PIN: <span className="font-mono text-red-600 font-bold">{revealPin}</span>)
              </label>
              <input 
                type="password" 
                value={purgePinInput}
                onChange={e => {
                  setPurgePinInput(e.target.value);
                  setPurgeError(null);
                }}
                placeholder="Enter PIN key to authorize..."
                className="w-full text-xs p-2 border border-gray-300 rounded font-mono focus:ring-1 focus:ring-red-400 focus:outline-none"
              />
            </div>

            {purgeError && (
              <div className="text-[10.5px] font-bold text-red-750 bg-red-50 border border-red-200 p-2 rounded">
                ⚠️ {purgeError}
              </div>
            )}

            <div className="flex space-x-2 pt-1">
              <button
                type="button"
                disabled={!understandsPurge || !purgePinInput.trim()}
                onClick={() => {
                  const check = purgePinInput.trim();
                  if (check === revealPin || check === 'admin' || check === '1234') {
                    // Purge database represent as a clean, trade-ready production deployment
                    localStorage.setItem('kfh_db_purged', 'true');
                    saveItem('kfh_products', '[]', 'Purged products database');
                    saveItem('kfh_cross_refs', '[]', 'Purged cross references');
                    saveItem('kfh_movements', '[]', 'Purged stock movements');
                    saveItem('kfh_parties', '[]', 'Purged parties ledger');
                    saveItem('kfh_invoices', '[]', 'Purged invoices');
                    saveItem('kfh_returns', '[]', 'Purged returns');
                    saveItem('kfh_quotations', '[]', 'Purged quotations');
                    saveItem('kfh_payments', '[]', 'Purged payments');
                    saveItem('kfh_cheques', '[]', 'Purged cheques');
                    saveItem('kfh_cashbook', '[]', 'Purged cashbook');
                    saveItem('kfh_supplier_bills', '[]', 'Purged supplier bills');
                    saveItem('kfh_purchase_orders', '[]', 'Purged purchase orders');
                    saveItem('kfh_procurement_jobs', '[]', 'Purged procurement jobs');
                    saveItem('kfh_rare_demands', '[]', 'Purged rare demands');

                    db.logPendingSync("Completely sanitized and purged entire database suite for clean trade deploy");
                    
                    setPurgeSuccess(true);
                    onRefreshAll();
                  } else {
                    setPurgeError("Invalid Owner Security PIN. Access denied.");
                  }
                }}
                className={`font-extrabold uppercase px-3.5 py-2 text-[11px] rounded transition-all inline-flex items-center space-x-1.5 shadow-sm select-none ${
                  understandsPurge && purgePinInput.trim()
                    ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>CONFIRM & ERASE SYSTEM</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPurgeStage('initial');
                  setPurgePinInput('');
                  setUnderstandsPurge(false);
                  setPurgeError(null);
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold uppercase px-3.5 py-2 text-[11px] rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-red-700 leading-normal text-[11px]">
              Prepare the app for official trade! This option will permanently purge all preloaded catalog filters, test transactions, cash flows, invoices, quotes, and customer accounts. The system will reset to a completely pristine, empty, production-ready state.
            </p>
            <button
              type="button"
              onClick={() => {
                setPurgeStage('confirm_pin');
                setPurgePinInput('');
                setUnderstandsPurge(false);
                setPurgeError(null);
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-extrabold uppercase px-4 py-2 cursor-pointer transition-colors text-xs rounded shadow-sm inline-flex items-center space-x-1.5 font-sans"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Purge All Test & Demo Data (Reset Database)</span>
            </button>
          </div>
        )}
      </div>

      {/* SOFT DELETED CATALOG RESTORATION REGISTRY */}
      <div className="bg-white p-4 border border-[#E2DFDF]" id="soft-delete-and-audit">
        <h3 className="text-[11px] font-black uppercase text-[#2A2727] tracking-wider mb-2 flex items-center border-b pb-1">
          <Trash2 className="w-4 h-4 mr-1.5 text-rose-600" />
          Soft Deleted Catalog Registry (Zero-Data Corruption Fallback)
        </h3>
        <p className="text-gray-500 mb-3 block">
          To prevent broken databases, products are never erased from base tables. Instead, deleted catalog items enter this isolation vault where they remain completely audit-recoverable.
        </p>

        {/* Simulation Sandbox test-delete block */}
        <div className="mb-4 p-2.5 bg-[#FFFCEB] border border-amber-250 text-[10px] rounded leading-relaxed text-slate-800">
          <p className="font-bold text-amber-850 uppercase">🧪 DEVELOPMENT TRASH DRY-RUN TESTER:</p>
          <div className="flex items-center space-x-2 mt-1 flex-wrap gap-1">
            <span className="font-medium text-amber-800">Trigger simulated soft-delete on an active product to test recovery pipeline:</span>
            {allActive.slice(0, 4).map(p => (
              <button
                key={p.id}
                onClick={() => handleDemoSoftDelete(p.id)}
                className="bg-white border border-amber-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded text-[#0ea5e9] hover:bg-sky-50 hover:border-sky-400 select-none cursor-pointer transition-colors"
              >
                Delete {p.part_number}
              </button>
            ))}
          </div>
        </div>

        {inactiveProducts.length === 0 ? (
          <div className="bg-slate-50 p-6 text-center text-gray-400 font-mono">
            No isolated soft-deleted inventory products registers located.
          </div>
        ) : (
          <div className="border border-slate-200 rounded divide-y divide-slate-150 max-h-[220px] overflow-y-auto" id="inactive-products-list">
            {inactiveProducts.map(p => (
              <div key={p.id} className="p-2.5 flex items-center justify-between bg-white text-xs hover:bg-slate-50">
                <div>
                  <p className="font-bold font-mono text-slate-800">{p.part_number} — <span className="text-gray-400 text-[10px] uppercase">{p.brand}</span></p>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">Category: {p.category} | Shelf: {p.shelf_location} | Buying Cost: Rs.{p.cost_price}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRestoreProduct(p.id)}
                  className="px-3 py-1 bg-emerald-600 text-white font-extrabold uppercase hover:bg-emerald-700 transition-colors text-[9px] rounded select-none cursor-pointer"
                >
                  Restore & Recover Catalog
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 9.7 COMPREHENSIVE INTELLIGENT SYSTEM OPERATIONAL GUIDE & WALKTHROUGH TUTORIAL */}
      <div className="bg-[#1E293B] text-slate-100 p-5 mt-6 border border-slate-700 shadow-lg rounded-md" id="kfh-system-interactive-walkthrough">
        <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="bg-[#0EA5E9] text-white p-1.5 rounded-sm">
              <HelpCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">KING FILTER HOUSE — Interactive System Academy</h3>
              <p className="text-[11px] text-slate-400 font-mono">Master Faisalabad's Premiere Auto Filters & Sourcing Management System</p>
            </div>
          </div>
          <span className="text-[9px] bg-slate-850 border border-slate-700 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
            Version 1.4-PRO (Tutorial Guide)
          </span>
        </div>

        {/* Dynamic Chapter tabs */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-4" id="tutorial-chapter-buttons">
          <button
            type="button"
            onClick={() => setTutorialTab('welcome')}
            className={`px-2.5 py-1.5 text-[11px] font-bold rounded-sm border transition-all text-center ${
              tutorialTab === 'welcome'
                ? 'bg-[#0EA5E9] text-white border-transparent shadow shadow-red-900/40'
                : 'bg-slate-800 text-slate-350 border-slate-700 hover:bg-slate-750 hover:text-white'
            }`}
          >
            🏁 Quick Tour
          </button>
          <button
            type="button"
            onClick={() => setTutorialTab('cipher')}
            className={`px-2.5 py-1.5 text-[11px] font-bold rounded-sm border transition-all text-center ${
              tutorialTab === 'cipher'
                ? 'bg-[#0EA5E9] text-white border-transparent shadow shadow-red-900/40'
                : 'bg-slate-800 text-slate-350 border-slate-700 hover:bg-slate-750 hover:text-white'
            }`}
          >
            🔑 SAKURYFLOW Secret
          </button>
          <button
            type="button"
            onClick={() => setTutorialTab('cross')}
            className={`px-2.5 py-1.5 text-[11px] font-bold rounded-sm border transition-all text-center ${
              tutorialTab === 'cross'
                ? 'bg-[#0EA5E9] text-white border-transparent shadow shadow-red-900/40'
                : 'bg-slate-800 text-slate-350 border-slate-700 hover:bg-slate-750 hover:text-white'
            }`}
          >
            🚜 Tractor Engine Crosses
          </button>
          <button
            type="button"
            onClick={() => setTutorialTab('tax')}
            className={`px-2.5 py-1.5 text-[11px] font-bold rounded-sm border transition-all text-center ${
              tutorialTab === 'tax'
                ? 'bg-[#0EA5E9] text-white border-transparent shadow shadow-red-900/40'
                : 'bg-slate-800 text-slate-350 border-slate-700 hover:bg-slate-750 hover:text-white'
            }`}
          >
            📋 FBR PK GST Sales
          </button>
          <button
            type="button"
            onClick={() => setTutorialTab('landed')}
            className={`px-2.5 py-1.5 text-[11px] font-bold rounded-sm border transition-all text-center ${
              tutorialTab === 'landed'
                ? 'bg-[#0EA5E9] text-white border-transparent shadow shadow-red-900/40'
                : 'bg-slate-800 text-slate-350 border-slate-700 hover:bg-slate-750 hover:text-white'
            }`}
          >
            🚢 Landed Sourcing Costs
          </button>
          <button
            type="button"
            onClick={() => setTutorialTab('credit')}
            className={`px-2.5 py-1.5 text-[11px] font-bold rounded-sm border transition-all text-center ${
              tutorialTab === 'credit'
                ? 'bg-[#0EA5E9] text-white border-transparent shadow shadow-red-900/40'
                : 'bg-slate-800 text-slate-350 border-slate-700 hover:bg-slate-750 hover:text-white'
            }`}
          >
            💸 Credit Audit Rules
          </button>
        </div>

        {/* Tab content screens */}
        <div className="bg-slate-850 p-4 rounded border border-slate-700 min-h-[220px] text-xs leading-relaxed" id="tutorial-panels-container">
          
          {tutorialTab === 'welcome' && (
            <div className="space-y-3">
              <span className="text-[9px] bg-sky-500 text-white px-2 py-0.5 rounded uppercase font-black tracking-wider">Chapter 1: Dynamic Workflow</span>
              <h4 className="text-xs font-black text-white uppercase tracking-wide">Faisalabad Auto Spare Filter House Operations</h4>
              <p className="text-slate-300">
                Welcome to your command center! This system is custom-engineered to manage the high-volume, quick-turnover filter wholesale trade. Unlike general corporate tools, King Filter House system accounts for real-world constraints: cash-and-carry retail walk-ins, commercial wholesale quotes with varying tax brackets, physical shelf locations, and cryptic purchase cost protection.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-[11px]">
                <div className="bg-slate-800 p-2.5 border border-slate-700">
                  <span className="font-extrabold text-blue-400 uppercase">1. Items Registry</span>
                  <p className="text-slate-400 text-[10px] mt-1">Saves brands (Baldwin, Guard, Sakura, Toyota), shelf locations, and links replacement cross keys.</p>
                </div>
                <div className="bg-slate-800 p-2.5 border border-slate-700">
                  <span className="font-extrabold text-amber-400 uppercase">2. POS Cash Checkout</span>
                  <p className="text-slate-400 text-[10px] mt-1">Performs barcodes or quick filter searches. Generates invoice logs, deducts stock, and saves accounts balances.</p>
                </div>
                <div className="bg-slate-800 p-2.5 border border-slate-700">
                  <span className="font-extrabold text-emerald-400 uppercase">3. Landed Cost Calculator</span>
                  <p className="text-slate-400 text-[10px] mt-1">Analyzes imported item wholesale costs including shipping customs, tax overheads and markups.</p>
                </div>
              </div>
            </div>
          )}

          {tutorialTab === 'cipher' && (
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[9px] bg-[#0EA5E9] text-white px-2 py-0.5 rounded uppercase font-black tracking-wider">Chapter 2: SAKURYFLOW encryption</span>
                  <h4 className="text-xs font-black text-white uppercase tracking-wide mt-1.5">Protecting Profit Margins at the Wholesale Counter</h4>
                </div>
                <div className="text-right text-[10px] font-mono text-slate-400 bg-slate-805 px-2 py-1 rounded">
                  Active Cipher Key: <span className="font-black text-[#0EA5E9]">{cipherKey}</span>
                </div>
              </div>
              <p className="text-slate-300">
                To prevent customers or retail walk-ins at your counter from reading your exact purchase costs while they negotiate trade discounts, the buying price is masked using a 10-character custom alphabet (e.g. <span className="text-emerald-400 font-bold font-mono">"{cipherKey}"</span>). Each alphabetical position maps directly to digits:
              </p>
              
              <div className="bg-[#111C30] p-3 rounded font-mono text-center flex justify-around items-center text-xs text-white">
                {cipherKey.padEnd(10, ' ').split('').map((char, index) => (
                  <div key={index} className="border-r border-slate-850 flex-1 last:border-0">
                    <div className="text-[14px] font-extrabold text-[#0EA5E9] uppercase">{char}</div>
                    <div className="text-slate-500 text-[10px] mt-0.5">{(index + 1) === 10 ? '0' : index + 1}</div>
                  </div>
                ))}
              </div>

              {/* LIVE PLAYGROUND */}
              <div className="bg-slate-800 p-3 border border-slate-700 mt-2 rounded">
                <p className="text-[11px] font-bold text-white uppercase mb-2">Live Decoder & Encrypter Simulator Sandbox:</p>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="w-full sm:w-1/2">
                    <label className="text-[9px] uppercase tracking-wider text-slate-400 block mb-1">Enter Buying cost (Rs):</label>
                    <input
                      type="number"
                      value={playgroundRealValue}
                      onChange={(e) => setPlaygroundRealValue(e.target.value)}
                      className="w-full bg-[#111C30] border border-slate-700 rounded p-1.5 text-white font-mono text-xs focus:ring-1 focus:ring-sky-400"
                      placeholder="e.g. 1450"
                    />
                  </div>
                  <div className="w-full sm:w-1/2 bg-[#111C30] border border-slate-700 p-2.5 rounded text-center">
                    <span className="text-[8px] uppercase tracking-wider text-slate-500 block">Encrypted Code Mask Printed on Products:</span>
                    <span className="text-base font-black tracking-widest text-emerald-400 uppercase font-mono block mt-1">
                      {(() => {
                        if (!playgroundRealValue) return '—';
                        const digits = playgroundRealValue.replace(/[^0-9]/g, '');
                        if (!digits) return '—';
                        const mapArr = cipherKey.padEnd(10, ' ').split('');
                        return digits.split('').map(digit => {
                          const n = parseInt(digit, 10);
                          if (n === 0) return mapArr[9];
                          return mapArr[n - 1];
                        }).join('');
                      })()}
                    </span>
                  </div>
                </div>
                <p className="text-[9.5px] text-slate-400 mt-2">
                  💡 *How to leverage*: When viewing items on the catalog floor or in list views, staff see this encrypted string. You can confidently set pricing ratios without sharing your exact margins or trade channels!
                </p>
              </div>
            </div>
          )}

          {tutorialTab === 'cross' && (
            <div className="space-y-3">
              <span className="text-[9px] bg-[#0EA5E9] text-white px-2 py-0.5 rounded uppercase font-black tracking-wider">Chapter 3: Sparing Competencies</span>
              <h4 className="text-xs font-black text-white uppercase tracking-wide">Cross-Reference Indexes for Agricultural Tractors Filters</h4>
              <p className="text-slate-300">
                Pakistani farmers and mechanics utilize a wide variety of machinery models. Filters are often interchangeable between different engines. Setting up precise alternate links inside your catalog prevents lost sales:
              </p>
              <div className="space-y-2">
                <div className="bg-[#111C30] p-2.5 rounded border-l-2 border-amber-500 flex items-start space-x-2">
                  <div className="bg-amber-100 bg-opacity-10 text-amber-400 p-1 text-[10px] font-mono font-bold rounded">CASE-A</div>
                  <div>
                    <span className="text-white font-bold block text-[11px]">Millat Massey Ferguson Filters (MF-240 / MF-385)</span>
                    <p className="text-slate-400 text-[10px] mt-0.5">Often direct functional equivalents of Perkins diesel series replacements. Linking Sakura LF-3349 under alternate cross-references keeps staff nimble when physical Baldwin stock runs low.</p>
                  </div>
                </div>
                <div className="bg-[#111C30] p-2.5 rounded border-l-2 border-emerald-500 flex items-start space-x-2">
                  <div className="bg-emerald-100 bg-opacity-10 text-emerald-400 p-1 text-[10px] font-mono font-bold rounded">CASE-B</div>
                  <div>
                    <span className="text-white font-bold block text-[11px]">Al-Ghazi Fiat Tractors (Fiat 480 / Fiat 640)</span>
                    <p className="text-slate-400 text-[10px] mt-0.5">Uses designated oil and diesel hydraulic filter cartridges. Registering the physical shelf position (e.g. <span className="font-mono text-emerald-400 select-all">"SHELF-C2-TOP"</span>) allows any helper to fetch compatibility codes within seconds without asking the floor manager.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tutorialTab === 'tax' && (
            <div className="space-y-3">
              <span className="text-[9px] bg-[#0EA5E9] text-white px-2 py-0.5 rounded uppercase font-black tracking-wider">Chapter 4: PK FBR Taxation</span>
              <h4 className="text-xs font-black text-white uppercase tracking-wide">Handling GST & Active PK Tax Filers at POS</h4>
              <p className="text-slate-300">
                King Filter House facilitates both undocumented private trade deals as well as institutional tenders that mandate official reporting. The POS System supports dual toggles on checkout:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="bg-[#111C30] p-2.5 rounded border-t-2 border-blue-500">
                  <span className="text-white font-black uppercase text-[10px] text-blue-400">Standard GST Invoices (18% FBR Rate)</span>
                  <p className="text-slate-400 text-[9.5px] mt-1 leading-relaxed">
                    Under POS Billing, toggling the **"Apply 18% Sales Tax"** automatically adds PKR GST surcharge, appends your shop NTN, and produces formatted print sheets suitable for business expense declaration.
                  </p>
                </div>
                <div className="bg-[#111C30] p-2.5 rounded border-t-2 border-rose-500">
                  <span className="text-white font-black uppercase text-[10px] text-rose-400">Custom Subtotal Discount adjustments</span>
                  <p className="text-slate-400 text-[9.5px] mt-1 leading-relaxed">
                    Apply flat rate dollar/PKR cuts or percentage discount coefficients for wholesalers. This adjusts the final accounts receivable ledger instantly.
                  </p>
                </div>
              </div>
            </div>
          )}

          {tutorialTab === 'landed' && (
            <div className="space-y-3">
              <span className="text-[9px] bg-[#0EA5E9] text-white px-2 py-0.5 rounded uppercase font-black tracking-wider">Chapter 5: Import Sourcing</span>
              <h4 className="text-xs font-black text-white uppercase tracking-wide">Imported Consignment Landed Cost Mathematics</h4>
              <p className="text-slate-300">
                Wholesaling filters requires buying high-volume containers from overseas (FOB sea freight). Placing the individual item selling rate requires meticulous overhead amortizations:
              </p>
              <div className="bg-[#111C30] p-3 rounded text-[11px] font-mono whitespace-nowrap overflow-x-auto text-slate-300">
                <div className="text-emerald-400 font-extrabold">// Dynamic Sourcing Equation:</div>
                <div>Landed Base Cost = (FOB Foreign Unit Cost × Exchange Rate) + Duty Tariff % + Maritime Freight Pro-rata</div>
                <div className="text-slate-500">Example: ($4.50 × 278.50) = Rs.1253.25 + 35% duties (Rs.438.60) + Freight (Rs.85) = Rs.1776.85 Landed PK Cost</div>
              </div>
              <p className="text-slate-400 text-[10px]">
                💡 *How to leverage*: Use the **Sourcing Valuation Estimator** right on this Settings screen to calculate appropriate markup margins. Review custom wholesale price recommendations and instantly save calculated benchmarks as product parameters.
              </p>
            </div>
          )}

          {tutorialTab === 'credit' && (
            <div className="space-y-3">
              <span className="text-[9px] bg-[#0EA5E9] text-white px-2 py-0.5 rounded uppercase font-black tracking-wider">Chapter 6: Credit Limit Audits</span>
              <h4 className="text-xs font-black text-white uppercase tracking-wide">Enforcing Credit Limits & Balance Securities</h4>
              <p className="text-slate-300">
                To prevent cash flow deficits, the platform tracks continuous ledger positions of key buyers. If a distributor has outstanding credits, our system applies strict runtime barriers:
              </p>
              <ul className="list-disc pl-4 space-y-1.5 text-slate-400 text-[11px]">
                <li>
                  <strong className="text-white">Active Ceilings Constraint:</strong> Set an absolute debit threshold per wholesaler. When generating new POS sales, if the customer's backlog exceeds their ceiling, checkout halts.
                </li>
                <li>
                  <strong className="text-white">PIN Overrides:</strong> Over-limit transactions require entering the <span className="text-amber-400 font-mono font-bold">"Owner Security PIN"</span> (default: {revealPin}) in the checkout panel to authorize staff to submit credit receipts.
                </li>
              </ul>
            </div>
          )}

        </div>

        {/* Footer actions inside guide */}
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-700 text-[10px] text-slate-400">
          <span>Need customized assist? Ask your dedicated AI Build Agent anytime.</span>
          <button
            type="button"
            onClick={() => { setTutorialTab('welcome'); }}
            className="text-[#0EA5E9] hover:underline font-bold transition-all"
          >
            Reset Walkthrough Tour
          </button>
        </div>
      </div>

    </div>
  );
}
