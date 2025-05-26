"use client";
import { CanvasContainer } from "@/components/viewer/CanvasContainer";
import { UploadDicom } from "@/components/viewer/UploadDicom";
import { useDicomStore } from "@/store/dicomStore";
import { useEffect } from "react";

export default function ViewerPage() {
  const { dicomData, isLoading } = useDicomStore();

  const fetchDicomData = useDicomStore((state) => state.fetchDicomData);
  useEffect(() => {
    if (!dicomData && !isLoading) {
      //    fetchDicomData("your-sample-dicom-id-if-preloaded-on-backend");
    }
  }, [dicomData, isLoading, fetchDicomData]);

  if (!dicomData && !isLoading) {
    return <UploadDicom />;
  }
  return <CanvasContainer />;
}
