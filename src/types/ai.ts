// src/types/ai.ts

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  confidence?: number | null;
  // Frontend specific additions for Konva/rendering & state management:
  id: string;
  visible: boolean;
}

export interface DetectionResult {
  // As received from backend
  boxes: Array<Omit<BoundingBox, "id" | "visible">>; // Backend doesn't send id/visible for boxes
}

export interface SegmentationContour {
  points: Array<[number, number]>; // List of [x,y] points
  label?: string | null;
  // Frontend specific additions:
  id: string;
  visible: boolean;
}

export interface SegmentationResult {
  // As received from backend
  contours: Array<Omit<SegmentationContour, "id" | "visible">>;
}

export interface ClassificationPrediction {
  label: string;
  confidence?: number | null;
  // Frontend specific additions:
  id: string;
  visible: boolean;
}

export interface ClassificationResult {
  // As received from backend
  predictions: Array<Omit<ClassificationPrediction, "id" | "visible">>;
}

// This is what the API endpoint /dicom/{dicom_id}/ai/{model_type} returns
export interface AiAnalysisResult {
  detection?: DetectionResult | null;
  segmentation?: SegmentationResult | null;
  classification?: ClassificationResult | null;
  model_type: string; // "detection", "segmentation", "classification"
}

// This is how AI annotations are stored in the Zustand store (with frontend-specific fields)
export interface AiStoreAnnotations {
  detections: BoundingBox[]; // Already includes id and visible
  segmentations: SegmentationContour[]; // Already includes id and visible
  classifications: ClassificationPrediction[]; // Already includes id and visible
}
