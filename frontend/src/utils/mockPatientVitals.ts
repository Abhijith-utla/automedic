/**
 * Mock vitals and health metrics for patient profile. Replace with live data later.
 */
export interface MockVitals {
  heartRate: number;
  bloodPressure: { systolic: number; diastolic: number };
  temperatureF: number;
  bloodPressureUpper: number;
  bloodPressureLower: number;
  glucoseLevel: string;
  bloodCount: string;
}

export const DEFAULT_MOCK_VITALS: MockVitals = {
  heartRate: 72,
  bloodPressure: { systolic: 120, diastolic: 80 },
  temperatureF: 98.6,
  bloodPressureUpper: 120,
  bloodPressureLower: 80,
  glucoseLevel: "75–90 mg/dL",
  bloodCount: "9,456/ml",
};

/** Mock fever history (last 7 days) for sparkline. */
export const MOCK_FEVER_HISTORY = [98.2, 98.4, 98.6, 98.4, 98.8, 98.6, 98.6];

/**
 * Heart rate over time (e.g. last 7 days, one reading per day).
 * Format: { dateLabel, bpm } for a meaningful "Heart rate trend" chart.
 */
export interface HeartRatePoint {
  dateLabel: string;
  bpm: number;
}

export const MOCK_HEART_RATE_TREND: HeartRatePoint[] = [
  { dateLabel: "Mon", bpm: 68 },
  { dateLabel: "Tue", bpm: 72 },
  { dateLabel: "Wed", bpm: 70 },
  { dateLabel: "Thu", bpm: 75 },
  { dateLabel: "Fri", bpm: 71 },
  { dateLabel: "Sat", bpm: 69 },
  { dateLabel: "Sun", bpm: 72 },
];

/** Normal resting heart rate range (adults) for reference band. */
export const HEART_RATE_NORMAL_RANGE = { min: 60, max: 100 };
