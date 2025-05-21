from fastapi import APIRouter, HTTPException, UploadFile

from app.services.dicom_service import save_and_parse

router = APIRouter()


@router.post("/upload", response_model=str)
async def upload_dicom(file: UploadFile):
    if file.content_type != "application/dicom":
        raise HTTPException(400, "Only DICOM files allowed")
    dicom_id = await save_and_parse(file)
    return dicom_id
