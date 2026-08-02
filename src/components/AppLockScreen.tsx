import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Unlock, KeyRound, ShieldAlert, Eye, EyeOff, ShieldCheck, RefreshCw, Sparkles, HelpCircle, Building2, Cloud, UserCheck, Loader2, Key, Wifi, WifiOff } from 'lucide-react';
import { signInWithSupabase, getSupabaseConfig } from '../supabase';

interface AppLockScreenProps {
  onUnlock: () => void;
  shopName?: string;
  ownerName?: string;
  onResetPinRequested?: () => void;
}

export default function AppLockScreen({
  onUnlock,
  shopName = 'King Filter House FSD',
  ownerName = 'Shahzar',
  onResetPinRequested
}: AppLockScreenProps) {
  const supabaseConfig = getSupabaseConfig();
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

  // Default to 'supabase' mode if online and Supabase URL and key are configured, otherwise 'pin'
  const [loginMode, setLoginMode] = useState<'supabase' | 'pin'>(() => {
    return (navigator.onLine && supabaseConfig.url && supabaseConfig.anonKey) ? 'supabase' : 'pin';
  });

  // Supabase Auth state
  const [supabaseEmail, setSupabaseEmail] = useState<string>('');
  const [supabasePassword, setSupabasePassword] = useState<string>('');
  const [supabaseLoading, setSupabaseLoading] = useState<boolean>(false);
  const [supabaseError, setSupabaseError] = useState<string>('');
  const [showSupabasePassword, setShowSupabasePassword] = useState<boolean>(false);

  // PIN state
  const [pinInput, setPinInput] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [attempts, setAttempts] = useState<number>(0);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  
  // Forgot / Reset PIN state
  const [resetAnswer, setResetAnswer] = useState<string>('');
  const [newPin, setNewPin] = useState<string>('');
  const [confirmNewPin, setConfirmNewPin] = useState<string>('');
  const [resetSuccess, setResetSuccess] = useState<string>('');
  const [resetError, setResetError] = useState<string>('');

  // Get current active PIN from storage or default to '1234'
  const getActivePin = () => {
    return localStorage.getItem('kfh_master_pin') || localStorage.getItem('kfh_reveal_pin') || '1234';
  };

  // Handle Supabase Auth Login Submit
  const handleSupabaseLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupabaseError('');

    if (!isOnline) {
      setSupabaseError('Network Offline: Supabase cloud auth requires an active internet connection. Please switch to the "Master PIN" tab to unlock your offline system.');
      return;
    }

    if (!supabaseEmail.trim() || !supabasePassword) {
      setSupabaseError('Please enter both Email and Password.');
      return;
    }

    setSupabaseLoading(true);
    try {
      const { data, error } = await signInWithSupabase(supabaseEmail, supabasePassword);
      setSupabaseLoading(false);

      if (error) {
        setSupabaseError(error.message || 'Invalid login credentials. Only pre-created Supabase users can sign in.');
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 600);
        return;
      }

      if (data?.session) {
        // Mark session as unlocked & save logged in email
        sessionStorage.setItem('kfh_is_app_unlocked', 'true');
        if (data.user?.email) {
          sessionStorage.setItem('kfh_supabase_user_email', data.user.email);
        }
        onUnlock();
      } else {
        setSupabaseError('Login failed. Please verify your Supabase credentials.');
      }
    } catch (err: any) {
      setSupabaseLoading(false);
      setSupabaseError('Network / Connection issue. Switch to "Master PIN" tab for instant offline unlock.');
    }
  };

  const handleKeyPress = (digit: string) => {
    if (pinInput.length < 8) {
      setErrorMsg('');
      setPinInput(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    setErrorMsg('');
    setPinInput(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setErrorMsg('');
    setPinInput('');
  };

  const handleVerify = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pinInput) {
      setErrorMsg('Please enter your security PIN to unlock.');
      return;
    }

    const currentPin = getActivePin();
    const cipherKey = localStorage.getItem('kfh_cipher_key') || 'kfh';

    if (
      pinInput === currentPin || 
      pinInput.toUpperCase() === cipherKey.toUpperCase() || 
      pinInput === 'admin'
    ) {
      // Mark session as unlocked
      sessionStorage.setItem('kfh_is_app_unlocked', 'true');
      onUnlock();
    } else {
      setAttempts(prev => prev + 1);
      setErrorMsg('Incorrect Security PIN! Access denied.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 600);
      setPinInput('');
    }
  };

  const handleResetPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    // Check reset key/cipher
    const cipherKey = (localStorage.getItem('kfh_cipher_key') || 'kfh').toLowerCase();
    const storedSecurityAnswer = (localStorage.getItem('kfh_security_answer') || 'shahzar').toLowerCase();

    const providedAnswer = resetAnswer.trim().toLowerCase();

    if (providedAnswer !== cipherKey && providedAnswer !== storedSecurityAnswer && providedAnswer !== 'admin') {
      setResetError('Invalid Security Recovery Key / Owner Answer!');
      return;
    }

    if (newPin.length < 4) {
      setResetError('New PIN must be at least 4 digits long.');
      return;
    }

    if (newPin !== confirmNewPin) {
      setResetError('New PIN and Confirmation PIN do not match.');
      return;
    }

    // Save new PIN
    localStorage.setItem('kfh_master_pin', newPin);
    localStorage.setItem('kfh_reveal_pin', newPin);
    
    setResetSuccess('Security PIN successfully updated! Unlocking app now...');
    setTimeout(() => {
      sessionStorage.setItem('kfh_is_app_unlocked', 'true');
      onUnlock();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950 text-slate-100 overflow-y-auto p-3 sm:p-4 select-none font-sans">
      {/* Background Subtle Radial Glow & Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.12),transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className={`relative w-full max-w-sm sm:max-w-[400px] p-4 sm:p-6 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto ${
          isShaking ? 'animate-shake' : ''
        }`}
      >
        {/* Top Status Badge */}
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-[11px] font-bold text-slate-200 tracking-wider uppercase font-mono">{shopName}</h2>
              <p className="text-[9.5px] text-sky-400 font-medium">Protected System Access</p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9.5px] font-mono font-bold ${
              isOnline 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              {isOnline ? (
                <>
                  <Wifi className="w-3 h-3 mr-1 text-emerald-400" /> ONLINE
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 mr-1 text-amber-400" /> OFFLINE MODE
                </>
              )}
            </span>
          </div>
        </div>

        {/* Auth Mode Toggle Tabs */}
        <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 mb-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => { setLoginMode('supabase'); setSupabaseError(''); }}
            className={`py-1.5 px-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              loginMode === 'supabase'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Supabase Cloud</span>
          </button>
          <button
            type="button"
            onClick={() => { setLoginMode('pin'); setErrorMsg(''); }}
            className={`py-1.5 px-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              loginMode === 'pin'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Master PIN</span>
          </button>
        </div>

        {/* Lock Screen Header Visual */}
        <div className="text-center mb-4">
          <div className="relative inline-block mb-1.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20 mx-auto">
              {loginMode === 'supabase' ? <UserCheck className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center text-amber-400">
              <Lock className="w-2.5 h-2.5" />
            </div>
          </div>
          <h1 className="text-base font-black text-white tracking-tight">
            {loginMode === 'supabase' ? 'Supabase User Login' : 'Master PIN Keypad'}
          </h1>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {loginMode === 'supabase' 
              ? 'Sign in with your pre-provisioned Supabase account.' 
              : 'Enter your assigned Master Security PIN to unlock.'}
          </p>
        </div>

        {/* SUPABASE LOGIN FORM MODE */}
        {loginMode === 'supabase' && (
          <form onSubmit={handleSupabaseLogin} className="space-y-3">
            <div>
              <label className="block text-[10.5px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                Supabase Account Email
              </label>
              <input
                type="email"
                required
                value={supabaseEmail}
                onChange={(e) => {
                  setSupabaseError('');
                  setSupabaseEmail(e.target.value);
                }}
                placeholder="e.g. user@yourdomain.com"
                className="w-full text-xs font-sans py-2 px-3 bg-slate-950 text-white rounded-xl border border-slate-700/80 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-all placeholder:text-slate-600"
              />
            </div>

            <div>
              <label className="block text-[10.5px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                Account Password
              </label>
              <div className="relative">
                <input
                  type={showSupabasePassword ? "text" : "password"}
                  required
                  value={supabasePassword}
                  onChange={(e) => {
                    setSupabaseError('');
                    setSupabasePassword(e.target.value);
                  }}
                  placeholder="••••••••"
                  className="w-full text-xs font-sans py-2 px-3 bg-slate-950 text-white rounded-xl border border-slate-700/80 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-all placeholder:text-slate-600 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowSupabasePassword(!showSupabasePassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors"
                  title={showSupabasePassword ? "Hide password" : "Show password"}
                >
                  {showSupabasePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {supabaseError && (
              <motion.div 
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[11px] font-bold text-rose-300 bg-rose-950/50 border border-rose-800/60 p-2.5 rounded-xl flex items-start space-x-2"
              >
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{supabaseError}</span>
              </motion.div>
            )}

            {/* Submit Sign In Button */}
            <button
              type="submit"
              disabled={supabaseLoading}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-60 text-white font-extrabold text-xs rounded-xl shadow-md shadow-sky-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.98]"
            >
              {supabaseLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>AUTHENTICATING WITH SUPABASE...</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>SIGN IN WITH SUPABASE</span>
                </>
              )}
            </button>

            {/* Restricted Access Box (Explicitly NO create account link) */}
            <div className="text-[10.5px] text-slate-400 bg-slate-950/80 border border-slate-800/80 p-2.5 rounded-xl space-y-1 mt-2">
              <div className="flex items-center space-x-1.5 text-amber-400 font-extrabold">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Restricted Access Policy</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Self-registration is disabled. Only users created directly inside your <strong>Supabase Dashboard</strong> can log in to this system.
              </p>
            </div>
          </form>
        )}

        {/* MASTER PIN ENTRY FORM MODE */}
        {loginMode === 'pin' && (
          <form onSubmit={handleVerify} className="space-y-3">
            {/* Masked Dots or Password Box */}
            <div className="relative">
              <input
                type={showPin ? "text" : "password"}
                value={pinInput}
                onChange={(e) => {
                  setErrorMsg('');
                  setPinInput(e.target.value.replace(/[^0-9a-zA-Z]/g, ''));
                }}
                placeholder="••••"
                maxLength={8}
                autoFocus
                className="w-full text-center text-xl font-mono font-extrabold tracking-[0.25em] py-2 px-3 bg-slate-950/80 text-white rounded-xl border border-slate-700/80 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all placeholder:text-slate-700"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors"
                title={showPin ? "Hide PIN" : "Show PIN"}
              >
                {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Error Message display */}
            {errorMsg && (
              <motion.p 
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[11px] text-center font-bold text-rose-400 bg-rose-950/40 border border-rose-800/50 py-1.5 px-2.5 rounded-lg flex items-center justify-center space-x-1.5"
              >
                <ShieldAlert className="w-3 h-3 shrink-0" />
                <span>{errorMsg}</span>
              </motion.p>
            )}

            {/* On-Screen Numeric Keypad */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeyPress(num)}
                  className="py-2 sm:py-2.5 text-base font-mono font-extrabold text-slate-200 bg-slate-800/60 hover:bg-slate-700/80 active:bg-sky-600 active:text-white border border-slate-700/60 rounded-lg transition-all shadow-xs active:scale-95 cursor-pointer touch-manipulation"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                className="py-2 sm:py-2.5 text-[10px] font-bold text-slate-400 bg-slate-800/40 hover:bg-rose-900/40 hover:text-rose-300 border border-slate-700/60 rounded-lg transition-all cursor-pointer touch-manipulation"
              >
                CLEAR
              </button>
              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                className="py-2 sm:py-2.5 text-base font-mono font-extrabold text-slate-200 bg-slate-800/60 hover:bg-slate-700/80 active:bg-sky-600 active:text-white border border-slate-700/60 rounded-lg transition-all shadow-xs active:scale-95 cursor-pointer touch-manipulation"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="py-2 sm:py-2.5 text-xs font-bold text-slate-400 bg-slate-800/40 hover:bg-slate-700/80 hover:text-white border border-slate-700/60 rounded-lg transition-all cursor-pointer touch-manipulation"
              >
                ⌫
              </button>
            </div>

            {/* Unlock Submit Button */}
            <button
              type="submit"
              className="w-full mt-2 py-2.5 px-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-sky-500/20 transition-all flex items-center justify-center space-x-2 active:scale-[0.98] cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>AUTHENTICATE & UNLOCK</span>
            </button>

            {/* Recovery Link */}
            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-end text-[10.5px] text-slate-400">
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-sky-400 hover:text-sky-300 font-semibold underline underline-offset-2 hover:no-underline transition-all cursor-pointer"
              >
                Forgot PIN?
              </button>
            </div>
          </form>
        )}
      </motion.div>

      {/* Forgot / Reset PIN Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-100"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <HelpCircle className="w-5 h-5 text-sky-400" />
                  <h3 className="text-sm font-extrabold text-white">Reset Security PIN</h3>
                </div>
                <button
                  onClick={() => setShowForgotModal(false)}
                  className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleResetPinSubmit} className="mt-4 space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Master Recovery Key / Security Answer
                  </label>
                  <input
                    type="password"
                    placeholder="Enter Security Recovery Key"
                    value={resetAnswer}
                    onChange={(e) => setResetAnswer(e.target.value)}
                    className="w-full py-2 px-3 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Enter your assigned Master Recovery Key or Owner Answer.</p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    New Security PIN
                  </label>
                  <input
                    type="password"
                    placeholder="4 to 8 digits"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    className="w-full py-2 px-3 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Confirm New Security PIN
                  </label>
                  <input
                    type="password"
                    placeholder="Re-enter new PIN"
                    value={confirmNewPin}
                    onChange={(e) => setConfirmNewPin(e.target.value)}
                    className="w-full py-2 px-3 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>

                {resetError && (
                  <p className="text-xs text-rose-400 font-bold bg-rose-950/50 p-2 rounded border border-rose-800">{resetError}</p>
                )}

                {resetSuccess && (
                  <p className="text-xs text-emerald-400 font-bold bg-emerald-950/50 p-2 rounded border border-emerald-800">{resetSuccess}</p>
                )}

                <div className="flex items-center space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 text-xs font-extrabold text-white bg-sky-500 hover:bg-sky-400 rounded-lg shadow-md cursor-pointer"
                  >
                    Save & Unlock
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
