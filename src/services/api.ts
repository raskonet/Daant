import axios from "axios";
import { ImagePayload } from "@/types"; // Assuming DicomMeta, etc. are here
import { AiAnalysisResult } from "@/types/ai";

const apiClient = axios.create({
  // Set baseURL to "/" or an empty string.
  // API calls will be made to paths like "/api/v1/upload",
  // which Next.js rewrites will handle.
  baseURL: "/",
});

export const uploadDicom = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);
  // Use the full path that matches the `source` in next.config.js rewrites
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

export const fetchAiAnalysis = async (
  dicomId: string,
  modelType: "detection" | "segmentation" | "classification",
): Promise<AiAnalysisResult> => {
  const response = await apiClient.post<AiAnalysisResult>(
    `/api/v1/dicom/${dicomId}/ai/${modelType}`,
  );
  return response.data;
};
