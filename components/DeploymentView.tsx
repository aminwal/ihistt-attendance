import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.ts';

const DeploymentView: React.FC = () => {
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  
  useEffect(() => {
    const checkConn = async () => {
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

-- 3. Security: Allow Public Access (For Easy Setup)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON profiles FOR ALL USING (true);
CREATE POLICY "Public Access" ON attendance FOR ALL USING (true);
  `.trim();

  return (
    <div className="space-y-12 animate-in fade-in duration-700 max-w-6xl mx-auto pb-24 px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-[#001f3f] dark:text-white italic tracking-tight uppercase">Live Launch Checklist</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Steps to make the portal accessible to all teachers</p>
        </div>
        <div className={`px-6 py-3 rounded-2xl border-2 flex items-center space-x-4 transition-all ${dbStatus === 'connected' ? 'bg-emerald-50 border-emerald-100 text-emerald-600 shadow-lg' : 'bg-red-50 border-red-100 text-red-600 shadow-lg'}`}>
          <div className={`w-4 h-4 rounded-full ${dbStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-[11px] font-black uppercase tracking-widest">Database: {dbStatus.toUpperCase()}</span>
        </div>
      </div>

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
              className="w-full bg-[#001f3f] text-[#d4af37] py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest"
            >
              Copy SQL Schema
            </button>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/10 p-8 rounded-3xl flex flex-col justify-center border border-amber-100">
             <h4 className="text-[11px] font-black text-amber-700 uppercase mb-4 tracking-widest">Critical Step</h4>
             <p className="text-xs text-amber-800/70 font-bold leading-relaxed">
               After running the SQL, go to <b>Project Settings > API</b>. <br/><br/>
               You will need the <b>Project URL</b> and the <b>anon public key</b> for the next phase.
             </p>
          </div>
        </div>
      </section>

      {/* PHASE 2: HOSTING */}
      <section className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden">
        <div className="bg-sky-600 p-8 flex items-center space-x-6 text-white">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center font-black text-2xl border border-white/20">02</div>
          <div>
            <h2 className="text-white text-xl font-black uppercase italic tracking-tight">Phase II: Deploy to Vercel</h2>
            <p className="text-sky-100 text-[10px] font-black uppercase tracking-widest">Making the URL public (ihis-portal.vercel.app)</p>
          </div>
        </div>
        <div className="p-10 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
               <span className="text-2xl mb-4 block">🚀</span>
               <h5 className="text-[11px] font-black uppercase mb-2">1. Connect GitHub</h5>
               <p className="text-[11px] text-slate-500 font-bold">Go to <a href="https://vercel.com" target="_blank" className="text-sky-600 underline">Vercel.com</a> and click <b>"Add New > Project"</b>.</p>
            </div>
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
               <span className="text-2xl mb-4 block">📂</span>
               <h5 className="text-[11px] font-black uppercase mb-2">2. Import Repo</h5>
               <p className="text-[11px] text-slate-500 font-bold">Select <b>"ihistt-attendance"</b> and click <b>"Import"</b>.</p>
            </div>
            <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
               <span className="text-2xl mb-4 block">🔑</span>
               <h5 className="text-[11px] font-black uppercase mb-2">3. Config Keys</h5>
               <p className="text-[11px] text-emerald-700 font-bold">Add the variables listed below in the <b>Environment Variables</b> section before deploying.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PHASE 3: VARIABLES */}
      <section className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border-4 border-emerald-500 overflow-hidden">
        <div className="bg-emerald-600 p-8 flex items-center space-x-6 text-white">
          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-emerald-600 font-black text-2xl shadow-xl italic">03</div>
          <div>
            <h2 className="text-white text-xl font-black uppercase italic tracking-tight">Phase III: The Key Configuration</h2>
            <p className="text-emerald-100 text-[10px] font-black uppercase tracking-widest">Crucial for Database & AI Features</p>
          </div>
        </div>
        <div className="p-10">
          <div className="bg-slate-950 p-8 rounded-[2rem] text-emerald-400 space-y-8">
             <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-4">Add these variables exactly as shown in Vercel settings:</p>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Supabase URL */}
                <div className="space-y-3 bg-white/5 p-6 rounded-2xl border border-white/10">
                   <label className="text-[9px] font-black uppercase text-slate-500">Variable 1: Database URL</label>
                   <code className="block text-white font-mono text-sm mb-2">VITE_SUPABASE_URL</code>
                   <p className="text-[9px] italic text-slate-500">From Supabase Project Settings > API</p>
                </div>

                {/* Supabase Key */}
                <div className="space-y-3 bg-white/5 p-6 rounded-2xl border border-white/10">
                   <label className="text-[9px] font-black uppercase text-slate-500">Variable 2: Database Key</label>
                   <code className="block text-white font-mono text-sm mb-2">VITE_SUPABASE_ANON_KEY</code>
                   <p className="text-[9px] italic text-slate-500">The "anon public" key from Supabase</p>
                </div>

                {/* Gemini API Key */}
                <div className="md:col-span-2 space-y-3 bg-amber-400/10 p-6 rounded-2xl border border-amber-400/20">
                   <div className="flex items-center justify-between">
                      <label className="text-[9px] font-black uppercase text-amber-500">Variable 3: Gemini AI Engine (Required for Intelligence)</label>
                      <span className="text-[8px] bg-amber-400 text-amber-900 px-2 py-0.5 rounded font-black">IMPORTANT</span>
                   </div>
                   <code className="block text-amber-400 font-black font-mono text-lg mb-2">API_KEY</code>
                   <p className="text-[10px] italic text-amber-200/50">Get this from <a href="https://aistudio.google.com/app/apikey" target="_blank" className="underline">Google AI Studio</a>. This is needed for the school's smart features.</p>
                </div>
             </div>

             <div className="pt-8 border-t border-white/10 text-center">
                <p className="text-sm font-black text-white italic">After adding these, click "DEPLOY" or "REDEPLOY" on Vercel!</p>
                <p className="text-[10px] text-slate-500 uppercase mt-2">Your app will be live at: <b>https://ihis-attendance.vercel.app</b></p>
             </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DeploymentView;