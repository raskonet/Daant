from app.models.dicom_updates import DicomMetadataUpdatePayload
from app.models.image_payload import ImagePayload
from app.services.dicom_service import (
    create_modified_dicom_with_meta,
    get_image_payload,
    get_raw_dicom_bytes,
)
from fastapi import APIRouter, Body, HTTPException
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


@router.post("/dicom/{dicom_id}/export_modified", response_class=Response)
async def export_modified_dicom_file(
    dicom_id: str, payload: DicomMetadataUpdatePayload = Body(...)
):
    modified_dicom_bytes = await create_modified_dicom_with_meta(
        original_dicom_id=dicom_id, metadata_updates=payload.updates
    )

    if not modified_dicom_bytes:
        raise HTTPException(
            status_code=404,
            detail="Could not generate modified DICOM. Original might be missing or an error occurred.",
        )

    filename = f"{dicom_id}_modified.dcm"
    return Response(
        content=modified_dicom_bytes,
        media_type="application/dicom",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
