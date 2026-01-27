import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { DayType, AttendanceRecord, UserSettings } from './types';
import { getDaysInMonth, formatId, VIETNAMESE_HOLIDAYS } from './utils/dateUtils';
import DashboardStats from './components/DashboardStats';
import { 
  Calendar,
  Settings,
  X,
  Download,
  Upload,
  CheckCircle2,
  Cpu,
  Chrome,
  Zap,
  FileJson,
  FileCode,
  Signal,
  StickyNote,
  User,
  LogIn,
  LogOut,
  Cloud,
  CloudOff,
  RefreshCw,
  Smartphone,
  Laptop
} from 'lucide-react';

// Firebase imports
import { auth, googleProvider, db } from './firebaseConfig';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc 
} from 'firebase/firestore';

const App: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [settings, setSettings] = useState<UserSettings>({
    userName: 'Người dùng',
    initialAnnualLeave: 12,
    seniorityDays: 0,
    shiftCode: 'X1',
    targetWorkingDays: 24,
    autoSuggest: true,
    lastYearUpdated: new Date().getFullYear()
  });

  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Firebase states
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string>('');
  const [autoSync, setAutoSync] = useState(true);

  const STORAGE_KEY = 'worktrack_pro_local_v1';
  const SETTINGS_KEY = 'worktrack_pro_settings_v1';

  // Thiết lập kênh lắng nghe từ Extension
  useEffect(() => {
    const channel = new BroadcastChannel('worktrack_extension_channel');
    channel.onmessage = (event) => {
      if (event.data.type === 'CLOCK_IN_PING') {
        const todayStr = formatId(new Date());
        setAttendance(prev => ({
          ...prev,
          [todayStr]: {
            ...prev[todayStr],
            type: DayType.WORK,
            isAutoClocked: true,
            isManual: false,
            note: (prev[todayStr]?.note || '') + ' [Extension Auto-Clock]'
          }
        }));
        triggerToast("🚀 Đã nhận tín hiệu chấm công từ Chrome Extension!");
      }
    };
    return () => channel.close();
  }, []);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        triggerToast(`Chào ${currentUser.email}! Đang tải dữ liệu...`);
        loadFromFirestore(currentUser.uid);
      } else {
        // Khi logout, load từ local storage
        const storedData = localStorage.getItem(STORAGE_KEY);
        if (storedData) {
          setAttendance(JSON.parse(storedData));
          triggerToast("Đang sử dụng dữ liệu local");
        }
      }
    });
    
    return () => unsubscribe();
  }, []);

  // Auto-save to Firebase when data changes
  useEffect(() => {
    if (user && autoSync && Object.keys(attendance).length > 0) {
      const timer = setTimeout(() => {
        saveToFirestore();
      }, 3000); // Delay 3 giây để tránh save liên tục
      
      return () => clearTimeout(timer);
    }
  }, [attendance, settings, user, autoSync]);

  // Save to local storage when not logged in
  useEffect(() => {
    if (Object.keys(attendance).length > 0) {
      if (!user) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(attendance));
      }
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [attendance, settings, user]);

  const generateInitialData = useCallback((year: number) => {
    const seed: Record<string, AttendanceRecord> = {};
    for (let m = 0; m < 12; m++) {
      const days = getDaysInMonth(m, year);
      days.forEach(d => {
        const id = formatId(d);
        const dayOfWeek = d.getDay();
        const holidayName = VIETNAMESE_HOLIDAYS[id];
        
        let type = (dayOfWeek === 0 || dayOfWeek === 6) ? DayType.DAY_OFF : DayType.WORK;
        if (holidayName) type = DayType.PUBLIC_HOLIDAY;

        seed[id] = { 
          date: id, 
          type, 
          chromeActiveTime: 0, 
          isAutoClocked: false, 
          isManual: false, 
          note: holidayName || '' 
        };
      });
    }
    return seed;
  }, []);

  // Firebase Functions
  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      triggerToast(`Đã đăng nhập với ${result.user.email}`);
    } catch (error) {
      console.error("Login error:", error);
      triggerToast("Lỗi đăng nhập!");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      triggerToast("Đã đăng xuất");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const loadFromFirestore = async (userId: string) => {
    try {
      const userDocRef = doc(db, 'users', userId);
      const docSnap = await getDoc(userDocRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.attendance) setAttendance(data.attendance);
        if (data.settings) setSettings(data.settings);
        if (data.lastSynced) setLastSynced(data.lastSynced);
        triggerToast("✅ Đã tải dữ liệu từ cloud!");
      } else {
        // First time user, save current data to Firestore
        saveToFirestore();
        triggerToast("👋 Chào mừng! Đã tạo dữ liệu cloud mới.");
      }
    } catch (error) {
      console.error("Load error:", error);
      triggerToast("Lỗi tải dữ liệu từ cloud!");
    }
  };

  const saveToFirestore = async () => {
    if (!user) return;
    
    try {
      setIsSyncing(true);
      const userDocRef = doc(db, 'users', user.uid);
      const syncTime = new Date().toISOString();
      
      await setDoc(userDocRef, {
        attendance,
        settings,
        lastSynced: syncTime,
        email: user.email,
        displayName: settings.userName, // Sử dụng tên từ cài đặt thay vì displayName từ Google
        updatedAt: syncTime
      }, { merge: true });
      
      setLastSynced(syncTime);
      triggerToast("✅ Đã đồng bộ lên cloud!");
    } catch (error) {
      console.error("Save error:", error);
      triggerToast("Lỗi đồng bộ!");
    } finally {
      setIsSyncing(false);
    }
  };

  const downloadExtensionFile = (fileName: string, content: string) => {
    try {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      triggerToast(`Đã tải xuống ${fileName}`);
    } catch (e) {
      console.error(e);
      triggerToast("Lỗi khi tải file!");
    }
  };

  const handleOptimize = () => {
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const newAttendance = { ...attendance };
    const target = settings.targetWorkingDays || 24;
    const todayStr = formatId(new Date());

    const totalAllowedAL = Number(settings.initialAnnualLeave || 0) + Number(settings.seniorityDays || 0);
    const alUsedOtherMonths = Object.keys(attendance).reduce((acc, id) => {
      const d = new Date(id);
      if (d.getFullYear() === currentYear && d.getMonth() !== currentMonth) {
        if (attendance[id].type === DayType.ANNUAL_LEAVE) return acc + 1;
        if (attendance[id].type === DayType.HALF_ANNUAL_LEAVE) return acc + 0.5;
      }
      return acc;
    }, 0);

    let remainingAL = Math.max(0, totalAllowedAL - alUsedOtherMonths);

    daysInMonth.forEach(d => {
      const id = formatId(d);
      if (newAttendance[id]?.isManual) return; 

      const dayOfWeek = d.getDay();
      const holidayName = VIETNAMESE_HOLIDAYS[id];

      // Reset trạng thái tự động cũ để không bị lặp icon
      newAttendance[id] = { ...newAttendance[id], isAutoClocked: false };

      if (holidayName) {
        newAttendance[id] = { ...newAttendance[id], type: DayType.PUBLIC_HOLIDAY, note: holidayName };
      } else if (dayOfWeek === 0) {
        newAttendance[id] = { ...newAttendance[id], type: DayType.DAY_OFF };
      } else if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        newAttendance[id] = { ...newAttendance[id], type: DayType.WORK };
        if (id === todayStr) newAttendance[id].isAutoClocked = true; 
      } else {
        newAttendance[id] = { ...newAttendance[id], type: DayType.DAY_OFF };
      }
    });

    const calculateCurrentTotal = () => daysInMonth.reduce((acc, d) => {
      const id = formatId(d);
      const type = newAttendance[id]?.type;
      if ([DayType.WORK, DayType.PUBLIC_HOLIDAY, DayType.ANNUAL_LEAVE, DayType.SH].includes(type)) return acc + 1;
      if ([DayType.HALF_ANNUAL_LEAVE, DayType.HALF_WORK].includes(type)) return acc + 0.5;
      return acc;
    }, 0);

    let currentTotal = calculateCurrentTotal();
    const saturdays = daysInMonth.filter(d => d.getDay() === 6 && !VIETNAMESE_HOLIDAYS[formatId(d)] && !newAttendance[formatId(d)]?.isManual);

    for (const sat of saturdays) {
      if (currentTotal >= target || remainingAL <= 0) break;
      const id = formatId(sat);
      newAttendance[id] = { ...newAttendance[id], type: DayType.ANNUAL_LEAVE };
      if (id === todayStr) newAttendance[id].isAutoClocked = true;
      currentTotal += 1;
      remainingAL -= 1;
    }

    for (const sat of saturdays) {
      if (currentTotal >= target) break;
      const id = formatId(sat);
      if (newAttendance[id].type === DayType.DAY_OFF) {
        newAttendance[id] = { ...newAttendance[id], type: DayType.WORK };
        if (id === todayStr) newAttendance[id].isAutoClocked = true;
        currentTotal += 1;
      }
    }

    setAttendance(newAttendance);
    triggerToast(`Đã tối ưu: T2-T6 làm việc, bù Thứ 7 cho đủ ${target} công.`);
  };

  const handleExport = () => {
    const data = JSON.stringify({ attendance, settings }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ChamCong_${settings.userName.replace(/\s+/g, '_')}_${formatId(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    triggerToast("Đã xuất file dữ liệu JSON!");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.attendance) setAttendance(parsed.attendance);
        if (parsed.settings) setSettings(parsed.settings);
        triggerToast("Nhập dữ liệu thành công!");
        
        // Auto save to Firebase if logged in
        if (user) {
          setTimeout(() => saveToFirestore(), 1000);
        }
      } catch (err) {
        triggerToast("Lỗi: File không hợp lệ!");
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    const storedSettings = localStorage.getItem(SETTINGS_KEY);
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedSettings) setSettings(JSON.parse(storedSettings));
    if (storedData) {
      setAttendance(JSON.parse(storedData));
    } else {
      setAttendance(generateInitialData(currentDate.getFullYear()));
    }
  }, [generateInitialData]);

  const calendarGrid = useMemo(() => {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const days = getDaysInMonth(month, year);
    const firstDayDate = new Date(year, month, 1);
    const firstDayOfWeek = firstDayDate.getDay(); 
    const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const grid = [];
    for (let i = 0; i < startOffset; i++) grid.push(null);
    return [...grid, ...days];
  }, [currentDate]);

  const stats = useMemo(() => {
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const todayStr = formatId(new Date());
    
    let completedWorkDays = 0;
    let totalCalculatedDays = 0;

    daysInMonth.forEach(date => {
      const id = formatId(date);
      const record = attendance[id];
      if (!record) return;
      const isCountable = [DayType.WORK, DayType.PUBLIC_HOLIDAY, DayType.ANNUAL_LEAVE, DayType.SH].includes(record.type);
      const isHalfCountable = [DayType.HALF_ANNUAL_LEAVE, DayType.HALF_WORK].includes(record.type);

      if (isCountable) {
        totalCalculatedDays += 1;
        if (id <= todayStr) completedWorkDays += 1;
      } else if (isHalfCountable) {
        totalCalculatedDays += 0.5;
        if (id <= todayStr) completedWorkDays += 0.5;
      }
    });

    const usedLeave = Object.values(attendance).reduce((acc: number, r: AttendanceRecord) => {
      const rYear = new Date(r.date).getFullYear();
      if (rYear === currentYear) {
        if (r.type === DayType.ANNUAL_LEAVE) return acc + 1;
        if (r.type === DayType.HALF_ANNUAL_LEAVE) return acc + 0.5;
      }
      return acc;
    }, 0);

    return { 
      totalLeave: Number(settings.initialAnnualLeave || 0) + Number(settings.seniorityDays || 0), 
      usedLeave, totalCalculatedDays, completedWorkDays 
    };
  }, [attendance, currentDate, settings]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const updateDay = (dateStr: string, type: DayType) => {
    setAttendance(prev => ({ 
      ...prev, 
      [dateStr]: { ...prev[dateStr], type, isManual: true, isAutoClocked: false, note: tempNote } 
    }));
    setSelectedDay(null);
  };

  const simulateExtensionPing = () => {
    const channel = new BroadcastChannel('worktrack_extension_channel');
    channel.postMessage({ type: 'CLOCK_IN_PING' });
    channel.close();
  };

  const getDayLabel = (type: DayType) => {
    switch (type) {
      case DayType.WORK: return settings.shiftCode;
      case DayType.HALF_WORK: return `1/2 ${settings.shiftCode}`;
      default: return type;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 safe-top safe-bottom ios-tap-highlight">
      {showToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-slate-800 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 font-bold text-xs md:text-sm animate-in fade-in slide-in-from-top-4 max-w-[90%]">
          <CheckCircle2 className="text-emerald-400 flex-shrink-0" size={14} /> 
          <span className="truncate">{toastMsg}</span>
        </div>
      )}

      <header className="bg-white/95 ios-blur sticky top-0 z-40 px-3 md:px-10 border-b border-slate-200 safe-top">
        <div className="max-w-7xl mx-auto h-16 md:h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="bg-indigo-600 p-2 md:p-2.5 rounded-lg md:rounded-xl text-white shadow-lg">
              <Calendar size={18} className="md:size-20" />
            </div>
            <div className="flex flex-col">
              <h1 className="font-black text-[10px] md:text-xs uppercase text-slate-400 tracking-wider -mb-1">
                Chấm công {currentDate.getFullYear()}
                {user && <span className="text-emerald-500 ml-1 md:ml-2">☁️</span>}
              </h1>
              <p className="font-black text-xs md:text-xl uppercase text-slate-800 tracking-tighter truncate max-w-[140px] md:max-w-md">
                <span className="text-indigo-500">
                  {settings.userName || 'Người dùng'}
                </span>
                {user && <span className="text-[9px] md:text-[10px] text-emerald-400 ml-1">✓</span>}
              </p>
            </div>
          </div>
          
          {/* Desktop: Hiển thị đầy đủ các nút */}
          <div className="hidden md:flex items-center gap-2">
            <button 
              onClick={handleOptimize} 
              className="group flex items-center gap-2 px-4 py-2.5 bg-amber-400 text-white rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-amber-500 transition-all active:scale-95"
            >
              <Zap size={16} fill="white" className="group-hover:animate-bounce" /> Tối ưu
            </button>
            
            {/* Sync Button */}
            {user && (
              <button 
                onClick={saveToFirestore}
                disabled={isSyncing}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all ${isSyncing ? 'bg-slate-400' : 'bg-emerald-400 hover:bg-emerald-500'}`}
              >
                {isSyncing ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Cloud size={14} />
                )}
                {isSyncing ? 'Đang đồng bộ...' : 'Lưu cloud'}
              </button>
            )}
            
            {/* Login/Logout Button */}
            <button 
              onClick={user ? handleLogout : handleGoogleLogin}
              disabled={isLoading}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all ${user ? 'bg-rose-400 hover:bg-rose-500' : 'bg-blue-400 hover:bg-blue-500'} ${isLoading ? 'opacity-50' : ''}`}
            >
              {isLoading ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : user ? (
                <>
                  <LogOut size={14} />
                  Thoát
                </>
              ) : (
                <>
                  <LogIn size={14} />
                  Đăng nhập
                </>
              )}
            </button>
            
            <button 
              onClick={() => setIsSettingsOpen(true)} 
              className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
            >
              <Settings size={22} />
            </button>
          </div>

          {/* Mobile: Hamburger menu cho các nút chức năng */}
          <div className="md:hidden relative">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 bg-slate-100 text-slate-600 rounded-xl"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto flex justify-between gap-1 pb-4 pt-1 overflow-x-auto no-scrollbar px-3 md:px-0">
          {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
            <button 
              key={m} 
              onClick={() => { const d = new Date(currentDate); d.setMonth(m-1); setCurrentDate(d); }}
              className={`min-w-[40px] md:min-w-[65px] flex-1 py-2.5 rounded-lg text-xs md:text-sm font-black border transition-all ${currentDate.getMonth() === m-1 ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-400 border-slate-100'}`}
            >
              {m}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full px-3 md:px-10 py-6 pb-24 safe-bottom">
        <DashboardStats 
          totalLeave={stats.totalLeave} usedLeave={stats.usedLeave} monthlyWorkDays={0}
          totalCalculatedDays={stats.totalCalculatedDays} targetDays={settings.targetWorkingDays} completedWorkDays={stats.completedWorkDays}
        />

        <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden mb-8">
          <div className="p-3 md:p-4 grid grid-cols-7 border-b border-slate-100 bg-slate-50/50 font-black text-[10px] md:text-[10px] text-slate-400 uppercase text-center">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => <div key={d} className={d === 'CN' ? 'text-rose-500' : ''}>{d}</div>)}
          </div>
          <div className="p-2 md:p-4 grid grid-cols-7 gap-1 md:gap-3">
            {calendarGrid.map((date, idx) => {
              if (!date) return <div key={`empty-${idx}`} className="min-h-[75px] md:min-h-[140px] opacity-0" />;
              const id = formatId(date);
              const record = attendance[id];
              const isToday = id === formatId(new Date());
              const holiday = VIETNAMESE_HOLIDAYS[id];
              const isSunday = date.getDay() === 0;
              const hasNote = record?.note && record.note !== holiday;
              
              return (
                <button key={id} onClick={() => { setSelectedDay(id); setTempNote(record?.note || ''); }}
                  className={`min-h-[75px] md:min-h-[140px] p-1.5 md:p-4 rounded-xl md:rounded-3xl border flex flex-col relative text-left transition-all ${
                    [DayType.WORK, DayType.HALF_WORK].includes(record?.type) ? 'bg-white border-slate-100' : 
                    record?.type === DayType.DAY_OFF ? 'bg-rose-50 border-rose-100' : 
                    [DayType.ANNUAL_LEAVE, DayType.HALF_ANNUAL_LEAVE].includes(record?.type) ? 'bg-emerald-50 border-emerald-100' : 
                    record?.type === DayType.PUBLIC_HOLIDAY ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-transparent'
                  } ${isToday ? 'ring-2 ring-indigo-500 shadow-lg z-10' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <span className={`text-sm md:text-xl font-black ${isSunday || holiday ? 'text-rose-500' : 'text-slate-800'}`}>{date.getDate()}</span>
                    {record?.isAutoClocked && isToday && (
                      <div className="bg-indigo-600 text-white p-1 rounded-md shadow-md animate-bounce">
                        <Cpu size={12} className="md:size-14" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-grow mt-1 flex flex-col gap-0.5">
                    {holiday && <span className="text-[7px] md:text-[9px] font-bold text-rose-600 truncate">{holiday}</span>}
                    {hasNote && (
                      <div className="flex items-start gap-1 text-[7px] md:text-[10px] text-slate-500 font-medium italic leading-tight">
                        <StickyNote size={8} className="mt-0.5 flex-shrink-0 text-amber-500" />
                        <span className="line-clamp-2">{record.note}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto pt-1">
                    <span className={`text-[7px] md:text-xs font-black px-1.5 md:px-2 py-0.5 md:py-1 rounded-lg uppercase w-fit inline-block ${
                        [DayType.WORK, DayType.HALF_WORK].includes(record?.type) ? 'bg-indigo-100 text-indigo-700' : 
                        [DayType.ANNUAL_LEAVE, DayType.HALF_ANNUAL_LEAVE].includes(record?.type) ? 'bg-emerald-100 text-emerald-700' : 
                        record?.type === DayType.PUBLIC_HOLIDAY ? 'bg-rose-100 text-rose-700' :
                        'bg-slate-200 text-slate-600'}`}>
                      {getDayLabel(record?.type)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-2 px-4 z-50 shadow-lg safe-bottom">
        <div className="grid grid-cols-4 gap-2">
          <button 
            onClick={handleOptimize}
            className="flex flex-col items-center justify-center p-2 bg-amber-400 text-white rounded-lg active:scale-95"
          >
            <Zap size={18} />
            <span className="text-[9px] font-bold mt-1">Tối ưu</span>
          </button>
          
          {user ? (
            <>
              <button 
                onClick={saveToFirestore}
                disabled={isSyncing}
                className={`flex flex-col items-center justify-center p-2 rounded-lg active:scale-95 ${isSyncing ? 'bg-slate-400' : 'bg-emerald-400'}`}
              >
                {isSyncing ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <Cloud size={18} />
                )}
                <span className="text-[9px] font-bold mt-1">{isSyncing ? 'Đồng bộ...' : 'Lưu'}</span>
              </button>
              
              <button 
                onClick={handleLogout}
                className="flex flex-col items-center justify-center p-2 bg-rose-400 text-white rounded-lg active:scale-95"
              >
                <LogOut size={18} />
                <span className="text-[9px] font-bold mt-1">Thoát</span>
              </button>
            </>
          ) : (
            <button 
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className={`flex flex-col items-center justify-center p-2 rounded-lg active:scale-95 col-span-2 ${isLoading ? 'bg-slate-400' : 'bg-blue-400'}`}
            >
              {isLoading ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <LogIn size={18} />
              )}
              <span className="text-[9px] font-bold mt-1">{isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}</span>
            </button>
          )}
          
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex flex-col items-center justify-center p-2 bg-slate-100 text-slate-600 rounded-lg active:scale-95"
          >
            <Settings size={18} />
            <span className="text-[9px] font-bold mt-1">Cài đặt</span>
          </button>
        </div>
      </div>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsSettingsOpen(false)}>
          <div className="bg-white rounded-[2rem] w-full max-w-2xl p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setIsSettingsOpen(false)} className="absolute top-6 right-6 p-3 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200"><X size={20} className="md:size-24" /></button>
            <h2 className="text-xl md:text-2xl font-black uppercase text-slate-900 mb-6 md:mb-8 flex items-center gap-3"><Settings size={24} className="text-indigo-600" /> Cài đặt & Dữ liệu</h2>
            
            {/* Cloud Sync Section */}
            <div className="mb-6 md:mb-8 p-4 md:p-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-[1.5rem] md:rounded-[2rem] text-white shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="bg-white/20 p-2 md:p-3 rounded-xl md:rounded-2xl"><Cloud size={20} className="md:size-24" /></div>
                  <div>
                    <h3 className="font-black text-xs md:text-sm uppercase">Đồng bộ đám mây</h3>
                    <p className="text-[9px] md:text-[10px] text-blue-100 italic truncate max-w-[180px] md:max-w-none">
                      {user ? `Đang đăng nhập với: ${user.email}` : 'Chưa đăng nhập'}
                    </p>
                  </div>
                </div>
                <div className={`p-2 rounded-lg ${user ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                  {user ? <Cloud size={16} className="md:size-20" /> : <CloudOff size={16} className="md:size-20" />}
                </div>
              </div>
              
              {user ? (
                <div className="space-y-4">
                  <div className="bg-white/10 p-3 md:p-4 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] md:text-[10px] font-black uppercase">Tự động đồng bộ</span>
                      <button 
                        onClick={() => setAutoSync(!autoSync)}
                        className={`w-10 md:w-12 h-5 md:h-6 rounded-full transition-all ${autoSync ? 'bg-emerald-500' : 'bg-slate-400'}`}
                      >
                        <div className={`w-4 md:w-5 h-4 md:h-5 rounded-full bg-white transform transition-transform ${autoSync ? 'translate-x-5 md:translate-x-7' : 'translate-x-1'} mt-0.5`} />
                      </button>
                    </div>
                    <p className="text-[8px] md:text-[9px] text-blue-200">
                      {autoSync ? 'Dữ liệu tự động lưu lên cloud' : 'Chỉ lưu khi nhấn nút'}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 md:gap-3">
                    <button 
                      onClick={saveToFirestore}
                      disabled={isSyncing}
                      className="bg-white/10 p-3 md:p-4 rounded-xl hover:bg-white/20 transition-all flex flex-col items-center gap-2 border border-white/10 disabled:opacity-50"
                    >
                      {isSyncing ? (
                        <RefreshCw size={16} className="animate-spin md:size-18" />
                      ) : (
                        <Cloud size={16} className="md:size-18" />
                      )}
                      <span className="text-[9px] md:text-[10px] font-black uppercase">
                        {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
                      </span>
                    </button>
                    
                    <button 
                      onClick={() => user && loadFromFirestore(user.uid)}
                      className="bg-white/10 p-3 md:p-4 rounded-xl hover:bg-white/20 transition-all flex flex-col items-center gap-2 border border-white/10"
                    >
                      <RefreshCw size={16} className="md:size-18" />
                      <span className="text-[9px] md:text-[10px] font-black uppercase">Tải từ cloud</span>
                    </button>
                  </div>
                  
                  {lastSynced && (
                    <div className="text-[8px] md:text-[9px] text-center text-blue-200 mt-2">
                      Đồng bộ lần cuối: {new Date(lastSynced).toLocaleString('vi-VN')}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-3 md:py-4">
                  <p className="text-sm mb-3 md:mb-4">Đăng nhập để đồng bộ dữ liệu giữa các thiết bị</p>
                  <button 
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="bg-white text-blue-600 px-5 md:px-6 py-2.5 md:py-3 rounded-xl font-black text-xs md:text-sm uppercase hover:bg-blue-50 transition-all flex items-center gap-2 md:gap-3 mx-auto"
                  >
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4 md:w-5 md:h-5" />
                    {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập với Google'}
                  </button>
                  <p className="text-[8px] md:text-[9px] text-blue-200 mt-3 md:mt-4">
                    ✓ Dữ liệu an toàn trên Google Cloud<br />
                    ✓ Đồng bộ tự động giữa máy tính & điện thoại<br />
                    ✓ Miễn phí đến 1GB storage
                  </p>
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 mb-6 md:mb-8 flex flex-col gap-4">
               <div className="flex items-center gap-3 md:gap-4 border-b border-slate-200 pb-3 md:pb-4">
                  <div className="bg-indigo-600 p-2 md:p-3 rounded-xl md:rounded-2xl text-white"><User size={20} className="md:size-24" /></div>
                  <div className="flex-1">
                    <label className="text-[10px] md:text-[10px] font-black text-slate-400 uppercase block mb-1">Họ và tên người chấm công</label>
                    <input type="text" value={settings.userName} onChange={(e) => setSettings({...settings, userName: e.target.value})} placeholder="Nhập tên của bạn..." className="w-full bg-transparent text-lg md:text-xl font-black text-slate-900 outline-none placeholder:text-slate-300" />
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <button onClick={handleExport} className="flex flex-col items-center gap-2 md:gap-3 p-3 md:p-4 bg-white rounded-xl md:rounded-2xl border border-slate-200 text-indigo-600 hover:bg-indigo-50 transition-all active:scale-95">
                    <Download size={20} className="md:size-24" />
                    <span className="font-black text-[9px] md:text-[9px] uppercase">Xuất JSON</span>
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 md:gap-3 p-3 md:p-4 bg-white rounded-xl md:rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all active:scale-95">
                    <Upload size={20} className="md:size-24" />
                    <span className="font-black text-[9px] md:text-[9px] uppercase">Nhập JSON</span>
                    <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".json" />
                  </button>
               </div>
            </div>

            <div className="mb-6 md:mb-8 p-4 md:p-6 bg-indigo-600 rounded-[1.5rem] md:rounded-[2rem] text-white shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="bg-white/20 p-2 md:p-3 rounded-xl md:rounded-2xl"><Chrome size={20} className="md:size-24" /></div>
                  <div>
                    <h3 className="font-black text-xs md:text-sm uppercase">Tiện ích Chrome</h3>
                    <p className="text-[9px] md:text-[10px] text-indigo-100 italic">Nhấn để tải từng file</p>
                  </div>
                </div>
                <button onClick={simulateExtensionPing} className="p-2 md:p-3 bg-white/20 rounded-lg md:rounded-xl hover:bg-white/30 transition-all flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase">
                   <Signal size={14} className="md:size-16" /> Thử kết nối
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 md:gap-3 mb-4 text-[9px] md:text-[10px] font-black uppercase">
                <button 
                  onClick={() => downloadExtensionFile('manifest.json', JSON.stringify({
                    "manifest_version": 3,
                    "name": "WorkTrack Auto-Clock",
                    "version": "1.0",
                    "description": "Tự động gửi tín hiệu chấm công khi mở trình duyệt",
                    "permissions": ["storage", "alarms"],
                    "background": { "service_worker": "background.js" }
                  }, null, 2))}
                  className="bg-white/10 p-3 md:p-4 rounded-xl hover:bg-white/20 transition-all flex items-center justify-center gap-2 border border-white/10"
                >
                  <FileJson size={16} className="md:size-18"/> manifest.json
                </button>
                <button 
                  onClick={() => downloadExtensionFile('background.js', `// Kênh kết nối ảo đến App\nconst channel = new BroadcastChannel('worktrack_extension_channel');\n\nchrome.runtime.onInstalled.addListener(() => {\n  console.log("WorkTrack Extension Active");\n  pingApp();\n});\n\nfunction pingApp() {\n  channel.postMessage({ type: 'CLOCK_IN_PING' });\n}\n\n// Kiểm tra mỗi 60p\nchrome.alarms.create('checkPing', { periodInMinutes: 60 });\nchrome.alarms.onAlarm.addListener(() => pingApp());`)}
                  className="bg-white/10 p-3 md:p-4 rounded-xl hover:bg-white/20 transition-all flex items-center justify-center gap-2 border border-white/10"
                >
                  <FileCode size={16} className="md:size-18"/> background.js
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
               <div className="bg-slate-50 p-3 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100">
                <label className="text-[10px] md:text-[10px] font-black text-slate-400 uppercase block mb-1">Mã ca làm</label>
                <input type="text" value={settings.shiftCode} onChange={(e) => setSettings({...settings, shiftCode: e.target.value.toUpperCase()})} className="w-full bg-transparent text-xl md:text-2xl font-black text-indigo-600 outline-none" />
              </div>
              <div className="bg-slate-50 p-3 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100">
                <label className="text-[10px] md:text-[10px] font-black text-slate-400 uppercase block mb-1">Mục tiêu công</label>
                <input type="number" value={settings.targetWorkingDays} onChange={(e) => setSettings({...settings, targetWorkingDays: Number(e.target.value)})} className="w-full bg-transparent text-xl md:text-2xl font-black text-rose-500 outline-none" />
              </div>
              <div className="bg-slate-50 p-3 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100">
                <label className="text-[10px] md:text-[10px] font-black text-slate-400 uppercase block mb-1">Phép năm</label>
                <input type="number" value={settings.initialAnnualLeave} onChange={(e) => setSettings({...settings, initialAnnualLeave: Number(e.target.value)})} className="w-full bg-transparent text-xl md:text-2xl font-black text-emerald-500 outline-none" />
              </div>
              <div className="bg-slate-50 p-3 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100">
                <label className="text-[10px] md:text-[10px] font-black text-slate-400 uppercase block mb-1">Thâm niên</label>
                <input type="number" value={settings.seniorityDays} onChange={(e) => setSettings({...settings, seniorityDays: Number(e.target.value)})} className="w-full bg-transparent text-xl md:text-2xl font-black text-emerald-500 outline-none" />
              </div>
            </div>

            <button onClick={() => setIsSettingsOpen(false)} className="w-full bg-slate-900 text-white font-black py-4 md:py-6 rounded-2xl md:rounded-3xl text-sm uppercase shadow-2xl transition-all active:scale-95">Lưu & Đóng</button>
          </div>
        </div>
      )}

      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 safe-bottom" onClick={() => setSelectedDay(null)}>
          <div className="bg-white w-full max-w-xl rounded-t-[2rem] md:rounded-[3rem] p-6 md:p-8 pb-12 md:pb-12 shadow-2xl animate-in slide-in-from-bottom" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base md:text-lg font-black text-slate-900 uppercase mb-4 md:mb-6 text-center tracking-tight">Cài đặt ngày {selectedDay}</h3>
            <div className="grid grid-cols-3 gap-2 mb-4 md:mb-6 overflow-y-auto max-h-[40vh] p-1">
                {[
                  DayType.WORK, DayType.HALF_WORK, 
                  DayType.ANNUAL_LEAVE, DayType.HALF_ANNUAL_LEAVE, 
                  DayType.PUBLIC_HOLIDAY, DayType.DAY_OFF, DayType.SH
                ].map(type => (
                    <button key={type} onClick={() => updateDay(selectedDay, type)} 
                        className={`py-3 md:py-4 rounded-xl md:rounded-2xl border-2 font-black text-[9px] md:text-[10px] uppercase transition-all ${attendance[selectedDay]?.type === type ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-50 bg-slate-50 text-slate-400'}`}>
                        {getDayLabel(type)}
                    </button>
                ))}
            </div>
            <textarea value={tempNote} onChange={(e) => setTempNote(e.target.value)} placeholder="Nhập ghi chú (sẽ hiển thị trên lịch)..." className="w-full bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl p-3 md:p-4 text-sm font-bold outline-none mb-4 md:mb-6 h-20 md:h-24 resize-none focus:ring-2 ring-indigo-500/20" />
            <button onClick={() => updateDay(selectedDay, attendance[selectedDay]?.type || DayType.WORK)} className="w-full bg-slate-900 text-white font-black py-3 md:py-5 rounded-xl md:rounded-2xl text-sm uppercase shadow-xl transition-all active:scale-95">Lưu thay đổi</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;