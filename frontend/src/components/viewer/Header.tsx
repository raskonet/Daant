// frontend/src/components/viewer/Header.tsx
"use client";
import React, { useState } from "react";
import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { useDicomStore } from "@/store/dicomStore";
import { useToolStore } from "@/store/toolStore";
// import { shallow } from 'zustand/shallow'; // Only needed if using the shallow comparison alternative

export function Header() {
  const dicomData = useDicomStore((state) => state.dicomData);
  const resetDicomStore = useDicomStore((state) => state.resetState);

  // MODIFIED: Changed to individual selectors for useToolStore
  const undoLastAction = useToolStore((state) => state.undoLastAction);
  const canUndo = useToolStore((state) => state.canUndo);
  const getCanvasAsDataURL = useToolStore((state) => state.getCanvasAsDataURL);

  // Alternative using shallow (if you prefer to group them and have shallow imported):
  // const { undoLastAction, canUndo, getCanvasAsDataURL } = useToolStore(
  //   (state) => ({
  //     undoLastAction: state.undoLastAction,
  //     canUndo: state.canUndo,
  //     getCanvasAsDataURL: state.getCanvasAsDataURL,
  //   }),
  //   shallow
  // );

  const [fmxOn, setFmxOn] = useState(true);
  const [phiOn, setPhiOn] = useState(true);

  const handleBackButtonClick = () => {
    if (canUndo()) {
      // canUndo is now a direct boolean value from the store
      undoLastAction();
    } else {
      resetDicomStore();
    }
  };

  const handlePrint = () => {
    if (getCanvasAsDataURL) {
      // getCanvasAsDataURL is now directly the function or null
      const dataURL = getCanvasAsDataURL();
      if (dataURL) {
        const link = document.createElement("a");
        let filename = "dicom-export";
        if (dicomData) {
          if (
            phiOn &&
            dicomData.patientName &&
            dicomData.patientName !== "Unknown Patient"
          ) {
            filename += `_${dicomData.patientName.replace(/\s+/g, "_")}`;
          }
          let dateStr =
            dicomData.studyDate || new Date().toLocaleDateString("en-CA");
          if (
            typeof dicomData.studyDate === "string" &&
            !/^\d{4}-\d{2}-\d{2}$/.test(dicomData.studyDate)
          ) {
            try {
              dateStr = new Date(dicomData.studyDate).toLocaleDateString(
                "en-CA",
              );
            } catch (e) {
              /* ignore */
            }
          }
          filename += `_${dateStr}`;
        } else {
          filename += `_${new Date().toLocaleDateString("en-CA")}`;
        }
        link.download = `${filename}.png`;
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        link.remove();
      } else {
        alert(
          "Could not export canvas. Image might not be fully loaded or an error occurred.",
        );
      }
    } else {
      alert("Canvas export function is not available. Is an image loaded?");
    }
  };

  let displayPatientName = "No Patient Loaded";
  if (dicomData) {
    if (!phiOn) {
      displayPatientName = "PHI Masked";
    } else if (dicomData.patientName) {
      if (
        dicomData.patientName.length > 20 &&
        dicomData.patientName !== "Unknown Patient"
      ) {
        displayPatientName = `Patient ID: ...${dicomData.patientName.slice(-8)}`;
      } else {
        displayPatientName = dicomData.patientName;
      }
    } else {
      displayPatientName = "Unknown Patient";
    }
  }

  const studyDate = dicomData?.studyDate || "N/A";
  const isUndoPossible = canUndo(); // Call the function obtained from the store

  return (
    <header className="bg-primary-dark text-text-primary h-16 flex items-center justify-between px-4 border-b border-border-dark shrink-0">
      <div className="flex items-center gap-4">
        <Button
          variant="icon"
          size="icon"
          className="text-text-secondary hover:text-text-primary"
          onClick={handleBackButtonClick}
          aria-label={
            isUndoPossible
              ? "Undo last image change"
              : "Go back and clear image"
          }
          title={
            isUndoPossible
              ? "Undo last image change"
              : "Go back to upload screen"
          }
        >
          <Icons.ChevronLeft size={24} />
        </Button>
        <div className="flex items-center gap-2">
          <Icons.UserCircle size={28} className="text-text-secondary" />
          <span
            className="font-semibold text-lg whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]"
            title={
              dicomData && phiOn ? dicomData.patientName : displayPatientName
            }
          >
            {displayPatientName}
          </span>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <span className="text-sm text-text-secondary">FMX</span>
          <Toggle
            pressed={fmxOn}
            onPressedChange={setFmxOn}
            size="sm"
            className="data-[state=on]:bg-accent-blue data-[state=off]:bg-gray-600 w-12 h-6 p-0.5 rounded-full relative"
            aria-label="Toggle FMX view"
          >
            <div
              className={`bg-white h-5 w-5 rounded-full absolute top-1/2 -translate-y-1/2 transition-transform duration-200 ease-in-out ${fmxOn ? "left-[calc(100%-1.25rem-0.125rem)] -translate-x-full" : "left-[0.125rem]"}`}
            />
          </Toggle>
        </div>
        {fmxOn && (
          <div
            className="flex gap-0.5 bg-secondary-dark p-1 rounded"
            aria-label="FMX tooth selector"
          >
            {[...Array(8)].map((_, i) => (
              <button
                key={`t-${i}`}
                title={`Upper ${i + 1}`}
                aria-label={`Select upper tooth segment ${i + 1}`}
                className={`w-3 h-5 ${i === 3 ? "bg-accent-blue" : "bg-gray-600"} hover:bg-gray-500 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-blue`}
                onClick={() =>
                  console.log(`FMX Upper Segment ${i + 1} clicked`)
                }
              ></button>
            ))}
            <div className="w-1"></div>
            {[...Array(8)].map((_, i) => (
              <button
                key={`b-${i}`}
                title={`Lower ${i + 1}`}
                aria-label={`Select lower tooth segment ${i + 1}`}
                className={`w-3 h-5 ${"bg-gray-600"} hover:bg-gray-500 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-blue`}
                onClick={() =>
                  console.log(`FMX Lower Segment ${i + 1} clicked`)
                }
              ></button>
            ))}
          </div>
        )}
        <div className="ml-4 text-sm bg-secondary-dark px-3 py-1.5 rounded">
          {studyDate}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-text-secondary hover:text-text-primary"
          onClick={() => alert("Feature A: Not implemented")}
        >
          A
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-text-secondary hover:text-text-primary"
          onClick={() => alert("Feature B: Not implemented")}
        >
          B
        </Button>
        <Button
          variant="default"
          size="sm"
          className="bg-accent-blue hover:bg-blue-600 text-white"
          onClick={handlePrint}
          disabled={!dicomData || !getCanvasAsDataURL}
        >
          <Icons.Printer size={18} className="mr-2" />
          Printout
        </Button>
        <div className="flex items-center gap-1">
          <span className="text-xs text-text-secondary">PHI</span>
          <Toggle
            pressed={phiOn}
            onPressedChange={setPhiOn}
            size="sm"
            className="data-[state=on]:bg-accent-blue data-[state=off]:bg-gray-600 w-10 h-5 p-0.5 rounded-full relative"
            aria-label="Toggle PHI visibility"
          >
            <div
              className={`bg-white h-4 w-4 rounded-full absolute top-1/2 -translate-y-1/2 transition-transform duration-200 ease-in-out ${phiOn ? "left-[calc(100%-1rem-0.125rem)] -translate-x-full" : "left-[0.125rem]"}`}
            />
          </Toggle>
        </div>
        <Button
          variant="icon"
          size="icon"
          className="text-text-secondary hover:text-text-primary"
          aria-label="Help"
          onClick={() => alert("Help: Feature not implemented")}
        >
          <Icons.HelpCircle size={22} />
        </Button>
        <Button
          variant="default"
          size="icon"
          className="bg-accent-blue hover:bg-blue-600 text-white rounded-full w-8 h-8 text-sm"
          aria-label="User Menu"
          onClick={() => alert("User Menu: Feature not implemented")}
        >
          T
        </Button>
      </div>
    </header>
  );
}
