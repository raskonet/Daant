# backend/app/api/v1/report.py
from typing import Any, Dict, List

from fastapi import APIRouter, Body, HTTPException, Path
from pydantic import BaseModel

from app.services.dicom_service import get_image_payload
from app.services.llm_service import generate_diagnostic_report

router = APIRouter()


class ReportRequestPayload(BaseModel):
    # This will be a list of dictionaries, where each dict is a parsed BoundingBox
    # from the frontend's aiAnnotations.detections state.
    # It will have x1,y1,x2,y2,label,confidence (already processed by backend and then frontend)
    parsed_roboflow_annotations: List[Dict[str, Any]]


@router.post("/dicom/{dicom_id}/diagnostic_report", response_model=str)
async def create_diagnostic_report_endpoint(  # Renamed to avoid conflict
    dicom_id: str = Path(..., description="The ID of the DICOM image"),
    payload: ReportRequestPayload = Body(...),
):
    image_data_payload = await get_image_payload(dicom_id)
    if not image_data_payload:
        raise HTTPException(
            status_code=404, detail="DICOM image not found for report generation."
        )

    dicom_meta = image_data_payload.meta

    try:
        # The llm_service expects a list of dicts representing parsed annotations
        report = await generate_diagnostic_report(
            dicom_meta, payload.parsed_roboflow_annotations
        )
        return report
    except Exception as e:
        print(
            f"--- API ERROR: Error generating diagnostic report for DICOM ID {dicom_id}: {e}"
        )
        traceback.print_exc()
        raise HTTPException(
            status_code=500, detail=f"Failed to generate diagnostic report: {str(e)}"
        )
