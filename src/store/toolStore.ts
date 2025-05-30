// src/store/toolStore.ts
import { create } from "zustand";
import { fetchAiAnalysis } from "../services/api";
import {
  AiAnalysisResult,
  AiStoreAnnotations,
  BoundingBox,
  SegmentationContour,
  ClassificationPrediction,
} from "../types/ai";
import { useDicomStore } from "./dicomStore";
import { DicomMeta, Annotation as UserAnnotationType } from "../types"; // Assuming your Annotation type is also in ../types

// --- Base Annotation Types (User-drawn) ---
export type AnnotationType = "freehand" | "text" | "highlight" | "measurement";
export type ActiveAnnotationTool = AnnotationType | null;

// Re-exporting or using UserAnnotationType from your main types
export type Annotation = UserAnnotationType;
/*
If Annotation is not in ../types, define it here:
export interface Annotation {
  id: string;
  type: AnnotationType;
  points?: number[];
  text?: string;
  position?: { x: number; y: number };
  textPosition?: { x: number; y: number }; // For measurement text
  color: string;
  strokeWidth?: number;
  fontSize?: number;
}
*/

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
  // Consider adding editedDicomMeta here if its changes should be undoable
  // editedDicomMeta: Partial<DicomMeta> | null;
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
  aiAnnotations: AiStoreAnnotations;
  isAiLoading: Record<"detection" | "segmentation" | "classification", boolean>;
  aiError: string | null;

  // NEW: Freehand drawing options
  freehandColor: string;
  freehandStrokeWidth: number;
  // NEW: Text annotation options (can expand this)
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
  finishCurrentPathAnnotation: (
    // Ensure this signature matches DicomCanvas call
    type: Exclude<AnnotationType, "text">, // "freehand" | "highlight" | "measurement"
    // Color and strokeWidth will be taken from store for freehand/highlight if not passed
    // Or DicomCanvas can pass them explicitly using values from store
  ) => void;
  finishCurrentTextAnnotation: (
    // Ensure this signature matches DicomCanvas call
    text: string,
    position: { x: number; y: number },
    // Color and fontSize will be taken from store if not passed
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
  runAiAnalysis: (
    modelType: "detection" | "segmentation" | "classification",
  ) => Promise<void>;
  setAiAnnotationVisibility: (
    type: keyof AiStoreAnnotations,
    idOrLabel: string,
    visible: boolean,
  ) => void;
  toggleAllAiVisibility: (
    modelType: keyof AiStoreAnnotations,
    visible: boolean,
  ) => void;
  clearAiAnnotations: () => void;
  resetAllFiltersAndTransforms: () => void;
  resetAllToolRelatedState: () => void;

  // NEW: Actions for freehand/text options
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
const initialAiAnnotations: AiStoreAnnotations = {
  detections: [],
  segmentations: [],
  classifications: [],
};
const initialIsAiLoading = {
  detection: false,
  segmentation: false,
  classification: false,
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

  // NEW initial values for drawing options
  freehandColor: "#FFFF00", // Default yellow
  freehandStrokeWidth: 2,
  textAnnotationColor: "#00FF00", // Default green for text
  textAnnotationFontSize: 16,

  // ... (setImageFilter, toggleInvertFilter, resetImageFilters - same as before)
  // ... (setImageTransformation, setSourceCrop, resetCrop, rotateImage90, resetImageTransformations - same as before)
  // ... (setStageZoomAndPosition, zoomIn, zoomOut, resetZoom - same as before)
  // ... (setActiveAnnotationTool, addAnnotation, updateAnnotation, clearAllAnnotations, setShowAnnotations - same as before)
  // ... (startCurrentDrawing, addPointToCurrentDrawing - same as before)

  // --- MODIFIED/ADDED Annotation Finishing Logic ---
  finishCurrentPathAnnotation: (type) => {
    const {
      currentDrawingPoints,
      addAnnotation,
      freehandColor, // Get current freehand options from store
      freehandStrokeWidth,
    } = get();

    // Determine color and strokeWidth based on type
    let colorToUse: string;
    let strokeWidthToUse: number;

    switch (type) {
      case "freehand":
        colorToUse = freehandColor;
        strokeWidthToUse = freehandStrokeWidth;
        break;
      case "highlight":
        colorToUse = "rgba(255,255,0,0.3)"; // Default highlight
        strokeWidthToUse = 20; // Default highlight
        break;
      case "measurement":
        colorToUse = "#00FF00"; // Default measurement
        strokeWidthToUse = 2;
        break;
      default: // Should not happen if type is constrained
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

    if (type === "measurement" && currentDrawingPoints.length >= 4) {
      // For measurement, DicomCanvas will calculate and pass displayText and pixelSpacing
      // This function's signature might need to accept them if DicomCanvas doesn't add them later
      // For now, let's assume DicomCanvas handles measurement-specific text.
      // If DicomCanvas already passes `displayText`, the signature was:
      // finishCurrentPathAnnotation: (type, color, strokeWidth, pixelSpacing?, displayText?)
      // We'll adapt to DicomCanvas calling it without explicit color/stroke for freehand.
      // DicomCanvas could call: finishCurrentPathAnnotation("measurement", defaultColor, defaultStroke, ps, text)
      // For now, keeping it simple, measurement logic is mostly in DicomCanvas for display text
    }

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
    set({ isDrawing: false, currentDrawingPoints: [] }); // Also reset drawing state for text
  },

  // ... (setToolUIVisibility, toggleToolUIVisibility, toggleMetadataEditor - same as before)
  // ... (initializeEditedMetadata, updateEditedMetadataField, clearEditedMetadata - same as before)
  // ... (setCanvasExporter, setOriginalDicomDownloader - same as before)
  // ... (pushToUndoStack, undoLastAction, canUndo - same as before)
  // ... (AI functions: runAiAnalysis, etc. - same as before)
  // ... (resetAllFiltersAndTransforms, resetAllToolRelatedState - same as before)

  // NEW Actions for setting drawing options
  setFreehandColor: (color) => set({ freehandColor: color }),
  setFreehandStrokeWidth: (width) =>
    set({ freehandStrokeWidth: Math.max(1, Math.min(width, 50)) }),
  setTextAnnotationColor: (color) => set({ textAnnotationColor: color }),
  setTextAnnotationFontSize: (size) =>
    set({ textAnnotationFontSize: Math.max(8, Math.min(size, 72)) }),

  // Implementations from your existing store (ensure they are all here)
  setImageFilter: (filter, value) => {
    /* ... from your code ... */ get().pushToUndoStack();
    set((state) => ({
      imageFilters: { ...state.imageFilters, [filter]: value },
    }));
  },
  toggleInvertFilter: () => {
    /* ... from your code ... */ get().pushToUndoStack();
    set((state) => ({
      imageFilters: {
        ...state.imageFilters,
        invert: !state.imageFilters.invert,
      },
    }));
  },
  resetImageFilters: () => {
    /* ... from your code ... */ if (
      JSON.stringify(get().imageFilters) !== JSON.stringify(initialImageFilters)
    ) {
      get().pushToUndoStack();
    }
    set({ imageFilters: { ...initialImageFilters } });
  },
  setImageTransformation: (transformation, value) => {
    /* ... from your code ... */ get().pushToUndoStack();
    set((state) => ({
      imageTransformations: {
        ...state.imageTransformations,
        [transformation]: value,
      },
    }));
  },
  setSourceCrop: (crop) => {
    /* ... from your code ... */ const currentSourceCrop =
      get().imageTransformations.sourceCrop;
    if (JSON.stringify(currentSourceCrop) !== JSON.stringify(crop)) {
      get().pushToUndoStack();
    }
    set((state) => ({
      imageTransformations: { ...state.imageTransformations, sourceCrop: crop },
    }));
  },
  resetCrop: () => {
    /* ... from your code ... */ if (
      get().imageTransformations.sourceCrop !== null
    ) {
      get().pushToUndoStack();
    }
    set((state) => ({
      imageTransformations: { ...state.imageTransformations, sourceCrop: null },
      toolUIState: { ...state.toolUIState, showCropInterface: false },
    }));
  },
  rotateImage90: () => {
    /* ... from your code ... */ get().pushToUndoStack();
    set((state) => ({
      imageTransformations: {
        ...state.imageTransformations,
        rotation: (state.imageTransformations.rotation + 90) % 360,
      },
    }));
  },
  resetImageTransformations: () => {
    /* ... from your code ... */ if (
      JSON.stringify(get().imageTransformations) !==
      JSON.stringify(initialTransformations)
    ) {
      get().pushToUndoStack();
    }
    set({ imageTransformations: { ...initialTransformations } });
  },
  setStageZoomAndPosition: (scale, position) => {
    /* ... from your code ... */ const current = get().imageTransformations;
    if (
      current.scale !== scale ||
      current.position.x !== position.x ||
      current.position.y !== position.y
    ) {
      get().pushToUndoStack();
    }
    set((state) => ({
      imageTransformations: { ...state.imageTransformations, scale, position },
    }));
  },
  zoomIn: () => {
    /* ... from your code ... */ const currentScale =
      get().imageTransformations.scale;
    const newScale = Math.min(currentScale * 1.2, 2);
    if (currentScale !== newScale) {
      get().setImageTransformation("scale", newScale);
    }
  },
  zoomOut: () => {
    /* ... from your code ... */ const currentScale =
      get().imageTransformations.scale;
    const newScale = Math.max(currentScale / 1.2, 0.1);
    if (currentScale !== newScale) {
      get().setImageTransformation("scale", newScale);
    }
  },
  resetZoom: () => {
    /* ... from your code ... */ const current = get().imageTransformations;
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
        isDrawing: false, // Reset drawing state when changing tools
        currentDrawingPoints: [],
        toolUIState: newToolUIState,
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

  addAnnotation: (annotationData) => {
    /* ... from your code ... */ get().pushToUndoStack();
    const newId = crypto.randomUUID();
    const newAnnotation = { ...annotationData, id: newId };
    set((state) => ({ annotations: [...state.annotations, newAnnotation] }));
    return newId;
  },
  updateAnnotation: (id, updates) => {
    /* ... from your code ... */ get().pushToUndoStack();
    set((state) => ({
      annotations: state.annotations.map((ann) =>
        ann.id === id ? { ...ann, ...updates } : ann,
      ),
    }));
  },
  clearAllAnnotations: () => {
    /* ... from your code ... */ if (get().annotations.length > 0)
      get().pushToUndoStack();
    set({ annotations: [] });
  },
  setShowAnnotations: (show) => {
    /* ... from your code ... */ set({ showAnnotations: show });
  },
  startCurrentDrawing: (point) => {
    /* ... from your code ... */ set({
      isDrawing: true,
      currentDrawingPoints: [point.x, point.y],
    });
  },
  addPointToCurrentDrawing: (point) => {
    /* ... from your code ... */ if (!get().isDrawing) return;
    set((state) => ({
      currentDrawingPoints: [...state.currentDrawingPoints, point.x, point.y],
    }));
  },
  setToolUIVisibility: (uiElement, visible) => {
    /* ... from your code ... */ set((state) => ({
      toolUIState: { ...state.toolUIState, [uiElement]: visible },
    }));
  },
  toggleToolUIVisibility: (uiElement) => {
    /* ... from your code ... */ set((state) => ({
      toolUIState: {
        ...state.toolUIState,
        [uiElement]: !state.toolUIState[uiElement],
      },
    }));
  },
  toggleMetadataEditor: () => {
    /* ... from your code, ensure it uses set properly ... */
    set((state) => {
      const currentlyShowing = state.toolUIState.showMetadataEditor;
      const newShowEditorState = !currentlyShowing;
      let newEditedMeta = state.editedDicomMeta;
      let newActiveAnnotationTool = state.activeAnnotationTool;
      const newToolUIState = { ...state.toolUIState };

      if (newShowEditorState) {
        Object.keys(newToolUIState).forEach((k) => {
          const key = k as keyof ToolUIState;
          if (key !== "showMetadataEditor" && newToolUIState[key])
            newToolUIState[key] = false;
        });
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
        newActiveAnnotationTool = null;
      }
      newToolUIState.showMetadataEditor = newShowEditorState;
      return {
        toolUIState: newToolUIState,
        editedDicomMeta: newEditedMeta,
        activeAnnotationTool: newActiveAnnotationTool,
      };
    });
  },
  initializeEditedMetadata: (originalMeta) => {
    /* ... from your code ... */ if (originalMeta) {
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
    /* ... from your code ... */ set((state) => {
      if (!state.editedDicomMeta) return {};
      let processedValue = value;
      const originalMeta = useDicomStore.getState().dicomData?.meta;
      if (originalMeta && typeof originalMeta[field] === "number") {
        if (value === "" || value === null) {
          processedValue = null;
        } else {
          const num = parseFloat(value);
          processedValue = isNaN(num) ? originalMeta[field] : num;
        }
      }
      return {
        editedDicomMeta: { ...state.editedDicomMeta, [field]: processedValue },
      };
    });
  },
  clearEditedMetadata: () => {
    /* ... from your code ... */ set({ editedDicomMeta: null });
  },
  setCanvasExporter: (exporter) => {
    /* ... from your code ... */ set({ getCanvasAsDataURL: exporter });
  },
  setOriginalDicomDownloader: (downloader) => {
    /* ... from your code ... */ set({ getOriginalDicomBlob: downloader });
  },
  pushToUndoStack: () => {
    /* ... from your code ... */ const currentState =
      getCurrentUndoableState(get);
    set((state) => ({
      undoStack: [...state.undoStack.slice(-19), currentState],
    }));
  },
  undoLastAction: () => {
    /* ... from your code ... */ const stack = get().undoStack;
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
    /* ... from your code ... */ return get().undoStack.length > 0;
  },
  runAiAnalysis: async (modelType) => {
    /* ... from your code ... */ const dicomId =
      useDicomStore.getState().dicomData?.id;
    if (!dicomId) {
      set({ aiError: "No DICOM image loaded to analyze." });
      return;
    }
    set((state) => ({
      isAiLoading: { ...state.isAiLoading, [modelType]: true },
      aiError:
        state.aiError && state.aiError.includes(`AI for ${modelType}`)
          ? null
          : state.aiError,
    }));
    try {
      const result: AiAnalysisResult = await fetchAiAnalysis(
        dicomId,
        modelType,
      );
      set((state) => {
        const newAiAnnotations = { ...state.aiAnnotations };
        if (modelType === "detection" && result.detection) {
          newAiAnnotations.detections = result.detection.boxes.map((box) => ({
            ...box,
            id: crypto.randomUUID(),
            visible: true,
          }));
        } else if (modelType === "segmentation" && result.segmentation) {
          newAiAnnotations.segmentations = result.segmentation.contours.map(
            (contour) => ({
              ...contour,
              id: crypto.randomUUID(),
              visible: true,
            }),
          );
        } else if (modelType === "classification" && result.classification) {
          newAiAnnotations.classifications =
            result.classification.predictions.map((pred) => ({
              ...pred,
              id: crypto.randomUUID(),
              visible: true,
            }));
        }
        return {
          aiAnnotations: newAiAnnotations,
          isAiLoading: { ...state.isAiLoading, [modelType]: false },
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
        if (axiosError.response?.data?.detail) {
          errorDetails = axiosError.response.data.detail;
        }
      } else if (typeof error === "string") errorDetails = error;
      set((state) => ({
        aiError: `AI for ${modelType} failed. Details: ${errorDetails}`,
        isAiLoading: { ...state.isAiLoading, [modelType]: false },
      }));
    }
  },
  setAiAnnotationVisibility: (type, idOrLabel, visible) => {
    /* ... from your code ... */ set((state) => {
      const newAiAnnotations = { ...state.aiAnnotations };
      if (type === "detections") {
        newAiAnnotations.detections = state.aiAnnotations.detections.map(
          (item: BoundingBox): BoundingBox =>
            item.id === idOrLabel || (item.label && item.label === idOrLabel)
              ? { ...item, visible }
              : item,
        );
      } else if (type === "segmentations") {
        newAiAnnotations.segmentations = state.aiAnnotations.segmentations.map(
          (item: SegmentationContour): SegmentationContour =>
            item.id === idOrLabel || (item.label && item.label === idOrLabel)
              ? { ...item, visible }
              : item,
        );
      } else if (type === "classifications") {
        newAiAnnotations.classifications =
          state.aiAnnotations.classifications.map(
            (item: ClassificationPrediction): ClassificationPrediction =>
              item.id === idOrLabel || (item.label && item.label === idOrLabel)
                ? { ...item, visible }
                : item,
          );
      }
      return { aiAnnotations: newAiAnnotations };
    });
  },
  toggleAllAiVisibility: (modelType, visible) => {
    /* ... from your code ... */ set((state) => {
      const newAiAnns = { ...state.aiAnnotations };
      if (modelType === "detections")
        newAiAnns.detections = newAiAnns.detections.map((d) => ({
          ...d,
          visible,
        }));
      else if (modelType === "segmentations")
        newAiAnns.segmentations = newAiAnns.segmentations.map((s) => ({
          ...s,
          visible,
        }));
      else if (modelType === "classifications")
        newAiAnns.classifications = newAiAnns.classifications.map((c) => ({
          ...c,
          visible,
        }));
      return { aiAnnotations: newAiAnns };
    });
  },
  clearAiAnnotations: () => {
    /* ... from your code ... */ set({
      aiAnnotations: { ...initialAiAnnotations },
      isAiLoading: { ...initialIsAiLoading },
      aiError: null,
    });
  },
  resetAllFiltersAndTransforms: () => {
    /* ... from your code ... */ const currentFilters = get().imageFilters;
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
    /* ... from your code ... */ set({
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
    });
  },
}));

export const mapBrightnessToKonva = (uiBrightness: number): number =>
  uiBrightness / 100;
export const mapContrastToKonva = (uiContrast: number): number => uiContrast;
