"use client";
import React, { useState } from "react";
import { Icons } from "../../components/ui/icons";
import { Button } from "../../components/ui/button";
import { Toggle } from "../../components/ui/toggle";
import { useDicomStore } from "../../store/dicomStore";
import { useToolStore } from "../../store/toolStore";
import { downloadFile } from "../../lib/utils";
import { exportModifiedDicom } from "../../services/api";
import { DicomMeta } from "../../types";
import { useShallow } from "zustand/react/shallow";

export function Header() {
  const { dicomData, currentDicomId, dicomOriginalMeta } = useDicomStore(
    useShallow((state) => ({
      dicomData: state.dicomData,
      currentDicomId: state.dicomData?.id,
      dicomOriginalMeta: state.dicomData?.meta,
    })),
  );
  const resetDicomStore = useDicomStore((state) => state.resetState);

  const {
    undoLastAction,
    canUndo,
    getCanvasAsDataURL,
    editedDicomMeta, // Type is now SafePartialDicomMeta | null
    resetAllToolRelatedStateGlobal,
  } = useToolStore(
    useShallow((state) => ({
      undoLastAction: state.undoLastAction,
      canUndo: state.canUndo,
      getCanvasAsDataURL: state.getCanvasAsDataURL,
      editedDicomMeta: state.editedDicomMeta,
      resetAllToolRelatedStateGlobal: state.resetAllToolRelatedState,
    })),
  );

  const [fmxOn, setFmxOn] = useState(true);
  const [phiOn, setPhiOn] = useState(true);

  const handleBackButtonClick = () => {
    if (canUndo()) {
      undoLastAction();
    } else {
      resetDicomStore();
      resetAllToolRelatedStateGlobal();
    }
  };

  const handleExportPNG = () => {
    if (getCanvasAsDataURL) {
      const dataURL = getCanvasAsDataURL();
      if (dataURL) {
        let filename = "dicom-view-export";
        if (dicomData) {
          if (
            phiOn &&
            dicomData.patientName &&
            dicomData.patientName !== "Unknown Patient"
          ) {
            filename += `_${dicomData.patientName.replace(/\s+/g, "_")}`;
          }
          if (dicomData.studyDate && dicomData.studyDate !== "N/A") {
            const sanitizedDate = dicomData.studyDate
              .replace(/, /g, "_")
              .replace(/\s+/g, "_");
            filename += `_${sanitizedDate}`;
          } else {
            filename += `_${new Date().toLocaleDateString("en-CA")}`;
          }
        } else {
          filename += `_${new Date().toLocaleDateString("en-CA")}`;
        }
        downloadFile(dataURL, `${filename}.png`);
      } else {
        alert(
          "Could not export canvas. Image might not be fully loaded or an error occurred.",
        );
      }
    } else {
      alert("Canvas export function is not available. Is an image loaded?");
    }
  };

  const handleDownloadOriginalDicom = async () => {
    if (!currentDicomId) {
      alert("No DICOM loaded to download.");
      return;
    }
    try {
      const response = await fetch(
        `/api/v1/dicom/${currentDicomId}/download_original`,
      );
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `Failed to download original DICOM: ${response.status} ${response.statusText}. Server said: ${errorData}`,
        );
      }
      const blob = await response.blob();
      downloadFile(
        URL.createObjectURL(blob),
        `${currentDicomId}_original.dcm`,
        "application/dicom",
      );
    } catch (error) {
      console.error("Error downloading original DICOM:", error);
      alert(
        `Failed to download original DICOM. ${error instanceof Error ? error.message : "An unknown error occurred."}`,
      );
    }
  };

  const handleExportModifiedDicom = async () => {
    if (!currentDicomId) {
      alert("No DICOM loaded to export.");
      return;
    }
    if (!editedDicomMeta) {
      alert(
        "Metadata editor has not been opened or initialized, or no changes made.",
      );
      return;
    }
    if (!dicomOriginalMeta) {
      alert(
        "Original DICOM metadata not available for comparison. Cannot determine precise changes.",
      );
      return;
    }

    const changesToSend: Partial<DicomMeta> = {}; // Still use Partial<DicomMeta> for the payload
    let hasActualChanges = false;

    for (const key in editedDicomMeta) {
      if (Object.prototype.hasOwnProperty.call(editedDicomMeta, key)) {
        const typedKey = key as keyof DicomMeta;

        const editedValue = editedDicomMeta[typedKey]; // From SafePartialDicomMeta, so strings are "" or string, not null
        const originalValue = dicomOriginalMeta[typedKey];

        if (editedValue !== originalValue) {
          // Now, editedValue should be string, "", number, [number,number], null (for nullable number fields), or undefined.
          // This assignment should be fine for Partial<DicomMeta> as long as undefined values are handled by JSON stringifier (usually stripped)
          // and backend handles missing keys as "no change".
          // The problematic "null not assignable to undefined" for string fields should be gone
          // because editedValue for string fields will be "" or a string from the store.
          if (typeof editedValue !== "undefined") {
            // Only include defined values in changesToSend
            (changesToSend as any)[typedKey] = editedValue; // Use `as any` to bypass if TS still struggles with exact unions
          }
          hasActualChanges = true;
        }
      }
    }

    if (!hasActualChanges) {
      alert("No metadata changes detected to export.");
      return;
    }

    try {
      const blob = await exportModifiedDicom(currentDicomId, changesToSend);
      downloadFile(
        URL.createObjectURL(blob),
        `${currentDicomId}_modified.dcm`,
        "application/dicom",
      );
    } catch (error) {
      console.error("Error exporting modified DICOM:", error);
      alert(
        `Failed to export modified DICOM. ${error instanceof Error ? error.message : "An unknown error occurred."}`,
      );
    }
  };

  let displayPatientName = "No Patient Loaded";
  if (dicomData) {
    if (!phiOn) {
      displayPatientName = "PHI Masked";
    } else if (dicomData.patientName) {
      if (
        dicomData.patientName.length > 20 &&
        dicomData.patientName !== "Unknown Patient"
      ) {
        displayPatientName = `Patient ID: ...${dicomData.patientName.slice(-8)}`;
      } else {
        displayPatientName = dicomData.patientName;
      }
    } else {
      displayPatientName = "Unknown Patient";
    }
  }
  const studyDateForDisplay = dicomData?.studyDate || "N/A";
  const isUndoPossible = canUndo();

  const canExportModified =
    currentDicomId &&
    editedDicomMeta &&
    dicomOriginalMeta &&
    Object.keys(editedDicomMeta).some((key) => {
      const metaKey = key as keyof DicomMeta;
      let currentEditedValue = editedDicomMeta[metaKey]; // from SafePartialDicomMeta
      const currentOriginalValue = dicomOriginalMeta[metaKey];

      // Consistent comparison logic
      if (
        currentEditedValue === null &&
        (metaKey === "patient_id" ||
          metaKey === "study_date" ||
          metaKey === "modality")
      ) {
        // This case should not happen if store sets "" for these fields when null
        // But for safety in comparison:
        currentEditedValue = "";
      }

      return (
        Object.prototype.hasOwnProperty.call(dicomOriginalMeta, metaKey) &&
        currentEditedValue !== currentOriginalValue
      );
    });

  return (
    <header className="bg-primary-dark text-text-primary h-16 flex items-center justify-between px-4 border-b border-border-dark shrink-0">
      <div className="flex items-center gap-4">
        <Button
          variant="icon"
          size="icon"
          className="text-text-secondary hover:text-text-primary"
          onClick={handleBackButtonClick}
          aria-label={
            isUndoPossible
              ? "Undo last image change"
              : "Go back and clear image"
          }
          title={
            isUndoPossible
              ? "Undo last image change"
              : "Go back to upload screen"
          }
        >
          <Icons.ChevronLeft size={24} />
        </Button>
        <div className="flex items-center gap-2">
          <Icons.UserCircle size={28} className="text-text-secondary" />
          <span
            className="font-semibold text-lg whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]"
            title={
              dicomData && phiOn ? dicomData.patientName : displayPatientName
            }
          >
            {displayPatientName}
          </span>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <span className="text-sm text-text-secondary">FMX</span>
          <Toggle
            pressed={fmxOn}
            onPressedChange={setFmxOn}
            size="sm"
            className="data-[state=on]:bg-accent-blue data-[state=off]:bg-gray-600 w-12 h-6 p-0.5 rounded-full relative"
            aria-label="Toggle FMX view"
          >
            <div
              className={`bg-white h-5 w-5 rounded-full absolute top-1/2 -translate-y-1/2 transition-transform duration-200 ease-in-out ${fmxOn ? "left-[calc(100%-1.25rem-0.125rem)] -translate-x-full" : "left-[0.125rem]"}`}
            />
          </Toggle>
        </div>
        {fmxOn && (
          <div
            className="flex gap-0.5 bg-secondary-dark p-1 rounded"
            aria-label="FMX tooth selector"
          >
            {[...Array(8)].map((_, i) => (
              <button
                key={`t-${i}`}
                title={`Upper ${i + 1}`}
                aria-label={`Select upper tooth segment ${i + 1}`}
                className={`w-3 h-5 ${i === 3 ? "bg-accent-blue" : "bg-gray-600"} hover:bg-gray-500 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-blue`}
              ></button>
            ))}
            <div className="w-1"></div>
            {[...Array(8)].map((_, i) => (
              <button
                key={`b-${i}`}
                title={`Lower ${i + 1}`}
                aria-label={`Select lower tooth segment ${i + 1}`}
                className={`w-3 h-5 bg-gray-600 hover:bg-gray-500 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-blue`}
              ></button>
            ))}
          </div>
        )}
        <div className="ml-4 text-sm bg-secondary-dark px-3 py-1.5 rounded">
          {studyDateForDisplay}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="default"
          size="sm"
          className="bg-accent-blue hover:bg-blue-600 text-white"
          onClick={handleExportPNG}
          disabled={!dicomData || !getCanvasAsDataURL}
          title="Export current view as PNG"
        >
          <Icons.Printer size={18} className="mr-2" />
          Export PNG
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadOriginalDicom}
          disabled={!currentDicomId}
          title="Download the originally uploaded DICOM file"
        >
          Orig. DICOM
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportModifiedDicom}
          disabled={!canExportModified}
          title="Export DICOM with metadata changes"
          className={!canExportModified ? "opacity-50 cursor-not-allowed" : ""}
        >
          Mod. DICOM
        </Button>
        <div className="flex items-center gap-1">
          <span className="text-xs text-text-secondary">PHI</span>
          <Toggle
            pressed={phiOn}
            onPressedChange={setPhiOn}
            size="sm"
            className="data-[state=on]:bg-accent-blue data-[state=off]:bg-gray-600 w-10 h-5 p-0.5 rounded-full relative"
            aria-label="Toggle PHI visibility"
          >
            <div
              className={`bg-white h-4 w-4 rounded-full absolute top-1/2 -translate-y-1/2 transition-transform duration-200 ease-in-out ${phiOn ? "left-[calc(100%-1rem-0.125rem)] -translate-x-full" : "left-[0.125rem]"}`}
            />
          </Toggle>
        </div>
        <Button
          variant="icon"
          size="icon"
          className="text-text-secondary hover:text-text-primary"
          aria-label="Help"
          onClick={() => alert("Help: Feature not implemented")}
        >
          <Icons.HelpCircle size={22} />
        </Button>
        <Button
          variant="default"
          size="icon"
          className="bg-accent-blue hover:bg-blue-600 text-white rounded-full w-8 h-8 text-sm"
          aria-label="User Menu"
          onClick={() => alert("User Menu: Feature not implemented")}
        >
          T
        </Button>
      </div>
    </header>
  );
}
