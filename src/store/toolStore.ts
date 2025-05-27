// frontend/src/store/toolStore.ts
import { create } from "zustand";
import { fetchAiAnalysis } from "@/services/api";
import {
  AiAnalysisResult,
  AiStoreAnnotations,
  BoundingBox, // Assuming this is the type from @/types/ai with id, visible
  SegmentationContour, // Assuming this is the type from @/types/ai with id, visible
  ClassificationPrediction, // Assuming this is the type from @/types/ai with id, visible
} from "@/types/ai";
import { useDicomStore } from "./dicomStore";

// --- Base Annotation Types (User-drawn) ---
export type AnnotationType = "freehand" | "text" | "highlight" | "measurement";
export type ActiveAnnotationTool = AnnotationType | null;

export interface Annotation {
  id: string;
  type: AnnotationType;
  points?: number[];
  text?: string;
  position?: { x: number; y: number };
  textPosition?: { x: number; y: number };
  color: string;
  strokeWidth?: number;
  fontSize?: number;
}

// --- Image Manipulation State Types ---
export interface ImageFiltersState {
  brightness: number;
  contrast: number;
  invert: boolean;
}

export interface ImageTransformationsState {
  scale: number;
  position: { x: number; y: number };
  rotation: number;
  flipX: boolean;
  flipY: boolean;
}

export interface CropBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// --- UI Panel Visibility ---
export interface ToolUIState {
  showBrightnessContrastPanel: boolean;
  showZoomPanel: boolean;
  showCropInterface: boolean;
}

// --- Undo System State ---
interface UndoableState {
  imageFilters: ImageFiltersState;
  imageTransformations: ImageTransformationsState;
  annotations: Annotation[];
  cropBounds: CropBounds | null;
}

// --- Main ToolStore State Interface ---
interface ToolState {
  imageFilters: ImageFiltersState;
  setImageFilter: <K extends keyof ImageFiltersState>(
    filter: K,
    value: ImageFiltersState[K],
  ) => void;
  toggleInvertFilter: () => void;
  resetImageFilters: () => void;
  imageTransformations: ImageTransformationsState;
  setImageTransformation: <K extends keyof ImageTransformationsState>(
    transformation: K,
    value: ImageTransformationsState[K],
  ) => void;
  rotateImage90: () => void;
  resetImageTransformations: () => void;
  setStageZoomAndPosition: (
    scale: number,
    position: { x: number; y: number },
  ) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  cropBounds: CropBounds | null;
  setCropBounds: (bounds: CropBounds | null) => void;
  annotations: Annotation[];
  activeAnnotationTool: ActiveAnnotationTool;
  setActiveAnnotationTool: (tool: ActiveAnnotationTool) => void;
  addAnnotation: (annotationData: Omit<Annotation, "id">) => string;
  updateAnnotation: (
    id: string,
    updates: Partial<Omit<Annotation, "id" | "type">>,
  ) => void;
  clearAllAnnotations: () => void;
  showAnnotations: boolean;
  setShowAnnotations: (show: boolean) => void;
  isDrawing: boolean;
  currentDrawingPoints: number[];
  startCurrentDrawing: (point: { x: number; y: number }) => void;
  addPointToCurrentDrawing: (point: { x: number; y: number }) => void;
  finishCurrentPathAnnotation: (
    type: "freehand" | "highlight" | "measurement",
    color: string,
    strokeWidth: number,
    pixelSpacing?: [number, number],
    displayText?: string,
  ) => void;
  finishCurrentTextAnnotation: (
    text: string,
    position: { x: number; y: number },
    color: string,
    fontSize: number,
  ) => void;
  toolUIState: ToolUIState;
  setToolUIVisibility: <K extends keyof ToolUIState>(
    uiElement: K,
    visible: boolean,
  ) => void;
  toggleToolUIVisibility: <K extends keyof ToolUIState>(uiElement: K) => void;
  getCanvasAsDataURL: (() => string | undefined) | null;
  setCanvasExporter: (exporter: (() => string | undefined) | null) => void;
  undoStack: UndoableState[];
  pushToUndoStack: () => void;
  undoLastAction: () => void;
  canUndo: () => boolean;
  aiAnnotations: AiStoreAnnotations;
  isAiLoading: Record<"detection" | "segmentation" | "classification", boolean>;
  aiError: string | null;
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
  ) => void; // Changed modelType to keyof AiStoreAnnotations
  clearAiAnnotations: () => void;
  resetAllFiltersAndTransforms: () => void;
  resetAllToolRelatedState: () => void;
}

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
};
const initialToolUIState: ToolUIState = {
  showBrightnessContrastPanel: false,
  showZoomPanel: false,
  showCropInterface: false,
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

const getCurrentUndoableState = (get: () => ToolState): UndoableState => ({
  imageFilters: { ...get().imageFilters },
  imageTransformations: { ...get().imageTransformations },
  annotations: [...get().annotations.map((ann) => ({ ...ann }))],
  cropBounds: get().cropBounds ? { ...get().cropBounds } : null,
});

export const useToolStore = create<ToolState>((set, get) => ({
  imageFilters: { ...initialImageFilters },
  imageTransformations: { ...initialTransformations },
  annotations: [...initialUserAnnotations],
  cropBounds: null,
  activeAnnotationTool: null,
  showAnnotations: true,
  isDrawing: false,
  currentDrawingPoints: [],
  toolUIState: { ...initialToolUIState },
  getCanvasAsDataURL: null,
  undoStack: [],
  aiAnnotations: { ...initialAiAnnotations },
  isAiLoading: { ...initialIsAiLoading },
  aiError: null,

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
        cropBounds: prevState.cropBounds ? { ...prevState.cropBounds } : null,
        undoStack: stack.slice(0, -1),
        isDrawing: false,
        currentDrawingPoints: [],
        activeAnnotationTool: null,
      });
    }
  },
  canUndo: () => get().undoStack.length > 0,

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
    get().pushToUndoStack();
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
    get().pushToUndoStack();
    set({ imageTransformations: { ...initialTransformations } });
  },
  setStageZoomAndPosition: (scale, position) => {
    get().pushToUndoStack();
    set((state) => ({
      imageTransformations: { ...state.imageTransformations, scale, position },
    }));
  },
  zoomIn: () => {
    const currentScale = get().imageTransformations.scale;
    get().setImageTransformation("scale", Math.min(currentScale * 1.2, 10));
  },
  zoomOut: () => {
    const currentScale = get().imageTransformations.scale;
    get().setImageTransformation("scale", Math.max(currentScale / 1.2, 0.1));
  },
  resetZoom: () => {
    get().pushToUndoStack();
    set((state) => ({
      imageTransformations: {
        ...state.imageTransformations,
        scale: 1,
        position: { x: 0, y: 0 },
      },
    }));
  },

  setCropBounds: (bounds) => {
    if (JSON.stringify(get().cropBounds) !== JSON.stringify(bounds)) {
      get().pushToUndoStack();
    }
    set({ cropBounds: bounds });
  },

  setActiveAnnotationTool: (tool) => {
    const currentTool = get().activeAnnotationTool;
    set({
      activeAnnotationTool: currentTool === tool ? null : tool,
      isDrawing: false,
      currentDrawingPoints: [],
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
  setShowAnnotations: (show) => set({ showAnnotations: show }),

  startCurrentDrawing: (point) => {
    set({ isDrawing: true, currentDrawingPoints: [point.x, point.y] });
  },
  addPointToCurrentDrawing: (point) => {
    if (!get().isDrawing) return;
    set((state) => ({
      currentDrawingPoints: [...state.currentDrawingPoints, point.x, point.y],
    }));
  },
  finishCurrentPathAnnotation: (
    type,
    color,
    strokeWidth,
    pixelSpacing,
    displayText,
  ) => {
    const { currentDrawingPoints, addAnnotation } = get();
    if (currentDrawingPoints.length < (type === "measurement" ? 4 : 2)) {
      set({ isDrawing: false, currentDrawingPoints: [] });
      return;
    }
    const annotationData: Omit<Annotation, "id"> = {
      type,
      points: [...currentDrawingPoints],
      color,
      strokeWidth,
    };
    if (type === "measurement") {
      annotationData.text = displayText || "N/A";
      annotationData.textPosition = {
        x:
          (currentDrawingPoints[0] +
            currentDrawingPoints[currentDrawingPoints.length - 2]) /
          2,
        y:
          (currentDrawingPoints[1] +
            currentDrawingPoints[currentDrawingPoints.length - 1]) /
            2 -
          10,
      };
    }
    addAnnotation(annotationData);
    set({ isDrawing: false, currentDrawingPoints: [] });
  },
  finishCurrentTextAnnotation: (text, position, color, fontSize) => {
    get().addAnnotation({ type: "text", text, position, color, fontSize });
    set({ isDrawing: false, currentDrawingPoints: [] });
  },

  setToolUIVisibility: (uiElement, visible) =>
    set((state) => ({
      toolUIState: { ...state.toolUIState, [uiElement]: visible },
    })),
  toggleToolUIVisibility: (uiElement) =>
    set((state) => ({
      toolUIState: {
        ...state.toolUIState,
        [uiElement]: !state.toolUIState[uiElement],
      },
    })),
  setCanvasExporter: (exporter) => set({ getCanvasAsDataURL: exporter }),

  runAiAnalysis: async (modelType) => {
    const dicomId = useDicomStore.getState().dicomData?.id;
    if (!dicomId) {
      set({ aiError: "No DICOM image loaded to analyze." });
      return;
    }
    set((state) => ({
      isAiLoading: { ...state.isAiLoading, [modelType]: true },
      aiError: null,
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
      // Changed 'any' to 'unknown'
      console.error(`AI Analysis Error (${modelType}):`, error);
      let errorDetails = "Unknown error";
      if (error instanceof Error) errorDetails = error.message;
      else if (typeof error === "string") errorDetails = error;

      set((state) => ({
        aiError: `AI for ${modelType} is unavailable. Details: ${errorDetails}`,
        isAiLoading: { ...state.isAiLoading, [modelType]: false },
      }));
    }
  },
  setAiAnnotationVisibility: (
    type: keyof AiStoreAnnotations,
    idOrLabel: string,
    visible: boolean,
  ) => {
    set((state) => {
      const newAiAnnotations = { ...state.aiAnnotations };
      // Helper function to update items in an array
      const updateItems = <
        T extends { id: string; label?: string; visible: boolean },
      >(
        items: T[],
      ): T[] => {
        return items.map((item) =>
          item.id === idOrLabel || (item.label && item.label === idOrLabel)
            ? { ...item, visible }
            : item,
        );
      };

      if (type === "detections")
        newAiAnnotations.detections = updateItems(
          state.aiAnnotations.detections,
        );
      else if (type === "segmentations")
        newAiAnnotations.segmentations = updateItems(
          state.aiAnnotations.segmentations,
        );
      else if (type === "classifications")
        newAiAnnotations.classifications = updateItems(
          state.aiAnnotations.classifications,
        );

      return { aiAnnotations: newAiAnnotations };
    });
  },
  toggleAllAiVisibility: (
    modelType: keyof AiStoreAnnotations,
    visible: boolean,
  ) => {
    // Ensured modelType is keyof AiStoreAnnotations
    set((state) => {
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
    set({
      aiAnnotations: { ...initialAiAnnotations },
      isAiLoading: { ...initialIsAiLoading },
      aiError: null,
    });
  },

  resetAllFiltersAndTransforms: () => {
    get().pushToUndoStack();
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
      cropBounds: null,
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
