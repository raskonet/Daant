// src/types/index.ts

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
  png_data: string;
  meta: DicomMeta;
}

export interface DicomData {
  id: string;
  patientName: string;
  studyDate: string;
  pngDataUrl: string;
  meta: DicomMeta;
}

export type AnnotationType = "freehand" | "text" | "highlight" | "measurement";

export interface Annotation {
  id: string;
  type: AnnotationType;
  points?: number[];
  text?: string;
  position?: { x: number; y: number };
  color: string;
  strokeWidth?: number;
  fontSize?: number;
}
