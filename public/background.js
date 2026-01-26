
// Kênh kết nối ảo đến App
const channel = new BroadcastChannel('worktrack_extension_channel');

chrome.runtime.onInstalled.addListener(() => {
  console.log("WorkTrack Extension Active");
  pingApp();
});

function pingApp() {
  // Gửi tín hiệu đến App (giả lập)
  channel.postMessage({ type: 'CLOCK_IN_PING', timestamp: new Date().getTime() });
  
  // Lưu lịch sử trong storage của extension
  const today = new Date().toISOString().split('T')[0];
  chrome.storage.local.set({ lastPing: today });
}

// Kiểm tra mỗi 60p để đảm bảo ping được gửi khi người dùng mở trình duyệt
chrome.alarms.create('checkPing', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkPing') {
    pingApp();
  }
});
