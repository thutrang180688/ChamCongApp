import React, { useState, useEffect } from 'react';
import { Calendar, Clock, TrendingUp, CheckCircle, XCircle, RefreshCw, CloudOff } from 'lucide-react';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import Header from './components/Header';

function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [totalDays, setTotalDays] = useState(24);
  const [workedDays, setWorkedDays] = useState(19.5);
  const [remainingLeave, setRemainingLeave] = useState(12);
  const [isConnected, setIsConnected] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return unsubscribe;
  }, []);

  const progress = (workedDays / totalDays) * 100;

  const daysInMonth = 31;
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const toggleConnection = () => {
    setIsConnected(!isConnected);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const monthYear = currentDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header Component - TRUYỀN USER NAME */}
      <Header userName={user?.displayName || user?.email || ''} />

      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">ĐÃ CHẤM</p>
                <p className="text-2xl font-bold text-blue-600">{workedDays} công</p>
              </div>
              <CheckCircle className="text-green-500" size={24} />
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">ĐỦ ĐIỀU KIỆN</p>
                <p className="text-2xl font-bold text-green-600">{totalDays} ngày</p>
              </div>
              <Calendar className="text-green-500" size={24} />
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">CẦN THÊM</p>
                <p className="text-2xl font-bold text-amber-600">{Math.max(0, totalDays - workedDays)} công</p>
              </div>
              <TrendingUp className="text-amber-500" size={24} />
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">PHÉP CÒN LẠI</p>
                <p className="text-2xl font-bold text-purple-600">{remainingLeave} ngày</p>
              </div>
              <Clock className="text-purple-500" size={24} />
            </div>
          </div>
        </div>

        {/* Progress and Calendar */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Progress Section */}
          <div className="md:col-span-2 bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Tiến độ tháng {monthYear}</h2>
              <button 
                onClick={toggleConnection}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
              >
                {isConnected ? (
                  <>
                    <CheckCircle size={16} />
                    <span>Đang đồng bộ</span>
                  </>
                ) : (
                  <>
                    <CloudOff size={16} />
                    <span>Ngắt kết nối</span>
                  </>
                )}
              </button>
            </div>
            
            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Hoàn thành</span>
                <span className="font-semibold">{progress.toFixed(1)}%</span>
              </div>
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="flex justify-between mt-2 text-sm text-gray-500">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Calendar */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">Lịch chấm công</h3>
              <div className="grid grid-cols-7 gap-2">
                {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day) => (
                  <div key={day} className="text-center font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}
                
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-12"></div>
                ))}
                
                {daysArray.map((day) => {
                  const isWorked = day <= workedDays * (31 / totalDays);
                  const isToday = day === currentDate.getDate();
                  return (
                    <div key={day} className={`h-12 rounded-lg flex flex-col items-center justify-center ${
                      isToday ? 'bg-blue-100 border-2 border-blue-500' :
                      isWorked ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      <span className={`font-medium ${isToday ? 'text-blue-700' : ''}`}>{day}</span>
                      {isWorked && (
                        <div className="flex gap-0.5 mt-1">
                          <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                          <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            {/* Date Info */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Hôm nay</h3>
                <RefreshCw className="text-gray-400" size={20} />
              </div>
              <p className="text-gray-600 mb-2">{formatDate(currentDate)}</p>
              <div className="flex items-center gap-2">
                <Clock className="text-blue-500" size={20} />
                <span className="text-lg font-semibold">08:00 - 17:30</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Thao tác nhanh</h3>
              <div className="space-y-3">
                <button className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-medium transition">
                  Chấm công vào
                </button>
                <button className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-medium transition">
                  Chấm công ra
                </button>
                <button className="w-full bg-purple-500 hover:bg-purple-600 text-white py-3 rounded-lg font-medium transition">
                  Xin nghỉ phép
                </button>
              </div>
            </div>

            {/* Status */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Trạng thái hệ thống</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Cloud sync</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
                      {isConnected ? 'Đang hoạt động' : 'Ngắt kết nối'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Database</span>
                  <span className="text-green-600">✓ Online</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Lần cập nhật cuối</span>
                  <span className="text-blue-600">5 phút trước</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pb-6 text-center text-gray-500 text-sm">
        <p>Bảng chấm công cá nhân • Phiên bản 2.0.1</p>
        <p className="mt-1">© 2026 - Tự động đồng bộ với hệ thống</p>
      </div>
    </div>
  );
}

export default App;