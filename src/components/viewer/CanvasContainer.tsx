import React from "react";
import { DicomCanvas } from "./DicomCanvas";

export function CanvasContainer() {
  return (
    <main className="flex-1 bg-black overflow-hidden">
      <DicomCanvas />
    </main>
  );
}
