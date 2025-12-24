import React, { useState, useMemo, useRef } from 'react';
import { User, UserRole, SchoolConfig } from '../types.ts';
import { supabase } from '../supabaseClient.ts';

interface UserManagementProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  config: SchoolConfig;
  currentUser: User;
}

interface UserFormData {
  name: string;
  email: string;
  employeeId: string;
  password: string;
  role: UserRole;
  classTeacherOf: string;
}

const UserManagement: React.FC<UserManagementProps> = ({ users, setUsers, config, currentUser }) => {
  const initialForm: UserFormData = {
    name: '',
    email: '',
    employeeId: '',
    password: '',
    role: UserRole.TEACHER_PRIMARY,
    classTeacherOf: ''
  };

  const [formData, setFormData] = useState<UserFormData>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [activeSection, setActiveSection] = useState<'PRIMARY' | 'SECONDARY' | 'ALL'>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | 'none'>('none');
  const [isSyncing, setIsSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = currentUser.role === UserRole.ADMIN;

  const ROLE_DISPLAY_MAP: Record<string, string> = {
    [UserRole.TEACHER_PRIMARY]: 'Primary Faculty',
    [UserRole.TEACHER_SECONDARY]: 'Secondary Faculty',
    [UserRole.TEACHER_SENIOR_SECONDARY]: 'Senior Faculty',
    [UserRole.INCHARGE_PRIMARY]: 'Primary Incharge',
    [UserRole.INCHARGE_SECONDARY]: 'Secondary Incharge',
    [UserRole.INCHARGE_ALL]: 'General Incharge',
    ...(isAdmin ? { [UserRole.ADMIN]: 'Administrator' } : {}),
    [UserRole.ADMIN_STAFF]: 'Admin Staff',
  };

  const getRoleBadgeClasses = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
      case UserRole.INCHARGE_ALL:
        return 'bg-[#001f3f] text-[#d4af37] border-white/10 dark:bg-slate-800 dark:text-amber-400 dark:border-slate-700';
      case UserRole.INCHARGE_PRIMARY:
        return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
      case UserRole.INCHARGE_SECONDARY:
        return 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800';
      case UserRole.TEACHER_PRIMARY:
        return 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800';
      case UserRole.TEACHER_SECONDARY:
        return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800';
      case UserRole.TEACHER_SENIOR_SECONDARY:
        return 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800';
      case UserRole.ADMIN_STAFF:
        return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
    }
  };

  const DISPLAY_TO_ROLE: Record<string, UserRole> = Object.entries(ROLE_DISPLAY_MAP).reduce(
    (acc, [key, val]) => ({ ...acc, [val.toLowerCase()]: key as UserRole }), {}
  );

  const availableClassesForRole = useMemo(() => {
    const role = formData.role;
    const isPrimaryRole = role === UserRole.TEACHER_PRIMARY || role === UserRole.INCHARGE_PRIMARY;
    const isSecondaryRole = role === UserRole.TEACHER_SECONDARY || 
                           role === UserRole.TEACHER_SENIOR_SECONDARY || 
                           role === UserRole.INCHARGE_SECONDARY;
    const isGlobalRole = role === UserRole.INCHARGE_ALL || role === UserRole.ADMIN || role === UserRole.ADMIN_STAFF;

    return config.classes.filter(c => {
      if (isGlobalRole) return true;
      if (isPrimaryRole) return c.section === 'PRIMARY';
      if (isSecondaryRole) return c.section === 'SECONDARY_BOYS' || c.section === 'SECONDARY_GIRLS';
      return true;
    });
  }, [formData.role, config.classes]);

  const filteredTeachers = useMemo(() => {
    let result = users.filter(u => {
      if (!isAdmin && u.role === UserRole.ADMIN) return false;
      if (!isAdmin) {
        if (currentUser.role === UserRole.INCHARGE_PRIMARY) {
          const isPrimary = u.role === UserRole.TEACHER_PRIMARY || u.role === UserRole.INCHARGE_PRIMARY;
          if (!isPrimary && u.id !== currentUser.id) return false;
        } else if (currentUser.role === UserRole.INCHARGE_SECONDARY) {
          const isSecondary = u.role === UserRole.TEACHER_SECONDARY || u.role === UserRole.TEACHER_SENIOR_SECONDARY || u.role === UserRole.INCHARGE_SECONDARY;
          if (!isSecondary && u.id !== currentUser.id) return false;
        }
      }
      if (activeSection !== 'ALL') {
        const isPrimary = u.role === UserRole.TEACHER_PRIMARY || u.role === UserRole.INCHARGE_PRIMARY;
        const isSecondary = u.role === UserRole.TEACHER_SECONDARY || u.role === UserRole.TEACHER_SENIOR_SECONDARY || u.role === UserRole.INCHARGE_SECONDARY;
        if (activeSection === 'PRIMARY' && !isPrimary && u.role !== UserRole.INCHARGE_ALL) return false;
        if (activeSection === 'SECONDARY' && !isSecondary && u.role !== UserRole.INCHARGE_ALL) return false;
      }
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;

      const searchLower = teacherSearch.toLowerCase().trim();
      if (!searchLower) return true;
      return (
        u.name.toLowerCase().includes(searchLower) || 
        u.employeeId.toLowerCase().includes(searchLower) ||
        u.email.toLowerCase().includes(searchLower) ||
        (u.classTeacherOf && u.classTeacherOf.toLowerCase().includes(searchLower))
      );
    });

    if (sortDirection !== 'none') {
      result.sort((a, b) => {
        const idA = a.employeeId.toLowerCase();
        const idB = b.employeeId.toLowerCase();
        if (sortDirection === 'asc') return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
        else return idB.localeCompare(idA, undefined, { numeric: true, sensitivity: 'base' });
      });
    } else {
      result.sort((a, b) => {
        const timeA = a.id.startsWith('usr-') ? parseInt(a.id.split('-')[1]) : 0;
        const timeB = b.id.startsWith('usr-') ? parseInt(b.id.split('-')[1]) : 0;
        return timeB - timeA;
      });
    }
    return result;
  }, [users, activeSection, teacherSearch, currentUser, isAdmin, sortDirection, roleFilter]);

  const toggleSort = () => {
    setSortDirection(prev => {
      if (prev === 'none') return 'asc';
      if (prev === 'asc') return 'desc';
      return 'none';
    });
  };

  const syncUserToCloud = async (u: User) => {
    try {
      await supabase.from('profiles').upsert({
        id: u.id,
        employee_id: u.employeeId,
        name: u.name,
        email: u.email,
        password: u.password,
        role: u.role,
        class_teacher_of: u.classTeacherOf
      });
    } catch (e) {
      console.error("Cloud Error", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isAdmin && formData.role === UserRole.ADMIN) {
      setError("Security Violation: Unauthorized role assignment.");
      return;
    }

    const { name, email, employeeId, password, role, classTeacherOf } = formData;
    const normalizedId = employeeId.toLowerCase().trim();

    if (!name.trim() || !email.trim() || !normalizedId || !password.trim()) {
      setError("Institutional Error: All primary fields including password must be populated.");
      return;
    }

    const isDuplicate = users.some(u => u.id !== editingId && u.employeeId.toLowerCase() === normalizedId);
    if (isDuplicate) {
      setError(`Conflict: Employee ID '${normalizedId}' is already registered.`);
      return;
    }

    if (classTeacherOf) {
      const existingClassTeacher = users.find(u => 
        u.id !== editingId && 
        u.classTeacherOf?.toLowerCase() === classTeacherOf.toLowerCase()
      );
      if (existingClassTeacher) {
        setError(`Security Violation: ${existingClassTeacher.name} is already the Class Teacher of ${classTeacherOf}.`);
        return;
      }
    }

    if (editingId) {
      const targetUser = users.find(u => u.id === editingId);
      if (targetUser?.role === UserRole.ADMIN && !isAdmin) {
        setError("Access Denied: Administrative records are locked.");
        return;
      }

      const updatedUser: User = {
        ...targetUser!,
        name: name.trim(),
        email: email.trim(),
        employeeId: normalizedId,
        password: password.trim(),
        role: role,
        classTeacherOf: classTeacherOf || undefined
      };

      setUsers(prev => prev.map(u => u.id === editingId ? updatedUser : u));
      await syncUserToCloud(updatedUser);
      setEditingId(null);
      setSuccess("Staff record updated successfully in cloud.");
    } else {
      const newUser: User = {
        id: `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: name.trim(),
        email: email.trim(),
        employeeId: normalizedId,
        password: password.trim(),
        role: role,
        classTeacherOf: classTeacherOf || undefined
      };
      setUsers(prev => [newUser, ...prev]);
      await syncUserToCloud(newUser);
      setSuccess("New employee registered in the institutional database.");
    }
    setFormData(initialForm);
  };

  const syncAllToCloud = async () => {
    setIsSyncing(true);
    setSuccess(null);
    setError(null);
    try {
      const payload = users.map(u => ({
        id: u.id,
        employee_id: u.employeeId,
        name: u.name,
        email: u.email,
        password: u.password,
        role: u.role,
        class_teacher_of: u.classTeacherOf
      }));
      const { error: syncError } = await supabase.from('profiles').upsert(payload);
      if (syncError) throw syncError;
      setSuccess(`Global Sync Success: ${users.length} profiles secured in cloud.`);
    } catch (e: any) {
      setError(`Sync Error: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const downloadExcelTemplate = () => {
    const roleList = Object.values(ROLE_DISPLAY_MAP).join(',');
    const xmlContent = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="s62">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000" ss:Bold="1"/>
   <Interior ss:Color="#D4AF37" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Staff Template">
  <Table ss:ExpandedColumnCount="6" ss:ExpandedRowCount="100">
   <Row ss:StyleID="s62">
    <Cell><Data ss:Type="String">EmployeeID</Data></Cell>
    <Cell><Data ss:Type="String">Password</Data></Cell>
    <Cell><Data ss:Type="String">Name</Data></Cell>
    <Cell><Data ss:Type="String">Email</Data></Cell>
    <Cell><Data ss:Type="String">Privilege Role</Data></Cell>
    <Cell><Data ss:Type="String">ClassTeacherOf</Data></Cell>
   </Row>
  </Table>
  <DataValidation xmlns="urn:schemas-microsoft-com:office:excel">
   <Range>R2C5:R100C5</Range>
   <Type>List</Type>
   <Value>&quot;${roleList}&quot;</Value>
  </DataValidation>
 </Worksheet>
</Workbook>`;
    const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = "ihis_staff_template.xml"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const newUsers: User[] = [];
      let skipCount = 0;
      if (content.trim().startsWith('<?xml')) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, "text/xml");
        const rows = xmlDoc.getElementsByTagName("Row");
        for (let i = 0; i < rows.length; i++) {
          const cells = rows[i].getElementsByTagName("Cell");
          const data: string[] = [];
          for (let j = 0; j < 6; j++) {
            const cell = cells[j];
            const dataNode = cell?.getElementsByTagName("Data")[0];
            data.push(dataNode?.textContent?.trim() || "");
          }
          const [empId, pwd, name, email, roleName, classTeacher] = data;
          if (empId.toLowerCase() === 'employeeid') continue;
          if (empId && name && email && pwd) {
            processRecord(empId, pwd, name, email, roleName, classTeacher, newUsers, () => skipCount++);
          }
        }
      }
      if (newUsers.length > 0) {
        setUsers(prev => [...newUsers, ...prev]);
        setSuccess(`Local Import Success: ${newUsers.length} staff loaded. Click "Sync Cloud" to secure them.`);
      } else {
        setError("Import Error: No valid institutional records found.");
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const processRecord = (empId: string, pwd: string, name: string, email: string, roleName: string, classTeacher: string, list: User[], onSkip: () => void) => {
    const normalizedId = empId.toLowerCase();
    const isExisting = users.some(u => u.employeeId.toLowerCase() === normalizedId) || 
                      list.some(u => u.employeeId.toLowerCase() === normalizedId);
    if (isExisting) { onSkip(); return; }
    let finalRole = UserRole.TEACHER_PRIMARY;
    const lookup = roleName.toLowerCase();
    if (DISPLAY_TO_ROLE[lookup]) finalRole = DISPLAY_TO_ROLE[lookup];
    if (finalRole === UserRole.ADMIN && !isAdmin) { onSkip(); return; }
    list.push({
      id: `usr-bulk-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      employeeId: normalizedId,
      password: pwd,
      name, email, role: finalRole,
      classTeacherOf: classTeacher || undefined
    });
  };

  const startEdit = (user: User) => {
    if (user.role === UserRole.ADMIN && !isAdmin) return;
    setEditingId(user.id);
    setFormData({
      name: user.name,
      email: user.email,
      employeeId: user.employeeId,
      password: user.password || '',
      role: user.role,
      classTeacherOf: user.classTeacherOf || ''
    });
    setConfirmDeleteId(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const executeDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetUser = users.find(u => u.id === id);
    if (targetUser?.role === UserRole.ADMIN && !isAdmin) {
      setError("Security: Cannot delete Administrative staff.");
      return;
    }
    if (id === '1') return alert("Security: Root Administrator cannot be removed.");
    
    setUsers(prev => prev.filter(u => u.id !== id));
    try {
      await supabase.from('profiles').delete().eq('id', id);
    } catch (e) {
      console.error("Cloud delete failed", e);
    }
    
    if (editingId === id) { setEditingId(null); setFormData(initialForm); }
    setConfirmDeleteId(null);
    setSuccess("Faculty record has been successfully purged from institutional ledger.");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#001f3f] dark:text-white tracking-tight italic">Faculty Ledger Management</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
            {isAdmin ? 'Master Staff Directory' : `Section Directory: ${ROLE_DISPLAY_MAP[currentUser.role]}`}
          </p>
        </div>
        <div className="flex items-center space-x-3 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 transition-all">
           <button type="button" onClick={syncAllToCloud} disabled={isSyncing} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm flex items-center space-x-2 border ${isSyncing ? 'bg-slate-50 text-slate-400' : 'bg-sky-600 text-white hover:bg-sky-700 active:scale-95'}`}>
             <svg className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
             <span>{isSyncing ? 'Syncing...' : 'Sync Cloud'}</span>
           </button>
           <button type="button" onClick={downloadExcelTemplate} className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-sky-50 text-sky-600 text-[10px] font-black uppercase rounded-xl border border-sky-100 transition-all shadow-sm active:scale-95">Template</button>
           <label className="px-6 py-2.5 bg-[#001f3f] text-[#d4af37] text-[10px] font-black uppercase rounded-xl cursor-pointer hover:bg-slate-900 transition-all shadow-lg border-2 border-transparent hover:border-amber-400/20">
             Bulk Deployment
             <input type="file" ref={fileInputRef} accept=".xml" className="hidden" onChange={handleBulkUpload} />
           </label>
        </div>
      </div>
      
      <div className={`bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border transition-all duration-500 shadow-2xl ${editingId ? 'ring-4 ring-amber-400 border-transparent bg-amber-50/10' : 'border-gray-100 dark:border-slate-800'}`}>
        <div className="flex items-center justify-between mb-8">
           <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${editingId ? 'bg-amber-400 animate-pulse' : 'bg-sky-500'}`}></div>
              <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.4em]">
                {editingId ? 'Modify Faculty Identity' : 'Register New Staff Member'}
              </h3>
           </div>
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setFormData(initialForm); }} className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:underline">Discard</button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-6 items-end">
          <div className="space-y-2">
            <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest">Employee ID</label>
            <input required className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold outline-none dark:text-white" value={formData.employeeId} onChange={e => setFormData({...formData, employeeId: e.target.value})} placeholder="emp101" />
          </div>
          <div className="space-y-2">
            <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest">Password</label>
            <input required type="text" className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold outline-none dark:text-white" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Secure Pwd" />
          </div>
          <div className="space-y-2">
            <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest">Full Name</label>
            <input required className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold outline-none dark:text-white" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Name" />
          </div>
          <div className="space-y-2">
            <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest">Official Email</label>
            <input required type="email" className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold outline-none dark:text-white" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="staff@school.com" />
          </div>
          <div className="space-y-2">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Staff Privilege</label>
            <select className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-[10px] font-black uppercase appearance-none dark:text-white" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole, classTeacherOf: ''})}>
              {Object.entries(ROLE_DISPLAY_MAP).map(([role, label]) => (
                <option key={role} value={role}>{label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest">Class Charge</label>
            <select className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-[10px] font-black uppercase appearance-none dark:text-white" value={formData.classTeacherOf} onChange={e => setFormData({...formData, classTeacherOf: e.target.value})}>
              <option value="">None</option>
              {availableClassesForRole.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <button type="submit" className={`w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all ${editingId ? 'bg-amber-500 text-white' : 'bg-[#001f3f] text-[#d4af37]'}`}>
            {editingId ? 'Commit Update' : 'Commit Registry'}
          </button>
        </form>

        {(error || success) && (
          <div className={`mt-6 p-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-left-4 ${error ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
            {error || success}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
        <div className="p-8 border-b border-gray-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/30">
          <div className="relative max-w-sm w-full">
            <input type="text" placeholder="Search faculty..." className="w-full pl-12 pr-6 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-amber-400 transition-all shadow-sm" value={teacherSearch} onChange={e => setTeacherSearch(e.target.value)} />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-amber-400 shadow-sm dark:text-white">
              <option value="ALL">All Roles</option>
              {Object.entries(ROLE_DISPLAY_MAP).map(([role, label]) => (
                <option key={role} value={role}>{label}</option>
              ))}
            </select>
            <div className="flex bg-white dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              {(['ALL', 'PRIMARY', 'SECONDARY'] as const).map(section => (
                <button key={section} onClick={() => setActiveSection(section)} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeSection === section ? 'bg-[#001f3f] text-[#d4af37]' : 'text-slate-400'}`}>{section}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] bg-slate-50/50 dark:bg-slate-800/50">
                <th className="px-10 py-6" onClick={toggleSort}>
                   <div className="flex items-center space-x-2 cursor-pointer select-none group/sort">
                      <span>Identity (Employee ID)</span>
                      <div className={`transition-all duration-300 ${sortDirection === 'none' ? 'opacity-20' : 'opacity-100 text-[#d4af37]'}`}>
                         {sortDirection === 'desc' ? (
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                         ) : (
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                         )}
                      </div>
                   </div>
                </th>
                <th className="px-10 py-6">Official Contact</th>
                <th className="px-10 py-6">Privilege Level</th>
                <th className="px-10 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {filteredTeachers.map(u => {
                const isEditing = editingId === u.id;
                const isConfirming = confirmDeleteId === u.id;
                const isSelf = u.id === currentUser.id;
                const isTargetAdmin = u.role === UserRole.ADMIN;
                return (
                  <tr key={u.id} className={`transition-all ${isEditing ? 'bg-amber-50/50 dark:bg-amber-900/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'}`}>
                    <td className="px-10 py-8">
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs transition-transform ${isEditing ? 'bg-amber-400 text-[#001f3f]' : 'bg-[#001f3f] text-[#d4af37]'}`}>{u.name.substring(0,2)}</div>
                        <div>
                          <p className="font-black text-sm text-[#001f3f] dark:text-white">{u.name} {isSelf && '(You)'}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{u.employeeId}</p>
                            {u.classTeacherOf && (
                              <span className="text-[8px] font-black text-[#d4af37] border border-[#d4af37]/30 px-1.5 py-0.5 rounded bg-amber-50/5 uppercase tracking-[0.2em]">CT: {u.classTeacherOf}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8 text-xs font-bold text-slate-500 italic dark:text-slate-400">{u.email}</td>
                    <td className="px-10 py-8">
                      <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border shadow-sm ${getRoleBadgeClasses(u.role)}`}>{ROLE_DISPLAY_MAP[u.role] || u.role}</span>
                    </td>
                    <td className="px-10 py-8 text-right space-x-5">
                      {isConfirming ? (
                        <div className="flex items-center justify-end space-x-3">
                           <button type="button" onClick={(e) => executeDelete(u.id, e)} className="bg-red-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase">PURGE</button>
                           <button type="button" onClick={() => setConfirmDeleteId(null)} className="text-slate-400 text-[9px] font-black uppercase">KEEP</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end space-x-5">
                          {(!isTargetAdmin || isAdmin) && (
                            <button type="button" onClick={() => startEdit(u)} className={`text-[10px] font-black uppercase tracking-widest ${isEditing ? 'text-amber-500' : 'text-sky-600 hover:text-sky-800'}`}>{isEditing ? 'EDITING...' : 'UPDATE'}</button>
                          )}
                          {!isSelf && u.id !== '1' && (!isTargetAdmin || isAdmin) && (
                            <button type="button" onClick={() => setConfirmDeleteId(u.id)} className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-700">DELETE</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;