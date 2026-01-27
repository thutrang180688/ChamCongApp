import React from 'react';
import { Cloud, Settings, LogOut, User } from 'lucide-react';
import { auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';

interface HeaderProps {
  userName?: string;
}

const Header: React.FC<HeaderProps> = ({ userName }) => {
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 shadow-lg">
      {/* Phần trên: Tiêu đề và trạng thái */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <Cloud size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Bảng Chấm Công 2026</h1>
            <div className="flex items-center gap-2 text-sm opacity-90">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                Đã kết nối cloud
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          <button className="px-3 py-1.5 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition">
            Tối ưu Công
          </button>
          <button className="px-3 py-1.5 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition">
            Lưu trên Cloud
          </button>
        </div>
      </div>

      {/* Phần dưới: User info và actions */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-3 border-t border-white/20">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-full">
            <User size={20} />
          </div>
          <div>
            <p className="font-medium">{userName || 'Người dùng'}</p>
            <p className="text-xs opacity-75">Đang hoạt động</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
          >
            <LogOut size={18} />
            <span className="font-medium">Đăng Xuất</span>
          </button>
          <button className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition">
            <Settings size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Header;