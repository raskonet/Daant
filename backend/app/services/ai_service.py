# backend/app/services/ai_service.py
import base64
import io
import os
import traceback

import numpy as np  # Not strictly needed for base64 method but often useful with images
from app.core.config import settings
from app.models.ai_results import AiAnalysisResult, BoundingBox, DetectionResult
from app.services.dicom_service import get_image_payload
from inference_sdk import InferenceHTTPClient
from inference_sdk.http.errors import InvalidInputFormatError
from PIL import Image

# --- Configuration ---
ROBOFLOW_API_KEY = settings.ROBOFLOW_API_KEY
ROBOFLOW_MODEL_ID = "adr/6"  # Your specific model
ROBOFLOW_CONFIDENCE_THRESHOLD = 0.30
# ROBOFLOW_OVERLAP_THRESHOLD = 0.50 # NMS/Overlap is usually handled server-side by Roboflow

if not ROBOFLOW_API_KEY:
    print(
        "--- CRITICAL WARNING from ai_service.py: ROBOFLOW_API_KEY is not set. AI processing will fail. ---"
    )
else:
    print(
        f"--- ai_service.py: ROBOFLOW_API_KEY found: {ROBOFLOW_API_KEY[:5]}... (masked for security)"
    )


# --- Image Conversion Utilities ---
def _convert_to_pil_image(png_base64_data: str) -> Image.Image:
    image_bytes = base64.b64decode(png_base64_data)
    image_file = io.BytesIO(image_bytes)
    pil_image = Image.open(image_file).convert("RGB")  # Ensure RGB
    return pil_image


async def run_roboflow_object_detection(pil_image: Image.Image) -> DetectionResult:
    if not ROBOFLOW_API_KEY:
        raise ValueError("Roboflow API key not configured on the server.")

    client = InferenceHTTPClient(
        api_url="https://detect.roboflow.com", api_key=ROBOFLOW_API_KEY
    )

    try:
        print(
            f"--- AI SERVICE: Calling Roboflow model {ROBOFLOW_MODEL_ID} with Base64 encoded JPEG image ---"
        )

        # Convert PIL image to JPEG bytes, then to base64 string
        buffer = io.BytesIO()
        pil_image.save(
            buffer, format="JPEG", quality=90
        )  # Save as JPEG to buffer, adjust quality if needed
        image_bytes = buffer.getvalue()
        base64_image_string = base64.b64encode(image_bytes).decode("utf-8")

        roboflow_result = client.infer(
            base64_image_string,  # Pass the base64 string
            model_id=ROBOFLOW_MODEL_ID,
            # Confidence and overlap are typically set on the Roboflow platform for the deployed model.
            # Passing them here might not have an effect or might not be supported by the SDK for hosted API.
        )

        roboflow_predictions = []
        if isinstance(roboflow_result, dict) and "predictions" in roboflow_result:
            roboflow_predictions = roboflow_result["predictions"]
        elif isinstance(roboflow_result, list):
            # Handle cases where SDK might return a list of InferenceResponse objects or list of prediction dicts
            if (
                len(roboflow_result) > 0
                and hasattr(roboflow_result[0], "dict")
                and "predictions" in roboflow_result[0].dict()
            ):
                # For inference_sdk >= 1.0, result is often a list of response objects
                # We usually expect one image, so one response object
                roboflow_predictions = roboflow_result[0].dict()["predictions"]
            elif len(roboflow_result) > 0 and hasattr(
                roboflow_result[0], "predictions"
            ):  # Older SDK or other structures
                roboflow_predictions = roboflow_result[0].predictions
            elif (
                len(roboflow_result) > 0
                and isinstance(roboflow_result[0], dict)
                and "class" in roboflow_result[0]
            ):  # list of prediction dicts
                roboflow_predictions = roboflow_result
            else:
                print(
                    f"--- AI SERVICE WARNING: Roboflow returned a list, but its content format is not recognized or empty: {roboflow_result[:1]}"
                )
        elif roboflow_result is None:
            print(
                f"--- AI SERVICE WARNING: Roboflow returned None. This might indicate an issue with the request or model."
            )
        else:
            print(
                f"--- AI SERVICE WARNING: Roboflow result format not recognized: {type(roboflow_result)}"
            )

        print(
            f"--- AI SERVICE: Roboflow raw predictions count (after initial parsing): {len(roboflow_predictions)} ---"
        )
        # For debugging the exact structure:
        # if roboflow_predictions:
        #    print(f"--- AI SERVICE: Roboflow first raw prediction sample: {roboflow_predictions[0]} ---")

        boxes = []
        for pred_idx, pred in enumerate(roboflow_predictions):
            if not isinstance(pred, dict):
                print(
                    f"--- AI SERVICE WARNING: Prediction item {pred_idx} is not a dict: {pred} ---"
                )
                continue

            # Check for essential keys, with robust .get()
            confidence = pred.get("confidence")
            pred_class = pred.get("class")
            x_center = pred.get("x")
            y_center = pred.get("y")
            width = pred.get("width")
            height = pred.get("height")

            if None in [confidence, pred_class, x_center, y_center, width, height]:
                print(
                    f"--- AI SERVICE WARNING: Skipping malformed prediction (missing keys) at index {pred_idx}: {pred} ---"
                )
                continue

            try:
                confidence_float = float(confidence)
                if confidence_float < ROBOFLOW_CONFIDENCE_THRESHOLD:
                    continue
            except ValueError:
                print(
                    f"--- AI SERVICE WARNING: Could not convert confidence to float for pred {pred_idx}: {pred} ---"
                )
                continue

            x1 = float(x_center) - float(width) / 2
            y1 = float(y_center) - float(height) / 2
            x2 = float(x_center) + float(width) / 2
            y2 = float(y_center) + float(height) / 2

            img_width_pil, img_height_pil = pil_image.size
            x1 = max(0.0, min(x1, float(img_width_pil)))
            y1 = max(0.0, min(y1, float(img_height_pil)))
            x2 = max(0.0, min(x2, float(img_width_pil)))
            y2 = max(0.0, min(y2, float(img_height_pil)))

            # Ensure width and height of box are positive after clamping
            if x2 <= x1 or y2 <= y1:
                print(
                    f"--- AI SERVICE WARNING: Skipping invalid box (zero/negative W/H after clamping) for pred {pred_idx}: x1:{x1},y1:{y1},x2:{x2},y2:{y2} from {pred} ---"
                )
                continue

            boxes.append(
                BoundingBox(
                    x1=x1,
                    y1=y1,
                    x2=x2,
                    y2=y2,
                    label=str(pred_class),
                    confidence=confidence_float,
                )
            )
        print(f"--- AI SERVICE: Parsed Bounding Boxes count: {len(boxes)} ---")
        return DetectionResult(boxes=boxes)

    except InvalidInputFormatError as iife:
        print(
            f"--- ERROR in run_roboflow_object_detection (InvalidInputFormatError): {iife}"
        )
        traceback.print_exc()
        # This error typically means the SDK couldn't process the input type (e.g. string, path, PIL, numpy)
        raise RuntimeError(
            f"Roboflow SDK rejected input image format: {iife}"
        ) from iife
    except Exception as e:
        # This catches other errors, like network issues, API key problems, server errors from Roboflow etc.
        print(f"--- ERROR in run_roboflow_object_detection: {e}")
        traceback.print_exc()
        # It's good to check if the error object 'e' has a 'response' attribute (e.g. from HTTPError)
        # to provide more specific feedback if it's an API error.
        error_message = f"Error during Roboflow AI processing: {e}"
        if hasattr(e, "response") and e.response is not None:
            try:
                error_detail = (
                    e.response.json()
                    if callable(e.response.json)
                    else str(e.response.content)
                )
                error_message += (
                    f" (Server Response: {e.response.status_code} - {error_detail})"
                )
            except:  # pylint: disable=bare-except
                error_message += f" (Server Response: {e.response.status_code} - could not parse error content)"

        raise RuntimeError(error_message) from e


async def process_image_with_ai(dicom_id: str, model_type: str) -> AiAnalysisResult:
    if model_type != "detection":
        print(
            f"--- AI SERVICE: Model type '{model_type}' not supported with current Roboflow setup. Only 'detection' is. Skipping. ---"
        )
        return AiAnalysisResult(
            model_type=model_type
        )  # Return empty result for other types

    try:
        image_payload = await get_image_payload(dicom_id)
        if not image_payload:
            raise ValueError(
                "Original DICOM image payload not found for AI processing."
            )

        pil_img = _convert_to_pil_image(image_payload.png_data)

        if model_type == "detection":
            detection_results = await run_roboflow_object_detection(pil_img)
            return AiAnalysisResult(detection=detection_results, model_type=model_type)
        else:
            # This case should ideally not be reached due to the check above
            raise ValueError(
                f"Internal error: Unsupported AI model type '{model_type}' reached processing stage."
            )

    except (FileNotFoundError, ValueError, RuntimeError, ImportError) as e:
        print(
            f"--- ERROR in process_image_with_ai for {model_type} (Roboflow): {e} ---"
        )
        traceback.print_exc()  # Log details
        raise  # Re-raise to be caught by the API route handler
    except Exception as e:
        print(
            f"--- UNEXPECTED ERROR in process_image_with_ai for {model_type} (Roboflow): {e} ---"
        )
        traceback.print_exc()  # Log details
        raise  # Re-raise
