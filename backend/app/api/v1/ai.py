# backend/app/api/v1/ai.py
from app.models.ai_results import AiAnalysisResult
from app.services.ai_service import process_image_with_ai
from fastapi import APIRouter, HTTPException, Path

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
    except FileNotFoundError as e:  # e.g. Model file is missing
        print(f"--- API ERROR: Model file error in ai.py, {e}")
        raise HTTPException(status_code=500, detail=f"AI Model file error: {e}") from e
    except ValueError as e:  # e.g. Input data issue
        print(f"--- API ERROR: Value error in ai.py, {e}")
        raise HTTPException(status_code=400, detail=str(e)) from e
    except ImportError as e:  # Catch ImportError (e.g., TensorFlow not found)
        print(f"--- API ERROR: Import error in ai.py, {e}")
        raise HTTPException(
            status_code=500,
            detail="AI processing is temporarily unavailable. Please try again later.",
        ) from e
    except Exception as e:  # Catch other errors.
        # Log the full error for debugging
        print(f"--- UNHANDLED API processing error: {e}")
        import traceback

        traceback.print_exc()  # VERY IMPORTANT - log the full traceback
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred during AI processing: {type(e).__name__}",
        ) from e
