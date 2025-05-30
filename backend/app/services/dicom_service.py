import base64
import io
import uuid
from typing import Any, Dict, Optional

import pydicom
from app.models.dicom_meta import DicomMeta
from app.models.image_payload import ImagePayload
from app.util.image_utils import _to_png
from fastapi import UploadFile
from pydicom import dcmread

_memory_store: dict[str, ImagePayload] = {}
_raw_dicom_store: dict[str, bytes] = {}


async def save_and_parse(file: UploadFile) -> str:
    data = await file.read()
    dicom_id = str(uuid.uuid4())
    _raw_dicom_store[dicom_id] = data

    ds = dcmread(io.BytesIO(data))
    arr = ds.pixel_array
    png_bytes = _to_png(arr, ds)
    png_b64 = base64.b64encode(png_bytes).decode("ascii")

    wc = None
    ww = None
    raw_wc = getattr(ds, "WindowCenter", None)
    raw_ww = getattr(ds, "WindowWidth", None)

    if raw_wc is not None:
        wc = (
            float(raw_wc[0])
            if isinstance(raw_wc, pydicom.multival.MultiValue)
            else float(raw_wc)
        )
    if raw_ww is not None:
        ww = (
            float(raw_ww[0])
            if isinstance(raw_ww, pydicom.multival.MultiValue)
            else float(raw_ww)
        )

    meta = DicomMeta(
        patient_id=str(ds.get("PatientID", "N/A")),
        study_date=str(ds.get("StudyDate", "")),
        modality=str(ds.get("Modality", "N/A")),
        pixel_spacing=list(ds.get("PixelSpacing", [1.0, 1.0])),
        window_center=wc,
        window_width=ww,
        rows=int(ds.Rows),
        columns=int(ds.Columns),
    )

    payload = ImagePayload(png_data=png_b64, meta=meta)
    _memory_store[dicom_id] = payload
    return dicom_id


async def get_image_payload(dicom_id: str) -> Optional[ImagePayload]:
    return _memory_store.get(dicom_id)


async def get_raw_dicom_bytes(dicom_id: str) -> Optional[bytes]:
    return _raw_dicom_store.get(dicom_id)


async def create_modified_dicom_with_meta(
    original_dicom_id: str, metadata_updates: Dict[str, Any]
) -> Optional[bytes]:
    original_bytes = await get_raw_dicom_bytes(original_dicom_id)
    if not original_bytes:
        return None

    ds = pydicom.dcmread(io.BytesIO(original_bytes))

    tag_map = {
        "patient_id": "PatientID",
        "study_date": "StudyDate",
        "modality": "Modality",
        "window_center": "WindowCenter",
        "window_width": "WindowWidth",
    }

    for key, value in metadata_updates.items():
        tag_name = tag_map.get(key)
        if tag_name and hasattr(ds, tag_name):
            if value is not None:
                if isinstance(ds[tag_name].value, pydicom.multival.MultiValue):
                    ds[tag_name].value = [value]
                else:
                    ds[tag_name].value = value
            else:
                del ds[tag_name]

    ds.SOPInstanceUID = pydicom.uid.generate_uid()

    buffer = io.BytesIO()
    pydicom.dcmwrite(buffer, ds, write_like_original=False)
    buffer.seek(0)
    return buffer.read()
