
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { DayType, AttendanceRecord, UserSettings } from './types';
import { getDaysInMonth, formatId, VIETNAMESE_HOLIDAYS } from './utils/dateUtils';
import DashboardStats from './components/DashboardStats';
import { 
  Calendar,
  Settings,
  X,
  CheckCircle2,
  Zap,
  StickyNote,
  User,
  Cloud,
  CloudOff,
  LogIn,
  LogOut,
  RefreshCw,
  Lock
} from 'lucide-react';

import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc 
} from "firebase/firestore";

// Firebase configuration (User should replace with their own)
const firebaseConfig = {
  apiKey: "AIzaSyAspKG80Ld1T4yg2tQfh0gIIVY0L1pV_qE",
  authDomain: "chamcongonline-7df7f.firebaseapp.com",
  projectId: "chamcongonline-7df7f",
  storageBucket: "chamcongonline-7df7f.firebasestorage.app",
  messagingSenderId: "80878628372",
  appId: "1:80878628372:web:480137f9899e7997aa8101"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const googleProvider = new GoogleAuthProvider();

const App: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [settings, setSettings] = useState<UserSettings>({
    userName: 'Người dùng',
    initialAnnualLeave: 12,
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

  const STORAGE_KEY = 'worktrack_pro_local_v1';
  const SETTINGS_KEY = 'worktrack_pro_settings_v1';

  // Remove BroadcastChannel useEffect
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

  const handleOptimize = () => {
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const newAttendance = { ...attendance };
    const target = settings.targetWorkingDays || 24;
    const todayStr = formatId(new Date());

    const totalAllowedAL = Number(settings.initialAnnualLeave || 0);
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

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      setIsAuthModalOpen(false);
      triggerToast(`Chào mừng, ${result.user.displayName}!`);
      fetchCloudData(result.user.uid);
    } catch (err: any) {
      triggerToast("Đăng nhập thất bại: " + err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      triggerToast("Đã đăng xuất.");
    } catch (err: any) {
      triggerToast("Đăng xuất thất bại.");
    }
  };

  const fetchCloudData = async (uid: string) => {
    setIsSyncing(true);
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.attendance) setAttendance(data.attendance);
        if (data.settings) setSettings(data.settings);
        triggerToast("Đã đồng bộ dữ liệu từ đám mây.");
      }
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const syncToCloud = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        attendance,
        settings,
        lastSynced: new Date().toISOString()
      }, { merge: true });
      triggerToast("Đã lưu dữ liệu lên đám mây.");
    } catch (err) {
      triggerToast("Đồng bộ thất bại.");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchCloudData(currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, []);

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

  useEffect(() => {
    if (Object.keys(attendance).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(attendance));
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [attendance, settings]);

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
      totalLeave: Number(settings.initialAnnualLeave || 0), 
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

  const getDayLabel = (type: DayType) => {
    switch (type) {
      case DayType.WORK: return settings.shiftCode;
      case DayType.HALF_WORK: return `1/2 ${settings.shiftCode}`;
      default: return type;
    }
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-50 overflow-hidden">
      {showToast && (
        <div className="fixed top-[calc(env(safe-area-inset-top)+1rem)] left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 font-bold text-[10px] md:text-xs animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="text-emerald-400" size={14} /> {toastMsg}
        </div>
      )}

      <header className="bg-white/95 ios-blur sticky top-0 z-40 px-4 md:px-6 border-b border-slate-200 pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto h-12 md:h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white shadow-md"><Calendar size={16} /></div>
            <div className="flex flex-col">
              <h1 className="font-black text-[8px] uppercase text-slate-400 tracking-wider -mb-0.5">Chấm công {currentDate.getFullYear()}</h1>
              <p className="font-black text-xs md:text-base uppercase text-slate-900 tracking-tighter truncate max-w-[120px] md:max-w-md">
                <span className="text-indigo-600">{settings.userName || 'Người dùng'}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleOptimize} className="group flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg font-black text-[8px] uppercase shadow-md hover:bg-amber-600 transition-all active:scale-95">
              <Zap size={12} fill="white" className="group-hover:animate-bounce" /> Tối ưu
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">
              <Settings size={18} />
            </button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto flex justify-between gap-1 pb-2 pt-1 overflow-x-auto no-scrollbar">
          {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
            <button key={m} onClick={() => { const d = new Date(currentDate); d.setMonth(m-1); setCurrentDate(d); }}
              className={`min-w-[35px] md:min-w-[50px] flex-1 py-1.5 rounded-md text-[10px] md:text-xs font-black border transition-all ${currentDate.getMonth() === m-1 ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-400 border-slate-100'}`}
            >{m}</button>
          ))}
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 md:px-6 py-2 pb-[env(safe-area-inset-bottom)] overflow-hidden flex flex-col">
        <div className="mb-2">
          <DashboardStats 
            totalLeave={stats.totalLeave} usedLeave={stats.usedLeave} monthlyWorkDays={0}
            totalCalculatedDays={stats.totalCalculatedDays} targetDays={settings.targetWorkingDays} completedWorkDays={stats.completedWorkDays}
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden flex-grow flex flex-col">
          <div className="p-2 grid grid-cols-7 border-b border-slate-100 bg-slate-50/50 font-black text-[8px] text-slate-400 uppercase text-center">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => <div key={d} className={d === 'CN' ? 'text-rose-500' : ''}>{d}</div>)}
          </div>
          <div className="p-1 md:p-2 grid grid-cols-7 gap-0.5 md:gap-1 flex-grow">
            {calendarGrid.map((date, idx) => {
              if (!date) return <div key={`empty-${idx}`} className="h-full opacity-0" />;
              const id = formatId(date);
              const record = attendance[id];
              const isToday = id === formatId(new Date());
              const holiday = VIETNAMESE_HOLIDAYS[id];
              const isSunday = date.getDay() === 0;
              const hasNote = record?.note && record.note !== holiday;
              
              return (
                <button key={id} onClick={() => { setSelectedDay(id); setTempNote(record?.note || ''); }}
                  className={`h-full min-h-0 p-1 md:p-2 rounded-lg md:rounded-xl border flex flex-col relative text-left transition-all ${
                    [DayType.WORK, DayType.HALF_WORK].includes(record?.type) ? 'bg-white border-slate-100' : 
                    record?.type === DayType.DAY_OFF ? 'bg-rose-50 border-rose-100' : 
                    [DayType.ANNUAL_LEAVE, DayType.HALF_ANNUAL_LEAVE].includes(record?.type) ? 'bg-emerald-50 border-emerald-100' : 
                    record?.type === DayType.PUBLIC_HOLIDAY ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-transparent'
                  } ${isToday ? 'ring-1 ring-indigo-500 shadow-md z-10' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <span className={`text-[10px] md:text-sm font-black ${isSunday || holiday ? 'text-rose-500' : 'text-slate-800'}`}>{date.getDate()}</span>
                  </div>
                  
                  <div className="flex-grow mt-0.5 flex flex-col gap-0">
                    {holiday && <span className="text-[6px] md:text-[8px] font-bold text-rose-600 truncate leading-tight">{holiday}</span>}
                    {hasNote && (
                      <div className="flex items-start gap-0.5 text-[6px] md:text-[8px] text-slate-500 font-medium italic leading-tight">
                        <StickyNote size={6} className="mt-0.5 flex-shrink-0 text-amber-500" />
                        <span className="line-clamp-1">{record.note}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto pt-0.5">
                    <span className={`text-[6px] md:text-[10px] font-black px-1 py-0 rounded-md uppercase w-fit inline-block ${
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

      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsSettingsOpen(false)}>
          <div className="bg-white rounded-[2rem] w-full max-w-lg p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setIsSettingsOpen(false)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200"><X size={20} /></button>
            <h2 className="text-xl font-black uppercase text-slate-900 mb-6 flex items-center gap-2"><Settings size={24} className="text-indigo-600" /> Cài đặt</h2>
            
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6 flex flex-col gap-4">
               <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                  <div className="bg-indigo-600 p-2 rounded-xl text-white"><User size={20} /></div>
                  <div className="flex-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Họ và tên</label>
                    <input type="text" value={settings.userName} onChange={(e) => setSettings({...settings, userName: e.target.value})} placeholder="Nhập tên..." className="w-full bg-transparent text-lg font-black text-slate-900 outline-none placeholder:text-slate-300" />
                  </div>
               </div>
                              <div className="flex flex-col gap-2">
                  <label className="text-[8px] font-black text-slate-400 uppercase block">Đồng bộ đám mây</label>
                  {!user ? (
                    <button onClick={() => setIsAuthModalOpen(true)} className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95">
                      <LogIn size={16} /> Đăng nhập Google
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-2">
                          {user.photoURL ? (
                            <img src={user.photoURL} className="w-6 h-6 rounded-full" alt="avatar" />
                          ) : (
                            <Cloud size={16} className="text-emerald-500" />
                          )}
                          <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{user.displayName || user.email}</span>
                        </div>
                        <button onClick={handleLogout} className="text-rose-500 hover:text-rose-600 transition-colors">
                          <LogOut size={16} />
                        </button>
                      </div>
                      <button onClick={syncToCloud} disabled={isSyncing} className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 disabled:opacity-50">
                        <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} /> {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
                      </button>
                    </div>
                  )}
               </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
               <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Mã ca làm</label>
                <input type="text" value={settings.shiftCode} onChange={(e) => setSettings({...settings, shiftCode: e.target.value})} className="w-full bg-transparent text-xl font-black text-indigo-600 outline-none" />
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Mục tiêu công</label>
                <input type="number" value={settings.targetWorkingDays} onChange={(e) => setSettings({...settings, targetWorkingDays: Number(e.target.value)})} className="w-full bg-transparent text-xl font-black text-rose-500 outline-none" />
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2">
                <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Phép năm (có thể nhập số lẻ)</label>
                <input type="number" step="0.5" value={settings.initialAnnualLeave} onChange={(e) => setSettings({...settings, initialAnnualLeave: Number(e.target.value)})} className="w-full bg-transparent text-xl font-black text-emerald-500 outline-none" />
              </div>
            </div>

            <button onClick={() => setIsSettingsOpen(false)} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl text-xs uppercase shadow-xl transition-all active:scale-95">Lưu & Đóng</button>
          </div>
        </div>
      )}

      {isAuthModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsAuthModalOpen(false)}>
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-8 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setIsAuthModalOpen(false)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200"><X size={20} /></button>
            <div className="flex flex-col items-center mb-8">
              <div className="bg-indigo-600 p-4 rounded-3xl text-white mb-4 shadow-xl"><Lock size={32} /></div>
              <h2 className="text-2xl font-black uppercase text-slate-900 tracking-tight">Đồng bộ Google</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1 text-center">Sử dụng tài khoản Google để lưu trữ dữ liệu vĩnh viễn</p>
            </div>

            <button onClick={handleGoogleLogin} className="flex items-center justify-center gap-3 w-full bg-white border-2 border-slate-100 text-slate-700 font-black py-4 rounded-2xl text-xs uppercase shadow-sm transition-all active:scale-95 hover:bg-slate-50">
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="google" />
              Tiếp tục với Google
            </button>

            <p className="mt-6 text-[10px] text-slate-400 font-bold text-center uppercase leading-relaxed">
              Dữ liệu của bạn sẽ được lưu trữ an toàn trên hệ thống đám mây của Google Firebase.
            </p>
          </div>
        </div>
      )}

      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setSelectedDay(null)}>
          <div className="bg-white w-full max-w-xl rounded-t-[3rem] md:rounded-[3rem] p-8 pb-[calc(env(safe-area-inset-bottom)+2rem)] shadow-2xl animate-in slide-in-from-bottom" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-900 uppercase mb-6 text-center tracking-tight">Cài đặt ngày {selectedDay}</h3>
            <div className="grid grid-cols-3 gap-2 mb-6 overflow-y-auto max-h-[40vh] p-1">
                {[
                  DayType.WORK, DayType.HALF_WORK, 
                  DayType.ANNUAL_LEAVE, DayType.HALF_ANNUAL_LEAVE, 
                  DayType.PUBLIC_HOLIDAY, DayType.DAY_OFF, DayType.SH
                ].map(type => (
                    <button key={type} onClick={() => updateDay(selectedDay, type)} 
                        className={`py-4 rounded-2xl border-2 font-black text-[10px] uppercase transition-all ${attendance[selectedDay]?.type === type ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-50 bg-slate-50 text-slate-400'}`}>
                        {getDayLabel(type)}
                    </button>
                ))}
            </div>
            <textarea value={tempNote} onChange={(e) => setTempNote(e.target.value)} placeholder="Nhập ghi chú (sẽ hiển thị trên lịch)..." className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none mb-6 h-24 resize-none focus:ring-2 ring-indigo-500/20" />
            <button onClick={() => updateDay(selectedDay, attendance[selectedDay]?.type || DayType.WORK)} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl text-sm uppercase shadow-xl transition-all active:scale-95">Lưu thay đổi</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
