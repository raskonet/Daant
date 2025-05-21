from pydantic import BaseModel


class DicomMeta(BaseModel):
    patient_id: str
    study_date: str
    modality: str
    pixel_spacing: list[float]
    window_center: float | None
    window_width: float | None
    rows: int
    columns: int
