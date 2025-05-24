import base64
import io
import os

import cv2
import numpy as np
import tensorflow as tf
from huggingface_hub import from_pretrained_keras as hf_from_pretrained_keras
from PIL import Image, ImageDraw
from tensorflow.keras.applications.vgg16 import (
    preprocess_input as vgg16_preprocess_input,
)
from tensorflow.keras.models import load_model as keras_load_model
from tensorflow.keras.preprocessing import image as keras_image_processor
from ultralytics import YOLO

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

# --- Configuration ---
BACKEND_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
MODELS_DIR = os.path.join(BACKEND_DIR, "models")

MODEL_PATHS = {
    "classification": os.path.join(MODELS_DIR, "classification.h5"),
    # MODIFIED: Changed detection model filename
    "detection": os.path.join(MODELS_DIR, "best.pt"),  # Use best.pt for detection
    "segmentation": os.path.join(MODELS_DIR, "dental_xray_seg.h5"),
}

# --- Model Loading Cache ---
_loaded_models_cache = {}


def get_model(model_name: str):
    if model_name in _loaded_models_cache:
        return _loaded_models_cache[model_name]

    model_path = MODEL_PATHS.get(model_name)

    # Fallback for segmentation model if local path fails or is not preferred
    if model_name == "segmentation" and not (model_path and os.path.exists(model_path)):
        print(
            f"Local model for {model_name} not found at {model_path}, trying Hugging Face Hub."
        )
        try:
            model = hf_from_pretrained_keras(
                "SerdarHelli/Segmentation-of-Teeth-in-Panoramic-X-ray-Image-Using-U-Net"
            )
            _loaded_models_cache[model_name] = model
            print(f"Loaded {model_name} from Hugging Face Hub.")
            return model
        except Exception as e:
            print(f"Failed to load {model_name} from Hugging Face Hub: {e}")
            # If HF fails, and local was also not found, then raise error
            raise FileNotFoundError(
                f"Model {model_name} not found locally or on Hugging Face Hub."
            )
    elif not model_path:  # model_name not in MODEL_PATHS and not segmentation fallback
        raise ValueError(f"Model name '{model_name}' not recognized in MODEL_PATHS.")

    # If we reached here, model_path should be set (either originally or because segmentation didn't trigger HF)
    # Now check if this path actually exists.
    if not os.path.exists(model_path):
        # This case would typically be hit if segmentation had a path in MODEL_PATHS but it didn't exist,
        # and the HF fallback was either not triggered (because path was defined) or also failed.
        # Or for other models if their path is wrong.
        raise FileNotFoundError(
            f"Model file not found: {model_path} for model {model_name}"
        )

    print(f"Loading model: {model_name} from {model_path}")
    if model_name == "segmentation":
        model = keras_load_model(model_path)  # Assumes local exists if we are here
    elif model_name == "detection":  # This will now use best.pt
        model = YOLO(model_path)
    elif model_name == "classification":
        model = keras_load_model(model_path)
    else:
        raise ValueError(f"Unknown model name for loading: {model_name}")

    _loaded_models_cache[model_name] = model
    return model


# --- Image Conversion Utilities ---
# ... (no changes to _convert_to_pil_image, _convert_one_channel_cv, _ensure_rgb_cv) ...
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
    # ... (no changes to run_classification logic itself) ...
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
            ClassificationPrediction(label=primary_label, confidence=primary_confidence)
        ]
    )


async def run_detection(pil_image: Image.Image) -> DetectionResult:
    # This function will now use the model loaded via get_model("detection"),
    # which will be best.pt
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


async def run_segmentation(pil_image: Image.Image) -> SegmentationResult:
    # ... (no changes to run_segmentation logic itself) ...
    model = get_model("segmentation")
    original_width, original_height = pil_image.size
    img_array_pil = np.asarray(pil_image)
    img_cv = _convert_one_channel_cv(img_array_pil.copy())
    img_cv_resized = cv2.resize(img_cv, (512, 512), interpolation=cv2.INTER_LANCZOS4)
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
    closed_mask = cv2.morphologyEx(opened_mask, cv2.MORPH_CLOSE, kernel, iterations=1)
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


async def process_image_with_ai(dicom_id: str, model_type: str) -> AiAnalysisResult:
    # ... (no changes to process_image_with_ai) ...
    image_payload = await get_image_payload(dicom_id)
    if not image_payload:
        raise ValueError("Original DICOM image payload not found for AI processing.")
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
