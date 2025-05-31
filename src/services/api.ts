// src/services/api.ts
import axios from "axios";
import { ImagePayload } from "../types";
import {
  AiAnalysisResult,
  BoundingBox as FrontendBoundingBox,
} from "../types/ai";
import { DicomMeta } from "../types";

const apiClient = axios.create({
  baseURL: "/", // Or your specific API base URL if not using Next.js rewrites effectively
});

export const uploadDicom = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post<string>("/api/v1/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const fetchDicomImagePayload = async (
  dicomId: string,
): Promise<ImagePayload> => {
  const response = await apiClient.get<ImagePayload>(
    `/api/v1/dicom/${dicomId}`,
  );
  return response.data;
};

// --- CORRECTED fetchAiAnalysis ---
// This function now specifically calls the "detection" model type,
// as that's what your backend is configured for with Roboflow.
export const fetchAiAnalysis = async (
  dicomId: string,
  // modelType: "detection" | "segmentation" | "classification", // OLD - too general
  modelType: "detection", // NEW - Now explicitly "detection"
): Promise<AiAnalysisResult> => {
  // The backend route /api/v1/dicom/{dicom_id}/ai/{model_type}
  // will only accept "detection" as a valid model_type now.
  const response = await apiClient.post<AiAnalysisResult>(
    `/api/v1/dicom/${dicomId}/ai/${modelType}`, // modelType will be "detection"
  );
  return response.data;
};
// --- END CORRECTION ---

export const exportModifiedDicom = async (
  dicomId: string,
  metadataUpdates: Partial<DicomMeta>,
): Promise<Blob> => {
  const payload = { updates: metadataUpdates };
  const response = await apiClient.post(
    `/api/v1/dicom/${dicomId}/export_modified`,
    payload,
    {
      responseType: "blob",
    },
  );
  return response.data;
};

export const fetchDiagnosticReport = async (
  dicomId: string,
  parsedRoboflowAnnotations: FrontendBoundingBox[],
): Promise<string> => {
  const payload = {
    parsed_roboflow_annotations: parsedRoboflowAnnotations.map((ann) => ({
      x1: ann.x1,
      y1: ann.y1,
      x2: ann.x2,
      y2: ann.y2,
      label: ann.label,
      confidence: ann.confidence,
    })),
  };
  const response = await apiClient.post<string>(
    `/api/v1/dicom/${dicomId}/diagnostic_report`,
    payload,
  );
  return response.data;
};
