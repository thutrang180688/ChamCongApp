import React, { useState, useEffect } from 'react';
import { Cloud, X, Settings, LogOut, User } from 'lucide-react';
import { auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';

interface HeaderProps {
  userName?: string;
}

const Header: React.FC<HeaderProps> = ({ userName }) => {
  const [isCloudConnected, setIsCloudConnected] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const toggleCloudConnection = () => {
    setIsCloudConnected(!isCloudConnected);
  };

  return (
    <div className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 shadow-lg">
      {/* Phần trên: Tiêu đề và trạng thái */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-lg font-normal">Chấm Công 2026</h1>
            <div className="flex items-center gap-1 text-sm opacity-90">
              <button
                onClick={toggleCloudConnection}
                className="flex items-center gap-1 hover:opacity-80 transition"
              >
                {isCloudConnected ? (
                  <>
                    <Cloud size={14} />
                    <span>Đã kết nối cloud</span>
                  </>
                ) : (
                  <>
                    <X size={14} />
                    <span>Mất kết nối</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span className="font-normal">Tối ưu công</span>
          <span className="text-white/50">|</span>
          <span className="font-normal">Lưu trên cloud</span>
          <span className="text-white/50">|</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 font-normal hover:opacity-80"
          >
            <LogOut size={14} />
            <span>Đăng xuất</span>
          </button>
          <button className="p-1 hover:bg-white/20 rounded transition">
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Phần dưới: User info - HIỂN THỊ TÊN TỪ FIREBASE */}
      <div className="pt-2 border-t border-white/20">
        <div className="flex items-center gap-2">
          <div className="bg-white/20 p-1.5 rounded-full">
            <User size={14} />
          </div>
          <div>
            <p className="text-sm font-medium">
              {currentUser?.displayName || currentUser?.email || userName || 'Chưa đăng nhập'}
            </p>
            <p className="text-xs opacity-75">Đang hoạt động</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;