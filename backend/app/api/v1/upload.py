import traceback

# Import DicomParsingError from the service
from app.services.dicom_service import DicomParsingError, save_and_parse
from fastapi import APIRouter, HTTPException, UploadFile

router = APIRouter()


@router.post("/upload", response_model=str)
async def upload_dicom(file: UploadFile):
    # Basic content type check (already present, good)
    if not file.content_type or not file.content_type.lower() == "application/dicom":
        # A more robust check might involve sniffing first few bytes if content_type is unreliable
        print(
            f"--- API UPLOAD REJECTED: Invalid content type '{file.content_type}' for file '{file.filename}'."
        )
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{file.content_type}'. Only DICOM files (application/dicom) are allowed.",
        )

    print(
        f"--- API UPLOAD: Received file '{file.filename}' (content type: '{file.content_type}'). Attempting to process."
    )
    try:
        dicom_id = await save_and_parse(file)
        print(
            f"--- API UPLOAD: Successfully processed file '{file.filename}', DICOM ID: {dicom_id}"
        )
        return dicom_id
    except DicomParsingError as e_parse:
        # This error comes from our service layer, means something went wrong during parsing/processing
        print(
            f"--- API UPLOAD ERROR: DicomParsingError for file '{file.filename}': {e_parse}"
        )
        # The service layer should have already logged the full traceback
        raise HTTPException(
            status_code=422,  # Unprocessable Entity - good for content errors
            detail=f"Failed to process DICOM file: {str(e_parse)}",
        )
    except HTTPException:
        # Re-raise HTTPExceptions if they are intentionally raised (e.g. from file.read() if too large, etc.)
        raise
    except Exception as e_unexpected:
        # Catch any other truly unexpected errors
        print(
            f"--- API UPLOAD CRITICAL ERROR: Unexpected error processing file '{file.filename}': {e_unexpected}"
        )
        traceback.print_exc()  # Log the full traceback for this unexpected error
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected server error occurred during file upload. Please try again or contact support if the issue persists.",
        )
