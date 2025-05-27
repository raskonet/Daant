import base64
import io
import os
import traceback  # For more robust error handling, especially in production

import numpy as np
from app.models.ai_results import (
    AiAnalysisResult,
    BoundingBox,
    ClassificationPrediction,
    ClassificationResult,
    DetectionResult,
    SegmentationContour,
    SegmentationResult,
)
from app.services.dicom_service import get_image_payload
from PIL import Image

# from ultralytics import YOLO # remove ultralytics import since we'll load model in seperate process


# --- Configuration ---
BACKEND_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
MODELS_DIR = os.path.join(BACKEND_DIR, "models")

# --- Model Paths ---
# Keep the model paths but *don't* load them directly.
MODEL_PATHS = {
    "classification": os.path.join(MODELS_DIR, "classification.h5"),
    "detection": os.path.join(MODELS_DIR, "best.pt"),
    "segmentation": os.path.join(MODELS_DIR, "dental_xray_seg.h5"),
}

# --- Model Loading Cache ---  (Remove this cache as it's not needed in this lazy-load configuration)
# _loaded_models_cache = {}  # REMOVE the model loading cache


def get_model(model_name: str):  # Keep this, but adapt for lazy loading
    model_path = MODEL_PATHS.get(model_name)
    if not model_path:
        raise ValueError(f"Model name '{model_name}' not recognized in MODEL_PATHS.")

    if model_name == "segmentation":
        try:
            import tensorflow as tf

            model = tf.keras.models.load_model(
                model_path
            )  # Loads the segmentation model
        except Exception as e:
            raise FileNotFoundError(
                f"Error loading segmentation model from {model_path}: {e}"
            ) from e
    elif model_name == "detection":  # YOLO is special and gets different load mechanism
        try:
            from ultralytics import YOLO  # Moved here

            model = YOLO(model_path)
        except Exception as e:
            raise FileNotFoundError(
                f"Error loading detection model from {model_path}: {e}"
            ) from e
    elif model_name == "classification":
        try:
            import tensorflow as tf

            model = tf.keras.models.load_model(model_path)
        except Exception as e:
            raise FileNotFoundError(
                f"Error loading classification model from {model_path}: {e}"
            ) from e
    else:
        raise ValueError(f"Unknown model name for loading: {model_name}")

    return model


# --- Image Conversion Utilities ---
def _convert_to_pil_image(png_base64_data: str) -> Image.Image:
    image_bytes = base64.b64decode(png_base64_data)
    image_file = io.BytesIO(image_bytes)
    pil_image = Image.open(image_file)
    return pil_image


def _convert_one_channel_cv(img_array: np.ndarray):
    if len(img_array.shape) > 2 and img_array.shape[2] > 1:
        if img_array.shape[2] == 4:
            img_array = cv2.cvtColor(img_array, cv2.COLOR_RGBA2RGB)
        img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    return img_array


def _ensure_rgb_cv(img_array: np.ndarray):
    if len(img_array.shape) == 2:
        img_array = cv2.cvtColor(img_array, cv2.COLOR_GRAY2RGB)
    elif img_array.shape[2] == 4:
        img_array = cv2.cvtColor(img_array, cv2.COLOR_RGBA2RGB)
    return img_array


# --- AI Processing Functions ---
async def run_classification(pil_image: Image.Image) -> ClassificationResult:
    try:
        import tensorflow as tf
        from tensorflow.keras.applications.vgg16 import (
            preprocess_input as vgg16_preprocess_input,
        )
        from tensorflow.keras.preprocessing import image as keras_image_processor

        model = get_model("classification")
        img_resized = pil_image.convert("RGB").resize((224, 224))
        x = keras_image_processor.img_to_array(img_resized)
        x = np.expand_dims(x, axis=0)
        img_data = vgg16_preprocess_input(x)
        raw_predictions = model.predict(img_data)
        calculus_prob = float(raw_predictions[0][0])
        caries_prob = float(raw_predictions[0][1])
        primary_label = "Calculus" if calculus_prob > caries_prob else "Caries"
        primary_confidence = max(calculus_prob, caries_prob)

        return ClassificationResult(
            predictions=[
                ClassificationPrediction(
                    label=primary_label, confidence=primary_confidence
                )
            ]
        )
    except FileNotFoundError as e:
        print(f"Error in run_classification: {e}")
        traceback.print_exc()  # Log the traceback
        raise  # Re-raise so it's handled upstream in process_image_with_ai
    except ImportError as e:
        print(f"Error in run_classification (TensorFlow import): {e}")
        traceback.print_exc()  # Log the traceback
        raise  # Re-raise for frontend handling
    except Exception as e:
        print(f"Unhandled error in run_classification: {e}")
        traceback.print_exc()
        raise  # Re-raise for frontend handling


async def run_detection(pil_image: Image.Image) -> DetectionResult:
    try:
        from ultralytics import YOLO  # Move import here!

        model = get_model("detection")
        results = model.predict(pil_image.convert("RGB"))
        yolo_result = results[0]

        boxes = []
        for box in yolo_result.boxes:
            x1, y1, x2, y2 = [round(x) for x in box.xyxy[0].tolist()]
            class_id = box.cls[0].item()
            prob = round(box.conf[0].item(), 2)
            label = yolo_result.names[class_id]

            boxes.append(
                BoundingBox(x1=x1, y1=y1, x2=x2, y2=y2, label=label, confidence=prob)
            )
        return DetectionResult(boxes=boxes)
    except FileNotFoundError as e:
        print(f"Error in run_detection: {e}")
        traceback.print_exc()  # Log the traceback
        raise  # Re-raise for frontend handling
    except ImportError as e:
        print(f"Error in run_detection (Ultralytics import): {e}")
        traceback.print_exc()  # Log the traceback
        raise  # Re-raise to be handled upstream
    except Exception as e:
        print(f"Unhandled error in run_detection: {e}")
        traceback.print_exc()
        raise  # Re-raise for frontend handling


async def run_segmentation(pil_image: Image.Image) -> SegmentationResult:
    try:
        import cv2
        import tensorflow as tf

        model = get_model("segmentation")
        original_width, original_height = pil_image.size
        img_array_pil = np.asarray(pil_image)
        img_cv = _convert_one_channel_cv(img_array_pil.copy())
        img_cv_resized = cv2.resize(
            img_cv, (512, 512), interpolation=cv2.INTER_LANCZOS4
        )
        img_cv_normalized = np.float32(img_cv_resized / 255.0)
        img_cv_batch = np.reshape(img_cv_normalized, (1, 512, 512, 1))
        prediction_mask_batch = model.predict(img_cv_batch)
        predicted_mask_resized = prediction_mask_batch[0]
        predicted_mask_original_size = cv2.resize(
            predicted_mask_resized,
            (original_width, original_height),
            interpolation=cv2.INTER_LANCZOS4,
        )
        mask_uint8 = (predicted_mask_original_size * 255).astype(np.uint8)
        _, thresholded_mask = cv2.threshold(
            mask_uint8, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
        )
        kernel = np.ones((5, 5), dtype=np.float32)
        opened_mask = cv2.morphologyEx(
            thresholded_mask, cv2.MORPH_OPEN, kernel, iterations=1
        )
        closed_mask = cv2.morphologyEx(
            opened_mask, cv2.MORPH_CLOSE, kernel, iterations=1
        )
        contours_cv, _ = cv2.findContours(
            closed_mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE
        )
        segmentation_contours = []
        for contour in contours_cv:
            points = [(float(pt[0][0]), float(pt[0][1])) for pt in contour]
            if len(points) >= 3:
                segmentation_contours.append(
                    SegmentationContour(points=points, label="Tooth Segment")
                )
        return SegmentationResult(contours=segmentation_contours)
    except FileNotFoundError as e:
        print(f"Error in run_segmentation: {e}")
        traceback.print_exc()  # Log the traceback
        raise  # Re-raise for frontend handling
    except ImportError as e:
        print(f"Error in run_segmentation (TensorFlow/CV2 import): {e}")
        traceback.print_exc()
        raise  # Re-raise for frontend
    except Exception as e:
        print(f"Unhandled error in run_segmentation: {e}")
        traceback.print_exc()
        raise  # Re-raise for frontend handling


async def process_image_with_ai(dicom_id: str, model_type: str) -> AiAnalysisResult:
    try:
        image_payload = await get_image_payload(dicom_id)
        if not image_payload:
            raise ValueError(
                "Original DICOM image payload not found for AI processing."
            )

        pil_img = _convert_to_pil_image(image_payload.png_data)

        if model_type == "detection":
            detection_results = await run_detection(pil_img)
            return AiAnalysisResult(detection=detection_results, model_type=model_type)
        elif model_type == "segmentation":
            segmentation_results = await run_segmentation(pil_img)
            return AiAnalysisResult(
                segmentation=segmentation_results, model_type=model_type
            )
        elif model_type == "classification":
            classification_results = await run_classification(pil_img)
            return AiAnalysisResult(
                classification=classification_results, model_type=model_type
            )
        else:
            raise ValueError(f"Unsupported AI model type: {model_type}")
    except (FileNotFoundError, ValueError, ImportError) as e:
        # Capture all the important exceptions here
        print(f"--- ERROR in process_image_with_ai for {model_type}: {e} ---")
        traceback.print_exc()  # Detailed traceback
        # We let the calling route in fastapi (api/v1/ai.py) handle the error:
        raise  # Re-raise so it's handled in the route handler
    except Exception as e:
        # Catch all other errors that were not explicitly handled.
        print(
            f"--- UNEXPECTED ERROR in process_image_with_ai for {model_type}: {e} ---"
        )
        traceback.print_exc()
        raise  # re-raise
