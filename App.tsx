import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole, AttendanceRecord, TimeTableEntry, SubstitutionRecord, SchoolConfig, TeacherAssignment, SubjectCategory, AppTab } from './types.ts';
import { INITIAL_USERS, INITIAL_CONFIG, DAYS } from './constants.ts';
import Login from './components/Login.tsx';
import Dashboard from './components/Dashboard.tsx';
import Sidebar from './components/Sidebar.tsx';
import Navbar from './components/Navbar.tsx';
import AttendanceView from './components/AttendanceView.tsx';
import UserManagement from './components/UserManagement.tsx';
import TimeTableView from './components/TimeTableView.tsx';
import SubstitutionView from './components/SubstitutionView.tsx';
import AdminConfigView from './components/AdminConfigView.tsx';
import FacultyAssignmentView from './components/FacultyAssignmentView.tsx';
import DeploymentView from './components/DeploymentView.tsx';
import { supabase } from './supabaseClient.ts';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('ihis_dark_mode');
    return saved === 'true';
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('ihis_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem('ihis_attendance');
    return saved ? JSON.parse(saved) : [];
  });

  const [timetable, setTimetable] = useState<TimeTableEntry[]>(() => {
    const saved = localStorage.getItem('ihis_timetable');
    return saved ? JSON.parse(saved) : [];
  });

  const [substitutions, setSubstitutions] = useState<SubstitutionRecord[]>(() => {
    const saved = localStorage.getItem('ihis_substitutions');
    return saved ? JSON.parse(saved) : [];
  });

  const [schoolConfig, setSchoolConfig] = useState<SchoolConfig>(() => {
    const saved = localStorage.getItem('ihis_school_config');
    return saved ? JSON.parse(saved) : INITIAL_CONFIG;
  });

  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignment[]>(() => {
    const saved = localStorage.getItem('ihis_teacher_assignments');
    return saved ? JSON.parse(saved) : [];
  });

  const [attendanceOTP, setAttendanceOTP] = useState<string>(() => {
    const saved = localStorage.getItem('ihis_attendance_otp');
    return saved || '123456';
  });

  const [confirmConfig, setConfirmConfig] = useState<{ message: string, onConfirm: () => void } | null>(null);

  const triggerConfirm = (message: string, onConfirm: () => void) => {
    setConfirmConfig({ message, onConfirm });
  };

  const syncTimetable = useCallback(() => {
    const manualEntries = timetable.filter(t => t.id.startsWith('man-'));
    const newEntries: TimeTableEntry[] = [...manualEntries];
    
    const teacherBusyMatrix: Set<string> = new Set();
    const classBusyMatrix: Set<string> = new Set();

    manualEntries.forEach(m => {
      teacherBusyMatrix.add(`${m.teacherId}-${m.day}-${m.slotId}`);
      classBusyMatrix.add(`${m.className}-${m.day}-${m.slotId}`);
    });

    const getGradeFromClassName = (name: string) => {
      const romanMatch = name.match(/[IVX]+/);
      if (romanMatch) return `Grade ${romanMatch[0]}`;
      const digitMatch = name.match(/\d+/);
      if (digitMatch) return `Grade ${digitMatch[0]}`;
      return name;
    };

    const SYNC_CATEGORIES = [
      SubjectCategory.LANGUAGE_2ND, 
      SubjectCategory.LANGUAGE_2ND_SENIOR, 
      SubjectCategory.LANGUAGE_3RD, 
      SubjectCategory.RME
    ];

    const gradeSections: Record<string, string[]> = {};
    schoolConfig.classes.forEach(cls => {
      const g = getGradeFromClassName(cls.name);
      if (!gradeSections[g]) gradeSections[g] = [];
      gradeSections[g].push(cls.name);
    });

    const globalPool = teacherAssignments.map(alloc => {
      const loads = alloc.loads.map(l => {
        const consumedByManual = manualEntries.filter(m => 
          m.teacherId === alloc.teacherId && 
          getGradeFromClassName(m.className) === alloc.grade && 
          m.subject === l.subject
        ).length;

        return {
          subject: l.subject,
          category: schoolConfig.subjects.find(s => s.name === l.subject)?.category || SubjectCategory.CORE,
          totalRemaining: Math.max(0, l.periods - consumedByManual)
        };
      });

      return {
        teacherId: alloc.teacherId,
        teacherName: users.find(u => u.id === alloc.teacherId)?.name || 'Unknown',
        grade: alloc.grade,
        loads: loads,
        targetSections: alloc.targetSections || []
      };
    });

    schoolConfig.classes.forEach(cls => {
      const classTeacher = users.find(u => u.classTeacherOf === cls.name);
      if (classTeacher) {
        const gradeName = getGradeFromClassName(cls.name);
        const poolEntry = globalPool.find(p => p.teacherId === classTeacher.id && p.grade === gradeName);
        
        if (poolEntry) {
          DAYS.forEach(day => {
            const slotId = 1;
            const tBusyKey = `${classTeacher.id}-${day}-${slotId}`;
            const cBusyKey = `${cls.name}-${day}-${slotId}`;
            
            if (!classBusyMatrix.has(cBusyKey) && !teacherBusyMatrix.has(tBusyKey)) {
              const bestLoad = [...poolEntry.loads]
                .filter(l => l.totalRemaining > 0)
                .sort((a, b) => {
                  if (a.category === SubjectCategory.CORE && b.category !== SubjectCategory.CORE) return -1;
                  if (a.category !== SubjectCategory.CORE && b.category === SubjectCategory.CORE) return 1;
                  return b.totalRemaining - a.totalRemaining;
                })[0];

              if (bestLoad) {
                newEntries.push({
                  id: `ct-${cls.name}-${day}-${slotId}-${Date.now()}-${Math.random().toString(36).substr(2,4)}`,
                  className: cls.name,
                  day,
                  slotId,
                  section: cls.section,
                  subject: bestLoad.subject,
                  subjectCategory: bestLoad.category,
                  teacherId: classTeacher.id,
                  teacherName: classTeacher.name
                });
                teacherBusyMatrix.add(tBusyKey);
                classBusyMatrix.add(cBusyKey);
                bestLoad.totalRemaining--;
              }
            }
          });
        }
      }
    });

    Object.entries(gradeSections).forEach(([gradeName, sections]) => {
      SYNC_CATEGORIES.forEach(category => {
        const periodsNeeded = sections.reduce((max, section) => {
          const sectionPool = globalPool.filter(p => p.grade === gradeName && (!p.targetSections.length || p.targetSections.includes(section)));
          const catLoadCount = sectionPool.reduce((sum, p) => sum + p.loads.filter(l => l.category === category).reduce((s, l) => s + l.totalRemaining, 0), 0);
          return Math.max(max, catLoadCount);
        }, 0);

        if (periodsNeeded <= 0) return;

        let scheduledCount = 0;
        for (let slotId = 2; slotId <= 9 && scheduledCount < periodsNeeded; slotId++) {
          for (const day of DAYS) {
            if (scheduledCount >= periodsNeeded) break;
            
            const teachersForBlock: Record<string, any> = {};
            const usedTeachersInThisSlot = new Set<string>();
            
            const canScheduleSync = sections.every(section => {
              const cBusyKey = `${section}-${day}-${slotId}`;
              if (classBusyMatrix.has(cBusyKey)) return false;
              if (section.startsWith('P') && slotId > 8) return false;

              const pEntry = globalPool.find(p => 
                p.grade === gradeName && 
                (!p.targetSections.length || p.targetSections.includes(section)) &&
                !usedTeachersInThisSlot.has(p.teacherId) &&
                p.loads.some(l => l.category === category && l.totalRemaining > 0) &&
                !teacherBusyMatrix.has(`${p.teacherId}-${day}-${slotId}`)
              );

              if (!pEntry) return false;
              teachersForBlock[section] = pEntry;
              usedTeachersInThisSlot.add(pEntry.teacherId);
              return true;
            });

            if (canScheduleSync) {
              sections.forEach(section => {
                const pEntry = teachersForBlock[section];
                const load = pEntry.loads.find((l: any) => l.category === category && l.totalRemaining > 0);
                
                if (load) {
                  const cBusyKey = `${section}-${day}-${slotId}`;
                  const tBusyKey = `${pEntry.teacherId}-${day}-${slotId}`;
                  const clsObj = schoolConfig.classes.find(c => c.name === section);

                  newEntries.push({
                    id: `sync-${section}-${day}-${slotId}-${Date.now()}-${Math.random().toString(36).substr(2,4)}`,
                    className: section,
                    day,
                    slotId,
                    section: clsObj?.section || 'PRIMARY',
                    subject: load.subject,
                    subjectCategory: category,
                    teacherId: pEntry.teacherId,
                    teacherName: pEntry.teacherName
                  });
                  teacherBusyMatrix.add(tBusyKey);
                  classBusyMatrix.add(cBusyKey);
                  load.totalRemaining--;
                }
              });
              scheduledCount++;
            }
          }
        }
      });
    });

    for (let slotId = 1; slotId <= 9; slotId++) {
      DAYS.forEach(day => {
        schoolConfig.classes.forEach(cls => {
          const cBusyKey = `${cls.name}-${day}-${slotId}`;
          if (classBusyMatrix.has(cBusyKey)) return;
          if (cls.section === 'PRIMARY' && slotId > 8) return;

          const gradeName = getGradeFromClassName(cls.name);
          
          const candidates = globalPool
            .filter(p => 
              p.grade === gradeName && 
              (!p.targetSections.length || p.targetSections.includes(cls.name)) &&
              p.loads.some(l => l.totalRemaining > 0) &&
              !teacherBusyMatrix.has(`${p.teacherId}-${day}-${slotId}`)
            )
            .sort((a, b) => {
              const loadA = a.loads.reduce((sum: number, l: any) => sum + l.totalRemaining, 0);
              const loadB = b.loads.reduce((sum: number, l: any) => sum + l.totalRemaining, 0);
              return loadB - loadA || Math.random() - 0.5;
            });

          if (candidates.length > 0) {
            const pEntry = candidates[0];
            const load = pEntry.loads
              .filter((l: any) => l.totalRemaining > 0)
              .sort((a: any, b: any) => b.totalRemaining - a.totalRemaining)[0];

            if (load) {
              newEntries.push({
                id: `gen-${cls.name}-${day}-${slotId}-${Date.now()}-${Math.random().toString(36).substr(2,4)}`,
                className: cls.name,
                day,
                slotId,
                section: cls.section,
                subject: load.subject,
                subjectCategory: load.category,
                teacherId: pEntry.teacherId,
                teacherName: pEntry.teacherName
              });
              teacherBusyMatrix.add(`${pEntry.teacherId}-${day}-${slotId}`);
              classBusyMatrix.add(cBusyKey);
              load.totalRemaining--;
            }
          }
        });
      });
    }

    setTimetable(newEntries);
  }, [schoolConfig.classes, schoolConfig.subjects, users, teacherAssignments, timetable]);

  useEffect(() => {
    localStorage.setItem('ihis_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('ihis_attendance', JSON.stringify(attendance));
  }, [attendance]);

  useEffect(() => {
    localStorage.setItem('ihis_timetable', JSON.stringify(timetable));
  }, [timetable]);

  useEffect(() => {
    localStorage.setItem('ihis_substitutions', JSON.stringify(substitutions));
  }, [substitutions]);

  useEffect(() => {
    localStorage.setItem('ihis_school_config', JSON.stringify(schoolConfig));
  }, [schoolConfig]);

  useEffect(() => {
    localStorage.setItem('ihis_teacher_assignments', JSON.stringify(teacherAssignments));
  }, [teacherAssignments]);

  useEffect(() => {
    localStorage.setItem('ihis_attendance_otp', attendanceOTP);
  }, [attendanceOTP]);

  useEffect(() => {
    localStorage.setItem('ihis_dark_mode', String(isDarkMode));
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  if (!currentUser) {
    return <Login users={users} onLogin={setCurrentUser} isDarkMode={isDarkMode} />;
  }

  const isManagement = currentUser.role === UserRole.ADMIN || currentUser.role.startsWith('INCHARGE_');
  const isAdmin = currentUser.role === UserRole.ADMIN;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
      <Sidebar role={currentUser.role} activeTab={activeTab} setActiveTab={setActiveTab} config={schoolConfig} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar user={currentUser} onLogout={() => setCurrentUser(null)} isDarkMode={isDarkMode} toggleDarkMode={() => setIsDarkMode(!isDarkMode)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-8 dark:text-slate-200">
          <div className="min-h-full flex flex-col">
            <div className="flex-1">
              {activeTab === 'dashboard' && <Dashboard user={currentUser} attendance={attendance} setAttendance={setAttendance} substitutions={substitutions} currentOTP={attendanceOTP} setOTP={setAttendanceOTP} />}
              {activeTab === 'history' && <AttendanceView user={currentUser} attendance={attendance} setAttendance={setAttendance} users={users} />}
              {activeTab === 'users' && isManagement && <UserManagement users={users} setUsers={setUsers} config={schoolConfig} currentUser={currentUser} />}
              {activeTab === 'assignments' && isManagement && <FacultyAssignmentView users={users} config={schoolConfig} assignments={teacherAssignments} setAssignments={setTeacherAssignments} triggerConfirm={triggerConfirm} currentUser={currentUser} />}
              {activeTab === 'timetable' && <TimeTableView user={currentUser} users={users} timetable={timetable} setTimetable={setTimetable} substitutions={substitutions} config={schoolConfig} assignments={teacherAssignments} setAssignments={setTeacherAssignments} onManualSync={syncTimetable} triggerConfirm={triggerConfirm} />}
              {activeTab === 'substitutions' && <SubstitutionView user={currentUser} users={users} attendance={attendance} timetable={timetable} substitutions={substitutions} setSubstitutions={setSubstitutions} />}
              {activeTab === 'config' && isAdmin && <AdminConfigView config={schoolConfig} setConfig={setSchoolConfig} />}
              {activeTab === 'deployment' && isAdmin && <DeploymentView />}
            </div>
            <footer className="mt-12 py-6 border-t border-slate-200 dark:border-slate-800 text-center no-print">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em]">Developed by: Ahmed Minwal</p>
            </footer>
          </div>
        </main>
      </div>
      {confirmConfig && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-[#001f3f]/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-md rounded-[2.5rem] p-10 shadow-2xl border border-amber-200/20 text-center space-y-8 animate-in zoom-in-95 duration-300">
             <div className="w-20 h-20 bg-amber-50 rounded-3xl mx-auto flex items-center justify-center">
                <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
             </div>
             <div>
                <h4 className="text-xl font-black text-[#001f3f] dark:text-white uppercase tracking-tight mb-2 italic">Institutional Confirmation</h4>
                <p className="text-xs font-bold text-slate-400 uppercase leading-relaxed tracking-widest">{confirmConfig.message}</p>
             </div>
             <div className="flex flex-col space-y-3">
                <button onClick={() => { confirmConfig.onConfirm(); setConfirmConfig(null); }} className="w-full bg-[#001f3f] text-[#d4af37] py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] shadow-lg active:scale-95 transition-all">Execute Action</button>
                <button onClick={() => setConfirmConfig(null)} className="w-full py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-red-500 transition-colors">Cancel</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;