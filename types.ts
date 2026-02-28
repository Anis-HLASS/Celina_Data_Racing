
export interface RawDataRow {
  [key: string]: any;
}

export interface ProcessedDataPoint {
  date: string;
  name: string;
  value: number;
  cumulativeValue: number;
  rank?: number;
  month?: string;
}

export interface AnimationConfig {
  duration: number; // seconds
  title: string;
  entitiesToShow: number;
  chartType: 'bar_race' | 'global_line' | 'bubble_3d' | 'combo_racing';
  audioUrl?: string;
}

export interface ColumnMapping {
  dateCol: string;
  entityCol: string;
  valueCol: string;
}

export enum AppState {
  IDLE = 'IDLE',
  MAPPING = 'MAPPING',
  PROCESSING = 'PROCESSING',
  PREVIEW = 'PREVIEW',
  EXPORTING = 'EXPORTING'
}
