//backend related
export interface DicomMeta {
  patient_id: string;
  study_date: string;
  modality: string;
  pixel_spacing: [number, number];
  window_center: number | null;
  window_width: number | null;
  rows: number;
  columns: number;
}

export interface ImagePayload {
  png_data: string; // base64 encoded PNG
  meta: DicomMeta;
}

// Frontend only
export interface DicomData {
  id: string;
  patientName: string;
  studyDate: string;
  pngDataUrl: string;
  meta: DicomMeta;
}
