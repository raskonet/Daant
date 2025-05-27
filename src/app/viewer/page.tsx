// src/app/viewer/page.tsx
"use client";

import { CanvasContainer } from "../../components/viewer/CanvasContainer";
import { UploadDicom } from "../../components/viewer/UploadDicom";
import { useDicomStore } from "../../store/dicomStore";
import { useEffect } from "react";
// import { useToolStore } from "../../store/toolStore"; // No longer needed for aiError here

export default function ViewerPage() {
  const { dicomData, isLoading, error: dicomError } = useDicomStore();
  // const { aiError } = useToolStore(); // REMOVE: aiError will be handled within AiViewerControls

  const fetchDicomData = useDicomStore((state) => state.fetchDicomData);
  useEffect(() => {
    if (!dicomData && !isLoading) {
      //    fetchDicomData("your-sample-dicom-id-if-preloaded-on-backend");
    }
  }, [dicomData, isLoading, fetchDicomData]);

  // Condition 1: No DICOM data and not loading (show upload)
  if (!dicomData && !isLoading && !dicomError) {
    return <UploadDicom />;
  }

  // Condition 2: DICOM loading error (show full page error for DICOM issues)
  if (dicomError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-primary-dark text-text-primary">
        <p className="text-red-500">DICOM Upload/Fetch Error: {dicomError}</p>
        <p className="text-sm mt-2">
          Please try uploading the file again or check the console for more
          details.
        </p>
      </div>
    );
  }

  // Condition 3: DICOM data is loaded (or currently loading but no error yet)
  // Show the canvas. AI errors will be handled by AiViewerControls in the right panel.
  // isLoading (for DICOM) will be handled by DicomCanvas itself showing a loader.
  return <CanvasContainer />;
}
