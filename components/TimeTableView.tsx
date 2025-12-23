import React, { useState, useMemo, useEffect } from 'react';
import { User, UserRole, TimeTableEntry, SectionType, TimeSlot, SubstitutionRecord, SchoolConfig, TeacherAssignment, SubjectCategory } from '../types.ts';
import { DAYS, PRIMARY_SLOTS, SECONDARY_GIRLS_SLOTS, SECONDARY_BOYS_SLOTS, SCHOOL_NAME } from '../constants.ts';

// Declare html2pdf for TypeScript
declare var html2pdf: any;

interface TimeTableViewProps {
  user: User;
  users: User[];
  timetable: TimeTableEntry[];
  setTimetable: React.Dispatch<React.SetStateAction<TimeTableEntry[]>>;
  substitutions?: SubstitutionRecord[];
  config: SchoolConfig;
  assignments: TeacherAssignment[];
  setAssignments: React.Dispatch<React.SetStateAction<TeacherAssignment[]>>;
  onManualSync: () => void;
  triggerConfirm: (message: string, onConfirm: () => void) => void;
}

const TimeTableView: React.FC<TimeTableViewProps> = ({ user, users, timetable, setTimetable, config, assignments, setAssignments, onManualSync, triggerConfirm }) => {
  const isManagement = user.role === UserRole.ADMIN || user.role.startsWith('INCHARGE_');
  
  const [activeSection, setActiveSection] = useState<SectionType>('PRIMARY');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [viewMode, setViewMode] = useState<'CLASS' | 'TEACHER' | 'NONE'>(isManagement ? 'NONE' : 'TEACHER');
  const [isDesigning, setIsDesigning] = useState(false);
  const [nonMgmtView, setNonMgmtView] = useState<'personal' | 'class'>(user.classTeacherOf ? 'class' : 'personal');
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editContext, setEditContext] = useState<{day: string, slot: TimeSlot} | null>(null);
  const [manualData, setManualData] = useState({ teacherId: '', subject: '', className: '' });
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Initialize view for faculty
  useEffect(() => {
    if (!isManagement) {
      if (nonMgmtView === 'class' && user.classTeacherOf) {
        setSelectedClass(user.classTeacherOf);
        setViewMode('CLASS');
      } else {
        setSelectedClass(user.id);
        setViewMode('TEACHER');
      }
    }
  }, [nonMgmtView, isManagement, user.classTeacherOf, user.id]);

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const slots = useMemo(() => {
    let targetSection = activeSection;
    if (selectedClass && viewMode === 'CLASS') {
      const classObj = config.classes.find(c => c.name === selectedClass);
      if (classObj) targetSection = classObj.section;
    }

    if (targetSection === 'PRIMARY') return PRIMARY_SLOTS;
    if (targetSection === 'SECONDARY_GIRLS') return SECONDARY_GIRLS_SLOTS;
    return SECONDARY_BOYS_SLOTS;
  }, [activeSection, selectedClass, config.classes, viewMode]);

  const classTeacher = useMemo(() => {
    if (viewMode !== 'CLASS' || !selectedClass) return null;
    return users.find(u => u.classTeacherOf === selectedClass);
  }, [users, viewMode, selectedClass]);

  const getGradeFromClassName = (name: string) => {
    const romanMatch = name.match(/[IVX]+/);
    if (romanMatch) return `Grade ${romanMatch[0]}`;
    const digitMatch = name.match(/\d+/);
    if (digitMatch) return `Grade ${digitMatch[0]}`;
    return name;
  };

  const handlePrint = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.print();
  };

  const handleSync = () => {
    onManualSync();
    setStatus({ type: 'success', message: 'The timetable has generated.' });
  };

  const handleDownloadPDF = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const element = document.querySelector('.printable-area');
    if (!element) return;

    const profileName = viewMode === 'CLASS' 
      ? selectedClass 
      : (users.find(u => u.id === selectedClass)?.name || 'Teacher');

    // Add generating class to body to trigger specific print/pdf overrides
    document.body.classList.add('is-generating-pdf');

    const opt = {
      margin: [5, 5, 5, 5],
      filename: `Timetable_${profileName}_2026-27.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        letterRendering: true
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'landscape',
        compress: true
      }
    };

    try {
      await html2pdf().set(opt).from(element).toPdf().get('pdf').save();
    } catch (err) {
      console.error("PDF Generation Error:", err);
      window.print();
    } finally {
      document.body.classList.remove('is-generating-pdf');
    }
  };

  const filteredRoomsForTeacher = useMemo(() => {
    if (viewMode !== 'TEACHER' || !selectedClass) return config.classes;
    const targetTeacher = users.find(u => u.id === selectedClass);
    if (!targetTeacher) return config.classes;
    if (targetTeacher.role === UserRole.ADMIN || targetTeacher.role === UserRole.INCHARGE_ALL) return config.classes;
    const isPrimaryTeacher = targetTeacher.role === UserRole.TEACHER_PRIMARY || targetTeacher.role === UserRole.INCHARGE_PRIMARY;
    const isSecondaryTeacher = targetTeacher.role === UserRole.TEACHER_SECONDARY || 
                               targetTeacher.role === UserRole.TEACHER_SENIOR_SECONDARY || 
                               targetTeacher.role === UserRole.INCHARGE_SECONDARY;
    return config.classes.filter(c => {
      if (isPrimaryTeacher) return c.section === 'PRIMARY';
      if (isSecondaryTeacher) return c.section === 'SECONDARY_BOYS' || c.section === 'SECONDARY_GIRLS';
      return true;
    });
  }, [viewMode, selectedClass, users, config.classes]);

  const filteredTeachersForClass = useMemo(() => {
    if (viewMode !== 'CLASS' || !selectedClass) return users.filter(u => u.role.startsWith('TEACHER_'));
    const classObj = config.classes.find(c => c.name === selectedClass);
    if (!classObj) return users.filter(u => u.role.startsWith('TEACHER_'));
    return users.filter(u => {
      const isPrimaryRole = u.role === UserRole.TEACHER_PRIMARY || u.role === UserRole.INCHARGE_PRIMARY;
      const isSecondaryRole = u.role === UserRole.TEACHER_SECONDARY || u.role === UserRole.TEACHER_SENIOR_SECONDARY || u.role === UserRole.INCHARGE_SECONDARY;
      const isGlobalRole = u.role === UserRole.ADMIN || u.role === UserRole.INCHARGE_ALL;
      if (classObj.section === 'PRIMARY') return isPrimaryRole || isGlobalRole;
      return isSecondaryRole || isGlobalRole;
    });
  }, [viewMode, selectedClass, users, config.classes]);

  const conflictInfo = useMemo(() => {
    if (!showEditModal || !editContext) return null;

    const day = editContext.day;
    const slotId = editContext.slot.id;

    if (viewMode === 'CLASS' && manualData.teacherId) {
      const conflict = timetable.find(t => 
        t.teacherId === manualData.teacherId && 
        t.day === day && 
        t.slotId === slotId &&
        t.className !== selectedClass 
      );
      if (conflict) {
        return { 
          type: 'TEACHER_CONFLICT', 
          message: `Conflict: ${conflict.teacherName} is already assigned to Class ${conflict.className} during this period.` 
        };
      }
    } else if (viewMode === 'TEACHER' && manualData.className) {
      const conflict = timetable.find(t => 
        t.className === manualData.className && 
        t.day === day && 
        t.slotId === slotId &&
        t.teacherId !== selectedClass 
      );
      if (conflict) {
        return { 
          type: 'ROOM_CONFLICT', 
          message: `Conflict: Room ${conflict.className} is already occupied by ${conflict.teacherName} during this period.` 
        };
      }
    }
    return null;
  }, [showEditModal, editContext, viewMode, manualData, timetable, selectedClass]);

  const availableSubjectsForModal = useMemo(() => {
    const targetTeacherId = viewMode === 'TEACHER' ? selectedClass : manualData.teacherId;
    const targetClassName = viewMode === 'CLASS' ? selectedClass : manualData.className;
    if (!targetTeacherId || !targetClassName) return [];
    const grade = getGradeFromClassName(targetClassName);
    const teacherAssignments = assignments.filter(a => a.teacherId === targetTeacherId && a.grade === grade);
    const assignedSubjectNames = Array.from(new Set(teacherAssignments.flatMap(a => a.loads.map(l => l.subject))));
    if (assignedSubjectNames.length > 0) {
      return config.subjects.filter(s => assignedSubjectNames.includes(s.name));
    }
    return config.subjects;
  }, [viewMode, selectedClass, manualData.teacherId, manualData.className, assignments, config.subjects]);

  const openEntryModal = (day: string, slot: TimeSlot, entry?: TimeTableEntry) => {
    if (!selectedClass) return;
    setEditContext({ day, slot });
    if (entry) {
      setManualData({
        teacherId: entry.teacherId,
        subject: entry.subject,
        className: entry.className
      });
    } else {
      setManualData({ 
        teacherId: viewMode === 'TEACHER' ? selectedClass : '', 
        subject: '', 
        className: viewMode === 'CLASS' ? selectedClass : '' 
      });
    }
    setShowEditModal(true);
  };

  /**
   * Reconciles the Faculty Load (TeacherAssignment) based on manual timetable modifications.
   */
  const reconcileAssignments = (teacherId: string, grade: string, subject: string, updatedTimetable: TimeTableEntry[]) => {
    const manualCount = updatedTimetable.filter(t => 
      t.id.startsWith('man-') && 
      t.teacherId === teacherId && 
      getGradeFromClassName(t.className) === grade &&
      t.subject === subject
    ).length;

    setAssignments(prev => {
      let teacherAssignment = prev.find(a => a.teacherId === teacherId && a.grade === grade);
      
      if (!teacherAssignment) {
        const newAssignment: TeacherAssignment = {
          id: `${teacherId}-${grade}`,
          teacherId,
          grade,
          loads: [{ subject, periods: manualCount }]
        };
        return [...prev, newAssignment];
      }

      const existingLoad = teacherAssignment.loads.find(l => l.subject === subject);
      
      let updatedLoads;
      if (!existingLoad) {
        updatedLoads = [...teacherAssignment.loads, { subject, periods: manualCount }];
      } else {
        updatedLoads = teacherAssignment.loads.map(l => 
          l.subject === subject 
            ? { ...l, periods: Math.max(l.periods, manualCount) } 
            : l
        );
      }

      return prev.map(a => a.id === teacherAssignment!.id ? { ...a, loads: updatedLoads } : a);
    });
  };

  const saveManualEntry = () => {
    if (!editContext || !manualData.subject) return;
    const targetTeacherId = viewMode === 'TEACHER' ? selectedClass : manualData.teacherId;
    const targetClassName = viewMode === 'CLASS' ? selectedClass : manualData.className;
    if (!targetTeacherId || !targetClassName) return;

    const executeSave = () => {
      const teacher = users.find(u => u.id === targetTeacherId);
      const subObj = config.subjects.find(s => s.name === manualData.subject);
      const classObj = config.classes.find(c => c.name === targetClassName);
      
      const newId = `man-${targetClassName}-${editContext.day}-${editContext.slot.id}-${Date.now()}`;
      const newEntry: TimeTableEntry = {
        id: newId,
        className: targetClassName,
        day: editContext.day,
        slotId: editContext.slot.id,
        section: classObj?.section || activeSection,
        subject: manualData.subject,
        subjectCategory: subObj?.category || SubjectCategory.CORE,
        teacherId: targetTeacherId,
        teacherName: teacher?.name || 'Unknown'
      };

      const updatedTimetable = [
        ...timetable.filter(t => (
          viewMode === 'CLASS' 
            ? !(t.className === targetClassName && t.day === editContext.day && t.slotId === editContext.slot.id)
            : !(t.teacherId === targetTeacherId && t.day === editContext.day && t.slotId === editContext.slot.id)
        )),
        newEntry
      ];

      setTimetable(updatedTimetable);
      reconcileAssignments(targetTeacherId, getGradeFromClassName(targetClassName), manualData.subject, updatedTimetable);
      
      setShowEditModal(false);
      setEditContext(null);
    };

    if (conflictInfo) {
      triggerConfirm(`${conflictInfo.message} Proceed with institutional override?`, executeSave);
    } else {
      executeSave();
    }
  };

  const removeEntry = (id: string) => {
    const entryToRemove = timetable.find(t => t.id === id);
    if (!entryToRemove) return;

    const updatedTimetable = timetable.filter(t => t.id !== id);
    setTimetable(updatedTimetable);

    if (entryToRemove.id.startsWith('man-')) {
       const grade = getGradeFromClassName(entryToRemove.className);
       reconcileAssignments(entryToRemove.teacherId, grade, entryToRemove.subject, updatedTimetable);
    }
  };

  // Determine allowed profiles based on roles
  const allowedClasses = useMemo(() => {
    if (isManagement) return config.classes;
    return config.classes.filter(c => c.name === user.classTeacherOf);
  }, [config.classes, isManagement, user.classTeacherOf]);

  const allowedTeachers = useMemo(() => {
    if (isManagement) return users.filter(u => u.role.startsWith('TEACHER_'));
    return users.filter(u => u.id === user.id);
  }, [users, isManagement, user.id]);

  const renderGridCell = (day: string, slot: TimeSlot, isTeacherView: boolean = false, targetId?: string) => {
    if (slot.isBreak) return null;
    const entry = timetable.find(t => 
      t.day === day && 
      t.slotId === slot.id && 
      (isTeacherView ? t.teacherId === targetId : t.className === targetId)
    );
    if (!entry) {
      return (
        <div 
          onClick={() => isDesigning && openEntryModal(day, slot)}
          className={`h-full border border-slate-50 dark:border-slate-800/10 rounded-sm flex flex-col items-center justify-center transition-all ${isDesigning ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800' : ''}`}
        >
          {isDesigning && <span className="text-slate-200 text-lg font-thin">+</span>}
        </div>
      );
    }
    let displaySubject = entry.subject;
    const isLanguageBlock = entry.subjectCategory === SubjectCategory.LANGUAGE_2ND || 
                            entry.subjectCategory === SubjectCategory.LANGUAGE_2ND_SENIOR || 
                            entry.subjectCategory === SubjectCategory.LANGUAGE_3RD;
    if (!isTeacherView) {
      if (entry.subjectCategory === SubjectCategory.LANGUAGE_2ND || entry.subjectCategory === SubjectCategory.LANGUAGE_2ND_SENIOR) {
        displaySubject = "2nd Lang Block";
      } else if (entry.subjectCategory === SubjectCategory.LANGUAGE_3RD) {
        displaySubject = "3rd Lang Block";
      }
    }
    const showTeacherName = isTeacherView || !isLanguageBlock;
    return (
      <div 
        key={entry.id} 
        onClick={() => isDesigning && openEntryModal(day, slot, entry)}
        className={`h-full p-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-sm flex flex-col justify-center text-center group relative transition-all ${isDesigning ? 'cursor-pointer hover:ring-2 hover:ring-amber-400/50 hover:bg-slate-50 dark:hover:bg-slate-800' : ''} print:border-black`}
      >
        {isDesigning && (
          <button 
            onClick={(e) => { e.stopPropagation(); removeEntry(entry.id); }}
            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 bg-white/80 dark:bg-slate-900/80 rounded shadow-sm px-1.5 py-0.5 text-[14px] font-black z-10 transition-all no-print"
          >
            ×
          </button>
        )}
        <div className="space-y-1 overflow-hidden">
          <p className={`text-[12px] md:text-[14px] print:text-[10px] pdf-cell-subject font-black uppercase tracking-tight leading-tight whitespace-normal break-words ${
            entry.subjectCategory === SubjectCategory.CORE ? 'text-sky-600 print:text-black' :
            entry.subjectCategory === SubjectCategory.LANGUAGE_2ND ? 'text-amber-600 print:text-black' :
            entry.subjectCategory === SubjectCategory.LANGUAGE_3RD ? 'text-emerald-600 print:text-black' :
            'text-rose-600 print:text-black'
          }`}>
            {displaySubject}
          </p>
          <p className="text-[10px] md:text-[12px] print:text-[8px] pdf-cell-teacher font-bold text-[#001f3f] dark:text-white print:text-black leading-tight whitespace-normal break-words mt-0.5">
            {isTeacherView ? entry.className : (showTeacherName ? entry.teacherName : '')}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full max-h-full space-y-2 animate-in fade-in duration-700 overflow-hidden print:overflow-visible">
      {/* Optimized Styles for PDF/Print fitting */}
      <style>{`
        .is-generating-pdf .printable-area {
          width: 297mm !important; 
          height: 210mm !important;
          min-height: auto !important;
          max-height: 210mm !important;
          padding: 8mm !important;
          margin: 0 !important;
          box-sizing: border-box !important;
          display: flex !important;
          flex-direction: column !important;
          background: white !important;
          overflow: hidden !important;
        }
        .is-generating-pdf .flex-1.w-full.overflow-auto {
          overflow: hidden !important;
          flex: 1 !important;
        }
        .is-generating-pdf table {
          table-layout: fixed !important;
          width: 100% !important;
          height: 100% !important;
          border-collapse: collapse !important;
        }
        .is-generating-pdf th, .is-generating-pdf td {
          border: 0.5pt solid black !important;
          padding: 2px !important;
        }
        .is-generating-pdf .pdf-cell-subject {
          font-size: 8pt !important;
          line-height: 1.1 !important;
          display: block !important;
        }
        .is-generating-pdf .pdf-cell-teacher {
          font-size: 7pt !important;
          line-height: 1.1 !important;
          display: block !important;
        }
        .is-generating-pdf .no-print {
          display: none !important;
        }
        .is-generating-pdf h2 {
          font-size: 18pt !important;
        }
      `}</style>
      
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 no-print shrink-0 px-2">
        <div className="flex items-center space-x-3">
          <h1 className="text-sm font-black text-[#001f3f] dark:text-white tracking-tight italic truncate">
            {viewMode === 'CLASS' ? `Class: ${selectedClass}` : 
             viewMode === 'TEACHER' ? `Faculty: ${users.find(u => u.id === selectedClass)?.name || 'Teacher'}` : 
             'Timetable Matrix'}
          </h1>
          {status && (
            <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-left-2 ${status.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
              {status.message}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isManagement && (
            <>
              <button 
                onClick={() => setIsDesigning(!isDesigning)}
                className={`px-6 py-1.5 rounded-md text-[13px] font-black uppercase transition-all shadow-md ${isDesigning ? 'bg-amber-500 text-white ring-2 ring-amber-300' : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200'}`}
              >
                {isDesigning ? 'Exit Edit' : 'Edit Grid'}
              </button>
              <button onClick={handleSync} className="bg-[#001f3f] text-[#d4af37] px-4 py-1.5 rounded-md text-[13px] font-black uppercase shadow hover:bg-slate-900 transition-all border border-amber-500/10">
                Sync
              </button>
              <button 
                onClick={handleDownloadPDF} 
                className="bg-sky-600 text-white px-5 py-1.5 rounded-md text-[13px] font-black uppercase flex items-center space-x-2 border border-sky-400 shadow-md hover:bg-sky-700 transition-all active:scale-95"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                <span>DOWNLOAD PDF</span>
              </button>
            </>
          )}
          <button 
            onClick={handlePrint} 
            type="button"
            className="bg-[#001f3f] text-[#d4af37] px-5 py-1.5 rounded-md text-[13px] font-black uppercase flex items-center space-x-2 border border-amber-400 shadow-md hover:bg-slate-900 transition-all active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            <span>PRINT GRID</span>
          </button>
        </div>
      </div>

      {/* Profile Selector */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow border border-gray-100 dark:border-slate-800 overflow-hidden no-print shrink-0 mx-2">
        <div className="p-1.5 flex items-center justify-between gap-3">
          <div className="flex bg-slate-50 dark:bg-slate-800 p-1 rounded-md border border-slate-100 dark:border-slate-700">
             {/* If not management, only show class view if they are a class teacher */}
             {(isManagement || user.classTeacherOf) && (
               <button 
                onClick={() => { setViewMode('CLASS'); setNonMgmtView('class'); }} 
                className={`px-5 py-1.5 rounded text-[14px] font-black uppercase transition-all ${viewMode === 'CLASS' ? 'bg-[#001f3f] text-[#d4af37]' : 'text-slate-400'}`}
               >
                {isManagement ? 'Class View' : 'Class Timetable'}
               </button>
             )}
             <button 
              onClick={() => { setViewMode('TEACHER'); setNonMgmtView('personal'); }} 
              className={`px-5 py-1.5 rounded text-[14px] font-black uppercase transition-all ${viewMode === 'TEACHER' ? 'bg-[#001f3f] text-[#d4af37]' : 'text-slate-400'}`}
             >
              {isManagement ? 'Faculty View' : 'My Timetable'}
             </button>
          </div>
          
          {/* Only show selector if management, or if there is actually more than one option (which isn't the case for restricted faculty) */}
          {isManagement && (
            <select 
              className="bg-transparent px-4 py-2 rounded border-none text-[14px] font-black uppercase outline-none dark:text-white min-w-[220px]"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="">Choose Profile...</option>
              {viewMode === 'CLASS' ? 
                allowedClasses.map(c => <option key={c.id} value={c.name}>{c.name}</option>) :
                allowedTeachers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.employeeId})</option>)
              }
            </select>
          )}
        </div>
      </div>

      {/* Main Grid Matrix */}
      {selectedClass ? (
        <div className="printable-area flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-gray-100 dark:border-slate-800 flex flex-col overflow-hidden mx-2 mb-1 print:m-0 print:overflow-visible print:w-full print:border-none print:shadow-none">
          
          {/* Institutional Document Header */}
          <div className="p-6 border-b border-slate-50 dark:border-slate-800/50 bg-slate-50/20 dark:bg-slate-800/20 print:bg-white print:border-b-4 print:border-black print:mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-[12px] font-black text-slate-400 print:text-black uppercase tracking-[0.4em] mb-2">{SCHOOL_NAME}</h1>
                <div className="flex flex-col space-y-2">
                  <h2 className="text-2xl md:text-3xl print:text-2xl font-black text-[#001f3f] dark:text-white print:text-black italic tracking-tighter uppercase">
                    {viewMode === 'CLASS' ? `Class: ${selectedClass}` : `Faculty: ${users.find(u => u.id === selectedClass)?.name}`}
                  </h2>
                  {viewMode === 'CLASS' && classTeacher && (
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] md:text-[12px] font-black text-[#d4af37] bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full border border-amber-100 dark:border-amber-900/30 uppercase tracking-widest print:bg-white print:text-black print:border-2 print:border-black">
                        Class Teacher: {classTeacher.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[12px] md:text-[14px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest print:text-black">Academic Year 2026-2027</p>
                <p className="text-[10px] md:text-[12px] font-bold text-[#001f3f] dark:text-slate-400 uppercase print:text-black">Official Timetable Document</p>
              </div>
            </div>
          </div>
          
          {/* Table Grid */}
          <div className="flex-1 w-full overflow-auto print:overflow-visible">
            <table className="w-full h-full table-fixed border-collapse print:border-2 print:border-black">
              <thead>
                <tr className="bg-[#001f3f] dark:bg-slate-950 h-16 print:bg-white print:h-12">
                  <th className="w-16 md:w-24 border-r border-white/5 print:border-r-2 print:border-black"></th>
                  {slots.map((slot) => (
                    <th key={slot.id} className="p-1 border-l border-white/5 text-center print:border-l-2 print:border-black">
                      <p className="text-[14px] md:text-[15.5px] print:text-[11px] font-black text-[#d4af37] print:text-black uppercase tracking-tight truncate">{slot.label}</p>
                      <p className="text-[11px] md:text-[13px] print:text-[9px] font-bold text-white/40 print:text-black truncate leading-none">{slot.startTime}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="h-[calc(100%-4rem)] print:h-auto">
                {DAYS.map((day) => (
                  <tr key={day} className="h-[20%] border-b border-slate-50 dark:border-slate-800/10 last:border-0 print:border-b-2 print:border-black">
                    <td className="w-16 md:w-24 bg-[#001f3f] dark:bg-slate-950 border-r border-white/5 text-center p-1 print:bg-white print:border-r-2 print:border-black">
                      <span className="text-[14px] md:text-[17px] print:text-[12px] font-black text-[#d4af37] print:text-black uppercase tracking-tighter block">{day.substring(0,3)}</span>
                    </td>
                    {slots.map((slot) => (
                      <td key={slot.id} className={`p-1 border-l border-slate-50 dark:border-slate-800/10 print:border-l-2 print:border-black ${slot.isBreak ? 'bg-amber-50/10 dark:bg-amber-900/10 print:bg-gray-100' : ''}`}>
                        {slot.isBreak ? (
                          <div className="h-full flex items-center justify-center border border-dashed border-amber-200/40 rounded-sm dark:border-amber-900/10 bg-amber-400/5 print:border-solid print:border-black">
                            <span className="text-[12px] md:text-[15.5px] print:text-[10px] font-black text-amber-500 print:text-black uppercase tracking-widest h-full flex items-center justify-center">
                              RECESS
                            </span>
                          </div>
                        ) : (
                          renderGridCell(day, slot, viewMode === 'TEACHER', selectedClass)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Institutional Footer */}
          <div className="p-10 print:p-12 bg-white dark:bg-slate-950 flex justify-end mt-auto border-t border-slate-50 dark:border-slate-900 print:border-none">
            <div className="text-center w-64 md:w-80 space-y-2">
              <div className="h-0.5 bg-slate-300 dark:bg-slate-800 w-full mb-1 print:bg-black print:h-1"></div>
              <p className="text-[12px] md:text-[14px] print:text-[12px] font-black text-[#001f3f] dark:text-white print:text-black uppercase tracking-[0.4em]">Principal</p>
              <p className="text-[9px] md:text-[10px] print:text-[9px] font-bold text-slate-400 dark:text-slate-600 print:text-black uppercase tracking-widest">
                {SCHOOL_NAME}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center opacity-30 animate-pulse no-print">
          <svg className="w-24 h-24 mb-5 text-[#001f3f] dark:text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          <p className="text-lg font-black text-[#001f3f] dark:text-slate-500 uppercase tracking-widest">Select Profile to View Grid</p>
        </div>
      )}

      {/* Manual Override Modal */}
      {showEditModal && editContext && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#001f3f]/95 backdrop-blur-md no-print animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-[400px] rounded-[2.5rem] p-10 shadow-2xl border border-amber-200/20 space-y-8 animate-in zoom-in-95 duration-200">
             <div className="text-center">
                <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100 dark:border-amber-900/30">
                  <svg className="w-8 h-8 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </div>
                <h4 className="text-2xl font-black text-[#001f3f] dark:text-white uppercase italic tracking-tight">Manual Override</h4>
                <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest mt-2">{editContext.day} • {editContext.slot.label}</p>
             </div>
             
             <div className="space-y-6">
                {viewMode === 'CLASS' ? (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Faculty</label>
                    <select 
                      className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 rounded-2xl outline-none dark:text-white font-bold text-sm transition-all ${conflictInfo?.type === 'TEACHER_CONFLICT' ? 'border-red-500' : 'border-transparent focus:border-amber-400'}`}
                      value={manualData.teacherId}
                      onChange={e => setManualData({...manualData, teacherId: e.target.value, subject: ''})}
                    >
                      <option value="">Choose Faculty...</option>
                      {filteredTeachersForClass.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Room</label>
                    <select 
                      className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 rounded-2xl outline-none dark:text-white font-bold text-sm transition-all ${conflictInfo?.type === 'ROOM_CONFLICT' ? 'border-red-500' : 'border-transparent focus:border-amber-400'}`}
                      value={manualData.className}
                      onChange={e => setManualData({...manualData, className: e.target.value, subject: ''})}
                    >
                      <option value="">Choose Room...</option>
                      {filteredRoomsForTeacher.map(c => <option key={c.id} value={c.name}>{c.name}</option>) }
                    </select>
                  </div>
                )}

                {/* Conflict Warning UI */}
                {conflictInfo && (
                  <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl animate-in slide-in-from-top-2">
                    <div className="flex items-center space-x-3 text-red-600 dark:text-red-400">
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      <p className="text-[10px] font-black uppercase tracking-tight leading-tight">{conflictInfo.message}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Academic Subject</label>
                  <select 
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-amber-400 rounded-2xl outline-none transition-all dark:text-white font-bold text-sm"
                    value={manualData.subject}
                    onChange={e => setManualData({...manualData, subject: e.target.value})}
                    disabled={viewMode === 'CLASS' ? !manualData.teacherId : !manualData.className}
                  >
                    <option value="">{ (viewMode === 'CLASS' ? !manualData.teacherId : !manualData.className) ? 'Select Profile first...' : 'Select Assigned Subject...'}</option>
                    {availableSubjectsForModal.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                  {availableSubjectsForModal.length === 0 && (viewMode === 'CLASS' ? manualData.teacherId : manualData.className) && (
                    <p className="text-[9px] text-amber-600 font-bold uppercase mt-1">Note: No specific loads assigned to this faculty for this grade.</p>
                  )}
                </div>
             </div>

             <div className="flex flex-col space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button 
                  onClick={saveManualEntry} 
                  disabled={!manualData.subject || (viewMode === 'CLASS' ? !manualData.teacherId : !manualData.className)}
                  className={`w-full py-5 rounded-2xl font-black text-[12px] uppercase tracking-[0.3em] shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${conflictInfo ? 'bg-amber-600 text-white' : 'bg-[#001f3f] text-[#d4af37]'}`}
                >
                  {conflictInfo ? 'Confirm with Override' : 'Confirm Change'}
                </button>
                <button 
                  onClick={() => setShowEditModal(false)} 
                  className="w-full py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-red-500 transition-colors"
                >
                  Discard Changes
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeTableView;