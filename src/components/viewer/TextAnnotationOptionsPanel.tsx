// src/components/viewer/TextAnnotationOptionsPanel.tsx
"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useToolStore } from "../../store/toolStore";
import { useShallow } from "zustand/react/shallow";

export function TextAnnotationOptionsPanel() {
  const {
    textAnnotationColor,
    setTextAnnotationColor,
    textAnnotationFontSize,
    setTextAnnotationFontSize,
  } = useToolStore(
    useShallow((state) => ({
      textAnnotationColor: state.textAnnotationColor,
      setTextAnnotationColor: state.setTextAnnotationColor,
      textAnnotationFontSize: state.textAnnotationFontSize,
      setTextAnnotationFontSize: state.setTextAnnotationFontSize,
    })),
  );

  // Draggable panel logic (similar to FreehandOptionsPanel)
  const [position, setPosition] = useState({ x: 20, y: 180 }); // Adjust initial position
  const [isDragging, setIsDragging] = useState(false);
  const dragStartOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (panelRef.current) {
      const target = e.target as HTMLElement;
      if (target.closest(".drag-handle-text")) {
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
            window.innerWidth - (panelRef.current.offsetWidth || 220),
          ),
        );
        const boundedY = Math.max(
          0,
          Math.min(
            newY,
            window.innerHeight - (panelRef.current.offsetHeight || 150),
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
      className="absolute bg-gray-800 p-3 rounded-lg shadow-xl z-20 text-white min-w-[220px] select-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? "grabbing" : "default",
      }}
    >
      <div
        className="drag-handle-text bg-gray-700 p-2 mb-3 rounded-t-md cursor-grab text-center"
        onMouseDown={handleMouseDown}
      >
        <h3 className="text-sm font-semibold">Text Options</h3>
      </div>
      <div className="space-y-3 px-1 pb-1">
        <div>
          <label htmlFor="textAnnotationColor" className="text-xs block mb-1">
            Color:
          </label>
          <input
            type="color"
            id="textAnnotationColor"
            value={textAnnotationColor}
            onChange={(e) => setTextAnnotationColor(e.target.value)}
            className="w-full h-8 p-0 border-0 rounded cursor-pointer"
          />
        </div>
        <div>
          <label
            htmlFor="textAnnotationFontSize"
            className="text-xs block mb-1"
          >
            Font Size: {textAnnotationFontSize}px
          </label>
          <input
            type="range"
            id="textAnnotationFontSize"
            min="8"
            max="72"
            step="1"
            value={textAnnotationFontSize}
            onChange={(e) =>
              setTextAnnotationFontSize(parseInt(e.target.value, 10))
            }
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-accent-blue"
          />
        </div>
      </div>
    </div>
  );
}
