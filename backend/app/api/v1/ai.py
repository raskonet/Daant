from fastapi import APIRouter, HTTPException, Path

from app.models.ai_results import AiAnalysisResult
from app.services.ai_service import process_image_with_ai

router = APIRouter()

VALID_MODEL_TYPES = ["detection", "segmentation", "classification"]


@router.post("/dicom/{dicom_id}/ai/{model_type}", response_model=AiAnalysisResult)
async def analyze_dicom_image(
    dicom_id: str = Path(..., description="The ID of the DICOM image to analyze"),
    model_type: str = Path(
        ..., description="Type of AI model to run (e.g., 'detection', 'segmentation')"
    ),
):
    if model_type not in VALID_MODEL_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model_type. Valid types are: {VALID_MODEL_TYPES}",
        )
    try:
        ai_result = await process_image_with_ai(dicom_id, model_type)
        return ai_result
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=f"AI Model file error: {e}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Log the full error for debugging
        print(f"Unhandled AI processing error: {e}")
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred during AI processing: {type(e).__name__}",
        )
