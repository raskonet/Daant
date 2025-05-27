// src/components/ui/icons.tsx
import {
  ChevronLeft,
  UploadCloud,
  Printer,
  HelpCircle,
  UserCircle,
  Settings2,
  Eye,
  Edit3,
  Maximize,
  Minus,
  Plus,
  ChevronsUpDown,
  Sun,
  Contrast,
  ZoomIn,
  ShieldCheck,
  MessageSquare,
  Square,
  CheckSquare,
  Palette,
  ListFilter,
  GitCompareArrows, // For Flip and FlipHorizontal
  RotateCw, // For Rotate
  Maximize2, // For Fullscreen/crop related, Fit to Screen
  Share2, // For Share/connect related
  ShieldAlert, // Placeholder for some AI finding
  Image,
  PenTool, // Using PenTool as a substitute for Highlighter
  Type, // Lucide icon for text
  Ruler, // Lucide icon
  Trash2, // Lucide icon
  RotateCcw, // Lucide icon for undo or rotate counter-clockwise
  RefreshCw, // For Reset View
  // Import Highlighter from lucide-react if you intend to use it directly
  // under a different key, or if PenTool is not the intended substitute.
  // For now, assuming PenTool is the substitute for the key 'Highlighter'.
  // Highlighter as LucideHighlighter, (if you need it under a different name)
} from "lucide-react";

export const Icons = {
  ChevronLeft,
  UploadCloud,
  Printer,
  Highlighter: PenTool, // Key 'Highlighter' uses PenTool. This was one of the conflicting points.
  HelpCircle,
  UserCircle,
  Settings2,
  Eye,
  Edit3,
  Maximize,
  Minus,
  Plus,
  ChevronsUpDown,
  Sun,
  Contrast,
  ZoomIn,
  ShieldCheck,
  MessageSquare,
  Square,
  CheckSquare,
  Palette, // Placeholder for "Tooth Parts"
  ListFilter, // Placeholder for Pathology type filter
  Flip: GitCompareArrows,
  Rotate: RotateCw,
  Crop: Maximize2, // Value for 'Crop' is Maximize2 icon
  Connect: Share2,
  Alert: ShieldAlert,
  Image,
  RotateCw, // Key 'RotateCw' uses imported RotateCw. This is fine.
  FlipHorizontal: GitCompareArrows,
  FlipVertical: GitCompareArrows,
  Maximize2, // Key 'Maximize2' uses imported Maximize2 (for "Fit to Screen")
  Type, // Key 'Type' uses imported Type
  // The second 'Highlighter,' entry that caused a duplicate key is removed.
  Ruler, // Key 'Ruler' uses imported Ruler
  Trash2,
  RotateCcw, // Used for Undo
  RefreshCw, // Used for Reset View
};
