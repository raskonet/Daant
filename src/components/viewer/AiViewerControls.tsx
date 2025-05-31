// src/components/viewer/AiViewerControls.tsx
"use client";
import React, { useState, useEffect, useMemo } from "react";
import { Icons } from "../../components/ui/icons";
import { Toggle } from "../../components/ui/toggle";
import { Checkbox } from "../../components/ui/checkbox";
import { Button } from "../../components/ui/button";
import { useToolStore } from "../../store/toolStore";
import { useDicomStore } from "../../store/dicomStore";
import { AiStoreAnnotations, BoundingBox } from "../../types/ai";

const pathologyItemsConfig = [
  { uiLabel: "Cavity", aiLabelKey: "cavity", colorClass: "bg-finding-yellow" },
  {
    uiLabel: "Periapical Area",
    aiLabelKey: "pa",
    colorClass: "bg-finding-purple",
  },
];
interface FindingItemProps {
  label: string;
  colorClass: string;
  aiLabelKey: string;
  isChecked: boolean;
  onCheckedChange: (checked: boolean) => void;
  isDisabled: boolean;
}

const FindingItem: React.FC<FindingItemProps> = ({
  label,
  colorClass,
  aiLabelKey,
  isChecked,
  onCheckedChange,
  isDisabled,
}) => {
  const aiAnnotations = useToolStore((state) => state.aiAnnotations);
  let count = 0;
  if (!isDisabled) {
    count = aiAnnotations.detections.filter(
      (d: BoundingBox) => d.label === aiLabelKey && d.visible,
    ).length;
  }
  const id = `ai-finding-detection-${aiLabelKey.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div
      className={`flex items-center justify-between py-2 px-3 ${!isDisabled ? "hover:bg-secondary-dark/30" : "opacity-60"}`}
    >
      <div className="flex items-center">
        <Checkbox
          checked={isChecked && !isDisabled}
          onCheckedChange={onCheckedChange}
          id={id}
          className="mr-2"
          disabled={isDisabled}
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
    diagnosticReport,
    isReportLoading: isReportGenLoading,
    reportError: reportGenError,
    generateAndFetchReport,
  } = useToolStore();

  const dicomId = useDicomStore((state) => state.dicomData?.id);
  const [aiViewerOn, setAiViewerOn] = useState(false);
  const [pathologyOpen, setPathologyOpen] = useState(true);

  const initialFindingsCheckedState = useMemo(() => {
    const state: Record<string, boolean> = {};
    pathologyItemsConfig.forEach((item) => (state[item.uiLabel] = true));
    return state;
  }, []);

  const [findingsCheckedState, setFindingsCheckedState] = useState<
    Record<string, boolean>
  >(initialFindingsCheckedState);

  const handleFindingVisibilityChange = (
    uiLabel: string,
    aiModelLabel: string,
    isChecked: boolean,
  ) => {
    setFindingsCheckedState((prev) => ({ ...prev, [uiLabel]: isChecked }));
    aiAnnotations.detections
      .filter((d) => d.label === aiModelLabel)
      .forEach((d) => setAiAnnotationVisibility("detections", d.id, isChecked));
  };

  const handleMainAiToggle = (pressed: boolean) => {
    setAiViewerOn(pressed);
    if (pressed) {
      useToolStore.setState({
        aiError: null,
        reportError: null,
        diagnosticReport: null,
      });
      runAiAnalysis("detection");
      setPathologyOpen(true);
      setFindingsCheckedState(initialFindingsCheckedState);
      toggleAllAiVisibility("detections", true);
    } else {
      clearAiAnnotations();
    }
  };

  const handleSectionToggle = (isOpen: boolean) => {
    setPathologyOpen(isOpen);
    toggleAllAiVisibility("detections", isOpen);
    setFindingsCheckedState((prev) => {
      const newState = { ...prev };
      pathologyItemsConfig.forEach((item) => {
        newState[item.uiLabel] = isOpen;
      });
      return newState;
    });
  };

  const anyAiLoading = isAiLoading.detection;
  const controlsDisabled = !aiViewerOn || anyAiLoading || !!aiError;

  useEffect(() => {
    if (!aiViewerOn) {
      setPathologyOpen(true);
      setFindingsCheckedState(initialFindingsCheckedState);
    }
  }, [aiViewerOn, initialFindingsCheckedState]);

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
            disabled={anyAiLoading}
          >
            <div
              className={`bg-white h-4 w-4 rounded-full absolute top-1/2 -translate-y-1/2 transition-transform duration-200 ease-in-out ${aiViewerOn ? "left-[calc(100%-1rem-0.125rem)] -translate-x-full" : "left-[0.125rem]"}`}
            />
          </Toggle>
        </div>
        {anyAiLoading && (
          <p className="text-xs text-text-secondary text-center py-1">
            AI model analyzing...
          </p>
        )}
        {aiError && !anyAiLoading && (
          <div className="my-1 p-2 bg-red-900/40 border border-red-700/60 rounded-md">
            <p className="text-xs text-red-300 text-center break-words">
              <span className="font-semibold block mb-0.5">AI Error:</span>{" "}
              {aiError}
            </p>
          </div>
        )}
      </div>
      <div
        className={`flex-grow overflow-y-auto ${controlsDisabled && !anyAiLoading ? "opacity-50 pointer-events-none" : ""}`}
      >
        <div className="border-b border-border-dark">
          <div
            role="button"
            tabIndex={controlsDisabled ? -1 : 0}
            onClick={() =>
              !controlsDisabled && handleSectionToggle(!pathologyOpen)
            }
            onKeyDown={(e) => {
              if (!controlsDisabled && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                handleSectionToggle(!pathologyOpen);
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
                  !controlsDisabled && handleSectionToggle(Boolean(checked))
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
                  aiLabelKey={item.aiLabelKey}
                  isChecked={findingsCheckedState[item.uiLabel] ?? true}
                  onCheckedChange={(checked) =>
                    handleFindingVisibilityChange(
                      item.uiLabel,
                      item.aiLabelKey,
                      Boolean(checked),
                    )
                  }
                  isDisabled={controlsDisabled}
                />
              ))}
            </div>
          )}
        </div>
        {aiViewerOn && !anyAiLoading && !aiError && (
          <div className="p-3 border-t border-border-dark">
            <h3 className="text-sm font-semibold mb-2 text-text-primary">
              Diagnostic Report
            </h3>
            <Button
              onClick={generateAndFetchReport}
              disabled={
                isReportGenLoading ||
                !dicomId ||
                (!aiAnnotations.detections?.length && !diagnosticReport)
              }
              className="w-full mb-2 bg-accent-blue hover:bg-accent-blue/90 text-white"
              size="sm"
            >
              {isReportGenLoading
                ? "Generating Report..."
                : diagnosticReport
                  ? "Regenerate Report"
                  : "Generate Report"}
            </Button>
            {reportGenError && (
              <p className="text-xs text-red-400 mt-1 text-center">
                {reportGenError}
              </p>
            )}
            {diagnosticReport && !isReportGenLoading && (
              <div className="mt-2 text-xs text-text-secondary bg-secondary-dark p-2.5 rounded max-h-60 overflow-y-auto">
                <pre className="whitespace-pre-wrap break-words font-sans leading-relaxed">
                  {diagnosticReport}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
      {!aiViewerOn && !anyAiLoading && !aiError && (
        <div className="p-4 text-center text-xs text-text-secondary mt-auto">
          Turn on AI Viewer to see analysis options and generate a report.
        </div>
      )}
    </div>
  );
}
