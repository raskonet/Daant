// src/components/viewer/RightPanel.tsx
import React from "react";
import { ImageToolsBar } from "./ImageToolsBar";
import { AiViewerControls } from "./AiViewerControls";
import { MetadataEditor } from "./MetadataEditor"; // NEW
import { TooltipProvider } from "../../components/ui/tooltip";
import { useToolStore } from "../../store/toolStore"; // NEW

export function RightPanel() {
  const showMetadataEditor = useToolStore(
    (state) => state.toolUIState.showMetadataEditor,
  ); // NEW

  return (
    <TooltipProvider delayDuration={100}>
      {/* Adjust width if metadata editor is a third column or replaces AI panel */}
      <aside className="flex">
        <ImageToolsBar />
        {showMetadataEditor ? ( // NEW: Conditional rendering
          <MetadataEditor />
        ) : (
          <AiViewerControls />
        )}
      </aside>
    </TooltipProvider>
  );
}
