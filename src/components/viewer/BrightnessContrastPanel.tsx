// src/components/viewer/BrightnessContrastPanel.tsx
"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useToolStore, initialImageFilters } from "../../store/toolStore";
import { useShallow } from "zustand/react/shallow";
import { Icons } from "../ui/icons"; // Assuming Icons.Close or similar exists

export function BrightnessContrastPanel() {
  const { imageFilters, setImageFilter, setToolUIVisibility } = useToolStore(
    useShallow((state) => ({
      imageFilters: state.imageFilters,
      setImageFilter: state.setImageFilter,
      setToolUIVisibility: state.setToolUIVisibility,
    })),
  );

  // Draggable panel logic
  const [position, setPosition] = useState({ x: 20, y: 180 }); // Adjusted Y to avoid overlap with zoom
  const [isDragging, setIsDragging] = useState(false);
  const dragStartOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (panelRef.current) {
      const target = e.target as HTMLElement;
      if (target.closest(".drag-handle-bc")) {
        setIsDragging(true);
        const panelRect = panelRef.current.getBoundingClientRect();
        dragStartOffset.current = {
          x: e.clientX - panelRect.left,
          y: e.clientY - panelRect.top,
        };
        e.preventDefault();
      }
    }
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging && panelRef.current) {
        const newX = e.clientX - dragStartOffset.current.x;
        const newY = e.clientY - dragStartOffset.current.y;
        const boundedX = Math.max(
          0,
          Math.min(
            newX,
            window.innerWidth - (panelRef.current.offsetWidth || 240),
          ),
        );
        const boundedY = Math.max(
          0,
          Math.min(
            newY,
            window.innerHeight - (panelRef.current.offsetHeight || 200),
          ),
        );
        setPosition({ x: boundedX, y: boundedY });
      }
    },
    [isDragging],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleClose = () => {
    setToolUIVisibility("showBrightnessContrastPanel", false);
  };

  return (
    <div
      ref={panelRef}
      className="absolute bg-gray-800 p-3 rounded-lg shadow-xl z-20 text-white min-w-[240px] select-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? "grabbing" : "default",
      }}
    >
      <div
        className="drag-handle-bc bg-gray-700 p-2 mb-3 -mx-3 -mt-3 rounded-t-md cursor-grab text-center flex justify-between items-center px-3"
        onMouseDown={handleMouseDown}
      >
        <h3 className="text-sm font-semibold">Brightness & Contrast</h3>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-white"
          aria-label="Close brightness/contrast panel"
        >
          <Icons.Minus size={16} />{" "}
          {/* Using Minus as a stand-in for Close X */}
        </button>
      </div>
      <div className="space-y-3 px-1 pb-1">
        <div>
          <label htmlFor="brightnessSlider" className="text-xs block mb-1">
            Brightness: {imageFilters.brightness}
          </label>
          <input
            type="range"
            id="brightnessSlider"
            min="-100"
            max="100"
            value={imageFilters.brightness}
            onChange={(e) =>
              setImageFilter("brightness", parseInt(e.target.value, 10))
            }
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-accent-blue"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>Dark</span>
            <span>Default</span>
            <span>Bright</span>
          </div>
        </div>
        <div>
          <label htmlFor="contrastSlider" className="text-xs block mb-1">
            Contrast: {imageFilters.contrast}
          </label>
          <input
            type="range"
            id="contrastSlider"
            min="-100"
            max="100"
            value={imageFilters.contrast}
            onChange={(e) =>
              setImageFilter("contrast", parseInt(e.target.value, 10))
            }
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-accent-blue"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>Low</span>
            <span>Default</span>
            <span>High</span>
          </div>
        </div>
        <button
          onClick={() => {
            setImageFilter("brightness", initialImageFilters.brightness);
            setImageFilter("contrast", initialImageFilters.contrast);
          }}
          className="w-full mt-2 px-2 py-1.5 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
        >
          Reset Adjustments
        </button>
      </div>
    </div>
  );
}
