// frontend/src/components/viewer/ImageToolsBar.tsx
"use client";
import React from "react";
import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToolStore, ActiveAnnotationTool } from "@/store/toolStore";

interface ToolConfig {
  id: string;
  icon: React.ElementType;
  label: string;
  action?: (store: ReturnType<typeof useToolStore>) => void;
  isActiveCheck?: (store: ReturnType<typeof useToolStore>) => boolean;
  opensPanel?: keyof ReturnType<typeof useToolStore>["toolUIState"];
  isAnnotationTool?: ActiveAnnotationTool;
  isDisabled?: (store: ReturnType<typeof useToolStore>) => boolean; // ADDED for Undo
}

const toolButtonsConfig: ToolConfig[] = [
  // ... (other tools remain the same)
  {
    id: "brightness-contrast",
    icon: Icons.Sun,
    label: "Brightness/Contrast",
    opensPanel: "showBrightnessContrastPanel",
    isActiveCheck: (store) => store.toolUIState.showBrightnessContrastPanel,
  },
  {
    id: "invert",
    icon: Icons.Palette, // Consider changing if Palette is used for FMX or other color ops
    label: "Invert Colors",
    action: (store) => store.toggleInvertFilter(),
    isActiveCheck: (store) => store.imageFilters.invert,
  },
  {
    id: "rotate",
    icon: Icons.RotateCw,
    label: "Rotate 90°",
    action: (store) => store.rotateImage90(),
  },
  {
    id: "flip-h",
    icon: Icons.FlipHorizontal,
    label: "Flip Horizontal",
    action: (store) =>
      store.setImageTransformation("flipX", !store.imageTransformations.flipX),
    isActiveCheck: (store) => store.imageTransformations.flipX,
  },
  {
    id: "flip-v",
    icon: Icons.FlipVertical,
    label: "Flip Vertical",
    action: (store) =>
      store.setImageTransformation("flipY", !store.imageTransformations.flipY),
    isActiveCheck: (store) => store.imageTransformations.flipY,
  },
  {
    id: "zoom-panel",
    icon: Icons.ZoomIn,
    label: "Zoom Controls",
    opensPanel: "showZoomPanel",
    isActiveCheck: (store) => store.toolUIState.showZoomPanel,
  },
  {
    id: "fit-to-screen",
    icon: Icons.Maximize2,
    label: "Fit to Screen (Reset Zoom/Pan)",
    action: (store) => store.resetZoom(), // Resets only user scale and pan
  },
  {
    id: "crop",
    icon: Icons.Crop,
    label: "Crop Image Selection", // Clarify this selects area, DicomCanvas applies
    opensPanel: "showCropInterface",
    isActiveCheck: (store) => store.toolUIState.showCropInterface,
  },
  {
    id: "annotate-freehand",
    icon: Icons.Edit3,
    label: "Draw Freehand",
    isAnnotationTool: "freehand",
    isActiveCheck: (store) => store.activeAnnotationTool === "freehand",
  },
  {
    id: "annotate-text",
    icon: Icons.Type,
    label: "Add Text",
    isAnnotationTool: "text",
    isActiveCheck: (store) => store.activeAnnotationTool === "text",
  },
  {
    id: "annotate-highlight",
    icon: Icons.Highlighter,
    label: "Highlight Area",
    isAnnotationTool: "highlight",
    isActiveCheck: (store) => store.activeAnnotationTool === "highlight",
  },
  {
    id: "annotate-measure",
    icon: Icons.Ruler,
    label: "Measure Distance",
    isAnnotationTool: "measurement",
    isActiveCheck: (store) => store.activeAnnotationTool === "measurement",
  },
  {
    id: "toggle-annotations",
    icon: Icons.Eye,
    label: "Toggle Annotations Visibility",
    action: (store) => store.setShowAnnotations(!store.showAnnotations),
    isActiveCheck: (store) => store.showAnnotations,
  },
  {
    id: "clear-annotations",
    icon: Icons.Trash2,
    label: "Clear All Annotations",
    action: (store) => store.clearAllAnnotations(), // This is undoable
  },
  {
    // MODIFIED: This is now "Undo"
    id: "undo",
    icon: Icons.RotateCcw, // Keep icon, or use an "UndoArrow" icon if available
    label: "Undo Last Change",
    action: (store) => store.undoLastAction(),
    isDisabled: (store) => !store.canUndo(), // Disable if nothing to undo
  },
  {
    // ADDED: "Reset View" button (resets filters & transforms)
    id: "reset-view",
    icon: Icons.RefreshCw, // A different reset icon
    label: "Reset View (Filters & Transforms)",
    action: (store) => store.resetAllFiltersAndTransforms(),
  },
];

export function ImageToolsBar() {
  const store = useToolStore();

  const handleToolClick = (toolConfig: ToolConfig) => {
    console.log("[ImageToolsBar] Clicked:", toolConfig.label);

    if (toolConfig.action) {
      toolConfig.action(store);
    }

    if (toolConfig.opensPanel) {
      const panelAlreadyOpen = store.toolUIState[toolConfig.opensPanel];
      // Close all other panels first
      Object.keys(store.toolUIState).forEach((key) => {
        store.setToolUIVisibility(key as keyof typeof store.toolUIState, false);
      });
      // If panel was not already open, open it. Otherwise, it's now closed.
      if (!panelAlreadyOpen) {
        store.setToolUIVisibility(toolConfig.opensPanel, true);
      }
      // If opening a panel, deactivate any active annotation tool
      if (
        store.toolUIState[toolConfig.opensPanel] &&
        store.activeAnnotationTool
      ) {
        store.setActiveAnnotationTool(null);
      }
    }

    if (toolConfig.isAnnotationTool) {
      if (store.activeAnnotationTool === toolConfig.isAnnotationTool) {
        store.setActiveAnnotationTool(null);
      } else {
        store.setActiveAnnotationTool(toolConfig.isAnnotationTool);
        // Close UI panels when an annotation tool is activated
        Object.keys(store.toolUIState).forEach((key) => {
          store.setToolUIVisibility(
            key as keyof typeof store.toolUIState,
            false,
          );
        });
      }
    }
  };

  return (
    <div className="w-14 bg-primary-dark flex flex-col items-center py-3 space-y-1 border-r border-border-dark shrink-0">
      {toolButtonsConfig.map((toolConfig) => {
        const isCurrentlyActive = toolConfig.isActiveCheck
          ? toolConfig.isActiveCheck(store)
          : false;
        const IconComponent = toolConfig.icon;
        const isDisabled = toolConfig.isDisabled
          ? toolConfig.isDisabled(store)
          : false;

        return (
          <Tooltip key={toolConfig.id} delayDuration={100}>
            <TooltipTrigger asChild>
              <Button
                variant="icon"
                size="icon"
                className={`w-10 h-10 transition-colors ${
                  isCurrentlyActive
                    ? "bg-accent-blue text-white"
                    : "text-text-secondary hover:bg-secondary-dark hover:text-text-primary"
                } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={() => handleToolClick(toolConfig)}
                aria-label={toolConfig.label}
                aria-pressed={isCurrentlyActive}
                disabled={isDisabled} // ADDED
              >
                {IconComponent ? <IconComponent size={20} /> : null}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{toolConfig.label}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
