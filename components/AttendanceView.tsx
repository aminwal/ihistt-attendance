import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { User, AttendanceRecord, UserRole } from '../types.ts';

interface AttendanceViewProps {
  user: User;
  attendance: AttendanceRecord[];
  setAttendance: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  users: User[];
}

const AttendanceView: React.FC<AttendanceViewProps> = ({ user, attendance, setAttendance, users }) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT'>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showManualModal, setShowManualModal] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [manualEntry, setManualEntry] = useState({
    id: '',
    userId: '',
    date: new Date().toISOString().split('T')[0],
    checkIn: '07:20',
    checkOut: ''
  });

  const isAdmin = user.role === UserRole.ADMIN;
  const isManagement = isAdmin || user.role.startsWith('INCHARGE_');
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (statusMsg) {
      const timer = setTimeout(() => setStatusMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [statusMsg]);

  // Unified formatting for role display
  const formatRoleName = (role: string) => role.replace(/_/g, ' ').toUpperCase();

  const fuzzyMatch = (query: string, target: string) => {
    if (!query) return true;
    const q = query.toLowerCase().trim();
    const t = target.toLowerCase().trim();
    return t.includes(q);
  };

  const unifiedHistory = useMemo(() => {
    let targetUsers = users.filter(u => {
      if (isAdmin) return true;
      if (u.role === UserRole.ADMIN) return false;
      if (user.role === UserRole.INCHARGE_PRIMARY) {
        return u.role === UserRole.TEACHER_PRIMARY || u.role === UserRole.INCHARGE_PRIMARY || u.id === user.id;
      }
      if (user.role === UserRole.INCHARGE_SECONDARY) {
        const isSec = u.role === UserRole.TEACHER_SECONDARY || u.role === UserRole.TEACHER_SENIOR_SECONDARY || u.role === UserRole.INCHARGE_SECONDARY;
        return isSec || u.id === user.id;
      }
      return u.id === user.id;
    });

    targetUsers = targetUsers.filter(u => {
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchesSearch = fuzzyMatch(search, u.name) || fuzzyMatch(search, u.employeeId) || fuzzyMatch(search, formatRoleName(u.role));
      return matchesRole && matchesSearch;
    });

    const records = targetUsers.map(u => {
      const record = attendance.find(r => r.userId === u.id && r.date === selectedDate);
      return {
        user: u,
        record: record,
        isPresent: !!record,
        statusLabel: record ? 'PRESENT' : 'ABSENT'
      };
    });

    return records.filter(item => {
      if (statusFilter === 'PRESENT') return item.isPresent;
      if (statusFilter === 'ABSENT') return !item.isPresent;
      return true;
    }).sort((a, b) => a.user.name.localeCompare(b.user.name));
  }, [users, attendance, selectedDate, roleFilter, search, user, isAdmin, statusFilter]);

  // --- REFACTORED PURGE SYSTEM FOR HIGH RELIABILITY ---
  
  const handleGlobalPurgeManual = useCallback(() => {
    const manualRecords = attendance.filter(r => r.isManual === true);
    if (manualRecords.length === 0) {
      setStatusMsg({ type: 'error', text: 'Institutional Audit: No manual records identified.' });
      return;
    }

    if (window.confirm(`CRITICAL SECURITY ACTION: Permanently purge ALL ${manualRecords.length} manual records from the institutional database?`)) {
      setAttendance(current => {
        const filtered = current.filter(r => r.isManual !== true);
        return [...filtered]; // Force fresh array reference
      });
      setStatusMsg({ type: 'success', text: `System Synced: ${manualRecords.length} manual records purged.` });
    }
  }, [attendance, setAttendance]);

  const handleDatePurgeManual = useCallback(() => {
    const manualForDate = attendance.filter(r => r.isManual === true && r.date === selectedDate);
    if (manualForDate.length === 0) {
      setStatusMsg({ type: 'error', text: `Audit Notice: No manual logs found for date: ${selectedDate}.` });
      return;
    }

    if (window.confirm(`AUTHORIZATION REQUIRED: Permanently delete all ${manualForDate.length} manual entries for ${selectedDate}?`)) {
      setAttendance(current => {
        const filtered = current.filter(r => !(r.isManual === true && r.date === selectedDate));
        return [...filtered];
      });
      setStatusMsg({ type: 'success', text: `Ledger Updated: Purged manual entries for ${selectedDate}.` });
    }
  }, [attendance, selectedDate, setAttendance]);

  const handleSinglePurge = useCallback((id: string, name: string) => {
    if (window.confirm(`SECURITY VERIFICATION: Permanently remove the attendance record for ${name}?`)) {
      setAttendance(current => {
        const filtered = current.filter(r => r.id !== id);
        return [...filtered];
      });
      setStatusMsg({ type: 'success', text: `Log for ${name} has been successfully purged.` });
    }
  }, [setAttendance]);

  // --- MANUAL ENTRY SYSTEM ---

  const markTeacherPresent = (u: User) => {
    const isToday = selectedDate === todayStr;
    const now = new Date();
    const time = isToday ? now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' }) : "07:20 AM";
    const newRecord: AttendanceRecord = {
      id: `man-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      userId: u.id,
      userName: u.name,
      date: selectedDate,
      checkIn: time,
      isManual: true,
      isLate: false
    };
    setAttendance(prev => [newRecord, ...prev]);
    setStatusMsg({ type: 'success', text: `Authorized presence for ${u.name}.` });
  };

  const handleEdit = (r: AttendanceRecord) => {
    setManualEntry({
      id: r.id,
      userId: r.userId,
      date: r.date,
      checkIn: r.checkIn,
      checkOut: r.checkOut || ''
    });
    setShowManualModal(true);
  };

  const saveManualEntry = () => {
    const u = users.find(x => x.id === manualEntry.userId);
    if (!u || !manualEntry.date || !manualEntry.checkIn) {
      alert("Validation Error: Missing mandatory personnel data.");
      return;
    }
    if (manualEntry.id) {
      setAttendance(prev => prev.map(r => r.id === manualEntry.id ? {
        ...r,
        userId: u.id,
        userName: u.name,
        date: manualEntry.date,
        checkIn: manualEntry.checkIn,
        checkOut: manualEntry.checkOut || undefined,
        isManual: true
      } : r));
      setStatusMsg({ type: 'success', text: 'Identity log updated.' });
    } else {
      const newRecord: AttendanceRecord = {
        id: `man-${Date.now()}`,
        userId: u.id,
        userName: u.name,
        date: manualEntry.date,
        checkIn: manualEntry.checkIn,
        checkOut: manualEntry.checkOut || undefined,
        isManual: true,
        isLate: false
      };
      setAttendance(prev => [newRecord, ...prev]);
      setStatusMsg({ type: 'success', text: 'Manual entry recorded in ledger.' });
    }
    setShowManualModal(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-3xl font-black text-[#001f3f] dark:text-white tracking-tight italic">Attendance Ledger</h1>
            <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">{isManagement ? 'Institutional Repository' : 'Your Professional History'}</p>
          </div>
          {statusMsg && (
            <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] animate-in slide-in-from-left-4 shadow-md border ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
              {statusMsg.text}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isManagement && (
            <div className="flex items-center space-x-2">
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); handleGlobalPurgeManual(); }}
                className="px-4 py-2.5 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-xl text-[10px] font-black uppercase shadow-sm hover:bg-red-600 hover:text-white transition-all active:scale-95 border border-red-200 dark:border-red-900/30 cursor-pointer"
              >
                Purge All Manual
              </button>
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDatePurgeManual(); }}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase shadow-sm hover:bg-red-50 hover:text-red-600 transition-all active:scale-95 border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                Purge Date Manual
              </button>
              <button 
                type="button"
                onClick={() => { setManualEntry({ id: '', userId: '', date: todayStr, checkIn: '07:20', checkOut: '' }); setShowManualModal(true); }} 
                className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-emerald-700 transition-all flex items-center space-x-2 border border-emerald-500/20 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                <span>Manual Entry</span>
              </button>
            </div>
          )}
          <div className="bg-white dark:bg-slate-900 p-1 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 flex">
            <button onClick={() => setViewMode('table')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'table' ? 'bg-[#001f3f] text-[#d4af37] shadow-lg' : 'text-gray-400'}`}>Table</button>
            <button onClick={() => setViewMode('calendar')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'calendar' ? 'bg-[#001f3f] text-[#d4af37] shadow-lg' : 'text-gray-400'}`}>Calendar</button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-slate-800 overflow-hidden min-h-[500px] transition-colors relative">
        {viewMode === 'table' ? (
          <div className="animate-in fade-in slide-in-from-top-4">
            <div className="p-8 border-b border-gray-100 dark:border-slate-800 flex flex-col xl:flex-row items-center justify-between gap-6 bg-slate-50/50 dark:bg-slate-800/20 no-print">
              <div className="relative w-full max-w-md">
                 <input type="text" placeholder="Search by name, ID..." className="w-full px-12 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold shadow-sm outline-none dark:text-white" value={search} onChange={e => setSearch(e.target.value)} />
                 <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex bg-white dark:bg-slate-950 p-1 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                   {(['ALL', 'PRESENT', 'ABSENT'] as const).map(status => (
                     <button key={status} onClick={() => setStatusFilter(status)} className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${statusFilter === status ? 'bg-[#001f3f] text-[#d4af37] shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                       {status}
                     </button>
                   ))}
                </div>

                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[9px] font-black uppercase outline-none shadow-sm dark:text-white min-w-[140px]">
                  <option value="ALL">All Roles</option>
                  {Object.values(UserRole).map(role => <option key={role} value={role}>{formatRoleName(role)}</option>)}
                </select>

                <div className="flex items-center gap-4 bg-white dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date Focus:</span>
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent text-sm font-black text-[#001f3f] dark:text-white outline-none cursor-pointer" />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] bg-slate-50/50 dark:bg-slate-800/50">
                    <th className="px-10 py-6">Faculty Profile</th>
                    <th className="px-10 py-6">Employee ID</th>
                    <th className="px-10 py-6 text-center">Status</th>
                    <th className="px-10 py-6 text-center">Check-In</th>
                    <th className="px-10 py-6 text-center">Check-Out</th>
                    <th className="px-10 py-6 text-center">Method</th>
                    {isManagement && <th className="px-10 py-6 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {unifiedHistory.map(item => (
                    <tr key={item.user.id} className={`transition-colors group ${item.isPresent ? 'hover:bg-amber-50/10' : 'bg-red-50/5 hover:bg-red-50/10'}`}>
                      <td className="px-10 py-8">
                        <div className="flex items-center space-x-5">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] shadow-sm ${item.isPresent ? 'bg-[#001f3f] text-[#d4af37]' : 'bg-red-100 text-red-400'}`}>
                            {item.user.name.substring(0,2)}
                          </div>
                          <div>
                            <p className="font-black text-sm text-[#001f3f] dark:text-white">{item.user.name}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{formatRoleName(item.user.role)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-8">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                           {item.user.employeeId}
                         </span>
                      </td>
                      <td className="px-10 py-8 text-center">
                        <span className={`text-[8px] font-black px-3 py-1 rounded-lg border ${item.isPresent ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                          {item.statusLabel}
                        </span>
                      </td>
                      <td className="px-10 py-8 text-center">
                        {item.record ? (
                          <span className={`text-xs font-black ${item.record.isLate ? 'text-red-500' : 'text-emerald-600'}`}>{item.record.checkIn}</span>
                        ) : (
                          <span className="text-xs font-black text-slate-300">--:--</span>
                        )}
                      </td>
                      <td className="px-10 py-8 text-center">
                        {item.record?.checkOut ? (
                          <span className="text-xs font-black text-[#d4af37]">{item.record.checkOut}</span>
                        ) : (
                          <span className="text-xs font-black text-slate-300">--:--</span>
                        )}
                      </td>
                      <td className="px-10 py-8 text-center">
                        {item.record ? (
                          <span className={`text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${item.record.isManual ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-slate-100 dark:bg-slate-800 dark:text-slate-500'}`}>
                            {item.record.isManual ? 'MANUAL' : 'GEO-TAG'}
                          </span>
                        ) : (
                          <span className="text-[8px] font-black text-slate-300">VOID</span>
                        )}
                      </td>
                      {isManagement && (
                        <td className="px-10 py-8 text-right">
                           <div className="flex items-center justify-end space-x-6">
                             {item.record ? (
                               <>
                                 <button 
                                   type="button"
                                   onClick={(e) => { e.stopPropagation(); handleEdit(item.record!); }} 
                                   className="text-sky-600 text-[10px] font-black uppercase tracking-widest hover:text-sky-800 hover:scale-105 transition-all cursor-pointer"
                                 >
                                   Edit
                                 </button>
                                 <button 
                                   type="button"
                                   onClick={(e) => { e.stopPropagation(); handleSinglePurge(item.record!.id, item.record!.userName); }} 
                                   className="text-red-500 text-[10px] font-black uppercase tracking-widest hover:text-red-700 hover:scale-105 transition-all cursor-pointer"
                                 >
                                   Purge
                                 </button>
                               </>
                             ) : (
                               <button 
                                 type="button"
                                 onClick={(e) => { e.stopPropagation(); markTeacherPresent(item.user); }} 
                                 className="text-emerald-600 text-[10px] font-black uppercase tracking-widest hover:text-emerald-800 hover:scale-105 transition-all cursor-pointer"
                               >
                                 Authorize
                               </button>
                             )}
                           </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {unifiedHistory.length === 0 && (
                    <tr>
                      <td colSpan={isManagement ? 7 : 6} className="py-32 text-center text-slate-300 dark:text-slate-700 uppercase font-black tracking-[0.5em] italic">No matching records identified for the selected criteria</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-10 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-6 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-2 text-amber-600 hover:bg-amber-50 rounded-xl transition-all font-black text-xs uppercase">Prev</button>
              <h2 className="text-sm font-black text-[#001f3f] dark:text-white uppercase tracking-widest">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-2 text-amber-600 hover:bg-amber-50 rounded-xl transition-all font-black text-xs uppercase">Next</button>
            </div>
            <div className="grid grid-cols-7 gap-2">
               {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} className="text-center text-[9px] font-black uppercase text-gray-400 py-2 tracking-widest">{day}</div>)}
               <div className="col-span-full py-20 text-center text-slate-300 font-black uppercase tracking-widest">Historical Matrix Initializing...</div>
            </div>
          </div>
        )}
      </div>

      {showManualModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-[#001f3f]/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] p-10 shadow-2xl border border-emerald-200/20 space-y-8 overflow-y-auto max-h-[90vh]">
             <div className="text-center">
                <h4 className="text-2xl font-black text-[#001f3f] dark:text-white uppercase tracking-tight italic">{manualEntry.id ? 'Modify Identity Log' : 'Institutional Manual Entry'}</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Target Date: {manualEntry.date}</p>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-2">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Faculty Member</label>
                   <select className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-400 rounded-2xl outline-none dark:text-white font-bold text-sm" value={manualEntry.userId} onChange={e => setManualEntry({...manualEntry, userId: e.target.value})} disabled={!!manualEntry.id}>
                     <option value="">Choose Personnel...</option>
                     {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.employeeId})</option>)}
                   </select>
                </div>
                <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</label><input type="date" className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none font-bold text-sm dark:text-white" value={manualEntry.date} onChange={e => setManualEntry({...manualEntry, date: e.target.value})} /></div>
                <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Check-In</label><input type="time" className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none font-bold text-sm dark:text-white" value={manualEntry.checkIn} onChange={e => setManualEntry({...manualEntry, checkIn: e.target.value})} /></div>
                <div className="space-y-2 md:col-span-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Check-Out (Optional)</label><input type="time" className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none font-bold text-sm dark:text-white" value={manualEntry.checkOut} onChange={e => setManualEntry({...manualEntry, checkOut: e.target.value})} /></div>
             </div>
             <div className="flex flex-col space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button onClick={saveManualEntry} disabled={!manualEntry.userId} className="w-full bg-[#001f3f] text-[#d4af37] py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] shadow-lg active:scale-95 transition-all">Commit Identity Log</button>
                <button onClick={() => setShowManualModal(false)} className="w-full py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-red-500 transition-colors">Discard Request</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceView;