"use client";
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Line,
  Text,
  Rect as KonvaRect,
  Circle,
  Group,
  Label,
  Tag,
} from "react-konva";
import Konva from "konva";
import { useShallow } from "zustand/react/shallow";
import { useDicomStore } from "../../store/dicomStore";
import {
  useToolStore,
  mapBrightnessToKonva,
  mapContrastToKonva,
  CropBounds,
  Annotation,
} from "../../store/toolStore";
import { Icons } from "../../components/ui/icons";
import {
  BoundingBox,
  SegmentationContour,
  ClassificationPrediction,
} from "../../types/ai";
import { FreehandOptionsPanel } from "./FreehandOptionsPanel";
import { TextAnnotationOptionsPanel } from "./TextAnnotationOptionsPanel";
import { ZoomControlPanel } from "./ZoomControlPanel";
import { BrightnessContrastPanel } from "./BrightnessContrastPanel";

const AI_COLORS: Record<string, string> = {
  cavity: "rgba(245, 158, 11, 0.9)", // Amber/Orange for "cavity"
  pa: "rgba(168, 85, 247, 0.9)", // Purple for "pa"

  detection_default: "rgba(0, 255, 0, 0.9)",
};

let dicomCanvasRenderCount = 0;

export function DicomCanvas() {
  dicomCanvasRenderCount++;
  // console.log(
  //   `%cDicomCanvas RENDER #${dicomCanvasRenderCount}`,
  //   "color: orange; font-weight: bold;",
  // );

  const dicomData = useDicomStore((state) => state.dicomData);
  // console.log("DicomCanvas: dicomData from store:", dicomData);

  const {
    imageFilters,
    setImageFilter,
    imageTransformations,
    setImageTransformation,
    setSourceCrop,
    resetCrop,
    annotations,
    showAnnotations,
    activeAnnotationTool,
    isDrawing,
    currentDrawingPoints,
    resetAllToolRelatedState,
    startCurrentDrawing,
    finishCurrentTextAnnotation,
    addPointToCurrentDrawing,
    finishCurrentPathAnnotation,
    setStageZoomAndPosition,
    resetZoom,
    toolUIState,
    setToolUIVisibility,
    setCanvasExporter,
    setOriginalDicomDownloader,
    aiAnnotations,
    isAiLoading,
    updateAnnotation,
    freehandColor,
    freehandStrokeWidth,
    addAnnotation,
  } = useToolStore(
    useShallow((state) => {
      // console.log(
      //   "%cDicomCanvas: useToolStore SELECTOR RUNNING",
      //   "color: blue;",
      // );
      return {
        imageFilters: state.imageFilters,
        setImageFilter: state.setImageFilter,
        imageTransformations: state.imageTransformations,
        setImageTransformation: state.setImageTransformation,
        setSourceCrop: state.setSourceCrop,
        resetCrop: state.resetCrop,
        annotations: state.annotations,
        showAnnotations: state.showAnnotations,
        activeAnnotationTool: state.activeAnnotationTool,
        isDrawing: state.isDrawing,
        currentDrawingPoints: state.currentDrawingPoints,
        resetAllToolRelatedState: state.resetAllToolRelatedState,
        startCurrentDrawing: state.startCurrentDrawing,
        finishCurrentTextAnnotation: state.finishCurrentTextAnnotation,
        addPointToCurrentDrawing: state.addPointToCurrentDrawing,
        finishCurrentPathAnnotation: state.finishCurrentPathAnnotation,
        setStageZoomAndPosition: state.setStageZoomAndPosition,
        resetZoom: state.resetZoom,
        toolUIState: state.toolUIState,
        setToolUIVisibility: state.setToolUIVisibility,
        setCanvasExporter: state.setCanvasExporter,
        setOriginalDicomDownloader: state.setOriginalDicomDownloader,
        aiAnnotations: state.aiAnnotations,
        isAiLoading: state.isAiLoading,
        updateAnnotation: state.updateAnnotation,
        freehandColor: state.freehandColor,
        freehandStrokeWidth: state.freehandStrokeWidth,
        addAnnotation: state.addAnnotation,
      };
    }),
  );
  // console.log("DicomCanvas: toolStore values:", {
  //   activeAnnotationTool,
  //   isDrawing,
  //   toolUIState,
  // });

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [originalFileBlob, setOriginalFileBlob] = useState<Blob | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const imageNodeRef = useRef<Konva.Image>(null);
  const imageGroupRef = useRef<Konva.Group>(null);

  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [fit, setFit] = useState({ scale: 1, offsetX: 0, offsetY: 0 });

  const [cropUIRect_Display, setCropUIRect_Display] =
    useState<CropBounds | null>(null);
  const [isDrawingCropRect, setIsDrawingCropRect] = useState(false);
  const [cropStartPoint_Display, setCropStartPoint_Display] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Text config not used directly for annotations, store handles defaults
  // const [textConfig, setTextConfig] = useState({
  //   fontSize: 16,
  //   color: "#00FF00",
  // });

  const dicomId = dicomData?.id;
  const prevDicomIdRef = useRef(dicomId);

  useEffect(() => {
    const currentDicomIdInEffect = dicomData?.id;
    // console.log(
    //   `%cDicomCanvas: resetAllToolRelatedState EFFECT. PrevID: ${prevDicomIdRef.current}, CurrID: ${currentDicomIdInEffect}`,
    //   "color: green;",
    // );
    if (prevDicomIdRef.current !== currentDicomIdInEffect) {
      if (currentDicomIdInEffect) {
        // console.log(
        //   "DicomCanvas: New DICOM detected, resetting tool state. ID:",
        //   currentDicomIdInEffect,
        // );
        resetAllToolRelatedState();
      } else if (prevDicomIdRef.current) {
        // console.log("DicomCanvas: DICOM unloaded, resetting tool state.");
        resetAllToolRelatedState();
      }
      // console.log("DicomCanvas: Resetting local crop UI state in reset effect");
      setCropUIRect_Display(null);
      setIsDrawingCropRect(false);
      setCropStartPoint_Display(null);
    }
    prevDicomIdRef.current = currentDicomIdInEffect;
  }, [dicomData?.id, resetAllToolRelatedState]);

  useEffect(() => {
    // console.log(
    //   `%cDicomCanvas: HTMLImageElement loading EFFECT. DicomID: ${dicomData?.id}, pngDataUrl exists: ${!!dicomData?.pngDataUrl}`,
    //   "color: green;",
    // );
    if (!dicomData?.pngDataUrl) {
      // console.log(
      //   "DicomCanvas: No pngDataUrl, setting image to null in effect.",
      // );
      setImage(null);
      setOriginalFileBlob(null);
      return;
    }
    const img = new window.Image();
    img.src = dicomData.pngDataUrl;
    img.onload = () => {
      // console.log(
      //   "DicomCanvas: HTMLImageElement LOADED, setting image state.",
      //   img.width,
      //   img.height,
      // );
      setImage(img);
    };
    img.onerror = () => {
      console.error(
        "DicomCanvas: Failed to load HTMLImageElement from data URL",
      );
      setImage(null);
    };
    const fetchOriginal = async () => {
      if (dicomData.id) {
        // console.log(
        //   "DicomCanvas: Fetching original DICOM blob for ID:",
        //   dicomData.id,
        // );
        try {
          const response = await fetch(
            `/api/v1/dicom/${dicomData.id}/download_original`,
          );
          if (response.ok) {
            const blob = await response.blob();
            // console.log(
            //   "DicomCanvas: Original DICOM blob fetched, setting state.",
            // );
            setOriginalFileBlob(blob);
          } else {
            console.warn(
              "DicomCanvas: Could not fetch original DICOM blob for download. Status:",
              response.status,
            );
            setOriginalFileBlob(null);
          }
        } catch (e) {
          console.error("DicomCanvas: Error fetching original DICOM blob:", e);
          setOriginalFileBlob(null);
        }
      }
    };
    fetchOriginal();
  }, [dicomData?.pngDataUrl, dicomData?.id]);

  useEffect(() => {
    // console.log(
    //   `%cDicomCanvas: Original DICOM Downloader EFFECT. originalFileBlob exists: ${!!originalFileBlob}`,
    //   "color: green;",
    // );
    if (originalFileBlob) {
      const downloader = () => originalFileBlob;
      setOriginalDicomDownloader(downloader);
    } else {
      setOriginalDicomDownloader(null);
    }

    return () => {
      // console.log(
      //   "DicomCanvas: Cleaning up Original DICOM Downloader effect (DicomCanvas unmounting or blob becoming null)",
      // );
      setOriginalDicomDownloader(null);
    };
  }, [originalFileBlob, setOriginalDicomDownloader]);

  useEffect(() => {
    // console.log(
    //   `%cDicomCanvas: Canvas Exporter EFFECT. Image loaded: ${!!image}`,
    //   "color: green;",
    // );
    if (image) {
      const exporter = () => {
        const groupToExport = imageGroupRef.current;
        if (groupToExport) {
          // console.log("DicomCanvas: Exporting imageGroupRef toDataURL");
          return groupToExport.toDataURL({
            mimeType: "image/png",
            quality: 1,
            pixelRatio: 2,
          });
        } else if (stageRef.current) {
          // console.log("DicomCanvas: Exporting stageRef toDataURL");
          return stageRef.current.toDataURL({
            mimeType: "image/png",
            quality: 1,
            pixelRatio: 2,
          });
        }
        console.warn(
          "DicomCanvas: Exporter called but no valid target (group/stage) or image.",
        );
        return undefined;
      };
      setCanvasExporter(exporter);
    } else {
      setCanvasExporter(null);
    }

    return () => {
      // console.log(
      //   "DicomCanvas: Cleaning up Canvas Exporter effect (DicomCanvas unmounting or image becoming null)",
      // );
      setCanvasExporter(null);
    };
  }, [image, setCanvasExporter]);

  useEffect(() => {
    // console.log(
    //   `%cDicomCanvas: ResizeObserver EFFECT. Container ref: ${!!containerRef.current}`,
    //   "color: green;",
    // );
    const el = containerRef.current;
    if (!el) return;
    const updateDim = () => {
      // console.log(
      //   "DicomCanvas: ResizeObserver - updateDim called. OffsetWidth:",
      //   el.offsetWidth, "OffsetHeight:", el.offsetHeight
      // );
      // Only set dimensions if they are valid (both > 0)
      if (el.offsetWidth > 0 && el.offsetHeight > 0) {
        setDimensions({ width: el.offsetWidth, height: el.offsetHeight });
      } else if (
        el.offsetWidth > 0 &&
        dimensions?.height &&
        dimensions.height <= 0
      ) {
        // If width is fine but height is still 0, keep old width if it was valid but set height
        // This can happen during layout shifts
        setDimensions((prev) => ({
          width: el.offsetWidth,
          height: prev?.height || 0,
        }));
      } else {
        // console.log("DicomCanvas: ResizeObserver - received zero or invalid dimensions from offset, not updating state yet.");
      }
    };
    updateDim(); // Initial call
    const obs = new ResizeObserver(updateDim);
    obs.observe(el);
    return () => {
      // console.log("DicomCanvas: Cleaning up ResizeObserver effect");
      obs.disconnect();
    };
  }, []); // dimensions dependency removed to avoid loop if initial height is 0

  const currentImageDisplay = useMemo(() => {
    // console.log(
    //   `%cDicomCanvas: currentImageDisplay useMemo. Image: ${!!image}, SourceCrop:`,
    //   imageTransformations.sourceCrop,
    //   "color: purple;",
    // );
    if (!image) {
      // console.log("DicomCanvas: currentImageDisplay returning NULL (no image)");
      return null;
    }
    if (imageTransformations.sourceCrop) {
      if (
        imageTransformations.sourceCrop.width <= 0 ||
        imageTransformations.sourceCrop.height <= 0
      ) {
        // console.warn(
        //   "DicomCanvas: currentImageDisplay - sourceCrop has zero width/height, using full image dims",
        // );
        return {
          cropToApply: undefined,
          konvaImageWidth: image.width,
          konvaImageHeight: image.height,
        };
      }
      return {
        cropToApply: imageTransformations.sourceCrop,
        konvaImageWidth: imageTransformations.sourceCrop.width,
        konvaImageHeight: imageTransformations.sourceCrop.height,
      };
    }
    if (image.width <= 0 || image.height <= 0) {
      // console.warn(
      //   "DicomCanvas: currentImageDisplay - HTMLImageElement has zero/invalid width/height, returning null",
      // );
      return null;
    }
    return {
      cropToApply: undefined,
      konvaImageWidth: image.width,
      konvaImageHeight: image.height,
    };
  }, [image, imageTransformations.sourceCrop]);
  // console.log(
  //   "DicomCanvas: Value of currentImageDisplay after useMemo:",
  //   currentImageDisplay,
  // );

  useEffect(() => {
    // console.log(
    //   `%cDicomCanvas: Fit Calculation EFFECT. Dims: ${!!dimensions}, currentImageDisplay: ${!!currentImageDisplay}, Fit values:`,
    //   fit,
    //   "color: green;",
    // );
    const prevFitRef = { ...fit };

    if (
      !dimensions ||
      dimensions.width <= 0 ||
      dimensions.height <= 0 ||
      !currentImageDisplay
    ) {
      if (fit.scale !== 1 || fit.offsetX !== 0 || fit.offsetY !== 0) {
        // console.log(
        //   "DicomCanvas: Fit - Resetting fit state to default due to missing/invalid dims/display",
        // );
        setFit({ scale: 1, offsetX: 0, offsetY: 0 });
      }
      return;
    }
    const PADDING = 0.98;
    const { konvaImageWidth, konvaImageHeight } = currentImageDisplay;
    if (konvaImageWidth <= 0 || konvaImageHeight <= 0) {
      if (fit.scale !== 1 || fit.offsetX !== 0 || fit.offsetY !== 0) {
        // console.log(
        //   "DicomCanvas: Fit - Resetting fit state to default due to zero display dims",
        // );
        setFit({ scale: 1, offsetX: 0, offsetY: 0 });
      }
      return;
    }
    const scaleX = dimensions.width / konvaImageWidth;
    const scaleY = dimensions.height / konvaImageHeight;
    const calculatedFitScale = Math.min(scaleX, scaleY) * PADDING;
    const finalScaledWidth = konvaImageWidth * calculatedFitScale;
    const finalScaledHeight = konvaImageHeight * calculatedFitScale;
    const newFit = {
      scale: calculatedFitScale > 0 ? calculatedFitScale : 1, // Ensure scale is positive
      offsetX: (dimensions.width - finalScaledWidth) / 2,
      offsetY: (dimensions.height - finalScaledHeight) / 2,
    };
    if (
      fit.scale !== newFit.scale ||
      fit.offsetX !== newFit.offsetX ||
      fit.offsetY !== newFit.offsetY
    ) {
      // console.log(
      //   "DicomCanvas: Fit - Updating fit state. Old fit:",
      //   prevFitRef,
      //   "New fit:",
      //   newFit,
      // );
      setFit(newFit);
    }
  }, [dimensions, currentImageDisplay, fit.scale, fit.offsetX, fit.offsetY]);

  useEffect(() => {
    // console.log(
    //   `%cDicomCanvas: Filter Caching EFFECT. Filters:`,
    //   imageFilters,
    //   `Image: ${!!image}, Display: ${!!currentImageDisplay}`,
    //   "color: green;",
    // );
    const imgNode = imageNodeRef.current;
    if (
      imgNode &&
      image &&
      image.complete &&
      image.naturalWidth > 0 &&
      currentImageDisplay
    ) {
      const { brightness, contrast, invert } = imageFilters;
      const needsCache = invert || brightness !== 0 || contrast !== 0;
      if (imgNode.width() > 0 && imgNode.height() > 0) {
        if (needsCache) {
          // console.log("DicomCanvas: Filter - Caching image node");
          imgNode.cache();
        } else {
          // console.log("DicomCanvas: Filter - Clearing image node cache");
          imgNode.clearCache();
        }
      } else if (!needsCache) {
        // console.log(
        //   "DicomCanvas: Filter - No cache needed, clearing if exists",
        // );
        imgNode.clearCache();
      }
      // imgNode.getLayer()?.batchDraw(); // KEEP COMMENTED
    }
  }, [imageFilters, image, currentImageDisplay]);

  const getPointerRelativeToImageGroupContent = useCallback(() => {
    const stage = stageRef.current;
    const group = imageGroupRef.current;
    if (!stage || !group) {
      console.warn(
        "getPointerRelativeToImageGroupContent: Stage or Group not ready",
      );
      return null;
    }
    const pointerOnStage = stage.getPointerPosition();
    if (!pointerOnStage) {
      // console.warn( // This can be noisy if mouse is outside stage
      //   "getPointerRelativeToImageGroupContent: No pointer on stage",
      // );
      return null;
    }
    try {
      const transform = group.getAbsoluteTransform().copy().invert();
      if (!transform) {
        console.warn(
          "getPointerRelativeToImageGroupContent: Could not invert group transform",
        );
        return null;
      }
      return transform.point(pointerOnStage);
    } catch (error) {
      console.error(
        "Error in getPointerRelativeToImageGroupContent (transform):",
        error,
      );
      return null;
    }
  }, []); // stageRef and imageGroupRef are refs, don't need to be deps

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage || !imageGroupRef.current) {
      console.warn("DicomCanvas: MouseDown - Stage or ImageGroup not ready.");
      return;
    }
    // console.log(
    //   "DicomCanvas: handleMouseDown",
    //   e.evt.button,
    //   "ActiveTool:",
    //   activeAnnotationTool,
    //   "CropUI:",
    //   toolUIState.showCropInterface,
    // );
    if (e.evt.button !== 0) return; // Only left click
    const posInGroup = getPointerRelativeToImageGroupContent();
    if (!posInGroup) {
      // console.log("DicomCanvas: MouseDown - posInGroup is null");
      return;
    }
    // console.log("DicomCanvas: MouseDown - posInGroup:", posInGroup);

    if (toolUIState.showCropInterface && image && currentImageDisplay) {
      // console.log("DicomCanvas: MouseDown - Starting crop rect drawing");
      const startX = Math.max(
        0,
        Math.min(posInGroup.x, currentImageDisplay.konvaImageWidth),
      );
      const startY = Math.max(
        0,
        Math.min(posInGroup.y, currentImageDisplay.konvaImageHeight),
      );
      setCropStartPoint_Display({ x: startX, y: startY });
      setCropUIRect_Display({ x: startX, y: startY, width: 0, height: 0 });
      setIsDrawingCropRect(true);
      e.evt.preventDefault();
      return;
    }
    if (activeAnnotationTool) {
      // console.log(
      //   "DicomCanvas: MouseDown - Annotation tool active:",
      //   activeAnnotationTool,
      // );
      if (
        ["freehand", "highlight", "measurement"].includes(activeAnnotationTool)
      ) {
        startCurrentDrawing(posInGroup);
      } else if (activeAnnotationTool === "text") {
        const text = window.prompt("Enter text:", "Annotation");
        if (text && text.trim() !== "") {
          // Ensure text is not empty
          finishCurrentTextAnnotation(text, posInGroup);
        } else if (text === "") {
          // User entered empty string
          alert("Annotation text cannot be empty.");
        }
      }
      e.evt.stopPropagation(); // Prevent stage drag when drawing
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage || !imageGroupRef.current) {
      // console.warn("DicomCanvas: MouseMove - Stage or ImageGroup not ready."); // Can be noisy
      return;
    }
    const posInGroup = getPointerRelativeToImageGroupContent();
    if (!posInGroup) return;

    if (
      toolUIState.showCropInterface &&
      isDrawingCropRect &&
      cropStartPoint_Display &&
      image &&
      currentImageDisplay
    ) {
      const currentX = Math.max(
        0,
        Math.min(posInGroup.x, currentImageDisplay.konvaImageWidth),
      );
      const currentY = Math.max(
        0,
        Math.min(posInGroup.y, currentImageDisplay.konvaImageHeight),
      );
      setCropUIRect_Display({
        x: Math.min(cropStartPoint_Display.x, currentX),
        y: Math.min(cropStartPoint_Display.y, currentY),
        width: Math.abs(currentX - cropStartPoint_Display.x),
        height: Math.abs(currentY - cropStartPoint_Display.y),
      });
      e.evt.preventDefault();
      return;
    }
    if (isDrawing && activeAnnotationTool) {
      addPointToCurrentDrawing(posInGroup);
    }
  };

  const handleMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage || !imageGroupRef.current) {
      console.warn("DicomCanvas: MouseUp - Stage or ImageGroup not ready.");
      return;
    }
    // console.log(
    //   "DicomCanvas: handleMouseUp. isDrawingCropRect:",
    //   isDrawingCropRect,
    //   "isDrawingAnnotation:",
    //   isDrawing,
    //   "ActiveTool:",
    //   activeAnnotationTool,
    // );
    if (
      toolUIState.showCropInterface &&
      isDrawingCropRect &&
      cropUIRect_Display &&
      image &&
      currentImageDisplay
    ) {
      // console.log(
      //   "DicomCanvas: MouseUp - Finishing crop rect drawing. UI Rect:",
      //   cropUIRect_Display,
      // );
      setIsDrawingCropRect(false);
      setCropStartPoint_Display(null);
      if (cropUIRect_Display.width > 5 && cropUIRect_Display.height > 5) {
        let newSourceX = cropUIRect_Display.x;
        let newSourceY = cropUIRect_Display.y;
        if (imageTransformations.sourceCrop) {
          newSourceX += imageTransformations.sourceCrop.x;
          newSourceY += imageTransformations.sourceCrop.y;
        }
        newSourceX = Math.max(
          0,
          Math.min(newSourceX, image.width - cropUIRect_Display.width),
        );
        newSourceY = Math.max(
          0,
          Math.min(newSourceY, image.height - cropUIRect_Display.height),
        );
        const newSourceWidth = Math.min(
          cropUIRect_Display.width,
          image.width - newSourceX,
        );
        const newSourceHeight = Math.min(
          cropUIRect_Display.height,
          image.height - newSourceY,
        );

        if (newSourceWidth > 5 && newSourceHeight > 5) {
          const newSourceCropVal = {
            x: Math.round(newSourceX),
            y: Math.round(newSourceY),
            width: Math.round(newSourceWidth),
            height: Math.round(newSourceHeight),
          };
          // console.log(
          //   "DicomCanvas: MouseUp - Setting sourceCrop:",
          //   newSourceCropVal,
          // );
          setSourceCrop(newSourceCropVal);
        } else {
          // console.log(
          //   "DicomCanvas: MouseUp - Crop rect too small after clamping, not setting sourceCrop.",
          // );
        }
      } else {
        // console.log(
        //   "DicomCanvas: MouseUp - Crop UI rect too small, not setting sourceCrop.",
        // );
      }
      setCropUIRect_Display(null); // Clear UI rect
      e.evt.preventDefault();
      return;
    }

    if (isDrawing && activeAnnotationTool) {
      // console.log(
      //   "DicomCanvas: MouseUp - Finishing annotation:",
      //   activeAnnotationTool,
      // );
      if (
        typeof finishCurrentPathAnnotation !== "function" &&
        ["freehand", "highlight", "measurement"].includes(activeAnnotationTool)
      ) {
        console.error(
          "CRITICAL: finishCurrentPathAnnotation is not a function for path-based tool. Check store/destructuring.",
          finishCurrentPathAnnotation,
        );
        useToolStore.setState({ isDrawing: false, currentDrawingPoints: [] }); // Reset drawing state
        return;
      }

      if (
        activeAnnotationTool === "freehand" ||
        activeAnnotationTool === "highlight"
      ) {
        finishCurrentPathAnnotation(activeAnnotationTool);
      } else if (activeAnnotationTool === "measurement") {
        if (currentDrawingPoints.length >= 4) {
          const calculateDistanceLocal = (points: number[]): number => {
            if (points.length < 4) return 0;
            const [x1, y1, x2, y2] = [
              points[0],
              points[1],
              points[points.length - 2],
              points[points.length - 1],
            ];
            const dx = x2 - x1;
            const dy = y2 - y1;
            if (dicomData?.meta.pixel_spacing) {
              const [spacingY, spacingX] = dicomData.meta.pixel_spacing; // DICOM typically [row, col] or [Y, X]
              return Math.sqrt(
                Math.pow(dx * spacingX, 2) + Math.pow(dy * spacingY, 2),
              );
            }
            return Math.sqrt(dx * dx + dy * dy);
          };

          const distance = calculateDistanceLocal(currentDrawingPoints);
          const unit = dicomData?.meta.pixel_spacing ? "mm" : "px";
          const textContent = `${distance.toFixed(1)} ${unit}`;

          // Call the store's addAnnotation directly for measurements
          // It handles the undo stack.
          addAnnotation({
            type: "measurement",
            points: [...currentDrawingPoints],
            color: "#00FF00", // Or use a store-defined color for measurements
            strokeWidth: 2, // Or use a store-defined strokeWidth
            text: textContent,
            // textPosition is handled by the renderer based on points for measurements.
          });
          useToolStore.setState({ isDrawing: false, currentDrawingPoints: [] }); // Manually reset
        } else {
          // Not enough points for a measurement line, just reset drawing state
          useToolStore.setState({ isDrawing: false, currentDrawingPoints: [] });
        }
      }
    }
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldStageScale = stage.scaleX(); // Assuming uniform scaling
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const scaleBy = 1.1;
    let newStageScale =
      e.evt.deltaY > 0 ? oldStageScale / scaleBy : oldStageScale * scaleBy;

    // Incorporate base fit scale for min/max limits
    const baseFitScale = fit.scale > 0 ? fit.scale : 1; // Ensure fit.scale is positive
    const minTotalScale = baseFitScale * 0.1; // Min zoom relative to fit
    const maxTotalScale = baseFitScale * 10.0; // Max zoom relative to fit (increased from 2.0)

    newStageScale = Math.max(
      minTotalScale,
      Math.min(newStageScale, maxTotalScale),
    );

    if (Math.abs(newStageScale - oldStageScale) < 0.0001) return; // Avoid tiny changes

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldStageScale,
      y: (pointer.y - stage.y()) / oldStageScale,
    };

    const newStagePos = {
      x: pointer.x - mousePointTo.x * newStageScale,
      y: pointer.y - mousePointTo.y * newStageScale,
    };

    // User scale is relative to the base fit scale
    const newUserScale = newStageScale / baseFitScale;
    // User position is the delta from the fit offset
    const newUserPosition = {
      x: newStagePos.x - fit.offsetX,
      y: newStagePos.y - fit.offsetY,
    };

    setStageZoomAndPosition(newUserScale, newUserPosition);
  };

  const isLoadingDicom = useDicomStore((state) => state.isLoading);
  // console.log(
  //   "DicomCanvas: Before render guards - isLoadingDicom:",
  //   isLoadingDicom,
  //   "dicomData:",
  //   !!dicomData,
  //   "image:",
  //   !!image,
  //   "currentImageDisplay:",
  //   !!currentImageDisplay,
  //   "dimensions:",
  //   !!dimensions,
  // );

  // --- Render Guards ---
  if (isLoadingDicom || (dicomData && (!image || !currentImageDisplay))) {
    // console.log("DicomCanvas: Rendering LOADING DICOM state");
    return (
      <div
        ref={containerRef}
        className="w-full h-full bg-black flex items-center justify-center"
      >
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue mb-4"></div>
          <p className="text-text-primary">Loading DICOM...</p>
        </div>
      </div>
    );
  }

  // CRITICAL FIX: Ensure dimensions are valid before rendering Stage
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    // console.log(
    //   `DicomCanvas: Rendering INITIALIZING CANVAS state (dimensions: ${
    //     dimensions ? `${dimensions.width}x${dimensions.height}` : "null"
    //   })`,
    // );
    return (
      <div
        ref={containerRef}
        className="w-full h-full bg-black flex items-center justify-center"
      >
        <p className="text-text-primary">
          Initializing canvas (
          {dimensions
            ? `width: ${dimensions.width}, height: ${dimensions.height}`
            : "waiting for dimensions"}
          )...
        </p>
      </div>
    );
  }

  if (!image || !currentImageDisplay) {
    // console.log("DicomCanvas: Rendering NO DICOM IMAGE LOADED state");
    return (
      <div
        ref={containerRef}
        className="w-full h-full bg-black flex flex-col items-center justify-center"
      >
        <Icons.Image size={64} className="text-text-secondary mb-2" />
        <p className="text-text-primary">No DICOM image loaded.</p>
        <p className="text-xs text-text-secondary mt-2">
          Upload a .dcm file to start.
        </p>
      </div>
    );
  }
  // console.log(
  //   "DicomCanvas: Proceeding to full render. currentImageDisplay:",
  //   currentImageDisplay,
  //   "Fit:",
  //   fit,
  // );

  const { scale: userAppliedScale, position: userAppliedPosition } =
    imageTransformations;

  // Robust scale calculation
  const baseFitScale = fit.scale > 0 ? fit.scale : 1; // Ensure fit.scale is positive
  let calculatedTotalStageScale = userAppliedScale * baseFitScale;
  if (calculatedTotalStageScale <= 0 || !isFinite(calculatedTotalStageScale)) {
    console.warn(
      `Invalid calculatedTotalStageScale (${calculatedTotalStageScale}), defaulting to 1.`,
    );
    calculatedTotalStageScale = 1;
  }
  const currentTotalStageScale = calculatedTotalStageScale;

  const currentStageX = userAppliedPosition.x + fit.offsetX;
  const currentStageY = userAppliedPosition.y + fit.offsetY;

  let calculatedItemScale = 1 / currentTotalStageScale;
  if (
    calculatedItemScale <= 0 ||
    !isFinite(calculatedItemScale) ||
    calculatedItemScale > 1000
  ) {
    // Add upper bound for sanity
    // console.warn(`Invalid calculatedItemScale (${calculatedItemScale}) from total scale ${currentTotalStageScale}, defaulting to 1.`);
    calculatedItemScale = 1;
  }
  const itemScale = calculatedItemScale;

  const getCursor = () => {
    if (toolUIState.showCropInterface) return "crosshair";
    if (activeAnnotationTool === "text") return "text";
    if (activeAnnotationTool) return "crosshair"; // For freehand, measure, highlight
    return "grab"; // Default for panning
  };

  const CropControlPanel = () =>
    // Placeholder for if you create a separate Crop panel component
    toolUIState.showCropInterface ? <div>Crop Controls Active</div> : null;

  let classificationTextYOffset = 10;
  // console.log("DicomCanvas: Stage Props:", {
  //   width: dimensions.width,
  //   height: dimensions.height,
  //   x: currentStageX,
  //   y: currentStageY,
  //   scaleX: currentTotalStageScale,
  // });
  // console.log("DicomCanvas: Image Group Props:", {
  //   offsetX: currentImageDisplay.konvaImageWidth / 2,
  //   offsetY: currentImageDisplay.konvaImageHeight / 2,
  //   x: currentImageDisplay.konvaImageWidth / 2,
  //   y: currentImageDisplay.konvaImageHeight / 2,
  //   rotation: imageTransformations.rotation,
  // });
  // console.log("DicomCanvas: KonvaImage Props:", {
  //   width: currentImageDisplay.konvaImageWidth,
  //   height: currentImageDisplay.konvaImageHeight,
  //   crop: currentImageDisplay.cropToApply,
  // });

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-black relative overflow-hidden"
      style={{ touchAction: "none", cursor: getCursor() }}
    >
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        x={currentStageX}
        y={currentStageY}
        scaleX={currentTotalStageScale}
        scaleY={currentTotalStageScale}
        draggable={
          !activeAnnotationTool &&
          !isDrawing &&
          !toolUIState.showCropInterface &&
          !isDrawingCropRect
        }
        onDragEnd={(e) => {
          const newPos = {
            x: e.target.x() - fit.offsetX,
            y: e.target.y() - fit.offsetY,
          };
          setStageZoomAndPosition(imageTransformations.scale, newPos);
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          // Added onMouseLeave to reset drawing state if mouse leaves canvas
          if (isDrawing && !isDrawingCropRect) {
            // Only if drawing annotations, not crop rect
            // console.log("DicomCanvas: Mouse left while drawing, cancelling draw.");
            // Depending on tool, either finish or cancel. For now, let's cancel path-based.
            useToolStore.setState({
              isDrawing: false,
              currentDrawingPoints: [],
            });
          }
          // If drawing crop rect and mouse leaves, it will be finalized on mouse up (even outside)
          // or could be cancelled here if desired.
        }}
      >
        <Layer>
          <Group
            ref={imageGroupRef}
            offsetX={currentImageDisplay.konvaImageWidth / 2}
            offsetY={currentImageDisplay.konvaImageHeight / 2}
            x={currentImageDisplay.konvaImageWidth / 2}
            y={currentImageDisplay.konvaImageHeight / 2}
            rotation={imageTransformations.rotation}
            scaleX={imageTransformations.flipX ? -1 : 1}
            scaleY={imageTransformations.flipY ? -1 : 1}
          >
            <KonvaImage
              ref={imageNodeRef}
              image={image}
              x={0}
              y={0}
              width={currentImageDisplay.konvaImageWidth}
              height={currentImageDisplay.konvaImageHeight}
              crop={currentImageDisplay.cropToApply}
              filters={imageFilters.invert ? [Konva.Filters.Invert] : []}
              brightness={mapBrightnessToKonva(imageFilters.brightness)}
              contrast={mapContrastToKonva(imageFilters.contrast)}
              listening={
                // Only listen if not cropping or annotating (stage handles those)
                !toolUIState.showCropInterface && !activeAnnotationTool
              }
            />
            {toolUIState.showCropInterface && cropUIRect_Display && (
              <KonvaRect
                x={cropUIRect_Display.x}
                y={cropUIRect_Display.y}
                width={cropUIRect_Display.width}
                height={cropUIRect_Display.height}
                stroke="rgba(255, 0, 0, 0.8)"
                strokeWidth={1.5 * itemScale} // Ensure itemScale is valid
                dash={[4 * itemScale, 2 * itemScale]}
                listening={false} // Crop UI rect should not be interactive itself
              />
            )}
          </Group>
        </Layer>

        {showAnnotations && (
          <Layer
            name="user-annotations-layer"
            listening={!toolUIState.showCropInterface} // Annotations not active during crop
          >
            <Group /* Group for annotations, mirrors image group transforms */
              offsetX={currentImageDisplay.konvaImageWidth / 2}
              offsetY={currentImageDisplay.konvaImageHeight / 2}
              x={currentImageDisplay.konvaImageWidth / 2}
              y={currentImageDisplay.konvaImageHeight / 2}
              rotation={imageTransformations.rotation}
              scaleX={imageTransformations.flipX ? -1 : 1}
              scaleY={imageTransformations.flipY ? -1 : 1}
            >
              {annotations
                .filter((ann) => ann && ann.type) // Safety filter
                .map((ann: Annotation) => {
                  if (
                    (ann.type === "freehand" ||
                      ann.type === "highlight" ||
                      ann.type === "measurement") &&
                    ann.points
                  ) {
                    return (
                      <Group key={ann.id}>
                        <Line
                          points={ann.points}
                          stroke={ann.color}
                          strokeWidth={(ann.strokeWidth || 2) * itemScale}
                          tension={ann.type === "freehand" ? 0.5 : 0}
                          lineCap="round"
                          lineJoin="round"
                          opacity={ann.type === "highlight" ? 0.5 : 1}
                        />
                        {ann.type === "measurement" &&
                          ann.points.length >= 4 && (
                            <>
                              <Circle
                                x={ann.points[0]}
                                y={ann.points[1]}
                                radius={3 * itemScale}
                                fill={ann.color}
                              />
                              <Circle
                                x={ann.points[ann.points.length - 2]}
                                y={ann.points[ann.points.length - 1]}
                                radius={3 * itemScale}
                                fill={ann.color}
                              />
                              {ann.text &&
                                ann.text.trim() !== "" && ( // FIX: Ensure text is not empty
                                  <Text
                                    x={
                                      (ann.points[0] +
                                        ann.points[ann.points.length - 2]) /
                                        2 +
                                      5 * itemScale
                                    }
                                    y={
                                      (ann.points[1] +
                                        ann.points[ann.points.length - 1]) /
                                        2 -
                                      10 * itemScale
                                    }
                                    text={ann.text}
                                    fontSize={12 * itemScale}
                                    fill={ann.color}
                                  />
                                )}
                            </>
                          )}
                      </Group>
                    );
                  } else if (
                    ann.type === "text" &&
                    ann.text &&
                    ann.text.trim() !== "" &&
                    ann.position
                  ) {
                    // FIX: Ensure text is not empty
                    return (
                      <Text
                        key={ann.id}
                        x={ann.position.x}
                        y={ann.position.y}
                        text={ann.text}
                        fontSize={(ann.fontSize || 16) * itemScale}
                        fill={ann.color || "#00FF00"}
                        draggable
                        onDragEnd={(e) => {
                          if (updateAnnotation)
                            updateAnnotation(ann.id, {
                              position: { x: e.target.x(), y: e.target.y() },
                            });
                        }}
                      />
                    );
                  }
                  return null;
                })}
              {/* Current drawing preview */}
              {isDrawing &&
                currentDrawingPoints.length >= 2 &&
                activeAnnotationTool &&
                ["freehand", "highlight", "measurement"].includes(
                  activeAnnotationTool,
                ) && (
                  <Line
                    points={currentDrawingPoints}
                    stroke={
                      activeAnnotationTool === "highlight"
                        ? "rgba(255,255,0,0.5)"
                        : activeAnnotationTool === "measurement"
                          ? "#00FFFF" // Preview color for measurement
                          : activeAnnotationTool === "freehand"
                            ? freehandColor // Use store's freehand color for preview
                            : "#FF00FF" // Fallback
                    }
                    strokeWidth={
                      (activeAnnotationTool === "highlight"
                        ? 20
                        : activeAnnotationTool === "freehand"
                          ? freehandStrokeWidth // Use store's width for preview
                          : 2) * itemScale
                    }
                    tension={activeAnnotationTool === "freehand" ? 0.5 : 0}
                    lineCap="round"
                    lineJoin="round"
                    dash={
                      activeAnnotationTool === "measurement"
                        ? [4 * itemScale, 2 * itemScale]
                        : undefined
                    }
                  />
                )}
            </Group>
          </Layer>
        )}

        <Layer name="ai-annotations-layer" listening={false}>
          <Group /* Group for AI annotations, mirrors image group transforms */
            offsetX={currentImageDisplay.konvaImageWidth / 2}
            offsetY={currentImageDisplay.konvaImageHeight / 2}
            x={currentImageDisplay.konvaImageWidth / 2}
            y={currentImageDisplay.konvaImageHeight / 2}
            rotation={imageTransformations.rotation}
            scaleX={imageTransformations.flipX ? -1 : 1}
            scaleY={imageTransformations.flipY ? -1 : 1}
          >
            {aiAnnotations.detections // Only render detections
              .filter((det) => det && det.visible)
              .map((det: BoundingBox) => (
                <Group key={det.id}>
                  <KonvaRect
                    x={det.x1}
                    y={det.y1}
                    width={det.x2 - det.x1}
                    height={det.y2 - det.y1}
                    stroke={AI_COLORS[det.label] || AI_COLORS.detection_default} // Use updated AI_COLORS
                    strokeWidth={2 * itemScale}
                    listening={false}
                  />
                  {/* Optional: Label for detection box */}
                  {det.label && ( // Check if label exists
                    <Text
                      x={det.x1}
                      y={
                        det.y1 - 14 * itemScale < 0 // Check if label fits above
                          ? det.y1 + 2 * itemScale // Position below if no space above
                          : det.y1 - 14 * itemScale // Position above
                      }
                      text={`${det.label}${det.confidence ? ` (${(det.confidence * 100).toFixed(0)}%)` : ""}`}
                      fontSize={12 * itemScale}
                      fill={AI_COLORS[det.label] || AI_COLORS.detection_default}
                      padding={2 * itemScale}
                      // Simple background for text for better visibility
                      // You might want to use Konva.Label and Konva.Tag for a proper background box
                      // For simplicity, a semi-transparent fill can work if text background is not critical
                      // background="rgba(0,0,0,0.5)" // Or remove if you use Label/Tag
                      // Using Label for better background handling:
                      // This requires importing Label and Tag from 'react-konva'
                      // Example with Label and Tag:
                      // (Remove the Text component above if using Label/Tag below)
                    />
                  )}
                  {/* More robust label with background using Label and Tag: */}
                  {det.label && (
                    <Label
                      x={det.x1}
                      y={
                        det.y1 - 14 * itemScale < 0
                          ? det.y1
                          : det.y1 - 14 * itemScale
                      }
                      opacity={0.85}
                    >
                      <Tag
                        fill={"black"}
                        pointerDirection={"down"}
                        pointerWidth={6 * itemScale}
                        pointerHeight={4 * itemScale}
                        lineJoin={"round"}
                        shadowColor={"black"}
                        shadowBlur={2 * itemScale}
                        shadowOffsetX={1 * itemScale}
                        shadowOffsetY={1 * itemScale}
                        shadowOpacity={0.3}
                        cornerRadius={3 * itemScale}
                      />
                      <Text
                        text={`${det.label}${det.confidence ? ` (${(det.confidence * 100).toFixed(0)}%)` : ""}`}
                        fontSize={10 * itemScale} // Slightly smaller for better fit in tag
                        padding={3 * itemScale}
                        fill={
                          AI_COLORS[det.label] || AI_COLORS.detection_default
                        }
                      />
                    </Label>
                  )}
                </Group>
              ))}
            {/* REMOVE THE ENTIRE BLOCK FOR aiAnnotations.segmentations */}
            {/*
            {aiAnnotations.segmentations
              .filter((seg) => seg && seg.visible)
              .map((seg: SegmentationContour) => (
                // ... segmentation rendering code ...
              ))}
            */}
          </Group>
        </Layer>

        {/* REMOVE THE ENTIRE LAYER FOR CLASSIFICATION OVERLAY */}
        {/*
        <Layer name="classification-overlay-layer" listening={false}>
          {aiAnnotations.classifications
            .filter((cls) => cls && cls.visible)
            .map((cls: ClassificationPrediction) => {
              // ... classification text rendering code ...
              // classificationTextYOffset += 18; // This logic is also removed
            })}
        </Layer>
        */}
      </Stage>
      {/* UI Panels - these will be positioned absolutely over the canvas */}
      {activeAnnotationTool === "freehand" && <FreehandOptionsPanel />}
      {toolUIState.showTextConfigPanel && activeAnnotationTool === "text" && (
        <TextAnnotationOptionsPanel />
      )}
      {toolUIState.showZoomPanel && <ZoomControlPanel />}
      {toolUIState.showBrightnessContrastPanel && <BrightnessContrastPanel />}
      {toolUIState.showCropInterface && <CropControlPanel />}{" "}
      {/* Placeholder if you create a separate component */}
      {(isAiLoading.detection ||
        isAiLoading.segmentation ||
        isAiLoading.classification) && (
        <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center z-30 pointer-events-none">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue mb-4"></div>
            <p className="text-text-primary text-sm">AI Analyzing...</p>
          </div>
        </div>
      )}
    </div>
  );
}
