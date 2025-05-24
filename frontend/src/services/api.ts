import axios from "axios";
import { ImagePayload } from "@/types"; // Assuming DicomMeta, etc. are here
import { AiAnalysisResult } from "@/types/ai"; // We'll create this new type file

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL, // Should be like http://localhost:8000/api/v1
});

export const uploadDicom = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post<string>("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const fetchDicomImagePayload = async (
  dicomId: string,
): Promise<ImagePayload> => {
  const response = await apiClient.get<ImagePayload>(`/dicom/${dicomId}`);
  return response.data;
};

export const fetchAiAnalysis = async (
  dicomId: string,
  modelType: "detection" | "segmentation" | "classification",
): Promise<AiAnalysisResult> => {
  const response = await apiClient.post<AiAnalysisResult>(
    `/dicom/${dicomId}/ai/${modelType}`,
  );
  return response.data;
};
