import React from 'react';
import { User } from '../types.ts';

interface NavbarProps {
  user: User;
  onLogout: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogout, isDarkMode, toggleDarkMode }) => {
  return (
    <header className="bg-white dark:bg-slate-900 border-b border-amber-100/50 dark:border-slate-800 px-8 py-5 flex items-center justify-between transition-colors duration-300 z-10">
      <div>
        <h2 className="text-[10px] font-black text-[#001f3f]/40 dark:text-slate-500 uppercase tracking-[0.4em] md:hidden">Authorized Access Only</h2>
      </div>
      <div className="flex items-center space-x-5 md:space-x-8">
        <button 
          onClick={toggleDarkMode}
          className="p-2.5 rounded-2xl bg-amber-50 dark:bg-slate-800 text-[#d4af37] dark:text-amber-500 hover:bg-[#d4af37] hover:text-white dark:hover:bg-amber-600 transition-all duration-300 shadow-sm border border-amber-100 dark:border-slate-700"
          aria-label="Toggle Adaptive Display"
        >
          {isDarkMode ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 3v1m0 16v1m9-9h-1M4 9h-1m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          )}
        </button>

        <div className="text-right hidden sm:block">
          <p className="text-sm font-black text-[#001f3f] dark:text-white leading-none tracking-tight">{user.name}</p>
          <p className="text-[9px] text-[#d4af37] font-black uppercase tracking-[0.2em] mt-1">{user.role.replace(/_/g, ' ')}</p>
        </div>
        
        <button 
          onClick={onLogout}
          className="bg-slate-50 dark:bg-slate-800 hover:bg-[#d4af37] hover:text-white text-[#001f3f] dark:text-slate-300 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border border-slate-100 dark:border-slate-700 shadow-sm"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
};

export default Navbar;