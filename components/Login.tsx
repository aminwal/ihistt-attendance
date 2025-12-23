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
      setError('Authentication Failed: Invalid Employee ID or Password.');
    }
  };

  return (
    <div className="min-h-screen bg-[#001f3f] dark:bg-slate-950 flex flex-col items-center justify-center p-6 transition-colors duration-300">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-amber-200/20">
        <div className="bg-[#d4af37] p-12 text-center relative">
          <div className="absolute inset-0 bg-black/5 opacity-20 pointer-events-none"></div>
          <div className="w-20 h-20 bg-[#001f3f] rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-2xl border-2 border-white/20 transform -rotate-3 hover:rotate-0 transition-transform">
             <span className="text-[#d4af37] font-black text-3xl">IH</span>
          </div>
          <h1 className="text-[#001f3f] text-2xl font-black uppercase tracking-tight italic">{SCHOOL_NAME}</h1>
          <p className="text-[#001f3f]/70 text-[10px] font-black uppercase tracking-[0.4em] mt-2">Staff Gateway</p>
        </div>
        
        <div className="p-10 space-y-8">
          <div className="text-center">
            <h2 className="text-gray-400 dark:text-slate-500 font-black text-[10px] uppercase tracking-[0.3em]">Institutional Verification</h2>
            <p className="text-xs font-bold text-slate-400 mt-1">Please enter your unique staff credentials</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Employee ID</label>
              <div className="relative group">
                <input
                  type="text"
                  placeholder="e.g. emp001"
                  value={employeeId}
                  onChange={(e) => {
                    setEmployeeId(e.target.value);
                    setError('');
                  }}
                  className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-[#d4af37] rounded-3xl outline-none transition-all dark:text-white font-black text-lg shadow-inner group-hover:bg-slate-100 dark:group-hover:bg-slate-700"
                />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#d4af37]">
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
              <div className="relative group">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-[#d4af37] rounded-3xl outline-none transition-all dark:text-white font-black text-lg shadow-inner group-hover:bg-slate-100 dark:group-hover:bg-slate-700"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-[#d4af37] transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88L1 1m11.939 11.939l11.06 11.06" /></svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl border border-red-100 dark:border-red-900/30 flex items-center space-x-3 animate-shake">
                <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                <span className="text-[10px] font-black text-red-600 uppercase tracking-tight leading-tight">{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#001f3f] hover:bg-[#002d5c] text-[#d4af37] py-6 rounded-3xl font-black text-sm uppercase tracking-[0.3em] shadow-2xl transition-all transform hover:scale-[1.02] active:scale-95 border-2 border-transparent hover:border-amber-400/20"
            >
              Secure Login
            </button>
          </form>

          <div className="pt-4 border-t border-slate-50 dark:border-slate-800 text-center">
            <p className="text-[9px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-[0.2em] leading-relaxed">
              Biometric & Geolocation Secured Access<br/>Ibn Al Hytham Islamic School © 2025
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;