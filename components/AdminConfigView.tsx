import React, { useState, useMemo, useRef } from 'react';
import { SchoolConfig, SectionType, Subject, SchoolClass, SubjectCategory } from '../types.ts';

interface AdminConfigViewProps {
  config: SchoolConfig;
  setConfig: React.Dispatch<React.SetStateAction<SchoolConfig>>;
}

const AdminConfigView: React.FC<AdminConfigViewProps> = ({ config, setConfig }) => {
  const [newSubject, setNewSubject] = useState('');
  const [targetCategory, setTargetCategory] = useState<SubjectCategory>(SubjectCategory.CORE);
  const [newClass, setNewClass] = useState('');
  const [targetSection, setTargetSection] = useState<SectionType>('PRIMARY');
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const classFileInputRef = useRef<HTMLInputElement>(null);

  const SECTION_DISPLAY_MAP: Record<string, SectionType> = {
    'primary wing': 'PRIMARY',
    'secondary (boys)': 'SECONDARY_BOYS',
    'secondary (girls)': 'SECONDARY_GIRLS',
    'primary': 'PRIMARY',
    'secondary boys': 'SECONDARY_BOYS',
    'secondary girls': 'SECONDARY_GIRLS'
  };

  const addSubject = () => {
    if (!newSubject.trim()) return;
    const subject: Subject = { 
      id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, 
      name: newSubject.trim(),
      category: targetCategory
    };
    setConfig(prev => ({ ...prev, subjects: [...prev.subjects, subject] }));
    setNewSubject('');
    setStatus({ type: 'success', message: `Subject "${subject.name}" added to catalog.` });
  };

  const removeSubject = (id: string) => {
    if (confirm("Are you sure you want to remove this subject? This will affect faculty allocations.")) {
      setConfig(prev => ({ ...prev, subjects: prev.subjects.filter(s => s.id !== id) }));
    }
  };

  const addClass = () => {
    if (!newClass.trim()) return;
    const exists = config.classes.some(c => c.name.toLowerCase() === newClass.trim().toLowerCase());
    if (exists) {
      setStatus({ type: 'error', message: `Section "${newClass}" already exists.` });
      return;
    }
    const cls: SchoolClass = { 
      id: `cls-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, 
      name: newClass.trim(), 
      section: targetSection 
    };
    setConfig(prev => ({ ...prev, classes: [...prev.classes, cls] }));
    setNewClass('');
    setStatus({ type: 'success', message: `Section "${cls.name}" deployed successfully.` });
  };

  const removeClass = (id: string, name: string) => {
    setConfig(prev => ({
      ...prev,
      classes: prev.classes.filter(c => {
        if (c.id && id) return c.id !== id;
        return c.name !== name;
      })
    }));
    setConfirmDeleteId(null);
    setStatus({ type: 'success', message: "Class section successfully decommissioned." });
  };

  const downloadClassTemplate = () => {
    const sectionList = "Primary Wing,Secondary (Boys),Secondary (Girls)";
    const xmlContent = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
  </Style>
  <Style ss:ID="s62">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#001F3F" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Campus Infrastructure">
  <Table ss:ExpandedColumnCount="2" ss:ExpandedRowCount="100">
   <Column ss:Width="150"/>
   <Column ss:Width="200"/>
   <Row ss:StyleID="s62">
    <Cell><Data ss:Type="String">ClassName</Data></Cell>
    <Cell><Data ss:Type="String">SectionType</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">I A</Data></Cell>
    <Cell><Data ss:Type="String">Primary Wing</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">IX B</Data></Cell>
    <Cell><Data ss:Type="String">Secondary (Boys)</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">X A</Data></Cell>
    <Cell><Data ss:Type="String">Secondary (Girls)</Data></Cell>
   </Row>
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <Selected/>
   <Panes>
    <Pane>
     <Number>3</Number>
     <ActiveRow>1</ActiveRow>
     <ActiveCol>1</ActiveCol>
    </Pane>
   </Panes>
  </WorksheetOptions>
  <DataValidation xmlns="urn:schemas-microsoft-com:office:excel">
   <Range>R2C2:R100C2</Range>
   <Type>List</Type>
   <Value>&quot;${sectionList}&quot;</Value>
  </DataValidation>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "ihis_campus_template.xml";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClassBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const newClasses: SchoolClass[] = [];
      let skipCount = 0;

      if (content.trim().startsWith('<?xml')) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, "text/xml");
        const rows = xmlDoc.getElementsByTagName("Row");
        
        for (let i = 0; i < rows.length; i++) {
          const cells = rows[i].getElementsByTagName("Cell");
          const name = cells[0]?.getElementsByTagName("Data")[0]?.textContent?.trim();
          const typeDisplay = cells[1]?.getElementsByTagName("Data")[0]?.textContent?.trim()?.toLowerCase();
          
          if (!name || name.toLowerCase() === 'classname') continue;

          const section = SECTION_DISPLAY_MAP[typeDisplay || ''] || 'PRIMARY';
          const exists = config.classes.some(c => c.name.toLowerCase() === name.toLowerCase()) || 
                         newClasses.some(c => c.name.toLowerCase() === name.toLowerCase());

          if (exists) {
            skipCount++;
          } else {
            newClasses.push({
              id: `cls-bulk-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              name,
              section
            });
          }
        }
      }

      if (newClasses.length > 0) {
        setConfig(prev => ({ ...prev, classes: [...prev.classes, ...newClasses] }));
        setStatus({ type: 'success', message: `Bulk Deployment: ${newClasses.length} sections added. ${skipCount} duplicates skipped.` });
      } else {
        setStatus({ type: 'error', message: "Import Error: No valid or new data found in file." });
      }
      if (classFileInputRef.current) classFileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const groupedSubjects = useMemo(() => {
    const groups: Record<SubjectCategory, Subject[]> = {
      [SubjectCategory.CORE]: [],
      [SubjectCategory.LANGUAGE_2ND]: [],
      [SubjectCategory.LANGUAGE_2ND_SENIOR]: [],
      [SubjectCategory.LANGUAGE_3RD]: [],
      [SubjectCategory.RME]: [],
    };
    config.subjects.forEach(s => groups[s.category].push(s));
    return groups;
  }, [config.subjects]);

  const getCategoryTheme = (category: SubjectCategory) => {
    switch (category) {
      case SubjectCategory.CORE:
        return {
          bg: 'bg-indigo-50 dark:bg-indigo-900/20',
          text: 'text-indigo-600 dark:text-indigo-400',
          border: 'border-indigo-100 dark:border-indigo-800',
          accent: 'text-indigo-500',
          description: 'Standard curriculum subjects applicable across all levels.'
        };
      case SubjectCategory.LANGUAGE_2ND:
        return {
          bg: 'bg-amber-50 dark:bg-amber-900/20',
          text: 'text-amber-600 dark:text-amber-400',
          border: 'border-amber-100 dark:border-amber-800',
          accent: 'text-amber-500',
          description: '2nd Lang Block: Hindi/Arabic/Urdu (Grades I-VIII).'
        };
      case SubjectCategory.LANGUAGE_2ND_SENIOR:
        return {
          bg: 'bg-orange-50 dark:bg-orange-900/20',
          text: 'text-orange-600 dark:text-orange-400',
          border: 'border-orange-100 dark:border-orange-800',
          accent: 'text-orange-500',
          description: 'Senior 2nd Lang Block: Hindi/Arabic/Urdu/Malayalam (Grades IX-X).'
        };
      case SubjectCategory.LANGUAGE_3RD:
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-900/20',
          text: 'text-emerald-600 dark:text-emerald-400',
          border: 'border-emerald-100 dark:border-emerald-800',
          accent: 'text-emerald-500',
          description: '3rd Lang Block: Restricted to Grades I-VIII.'
        };
      case SubjectCategory.RME:
        return {
          bg: 'bg-rose-50 dark:bg-rose-900/20',
          text: 'text-rose-600 dark:text-rose-400',
          border: 'border-rose-100 dark:border-rose-800',
          accent: 'text-rose-500',
          description: 'RME Block: Restricted to Grades I-VIII.'
        };
    }
  };

  const toggleTimetableVisibility = () => {
    const newValue = !config.hideTimetableFromTeachers;
    setConfig(prev => ({ ...prev, hideTimetableFromTeachers: newValue }));
    setStatus({ 
      type: 'success', 
      message: `Privacy Policy: Timetable is now ${newValue ? 'HIDDEN' : 'VISIBLE'} to all faculty.` 
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#001f3f] dark:text-white tracking-tight italic">Institutional Configuration</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Admin Only: Define Academic Framework</p>
        </div>
        {status && (
          <div className={`px-6 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-right-4 ${status.type === 'error' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
            {status.message}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-[#001f3f] to-[#003366] p-8 rounded-[2.5rem] shadow-2xl border border-amber-400/20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-5">
            <div className="w-14 h-14 bg-[#d4af37]/20 rounded-2xl flex items-center justify-center border border-[#d4af37]/40">
              <svg className="w-7 h-7 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <div>
              <h3 className="text-lg font-black text-white italic">Privacy & Resource Access Control</h3>
              <p className="text-[9px] font-black text-amber-200/50 uppercase tracking-[0.3em] mt-1">Global Institutional Overrides</p>
            </div>
          </div>
          
          <button 
            onClick={toggleTimetableVisibility}
            className={`flex items-center space-x-4 px-8 py-5 rounded-3xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl active:scale-95 ${
              config.hideTimetableFromTeachers 
                ? 'bg-red-500 text-white shadow-red-900/40' 
                : 'bg-[#d4af37] text-[#001f3f] shadow-amber-900/40'
            }`}
          >
            <span>{config.hideTimetableFromTeachers ? 'Timetable: RESTRICTED' : 'Timetable: PUBLIC'}</span>
            <div className={`w-12 h-6 rounded-full relative transition-colors ${config.hideTimetableFromTeachers ? 'bg-white/20' : 'bg-black/20'}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all ${config.hideTimetableFromTeachers ? 'left-7' : 'left-1'}`}></div>
            </div>
          </button>
        </div>
        <p className="mt-6 text-[10px] font-bold text-white/40 leading-relaxed max-w-2xl italic px-2">
          Enabling "Restricted" mode will immediately block access to the Timetable view for all teachers and non-management staff. Use this during sensitive academic planning or synchronization periods.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">Academic Catalog</h3>
            <span className="text-[9px] font-black bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-400 uppercase">{config.subjects.length} Subjects Total</span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 mb-8 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                placeholder="Subject Name (e.g. Physics)"
                className="flex-1 bg-white dark:bg-slate-900 border-2 border-transparent focus:border-[#d4af37] rounded-2xl px-5 py-4 text-sm font-bold outline-none transition-all dark:text-white shadow-sm"
                value={newSubject}
                onChange={e => setNewSubject(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && addSubject()}
              />
              <select
                className="bg-white dark:bg-slate-900 border-2 border-transparent focus:border-[#d4af37] rounded-2xl px-5 py-4 text-[10px] font-black uppercase outline-none transition-all dark:text-white shadow-sm cursor-pointer"
                value={targetCategory}
                onChange={e => setTargetCategory(e.target.value as SubjectCategory)}
              >
                <option value={SubjectCategory.CORE}>Core Academic</option>
                <option value={SubjectCategory.LANGUAGE_2ND}>2nd Language Block</option>
                <option value={SubjectCategory.LANGUAGE_2ND_SENIOR}>Senior 2nd Lang Block (IX-X)</option>
                <option value={SubjectCategory.LANGUAGE_3RD}>3rd Language Block</option>
                <option value={SubjectCategory.RME}>RME Specialized Block</option>
              </select>
            </div>
            <button 
              onClick={addSubject}
              className="w-full bg-[#001f3f] text-[#d4af37] px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all border border-[#d4af37]/20"
            >
              Authorize & Add Subject
            </button>
          </div>

          <div className="space-y-10">
            {(Object.keys(groupedSubjects) as SubjectCategory[]).map(category => {
              const theme = getCategoryTheme(category);
              const subjects = groupedSubjects[category];
              if (subjects.length === 0) return null;

              return (
                <div key={category} className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <div>
                      <h4 className={`text-[11px] font-black uppercase tracking-[0.2em] ${theme.accent}`}>
                        {category.replace(/_/g, ' ')} Block
                      </h4>
                      <p className="text-[8px] font-bold text-slate-400 uppercase mt-1 italic">{theme.description}</p>
                    </div>
                    <span className={`text-[9px] font-black px-3 py-1 rounded-lg border ${theme.border} ${theme.bg} ${theme.text}`}>
                      {subjects.length} Units
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {subjects.map(s => (
                      <div key={s.id} className={`flex items-center justify-between p-4 ${theme.bg} rounded-2xl border ${theme.border} hover:scale-[1.02] transition-all group relative overflow-hidden shadow-sm`}>
                        <div className="absolute top-0 left-0 w-1 h-full bg-current opacity-20"></div>
                        <span className={`text-xs font-black uppercase tracking-tight ${theme.text}`}>{s.name}</span>
                        <button 
                          onClick={() => removeSubject(s.id)} 
                          className="opacity-0 group-hover:opacity-100 text-red-500 font-black text-[14px] leading-none transition-all hover:scale-125 px-2"
                          title="Remove Subject"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-[10px] font-black text-sky-500 uppercase tracking-[0.4em]">Campus Infrastructure</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{config.classes.length} Active Sections</p>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={downloadClassTemplate}
                className="p-2 bg-slate-50 dark:bg-slate-800 text-sky-600 rounded-xl border border-sky-100 shadow-sm transition-all hover:bg-sky-50"
                title="Download Excel Template"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              </button>
              <label className="bg-[#001f3f] text-[#d4af37] px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer shadow-lg active:scale-95 transition-all">
                Bulk Deployment
                <input type="file" ref={classFileInputRef} accept=".xml" className="hidden" onChange={handleClassBulkUpload} />
              </label>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 mb-8 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                placeholder="Class ID (e.g. XI B)"
                className="flex-1 bg-white dark:bg-slate-900 border-2 border-transparent focus:border-[#d4af37] rounded-2xl px-5 py-4 text-sm font-bold outline-none transition-all dark:text-white shadow-sm"
                value={newClass}
                onChange={e => setNewClass(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && addClass()}
              />
              <select 
                className="bg-white dark:bg-slate-900 border-2 border-transparent focus:border-[#d4af37] rounded-2xl px-5 py-4 text-[10px] font-black uppercase appearance-none outline-none transition-all dark:text-white shadow-sm cursor-pointer"
                value={targetSection}
                onChange={e => setTargetSection(e.target.value as SectionType)}
              >
                <option value="PRIMARY">Primary Wing</option>
                <option value="SECONDARY_BOYS">Secondary (Boys)</option>
                <option value="SECONDARY_GIRLS">Secondary (Girls)</option>
              </select>
            </div>
            <button 
              onClick={addClass}
              className="w-full bg-[#001f3f] text-sky-400 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all border border-sky-900/20"
            >
              Deploy Institutional Section
            </button>
          </div>
          
          <div className="space-y-8">
            {(['PRIMARY', 'SECONDARY_BOYS', 'SECONDARY_GIRLS'] as SectionType[]).map(section => (
              <div key={section} className="space-y-4 bg-slate-50/50 dark:bg-slate-800/30 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{section.replace('_', ' ')}</h4>
                  <span className="text-[8px] font-bold bg-white dark:bg-slate-900 px-2 py-1 rounded-lg text-slate-400 border border-slate-100 dark:border-slate-800 uppercase">
                    {config.classes.filter(c => c.section === section).length} Rooms
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {config.classes.filter(c => c.section === section).map(c => {
                    const identifier = c.id || c.name;
                    const isConfirming = confirmDeleteId === identifier;
                    return (
                      <div 
                        key={identifier} 
                        className={`inline-flex items-center space-x-3 bg-white dark:bg-slate-900 border px-5 py-3 rounded-2xl group transition-all ${isConfirming ? 'border-red-500 bg-red-50' : 'border-slate-200 dark:border-slate-700 hover:border-red-400 hover:shadow-md'}`}
                      >
                        <span className="text-xs font-black text-[#001f3f] dark:text-white tracking-tighter uppercase">{c.name}</span>
                        {isConfirming ? (
                          <div className="flex items-center space-x-2 animate-in zoom-in-95">
                            <button 
                              onClick={() => removeClass(c.id, c.name)} 
                              className="bg-red-500 text-white text-[8px] px-2 py-1 rounded font-black uppercase hover:bg-red-600"
                            >
                              Confirm
                            </button>
                            <button 
                              onClick={() => setConfirmDeleteId(null)} 
                              className="text-slate-400 text-[8px] font-black uppercase hover:underline"
                            >
                              Esc
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setConfirmDeleteId(identifier)} 
                            className="text-red-500 opacity-60 group-hover:opacity-100 transition-all font-black text-[20px] leading-none hover:scale-125 px-1 ml-2"
                            title="Decommission Room"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminConfigView;