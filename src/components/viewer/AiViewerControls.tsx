// frontend/src/components/viewer/AiViewerControls.tsx
"use client";
import React, { useState } from "react";
import { Icons } from "@/components/ui/icons";
// Button component is not used in this version for feedback, can be added back if needed
// import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Checkbox } from "@/components/ui/checkbox";
import { useToolStore } from "@/store/toolStore";
import { AiStoreAnnotations } from "@/types/ai"; // Ensure this path is correct

interface FindingItemProps {
  label: string;
  colorClass: string;
  modelType: keyof AiStoreAnnotations;
  aiLabelKey: string; // The specific label the AI model outputs and is stored with
  isChecked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

const FindingItem: React.FC<FindingItemProps> = ({
  label,
  colorClass,
  modelType,
  aiLabelKey,
  isChecked,
  onCheckedChange,
}) => {
  const aiAnnotations = useToolStore((state) => state.aiAnnotations);

  let count = 0;
  if (modelType === "detections") {
    // Count visible detections matching the specific AI label
    count = aiAnnotations.detections.filter(
      (d) => d.label === aiLabelKey && d.visible,
    ).length;
  } else if (modelType === "classifications") {
    // Count visible classifications matching the specific AI label
    count = aiAnnotations.classifications.filter(
      (c) => c.label === aiLabelKey && c.visible,
    ).length;
  } else if (modelType === "segmentations") {
    // Count visible segmentations (often a generic label like "Tooth Segment")
    // If segmentation labels are more specific, this logic might need adjustment
    count = aiAnnotations.segmentations.filter(
      (s) =>
        (s.label === aiLabelKey || aiLabelKey === "Tooth Segment") && s.visible,
    ).length;
  }

  return (
    <div className="flex items-center justify-between py-2 px-3 hover:bg-secondary-dark/30">
      <div className="flex items-center">
        <Checkbox
          checked={isChecked}
          onCheckedChange={onCheckedChange}
          id={`ai-finding-${modelType}-${aiLabelKey.replace(/\s+/g, "-").toLowerCase()}`} // More unique ID
          className="mr-2"
        />
        <label
          htmlFor={`ai-finding-${modelType}-${aiLabelKey.replace(/\s+/g, "-").toLowerCase()}`}
          className="text-sm text-text-primary cursor-pointer"
        >
          {label} {/* Display label for UI */}
        </label>
      </div>
      <span
        className={`text-xs font-semibold w-auto min-w-[1.25rem] h-5 px-1 flex items-center justify-center rounded-full text-white ${count > 0 ? colorClass : "bg-finding-gray"}`}
      >
        {count > 0 ? count : ""}
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

  // This state tracks the checked status of the UI checkboxes for findings
  const [findingsDisplayConfig, setFindingsDisplayConfig] = useState<
    Record<string, { checked: boolean; modelType: keyof AiStoreAnnotations }>
  >({
    // Classification labels (match UI label and aiLabelKey)
    "Calculus (Classified)": { checked: true, modelType: "classifications" }, // UI Label: "Calculus (Classified)", aiLabelKey in store: "Calculus"
    "Caries (Classified)": { checked: true, modelType: "classifications" }, // UI Label: "Caries (Classified)", aiLabelKey in store: "Caries"
    // Detection labels
    "Caries (Detected)": { checked: true, modelType: "detections" }, // UI Label: "Caries (Detected)", aiLabelKey in store: "Caries"
    // Segmentation labels
    "Tooth Segments": { checked: true, modelType: "segmentations" }, // UI Label: "Tooth Segments", aiLabelKey in store: "Tooth Segment"
  });

  const handleFindingVisibilityChange = (
    uiLabel: string,
    aiLabelKey: string,
    modelType: keyof AiStoreAnnotations,
    isChecked: boolean,
  ) => {
    setFindingsDisplayConfig((prev) => ({
      ...prev,
      [uiLabel]: { ...prev[uiLabel], checked: isChecked },
    }));

    // Update visibility of all matching AI annotations in the store
    if (modelType === "detections") {
      aiAnnotations.detections
        .filter((d) => d.label === aiLabelKey)
        .forEach((d) => {
          setAiAnnotationVisibility("detections", d.id, isChecked);
        });
    } else if (modelType === "classifications") {
      aiAnnotations.classifications
        .filter((c) => c.label === aiLabelKey)
        .forEach((c) => {
          setAiAnnotationVisibility("classifications", c.id, isChecked);
        });
    } else if (modelType === "segmentations") {
      // For segmentations, aiLabelKey is often generic like "Tooth Segment"
      aiAnnotations.segmentations
        .filter((s) => s.label === aiLabelKey || aiLabelKey === "Tooth Segment")
        .forEach((s) => {
          setAiAnnotationVisibility("segmentations", s.id, isChecked);
        });
    }
  };

  const handleMainAiToggle = (pressed: boolean) => {
    setAiViewerOn(pressed);
    if (pressed) {
      useToolStore.setState({ aiError: null }); // Clear previous errors when retrying
      // Optionally, only run if annotations are empty or based on some other logic
      runAiAnalysis("detection");
      runAiAnalysis("segmentation");
      runAiAnalysis("classification");
    } else {
      clearAiAnnotations(); // This also clears aiError and loading states in store
    }
  };

  const handleSectionToggle = (
    sectionType: "pathology" | "segmentation",
    isOpen: boolean,
  ) => {
    let modelTypesToUpdate: Array<keyof AiStoreAnnotations> = [];
    let findingKeysToUpdate: string[] = [];

    if (sectionType === "pathology") {
      setPathologyOpen(isOpen);
      modelTypesToUpdate = ["classifications", "detections"];
      findingKeysToUpdate = pathologyItemsConfig.map((item) => item.uiLabel);
    } else if (sectionType === "segmentation") {
      setSegmentationOpen(isOpen);
      modelTypesToUpdate = ["segmentations"];
      findingKeysToUpdate = segmentationItemsConfig.map((item) => item.uiLabel);
    }

    modelTypesToUpdate.forEach((mt) => toggleAllAiVisibility(mt, isOpen));

    setFindingsDisplayConfig((prev) => {
      const newConfig = { ...prev };
      findingKeysToUpdate.forEach((key) => {
        if (newConfig[key]) {
          newConfig[key] = { ...newConfig[key], checked: isOpen };
        }
      });
      return newConfig;
    });
  };

  // Define UI items. `aiLabelKey` must match the label from your backend model output for counts/visibility.
  // `uiLabel` is what's shown in the UI and used as key in `findingsDisplayConfig`.
  const pathologyItemsConfig = [
    {
      uiLabel: "Calculus (Classified)",
      aiLabelKey: "Calculus",
      colorClass: "bg-finding-green",
      modelType: "classifications" as keyof AiStoreAnnotations,
    },
    {
      uiLabel: "Caries (Classified)",
      aiLabelKey: "Caries",
      colorClass: "bg-finding-purple",
      modelType: "classifications" as keyof AiStoreAnnotations,
    },
    {
      uiLabel: "Caries (Detected)",
      aiLabelKey: "Caries",
      colorClass: "bg-finding-red",
      modelType: "detections" as keyof AiStoreAnnotations,
    },
  ];

  const segmentationItemsConfig = [
    {
      uiLabel: "Tooth Segments",
      aiLabelKey: "Tooth Segment",
      colorClass: "bg-finding-blue",
      modelType: "segmentations" as keyof AiStoreAnnotations,
    },
  ];

  const anyAiLoading =
    isAiLoading.detection ||
    isAiLoading.segmentation ||
    isAiLoading.classification;

  return (
    <div className="w-64 bg-primary-dark text-text-primary flex flex-col shrink-0 h-full">
      {" "}
      {/* Ensure full height */}
      <div className="p-3 border-b border-border-dark">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold">AI Viewer</h2>
          <Toggle
            pressed={aiViewerOn}
            onPressedChange={handleMainAiToggle}
            aria-label="Toggle AI Viewer"
            size="sm"
            className="data-[state=on]:bg-accent-blue data-[state=off]:bg-gray-600 w-10 h-5 p-0.5 rounded-full relative"
            disabled={anyAiLoading}
          >
            <div
              className={`bg-white h-4 w-4 rounded-full absolute top-1/2 -translate-y-1/2 transition-transform duration-200 ease-in-out ${aiViewerOn ? "left-[calc(100%-1rem-0.125rem)] -translate-x-full" : "left-[0.125rem]"}`}
            />
          </Toggle>
        </div>
        {anyAiLoading && (
          <p className="text-xs text-text-secondary text-center py-1">
            AI models loading...
          </p>
        )}
        {aiError && !anyAiLoading && (
          <p className="text-xs text-red-400 text-center py-1 px-1 break-words">
            {aiError}
          </p>
        )}
      </div>
      {/* Only show details if AI Viewer is on AND not loading AND no critical error */}
      {aiViewerOn && !anyAiLoading && !aiError && (
        <div className="flex-grow overflow-y-auto">
          {" "}
          {/* Allows scrolling if content exceeds height */}
          {/* Pathology Section */}
          <div className="border-b border-border-dark">
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleSectionToggle("pathology", !pathologyOpen)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSectionToggle("pathology", !pathologyOpen);
                }
              }}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-secondary-dark/30 cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent-blue rounded-sm"
              aria-expanded={pathologyOpen}
              aria-controls="pathology-section"
            >
              <div className="flex items-center">
                <Checkbox
                  checked={pathologyOpen}
                  // Clicking checkbox directly also toggles section
                  onCheckedChange={(checked) =>
                    handleSectionToggle("pathology", Boolean(checked))
                  }
                  aria-labelledby="pathology-label"
                  id="pathology-checkbox"
                  className="mr-2"
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
              <div id="pathology-section">
                {pathologyItemsConfig.map((item) => (
                  <FindingItem
                    key={item.uiLabel}
                    label={item.uiLabel}
                    colorClass={item.colorClass}
                    modelType={item.modelType}
                    aiLabelKey={item.aiLabelKey} // This is the key used for matching in store
                    isChecked={
                      findingsDisplayConfig[item.uiLabel]?.checked ?? true
                    }
                    onCheckedChange={(checked) =>
                      handleFindingVisibilityChange(
                        item.uiLabel,
                        item.aiLabelKey,
                        item.modelType,
                        Boolean(checked),
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>
          {/* Segmentation Section */}
          <div className="border-b border-border-dark">
            <div
              role="button"
              tabIndex={0}
              onClick={() =>
                handleSectionToggle("segmentation", !segmentationOpen)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSectionToggle("segmentation", !segmentationOpen);
                }
              }}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-secondary-dark/30 cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent-blue rounded-sm"
              aria-expanded={segmentationOpen}
              aria-controls="segmentation-section-items"
            >
              <div className="flex items-center">
                <Checkbox
                  checked={segmentationOpen}
                  onCheckedChange={(checked) =>
                    handleSectionToggle("segmentation", Boolean(checked))
                  }
                  aria-labelledby="segmentation-label"
                  id="segmentation-checkbox"
                  className="mr-2"
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
                {" "}
                {/* Changed ID to be more specific */}
                {segmentationItemsConfig.map((item) => (
                  <FindingItem
                    key={item.uiLabel}
                    label={item.uiLabel}
                    colorClass={item.colorClass}
                    modelType={item.modelType}
                    aiLabelKey={item.aiLabelKey}
                    isChecked={
                      findingsDisplayConfig[item.uiLabel]?.checked ?? true
                    }
                    onCheckedChange={(checked) =>
                      handleFindingVisibilityChange(
                        item.uiLabel,
                        item.aiLabelKey,
                        item.modelType,
                        Boolean(checked),
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* For example: */}
      {/* {aiViewerOn && !anyAiLoading && !aiError && (
        <div className="p-4 border-t border-border-dark bg-secondary-dark/20 relative mt-auto">
          <h3 className="text-sm font-semibold mb-2">Help us refine our AI</h3>
           ... rest of feedback UI ... 
        </div>
      )} */}
    </div>
  );
}
