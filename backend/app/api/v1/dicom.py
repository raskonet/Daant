from app.models.image_payload import ImagePayload
from app.services.dicom_service import get_image_payload, get_raw_dicom_bytes
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

router = APIRouter()


@router.get("/dicom/{dicom_id}", response_model=ImagePayload)
async def fetch_dicom(dicom_id: str):
    payload = await get_image_payload(dicom_id)
    if not payload:
        raise HTTPException(404, "DICOM not found")
    return payload


@router.get("/dicom/{dicom_id}/download_original", response_class=Response)
async def download_original_dicom_file(dicom_id: str):
    dicom_bytes = await get_raw_dicom_bytes(dicom_id)
    if not dicom_bytes:
        raise HTTPException(status_code=404, detail="Original DICOM file not found")

    filename = f"{dicom_id}_original.dcm"
    return Response(
        content=dicom_bytes,
        media_type="application/dicom",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
