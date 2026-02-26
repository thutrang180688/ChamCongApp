
import { DayType } from '../types';

export const getDaysInMonth = (month: number, year: number): Date[] => {
  const date = new Date(year, month, 1);
  const days: Date[] = [];
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
};

export const formatId = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Các ngày lễ cố định theo Dương lịch (áp dụng cho mọi năm)
const FIXED_HOLIDAYS: Record<string, string> = {
  '01-01': 'Tết Dương lịch',
  '04-30': 'Giải phóng miền Nam',
  '05-01': 'Quốc tế Lao động',
  '09-02': 'Quốc khánh',
  '09-03': 'Nghỉ Quốc khánh',
};

// Các ngày lễ theo Âm lịch (cần cập nhật theo từng năm vì ngày Dương lịch thay đổi)
const LUNAR_HOLIDAYS: Record<string, string> = {
  // 2024
  '2024-02-08': 'Giao thừa',
  '2024-02-09': 'Mùng 1 Tết',
  '2024-02-10': 'Mùng 2 Tết',
  '2024-02-11': 'Mùng 3 Tết',
  '2024-02-12': 'Mùng 4 Tết',
  '2024-04-18': 'Giỗ Tổ Hùng Vương',
  
  // 2025
  '2025-01-28': 'Giao thừa',
  '2025-01-29': 'Mùng 1 Tết',
  '2025-01-30': 'Mùng 2 Tết',
  '2025-01-31': 'Mùng 3 Tết',
  '2025-04-07': 'Giỗ Tổ Hùng Vương',

  // 2026
  '2026-02-16': 'Giao thừa',
  '2026-02-17': 'Mùng 1 Tết',
  '2026-02-18': 'Mùng 2 Tết',
  '2026-02-19': 'Mùng 3 Tết',
  '2026-04-26': 'Giỗ Tổ Hùng Vương',

  // 2027 (Dự kiến)
  '2027-02-05': 'Giao thừa',
  '2027-02-06': 'Mùng 1 Tết',
  '2027-02-07': 'Mùng 2 Tết',
  '2027-02-08': 'Mùng 3 Tết',
  '2027-04-16': 'Giỗ Tổ Hùng Vương',
};

export const getHolidayName = (date: Date): string | null => {
  const id = formatId(date);
  const monthDay = id.substring(5); // Lấy phần MM-DD
  
  // Kiểm tra ngày lễ cố định
  if (FIXED_HOLIDAYS[monthDay]) return FIXED_HOLIDAYS[monthDay];
  
  // Kiểm tra ngày lễ âm lịch đã khai báo
  if (LUNAR_HOLIDAYS[id]) return LUNAR_HOLIDAYS[id];
  
  return null;
};
