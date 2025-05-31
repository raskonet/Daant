// src/components/viewer/ImageToolsBar.tsx
"use client";
import React from "react";
import { Icons } from "../../components/ui/icons";
import { Button } from "../../components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../components/ui/tooltip";
import {
  useToolStore,
  ActiveAnnotationTool,
  ToolState,
  ToolUIState, // Make sure this is exported from toolStore if not already
} from "../../store/toolStore";

interface ToolConfig {
  id: string;
  icon: React.ElementType;
  label: string;
  action: (store: ToolState) => void; // All tools will now have a primary action
  isActiveCheck?: (store: ToolState) => boolean;
  isDisabled?: (store: ToolState) => boolean;
}

// Helper function to close all panels except specified ones
const closeOtherPanels = (
  store: ToolState,
  ...keepOpen: Array<keyof ToolUIState>
) => {
  (Object.keys(store.toolUIState) as Array<keyof ToolUIState>).forEach(
    (key) => {
      if (!keepOpen.includes(key)) {
        store.setToolUIVisibility(key, false);
      }
    },
  );
};

const toolButtonsConfig: ToolConfig[] = [
  {
    id: "brightness-contrast",
    icon: Icons.Sun,
    label: "Brightness/Contrast",
    action: (store) => {
      const currentlyShowing = store.toolUIState.showBrightnessContrastPanel;
      closeOtherPanels(store, "showBrightnessContrastPanel");
      store.setToolUIVisibility(
        "showBrightnessContrastPanel",
        !currentlyShowing,
      );
      if (!currentlyShowing) store.setActiveAnnotationTool(null); // Deactivate annotation if opening panel
    },
    isActiveCheck: (store) => store.toolUIState.showBrightnessContrastPanel,
  },
  {
    id: "invert",
    icon: Icons.Palette,
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
    action: (store) => {
      const currentlyShowing = store.toolUIState.showZoomPanel;
      closeOtherPanels(store, "showZoomPanel");
      store.setToolUIVisibility("showZoomPanel", !currentlyShowing);
      if (!currentlyShowing) store.setActiveAnnotationTool(null);
    },
    isActiveCheck: (store) => store.toolUIState.showZoomPanel,
  },
  {
    id: "fit-to-screen",
    icon: Icons.Maximize2,
    label: "Fit to Screen (Reset Zoom/Pan)",
    action: (store) => store.resetZoom(),
  },
  {
    id: "crop",
    icon: Icons.Crop,
    label: "Crop Image", // Updated label
    action: (store) => {
      const currentlyShowing = store.toolUIState.showCropInterface;
      closeOtherPanels(store, "showCropInterface"); // Close other panels when toggling crop
      store.setToolUIVisibility("showCropInterface", !currentlyShowing);
      // if (currentlyShowing) { // If turning OFF crop UI
      // store.resetCrop(); // Decide: should exiting crop UI always reset the sourceCrop?
      // Or just hide the UI, keeping the visual crop?
      // For now, let's assume resetCrop/Done Cropping button in panel handles this.
      // }
      if (!currentlyShowing) store.setActiveAnnotationTool(null); // Deactivate annotation if opening crop
    },
    isActiveCheck: (store) => store.toolUIState.showCropInterface,
  },
  {
    id: "metadata-editor",
    icon: Icons.Settings2,
    label: "Edit Metadata",
    action: (store) => store.toggleMetadataEditor(),
    isActiveCheck: (store) => store.toolUIState.showMetadataEditor,
  },
  {
    id: "annotate-freehand",
    icon: Icons.Edit3,
    label: "Draw Freehand",
    action: (store) => {
      closeOtherPanels(store);
      store.setActiveAnnotationTool(
        store.activeAnnotationTool === "freehand" ? null : "freehand",
      );
    },
    isActiveCheck: (store) => store.activeAnnotationTool === "freehand",
  },
  {
    id: "annotate-text",
    icon: Icons.Type,
    label: "Add Text",
    action: (store) => {
      closeOtherPanels(store);
      store.setActiveAnnotationTool(
        store.activeAnnotationTool === "text" ? null : "text",
      );
    },
    isActiveCheck: (store) => store.activeAnnotationTool === "text",
  },
  {
    id: "annotate-highlight",
    icon: Icons.Highlighter,
    label: "Highlight Area",
    action: (store) => {
      closeOtherPanels(store);
      store.setActiveAnnotationTool(
        store.activeAnnotationTool === "highlight" ? null : "highlight",
      );
    },
    isActiveCheck: (store) => store.activeAnnotationTool === "highlight",
  },
  {
    id: "annotate-measure",
    icon: Icons.Ruler,
    label: "Measure Distance",
    action: (store) => {
      closeOtherPanels(store);
      store.setActiveAnnotationTool(
        store.activeAnnotationTool === "measurement" ? null : "measurement",
      );
    },
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
    action: (store) => {
      if (
        confirm(
          "Are you sure you want to clear all user-drawn annotations? This cannot be undone easily.",
        )
      ) {
        store.clearAllAnnotations();
      }
    },
  },
  {
    id: "undo",
    icon: Icons.RotateCcw,
    label: "Undo Last Change",
    action: (store) => store.undoLastAction(),
    isDisabled: (store) => !store.canUndo(),
  },
  {
    id: "reset-view",
    icon: Icons.RefreshCw,
    label: "Reset View (Filters & Transforms)",
    action: (store) => {
      if (
        confirm(
          "Are you sure you want to reset all view adjustments (zoom, pan, filters, crop)?",
        )
      ) {
        store.resetAllFiltersAndTransforms();
      }
    },
  },
];

export function ImageToolsBar() {
  const store = useToolStore();

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
                    ? "bg-accent-blue text-white" // Active state
                    : "text-text-secondary hover:bg-secondary-dark hover:text-text-primary" // Default state
                } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={() => toolConfig.action(store)} // Directly call the action from config
                aria-label={toolConfig.label}
                aria-pressed={isCurrentlyActive}
                disabled={isDisabled}
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
