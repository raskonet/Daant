// src/components/viewer/DicomCanvas.tsx
"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
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
import { useDicomStore } from "../../store/dicomStore";

import {
  useToolStore,
  mapBrightnessToKonva,
  mapContrastToKonva,
  initialImageFilters as defaultImageFilters,
} from "../../store/toolStore";

import { Icons } from "../../components/ui/icons";

import {
  BoundingBox,
  SegmentationContour,
  ClassificationPrediction,
} from "../../types/ai";
// import { BoundingBox, ... } from "@/types/ai"; // If your alias is working

// Define AI annotation colors (can be moved to a theme/config file)
const AI_COLORS: Record<string, string> = {
  detection_default: "rgba(239, 68, 68, 0.9)",
  Caries: "rgba(249, 115, 22, 0.9)",
  Calculus_detection: "rgba(168, 85, 247, 0.9)",
  segmentation_default: "rgba(34, 197, 94, 0.7)",
  "Tooth Segment": "rgba(59, 130, 246, 0.7)",
  classification_default: "rgba(14, 165, 233, 0.9)",
  Calculus: "rgba(139, 92, 246, 0.9)",
};

export function DicomCanvas() {
  const dicomData = useDicomStore((state) => state.dicomData);
  const updateCurrentDicomData = useDicomStore(
    (state) => state.updateCurrentDicomData,
  );

  const {
    imageFilters,
    setImageFilter,
    imageTransformations,
    setImageTransformation,
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
    cropBounds,
    setCropBounds,
    setCanvasExporter,
    aiAnnotations,
    isAiLoading,
    updateAnnotation,
  } = useToolStore();

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const imageNodeRef = useRef<Konva.Image>(null);

  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [fit, setFit] = useState({ scale: 1, offsetX: 0, offsetY: 0 });
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [textConfig, setTextConfig] = useState({
    fontSize: 16,
    color: "#00FF00",
  });

  useEffect(() => {
    resetAllToolRelatedState();
  }, [dicomData, resetAllToolRelatedState]);

  useEffect(() => {
    const exporter = () => {
      if (stageRef.current && image) {
        return stageRef.current.toDataURL({
          mimeType: "image/png",
          quality: 1,
          pixelRatio: 2,
        });
      }
      return undefined;
    };
    setCanvasExporter(exporter);
    return () => setCanvasExporter(null);
  }, [
    setCanvasExporter,
    image,
    dimensions,
    annotations,
    aiAnnotations,
    imageFilters,
    imageTransformations,
    dicomData,
  ]);

  useEffect(() => {
    if (!dicomData?.pngDataUrl) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.src = dicomData.pngDataUrl;
    img.onload = () => setImage(img);
    img.onerror = () => {
      console.error("Failed to load DICOM image from data URL");
      setImage(null);
    };
  }, [dicomData?.pngDataUrl]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateDim = () =>
      setDimensions({ width: el.offsetWidth, height: el.offsetHeight });
    updateDim();
    const obs = new ResizeObserver(updateDim);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!image || !dimensions) {
      setFit({ scale: 1, offsetX: 0, offsetY: 0 });
      return;
    }
    const PADDING = 0.98;
    const scaleX = dimensions.width / image.width;
    const scaleY = dimensions.height / image.height;
    const calculatedFitScale = Math.min(scaleX, scaleY) * PADDING;
    const scaledWidth = image.width * calculatedFitScale;
    const scaledHeight = image.height * calculatedFitScale;
    setFit({
      scale: calculatedFitScale,
      offsetX: (dimensions.width - scaledWidth) / 2,
      offsetY: (dimensions.height - scaledHeight) / 2,
    });
  }, [image, dimensions]);

  useEffect(() => {
    if (toolUIState.showCropInterface && image && !cropBounds) {
      setCropBounds({
        x: image.width * 0.25,
        y: image.height * 0.25,
        width: image.width * 0.5,
        height: image.height * 0.5,
      });
    }
  }, [toolUIState.showCropInterface, image, cropBounds, setCropBounds]);

  const getLocalPointer = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    const imgNode = imageNodeRef.current;
    if (!imgNode) return null;
    const transform = imgNode.getAbsoluteTransform().copy().invert();
    if (!transform) return null;
    return transform.point(pointer);
  }, []);

  const calculateDistance = useCallback(
    (points: number[]) => {
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
        const [spacingY, spacingX] = dicomData.meta.pixel_spacing;
        return Math.sqrt(
          Math.pow(dx * spacingX, 2) + Math.pow(dy * spacingY, 2),
        );
      }
      return Math.sqrt(dx * dx + dy * dy);
    },
    [dicomData],
  );

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return;
    if (toolUIState.showCropInterface && e.target.name()?.startsWith("crop-"))
      return;
    const pos = getLocalPointer();
    if (!pos) return;
    if (
      activeAnnotationTool &&
      ["freehand", "highlight", "measurement"].includes(activeAnnotationTool)
    ) {
      startCurrentDrawing(pos);
    } else if (activeAnnotationTool === "text") {
      const text = window.prompt("Enter text:", "Annotation");
      if (text)
        finishCurrentTextAnnotation(
          text,
          pos,
          textConfig.color,
          textConfig.fontSize,
        );
      e.evt.stopPropagation();
    }
  };

  const handleMouseMove = () => {
    if (!isDrawing || !activeAnnotationTool || isDraggingCrop) return;
    const pos = getLocalPointer();
    if (pos) addPointToCurrentDrawing(pos);
  };

  const handleMouseUp = () => {
    if (!isDrawing || !activeAnnotationTool || isDraggingCrop) return;
    if (activeAnnotationTool === "freehand")
      finishCurrentPathAnnotation("freehand", "#FFFF00", 2);
    else if (activeAnnotationTool === "highlight")
      finishCurrentPathAnnotation("highlight", "rgba(255,255,0,0.3)", 20);
    else if (activeAnnotationTool === "measurement") {
      if (currentDrawingPoints.length >= 4) {
        const [x0, y0] = [currentDrawingPoints[0], currentDrawingPoints[1]];
        const x1 = currentDrawingPoints[currentDrawingPoints.length - 2];
        const y1 = currentDrawingPoints[currentDrawingPoints.length - 1];
        if (x0 !== x1 || y0 !== y1) {
          const distance = calculateDistance(currentDrawingPoints);
          const unit = dicomData?.meta.pixel_spacing ? "mm" : "px";
          finishCurrentPathAnnotation(
            "measurement",
            "#00FF00",
            2,
            dicomData?.meta.pixel_spacing,
            `${distance.toFixed(1)} ${unit}`,
          );
          return;
        }
      }
      useToolStore.setState({ isDrawing: false, currentDrawingPoints: [] });
    }
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage || (fit.scale || 1) === 0) return;
    const oldTotalStageScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const scaleBy = 1.1;
    const newTotalStageScale =
      e.evt.deltaY > 0
        ? oldTotalStageScale / scaleBy
        : oldTotalStageScale * scaleBy;
    const minUserScale = 0.1;
    const maxUserScale = 10;
    const effectiveFitScale = fit.scale || 1;
    const clampedTotalStageScale = Math.max(
      minUserScale * effectiveFitScale,
      Math.min(newTotalStageScale, maxUserScale * effectiveFitScale),
    );
    if (clampedTotalStageScale === oldTotalStageScale) return;
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldTotalStageScale,
      y: (pointer.y - stage.y()) / oldTotalStageScale,
    };
    const newStagePos = {
      x: pointer.x - mousePointTo.x * clampedTotalStageScale,
      y: pointer.y - mousePointTo.y * clampedTotalStageScale,
    };
    setStageZoomAndPosition(clampedTotalStageScale / effectiveFitScale, {
      x: newStagePos.x - fit.offsetX,
      y: newStagePos.y - fit.offsetY,
    });
  };

  const handleApplyInAppCrop = () => {
    if (
      !image ||
      !cropBounds ||
      !imageNodeRef.current ||
      !dicomData ||
      !updateCurrentDicomData
    ) {
      console.error("Cannot apply crop: missing data.");
      return;
    }
    const imageNode = imageNodeRef.current;
    const originalTransform = {
      rotation: imageNode.rotation(),
      scaleX: imageNode.scaleX(),
      scaleY: imageNode.scaleY(),
      offsetX: imageNode.offsetX(),
      offsetY: imageNode.offsetY(),
    };
    imageNode.rotation(0);
    imageNode.scaleX(1);
    imageNode.scaleY(1);
    imageNode.offsetX(0);
    imageNode.offsetY(0);
    imageNode.getLayer()?.batchDraw();
    const croppedDataURL = imageNode.toDataURL({
      x: cropBounds.x,
      y: cropBounds.y,
      width: cropBounds.width,
      height: cropBounds.height,
      pixelRatio: 1,
    });
    imageNode.rotation(originalTransform.rotation);
    imageNode.scaleX(originalTransform.scaleX);
    imageNode.scaleY(originalTransform.scaleY);
    imageNode.offsetX(originalTransform.offsetX);
    imageNode.offsetY(originalTransform.offsetY);
    imageNode.getLayer()?.batchDraw();
    const newMeta = {
      ...dicomData.meta,
      rows: Math.round(cropBounds.height),
      columns: Math.round(cropBounds.width),
    };
    updateCurrentDicomData({
      pngDataUrl: croppedDataURL,
      meta: newMeta as typeof dicomData.meta,
    });
    resetZoom();
    setToolUIVisibility("showCropInterface", false);
    setCropBounds(null);
    useToolStore.getState().clearAllAnnotations();
  };

  const handleCropDragStart = () => setIsDraggingCrop(true);
  const handleCropDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    setIsDraggingCrop(false);
    if (cropBounds && image) {
      const newX = Math.max(0, e.target.x());
      const newY = Math.max(0, e.target.y());
      const clampedX = Math.min(newX, image.width - cropBounds.width);
      const clampedY = Math.min(newY, image.height - cropBounds.height);
      setCropBounds({ ...cropBounds, x: clampedX, y: clampedY });
    }
  };

  useEffect(() => {
    const imageNode = imageNodeRef.current;
    if (imageNode && image) {
      const isBrightnessAltered =
        imageFilters.brightness !== defaultImageFilters.brightness;
      const isContrastAltered =
        imageFilters.contrast !== defaultImageFilters.contrast;
      if (imageFilters.invert || isBrightnessAltered || isContrastAltered)
        imageNode.cache();
      else imageNode.clearCache();
      imageNode.getLayer()?.batchDraw();
    }
  }, [imageFilters, image]);

  const isLoadingDicom = useDicomStore((state) => state.isLoading);

  if (isLoadingDicom || (dicomData && !image)) {
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
  if (!dimensions) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full bg-black flex items-center justify-center"
      >
        <p className="text-text-primary">Initializing canvas...</p>
      </div>
    );
  }
  if (!image) {
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

  const { scale: fitScaleVal, offsetX, offsetY } = fit;
  const {
    scale: userScale,
    position: userPosition,
    rotation,
    flipX,
    flipY,
  } = imageTransformations;
  const totalStageScale = userScale * (fitScaleVal || 1);
  const itemScale = 1 / totalStageScale;

  const getCursor = () => {
    if (isDraggingCrop) return "move";
    const stage = stageRef.current;
    if (stage && toolUIState.showCropInterface) {
      const pointer = stage.getPointerPosition();
      if (pointer) {
        const shape = stage.getIntersection(pointer);
        if (shape && shape.name()?.startsWith("crop-handle-")) {
          return shape.getAttr("cursorStyle") || "crosshair";
        }
      }
    }
    if (toolUIState.showCropInterface) return "crosshair";
    if (activeAnnotationTool) return "crosshair";
    if (isDrawing) return "crosshair";
    return "grab";
  };

  const TextConfigPanel = () => (
    <div className="absolute top-4 right-4 bg-gray-800 p-4 rounded-lg shadow-lg z-20 text-white">
      <h3 className="mb-2 font-semibold">Text Settings</h3>
      <div className="space-y-2">
        <div>
          <label className="text-sm block">
            Font Size: {textConfig.fontSize}px
          </label>
          <input
            type="range"
            min="8"
            max="72"
            value={textConfig.fontSize}
            onChange={(e) =>
              setTextConfig((prev) => ({
                ...prev,
                fontSize: parseInt(e.target.value),
              }))
            }
            className="w-full accent-accent-blue"
          />
        </div>
        <div>
          <label className="text-sm block">Color:</label>
          <input
            type="color"
            value={textConfig.color}
            onChange={(e) =>
              setTextConfig((prev) => ({ ...prev, color: e.target.value }))
            }
            className="w-full h-8 p-0 border-0 rounded cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
  const ZoomPanel = () => (
    <div className="absolute top-4 left-4 bg-gray-800 p-4 rounded-lg shadow-lg z-20 min-w-[200px] text-white">
      <h3 className="mb-3 font-semibold">Zoom Controls</h3>
      <div className="space-y-3">
        <div>
          <label className="text-sm block mb-1">
            Zoom: {Math.round(imageTransformations.scale * 100)}%{" "}
          </label>
          <input
            type="range"
            min="0.1"
            max="10"
            step="0.05"
            value={imageTransformations.scale}
            onChange={(e) =>
              setImageTransformation("scale", parseFloat(e.target.value))
            }
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-accent-blue"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>10%</span>
            <span>1000%</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setImageTransformation("scale", 1)}
            className="flex-1 px-3 py-1.5 bg-accent-blue text-white text-sm rounded hover:bg-blue-700 transition-colors"
          >
            100%
          </button>
          <button
            onClick={() => resetZoom()}
            className="flex-1 px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
          >
            Fit Screen
          </button>
        </div>
      </div>
    </div>
  );
  const BrightnessContrastPanel = () => (
    <div className="absolute top-4 left-4 bg-gray-800 p-4 rounded-lg shadow-lg z-20 min-w-[200px] text-white">
      <h3 className="mb-3 font-semibold">Brightness & Contrast</h3>
      <div className="space-y-4">
        <div>
          <label className="text-sm block mb-1">
            Brightness: {imageFilters.brightness}
          </label>
          <input
            type="range"
            min="-100"
            max="100"
            value={imageFilters.brightness}
            onChange={(e) =>
              setImageFilter("brightness", parseInt(e.target.value))
            }
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-accent-blue"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Dark</span>
            <span>Default</span>
            <span>Bright</span>
          </div>
        </div>
        <div>
          <label className="text-sm block mb-1">
            Contrast: {imageFilters.contrast}
          </label>
          <input
            type="range"
            min="-100"
            max="100"
            value={imageFilters.contrast}
            onChange={(e) =>
              setImageFilter("contrast", parseInt(e.target.value))
            }
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-accent-blue"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Low</span>
            <span>Default</span>
            <span>High</span>
          </div>
        </div>
        <button
          onClick={() => {
            setImageFilter("brightness", 0);
            setImageFilter("contrast", 0);
          }}
          className="w-full px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
        >
          Reset Adjustments
        </button>
      </div>
    </div>
  );
  const CropControlPanel = () => (
    <div className="absolute top-4 right-4 bg-gray-800 p-4 rounded-lg shadow-lg z-20 text-white min-w-[220px]">
      <h3 className="mb-3 font-semibold">Crop Controls</h3>
      <div className="space-y-3">
        {cropBounds && (
          <div className="text-xs text-gray-300 grid grid-cols-2 gap-x-2">
            <span>X: {Math.round(cropBounds.x)}</span>{" "}
            <span>Y: {Math.round(cropBounds.y)}</span>
            <span>W: {Math.round(cropBounds.width)}</span>{" "}
            <span>H: {Math.round(cropBounds.height)}</span>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleApplyInAppCrop}
            disabled={
              !cropBounds || cropBounds.width <= 0 || cropBounds.height <= 0
            }
            className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            Apply Crop to Image
          </button>
          <button
            onClick={() => {
              if (image) {
                setCropBounds({
                  x: image.width * 0.25,
                  y: image.height * 0.25,
                  width: image.width * 0.5,
                  height: image.height * 0.5,
                });
              }
            }}
            className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
          >
            Reset Area
          </button>
          <button
            onClick={() => {
              setCropBounds(null);
              setToolUIVisibility("showCropInterface", false);
            }}
            className="px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
          >
            Cancel Crop
          </button>
        </div>
      </div>
    </div>
  );

  let classificationTextYOffset = 10;

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
        x={userPosition.x + offsetX}
        y={userPosition.y + offsetY}
        scaleX={totalStageScale}
        scaleY={totalStageScale}
        draggable={
          !activeAnnotationTool &&
          !isDrawing &&
          !toolUIState.showCropInterface &&
          !isDraggingCrop
        }
        onDragEnd={(e) =>
          setStageZoomAndPosition(e.target.scaleX() / (fitScaleVal || 1), {
            x: e.target.x() - offsetX,
            y: e.target.y() - offsetY,
          })
        }
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (isDrawing)
            useToolStore.setState({
              isDrawing: false,
              currentDrawingPoints: [],
            });
        }}
      >
        <Layer>
          <KonvaImage
            ref={imageNodeRef}
            image={image}
            x={image.width / 2}
            y={image.height / 2}
            width={image.width}
            height={image.height}
            rotation={rotation}
            scaleX={flipX ? -1 : 1}
            scaleY={flipY ? -1 : 1}
            offsetX={image.width / 2}
            offsetY={image.height / 2}
            filters={imageFilters.invert ? [Konva.Filters.Invert] : []}
            brightness={mapBrightnessToKonva(imageFilters.brightness)}
            contrast={mapContrastToKonva(imageFilters.contrast)}
            listening={false}
          />
        </Layer>

        <Layer name="ai-annotations-layer">
          {aiAnnotations.detections
            .filter((det: BoundingBox) => det.visible) // MODIFIED
            .map((det: BoundingBox) => {
              // MODIFIED
              const boxColor =
                AI_COLORS[det.label] || AI_COLORS.detection_default;
              return (
                <Group key={det.id} listening={false}>
                  <KonvaRect
                    x={det.x1}
                    y={det.y1}
                    width={det.x2 - det.x1}
                    height={det.y2 - det.y1}
                    stroke={boxColor}
                    strokeWidth={2 * itemScale}
                  />
                  <Label x={det.x1} y={det.y1 - 14 * itemScale} opacity={0.9}>
                    <Tag
                      fill={boxColor}
                      pointerDirection="down"
                      pointerWidth={6 * itemScale}
                      pointerHeight={4 * itemScale}
                      lineJoin="round"
                      cornerRadius={3 * itemScale}
                    />
                    <Text
                      text={`${det.label} ${det.confidence ? det.confidence.toFixed(2) : ""}`}
                      fontSize={10 * itemScale}
                      padding={3 * itemScale}
                      fill="white"
                    />
                  </Label>
                </Group>
              );
            })}
          {aiAnnotations.segmentations
            .filter((seg: SegmentationContour) => seg.visible) // MODIFIED
            .map((seg: SegmentationContour) => {
              // MODIFIED
              const segColor =
                AI_COLORS[seg.label || "segmentation_default"] ||
                AI_COLORS.segmentation_default;
              return (
                <Line
                  key={seg.id}
                  points={seg.points.flat()}
                  stroke={segColor}
                  strokeWidth={2 * itemScale}
                  closed={true}
                  tension={0}
                  listening={false}
                />
              );
            })}
        </Layer>

        {showAnnotations && (
          <Layer name="user-annotations-layer">
            {annotations.map((ann) => {
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
                    {ann.type === "measurement" && ann.points.length >= 4 && (
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
                        {ann.text && (
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
                            align="center"
                            listening={false}
                          />
                        )}
                      </>
                    )}
                  </Group>
                );
              } else if (ann.type === "text" && ann.text && ann.position) {
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
                      if (updateAnnotation) {
                        updateAnnotation(ann.id, {
                          position: { x: e.target.x(), y: e.target.y() },
                        });
                      }
                    }}
                  />
                );
              }
              return null;
            })}
            {isDrawing &&
              currentDrawingPoints.length >= 2 &&
              activeAnnotationTool &&
              ["freehand", "highlight", "measurement"].includes(
                activeAnnotationTool,
              ) && (
                <Group>
                  <Line
                    points={currentDrawingPoints}
                    stroke={
                      activeAnnotationTool === "freehand"
                        ? "#FF00FF"
                        : activeAnnotationTool === "highlight"
                          ? "rgba(255,165,0,0.5)"
                          : "#00FFFF"
                    }
                    strokeWidth={
                      (activeAnnotationTool === "highlight" ? 20 : 2) *
                      itemScale
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
                  {activeAnnotationTool === "measurement" &&
                    currentDrawingPoints.length >= 4 && (
                      <>
                        <Circle
                          x={currentDrawingPoints[0]}
                          y={currentDrawingPoints[1]}
                          radius={3 * itemScale}
                          fill="#00FFFF"
                        />
                        <Circle
                          x={
                            currentDrawingPoints[
                              currentDrawingPoints.length - 2
                            ]
                          }
                          y={
                            currentDrawingPoints[
                              currentDrawingPoints.length - 1
                            ]
                          }
                          radius={3 * itemScale}
                          fill="#00FFFF"
                        />
                      </>
                    )}
                </Group>
              )}
          </Layer>
        )}

        {toolUIState.showCropInterface && image && cropBounds && (
          <Layer name="crop-interface-layer">
            <KonvaRect
              x={cropBounds.x}
              y={cropBounds.y}
              width={cropBounds.width}
              height={cropBounds.height}
              stroke="red"
              strokeWidth={2 * itemScale}
              dash={[4 * itemScale, 2 * itemScale]}
              draggable
              dragBoundFunc={(pos) => ({
                x: Math.max(0, Math.min(pos.x, image.width - cropBounds.width)),
                y: Math.max(
                  0,
                  Math.min(pos.y, image.height - cropBounds.height),
                ),
              })}
              onDragStart={handleCropDragStart}
              onDragEnd={handleCropDragEnd}
              name="crop-rect"
            />
            {[
              {
                x: cropBounds.x,
                y: cropBounds.y,
                cursor: "nwse-resize",
                corner: "topLeft",
              },
              {
                x: cropBounds.x + cropBounds.width,
                y: cropBounds.y,
                cursor: "nesw-resize",
                corner: "topRight",
              },
              {
                x: cropBounds.x,
                y: cropBounds.y + cropBounds.height,
                cursor: "nesw-resize",
                corner: "bottomLeft",
              },
              {
                x: cropBounds.x + cropBounds.width,
                y: cropBounds.y + cropBounds.height,
                cursor: "nwse-resize",
                corner: "bottomRight",
              },
            ].map((handle) => (
              <Circle
                key={`handle-${handle.corner}`}
                name={`crop-handle-${handle.corner}`}
                x={handle.x}
                y={handle.y}
                radius={8 * itemScale}
                fill="red"
                stroke="white"
                strokeWidth={1.5 * itemScale}
                draggable
                dragBoundFunc={(pos) => {
                  let newX = pos.x;
                  let newY = pos.y;
                  newX = Math.max(0, Math.min(newX, image.width));
                  newY = Math.max(0, Math.min(newY, image.height));
                  return { x: newX, y: newY };
                }}
                onDragStart={handleCropDragStart}
                onDragMove={(e) => {
                  const newPointerX = e.target.x();
                  const newPointerY = e.target.y();
                  if (!cropBounds || !image) return;
                  const newBounds = { ...cropBounds };
                  const MIN_SIZE = Math.max(
                    10,
                    image.width / 50,
                    image.height / 50,
                  );
                  switch (handle.corner) {
                    case "topLeft":
                      newBounds.width = Math.max(
                        MIN_SIZE,
                        cropBounds.x + cropBounds.width - newPointerX,
                      );
                      newBounds.height = Math.max(
                        MIN_SIZE,
                        cropBounds.y + cropBounds.height - newPointerY,
                      );
                      newBounds.x =
                        cropBounds.x + cropBounds.width - newBounds.width;
                      newBounds.y =
                        cropBounds.y + cropBounds.height - newBounds.height;
                      break;
                    case "topRight":
                      newBounds.width = Math.max(
                        MIN_SIZE,
                        newPointerX - cropBounds.x,
                      );
                      newBounds.height = Math.max(
                        MIN_SIZE,
                        cropBounds.y + cropBounds.height - newPointerY,
                      );
                      newBounds.y =
                        cropBounds.y + cropBounds.height - newBounds.height;
                      break;
                    case "bottomLeft":
                      newBounds.width = Math.max(
                        MIN_SIZE,
                        cropBounds.x + cropBounds.width - newPointerX,
                      );
                      newBounds.height = Math.max(
                        MIN_SIZE,
                        newPointerY - cropBounds.y,
                      );
                      newBounds.x =
                        cropBounds.x + cropBounds.width - newBounds.width;
                      break;
                    case "bottomRight":
                      newBounds.width = Math.max(
                        MIN_SIZE,
                        newPointerX - cropBounds.x,
                      );
                      newBounds.height = Math.max(
                        MIN_SIZE,
                        newPointerY - cropBounds.y,
                      );
                      break;
                  }
                  newBounds.x = Math.max(
                    0,
                    Math.min(newBounds.x, image.width - MIN_SIZE),
                  );
                  newBounds.y = Math.max(
                    0,
                    Math.min(newBounds.y, image.height - MIN_SIZE),
                  );
                  newBounds.width = Math.min(
                    newBounds.width,
                    image.width - newBounds.x,
                  );
                  newBounds.height = Math.min(
                    newBounds.height,
                    image.height - newBounds.y,
                  );
                  if (newBounds.width < MIN_SIZE) newBounds.width = MIN_SIZE;
                  if (newBounds.height < MIN_SIZE) newBounds.height = MIN_SIZE;
                  setCropBounds(newBounds);
                }}
                onDragEnd={() => setIsDraggingCrop(false)}
                onMouseEnter={(e) => {
                  if (stageRef.current)
                    stageRef.current.container().style.cursor = handle.cursor;
                  e.target.setAttr("cursorStyle", handle.cursor);
                }}
                onMouseLeave={(e) => {
                  if (stageRef.current)
                    stageRef.current.container().style.cursor = getCursor();
                  e.target.setAttr("cursorStyle", null);
                }}
              />
            ))}
            <Text
              text="Adjust crop area. Coordinates are relative to original image."
              x={cropBounds.x}
              y={cropBounds.y - 20 * itemScale}
              fontSize={12 * itemScale}
              fill="rgba(255,0,0,0.8)"
              listening={false}
            />
          </Layer>
        )}

        <Layer name="classification-overlay-layer">
          {aiAnnotations.classifications
            .filter((cls: ClassificationPrediction) => cls.visible) // MODIFIED
            .map((cls: ClassificationPrediction) => {
              // MODIFIED
              const clsColor =
                AI_COLORS[cls.label] || AI_COLORS.classification_default;
              const textNode = (
                <Text
                  key={cls.id}
                  x={10 * itemScale}
                  y={classificationTextYOffset * itemScale}
                  text={`${cls.label}${cls.confidence ? ": " + cls.confidence.toFixed(2) : ""}`}
                  fontSize={12 * itemScale}
                  fill={clsColor}
                  padding={5 * itemScale}
                  background="rgba(0,0,0,0.6)"
                  listening={false}
                />
              );
              classificationTextYOffset += 18;
              return textNode;
            })}
        </Layer>
      </Stage>

      {activeAnnotationTool === "text" && <TextConfigPanel />}
      {toolUIState.showZoomPanel && <ZoomPanel />}
      {toolUIState.showBrightnessContrastPanel &&
        !toolUIState.showZoomPanel && <BrightnessContrastPanel />}
      {toolUIState.showCropInterface && <CropControlPanel />}

      {(isAiLoading.detection ||
        isAiLoading.segmentation ||
        isAiLoading.classification) && (
        <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center z-30 pointer-events-none">
          <div className="flex flex-col items-center p-4 bg-primary-dark rounded-lg shadow-xl">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-accent-blue mb-3"></div>
            <p className="text-text-primary text-sm">AI Analyzing Image...</p>
          </div>
        </div>
      )}
    </div>
  );
}
