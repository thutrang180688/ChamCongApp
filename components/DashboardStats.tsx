
import React from 'react';

interface StatsProps {
  totalLeave: number;
  usedLeave: number;
  monthlyWorkDays: number;
  totalCalculatedDays: number;
  targetDays: number;
  completedWorkDays: number;
}

const DashboardStats: React.FC<StatsProps> = ({ 
  totalLeave, 
  usedLeave, 
  totalCalculatedDays,
  targetDays, 
  completedWorkDays 
}) => {
  const remainingLeave = totalLeave - usedLeave;
  const missingDays = Math.max(targetDays - totalCalculatedDays, 0);
  const progress = Math.min((totalCalculatedDays / targetDays) * 100, 100);

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4 mb-6 w-full">
      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100">
        <p className="text-slate-400 text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-1">Đã chấm</p>
        <p className="text-lg md:text-3xl font-black text-indigo-600 leading-none">{completedWorkDays} <span className="text-[10px] md:text-sm font-medium text-slate-400">công</span></p>
      </div>

      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-indigo-100 ring-1 ring-indigo-50/50">
        <p className="text-indigo-600 text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-1">Dự kiến</p>
        <p className="text-lg md:text-3xl font-black text-slate-900 leading-none">{totalCalculatedDays} <span className="text-[10px] md:text-sm font-medium text-slate-400">ngày</span></p>
      </div>

      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100">
        <p className="text-slate-400 text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-1">Cần thêm</p>
        <p className="text-lg md:text-3xl font-black text-rose-500 leading-none">{missingDays} <span className="text-[10px] md:text-sm font-medium text-slate-400">công</span></p>
      </div>

      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100">
        <p className="text-slate-400 text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-1">Phép còn</p>
        <p className="text-lg md:text-3xl font-black text-emerald-500 leading-none">{remainingLeave} <span className="text-[10px] md:text-sm font-medium text-slate-400">ngày</span></p>
      </div>

      <div className="bg-indigo-600 p-4 md:p-6 rounded-2xl shadow-lg border border-indigo-700 text-white col-span-2 md:col-span-1">
        <div className="flex justify-between items-center mb-2">
            <p className="text-indigo-100 text-[8px] md:text-[10px] font-black uppercase tracking-widest">Tiến độ</p>
            <span className="text-[10px] md:text-xs font-black">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-white/20 h-2 md:h-3 rounded-full overflow-hidden">
            <div className="bg-white h-full transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
};

export default DashboardStats;
