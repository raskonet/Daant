// src/components/viewer/AiViewerControls.tsx
"use client";
import React, { useState, useEffect } from "react"; // Added useEffect
import { Icons } from "../../components/ui/icons";
import { Toggle } from "../../components/ui/toggle";
import { Checkbox } from "../../components/ui/checkbox";
import { useToolStore } from "../../store/toolStore";
import {
  AiStoreAnnotations,
  BoundingBox,
  ClassificationPrediction,
  SegmentationContour,
} from "../../types/ai";

interface FindingItemProps {
  label: string;
  colorClass: string;
  modelType: keyof AiStoreAnnotations;
  aiLabelKey: string;
  isChecked: boolean;
  onCheckedChange: (checked: boolean) => void;
  isDisabled: boolean; // Added to disable individual items if AI is off or errored
}

const FindingItem: React.FC<FindingItemProps> = ({
  label,
  colorClass,
  modelType,
  aiLabelKey,
  isChecked,
  onCheckedChange,
  isDisabled,
}) => {
  const aiAnnotations = useToolStore((state) => state.aiAnnotations);

  let count = 0;
  if (!isDisabled) {
    // Only calculate count if not disabled
    if (modelType === "detections") {
      count = aiAnnotations.detections.filter(
        (d: BoundingBox) => d.label === aiLabelKey && d.visible,
      ).length;
    } else if (modelType === "classifications") {
      count = aiAnnotations.classifications.filter(
        (c: ClassificationPrediction) => c.label === aiLabelKey && c.visible,
      ).length;
    } else if (modelType === "segmentations") {
      count = aiAnnotations.segmentations.filter(
        (s: SegmentationContour) =>
          (s.label === aiLabelKey || aiLabelKey === "Tooth Segment") &&
          s.visible,
      ).length;
    }
  }

  const id = `ai-finding-${modelType}-${aiLabelKey.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div
      className={`flex items-center justify-between py-2 px-3 ${!isDisabled ? "hover:bg-secondary-dark/30" : "opacity-60"}`}
    >
      <div className="flex items-center">
        <Checkbox
          checked={isChecked && !isDisabled} // Ensure checkbox reflects disabled state
          onCheckedChange={onCheckedChange}
          id={id}
          className="mr-2"
          disabled={isDisabled} // Disable checkbox
        />
        <label
          htmlFor={id}
          className={`text-sm cursor-pointer ${isDisabled ? "text-text-secondary" : "text-text-primary"}`}
        >
          {label}
        </label>
      </div>
      <span
        className={`text-xs font-semibold w-auto min-w-[1.25rem] h-5 px-1 flex items-center justify-center rounded-full text-white ${count > 0 && !isDisabled ? colorClass : "bg-finding-gray"}`}
      >
        {count > 0 && !isDisabled ? count : ""}
      </span>
    </div>
  );
};

export function AiViewerControls() {
  const {
    runAiAnalysis,
    aiAnnotations,
    setAiAnnotationVisibility,
    isAiLoading,
    clearAiAnnotations,
    toggleAllAiVisibility,
    aiError,
  } = useToolStore();

  const [aiViewerOn, setAiViewerOn] = useState(false);
  const [pathologyOpen, setPathologyOpen] = useState(true);
  const [segmentationOpen, setSegmentationOpen] = useState(true);

  // Local state to manage the checked status of individual finding items
  // This is kept separate from the global visibility in aiAnnotations
  // to allow users to uncheck items even if the global section is toggled off/on.
  const [findingsCheckedState, setFindingsCheckedState] = useState<
    Record<string, boolean>
  >({
    "Calculus (Classified)": true,
    "Caries (Classified)": true,
    "Caries (Detected)": true,
    "Tooth Segments": true,
  });

  const handleFindingVisibilityChange = (
    uiLabel: string, // The UI label, e.g., "Caries (Detected)"
    aiModelLabel: string, // The actual label used by the AI model, e.g., "Caries"
    modelType: keyof AiStoreAnnotations,
    isChecked: boolean,
  ) => {
    setFindingsCheckedState((prev) => ({ ...prev, [uiLabel]: isChecked }));

    // Determine which items in the store to update based on the aiModelLabel
    if (modelType === "detections") {
      aiAnnotations.detections
        .filter((d) => d.label === aiModelLabel)
        .forEach((d) =>
          setAiAnnotationVisibility("detections", d.id, isChecked),
        );
    } else if (modelType === "classifications") {
      aiAnnotations.classifications
        .filter((c) => c.label === aiModelLabel)
        .forEach((c) =>
          setAiAnnotationVisibility("classifications", c.id, isChecked),
        );
    } else if (modelType === "segmentations") {
      aiAnnotations.segmentations
        .filter(
          (s) =>
            s.label === aiModelLabel ||
            (aiModelLabel === "Tooth Segment" && s.label === "Tooth Segment"),
        ) // "Tooth Segment" is generic
        .forEach((s) =>
          setAiAnnotationVisibility("segmentations", s.id, isChecked),
        );
    }
  };

  const handleMainAiToggle = (pressed: boolean) => {
    setAiViewerOn(pressed);
    if (pressed) {
      // Clear any previous AI error when the user explicitly tries to turn AI on
      useToolStore.setState({ aiError: null });
      // Potentially re-run all analyses or let user trigger them individually later
      // For now, let's assume we run all when toggled on
      runAiAnalysis("detection");
      runAiAnalysis("segmentation");
      runAiAnalysis("classification");
      // Ensure all sub-sections and items are checked by default when AI is turned on
      setPathologyOpen(true);
      setSegmentationOpen(true);
      const newFindingsCheckedState: Record<string, boolean> = {};
      [...pathologyItemsConfig, ...segmentationItemsConfig].forEach((item) => {
        newFindingsCheckedState[item.uiLabel] = true;
      });
      setFindingsCheckedState(newFindingsCheckedState);
      // And ensure their visibility is set in the store
      toggleAllAiVisibility("detections", true);
      toggleAllAiVisibility("segmentations", true);
      toggleAllAiVisibility("classifications", true);
    } else {
      clearAiAnnotations(); // This will also clear aiError in the store
    }
  };

  const handleSectionToggle = (
    sectionType: "pathology" | "segmentation",
    isOpen: boolean,
  ) => {
    const itemsToUpdate:
      | typeof pathologyItemsConfig
      | typeof segmentationItemsConfig =
      sectionType === "pathology"
        ? pathologyItemsConfig
        : segmentationItemsConfig;

    const modelTypesToUpdate: Array<keyof AiStoreAnnotations> = [];
    if (sectionType === "pathology") {
      setPathologyOpen(isOpen);
      modelTypesToUpdate.push("classifications", "detections");
    } else {
      setSegmentationOpen(isOpen);
      modelTypesToUpdate.push("segmentations");
    }

    // Update global visibility for all items in these model types
    modelTypesToUpdate.forEach((mt) => toggleAllAiVisibility(mt, isOpen));

    // Update local checked state for items within this section
    setFindingsCheckedState((prev) => {
      const newState = { ...prev };
      itemsToUpdate.forEach((item) => {
        newState[item.uiLabel] = isOpen;
      });
      return newState;
    });
  };

  const pathologyItemsConfig = [
    {
      uiLabel: "Calculus (Classified)",
      aiLabelKey: "Calculus", // Label AI uses
      colorClass: "bg-finding-green",
      modelType: "classifications" as keyof AiStoreAnnotations,
    },
    {
      uiLabel: "Caries (Classified)",
      aiLabelKey: "Caries", // Label AI uses
      colorClass: "bg-finding-purple",
      modelType: "classifications" as keyof AiStoreAnnotations,
    },
    {
      uiLabel: "Caries (Detected)",
      aiLabelKey: "Caries", // Label AI uses
      colorClass: "bg-finding-red",
      modelType: "detections" as keyof AiStoreAnnotations,
    },
  ];

  const segmentationItemsConfig = [
    {
      uiLabel: "Tooth Segments",
      aiLabelKey: "Tooth Segment", // Label AI uses (or a generic one if model doesn't provide specific tooth labels)
      colorClass: "bg-finding-blue",
      modelType: "segmentations" as keyof AiStoreAnnotations,
    },
  ];

  const anyAiLoading =
    isAiLoading.detection ||
    isAiLoading.segmentation ||
    isAiLoading.classification;

  // Determines if the controls section should be effectively disabled
  const controlsDisabled = !aiViewerOn || anyAiLoading || !!aiError;

  // Reset local UI state if AI viewer is turned off externally or cleared
  useEffect(() => {
    if (!aiViewerOn) {
      setPathologyOpen(true); // Default state when off
      setSegmentationOpen(true); // Default state when off
      const defaultChecks: Record<string, boolean> = {};
      [...pathologyItemsConfig, ...segmentationItemsConfig].forEach((item) => {
        defaultChecks[item.uiLabel] = true;
      });
      setFindingsCheckedState(defaultChecks);
    }
  }, [aiViewerOn]);

  return (
    <div className="w-64 bg-primary-dark text-text-primary flex flex-col shrink-0 h-full border-l border-border-dark">
      <div className="p-3 border-b border-border-dark">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">AI Viewer</h2>
          <Toggle
            pressed={aiViewerOn}
            onPressedChange={handleMainAiToggle}
            aria-label="Toggle AI Viewer"
            size="sm"
            className="data-[state=on]:bg-accent-blue data-[state=off]:bg-gray-600 w-10 h-5 p-0.5 rounded-full relative"
            disabled={anyAiLoading} // Only disable toggle during loading, not if there's an error (user might want to turn it off)
          >
            <div
              className={`bg-white h-4 w-4 rounded-full absolute top-1/2 -translate-y-1/2 transition-transform duration-200 ease-in-out ${aiViewerOn ? "left-[calc(100%-1rem-0.125rem)] -translate-x-full" : "left-[0.125rem]"}`}
            />
          </Toggle>
        </div>
        {anyAiLoading && (
          <p className="text-xs text-text-secondary text-center py-1">
            AI models analyzing...
          </p>
        )}
        {aiError &&
          !anyAiLoading && ( // Show error if not currently loading something else
            <div className="my-1 p-2 bg-red-900/40 border border-red-700/60 rounded-md">
              <p className="text-xs text-red-300 text-center break-words">
                <span className="font-semibold block mb-0.5">AI Error:</span>{" "}
                {aiError}
              </p>
            </div>
          )}
      </div>

      {/* Conditional rendering for the controls section */}
      <div
        className={`flex-grow overflow-y-auto ${controlsDisabled && !anyAiLoading ? "opacity-50 pointer-events-none" : ""}`}
      >
        {/* Pathology Section */}
        <div className="border-b border-border-dark">
          <div
            role="button"
            tabIndex={controlsDisabled ? -1 : 0}
            onClick={() =>
              !controlsDisabled &&
              handleSectionToggle("pathology", !pathologyOpen)
            }
            onKeyDown={(e) => {
              if (!controlsDisabled && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                handleSectionToggle("pathology", !pathologyOpen);
              }
            }}
            className={`w-full flex items-center justify-between p-3 text-left ${!controlsDisabled ? "hover:bg-secondary-dark/30 cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent-blue rounded-sm" : "cursor-default"}`}
            aria-expanded={pathologyOpen}
            aria-controls="pathology-section-items"
            aria-disabled={controlsDisabled}
          >
            <div className="flex items-center">
              <Checkbox
                checked={pathologyOpen && !controlsDisabled}
                onCheckedChange={(checked) =>
                  !controlsDisabled &&
                  handleSectionToggle("pathology", Boolean(checked))
                }
                aria-labelledby="pathology-label"
                id="pathology-checkbox"
                className="mr-2"
                disabled={controlsDisabled}
              />
              <span id="pathology-label" className="text-sm font-medium">
                Pathology Findings
              </span>
            </div>
            <Icons.ChevronLeft
              size={16}
              className={`transform transition-transform ${pathologyOpen ? "-rotate-90" : ""} text-text-secondary`}
              aria-hidden="true"
            />
          </div>
          {pathologyOpen && (
            <div id="pathology-section-items">
              {pathologyItemsConfig.map((item) => (
                <FindingItem
                  key={item.uiLabel}
                  label={item.uiLabel}
                  colorClass={item.colorClass}
                  modelType={item.modelType}
                  aiLabelKey={item.aiLabelKey}
                  isChecked={findingsCheckedState[item.uiLabel] ?? true}
                  onCheckedChange={(checked) =>
                    handleFindingVisibilityChange(
                      item.uiLabel,
                      item.aiLabelKey,
                      item.modelType,
                      Boolean(checked),
                    )
                  }
                  isDisabled={controlsDisabled}
                />
              ))}
            </div>
          )}
        </div>

        {/* Segmentation Section */}
        <div className="border-b border-border-dark">
          <div
            role="button"
            tabIndex={controlsDisabled ? -1 : 0}
            onClick={() =>
              !controlsDisabled &&
              handleSectionToggle("segmentation", !segmentationOpen)
            }
            onKeyDown={(e) => {
              if (!controlsDisabled && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                handleSectionToggle("segmentation", !segmentationOpen);
              }
            }}
            className={`w-full flex items-center justify-between p-3 text-left ${!controlsDisabled ? "hover:bg-secondary-dark/30 cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent-blue rounded-sm" : "cursor-default"}`}
            aria-expanded={segmentationOpen}
            aria-controls="segmentation-section-items"
            aria-disabled={controlsDisabled}
          >
            <div className="flex items-center">
              <Checkbox
                checked={segmentationOpen && !controlsDisabled}
                onCheckedChange={(checked) =>
                  !controlsDisabled &&
                  handleSectionToggle("segmentation", Boolean(checked))
                }
                aria-labelledby="segmentation-label"
                id="segmentation-checkbox"
                className="mr-2"
                disabled={controlsDisabled}
              />
              <span id="segmentation-label" className="text-sm font-medium">
                Segmentation
              </span>
            </div>
            <Icons.ChevronLeft
              size={16}
              className={`transform transition-transform ${segmentationOpen ? "-rotate-90" : ""} text-text-secondary`}
              aria-hidden="true"
            />
          </div>
          {segmentationOpen && (
            <div id="segmentation-section-items">
              {segmentationItemsConfig.map((item) => (
                <FindingItem
                  key={item.uiLabel}
                  label={item.uiLabel}
                  colorClass={item.colorClass}
                  modelType={item.modelType}
                  aiLabelKey={item.aiLabelKey}
                  isChecked={findingsCheckedState[item.uiLabel] ?? true}
                  onCheckedChange={(checked) =>
                    handleFindingVisibilityChange(
                      item.uiLabel,
                      item.aiLabelKey,
                      item.modelType,
                      Boolean(checked),
                    )
                  }
                  isDisabled={controlsDisabled}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Message if controls are disabled due to AI being off (and not loading/error) */}
      {!aiViewerOn && !anyAiLoading && !aiError && (
        <div className="p-4 text-center text-xs text-text-secondary">
          Turn on AI Viewer to see analysis options.
        </div>
      )}
    </div>
  );
}
