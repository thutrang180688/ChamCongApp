
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

export const VIETNAMESE_HOLIDAYS: Record<string, string> = {
  // 2024
  '2024-01-01': 'Tết Dương lịch',
  '2024-02-08': 'Giao thừa',
  '2024-02-09': 'Mùng 1 Tết',
  '2024-02-10': 'Mùng 2 Tết',
  '2024-02-11': 'Mùng 3 Tết',
  '2024-02-12': 'Mùng 4 Tết',
  '2024-04-18': 'Giỗ Tổ Hùng Vương',
  '2024-04-30': 'Giải phóng miền Nam',
  '2024-05-01': 'Quốc tế Lao động',
  '2024-09-02': 'Quốc khánh',
  '2024-09-03': 'Nghỉ Quốc khánh',
  
  // 2025
  '2025-01-01': 'Tết Dương lịch',
  '2025-01-28': 'Giao thừa',
  '2025-01-29': 'Mùng 1 Tết',
  '2025-01-30': 'Mùng 2 Tết',
  '2025-01-31': 'Mùng 3 Tết',
  '2025-04-07': 'Giỗ Tổ Hùng Vương',
  '2025-04-30': 'Giải phóng miền Nam',
  '2025-05-01': 'Quốc tế Lao động',
  '2025-09-02': 'Quốc khánh',
  '2025-09-03': 'Nghỉ Quốc khánh',

  // 2026
  '2026-01-01': 'Tết Dương lịch',
  '2026-02-16': 'Giao thừa',
  '2026-02-17': 'Mùng 1 Tết',
  '2026-02-18': 'Mùng 2 Tết',
  '2026-02-19': 'Mùng 3 Tết',
  '2026-04-26': 'Giỗ Tổ Hùng Vương',
  '2026-04-30': 'Giải phóng miền Nam',
  '2026-05-01': 'Quốc tế Lao động',
  '2026-09-02': 'Quốc khánh',
  '2026-09-03': 'Nghỉ Quốc khánh'
};
