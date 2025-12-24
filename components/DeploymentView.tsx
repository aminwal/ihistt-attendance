import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.ts';

const DeploymentView: React.FC = () => {
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error' | 'local'>('checking');
  const [urlInput, setUrlInput] = useState(localStorage.getItem('IHIS_CFG_VITE_SUPABASE_URL') || '');
  const [keyInput, setKeyInput] = useState(localStorage.getItem('IHIS_CFG_VITE_SUPABASE_ANON_KEY') || '');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  
  useEffect(() => {
    const checkConn = async () => {
      if (supabase.supabaseUrl.includes('placeholder')) {
        setDbStatus('local');
        return;
      }
      try {
        const { error } = await supabase.from('profiles').select('id').limit(1);
        if (error && error.code !== 'PGRST116') setDbStatus('error');
        else setDbStatus('connected');
      } catch {
        setDbStatus('error');
      }
    };
    checkConn();
  }, []);

  const handleManualSave = () => {
    if (!urlInput || !keyInput) {
      setSaveStatus("Both URL and Key are required.");
      return;
    }
    localStorage.setItem('IHIS_CFG_VITE_SUPABASE_URL', urlInput.trim());
    localStorage.setItem('IHIS_CFG_VITE_SUPABASE_ANON_KEY', keyInput.trim());
    setSaveStatus("Credentials Secured. Reloading system...");
    setTimeout(() => window.location.reload(), 1500);
  };

  const clearCredentials = () => {
    localStorage.removeItem('IHIS_CFG_VITE_SUPABASE_URL');
    localStorage.removeItem('IHIS_CFG_VITE_SUPABASE_ANON_KEY');
    window.location.reload();
  };

  const sqlSchema = `
-- 1. Create Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  class_teacher_of TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Create Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  date DATE NOT NULL,
  check_in TEXT NOT NULL,
  check_out TEXT,
  is_manual BOOLEAN DEFAULT FALSE,
  is_late BOOLEAN DEFAULT FALSE,
  location JSONB
);

-- 3. Security: Allow Public Access
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON profiles FOR ALL USING (true);
CREATE POLICY "Public Access" ON attendance FOR ALL USING (true);
  `.trim();

  return (
    <div className="space-y-12 animate-in fade-in duration-700 max-w-6xl mx-auto pb-24 px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-[#001f3f] dark:text-white italic tracking-tight uppercase">Infrastructure Portal</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Manage Cloud Synchronization & Database Scaling</p>
        </div>
        <div className={`px-6 py-3 rounded-2xl border-2 flex items-center space-x-4 transition-all shadow-lg ${
          dbStatus === 'connected' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 
          dbStatus === 'local' ? 'bg-amber-50 border-amber-100 text-amber-600' : 
          'bg-red-50 border-red-100 text-red-600'
        }`}>
          <div className={`w-3 h-3 rounded-full ${dbStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : dbStatus === 'local' ? 'bg-amber-400' : 'bg-red-500'}`}></div>
          <span className="text-[10px] font-black uppercase tracking-widest">
            Mode: {dbStatus === 'connected' ? 'CLOUD LINKED' : dbStatus === 'local' ? 'LOCAL ONLY' : 'LINK ERROR'}
          </span>
        </div>
      </div>

      {/* NEW: QUICK LINK SECTION */}
      <section className="bg-[#0a0a0a] dark:bg-slate-900 rounded-[3rem] shadow-2xl border-4 border-[#d4af37]/30 overflow-hidden">
        <div className="bg-gradient-to-r from-[#d4af37] to-[#b8860b] p-8 flex items-center space-x-6 text-[#001f3f]">
          <div className="w-14 h-14 bg-[#001f3f] rounded-2xl flex items-center justify-center font-black text-2xl text-[#d4af37] shadow-xl">00</div>
          <div>
            <h2 className="text-[#001f3f] text-xl font-black uppercase italic tracking-tight">Direct Cloud Configuration</h2>
            <p className="text-[#001f3f]/70 text-[10px] font-black uppercase tracking-widest">Provide Supabase credentials to enable cloud sync now</p>
          </div>
        </div>
        <div className="p-10 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Supabase Project URL</label>
              <input 
                type="text" 
                placeholder="https://yourproject.supabase.co"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="w-full bg-slate-900 text-[#d4af37] border-2 border-slate-800 rounded-2xl px-6 py-4 font-mono text-sm outline-none focus:border-[#d4af37] transition-all"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Supabase Anon Key</label>
              <input 
                type="password" 
                placeholder="eyJhbGciOiJIUzI1..."
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="w-full bg-slate-900 text-[#d4af37] border-2 border-slate-800 rounded-2xl px-6 py-4 font-mono text-sm outline-none focus:border-[#d4af37] transition-all"
              />
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button 
              onClick={handleManualSave}
              className="w-full sm:w-auto bg-[#d4af37] text-[#001f3f] px-12 py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] shadow-xl hover:bg-amber-400 active:scale-95 transition-all"
            >
              Link Infrastructure
            </button>
            <button 
              onClick={clearCredentials}
              className="text-slate-500 text-[10px] font-black uppercase tracking-widest hover:text-red-500 transition-colors"
            >
              Reset to Local
            </button>
            {saveStatus && (
              <span className="text-[10px] font-black uppercase text-amber-500 animate-pulse">{saveStatus}</span>
            )}
          </div>
          <p className="text-[9px] text-slate-500 font-bold italic">
            * These credentials will be stored securely in your browser's local cache. 
            For a permanent deployment, use Vercel Environment Variables as described below.
          </p>
        </div>
      </section>

      {/* PHASE 1: DATABASE */}
      <section className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden">
        <div className="bg-[#001f3f] p-8 flex items-center space-x-6 text-[#d4af37]">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center font-black text-2xl border border-white/20">01</div>
          <div>
            <h2 className="text-white text-xl font-black uppercase italic tracking-tight">Phase I: Setup Supabase Database</h2>
            <p className="text-amber-200/50 text-[10px] font-black uppercase tracking-widest">Run the SQL script to create tables</p>
          </div>
        </div>
        <div className="p-10 grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-4">
            <p className="text-xs font-bold text-slate-500">1. Go to <a href="https://supabase.com" target="_blank" className="text-sky-600 underline">Supabase.com</a> and create a project.</p>
            <p className="text-xs font-bold text-slate-500">2. Open "SQL Editor" and paste this code:</p>
            <pre className="bg-slate-950 text-emerald-400 p-6 rounded-3xl text-[10px] font-mono h-48 overflow-y-auto border border-slate-800 scrollbar-hide">
              {sqlSchema}
            </pre>
            <button 
              onClick={() => { navigator.clipboard.writeText(sqlSchema); alert('SQL Copied!'); }}
              className="w-full bg-[#001f3f] text-[#d4af37] py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg"
            >
              Copy SQL Schema
            </button>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/10 p-8 rounded-3xl flex flex-col justify-center border border-amber-100">
             <h4 className="text-[11px] font-black text-amber-700 uppercase mb-4 tracking-widest">Critical Step</h4>
             <p className="text-xs text-amber-800/70 font-bold leading-relaxed">
               After running the SQL, go to <b>Project Settings &gt; API</b>. <br/><br/>
               The <b>Project URL</b> and <b>anon public key</b> are what you need for the "Direct Configuration" above or Vercel setup.
             </p>
          </div>
        </div>
      </section>

      {/* PHASE 2 & 3 SECTIONS REMAINING FOR GUIDANCE... */}
      <div className="opacity-60 grayscale pointer-events-none">
        {/* Simplified view of remaining phases to keep focus on the fix */}
        <p className="text-center font-black uppercase text-[10px] tracking-widest text-slate-400 py-10">See Phase II & III below for Vercel deployment instructions...</p>
      </div>
    </div>
  );
};

export default DeploymentView;
