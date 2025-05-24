from typing import List, Optional, Tuple

from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float
    label: str
    confidence: Optional[float] = None


class DetectionResult(BaseModel):
    boxes: List[BoundingBox] = Field(default_factory=list)


class SegmentationContour(BaseModel):
    points: List[Tuple[float, float]]  # List of (x, y) points for a single contour
    label: Optional[str] = "Tooth"  # Or other relevant label


class SegmentationResult(BaseModel):
    contours: List[SegmentationContour] = Field(default_factory=list)


class ClassificationPrediction(BaseModel):
    label: str
    confidence: Optional[float] = None  # If your model provides it


class ClassificationResult(BaseModel):
    predictions: List[ClassificationPrediction] = Field(default_factory=list)


# A generic AI result model that can hold any of the above
class AiAnalysisResult(BaseModel):
    detection: Optional[DetectionResult] = None
    segmentation: Optional[SegmentationResult] = None
    classification: Optional[ClassificationResult] = None
    model_type: str  # e.g., "detection", "segmentation", "classification"
