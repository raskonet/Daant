from fastapi import APIRouter, HTTPException

from app.models.image_payload import ImagePayload
from app.services.dicom_service import get_image_payload

router = APIRouter()


@router.get("/dicom/{dicom_id}", response_model=ImagePayload)
async def fetch_dicom(dicom_id: str):
    payload = await get_image_payload(dicom_id)
    if not payload:
        raise HTTPException(404, "DICOM not found")
    return payload
