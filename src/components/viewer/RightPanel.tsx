import React from "react";
import { ImageToolsBar } from "./ImageToolsBar";
import { AiViewerControls } from "./AiViewerControls";
import { TooltipProvider } from "@/components/ui/tooltip";

export function RightPanel() {
  return (
    <TooltipProvider delayDuration={100}>
      <aside className="flex w-[calc(3.5rem+16rem)]">
        {" "}
        {/* 14 (tools) + 256 (ai panel) = 320px / 80 rem */}
        <ImageToolsBar />
        <AiViewerControls />
      </aside>
    </TooltipProvider>
  );
}
