// src/components/viewer/UploadDicom.tsx
"use client";
import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Icons } from "../../components/ui/icons";
import { useDicomStore } from "../../store/dicomStore";
import { Button } from "../../components/ui/button";

const SAMPLE_DICOM_PATH = "/sample.dcm"; // Path relative to the public folder

export function UploadDicom() {
  const { uploadDicomFile, isLoading, error } = useDicomStore();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles && acceptedFiles.length > 0) {
        await uploadDicomFile(acceptedFiles[0]);
      }
    },
    [uploadDicomFile],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/dicom": [".dcm"] },
    multiple: false,
  });

  const loadSampleDicom = async () => {
    // Clear any previous error when attempting to load sample
    useDicomStore.setState({ error: null });
    try {
      const response = await fetch(SAMPLE_DICOM_PATH);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch sample DICOM: ${response.status} ${response.statusText}`,
        );
      }
      const blob = await response.blob();
      const file = new File([blob], "sample.dcm", {
        type: "application/dicom",
      });
      await uploadDicomFile(file);
    } catch (err) {
      console.error("Failed to load sample DICOM:", err);
      let errorMessage = "Failed to load sample.dcm.";
      if (err instanceof Error) {
        errorMessage += ` Details: ${err.message}`;
      }
      useDicomStore.setState({ error: errorMessage, isLoading: false });
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-primary-dark text-text-primary">
      <div
        {...getRootProps()}
        className={`w-full max-w-md p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                    ${isDragActive ? "border-accent-blue bg-secondary-dark/30" : "border-border-dark hover:border-accent-blue/70"}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center text-center">
          <Icons.UploadCloud
            size={48}
            className={`mb-4 ${isDragActive ? "text-accent-blue" : "text-text-secondary"}`}
          />
          {isDragActive ? (
            <p className="text-lg font-semibold text-accent-blue">
              Drop the DICOM file here ...
            </p>
          ) : (
            <>
              <p className="text-lg font-semibold">
                Drag & drop a .dcm file here
              </p>
              <p className="text-sm text-text-secondary my-2">or</p>
              <Button
                variant="secondary"
                size="sm"
                disabled={isLoading}
                onClick={(e) => e.stopPropagation()} // Prevent dropzone activation
                // This button is inside the dropzone, if we don't want it to trigger file dialog,
                // we might need to take it out or handle event propagation.
                // For simplicity, a direct click on the dropzone area will open the dialog.
              >
                Click to select file
              </Button>
            </>
          )}
        </div>
      </div>
      {isLoading && (
        <p className="mt-4 text-sm animate-pulse text-accent-blue">
          Uploading and processing...
        </p>
      )}
      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      <div className="mt-8 text-center">
        <p className="text-sm text-text-secondary mb-2">
          Alternatively, you can load a sample:
        </p>
        <Button
          onClick={loadSampleDicom}
          disabled={isLoading}
          variant="outline"
          className="border-accent-blue text-accent-blue hover:bg-accent-blue/10 hover:text-accent-blue"
        >
          Load Sample DICOM (sample.dcm)
        </Button>
      </div>
    </div>
  );
}
