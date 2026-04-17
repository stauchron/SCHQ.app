export type TestSessionStatus = "active" | "completed";

export type WatchPassport = {
  id: string;
  serial_number: string;
  sku: string;
  model_name: string | null;
  movement_type: string | null;
  created_at: string;
  updated_at: string;
};

export type TestSession = {
  id: string;
  watch_passport_id: string;
  status: TestSessionStatus;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
};

export type TimegrapherMeasurement = {
  id: string;
  test_session_id: string;
  measurement_timestamp: string;
  ch_rate: number | null;
  ch_amplitude: number | null;
  ch_beat_error: number | null;
  fh_rate: number | null;
  fh_amplitude: number | null;
  fh_beat_error: number | null;
  h12_rate: number | null;
  h12_amplitude: number | null;
  h12_beat_error: number | null;
  h6_rate: number | null;
  h6_amplitude: number | null;
  h6_beat_error: number | null;
  h9_rate: number | null;
  h9_amplitude: number | null;
  h9_beat_error: number | null;
  h3_rate: number | null;
  h3_amplitude: number | null;
  h3_beat_error: number | null;
  avg_rate: number | null;
  avg_amplitude: number | null;
  avg_beat_error: number | null;
  rate_difference: number | null;
  amplitude_difference: number | null;
  photo_url: string | null;
  notes: string | null;
  ai_analyzed: boolean;
  original_photo_url: string | null;
};

export type DurationTest = {
  id: string;
  test_session_id: string;
  started_at: string;
  reference_time: string;
  has_date_function: boolean;
  date_confirmation_done: boolean;
  active: boolean;
  completed_at: string | null;
  notes: string | null;
};

export type DurationCheckpoint = {
  id: string;
  duration_test_id: string;
  checkpoint_time: string;
  offset_seconds: number | null;
  photo_url: string | null;
  notes: string | null;
};

export type PowerReserveTest = {
  id: string;
  test_session_id: string;
  started_at: string;
  ended_at: string | null;
  still_running: boolean;
  reminder_interval_hours: number;
  has_date_function: boolean;
  notes: string | null;
};

export type PowerReserveCheckpoint = {
  id: string;
  power_reserve_test_id: string;
  checkpoint_time: string;
  watch_running: boolean;
  watch_time_photo_url: string | null;
  watch_date_display: string | null;
  manual_notes: string | null;
};

export type Position = "ch" | "h6" | "h9" | "h12" | "h3" | "fh";

export const POSITION_LABELS: Record<Position, string> = {
  ch: "CH — Wijzerplaat boven",
  h6: "6H — Kroon onder",
  h9: "9H — Kroon links",
  h12: "12H — Kroon boven",
  h3: "3H — Kroon rechts",
  fh: "FH — Wijzerplaat onder",
};

export const POSITION_SHORT: Record<Position, string> = {
  ch: "CH",
  h6: "6H",
  h9: "9H",
  h12: "12H",
  h3: "3H",
  fh: "FH",
};
