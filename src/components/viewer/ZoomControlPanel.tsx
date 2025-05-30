"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useToolStore } from "../../store/toolStore";
import { useShallow } from "zustand/react/shallow";
import { Icons } from "../ui/icons"; // Assuming Icons.Close or similar exists

export function ZoomControlPanel() {
  const {
    imageTransformations,
    setImageTransformation,
    resetZoom,
    setToolUIVisibility,
  } = useToolStore(
    useShallow((state) => ({
      imageTransformations: state.imageTransformations,
      setImageTransformation: state.setImageTransformation,
      resetZoom: state.resetZoom,
      setToolUIVisibility: state.setToolUIVisibility,
    })),
  );

  // Draggable panel logic
  const [position, setPosition] = useState({ x: 20, y: 280 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (panelRef.current) {
      const target = e.target as HTMLElement;
      if (target.closest(".drag-handle-zoom")) {
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
            window.innerHeight - (panelRef.current.offsetHeight || 130),
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
    setToolUIVisibility("showZoomPanel", false);
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
        className="drag-handle-zoom bg-gray-700 p-2 mb-3 -mx-3 -mt-3 rounded-t-md cursor-grab text-center flex justify-between items-center px-3"
        onMouseDown={handleMouseDown}
      >
        <h3 className="text-sm font-semibold">Zoom Controls</h3>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-white"
          aria-label="Close zoom panel"
        >
          <Icons.Minus size={16} />{" "}
          {/* Using Minus as a stand-in for Close X */}
        </button>
      </div>
      <div className="space-y-3 px-1 pb-1">
        <div>
          <label htmlFor="zoomScale" className="text-xs block mb-1">
            Zoom: {Math.round(imageTransformations.scale * 100)}%
          </label>
          <input
            type="range"
            id="zoomScale"
            min="0.1"
            max="10"
            step="0.05"
            value={imageTransformations.scale}
            onChange={(e) =>
              setImageTransformation("scale", parseFloat(e.target.value))
            }
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-accent-blue"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>10%</span>
            <span>1000%</span>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setImageTransformation("scale", 1)}
            className="flex-1 px-2 py-1.5 bg-accent-blue text-white text-xs rounded hover:bg-blue-600 transition-colors"
          >
            100%
          </button>
          <button
            onClick={() => resetZoom()}
            className="flex-1 px-2 py-1.5 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
          >
            Fit Screen
          </button>
        </div>
      </div>
    </div>
  );
}
