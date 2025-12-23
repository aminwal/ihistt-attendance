import React, { useState, useMemo, useEffect } from 'react';
import { User, UserRole, AttendanceRecord, TimeTableEntry, SubstitutionRecord, SectionType } from '../types.ts';
import { DAYS, PRIMARY_SLOTS, SECONDARY_GIRLS_SLOTS, SECONDARY_BOYS_SLOTS, SCHOOL_NAME, LATE_THRESHOLD_HOUR, LATE_THRESHOLD_MINUTE } from '../constants.ts';

// Declare html2pdf for TypeScript
declare var html2pdf: any;

interface SubstitutionViewProps {
  user: User;
  users: User[];
  attendance: AttendanceRecord[];
  timetable: TimeTableEntry[];
  substitutions: SubstitutionRecord[];
  setSubstitutions: React.Dispatch<React.SetStateAction<SubstitutionRecord[]>>;
}

interface SubFormData {
  id?: string;
  slotId: number;
  className: string;
  subject: string;
  absentTeacherId: string;
  substituteTeacherId: string;
  section: SectionType;
}

const SubstitutionView: React.FC<SubstitutionViewProps> = ({ user, users, attendance, timetable, substitutions, setSubstitutions }) => {
  const [activeSection, setActiveSection] = useState<SectionType>('PRIMARY');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [formData, setFormData] = useState<SubFormData>({
    slotId: 1,
    className: '',
    subject: '',
    absentTeacherId: '',
    substituteTeacherId: '',
    section: 'PRIMARY'
  });
  
  const todayDate = new Date().toISOString().split('T')[0];
  const viewDayName = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' });
  
  const isManagement = user.role === UserRole.ADMIN || user.role.startsWith('INCHARGE_');

  // Auto-clear status notifications
  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const dateFilteredSubs = useMemo(() => {
    return substitutions.filter(s => s.date === selectedDate);
  }, [substitutions, selectedDate]);

  const presentUserIdsForDate = useMemo(() => {
    return attendance.filter(a => a.date === selectedDate).map(a => a.userId);
  }, [attendance, selectedDate]);

  const handleDownloadPDF = async () => {
    const element = document.getElementById('substitution-ledger-printable');
    if (!element) return;

    setStatus({ type: 'success', message: 'Generating Official Substitution Ledger PDF...' });

    const opt = {
      margin: [10, 10, 10, 10],
      filename: `Substitution_Ledger_${activeSection}_${selectedDate}.pdf`,
      image: { type: 'jpeg', quality: 1.0 },
      html2canvas: { 
        scale: 3, 
        useCORS: true,
        letterRendering: true,
        backgroundColor: '#ffffff'
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'landscape',
        precision: 16
      }
    };

    try {
      await html2pdf().set(opt).from(element).save();
      setStatus({ type: 'success', message: 'PDF Downloaded Successfully.' });
    } catch (err) {
      console.error("PDF Export failed", err);
      setStatus({ type: 'error', message: 'PDF Generation failed. Using system print fallback.' });
      window.print();
    }
  };

  const purgeStaleSubstitutions = (showStatus = true) => {
    const currentPresentIds = attendance.filter(a => a.date === selectedDate).map(a => a.userId);
    const cleaned = substitutions.filter(s => {
      if (s.date !== selectedDate) return true;
      return !currentPresentIds.includes(s.absentTeacherId);
    });

    const purgedCount = substitutions.length - cleaned.length;
    if (purgedCount > 0) {
      setSubstitutions(cleaned);
      if (showStatus) {
        setStatus({ type: 'success', message: `${purgedCount} obsolete records purged from ledger.` });
      }
    } else if (showStatus) {
      setStatus({ type: 'error', message: "No stale records found." });
    }
    return cleaned;
  };

  const generateSubstitutions = () => {
    if (selectedDate !== todayDate) {
      if (!window.confirm("Generating for an archived date. Proceed?")) return;
    }

    setIsGenerating(true);
    const cleanedSubstitutions = purgeStaleSubstitutions(false);
    const purgedCount = substitutions.length - cleanedSubstitutions.length;
    const currentDaySubsAfterPurge = cleanedSubstitutions.filter(s => s.date === selectedDate);
    const newSubs: SubstitutionRecord[] = [];
    
    const currentPresentIds = attendance.filter(a => a.date === selectedDate).map(a => a.userId);
    const activeAbsentTeachers = users.filter(u => 
      u.role.startsWith('TEACHER_') && 
      !currentPresentIds.includes(u.id)
    );

    activeAbsentTeachers.forEach(absentTeacher => {
      const dutiesToSubstitute = timetable.filter(t => t.teacherId === absentTeacher.id && t.day === viewDayName);
      
      dutiesToSubstitute.forEach(duty => {
        if (currentDaySubsAfterPurge.some(s => s.absentTeacherId === absentTeacher.id && s.slotId === duty.slotId && s.className === duty.className)) return;

        const potentialSubs = users.filter(pSub => {
          if (!currentPresentIds.includes(pSub.id)) return false;
          const isPrimaryTeacher = pSub.role === UserRole.TEACHER_PRIMARY || pSub.role === UserRole.INCHARGE_PRIMARY;
          const isSecondaryTeacher = pSub.role === UserRole.TEACHER_SECONDARY || 
                                     pSub.role === UserRole.TEACHER_SENIOR_SECONDARY || 
                                     pSub.role === UserRole.INCHARGE_SECONDARY;
          
          if (duty.section === 'PRIMARY' && !isPrimaryTeacher) return false;
          if ((duty.section === 'SECONDARY_BOYS' || duty.section === 'SECONDARY_GIRLS') && !isSecondaryTeacher) return false;

          const hasRegularClass = timetable.some(t => t.teacherId === pSub.id && t.day === viewDayName && t.slotId === duty.slotId);
          if (hasRegularClass) return false;

          const isAlreadySubbing = newSubs.some(ns => ns.substituteTeacherId === pSub.id && ns.slotId === duty.slotId) ||
                                   currentDaySubsAfterPurge.some(es => es.substituteTeacherId === pSub.id && es.slotId === duty.slotId);
          if (isAlreadySubbing) return false;

          return true;
        });

        if (potentialSubs.length > 0) {
          const selectedSub = potentialSubs[Math.floor(Math.random() * potentialSubs.length)];
          newSubs.push({
            id: `auto-${Date.now()}-${duty.id}-${Math.random().toString(36).substr(2, 5)}`,
            date: selectedDate, 
            slotId: duty.slotId, 
            className: duty.className,
            subject: duty.subject, 
            absentTeacherId: absentTeacher.id, 
            absentTeacherName: absentTeacher.name,
            substituteTeacherId: selectedSub.id, 
            substituteTeacherName: selectedSub.name, 
            section: duty.section
          });
        }
      });
    });

    setSubstitutions([...cleanedSubstitutions, ...newSubs]);
    setStatus({ 
      type: 'success', 
      message: `Sync Complete: ${newSubs.length} gaps filled, ${purgedCount} stale records removed.` 
    });
    setIsGenerating(false);
  };

  const handleAddManual = () => {
    setFormData({
      slotId: 1,
      className: '',
      subject: '',
      absentTeacherId: '',
      substituteTeacherId: '',
      section: activeSection
    });
    setIsModalOpen(true);
  };

  const handleEdit = (sub: SubstitutionRecord) => {
    setFormData({
      id: sub.id,
      slotId: sub.slotId,
      className: sub.className,
      subject: sub.subject,
      absentTeacherId: sub.absentTeacherId,
      substituteTeacherId: sub.substituteTeacherId,
      section: sub.section
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Confirm removal of this duty assignment?")) {
      setSubstitutions(prev => prev.filter(s => s.id !== id));
      setStatus({ type: 'success', message: 'Duty purged successfully.' });
    }
  };

  const saveSubstitution = () => {
    const absentT = users.find(u => u.id === formData.absentTeacherId);
    const subT = users.find(u => u.id === formData.substituteTeacherId);

    if (!absentT || !subT || !formData.className || !formData.subject) {
      setStatus({ type: 'error', message: "Incomplete Data." });
      return;
    }

    const subRecord: SubstitutionRecord = {
      id: formData.id || `manual-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      date: selectedDate,
      slotId: formData.slotId,
      className: formData.className,
      subject: formData.subject,
      absentTeacherId: absentT.id,
      absentTeacherName: absentT.name,
      substituteTeacherId: subT.id,
      substituteTeacherName: subT.name,
      section: formData.section
    };

    if (formData.id) {
      setSubstitutions(prev => prev.map(s => s.id === formData.id ? subRecord : s));
      setStatus({ type: 'success', message: 'Substitution updated.' });
    } else {
      setSubstitutions(prev => [...prev, subRecord]);
      setStatus({ type: 'success', message: 'Manual duty assigned.' });
    }
    setIsModalOpen(false);
  };

  const filteredSubs = useMemo(() => {
    if (isManagement) {
      return dateFilteredSubs.filter(s => {
        if (activeSection === 'PRIMARY') return s.section === 'PRIMARY';
        return s.section === 'SECONDARY_BOYS' || s.section === 'SECONDARY_GIRLS';
      });
    }
    return dateFilteredSubs.filter(s => s.substituteTeacherId === user.id);
  }, [dateFilteredSubs, isManagement, activeSection, user]);

  const slots = activeSection === 'PRIMARY' ? PRIMARY_SLOTS : activeSection === 'SECONDARY_GIRLS' ? SECONDARY_GIRLS_SLOTS : SECONDARY_BOYS_SLOTS;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <style>{`
        @media print {
          #substitution-ledger-printable { border: none !important; box-shadow: none !important; width: 100% !important; background: white !important; }
        }
      `}</style>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 no-print">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-black text-[#001f3f] dark:text-white tracking-tight italic">Substitution Ledger</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{isManagement ? 'Institutional Deployment History' : 'Your Assigned Duties'}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Archive Date:</span>
             <input 
               type="date" 
               className="bg-transparent text-sm font-black text-[#001f3f] dark:text-white outline-none cursor-pointer"
               value={selectedDate}
               onChange={(e) => setSelectedDate(e.target.value)}
             />
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {status && (
            <div className={`px-4 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-right-2 ${status.type === 'error' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
              {status.message}
            </div>
          )}
          <div className="flex gap-2">
            {isManagement && (
              <>
                <button 
                  onClick={() => purgeStaleSubstitutions(true)}
                  className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-red-50 hover:text-red-600 border border-slate-200 dark:border-slate-700 active:scale-95"
                >
                  Purge Stale
                </button>
                <button 
                  onClick={generateSubstitutions} 
                  disabled={isGenerating}
                  className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md bg-[#001f3f] text-[#d4af37] hover:bg-slate-900 active:scale-95 disabled:opacity-50`}
                >
                  {isGenerating ? 'Analyzing...' : 'Auto-Fill Gaps'}
                </button>
                <button 
                  onClick={handleAddManual}
                  className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-emerald-700 active:scale-95 flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                  <span>Assign Manual</span>
                </button>
              </>
            )}
            <button 
              onClick={handleDownloadPDF}
              className="bg-sky-50 dark:bg-slate-800 text-sky-600 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center space-x-2 border border-sky-100 dark:border-sky-900 shadow-sm hover:bg-sky-100 transition-all active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              <span>Export PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Ledger Content - Target for PDF Export and Screen View */}
      <div id="substitution-ledger-printable" className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-slate-800 overflow-hidden print:shadow-none print:border-none print:rounded-none printable-area">
        
        {/* INSTITUTIONAL HEADER - Visible on Page and in PDF/Print */}
        <div className="mb-8 text-center border-b-[3px] border-[#001f3f] pb-10 pt-10 px-8 bg-white dark:bg-slate-900">
          <h1 className="text-[28px] md:text-[32px] font-black uppercase tracking-[0.25em] text-[#001f3f] dark:text-white mb-3 leading-tight">
            {SCHOOL_NAME}
          </h1>
          <h2 className="text-[18px] md:text-[22px] font-black italic text-[#d4af37] mb-8 uppercase tracking-widest">
            Emergency Substitution Ledger
          </h2>
          <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-12 text-[12px] md:text-[14px] font-black text-[#001f3f] dark:text-slate-200 uppercase tracking-wider">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400">DATE:</span>
              <span className="bg-slate-50 dark:bg-slate-800 px-4 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700">{selectedDate}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-slate-400">SECTION:</span>
              <span className="bg-slate-50 dark:bg-slate-800 px-4 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700">{activeSection.replace('_', ' ')}</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs - Hidden in Print */}
        {isManagement && (
          <div className="p-8 border-b border-gray-100 dark:border-slate-800 flex justify-center no-print bg-slate-50/30 dark:bg-slate-800/20">
            <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
              {(['PRIMARY', 'SECONDARY_BOYS', 'SECONDARY_GIRLS'] as SectionType[]).map(s => (
                <button key={s} onClick={() => setActiveSection(s)} className={`px-6 md:px-10 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeSection === s ? 'bg-[#001f3f] text-[#d4af37] shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-left border-collapse print:border-t-2 print:border-black">
            <thead>
              <tr className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/50 print:bg-slate-100 print:text-black">
                <th className="px-6 md:px-10 py-6 print:px-5 print:py-5 border-b dark:border-slate-800 print:border-black print:border-r">Period</th>
                <th className="px-6 md:px-10 py-6 print:px-5 print:py-5 border-b dark:border-slate-800 print:border-black print:border-r">Class / Subject</th>
                <th className="px-6 md:px-10 py-6 print:px-5 print:py-5 border-b dark:border-slate-800 print:border-black print:border-r">Absent Faculty</th>
                <th className="px-6 md:px-10 py-6 print:px-5 print:py-5 border-b dark:border-slate-800 print:border-black">Substitute Assigned</th>
                {isManagement && <th className="px-6 md:px-10 py-6 text-right no-print border-b dark:border-slate-800">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800 print:divide-black">
              {filteredSubs.map(s => (
                <tr key={s.id} className="hover:bg-amber-50/10 transition-all print:bg-white">
                  <td className="px-6 md:px-10 py-8 print:px-5 print:py-5 print:border-r print:border-black">
                    <span className="font-black text-xs print:text-[12px] bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg print:bg-transparent print:px-0">P{s.slotId}</span>
                  </td>
                  <td className="px-6 md:px-10 py-8 print:px-5 print:py-5 print:border-r print:border-black">
                    <div>
                      <p className="font-black text-[#001f3f] dark:text-slate-100 text-sm print:text-black print:text-[12px]">{s.className}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase print:text-[10px] print:text-black mt-1 tracking-tight">{s.subject}</p>
                    </div>
                  </td>
                  <td className="px-6 md:px-10 py-8 print:px-5 print:py-5 print:border-r print:border-black">
                    <span className="text-xs font-bold text-red-600 print:text-black print:text-[12px]">{s.absentTeacherName}</span>
                  </td>
                  <td className="px-6 md:px-10 py-8 print:px-5 print:py-5">
                    <p className="font-black text-[#001f3f] dark:text-white text-sm print:text-black print:text-[12px]">{s.substituteTeacherName}</p>
                  </td>
                  {isManagement && (
                    <td className="px-6 md:px-10 py-8 text-right no-print">
                      <div className="flex items-center justify-end space-x-4">
                        <button type="button" onClick={() => handleEdit(s)} className="text-[10px] font-black uppercase text-sky-600 hover:text-sky-800">EDIT</button>
                        <button type="button" onClick={() => handleDelete(s.id)} className="text-[10px] font-black uppercase text-red-500 hover:text-red-700">DELETE</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredSubs.length === 0 && (
                <tr>
                  <td colSpan={isManagement ? 5 : 4} className="px-10 py-32 text-center print:py-24">
                    <div className="flex flex-col items-center opacity-30">
                       <p className="text-sm font-black uppercase tracking-[0.4em] print:text-black">No active substitutions recorded</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER SIGNATURES - Visible on Page and in PDF/Print */}
        <div className="mt-32 mb-20 grid grid-cols-1 sm:grid-cols-2 gap-16 sm:gap-48 px-10 md:px-20">
          <div className="border-t-[2.5px] border-[#001f3f] pt-5 text-center">
            <p className="text-[13px] font-black uppercase text-[#001f3f] dark:text-white tracking-widest">Duty Incharge Signature</p>
          </div>
          <div className="border-t-[2.5px] border-[#001f3f] pt-5 text-center">
            <p className="text-[13px] font-black uppercase text-[#001f3f] dark:text-white tracking-widest">Administrative Head</p>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-[#001f3f]/90 backdrop-blur-md no-print animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] p-10 shadow-2xl border border-amber-200/20 space-y-8 animate-in zoom-in-95 duration-300 overflow-y-auto max-h-[90vh]">
             <div className="text-center">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-600">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                </div>
                <h4 className="text-2xl font-black text-[#001f3f] dark:text-white uppercase tracking-tight italic">{formData.id ? 'Modify Duty Record' : 'Manual Assignment'}</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Target Date: {selectedDate}</p>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Period (Slot)</label>
                   <select className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-400 rounded-2xl outline-none font-bold text-sm dark:text-white" value={formData.slotId} onChange={e => setFormData({...formData, slotId: parseInt(e.target.value)})}>
                     {slots.map(s => <option key={s.id} value={s.id}>{s.label} ({s.startTime})</option>)}
                   </select>
                </div>
                <div className="space-y-2">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Section Wing</label>
                   <select className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-400 rounded-2xl outline-none font-bold text-sm dark:text-white" value={formData.section} onChange={e => setFormData({...formData, section: e.target.value as SectionType})}>
                     <option value="PRIMARY">Primary Wing</option>
                     <option value="SECONDARY_BOYS">Secondary Boys</option>
                     <option value="SECONDARY_GIRLS">Secondary Girls</option>
                   </select>
                </div>
                <div className="space-y-2">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Class ID</label>
                   <input className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-400 rounded-2xl outline-none font-bold text-sm dark:text-white" value={formData.className} onChange={e => setFormData({...formData, className: e.target.value.toUpperCase()})} />
                </div>
                <div className="space-y-2">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Subject</label>
                   <input className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-400 rounded-2xl outline-none font-bold text-sm dark:text-white" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} />
                </div>
                <div className="space-y-2">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 text-red-500">Absent Faculty</label>
                   <select className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-red-400 rounded-2xl outline-none font-bold text-sm dark:text-white" value={formData.absentTeacherId} onChange={e => setFormData({...formData, absentTeacherId: e.target.value})}>
                     <option value="">Select Absent Teacher...</option>
                     {users.filter(u => u.role.startsWith('TEACHER_')).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                   </select>
                </div>
                <div className="space-y-2">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 text-emerald-500">Substitute Faculty</label>
                   <select className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-400 rounded-2xl outline-none font-bold text-sm dark:text-white" value={formData.substituteTeacherId} onChange={e => setFormData({...formData, substituteTeacherId: e.target.value})}>
                     <option value="">Select Substitute Teacher...</option>
                     {users.filter(u => u.role.startsWith('TEACHER_')).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                   </select>
                </div>
             </div>

             <div className="flex flex-col space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button 
                  onClick={saveSubstitution}
                  className="w-full bg-[#001f3f] text-[#d4af37] py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] shadow-lg active:scale-95 transition-all"
                >
                  Confirm Duty Assignment
                </button>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="w-full py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-red-500"
                >
                  Cancel
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubstitutionView;