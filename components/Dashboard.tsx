import React, { useState, useMemo } from 'react';
import { User, AttendanceRecord, SubstitutionRecord, UserRole } from '../types.ts';
import { TARGET_LAT, TARGET_LNG, RADIUS_METERS, LATE_THRESHOLD_HOUR, LATE_THRESHOLD_MINUTE, EDUCATIONAL_QUOTES, DAILY_WALLPAPERS } from '../constants.ts';
import { calculateDistance, getCurrentPosition } from '../utils/geoUtils.ts';

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

  // Time-based greeting logic
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good Morning";
    if (hour >= 12 && hour < 17) return "Good Afternoon";
    return "Good Evening";
  }, []);

  // Daily seed logic for consistent rotation
  const dailySeed = useMemo(() => {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }, []);

  const dailyQuote = useMemo(() => {
    return EDUCATIONAL_QUOTES[dailySeed % EDUCATIONAL_QUOTES.length];
  }, [dailySeed]);

  const dailyWallpaper = useMemo(() => {
    return DAILY_WALLPAPERS[dailySeed % DAILY_WALLPAPERS.length];
  }, [dailySeed]);

  const handleAction = async (isManual: boolean = false) => {
    if (isManual && otpInput !== currentOTP) {
      setError("Authorization Failed: Invalid OTP code. Please request a new code from the Academic Incharge.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let location = undefined;
      
      // GEO-RESTRICTION: Applies to both Check-In and Check-Out
      if (!isManual) {
        const pos = await getCurrentPosition();
        const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, TARGET_LAT, TARGET_LNG);

        if (dist > RADIUS_METERS) {
          throw new Error(`Location Restricted: You are ${Math.round(dist)}m away from campus. You must be within ${RADIUS_METERS}m for verification.`);
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
        setAttendance(prev => [newRecord, ...prev]);
        setIsManualModalOpen(false);
        setOtpInput('');
      } else if (!todayRecord.checkOut) {
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

  const regenerateOTP = () => {
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setOTP(newOtp);
  };

  return (
    <div className="relative h-full min-h-[calc(100vh-12rem)] rounded-[3rem] overflow-hidden flex flex-col">
      {/* Dynamic Background Wallpaper Layer */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-1000"
        style={{ backgroundImage: `url(${dailyWallpaper})` }}
      >
        <div className="absolute inset-0 bg-white/40 dark:bg-slate-950/70 backdrop-blur-[1px]"></div>
      </div>

      <div className="relative z-10 flex-1 space-y-8 animate-in fade-in duration-700 p-6 md:p-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-[#001f3f] dark:text-white transition-colors tracking-tight italic">
              {greeting}, {user.name}
            </h1>
            <p className="text-gray-600 dark:text-slate-400 font-bold text-sm tracking-wide transition-colors uppercase tracking-widest text-[10px]">Excellence in Education since 1989</p>
          </div>
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-5 py-2.5 rounded-2xl shadow-sm border border-amber-100 dark:border-slate-800 flex items-center space-x-3 transition-colors">
            <div className="w-2.5 h-2.5 bg-[#d4af37] rounded-full animate-pulse shadow-[0_0_8px_#d4af37]"></div>
            <span className="text-xs font-black text-[#001f3f] dark:text-slate-300 uppercase tracking-widest">{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
          </div>
        </div>

        {/* Daily Quote Hero Section */}
        <div className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-white/50 dark:border-slate-800/50 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37]/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
          <div className="max-w-4xl">
            <p className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-[0.4em] mb-4">Inspiration of the Day</p>
            <blockquote className="space-y-4">
              <p className="text-2xl md:text-3xl font-black text-[#001f3f] dark:text-white italic leading-tight">
                "{dailyQuote.text}"
              </p>
              <footer className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">— {dailyQuote.author}</footer>
            </blockquote>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-white/50 dark:border-slate-800/50 flex flex-col items-center justify-center text-center relative overflow-hidden transition-colors">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50/50 dark:bg-amber-900/5 rounded-full -mr-32 -mt-32 opacity-50"></div>
              
              <div className="z-10 w-full max-w-md space-y-8">
                <div className={`mx-auto w-28 h-28 rounded-[2rem] flex items-center justify-center shadow-lg transition-all duration-700 transform ${todayRecord?.checkOut ? 'bg-amber-100 dark:bg-amber-900/20 rotate-12' : todayRecord ? 'bg-sky-100 dark:bg-sky-900/20 animate-bounce-subtle' : 'bg-slate-100 dark:bg-slate-800'}`}>
                   <svg className={`w-14 h-14 ${todayRecord?.checkOut ? 'text-[#d4af37]' : todayRecord ? 'text-sky-600' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                   </svg>
                </div>

                <div>
                   <p className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-[0.4em] mb-2">Institutional Verification</p>
                   <h3 className="text-3xl font-black text-[#001f3f] dark:text-white uppercase tracking-tighter">
                     {todayRecord?.checkOut ? 'Shift Completed' : todayRecord ? 'Currently Active' : 'Mark Attendance'}
                   </h3>
                   {todayRecord?.isLate && (
                     <span className="inline-block mt-3 px-4 py-1.5 bg-red-100 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-200">
                       Late Arrival Recorded
                     </span>
                   )}
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-sky-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-sky-100 dark:border-slate-700 transition-colors">
                    <p className="text-[9px] text-sky-500 font-black uppercase tracking-widest mb-1">ENTRY TIME</p>
                    <p className="text-2xl font-black text-[#001f3f] dark:text-sky-400">{todayRecord?.checkIn || '--:--'}</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-amber-100 dark:border-slate-700 transition-colors">
                    <p className="text-[9px] text-amber-600 font-black uppercase tracking-widest mb-1">EXIT TIME</p>
                    <p className="text-2xl font-black text-[#d4af37] dark:text-amber-400">{todayRecord?.checkOut || '--:--'}</p>
                  </div>
                </div>

                {!todayRecord?.checkOut && (
                  <div className="space-y-4">
                    <button
                      disabled={loading}
                      onClick={() => handleAction(false)}
                      className={`w-full py-6 rounded-2xl text-white font-black text-xl shadow-xl transition-all transform hover:scale-[1.03] active:scale-[0.97] flex items-center justify-center space-x-4 ${
                        todayRecord ? 'bg-[#d4af37] hover:bg-amber-600 shadow-amber-200' : 'bg-sky-600 hover:bg-sky-700 shadow-sky-200'
                      } ${loading ? 'opacity-70 cursor-wait' : ''}`}
                    >
                      {loading ? (
                         <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                      )}
                      <span>{todayRecord ? 'GEO CHECK-OUT' : 'GEO CHECK-IN'}</span>
                    </button>

                    <button
                      disabled={loading}
                      onClick={() => setIsManualModalOpen(true)}
                      className="w-full py-4 rounded-2xl text-[#001f3f] dark:text-slate-300 font-black text-sm uppercase tracking-[0.2em] border-2 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center space-x-3"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 11v5m0 0l-3-3m3 3l3-3M8 7a4 4 0 118 0a4 4 0 01-8 0z" /></svg>
                      <span>Manual Override (Requires OTP)</span>
                    </button>
                  </div>
                )}

                {error && (
                   <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-2xl border border-red-100 dark:border-red-900/30 flex items-start space-x-3 text-left animate-in slide-in-from-top-2">
                      <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      <p className="text-xs font-bold text-red-700 dark:text-red-400 leading-relaxed">{error}</p>
                   </div>
                )}
              </div>
            </div>

            {mySubs.length > 0 && (
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl p-8 rounded-[2.5rem] border-2 border-sky-400/30 shadow-2xl animate-in slide-in-from-bottom-6 duration-700">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-sky-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-sky-900/30">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-[#001f3f] dark:text-white italic">Substitution Alerts</h4>
                    <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest">Today's Emergency Deployments</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mySubs.map(sub => (
                    <div key={sub.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex justify-between items-center group hover:border-sky-400/50 transition-all">
                      <div>
                        <p className="text-[8px] font-black text-sky-600 uppercase tracking-[0.2em] mb-1">Period {sub.slotId}</p>
                        <p className="text-sm font-black text-[#001f3f] dark:text-white">{sub.className}</p>
                        <p className="text-[10px] font-bold text-slate-400">{sub.subject}</p>
                      </div>
                      <div className="text-right">
                         <p className="text-[8px] font-black text-slate-300 uppercase">Subbing for</p>
                         <p className="text-xs font-black text-slate-500">{sub.absentTeacherName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {isManagement && (
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl p-8 rounded-[2rem] shadow-xl border-2 border-amber-400 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/10 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>
                <p className="text-[9px] font-black text-amber-500 uppercase tracking-[0.4em] mb-4">Management Tool</p>
                <h4 className="text-xl font-black text-[#001f3f] dark:text-white italic mb-4">Attendance OTP</h4>
                
                <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 mb-6">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Current Active OTP</p>
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-black text-[#d4af37] tracking-[0.3em] font-mono">{currentOTP}</span>
                    <button 
                      onClick={regenerateOTP}
                      className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-amber-500 hover:rotate-180 transition-all duration-500 shadow-sm"
                      title="Regenerate Authorization Code"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                  </div>
                </div>

                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                  Provide this code to faculty who are unable to use Geo-verification. Valid for the current session.
                </p>
              </div>
            )}

            {user.classTeacherOf && (
              <div className="bg-gradient-to-br from-[#001f3f] to-[#003366] p-7 rounded-[2rem] shadow-xl border border-[#d4af37]/20 relative overflow-hidden group">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#d4af37]/10 rounded-full group-hover:scale-125 transition-transform"></div>
                <p className="text-[10px] font-black text-[#d4af37] uppercase tracking-[0.3em] mb-4">Pastoral Leadership</p>
                <h4 className="text-xl font-black text-white italic">Class Teacher: {user.classTeacherOf}</h4>
                <p className="text-[10px] text-white/50 mt-2 font-bold uppercase tracking-widest">Access student timetable in the sidebar</p>
              </div>
            )}

            <div className="bg-[#001f3f]/90 dark:bg-slate-900/90 backdrop-blur-md text-white p-7 rounded-[2rem] shadow-xl border border-white/5 transition-colors relative overflow-hidden">
              <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-[#d4af37] rounded-full opacity-10"></div>
              <h4 className="font-black text-[10px] uppercase tracking-[0.3em] mb-6 text-amber-300">Geo-Verification</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <span className="text-[10px] font-bold text-white/50 uppercase">Latitude</span>
                  <span className="font-mono text-sm font-bold text-amber-100">{TARGET_LAT.toFixed(6)}</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <span className="text-[10px] font-bold text-white/60 uppercase">Longitude</span>
                  <span className="font-mono text-sm font-bold text-amber-100">{TARGET_LNG.toFixed(6)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/60 uppercase">Buffer Range</span>
                  <span className="text-sm font-black text-amber-400 bg-amber-400/10 px-3 py-1 rounded-lg">{RADIUS_METERS}m</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Manual Attendance OTP Modal */}
        {isManualModalOpen && (
          <div className="fixed inset-0 bg-[#001f3f]/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 border border-amber-200/20 animate-in zoom-in-95 duration-300">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-amber-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-8 h-8 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                </div>
                <h4 className="text-xl font-black text-[#001f3f] dark:text-white uppercase tracking-tight">Manual Verification</h4>
                <p className="text-xs font-bold text-slate-400 mt-2">Enter the daily authorization code provided by the Incharge</p>
              </div>
              
              <input
                type="text"
                placeholder="Enter 6-digit OTP"
                className="w-full text-center py-5 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-[#d4af37] rounded-3xl outline-none font-black text-2xl tracking-[0.3em] mb-6 dark:text-white transition-all"
                value={otpInput}
                onChange={e => setOtpInput(e.target.value)}
                maxLength={6}
              />

              <div className="flex flex-col space-y-3">
                <button 
                  onClick={() => handleAction(true)}
                  className="w-full bg-[#001f3f] text-[#d4af37] py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                >
                  Authorize Mark
                </button>
                <button 
                  onClick={() => { setIsManualModalOpen(false); setOtpInput(''); setError(null); }}
                  className="w-full py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-red-500 transition-colors"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;