import { create } from "zustand";
import { DicomData, DicomMeta, ImagePayload } from "../../types";
import { fetchDicomImagePayload, uploadDicom } from "../services/api";

function parseDicomDate(dicomDateStr: string | null | undefined): Date | null {
  if (!dicomDateStr || dicomDateStr.length !== 8) {
    return null;
  }
  const year = parseInt(dicomDateStr.substring(0, 4), 10);
  const month = parseInt(dicomDateStr.substring(4, 6), 10) - 1;
  const day = parseInt(dicomDateStr.substring(6, 8), 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return null;
  }
  return new Date(year, month, day);
}

interface DicomState {
  dicomData: DicomData | null;
  isLoading: boolean;
  error: string | null;
  uploadDicomFile: (file: File) => Promise<void>;
  fetchDicomData: (id: string) => Promise<void>;
  resetState: () => void;
  updateCurrentDicomData: (updates: {
    pngDataUrl?: string;
    meta?: Partial<DicomMeta>;
  }) => void;
}

export const useDicomStore = create<DicomState>((set, get) => ({
  dicomData: null,
  isLoading: false,
  error: null,
  uploadDicomFile: async (file: File) => {
    set({ isLoading: true, error: null, dicomData: null });
    try {
      const dicomId = await uploadDicom(file);
      await get().fetchDicomData(dicomId);
    } catch (err) {
      console.error("Upload error:", err);
      set({ error: "Failed to upload DICOM file.", isLoading: false });
    }
  },
  fetchDicomData: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const payload: ImagePayload = await fetchDicomImagePayload(id);
      const parsedDate = parseDicomDate(payload.meta.study_date);
      const formattedStudyDate = parsedDate
        ? parsedDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "N/A";
      const dicomStoreData: DicomData = {
        id,
        patientName: payload.meta.patient_id || "Unknown Patient",
        studyDate: formattedStudyDate,
        pngDataUrl: `data:image/png;base64,${payload.png_data}`,
        meta: payload.meta,
      };
      set({ dicomData: dicomStoreData, isLoading: false });
    } catch (err) {
      console.error("Fetch error:", err);
      set({ error: "Failed to fetch DICOM data.", isLoading: false });
    }
  },
  resetState: () => set({ dicomData: null, isLoading: false, error: null }),
  updateCurrentDicomData: (updates) => {
    set((state) => {
      if (!state.dicomData) return {}; // No data to update
      return {
        dicomData: {
          ...state.dicomData,
          ...(updates.pngDataUrl && { pngDataUrl: updates.pngDataUrl }),
          ...(updates.meta && {
            meta: { ...state.dicomData.meta, ...updates.meta },
          }),
        },
      };
    });
  },
}));
