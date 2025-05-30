// src/components/viewer/MetadataEditor.tsx
"use client";
import React from "react";
import { useDicomStore } from "../../store/dicomStore";
import { useToolStore } from "../../store/toolStore";
import { DicomMeta } from "../../types";
import { Button } from "../ui/button"; // Assuming you have this
import { Icons } from "../ui/icons"; // Assuming you have this

// Define which fields are editable and their display names/types
const EDITABLE_METADATA_CONFIG: Array<{
  key: keyof DicomMeta;
  label: string;
  type: "text" | "number" | "date";
}> = [
  { key: "patient_id", label: "Patient ID", type: "text" },
  { key: "study_date", label: "Study Date (YYYYMMDD)", type: "text" }, // Or use a date picker component
  { key: "modality", label: "Modality", type: "text" },
  { key: "window_center", label: "Window Center", type: "number" },
  { key: "window_width", label: "Window Width", type: "number" },
  // Add more fields as needed, e.g., PatientName, PatientSex, StudyDescription, etc.
  // Be careful with complex types like pixel_spacing (array)
];

export function MetadataEditor() {
  const { dicomData } = useDicomStore();
  const {
    editedDicomMeta,
    updateEditedMetadataField,
    initializeEditedMetadata,
    toggleMetadataEditor, // To close the editor
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
            <Icons.ChevronLeft size={18} /> {/* Or a close icon */}
          </Button>
        </div>
        <p className="text-xs text-text-secondary">
          Load a DICOM image to edit metadata.
        </p>
      </div>
    );
  }

  const originalMeta = dicomData.meta;

  const handleChange = (fieldKey: keyof DicomMeta, value: string) => {
    const config = EDITABLE_METADATA_CONFIG.find((f) => f.key === fieldKey);
    let processedValue: string | number | null | (string | number)[] = value;

    if (config?.type === "number") {
      if (value === "") {
        processedValue = null; // Allow clearing number fields
      } else {
        const num = parseFloat(value);
        processedValue = isNaN(num)
          ? (editedDicomMeta?.[fieldKey] ?? null)
          : num; // Keep current if invalid
      }
    }
    // Add more specific processing for dates or other types if needed
    updateEditedMetadataField(fieldKey, processedValue);
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
          <Icons.ChevronLeft size={18} /> {/* Or a close icon X */}
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
              type={type === "number" ? "number" : "text"}
              id={`meta-${key}`}
              value={
                editedDicomMeta[key] === null ||
                editedDicomMeta[key] === undefined
                  ? ""
                  : String(editedDicomMeta[key])
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
        {/* "Apply" button might be for saving to a more permanent pending state if needed,
            or this editor directly modifies the `editedDicomMeta` used for export.
            For now, changes are live in `editedDicomMeta`.
        */}
      </div>
    </div>
  );
}
