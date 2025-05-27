"use client";
import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Icons } from "../../components/ui/icons";
import { useDicomStore } from "../../store/dicomStore";
import { Button } from "../../components/ui/button";

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
              <Button variant="secondary" size="sm" disabled={isLoading}>
                Click to select file
              </Button>
            </>
          )}
        </div>
      </div>
      {isLoading && <p className="mt-4 text-sm">Uploading and processing...</p>}
      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
      <div className="mt-6 text-xs text-text-secondary">
        Use the sample .dcm file if you have one.
      </div>
    </div>
  );
}
