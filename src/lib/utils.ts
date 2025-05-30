// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  // This one is exported
  return twMerge(clsx(inputs));
}

export function downloadFile(
  dataUrlOrObjectUrl: string,
  filename: string,
  mimeType?: string,
) {
  const link = document.createElement("a");
  link.href = dataUrlOrObjectUrl;
  link.download = filename;
  if (mimeType) {
    link.type = mimeType;
  }
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (dataUrlOrObjectUrl.startsWith("blob:")) {
    URL.revokeObjectURL(dataUrlOrObjectUrl);
  }
}
