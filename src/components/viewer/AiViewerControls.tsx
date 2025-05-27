// src/components/viewer/AiViewerControls.tsx
"use client";
import React, { useState } from "react";
import { Icons } from "../../components/ui/icons";
import { Toggle } from "../../components/ui/toggle";
import { Checkbox } from "../../components/ui/checkbox";
import { useToolStore } from "../../store/toolStore";
// Ensure your specific AI item types are imported from your types file
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
        (s.label === aiLabelKey || aiLabelKey === "Tooth Segment") && s.visible,
    ).length;
  }

  return (
    <div className="flex items-center justify-between py-2 px-3 hover:bg-secondary-dark/30">
      <div className="flex items-center">
        <Checkbox
          checked={isChecked}
          onCheckedChange={onCheckedChange}
          id={`ai-finding-${modelType}-${aiLabelKey.replace(/\s+/g, "-").toLowerCase()}`}
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

  const [findingsDisplayConfig, setFindingsDisplayConfig] = useState<
    Record<string, { checked: boolean; modelType: keyof AiStoreAnnotations }>
  >({
    "Calculus (Classified)": { checked: true, modelType: "classifications" },
    "Caries (Classified)": { checked: true, modelType: "classifications" },
    "Caries (Detected)": { checked: true, modelType: "detections" },
    "Tooth Segments": { checked: true, modelType: "segmentations" },
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

    if (modelType === "detections") {
      aiAnnotations.detections
        .filter((d: BoundingBox) => d.label === aiLabelKey)
        .forEach((d: BoundingBox) => {
          // MODIFIED: Explicitly type 'd'
          setAiAnnotationVisibility("detections", d.id, isChecked);
        });
    } else if (modelType === "classifications") {
      aiAnnotations.classifications
        .filter((c: ClassificationPrediction) => c.label === aiLabelKey)
        .forEach((c: ClassificationPrediction) => {
          // MODIFIED: Explicitly type 'c'
          setAiAnnotationVisibility("classifications", c.id, isChecked);
        });
    } else if (modelType === "segmentations") {
      aiAnnotations.segmentations
        .filter(
          (s: SegmentationContour) =>
            s.label === aiLabelKey || aiLabelKey === "Tooth Segment",
        )
        .forEach((s: SegmentationContour) => {
          // MODIFIED: Explicitly type 's'
          setAiAnnotationVisibility("segmentations", s.id, isChecked);
        });
    }
  };

  const handleMainAiToggle = (pressed: boolean) => {
    setAiViewerOn(pressed);
    if (pressed) {
      useToolStore.setState({ aiError: null });
      runAiAnalysis("detection");
      runAiAnalysis("segmentation");
      runAiAnalysis("classification");
    } else {
      clearAiAnnotations();
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
      {aiViewerOn && !anyAiLoading && !aiError && (
        <div className="flex-grow overflow-y-auto">
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
    </div>
  );
}
