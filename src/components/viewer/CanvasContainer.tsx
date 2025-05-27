import React from "react";
// import { DicomCanvas } from "./DicomCanvas";

import dynamic from "next/dynamic";

const DicomCanvasWithNoSSR = dynamic(
  () => import("./DicomCanvas").then((mod) => mod.DicomCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <p className="text-text-primary">Loading Canvas...</p>
      </div>
    ),
  },
);

export function CanvasContainer() {
  return (
    <main className="flex-1 bg-black overflow-hidden flex flex-col">
      {" "}
      {/* Ensure main can fill height if DicomCanvas is also flex-1 */}
      <DicomCanvasWithNoSSR />
    </main>
  );
}
