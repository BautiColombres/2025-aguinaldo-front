// Phase F2 — Follow-up reminders ("Control en X meses").
// Mirrors the backend FollowUpReminderDTO. Per OQ-4 there is intentionally NO
// `monthsOverdue` / overdue concept anywhere on the client model.

export type FollowUpMonths = 3 | 6 | 12;

export interface FollowUpReminder {
  id: string;
  patientId: string;
  patientName: string;
  patientSurname: string;
  doctorId: string;
  historyId: string;
  turnId: string;
  monthsUntilControl: number;
  scheduledFor: string;
  dismissed: boolean;
  createdAt: string;
}

// The create request carries the interval ONLY. patient/doctor/scheduledFor/history
// are derived server-side (IDOR prevention — see F2-B4), so they are never sent.
export interface CreateFollowUpReminderRequest {
  monthsUntilControl: FollowUpMonths;
}
