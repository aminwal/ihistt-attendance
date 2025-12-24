import React, { useState } from 'react';
import { User } from '../types.ts';
import { SCHOOL_NAME } from '../constants.ts';

interface LoginProps {
  users: User[];
  onLogin: (user: User) => void;
  isDarkMode: boolean;
}

const Login: React.FC<LoginProps> = ({ users, onLogin, isDarkMode }) => {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => 
      u.employeeId.toLowerCase() === employeeId.toLowerCase().trim() && 
      u.password === password
    );
    
    if (user) {
      onLogin(user);
    } else {
      setError('Authentication Failed: Invalid ID or Password.');
    }
  };

  return (
    <div className="h-screen w-full bg-[#001f3f] dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors duration-300 overflow-hidden">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden border border-amber-200/20 flex flex-col max-h-[92vh]">
        {/* Condensed Header */}
        <div className="bg-[#d4af37] py-4 px-8 text-center relative shrink-0">
          <div className="absolute inset-0 bg-black/5 opacity-20 pointer-events-none"></div>
          <div className="w-12 h-12 bg-[#001f3f] rounded-2xl mx-auto mb-2 flex items-center justify-center shadow-xl border-2 border-white/20 transform -rotate-2">
             <span className="text-[#d4af37] font-black text-xl tracking-tighter">IH</span>
          </div>
          <h1 className="text-[#001f3f] text-base font-black uppercase tracking-tight italic leading-tight">{SCHOOL_NAME}</h1>
          <p className="text-[#001f3f]/70 text-[8px] font-black uppercase tracking-[0.3em] mt-1">Staff Gateway</p>
        </div>
        
        {/* Condensed Form Area */}
        <div className="p-5 flex-1 flex flex-col space-y-3 overflow-y-auto scrollbar-hide">
          <div className="text-center">
            <h2 className="text-gray-400 dark:text-slate-500 font-black text-[9px] uppercase tracking-[0.3em]">Institutional Verification</h2>
          </div>

          <form onSubmit={handleLogin} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Employee ID</label>
              <input
                type="text"
                placeholder="e.g. emp001"
                value={employeeId}
                onChange={(e) => {
                  setEmployeeId(e.target.value);
                  setError('');
                }}
                className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-[#d4af37] rounded-2xl outline-none transition-all dark:text-white font-bold text-sm shadow-inner"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
              <div className="relative group">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-[#d4af37] rounded-2xl outline-none transition-all dark:text-white font-bold text-sm shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-[#d4af37] transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88L1 1m11.939 11.939l11.06 11.06" /></svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-xl border border-red-100 dark:border-red-900/30 flex items-center space-x-2 animate-shake">
                <svg className="w-3 h-3 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                <span className="text-[8px] font-black text-red-600 uppercase tracking-tight">{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#001f3f] hover:bg-[#002d5c] text-[#d4af37] py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl transition-all border-2 border-transparent hover:border-amber-400/20 active:scale-95"
            >
              Secure Login
            </button>
          </form>

          <div className="pt-3 mt-auto border-t border-slate-50 dark:border-slate-800 text-center">
            <p className="text-[8px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-[0.2em] leading-relaxed">
              Biometric & Geolocation Secured<br/>
              {SCHOOL_NAME} © 2025<br/>
              <span className="text-slate-500 font-black">Developed by: Ahmed Minwal</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;