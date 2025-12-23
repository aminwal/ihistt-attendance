import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, UserRole, SchoolConfig, TeacherAssignment, SubjectCategory, Subject, SubjectLoad } from '../types.ts';
import { ROMAN_TO_ARABIC } from '../constants.ts';

interface FacultyAssignmentViewProps {
  users: User[];
  config: SchoolConfig;
  assignments: TeacherAssignment[];
  setAssignments: React.Dispatch<React.SetStateAction<TeacherAssignment[]>>;
  triggerConfirm: (message: string, onConfirm: () => void) => void;
  currentUser: User; 
}

const FacultyAssignmentView: React.FC<FacultyAssignmentViewProps> = ({ users, config, assignments, setAssignments, triggerConfirm, currentUser }) => {
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const isGlobalIncharge = currentUser.role === UserRole.INCHARGE_ALL;
  
  const [activeSection, setActiveSection] = useState<'PRIMARY' | 'SECONDARY'>(
    currentUser.role === UserRole.INCHARGE_SECONDARY ? 'SECONDARY' : 'PRIMARY'
  );

  const [teacherSearch, setTeacherSearch] = useState('');
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [editingLoads, setEditingLoads] = useState<SubjectLoad[]>([]);
  const [subjectFilter, setSubjectFilter] = useState<SubjectCategory | 'ALL'>('ALL');
  const [isUpdating, setIsUpdating] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkTargetAssignment, setBulkTargetAssignment] = useState<TeacherAssignment | null>(null);
  const [bulkSelectedSubjects, setBulkSelectedSubjects] = useState<string[]>([]);
  const [bulkPeriodCount, setBulkPeriodCount] = useState<number>(1);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const getGradeFromClassName = (name: string) => {
    const romanMatch = name.match(/[IVX]+/);
    if (romanMatch) return `Grade ${romanMatch[0]}`;
    const digitMatch = name.match(/\d+/);
    if (digitMatch) return `Grade ${digitMatch[0]}`;
    return name;
  };

  /**
   * Filters the available grades based on the target teacher's role/department.
   * Primary teachers only see Primary Wing grades.
   * Secondary teachers only see Secondary Boys/Girls grades.
   */
  const getTeacherSpecificGrades = (teacher: User) => {
    const isPrimaryTeacher = teacher.role === UserRole.TEACHER_PRIMARY || teacher.role === UserRole.INCHARGE_PRIMARY;
    const isSecondaryTeacher = teacher.role === UserRole.TEACHER_SECONDARY || 
                               teacher.role === UserRole.TEACHER_SENIOR_SECONDARY || 
                               teacher.role === UserRole.INCHARGE_SECONDARY;
    const isGlobal = teacher.role === UserRole.ADMIN || teacher.role === UserRole.INCHARGE_ALL || teacher.role === UserRole.ADMIN_STAFF;

    const grades = config.classes
      .filter(c => {
        if (isGlobal) return true;
        if (isPrimaryTeacher) return c.section === 'PRIMARY';
        if (isSecondaryTeacher) return c.section === 'SECONDARY_BOYS' || c.section === 'SECONDARY_GIRLS';
        return false;
      })
      .map(c => getGradeFromClassName(c.name));
    
    return (Array.from(new Set(grades)) as string[]).sort((a: string, b: string) => {
      const getNum = (str: string) => {
        const parts = str.split(' ');
        const rPart = parts.length > 1 ? parts[1] : '';
        return ROMAN_TO_ARABIC[rPart] || 0;
      };
      return getNum(a) - getNum(b);
    });
  };

  useEffect(() => {
    if (editingTeacherId && selectedGrade) {
      const existing = assignments.find(a => a.teacherId === editingTeacherId && a.grade === selectedGrade);
      setEditingLoads(existing ? [...existing.loads] : []);
    } else {
      setEditingLoads([]);
    }
  }, [editingTeacherId, selectedGrade, assignments]);

  const filteredTeachers = useMemo(() => {
    return users.filter(u => {
      if (u.role === UserRole.ADMIN) return false;
      
      if (!isAdmin && !isGlobalIncharge) {
        if (currentUser.role === UserRole.INCHARGE_PRIMARY) {
          const isPrimary = u.role === UserRole.TEACHER_PRIMARY || u.role === UserRole.INCHARGE_PRIMARY;
          if (!isPrimary) return false;
        } else if (currentUser.role === UserRole.INCHARGE_SECONDARY) {
          const isSecondary = u.role === UserRole.TEACHER_SECONDARY || u.role === UserRole.TEACHER_SENIOR_SECONDARY || u.role === UserRole.INCHARGE_SECONDARY;
          if (!isSecondary) return false;
        }
      }

      if (isAdmin || isGlobalIncharge) {
        const isPrimary = u.role === UserRole.TEACHER_PRIMARY || u.role === UserRole.INCHARGE_PRIMARY || u.role === UserRole.INCHARGE_ALL;
        const isSecondary = u.role === UserRole.TEACHER_SECONDARY || u.role === UserRole.TEACHER_SENIOR_SECONDARY || u.role === UserRole.INCHARGE_SECONDARY || u.role === UserRole.INCHARGE_ALL;
        if (activeSection === 'PRIMARY' && !isPrimary) return false;
        if (activeSection === 'SECONDARY' && !isSecondary) return false;
      }

      const searchLower = teacherSearch.toLowerCase().trim();
      if (!searchLower) return true;
      return u.name.toLowerCase().includes(searchLower) || u.employeeId.toLowerCase().includes(searchLower);
    });
  }, [users, activeSection, teacherSearch, currentUser, isAdmin, isGlobalIncharge]);

  const toggleSubject = (subjectName: string) => {
    const exists = editingLoads.find(l => l.subject === subjectName);
    if (exists) {
      setEditingLoads(prev => prev.filter(l => l.subject !== subjectName));
    } else {
      if (editingLoads.length >= 8) {
        alert("Maximum of 8 subjects per grade.");
        return;
      }
      setEditingLoads(prev => [...prev, { subject: subjectName, periods: 1 }]);
    }
  };

  const calculateTeacherTotalPeriods = (teacherId: string, currentGrade?: string, currentGradeLoads: SubjectLoad[] = []) => {
    const teacherAssignments = assignments.filter(a => a.teacherId === teacherId);
    let total = 0;
    
    teacherAssignments.forEach(a => {
      if (a.grade !== currentGrade) {
        total += a.loads.reduce((sum, l) => sum + l.periods, 0);
      }
    });

    if (currentGrade) {
      total += currentGradeLoads.reduce((sum, l) => sum + l.periods, 0);
    }
    return total;
  };

  const commitToAssignments = (teacherId: string, grade: string, loads: SubjectLoad[]) => {
    setIsUpdating(true);
    
    const newAssignment: TeacherAssignment = {
      id: `${teacherId}-${grade}`,
      teacherId: teacherId,
      grade: grade,
      loads: loads 
    };

    const baseAssignments = [
      ...assignments.filter(a => !(a.teacherId === teacherId && a.grade === grade)),
      newAssignment
    ];

    setAssignments(baseAssignments);
    
    setTimeout(() => {
      setIsUpdating(false);
      setEditingTeacherId(null);
      setSelectedGrade('');
      setStatus({ type: 'success', message: 'Allocation committed.' });
    }, 400);
  };

  const saveAssignment = () => {
    if (!editingTeacherId || !selectedGrade || editingLoads.length === 0) return;

    const totalLoad = calculateTeacherTotalPeriods(editingTeacherId, selectedGrade, editingLoads);
    if (totalLoad > 28) {
      triggerConfirm(
        `Load Alert: Resulting workload of ${totalLoad} periods exceeds the standard 28-period weekly limit. Do you wish to authorize this manual override?`,
        () => commitToAssignments(editingTeacherId, selectedGrade, editingLoads)
      );
      return;
    }

    commitToAssignments(editingTeacherId, selectedGrade, editingLoads);
  };

  const openBulkModal = (assignment: TeacherAssignment) => {
    setBulkTargetAssignment(assignment);
    setBulkSelectedSubjects(assignment.loads.map(l => l.subject));
    setBulkPeriodCount(assignment.loads[0]?.periods || 1);
    setIsBulkModalOpen(true);
  };

  const saveBulkAllocation = () => {
    if (!bulkTargetAssignment || bulkSelectedSubjects.length === 0) return;

    const newLoads: SubjectLoad[] = bulkSelectedSubjects.map(s => ({
      subject: s,
      periods: bulkPeriodCount
    }));

    const totalLoad = calculateTeacherTotalPeriods(bulkTargetAssignment.teacherId, bulkTargetAssignment.grade, newLoads);
    
    const executeBulkSave = () => {
      const targetSections = config.classes
        .filter(c => getGradeFromClassName(c.name) === bulkTargetAssignment.grade)
        .map(c => c.name);

      const updatedAssignment: TeacherAssignment = {
        ...bulkTargetAssignment,
        loads: newLoads,
        targetSections: targetSections 
      };

      const newAssignments = assignments.map(a => a.id === updatedAssignment.id ? updatedAssignment : a);
      
      setAssignments(newAssignments);
      setIsBulkModalOpen(false);
      setBulkTargetAssignment(null);
      setStatus({ type: 'success', message: `Bulk Subjects allocated to all ${targetSections.length} sections.` });
    };

    if (totalLoad > 28) {
      triggerConfirm(
        `Bulk Load Alert: The resulting teacher workload (${totalLoad} periods) exceeds the institutional cap of 28. Proceed with manual override?`,
        executeBulkSave
      );
      return;
    }

    executeBulkSave();
  };

  const clearAllTeacherAssignments = (teacherId: string) => {
    triggerConfirm("Purge ALL subject allocations for this faculty member across all grades?", () => {
      setAssignments(prev => prev.filter(a => a.teacherId !== teacherId));
      setStatus({ type: 'success', message: 'Faculty load purged successfully.' });
    });
  };

  const deleteGradeAssignment = (assignmentId: string) => {
    triggerConfirm("Remove this specific grade assignment for the faculty member?", () => {
      setAssignments(prev => prev.filter(a => a.id !== assignmentId));
      setStatus({ type: 'success', message: 'Grade assignment removed.' });
    });
  };

  const downloadAssignmentTemplate = () => {
    const grades = (Array.from(new Set(config.classes.map(c => getGradeFromClassName(c.name)))) as string[]).join(',');
    const subjects = config.subjects.map(s => s.name).join(',');

    const xmlContent = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="s62">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#001F3F" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Faculty Allotment">
  <Table ss:ExpandedColumnCount="10" ss:ExpandedRowCount="200">
   <Row ss:StyleID="s62">
    <Cell><Data ss:Type="String">EmployeeID</Data></Cell>
    <Cell><Data ss:Type="String">Grade</Data></Cell>
    <Cell><Data ss:Type="String">Subject 1 Name</Data></Cell>
    <Cell><Data ss:Type="String">Subject 1 Periods</Data></Cell>
    <Cell><Data ss:Type="String">Subject 2 Name</Data></Cell>
    <Cell><Data ss:Type="String">Subject 2 Periods</Data></Cell>
    <Cell><Data ss:Type="String">Subject 3 Name</Data></Cell>
    <Cell><Data ss:Type="String">Subject 3 Periods</Data></Cell>
    <Cell><Data ss:Type="String">Subject 4 Name</Data></Cell>
    <Cell><Data ss:Type="String">Subject 4 Periods</Data></Cell>
   </Row>
  </Table>
  <DataValidation xmlns="urn:schemas-microsoft-com:office:excel">
   <Range>R2C2:R200C2</Range>
   <Type>List</Type>
   <Value>&quot;${grades}&quot;</Value>
  </DataValidation>
  <DataValidation xmlns="urn:schemas-microsoft-com:office:excel">
   <Range>R2C3:R200C3,R2C5:R200C5,R2C7:R200C7,R2C9:R200C9</Range>
   <Type>List</Type>
   <Value>&quot;${subjects}&quot;</Value>
  </DataValidation>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "ihis_faculty_allotment_template.xml";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const newAssignments: TeacherAssignment[] = [];
      let errorCount = 0;

      if (content.trim().startsWith('<?xml')) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, "text/xml");
        const rows = xmlDoc.getElementsByTagName("Row");
        
        for (let i = 0; i < rows.length; i++) {
          const cells = rows[i].getElementsByTagName("Cell");
          const empId = cells[0]?.getElementsByTagName("Data")[0]?.textContent?.trim()?.toLowerCase();
          const grade = cells[1]?.getElementsByTagName("Data")[0]?.textContent?.trim();
          
          if (!empId || empId === 'employeeid' || !grade) continue;

          const teacher = users.find(u => u.employeeId.toLowerCase() === empId);
          if (!teacher) {
            errorCount++;
            continue;
          }

          const loads: SubjectLoad[] = [];
          for (let pair = 0; pair < 4; pair++) {
            const subName = cells[2 + pair * 2]?.getElementsByTagName("Data")[0]?.textContent?.trim();
            const periodsRaw = cells[3 + pair * 2]?.getElementsByTagName("Data")[0]?.textContent?.trim();
            const periods = parseInt(periodsRaw || '0');

            if (subName && periods > 0) {
              const subExists = config.subjects.some(s => s.name === subName);
              if (subExists) {
                loads.push({ subject: subName, periods });
              }
            }
          }

          if (loads.length > 0) {
            newAssignments.push({
              id: `${teacher.id}-${grade}`,
              teacherId: teacher.id,
              grade,
              loads
            });
          } else {
            errorCount++;
          }
        }
      }

      if (newAssignments.length > 0) {
        setAssignments(prev => {
          let updated = [...prev];
          newAssignments.forEach(na => {
            updated = updated.filter(a => !(a.teacherId === na.teacherId && a.grade === na.grade));
            updated.push(na);
          });
          return updated;
        });
        setStatus({ type: 'success', message: `Bulk Import: ${newAssignments.length} allotment records synced. ${errorCount} records skipped.` });
      } else {
        setStatus({ type: 'error', message: "Import Error: No valid faculty allotment records found." });
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="bg-gradient-to-r from-[#001f3f] to-[#003366] rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden border border-[#d4af37]/20">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-xl">
            <h2 className="text-3xl font-black italic tracking-tight mb-2">Faculty Allotment Control</h2>
            <p className="text-amber-100/60 text-xs font-bold uppercase tracking-[0.2em]">Institutional Capacity: 28 Periods Weekly</p>
          </div>
          <div className="flex gap-2 relative z-[100]">
            <button type="button" onClick={() => triggerConfirm("Purge GLOBAL load data? This will clear assignments for EVERY teacher.", () => setAssignments([]))} className="px-6 py-3 bg-red-600 text-white text-[10px] font-black uppercase rounded-xl shadow-lg hover:bg-red-700 transition-colors">Reset Loads</button>
            <div className="flex bg-white/10 p-1 rounded-2xl border border-white/20">
               <button type="button" onClick={downloadAssignmentTemplate} className="px-5 py-2.5 bg-sky-500 text-white text-[10px] font-black uppercase rounded-xl shadow-lg hover:bg-sky-600 transition-colors">Template</button>
               <label className="px-6 py-2.5 bg-amber-400 text-[#001f3f] text-[10px] font-black uppercase rounded-xl cursor-pointer shadow-lg hover:bg-amber-300 transition-all ml-1">
                Bulk Upload
                <input type="file" ref={fileInputRef} accept=".xml" className="hidden" onChange={handleBulkUpload} />
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-[#001f3f] italic">Teaching Loads</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Section: {activeSection}</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center">
          {status && (
            <div className={`px-4 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-right-2 ${status.type === 'error' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
              {status.message}
            </div>
          )}
          <input type="text" placeholder="Search faculty..." value={teacherSearch} onChange={(e) => setTeacherSearch(e.target.value)} className="w-full md:w-64 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-amber-400 shadow-sm" />
          {(isAdmin || isGlobalIncharge) && (
            <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <button type="button" onClick={() => setActiveSection('PRIMARY')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeSection === 'PRIMARY' ? 'bg-[#001f3f] text-[#d4af37]' : 'text-slate-400'}`}>Primary</button>
              <button type="button" onClick={() => setActiveSection('SECONDARY')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeSection === 'SECONDARY' ? 'bg-[#001f3f] text-[#d4af37]' : 'text-slate-400'}`}>Secondary</button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredTeachers.map(teacher => {
          const teacherAssignmentsList = assignments.filter(a => a.teacherId === teacher.id);
          const isEditing = editingTeacherId === teacher.id;
          const totalLoad = calculateTeacherTotalPeriods(teacher.id, isEditing ? selectedGrade : undefined, isEditing ? editingLoads : []);

          return (
            <div key={teacher.id} className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden group">
              <div className="p-8 flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center space-x-5">
                  <div className="w-14 h-14 bg-[#001f3f] text-[#d4af37] rounded-2xl flex items-center justify-center font-black text-xl">{teacher.name.substring(0,2)}</div>
                  <div>
                    <h3 className="text-lg font-black text-[#001f3f] dark:text-white italic">{teacher.name}</h3>
                    <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${totalLoad > 28 ? 'text-red-500 font-bold' : 'text-amber-500'}`}>
                      Estimated Load: {totalLoad} / 28 Periods
                    </p>
                  </div>
                </div>
                <div className="flex space-x-3">
                  {teacherAssignmentsList.length > 0 && !isEditing && (
                    <button 
                      type="button" 
                      onClick={() => clearAllTeacherAssignments(teacher.id)} 
                      className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 transition-colors cursor-pointer"
                    >
                      Purge Load
                    </button>
                  )}
                  <button 
                    type="button" 
                    onClick={() => setEditingTeacherId(isEditing ? null : teacher.id)} 
                    className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all shadow-lg ${isEditing ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-amber-400 text-white'}`}
                  >
                    {isEditing ? 'Cancel' : 'Manage Allotment'}
                  </button>
                </div>
              </div>

              {isEditing && (
                <div className="p-10 border-t border-amber-100 dark:border-slate-800 bg-amber-50/10 space-y-8 animate-in slide-in-from-top-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <select className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-700 outline-none focus:border-amber-400 text-sm font-black uppercase dark:bg-slate-900 dark:text-white" value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}>
                        <option value="">Choose Target Grade...</option>
                        {getTeacherSpecificGrades(teacher).map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                      {editingLoads.map(load => (
                        <div key={load.subject} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-amber-100 dark:border-slate-800 shadow-sm animate-in zoom-in-95">
                          <span className="text-xs font-black uppercase text-[#001f3f] dark:text-white">{load.subject}</span>
                          <div className="flex items-center space-x-3">
                            <span className="text-[9px] font-black text-slate-400 uppercase">Periods:</span>
                            <input type="number" className="w-16 px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-center font-black dark:text-white" value={load.periods} onChange={e => setEditingLoads(prev => prev.map(l => l.subject === load.subject ? { ...l, periods: parseInt(e.target.value) || 0 } : l))} min="1" max="40" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Academic Subjects</p>
                        <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm scale-90">
                           {(['ALL', SubjectCategory.LANGUAGE_2ND, SubjectCategory.LANGUAGE_2ND_SENIOR, SubjectCategory.LANGUAGE_3RD, SubjectCategory.RME] as const).map(cat => (
                             <button 
                               key={cat} 
                               onClick={() => setSubjectFilter(cat)}
                               className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${subjectFilter === cat ? 'bg-[#001f3f] text-[#d4af37]' : 'text-slate-400'}`}
                             >
                               {cat === 'ALL' ? 'All' : cat === SubjectCategory.LANGUAGE_2ND ? '2nd' : cat === SubjectCategory.LANGUAGE_2ND_SENIOR ? 'Sr 2nd' : cat === SubjectCategory.LANGUAGE_3RD ? '3rd' : 'RME'}
                             </button>
                           ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto pr-2">
                        {config.subjects
                          .filter(s => subjectFilter === 'ALL' || s.category === subjectFilter)
                          .map((s: Subject) => (
                            <button type="button" key={s.id} onClick={() => toggleSubject(s.name)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${editingLoads.some(l => l.subject === s.name) ? 'bg-amber-400 text-white border-transparent shadow-md' : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-100 dark:border-slate-700 hover:border-amber-200'}`}>{s.name}</button>
                          ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end pt-4">
                    <button type="button" onClick={saveAssignment} disabled={!selectedGrade || editingLoads.length === 0 || isUpdating} className="bg-[#001f3f] text-[#d4af37] px-12 py-5 rounded-3xl font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all flex items-center space-x-3">
                      {isUpdating ? <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>}
                      <span>Confirm Allotment</span>
                    </button>
                  </div>
                </div>
              )}
              
              <div className="p-8">
                <div className="flex flex-wrap gap-4">
                  {teacherAssignmentsList.map(a => (
                    <div key={a.id} className="bg-slate-50 dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 min-w-[240px] relative group/card hover:border-amber-400 transition-all shadow-sm">
                      <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                         <button 
                          onClick={() => openBulkModal(a)}
                          className="w-7 h-7 flex items-center justify-center bg-emerald-100 text-emerald-600 rounded-full text-[10px] font-black hover:bg-emerald-600 hover:text-white transition-all shadow-md"
                          title="Bulk Allocate Subjects"
                        >
                          +
                        </button>
                        <button 
                          onClick={() => deleteGradeAssignment(a.id)}
                          className="w-7 h-7 flex items-center justify-center bg-red-100 text-red-500 rounded-full text-xs hover:bg-red-500 hover:text-white transition-all shadow-md"
                          title="Delete Assignment"
                        >
                          ×
                        </button>
                      </div>
                      <div className="mb-4">
                        <p className="text-sm font-black text-[#001f3f] dark:text-white uppercase tracking-tighter">{a.grade}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(a.targetSections || []).map(sec => (
                             <span key={sec} className="px-2 py-0.5 bg-sky-50 text-sky-600 rounded-md text-[8px] font-black border border-sky-100 uppercase">{sec}</span>
                          ))}
                          {(!a.targetSections || a.targetSections.length === 0) && (
                             <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-md text-[8px] font-black uppercase">All Sections</span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2 border-t border-slate-200 dark:border-slate-700 pt-3">
                        {a.loads.map(l => (
                          <div key={l.subject} className="flex justify-between items-center text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">
                            <span className="truncate max-w-[120px]">• {l.subject}</span>
                            <span className="text-[#d4af37] bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded border border-amber-100 dark:border-amber-900/40">{l.periods} p/w</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {teacherAssignmentsList.length === 0 && (
                     <div className="w-full py-12 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem]">
                        <p className="text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest">No loads allocated yet</p>
                     </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isBulkModalOpen && bulkTargetAssignment && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-[#001f3f]/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] p-10 shadow-2xl border border-amber-200/20 space-y-8 animate-in zoom-in-95 duration-300 overflow-y-auto max-h-[90vh]">
             <div className="text-center">
                <h4 className="text-2xl font-black text-[#001f3f] dark:text-white uppercase tracking-tight italic">Bulk Subject Allotment</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                  Target Grade: {bulkTargetAssignment.grade} • Allocating to all sections
                </p>
             </div>
             
             <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Standard Periods Per Subject</label>
                    <input 
                      type="number" 
                      className="w-20 px-4 py-2 bg-white dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-center font-black"
                      value={bulkPeriodCount}
                      onChange={e => setBulkPeriodCount(parseInt(e.target.value) || 1)}
                      min="1" max="10"
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select All Relevant Subjects</label>
                    <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-1">
                      {config.subjects.map(s => (
                        <button 
                          key={s.id} 
                          type="button"
                          onClick={() => {
                            if (bulkSelectedSubjects.includes(s.name)) {
                              setBulkSelectedSubjects(prev => prev.filter(x => x !== s.name));
                            } else {
                              setBulkSelectedSubjects(prev => [...prev, s.name]);
                            }
                          }}
                          className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${
                            bulkSelectedSubjects.includes(s.name) 
                              ? 'bg-emerald-500 text-white border-transparent shadow-lg shadow-emerald-200' 
                              : 'bg-white dark:bg-slate-950 text-slate-400 border-slate-100 dark:border-slate-700'
                          }`}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
             </div>

             <div className="flex flex-col space-y-3">
                <button 
                  onClick={saveBulkAllocation}
                  disabled={bulkSelectedSubjects.length === 0}
                  className="w-full bg-[#001f3f] text-[#d4af37] py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] shadow-lg active:scale-95 transition-all disabled:opacity-50"
                >
                  Confirm Bulk Allotment
                </button>
                <button 
                  onClick={() => { setIsBulkModalOpen(false); setBulkTargetAssignment(null); }}
                  className="w-full py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-red-500 transition-colors"
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

export default FacultyAssignmentView;