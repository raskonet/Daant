from pydantic import BaseModel

from app.models.dicom_meta import DicomMeta


class ImagePayload(BaseModel):
    png_data: str
    meta: DicomMeta
