export interface MedicalHistory {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  patientId: string;
  patientName: string;
  patientSurname: string;
  doctorId: string;
  doctorName: string;
  doctorSurname: string;
  turnId: string;
  tags?: string[];
}

export interface CreateMedicalHistoryRequest {
  turnId: string;
  content: string;
  tags?: string[];
}

export interface UpdateMedicalHistoryContentRequest {
  content: string;
  tags?: string[];
}

export interface TagFrequency {
  tag: string;
  count: number;
}

export interface ApiErrorResponse {
  error?: string;
  message?: string;
}