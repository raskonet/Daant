// src/components/viewer/FreehandOptionsPanel.tsx
"use client";
import React, { useState, useRef, useEffect, useCallback } from "react"; // Added useState, useRef, useEffect, useCallback
import { useToolStore } from "../../store/toolStore";
import { useShallow } from "zustand/react/shallow";

export function FreehandOptionsPanel() {
  const {
    freehandColor,
    setFreehandColor,
    freehandStrokeWidth,
    setFreehandStrokeWidth,
  } = useToolStore(
    useShallow((state) => ({
      freehandColor: state.freehandColor,
      setFreehandColor: state.setFreehandColor,
      freehandStrokeWidth: state.freehandStrokeWidth,
      setFreehandStrokeWidth: state.setFreehandStrokeWidth,
    })),
  );

  // State for panel position
  const [position, setPosition] = useState({ x: 20, y: 80 }); // Initial position (left, top) in pixels
  const [isDragging, setIsDragging] = useState(false);
  const dragStartOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null); // Ref for the panel itself

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (panelRef.current) {
      // Check if the mousedown is on the header/drag handle part
      // For simplicity, we'll make the whole header draggable
      const target = e.target as HTMLElement;
      if (target.closest(".drag-handle-freehand")) {
        setIsDragging(true);
        const panelRect = panelRef.current.getBoundingClientRect();
        dragStartOffset.current = {
          x: e.clientX - panelRect.left,
          y: e.clientY - panelRect.top,
        };
        // Prevent text selection during drag
        e.preventDefault();
      }
    }
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        // Calculate new position based on mouse movement and initial offset
        // Ensure panel stays within reasonable bounds of the viewport or its container
        const newX = e.clientX - dragStartOffset.current.x;
        const newY = e.clientY - dragStartOffset.current.y;

        // Basic bounds checking (relative to viewport for simplicity)
        // You might want to make this relative to the DicomCanvas container
        const boundedX = Math.max(
          0,
          Math.min(
            newX,
            window.innerWidth - (panelRef.current?.offsetWidth || 220),
          ),
        );
        const boundedY = Math.max(
          0,
          Math.min(
            newY,
            window.innerHeight - (panelRef.current?.offsetHeight || 150),
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

  return (
    <div
      ref={panelRef}
      className="absolute bg-gray-800 p-3 rounded-lg shadow-xl z-20 text-white min-w-[220px] select-none" // Added select-none
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? "grabbing" : "default", // Change cursor while dragging
      }}
      // onMouseDown is now on the drag handle below
    >
      {/* Drag Handle */}
      <div
        className="drag-handle-freehand bg-gray-700 p-2 mb-3 rounded-t-md cursor-grab text-center"
        onMouseDown={handleMouseDown} // Attach mousedown here
      >
        <h3 className="text-sm font-semibold">Freehand Options</h3>
      </div>
      <div className="space-y-3 px-1 pb-1">
        {" "}
        {/* Added some padding for content */}
        <div>
          <label htmlFor="freehandColor" className="text-xs block mb-1">
            Color:
          </label>
          <input
            type="color"
            id="freehandColor"
            value={freehandColor}
            onChange={(e) => setFreehandColor(e.target.value)}
            className="w-full h-8 p-0 border-0 rounded cursor-pointer"
          />
        </div>
        <div>
          <label htmlFor="freehandStrokeWidth" className="text-xs block mb-1">
            Thickness: {freehandStrokeWidth}px
          </label>
          <input
            type="range"
            id="freehandStrokeWidth"
            min="1"
            max="20"
            step="1"
            value={freehandStrokeWidth}
            onChange={(e) =>
              setFreehandStrokeWidth(parseInt(e.target.value, 10))
            }
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-accent-blue"
          />
        </div>
      </div>
    </div>
  );
}
