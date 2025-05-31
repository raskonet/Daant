"use client";
import React from "react";
import { useDicomStore } from "../../store/dicomStore";
import { useToolStore } from "../../store/toolStore";
import { DicomMeta } from "../../types";
import { Button } from "../ui/button";
import { Icons } from "../ui/icons";

// Define which fields are editable and their display names/types
const EDITABLE_METADATA_CONFIG: Array<{
  key: keyof DicomMeta;
  label: string;
  type: "text" | "number" | "date" | "pixel_spacing"; // Added "pixel_spacing" type
}> = [
  { key: "patient_id", label: "Patient ID", type: "text" },
  { key: "study_date", label: "Study Date (YYYYMMDD)", type: "text" },
  { key: "modality", label: "Modality", type: "text" },
  { key: "window_center", label: "Window Center", type: "number" },
  { key: "window_width", label: "Window Width", type: "number" },
  {
    key: "pixel_spacing",
    label: "Pixel Spacing (e.g., 0.5,0.5)",
    type: "pixel_spacing",
  },
  // Add 'rows', 'columns' here if they are user-editable and part of RELEVANT_METADATA_FIELDS_FOR_EDITING in store
  // { key: "rows", label: "Rows", type: "number" },
  // { key: "columns", label: "Columns", type: "number" },
];

export function MetadataEditor() {
  const { dicomData } = useDicomStore();
  const {
    editedDicomMeta,
    updateEditedMetadataField,
    initializeEditedMetadata,
    toggleMetadataEditor,
  } = useToolStore();

  if (!dicomData || !dicomData.meta || !editedDicomMeta) {
    return (
      <div className="w-64 bg-primary-dark text-text-primary flex flex-col shrink-0 h-full p-3 border-l border-border-dark">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Metadata</h2>
          <Button
            variant="icon"
            size="icon"
            onClick={toggleMetadataEditor}
            className="text-text-secondary"
          >
            <Icons.ChevronLeft size={18} />
          </Button>
        </div>
        <p className="text-xs text-text-secondary">
          Load a DICOM image to edit metadata.
        </p>
      </div>
    );
  }

  const originalMeta = dicomData.meta;

  const handleChange = (fieldKey: keyof DicomMeta, inputValue: string) => {
    const config = EDITABLE_METADATA_CONFIG.find((f) => f.key === fieldKey);

    // This is the type expected by the store's updateEditedMetadataField action
    let valueForStore: string | number | null | [number, number];

    if (config?.type === "number") {
      if (inputValue === "") {
        valueForStore = null;
      } else {
        const num = parseFloat(inputValue);
        // If parsing fails, keep the existing valid value from the store or null
        valueForStore = isNaN(num)
          ? ((editedDicomMeta?.[fieldKey] as number | null) ?? null)
          : num;
      }
    } else if (
      config?.type === "pixel_spacing" &&
      fieldKey === "pixel_spacing"
    ) {
      const parts = inputValue
        .split(",")
        .map((part) => parseFloat(part.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        valueForStore = [parts[0], parts[1]]; // Assign as [number, number]
      } else {
        // If input string is not a valid "num,num" format,
        // fall back to the current value in the store or a default valid tuple.
        const currentStoreValue = editedDicomMeta?.[fieldKey];
        if (
          Array.isArray(currentStoreValue) &&
          currentStoreValue.length === 2 &&
          typeof currentStoreValue[0] === "number" &&
          typeof currentStoreValue[1] === "number"
        ) {
          valueForStore = currentStoreValue as [number, number];
        } else {
          valueForStore = [0, 0]; // Fallback default if current is also bad or undefined
        }
      }
    } else {
      // "text", "date" (as text), or other unhandled DicomMeta fields
      valueForStore = inputValue; // Assign as string
    }

    // Line 72 (or around there depending on exact line numbers)
    updateEditedMetadataField(fieldKey, valueForStore);
  };

  const handleResetToOriginal = () => {
    initializeEditedMetadata(originalMeta);
  };

  return (
    <div className="w-64 bg-primary-dark text-text-primary flex flex-col shrink-0 h-full p-3 border-l border-border-dark">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Edit Metadata</h2>
        <Button
          variant="icon"
          size="icon"
          onClick={toggleMetadataEditor}
          className="text-text-secondary"
        >
          <Icons.ChevronLeft size={18} />
        </Button>
      </div>
      <div className="flex-grow overflow-y-auto space-y-3 pr-1">
        {EDITABLE_METADATA_CONFIG.map(({ key, label, type }) => (
          <div key={key}>
            <label
              htmlFor={`meta-${key}`}
              className="block text-xs font-medium text-text-secondary capitalize"
            >
              {label}
            </label>
            <input
              type={type === "number" ? "number" : "text"} // Input type remains text for pixel_spacing
              id={`meta-${key}`}
              value={
                editedDicomMeta[key] === null ||
                editedDicomMeta[key] === undefined
                  ? ""
                  : String(editedDicomMeta[key]) // Converts [0.1, 0.2] to "0.1,0.2" for display
              }
              onChange={(e) => handleChange(key, e.target.value)}
              className="mt-0.5 block w-full px-2 py-1.5 bg-secondary-dark border border-border-dark rounded-md shadow-sm focus:outline-none focus:ring-accent-blue focus:border-accent-blue sm:text-xs"
              placeholder={
                originalMeta[key] === null || originalMeta[key] === undefined
                  ? "N/A"
                  : String(originalMeta[key])
              }
              step={type === "number" ? "any" : undefined}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-border-dark">
        <Button
          onClick={handleResetToOriginal}
          variant="outline"
          size="sm"
          className="w-full"
        >
          Reset to Original Values
        </Button>
      </div>
    </div>
  );
}
