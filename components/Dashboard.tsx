import React, { useState, useMemo } from 'react';
import { User, AttendanceRecord, SubstitutionRecord, UserRole } from '../types.ts';
import { TARGET_LAT, TARGET_LNG, RADIUS_METERS, LATE_THRESHOLD_HOUR, LATE_THRESHOLD_MINUTE, EDUCATIONAL_QUOTES, DAILY_WALLPAPERS } from '../constants.ts';
import { calculateDistance, getCurrentPosition } from '../utils/geoUtils.ts';
import { supabase } from '../supabaseClient.ts';

interface DashboardProps {
  user: User;
  attendance: AttendanceRecord[];
  setAttendance: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  substitutions?: SubstitutionRecord[];
  currentOTP: string;
  setOTP: (otp: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, attendance, setAttendance, substitutions = [], currentOTP, setOTP }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  
  const today = new Date().toISOString().split('T')[0];
  const todayRecord = attendance.find(r => r.userId === user.id && r.date === today);

  const mySubs = substitutions.filter(s => s.date === today && s.substituteTeacherId === user.id);
  const isManagement = user.role === UserRole.ADMIN || user.role.startsWith('INCHARGE_');

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good Morning";
    if (hour >= 12 && hour < 17) return "Good Afternoon";
    return "Good Evening";
  }, []);

  const dailySeed = useMemo(() => {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }, []);

  const dailyQuote = useMemo(() => EDUCATIONAL_QUOTES[dailySeed % EDUCATIONAL_QUOTES.length], [dailySeed]);
  const dailyWallpaper = useMemo(() => DAILY_WALLPAPERS[dailySeed % DAILY_WALLPAPERS.length], [dailySeed]);

  const handleAction = async (isManual: boolean = false) => {
    if (isManual && otpInput !== currentOTP) {
      setError("Authorization Failed: Invalid OTP code.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let location = undefined;
      
      if (!isManual) {
        const pos = await getCurrentPosition();
        const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, TARGET_LAT, TARGET_LNG);
        if (dist > RADIUS_METERS) {
          throw new Error(`Location Restricted: You are ${Math.round(dist)}m away from campus.`);
        }
        location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }

      const now = new Date();
      const time = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });

      if (!todayRecord) {
        const isLate = now.getHours() > LATE_THRESHOLD_HOUR || (now.getHours() === LATE_THRESHOLD_HOUR && now.getMinutes() > LATE_THRESHOLD_MINUTE);
        
        const newRecord: AttendanceRecord = {
          id: Date.now().toString(),
          userId: user.id,
          userName: user.name,
          date: today,
          checkIn: time,
          isManual,
          isLate,
          location
        };

        // Sync to Cloud
        if (!supabase.supabaseUrl.includes('placeholder')) {
          await supabase.from('attendance').insert({
            user_id: user.id,
            date: today,
            check_in: time,
            is_manual: isManual,
            is_late: isLate,
            location: location
          });
        }

        setAttendance(prev => [newRecord, ...prev]);
        setIsManualModalOpen(false);
        setOtpInput('');
      } else if (!todayRecord.checkOut) {
        // Sync to Cloud
        if (!supabase.supabaseUrl.includes('placeholder')) {
          await supabase.from('attendance')
            .update({ check_out: time, is_manual: todayRecord.isManual || isManual })
            .match({ user_id: user.id, date: today });
        }

        setAttendance(prev => prev.map(r => r.id === todayRecord.id ? { ...r, checkOut: time, isManual: r.isManual || isManual } : r));
        setIsManualModalOpen(false);
        setOtpInput('');
      }
    } catch (err: any) {
      setError(err.message || "Institutional Framework Error: Failed to mark attendance.");
    } finally {
      setLoading(false);
    }
  };

  const regenerateOTP = () => setOTP(Math.floor(100000 + Math.random() * 900000).toString());

  return (
    <div className="relative rounded-[2rem] overflow-hidden flex flex-col shadow-2xl border border-gray-100 dark:border-slate-800">
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-1000"
        style={{ backgroundImage: `url(${dailyWallpaper})` }}
      >
        <div className="absolute inset-0 bg-white/40 dark:bg-slate-950/70 backdrop-blur-[1px]"></div>
      </div>

      <div className="relative z-10 space-y-6 animate-in fade-in duration-700 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-[#001f3f] dark:text-white transition-colors tracking-tight italic">
              {greeting}, {user.name}
            </h1>
            <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em]">Excellence in Education since 1989</p>
          </div>
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-xl shadow-sm border border-amber-100 dark:border-slate-800 flex items-center space-x-2 transition-colors self-start">
            <div className="w-2 h-2 bg-[#d4af37] rounded-full animate-pulse"></div>
            <span className="text-[10px] font-black text-[#001f3f] dark:text-slate-300 uppercase tracking-widest">{new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          </div>
        </div>

        <div className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-white/50 dark:border-slate-800/50 relative overflow-hidden group">
          <div className="max-w-4xl">
            <p className="text-[8px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-[0.4em] mb-3">Inspiration of the Day</p>
            <blockquote className="space-y-2">
              <p className="text-lg md:text-xl font-black text-[#001f3f] dark:text-white italic leading-tight">
                "{dailyQuote.text}"
              </p>
              <footer className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">— {dailyQuote.author}</footer>
            </blockquote>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl p-6 md:p-10 rounded-[2rem] border border-white/50 dark:border-slate-800/50 flex flex-col items-center justify-center text-center relative overflow-hidden">
              <div className="z-10 w-full max-w-sm space-y-6">
                <div className={`mx-auto w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg transition-all duration-700 transform ${todayRecord?.checkOut ? 'bg-amber-100 dark:bg-amber-900/20 rotate-12' : todayRecord ? 'bg-sky-100 dark:bg-sky-900/20 animate-bounce-subtle' : 'bg-slate-100 dark:bg-slate-800'}`}>
                   <svg className={`w-10 h-10 ${todayRecord?.checkOut ? 'text-[#d4af37]' : todayRecord ? 'text-sky-600' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                   </svg>
                </div>

                <div>
                   <p className="text-[8px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-[0.4em] mb-1.5">Institutional Verification</p>
                   <h3 className="text-2xl font-black text-[#001f3f] dark:text-white uppercase tracking-tighter">
                     {todayRecord?.checkOut ? 'Shift Completed' : todayRecord ? 'Currently Active' : 'Mark Attendance'}
                   </h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-sky-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-sky-100 dark:border-slate-700">
                    <p className="text-[8px] text-sky-500 font-black uppercase tracking-widest mb-1">ENTRY</p>
                    <p className="text-xl font-black text-[#001f3f] dark:text-sky-400">{todayRecord?.checkIn || '--:--'}</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-amber-100 dark:border-slate-700">
                    <p className="text-[8px] text-amber-600 font-black uppercase tracking-widest mb-1">EXIT</p>
                    <p className="text-xl font-black text-[#d4af37] dark:text-amber-400">{todayRecord?.checkOut || '--:--'}</p>
                  </div>
                </div>

                {!todayRecord?.checkOut && (
                  <div className="space-y-3">
                    <button
                      disabled={loading}
                      onClick={() => handleAction(false)}
                      className={`w-full py-5 rounded-2xl text-white font-black text-lg shadow-xl transition-all transform active:scale-95 flex items-center justify-center space-x-3 ${
                        todayRecord ? 'bg-[#d4af37] hover:bg-amber-600 shadow-amber-200' : 'bg-sky-600 hover:bg-sky-700 shadow-sky-200'
                      }`}
                    >
                      <span>{todayRecord ? 'GEO CHECK-OUT' : 'GEO CHECK-IN'}</span>
                    </button>

                    <button
                      disabled={loading}
                      onClick={() => setIsManualModalOpen(true)}
                      className="w-full py-3.5 rounded-2xl text-[#001f3f] dark:text-slate-300 font-black text-xs uppercase tracking-widest border-2 border-slate-200 dark:border-slate-800 hover:bg-slate-50 transition-all flex items-center justify-center space-x-2"
                    >
                      <span>Manual Override</span>
                    </button>
                  </div>
                )}
                
                {error && <p className="text-[10px] font-black text-red-500 uppercase animate-bounce">{error}</p>}
              </div>
            </div>

            {mySubs.length > 0 && (
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl p-6 rounded-[2rem] border-2 border-sky-400/30 shadow-2xl">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                  </div>
                  <div><h4 className="text-md font-black text-[#001f3f] dark:text-white italic">Substitution Alerts</h4></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {mySubs.map(sub => (
                    <div key={sub.id} className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                      <div>
                        <p className="text-[7px] font-black text-sky-600 uppercase tracking-widest">Period {sub.slotId}</p>
                        <p className="text-xs font-black text-[#001f3f] dark:text-white">{sub.className}</p>
                      </div>
                      <div className="text-right">
                         <p className="text-[7px] font-black text-slate-300 uppercase">Subbing for</p>
                         <p className="text-[10px] font-black text-slate-500">{sub.absentTeacherName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {isManagement && (
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl p-6 rounded-[2rem] shadow-xl border-2 border-amber-400">
                <p className="text-[8px] font-black text-amber-500 uppercase tracking-[0.4em] mb-3">Management Tool</p>
                <h4 className="text-lg font-black text-[#001f3f] dark:text-white italic mb-3">Attendance OTP</h4>
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 mb-4 flex items-center justify-between">
                  <span className="text-2xl font-black text-[#d4af37] tracking-[0.2em] font-mono">{currentOTP}</span>
                  <button onClick={regenerateOTP} className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 text-amber-500 hover:rotate-180 transition-all duration-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </button>
                </div>
              </div>
            )}

            <div className="bg-[#001f3f]/90 dark:bg-slate-900/90 backdrop-blur-md text-white p-6 rounded-[2rem] shadow-xl border border-white/5 relative overflow-hidden">
              <h4 className="font-black text-[8px] uppercase tracking-[0.3em] mb-4 text-amber-300">Geo-Verification</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2"><span className="text-[8px] font-bold text-white/50 uppercase">Lat</span><span className="font-mono text-xs font-bold text-amber-100">{TARGET_LAT.toFixed(4)}</span></div>
                <div className="flex items-center justify-between border-b border-white/10 pb-2"><span className="text-[8px] font-bold text-white/60 uppercase">Lng</span><span className="font-mono text-xs font-bold text-amber-100">{TARGET_LNG.toFixed(4)}</span></div>
                <div className="flex items-center justify-between"><span className="text-[8px] font-bold text-white/60 uppercase">Buffer</span><span className="text-xs font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-lg">{RADIUS_METERS}m</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isManualModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-[#001f3f]/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl border border-amber-200/20 space-y-8">
             <div className="text-center">
                <div className="w-16 h-16 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-amber-100">
                   <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <h4 className="text-xl font-black text-[#001f3f] dark:text-white uppercase tracking-tight italic">Authorization Required</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Enter the daily security OTP provided by management.</p>
             </div>
             <div className="space-y-4">
                <input 
                  type="text" 
                  maxLength={6} 
                  placeholder="------" 
                  value={otpInput} 
                  onChange={e => setOtpInput(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-5 text-center text-3xl font-black tracking-[0.5em] focus:ring-2 focus:ring-amber-400 transition-all dark:text-white"
                />
                <button 
                  onClick={() => handleAction(true)} 
                  disabled={otpInput.length < 4 || loading}
                  className="w-full bg-[#001f3f] text-[#d4af37] py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] shadow-xl hover:bg-slate-900 transition-all"
                >
                  {loading ? 'Authorizing...' : 'Validate & Mark'}
                </button>
                <button onClick={() => setIsManualModalOpen(false)} className="w-full text-slate-400 font-black text-[9px] uppercase tracking-widest hover:text-red-500">Cancel</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;