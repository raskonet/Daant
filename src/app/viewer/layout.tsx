// src/app/viewer/layout.tsx
"use client";

import React from "react";
import { Header } from "@/components/viewer/Header";
import { LeftNavButton } from "@/components/viewer/LeftNavButton";
import { RightPanel } from "@/components/viewer/RightPanel";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function ViewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={100}>
      <div className="h-full w-full flex flex-col overflow-hidden bg-primary-dark">
        {" "}
        {/* Added bg here, can be on body too */}
        <Header />
        <div className="flex flex-row flex-1 overflow-hidden">
          {" "}
          {/* This row takes remaining height */}
          <LeftNavButton />
          {/* MAIN CONTENT AREA: Make it a flex column to allow its child to take full height */}
          <main className="flex-1 bg-black relative flex flex-col overflow-hidden">
            {" "}
            {/* Key changes: flex flex-col */}
            {children}
          </main>
          <RightPanel />
        </div>
      </div>
    </TooltipProvider>
  );
}
