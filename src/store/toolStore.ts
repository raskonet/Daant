// frontend/src/store/toolStore.ts
import { create } from "zustand";
import { fetchAiAnalysis } from "@/services/api";
import {
  AiAnalysisResult,
  AiStoreAnnotations,
  // BoundingBox as AiBoundingBox, // Not directly used as type alias here
  // SegmentationContour as AiSegmentationContour, // Not directly used as type alias here
  // ClassificationPrediction as AiClassificationPrediction, // Not directly used as type alias here
} from "@/types/ai";
import { useDicomStore } from "./dicomStore"; // For getting dicomId

// --- Base Annotation Types (User-drawn) ---
export type AnnotationType = "freehand" | "text" | "highlight" | "measurement";
export type ActiveAnnotationTool = AnnotationType | null;

export interface Annotation {
  // For user-drawn annotations
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
  annotations: Annotation[]; // User-drawn annotations
  cropBounds: CropBounds | null;
  // Note: aiAnnotations are not part of user undo stack directly.
  // AI results are re-fetched or cleared, not "undone" in the same way.
}

// --- Main ToolStore State Interface ---
interface ToolState {
  // Image Filters
  imageFilters: ImageFiltersState;
  setImageFilter: <K extends keyof ImageFiltersState>(
    filter: K,
    value: ImageFiltersState[K],
  ) => void;
  toggleInvertFilter: () => void;
  resetImageFilters: () => void;

  // Image Transformations
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

  // Crop functionality
  cropBounds: CropBounds | null;
  setCropBounds: (bounds: CropBounds | null) => void;

  // User Annotations
  annotations: Annotation[];
  activeAnnotationTool: ActiveAnnotationTool;
  setActiveAnnotationTool: (tool: ActiveAnnotationTool) => void;
  addAnnotation: (annotationData: Omit<Annotation, "id">) => string; // Internal, called by finish...
  clearAllAnnotations: () => void; // Clears user annotations
  showAnnotations: boolean; // Visibility for user annotations
  setShowAnnotations: (show: boolean) => void;

  // Drawing state (for user annotations)
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

  // Tool UI Panel State
  toolUIState: ToolUIState;
  setToolUIVisibility: <K extends keyof ToolUIState>(
    uiElement: K,
    visible: boolean,
  ) => void;
  toggleToolUIVisibility: <K extends keyof ToolUIState>(uiElement: K) => void;

  // Canvas Export
  getCanvasAsDataURL: (() => string | undefined) | null;
  setCanvasExporter: (exporter: (() => string | undefined) | null) => void;

  // Undo System (for user actions on filters, transforms, user annotations)
  undoStack: UndoableState[];
  pushToUndoStack: () => void;
  undoLastAction: () => void;
  canUndo: () => boolean;

  // AI related state
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
    modelType: "detection" | "segmentation" | "classification",
    visible: boolean,
  ) => void;
  clearAiAnnotations: () => void;

  // Global Resets
  resetAllFiltersAndTransforms: () => void; // Resets view, undoable
  resetAllToolRelatedState: () => void; // Full reset for new image, clears undo & AI
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

// Helper for Undoable State
const getCurrentUndoableState = (get: () => ToolState): UndoableState => {
  return {
    imageFilters: { ...get().imageFilters },
    imageTransformations: { ...get().imageTransformations },
    annotations: [...get().annotations.map((ann) => ({ ...ann }))], // Deep copy user annotations
    cropBounds: get().cropBounds ? { ...get().cropBounds } : null,
  };
};

export const useToolStore = create<ToolState>((set, get) => ({
  // Initialize all state properties
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

  // --- Undo System Methods ---
  pushToUndoStack: () => {
    const currentState = getCurrentUndoableState(get);
    set((state) => ({
      undoStack: [...state.undoStack.slice(-19), currentState], // Keep last 20 states
    }));
  },
  undoLastAction: () => {
    const stack = get().undoStack;
    if (stack.length > 0) {
      const prevState = stack[stack.length - 1];
      set({
        imageFilters: { ...prevState.imageFilters },
        imageTransformations: { ...prevState.imageTransformations },
        annotations: [...prevState.annotations.map((ann) => ({ ...ann }))], // Restore user annotations
        cropBounds: prevState.cropBounds ? { ...prevState.cropBounds } : null,
        undoStack: stack.slice(0, -1),
        // Reset drawing state and active tool to avoid conflicts after undo
        isDrawing: false,
        currentDrawingPoints: [],
        activeAnnotationTool: null,
      });
    }
  },
  canUndo: () => get().undoStack.length > 0,

  // --- Image Filter Methods ---
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

  // --- Image Transformation Methods ---
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
    // Resets all transforms
    get().pushToUndoStack();
    set({ imageTransformations: { ...initialTransformations } });
  },
  setStageZoomAndPosition: (scale, position) => {
    // Debounce or smarter push for rapid calls like wheel might be needed in future
    get().pushToUndoStack();
    set((state) => ({
      imageTransformations: { ...state.imageTransformations, scale, position },
    }));
  },
  zoomIn: () => {
    const currentScale = get().imageTransformations.scale;
    get().setImageTransformation("scale", Math.min(currentScale * 1.2, 10)); // setImageTransformation handles undo
  },
  zoomOut: () => {
    const currentScale = get().imageTransformations.scale;
    get().setImageTransformation("scale", Math.max(currentScale / 1.2, 0.1)); // setImageTransformation handles undo
  },
  resetZoom: () => {
    // Resets only user scale and pan, not rotation/flip
    get().pushToUndoStack();
    set((state) => ({
      imageTransformations: {
        ...state.imageTransformations,
        scale: 1,
        position: { x: 0, y: 0 },
      },
    }));
  },

  // --- Crop Methods ---
  setCropBounds: (bounds) => {
    // Push to undo only if bounds actually change to avoid too many states during drag
    if (JSON.stringify(get().cropBounds) !== JSON.stringify(bounds)) {
      get().pushToUndoStack();
    }
    set({ cropBounds: bounds });
  },

  // --- User Annotation Methods ---
  setActiveAnnotationTool: (tool) => {
    const currentTool = get().activeAnnotationTool;
    set({
      activeAnnotationTool: currentTool === tool ? null : tool,
      isDrawing: false,
      currentDrawingPoints: [],
    });
  },
  addAnnotation: (annotationData) => {
    // Internal: called by finish... methods
    get().pushToUndoStack(); // This action modifies the 'annotations' array, so it's undoable
    const newId = crypto.randomUUID();
    const newAnnotation = { ...annotationData, id: newId };
    set((state) => ({ annotations: [...state.annotations, newAnnotation] }));
    return newId;
  },
  clearAllAnnotations: () => {
    // Clears user-drawn annotations
    if (get().annotations.length > 0) {
      get().pushToUndoStack();
    }
    set({ annotations: [] });
  },
  showAnnotations: true, // Default visibility for user annotations
  setShowAnnotations: (show) => set({ showAnnotations: show }),

  // --- User Drawing Methods ---
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
    addAnnotation(annotationData); // addAnnotation handles the pushToUndoStack
    set({ isDrawing: false, currentDrawingPoints: [] });
  },
  finishCurrentTextAnnotation: (text, position, color, fontSize) => {
    get().addAnnotation({ type: "text", text, position, color, fontSize }); // addAnnotation handles undo
    set({ isDrawing: false, currentDrawingPoints: [] });
  },

  // --- Tool UI Panel Methods ---
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

  // --- Canvas Export ---
  setCanvasExporter: (exporter) => set({ getCanvasAsDataURL: exporter }),

  // --- AI Methods ---
  runAiAnalysis: async (modelType) => {
    const dicomId = useDicomStore.getState().dicomData?.id;
    if (!dicomId) {
      set({ aiError: "No DICOM image loaded to analyze." });
      return;
    }
    set((state) => ({
      isAiLoading: { ...state.isAiLoading, [modelType]: true },
      aiError: null, // Clear previous errors for this run
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
    } catch (error: any) {
      console.error(`AI Analysis Error (${modelType}):`, error);
      set((state) => ({
        aiError: `Still working on the ${modelType} AI feature :) Please check back later or ensure models are correctly set up.`,
        isAiLoading: { ...state.isAiLoading, [modelType]: false },
      }));
    }
  },
  setAiAnnotationVisibility: (type, idOrLabel, visible) => {
    set((state) => {
      const updatedSection = state.aiAnnotations[type].map((item: any) => {
        if (
          item.id === idOrLabel ||
          (type === "classifications" && item.label === idOrLabel)
        ) {
          return { ...item, visible };
        }
        return item;
      });
      return {
        aiAnnotations: { ...state.aiAnnotations, [type]: updatedSection },
      };
    });
  },
  toggleAllAiVisibility: (modelType, visible) => {
    set((state) => {
      const newAiAnns = { ...state.aiAnnotations };
      if (modelType === "detection")
        newAiAnns.detections = newAiAnns.detections.map((d) => ({
          ...d,
          visible,
        }));
      else if (modelType === "segmentation")
        newAiAnns.segmentations = newAiAnns.segmentations.map((s) => ({
          ...s,
          visible,
        }));
      else if (modelType === "classification")
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

  // --- Global Reset Methods ---
  resetAllFiltersAndTransforms: () => {
    // Resets view filters & transforms, is undoable
    get().pushToUndoStack();
    set({
      imageFilters: { ...initialImageFilters },
      imageTransformations: { ...initialTransformations },
      // Does not clear user annotations or crop selection here
    });
  },
  resetAllToolRelatedState: () => {
    // Full reset for new image, clears undo & AI state
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
      undoStack: [], // Crucially, clears undo stack
      aiAnnotations: { ...initialAiAnnotations },
      isAiLoading: { ...initialIsAiLoading },
      aiError: null,
    });
  },
}));

// --- Utility Konva Mappers ---
export const mapBrightnessToKonva = (uiBrightness: number): number =>
  uiBrightness / 100;
export const mapContrastToKonva = (uiContrast: number): number => uiContrast; // Konva contrast is -100 to 100
