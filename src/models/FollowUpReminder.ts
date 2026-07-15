export type FollowUpMonths = 3 | 6 | 12;

export interface FollowUpReminder {
  id: string;
  patientId: string;
  patientName: string;
  patientSurname: string;
  doctorId: string;
  /** Full display name of the recommending doctor, e.g. "Ana Gomez". Optional: older payloads may omit it. */
  doctorName?: string;
  /** Specialty of the recommending doctor. Nullable: a doctor without a DoctorProfile yields null. */
  specialty?: string | null;
  historyId: string;
  turnId: string;
  monthsUntilControl: number;
  scheduledFor: string;
  dismissed: boolean;
  createdAt: string;
}

export interface DueForFollowUp {
  patientId: string;
  patientName: string;
  patientSurname: string;
  scheduledFor: string; // YYYY-MM-DD — recommended control date
  lastTurnDate: string | null; // ISO datetime — the last attended turn, or null when none COMPLETED
}

export interface CreateFollowUpReminderRequest {
  monthsUntilControl: FollowUpMonths;
}
