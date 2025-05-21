import base64
import io
import uuid
from typing import Optional

import numpy as np
from fastapi import UploadFile
from PIL import Image
from pydicom import dcmread

from app.models.dicom_meta import DicomMeta
from app.models.image_payload import ImagePayload
from app.util.image_utils import _to_png

_memory_store: dict[str, ImagePayload] = {}


async def save_and_parse(file: UploadFile) -> str:
    data = await file.read()
    ds = dcmread(io.BytesIO(data))

    arr = ds.pixel_array

    png_bytes = _to_png(arr, ds)
    png_b64 = base64.b64encode(png_bytes).decode("ascii")
    wc = None
    ww = None
    raw_wc = getattr(ds, "WindowCenter", None)
    raw_ww = getattr(ds, "WindowWidth", None)
    if raw_wc and raw_ww:
        wc = float(raw_wc[0]) if isinstance(raw_wc, (list, tuple)) else float(raw_wc)
        ww = float(raw_ww[0]) if isinstance(raw_ww, (list, tuple)) else float(raw_ww)

    meta = DicomMeta(
        patient_id=ds.get("PatientID", ""),
        study_date=str(ds.get("StudyDate", "")),
        modality=ds.get("Modality", ""),
        pixel_spacing=list(ds.get("PixelSpacing", [1.0, 1.0])),
        window_center=wc,
        window_width=ww,
        rows=int(ds.Rows),
        columns=int(ds.Columns),
    )

    payload = ImagePayload(png_data=png_b64, meta=meta)
    dicom_id = str(uuid.uuid4())
    _memory_store[dicom_id] = payload
    return dicom_id


async def get_image_payload(dicom_id: str) -> Optional[ImagePayload]:
    return _memory_store.get(dicom_id)
