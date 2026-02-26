
export enum DayType {
  WORK = 'X1',
  HALF_WORK = '1/2 WORK',
  DAY_OFF = 'DO',
  ANNUAL_LEAVE = 'AL',
  HALF_ANNUAL_LEAVE = '1/2 AL',
  PUBLIC_HOLIDAY = 'PH',
  SH = 'SH'
}

export interface AttendanceRecord {
  date: string; // ISO format
  type: DayType;
  chromeActiveTime: number; // minutes
  isAutoClocked: boolean;
  isManual?: boolean; 
  note?: string; 
}

export interface UserSettings {
  userName: string;
  initialAnnualLeave: number;
  shiftCode: string;
  targetWorkingDays: number;
  autoSuggest: boolean;
  lastYearUpdated?: number;
}
