// src/store/toolStore.ts
import { create } from "zustand";
import { fetchAiAnalysis, fetchDiagnosticReport } from "../services/api"; // Added fetchDiagnosticReport
import {
  AiAnalysisResult,
  AiStoreAnnotations,
  BoundingBox,
  // SegmentationContour, // No longer used from Roboflow
  // ClassificationPrediction, // No longer used from Roboflow
} from "../types/ai";
import { useDicomStore } from "./dicomStore";
import { DicomMeta, Annotation as UserAnnotationType } from "../types";

// --- Base Annotation Types (User-drawn) ---
export type AnnotationType = "freehand" | "text" | "highlight" | "measurement";
export type ActiveAnnotationTool = AnnotationType | null;
export type Annotation = UserAnnotationType;

// --- Image Manipulation State Types ---
export interface ImageFiltersState {
  brightness: number;
  contrast: number;
  invert: boolean;
}

export interface CropBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageTransformationsState {
  scale: number;
  position: { x: number; y: number };
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  sourceCrop: CropBounds | null;
}

// --- UI Panel Visibility ---
export interface ToolUIState {
  showBrightnessContrastPanel: boolean;
  showZoomPanel: boolean;
  showCropInterface: boolean;
  showMetadataEditor: boolean;
  showTextConfigPanel: boolean;
}

// --- Undo System State ---
interface UndoableState {
  imageFilters: ImageFiltersState;
  imageTransformations: ImageTransformationsState;
  annotations: Annotation[];
  // editedDicomMeta could be added here if its changes should be undoable
}

// --- Main ToolStore State Interface ---
export interface ToolState {
  imageFilters: ImageFiltersState;
  imageTransformations: ImageTransformationsState;
  annotations: Annotation[];
  activeAnnotationTool: ActiveAnnotationTool;
  showAnnotations: boolean;
  isDrawing: boolean;
  currentDrawingPoints: number[];
  toolUIState: ToolUIState;
  editedDicomMeta: Partial<DicomMeta> | null;
  getCanvasAsDataURL: (() => string | undefined) | null;
  getOriginalDicomBlob: (() => Blob | null) | null;
  undoStack: UndoableState[];

  // AI Specific (Roboflow)
  aiAnnotations: AiStoreAnnotations;
  // isAiLoading: Record<"detection" | "segmentation" | "classification", boolean>; // OLD
  isAiLoading: Record<"detection", boolean>; // NEW - only detection from Roboflow
  aiError: string | null;

  // LLM Report Specific
  diagnosticReport: string | null;
  isReportLoading: boolean;
  reportError: string | null;

  // Annotation style options
  freehandColor: string;
  freehandStrokeWidth: number;
  textAnnotationColor: string;
  textAnnotationFontSize: number;

  // Actions
  setImageFilter: <K extends keyof ImageFiltersState>(
    filter: K,
    value: ImageFiltersState[K],
  ) => void;
  toggleInvertFilter: () => void;
  resetImageFilters: () => void;
  setImageTransformation: <K extends keyof ImageTransformationsState>(
    transformation: K,
    value: ImageTransformationsState[K],
  ) => void;
  setSourceCrop: (crop: CropBounds | null) => void;
  resetCrop: () => void;
  rotateImage90: () => void;
  resetImageTransformations: () => void;
  setStageZoomAndPosition: (
    scale: number,
    position: { x: number; y: number },
  ) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setActiveAnnotationTool: (tool: ActiveAnnotationTool) => void;
  addAnnotation: (annotationData: Omit<Annotation, "id">) => string;
  updateAnnotation: (
    id: string,
    updates: Partial<Omit<Annotation, "id" | "type">>,
  ) => void;
  clearAllAnnotations: () => void;
  setShowAnnotations: (show: boolean) => void;
  startCurrentDrawing: (point: { x: number; y: number }) => void;
  addPointToCurrentDrawing: (point: { x: number; y: number }) => void;
  finishCurrentPathAnnotation: (type: Exclude<AnnotationType, "text">) => void;
  finishCurrentTextAnnotation: (
    text: string,
    position: { x: number; y: number },
  ) => void;
  setToolUIVisibility: <K extends keyof ToolUIState>(
    uiElement: K,
    visible: boolean,
  ) => void;
  toggleToolUIVisibility: <K extends keyof ToolUIState>(uiElement: K) => void;
  toggleMetadataEditor: () => void;
  toggleTextConfigPanel: (show?: boolean) => void;
  initializeEditedMetadata: (originalMeta: DicomMeta | null) => void;
  updateEditedMetadataField: (field: keyof DicomMeta, value: any) => void;
  clearEditedMetadata: () => void;
  setCanvasExporter: (exporter: (() => string | undefined) | null) => void;
  setOriginalDicomDownloader: (downloader: (() => Blob | null) | null) => void;
  pushToUndoStack: () => void;
  undoLastAction: () => void;
  canUndo: () => boolean;

  runAiAnalysis: (modelType: "detection") => Promise<void>; // Only "detection" now
  setAiAnnotationVisibility: (
    type: "detections", // Only "detections"
    idOrLabel: string,
    visible: boolean,
  ) => void;
  toggleAllAiVisibility: (modelType: "detections", visible: boolean) => void; // Only "detections"
  clearAiAnnotations: () => void;

  generateAndFetchReport: () => Promise<void>; // New LLM action

  resetAllFiltersAndTransforms: () => void;
  resetAllToolRelatedState: () => void;

  setFreehandColor: (color: string) => void;
  setFreehandStrokeWidth: (width: number) => void;
  setTextAnnotationColor: (color: string) => void;
  setTextAnnotationFontSize: (size: number) => void;
}

// --- Initial State Values ---
export const initialImageFilters: ImageFiltersState = {
  brightness: 0,
  contrast: 0,
  invert: false,
};
const initialTransformations: ImageTransformationsState = {
  scale: 1,
  position: { x: 0, y: 0 },
  rotation: 0,
  flipX: false,
  flipY: false,
  sourceCrop: null,
};
export const initialToolUIState: ToolUIState = {
  showBrightnessContrastPanel: false,
  showZoomPanel: false,
  showCropInterface: false,
  showMetadataEditor: false,
  showTextConfigPanel: false,
};
const initialUserAnnotations: Annotation[] = [];

// AiStoreAnnotations now only meaningfully contains detections
const initialAiAnnotations: AiStoreAnnotations = {
  detections: [],
  segmentations: [], // Will remain empty
  classifications: [], // Will remain empty
};

// isAiLoading now only tracks detection
const initialIsAiLoading = {
  detection: false,
  // segmentation: false, // Removed
  // classification: false, // Removed
};

const RELEVANT_METADATA_FIELDS_FOR_EDITING: Array<keyof DicomMeta> = [
  "patient_id",
  "study_date",
  "modality",
  "window_center",
  "window_width",
];

const getCurrentUndoableState = (get: () => ToolState): UndoableState => ({
  imageFilters: { ...get().imageFilters },
  imageTransformations: { ...get().imageTransformations },
  annotations: [...get().annotations.map((ann) => ({ ...ann }))],
});

export const useToolStore = create<ToolState>((set, get) => ({
  imageFilters: { ...initialImageFilters },
  imageTransformations: { ...initialTransformations },
  annotations: [...initialUserAnnotations],
  activeAnnotationTool: null,
  showAnnotations: true,
  isDrawing: false,
  currentDrawingPoints: [],
  toolUIState: { ...initialToolUIState },
  editedDicomMeta: null,
  getCanvasAsDataURL: null,
  getOriginalDicomBlob: null,
  undoStack: [],

  aiAnnotations: { ...initialAiAnnotations },
  isAiLoading: { ...initialIsAiLoading },
  aiError: null,

  diagnosticReport: null,
  isReportLoading: false,
  reportError: null,

  freehandColor: "#FFFF00",
  freehandStrokeWidth: 2,
  textAnnotationColor: "#00FF00",
  textAnnotationFontSize: 16,

  setImageFilter: (filter, value) => {
    get().pushToUndoStack();
    set((state) => ({
      imageFilters: { ...state.imageFilters, [filter]: value },
    }));
  },
  toggleInvertFilter: () => {
    get().pushToUndoStack();
    set((state) => ({
      imageFilters: {
        ...state.imageFilters,
        invert: !state.imageFilters.invert,
      },
    }));
  },
  resetImageFilters: () => {
    if (
      JSON.stringify(get().imageFilters) !== JSON.stringify(initialImageFilters)
    ) {
      get().pushToUndoStack();
    }
    set({ imageFilters: { ...initialImageFilters } });
  },
  setImageTransformation: (transformation, value) => {
    get().pushToUndoStack();
    set((state) => ({
      imageTransformations: {
        ...state.imageTransformations,
        [transformation]: value,
      },
    }));
  },
  setSourceCrop: (crop) => {
    const currentSourceCrop = get().imageTransformations.sourceCrop;
    if (JSON.stringify(currentSourceCrop) !== JSON.stringify(crop)) {
      get().pushToUndoStack();
    }
    set((state) => ({
      imageTransformations: { ...state.imageTransformations, sourceCrop: crop },
    }));
  },
  resetCrop: () => {
    if (get().imageTransformations.sourceCrop !== null) {
      get().pushToUndoStack();
    }
    set((state) => ({
      imageTransformations: { ...state.imageTransformations, sourceCrop: null },
      toolUIState: { ...state.toolUIState, showCropInterface: false },
    }));
  },
  rotateImage90: () => {
    get().pushToUndoStack();
    set((state) => ({
      imageTransformations: {
        ...state.imageTransformations,
        rotation: (state.imageTransformations.rotation + 90) % 360,
      },
    }));
  },
  resetImageTransformations: () => {
    if (
      JSON.stringify(get().imageTransformations) !==
      JSON.stringify(initialTransformations)
    ) {
      get().pushToUndoStack();
    }
    set({ imageTransformations: { ...initialTransformations } });
  },
  setStageZoomAndPosition: (scale, position) => {
    set((state) => ({
      imageTransformations: { ...state.imageTransformations, scale, position },
    }));
  },
  zoomIn: () => {
    const currentScale = get().imageTransformations.scale;
    const newScale = Math.min(currentScale * 1.2, 10);
    if (currentScale !== newScale) {
      get().setImageTransformation("scale", newScale);
    }
  },
  zoomOut: () => {
    const currentScale = get().imageTransformations.scale;
    const newScale = Math.max(currentScale / 1.2, 0.1);
    if (currentScale !== newScale) {
      get().setImageTransformation("scale", newScale);
    }
  },
  resetZoom: () => {
    const current = get().imageTransformations;
    if (
      current.scale !== 1 ||
      current.position.x !== 0 ||
      current.position.y !== 0
    ) {
      get().pushToUndoStack();
    }
    set((state) => ({
      imageTransformations: {
        ...state.imageTransformations,
        scale: 1,
        position: { x: 0, y: 0 },
      },
    }));
  },
  setActiveAnnotationTool: (tool) => {
    const currentActiveTool = get().activeAnnotationTool;
    const newActiveTool = currentActiveTool === tool ? null : tool;
    set((state) => {
      const newToolUIState = { ...state.toolUIState };
      if (newActiveTool) {
        newToolUIState.showBrightnessContrastPanel = false;
        newToolUIState.showZoomPanel = false;
        newToolUIState.showCropInterface = false;
        newToolUIState.showMetadataEditor = false;
      }
      newToolUIState.showTextConfigPanel = newActiveTool === "text";
      return {
        activeAnnotationTool: newActiveTool,
        isDrawing: false,
        currentDrawingPoints: [],
        toolUIState: newToolUIState,
      };
    });
  },
  addAnnotation: (annotationData) => {
    get().pushToUndoStack();
    const newId = crypto.randomUUID();
    const newAnnotation = { ...annotationData, id: newId };
    set((state) => ({ annotations: [...state.annotations, newAnnotation] }));
    return newId;
  },
  updateAnnotation: (id, updates) => {
    get().pushToUndoStack();
    set((state) => ({
      annotations: state.annotations.map((ann) =>
        ann.id === id ? { ...ann, ...updates } : ann,
      ),
    }));
  },
  clearAllAnnotations: () => {
    if (get().annotations.length > 0) {
      get().pushToUndoStack();
    }
    set({ annotations: [] });
  },
  setShowAnnotations: (show) => {
    set({ showAnnotations: show });
  },
  startCurrentDrawing: (point) => {
    set({
      isDrawing: true,
      currentDrawingPoints: [point.x, point.y],
    });
  },
  addPointToCurrentDrawing: (point) => {
    if (!get().isDrawing) return;
    set((state) => ({
      currentDrawingPoints: [...state.currentDrawingPoints, point.x, point.y],
    }));
  },
  finishCurrentPathAnnotation: (type) => {
    const {
      currentDrawingPoints,
      addAnnotation,
      freehandColor,
      freehandStrokeWidth,
    } = get();
    let colorToUse: string;
    let strokeWidthToUse: number;
    switch (type) {
      case "freehand":
        colorToUse = freehandColor;
        strokeWidthToUse = freehandStrokeWidth;
        break;
      case "highlight":
        colorToUse = "rgba(255,255,0,0.3)";
        strokeWidthToUse = 20;
        break;
      case "measurement":
        colorToUse = "#00FF00";
        strokeWidthToUse = 2;
        break;
      default:
        colorToUse = "#FFFFFF";
        strokeWidthToUse = 1;
    }
    if (currentDrawingPoints.length < (type === "measurement" ? 4 : 2)) {
      set({ isDrawing: false, currentDrawingPoints: [] });
      return;
    }
    const annotationData: Omit<Annotation, "id"> = {
      type,
      points: [...currentDrawingPoints],
      color: colorToUse,
      strokeWidth: strokeWidthToUse,
    };
    addAnnotation(annotationData);
    set({ isDrawing: false, currentDrawingPoints: [] });
  },
  finishCurrentTextAnnotation: (text, position) => {
    const { addAnnotation, textAnnotationColor, textAnnotationFontSize } =
      get();
    addAnnotation({
      type: "text",
      text,
      position,
      color: textAnnotationColor,
      fontSize: textAnnotationFontSize,
    });
    set({ isDrawing: false, currentDrawingPoints: [] });
  },
  setToolUIVisibility: (uiElement, visible) => {
    set((state) => ({
      toolUIState: { ...state.toolUIState, [uiElement]: visible },
    }));
  },
  toggleToolUIVisibility: (uiElement) => {
    set((state) => ({
      toolUIState: {
        ...state.toolUIState,
        [uiElement]: !state.toolUIState[uiElement],
      },
    }));
  },
  toggleMetadataEditor: () => {
    set((state) => {
      const currentlyShowing = state.toolUIState.showMetadataEditor;
      const newShowEditorState = !currentlyShowing;
      let newEditedMeta = state.editedDicomMeta;
      let newActiveAnnotationTool = state.activeAnnotationTool;
      const newToolUIState = { ...state.toolUIState };
      if (newShowEditorState) {
        Object.keys(newToolUIState).forEach((k) => {
          const key = k as keyof ToolUIState;
          if (key !== "showMetadataEditor") newToolUIState[key] = false;
        });
        newActiveAnnotationTool = null;
        const originalMetaFromDicomStore =
          useDicomStore.getState().dicomData?.meta || null;
        if (originalMetaFromDicomStore) {
          const initialEdits: Partial<DicomMeta> = {};
          RELEVANT_METADATA_FIELDS_FOR_EDITING.forEach((key) => {
            if (originalMetaFromDicomStore[key] !== undefined) {
              initialEdits[key as keyof DicomMeta] =
                originalMetaFromDicomStore[key];
            }
          });
          newEditedMeta = initialEdits;
        } else {
          newEditedMeta = null;
        }
      }
      newToolUIState.showMetadataEditor = newShowEditorState;
      return {
        toolUIState: newToolUIState,
        editedDicomMeta: newEditedMeta,
        activeAnnotationTool: newActiveAnnotationTool,
      };
    });
  },
  toggleTextConfigPanel: (show) => {
    set((state) => ({
      toolUIState: {
        ...state.toolUIState,
        showTextConfigPanel:
          typeof show === "boolean"
            ? show
            : !state.toolUIState.showTextConfigPanel,
      },
    }));
  },
  initializeEditedMetadata: (originalMeta) => {
    if (originalMeta) {
      const initialEdits: Partial<DicomMeta> = {};
      RELEVANT_METADATA_FIELDS_FOR_EDITING.forEach((key) => {
        if (originalMeta[key] !== undefined) {
          initialEdits[key as keyof DicomMeta] = originalMeta[key];
        }
      });
      set({ editedDicomMeta: initialEdits });
    } else {
      set({ editedDicomMeta: null });
    }
  },
  updateEditedMetadataField: (field, value) => {
    set((state) => {
      if (!state.editedDicomMeta) return {};
      let processedValue = value;
      const originalMetaValue =
        useDicomStore.getState().dicomData?.meta?.[field];
      if (
        typeof originalMetaValue === "number" ||
        field === "window_center" ||
        field === "window_width"
      ) {
        if (value === "" || value === null || value === undefined) {
          processedValue = null;
        } else {
          const num = parseFloat(value);
          processedValue = isNaN(num)
            ? (state.editedDicomMeta[field] ?? null)
            : num;
        }
      }
      return {
        editedDicomMeta: { ...state.editedDicomMeta, [field]: processedValue },
      };
    });
  },
  clearEditedMetadata: () => {
    set({ editedDicomMeta: null });
  },
  setCanvasExporter: (exporter) => {
    set({ getCanvasAsDataURL: exporter });
  },
  setOriginalDicomDownloader: (downloader) => {
    set({ getOriginalDicomBlob: downloader });
  },
  pushToUndoStack: () => {
    const currentState = getCurrentUndoableState(get);
    set((state) => ({
      undoStack: [...state.undoStack.slice(-19), currentState],
    }));
  },
  undoLastAction: () => {
    const stack = get().undoStack;
    if (stack.length > 0) {
      const prevState = stack[stack.length - 1];
      set({
        imageFilters: { ...prevState.imageFilters },
        imageTransformations: { ...prevState.imageTransformations },
        annotations: [...prevState.annotations.map((ann) => ({ ...ann }))],
        undoStack: stack.slice(0, -1),
        isDrawing: false,
        currentDrawingPoints: [],
        activeAnnotationTool: null,
      });
    }
  },
  canUndo: () => {
    return get().undoStack.length > 0;
  },

  runAiAnalysis: async (modelType) => {
    // modelType will only be "detection"
    const dicomId = useDicomStore.getState().dicomData?.id;
    if (!dicomId) {
      set({ aiError: "No DICOM image loaded to analyze." });
      return;
    }
    set((state) => ({
      isAiLoading: { detection: true }, // Only detection loading
      aiError: null, // Clear general AI error
      diagnosticReport: null, // Clear previous report
      isReportLoading: false,
      reportError: null,
      aiAnnotations: {
        // Clear all previous AI results
        detections: [],
        segmentations: [],
        classifications: [],
      },
    }));
    try {
      const result: AiAnalysisResult = await fetchAiAnalysis(
        dicomId,
        modelType,
      );
      set((state) => {
        const newAiAnnotations: AiStoreAnnotations = {
          detections: [],
          segmentations: [], // Keep empty
          classifications: [], // Keep empty
        };
        if (modelType === "detection" && result.detection?.boxes) {
          newAiAnnotations.detections = result.detection.boxes.map((box) => ({
            ...box,
            id: crypto.randomUUID(),
            visible: true,
          }));
        }
        return {
          aiAnnotations: newAiAnnotations,
          isAiLoading: { detection: false },
        };
      });
    } catch (error: unknown) {
      console.error(`AI Analysis Error (${modelType}):`, error);
      let errorDetails = "Unknown error";
      if (error instanceof Error) errorDetails = error.message;
      else if (
        typeof error === "object" &&
        error !== null &&
        "response" in error
      ) {
        const axiosError = error as {
          response?: { data?: { detail?: string } };
        };
        if (axiosError.response?.data?.detail)
          errorDetails = axiosError.response.data.detail;
      } else if (typeof error === "string") errorDetails = error;
      set({
        aiError: `AI for ${modelType} failed. Details: ${errorDetails}`,
        isAiLoading: { detection: false },
      });
    }
  },

  setAiAnnotationVisibility: (type, idOrLabel, visible) => {
    // type will only be "detections"
    set((state) => {
      const newAiAnnotations = { ...state.aiAnnotations };
      if (type === "detections") {
        newAiAnnotations.detections = state.aiAnnotations.detections.map(
          (item: BoundingBox): BoundingBox =>
            item.id === idOrLabel || (item.label && item.label === idOrLabel)
              ? { ...item, visible }
              : item,
        );
      }
      // No need to handle segmentation or classification as they are not used
      return { aiAnnotations: newAiAnnotations };
    });
  },

  toggleAllAiVisibility: (modelType, visible) => {
    // modelType will only be "detections"
    set((state) => {
      const newAiAnns = { ...state.aiAnnotations };
      if (modelType === "detections") {
        newAiAnns.detections = newAiAnns.detections.map((d) => ({
          ...d,
          visible,
        }));
      }
      // No need to handle segmentation or classification
      return { aiAnnotations: newAiAnns };
    });
  },

  clearAiAnnotations: () => {
    set({
      aiAnnotations: { ...initialAiAnnotations }, // Resets detections to empty, others already empty
      isAiLoading: { ...initialIsAiLoading },
      aiError: null,
      // Also clear report when AI annotations are cleared
      diagnosticReport: null,
      isReportLoading: false,
      reportError: null,
    });
  },

  generateAndFetchReport: async () => {
    const dicomId = useDicomStore.getState().dicomData?.id;
    const currentAiDetections = get().aiAnnotations.detections;

    if (!dicomId) {
      set({
        reportError: "DICOM ID not found. Cannot generate report.",
        isReportLoading: false,
      });
      return;
    }

    set({ isReportLoading: true, reportError: null, diagnosticReport: null });

    try {
      const reportText = await fetchDiagnosticReport(
        dicomId,
        currentAiDetections,
      );
      set({ diagnosticReport: reportText, isReportLoading: false });
    } catch (error: any) {
      console.error("Error fetching diagnostic report:", error);
      const errorMessage =
        error.response?.data?.detail ||
        error.message ||
        "Failed to generate diagnostic report.";
      set({
        reportError: errorMessage,
        isReportLoading: false,
        diagnosticReport: null,
      });
    }
  },

  resetAllFiltersAndTransforms: () => {
    const currentFilters = get().imageFilters;
    const currentTransforms = get().imageTransformations;
    if (
      JSON.stringify(currentFilters) !== JSON.stringify(initialImageFilters) ||
      JSON.stringify(currentTransforms) !==
        JSON.stringify(initialTransformations)
    ) {
      get().pushToUndoStack();
    }
    set({
      imageFilters: { ...initialImageFilters },
      imageTransformations: { ...initialTransformations },
    });
  },
  resetAllToolRelatedState: () => {
    set({
      imageFilters: { ...initialImageFilters },
      imageTransformations: { ...initialTransformations },
      annotations: [...initialUserAnnotations],
      activeAnnotationTool: null,
      showAnnotations: true,
      isDrawing: false,
      currentDrawingPoints: [],
      toolUIState: { ...initialToolUIState },
      editedDicomMeta: null,
      undoStack: [],
      aiAnnotations: { ...initialAiAnnotations },
      isAiLoading: { ...initialIsAiLoading },
      aiError: null,
      diagnosticReport: null,
      isReportLoading: false,
      reportError: null,
      freehandColor: "#FFFF00",
      freehandStrokeWidth: 2,
      textAnnotationColor: "#00FF00",
      textAnnotationFontSize: 16,
    });
  },

  setFreehandColor: (color) => set({ freehandColor: color }),
  setFreehandStrokeWidth: (width) =>
    set({ freehandStrokeWidth: Math.max(1, Math.min(width, 50)) }),
  setTextAnnotationColor: (color) => set({ textAnnotationColor: color }),
  setTextAnnotationFontSize: (size) =>
    set({ textAnnotationFontSize: Math.max(8, Math.min(size, 72)) }),
}));

export const mapBrightnessToKonva = (uiBrightness: number): number =>
  uiBrightness / 100;
export const mapContrastToKonva = (uiContrast: number): number => uiContrast;
