from app.models.ai_results import AiAnalysisResult
from app.services.ai_service import process_image_with_ai
from fastapi import APIRouter, HTTPException, Path

router = APIRouter()

VALID_MODEL_TYPES = ["detection"]


@router.post("/dicom/{dicom_id}/ai/{model_type}", response_model=AiAnalysisResult)
async def analyze_dicom_image(
    dicom_id: str = Path(..., description="The ID of the DICOM image to analyze"),
    model_type: str = Path(
        ...,
        description="Type of AI model to run (e.g., 'detection')",
    ),
):
    if model_type not in VALID_MODEL_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model_type. Valid type is: {VALID_MODEL_TYPES[0]}",
        )
    try:
        ai_result = await process_image_with_ai(dicom_id, model_type)
        return ai_result
    except FileNotFoundError as e:
        print(f"--- API ERROR: File/Model error in ai.py (Roboflow path), {e}")
        raise HTTPException(status_code=500, detail=f"AI Model/file error: {e}") from e
    except ValueError as e:
        print(f"--- API ERROR: Value error in ai.py (Roboflow path), {e}")
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        print(f"--- API ERROR: Runtime error from AI service (Roboflow path), {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e
    except ImportError as e:
        print(f"--- API ERROR: Import error in ai.py (Roboflow path), {e}")
        raise HTTPException(
            status_code=500,
            detail="AI processing dependency is missing or unavailable.",
        ) from e
    except Exception as e:
        print(f"--- UNHANDLED API processing error (Roboflow path): {e}")
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred during AI processing: {type(e).__name__}",
        ) from e
