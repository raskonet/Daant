import base64
import io
import traceback
import uuid
from typing import Any, Dict, Optional

import pydicom
import pydicom.valuerep  # Ensure this is imported for DSfloat, IS, etc.
from app.models.dicom_meta import DicomMeta
from app.models.image_payload import ImagePayload
from app.util.image_utils import _to_png
from fastapi import UploadFile
from pydicom import dcmread
from pydicom.errors import InvalidDicomError

_memory_store: dict[str, ImagePayload] = {}
_raw_dicom_store: dict[str, bytes] = {}


class DicomParsingError(ValueError):
    """Custom error for issues during DICOM parsing or processing."""

    pass


async def save_and_parse(file: UploadFile) -> str:
    dicom_id = str(uuid.uuid4())
    print(f"--- UPLOAD START (ID: {dicom_id}): Processing file '{file.filename}'")

    try:
        data = await file.read()
        _raw_dicom_store[dicom_id] = data

        try:
            ds = pydicom.dcmread(io.BytesIO(data), force=True)
        except InvalidDicomError as e_dicom_invalid:
            print(
                f"--- UPLOAD ERROR (ID: {dicom_id}): pydicom.dcmread failed - Invalid DICOM file: {e_dicom_invalid}"
            )
            traceback.print_exc()
            raise DicomParsingError(
                f"The uploaded file is not a valid DICOM file or is corrupted: {e_dicom_invalid}"
            ) from e_dicom_invalid
        except Exception as e_dcmread_generic:
            print(
                f"--- UPLOAD ERROR (ID: {dicom_id}): pydicom.dcmread failed with generic error: {e_dcmread_generic}"
            )
            traceback.print_exc()
            raise DicomParsingError(
                f"Could not read DICOM file: {e_dcmread_generic}"
            ) from e_dcmread_generic

        try:
            arr = ds.pixel_array
        except Exception as e_pixel_array:
            print(
                f"--- UPLOAD ERROR (ID: {dicom_id}): Error accessing ds.pixel_array: {e_pixel_array}"
            )
            if (
                "decompress_image" in str(e_pixel_array).lower()
                or "gdcm" in str(e_pixel_array).lower()
                or "pylibjpeg" in str(e_pixel_array).lower()
            ):
                error_detail = "Missing dependency or unsupported compression for pixel data. Ensure GDCM or pylibjpeg-libjpeg is installed if needed."
                print(f"--- UPLOAD ERROR DETAIL (ID: {dicom_id}): {error_detail}")
                raise DicomParsingError(error_detail) from e_pixel_array
            traceback.print_exc()
            raise DicomParsingError(
                f"Failed to access pixel data from DICOM: {e_pixel_array}"
            ) from e_pixel_array

        try:
            png_bytes = _to_png(arr, ds)
        except Exception as e_to_png:
            print(
                f"--- UPLOAD ERROR (ID: {dicom_id}): Error converting DICOM to PNG (_to_png failed): {e_to_png}"
            )
            traceback.print_exc()
            raise DicomParsingError(
                f"Failed to convert DICOM to PNG image: {e_to_png}"
            ) from e_to_png

        png_b64 = base64.b64encode(png_bytes).decode("ascii")

        wc_parsed = None
        ww_parsed = None
        raw_wc = ds.get("WindowCenter", None)
        raw_ww = ds.get("WindowWidth", None)

        if raw_wc is not None:
            try:
                wc_val = (
                    raw_wc[0]
                    if isinstance(raw_wc, pydicom.multival.MultiValue)
                    and len(raw_wc) > 0
                    else raw_wc
                )
                wc_parsed = float(wc_val)
            except (ValueError, TypeError, IndexError) as e_wc:
                print(
                    f"--- UPLOAD WARNING (ID: {dicom_id}): Could not parse WindowCenter '{raw_wc}': {e_wc}. Setting to None."
                )

        if raw_ww is not None:
            try:
                ww_val = (
                    raw_ww[0]
                    if isinstance(raw_ww, pydicom.multival.MultiValue)
                    and len(raw_ww) > 0
                    else raw_ww
                )
                ww_parsed = float(ww_val)
            except (ValueError, TypeError, IndexError) as e_ww:
                print(
                    f"--- UPLOAD WARNING (ID: {dicom_id}): Could not parse WindowWidth '{raw_ww}': {e_ww}. Setting to None."
                )

        pixel_spacing_val = ds.get("PixelSpacing", [1.0, 1.0])
        processed_pixel_spacing: list[float] = []
        try:
            if isinstance(pixel_spacing_val, pydicom.multival.MultiValue):
                processed_pixel_spacing = [float(v) for v in pixel_spacing_val[:2]]
            elif isinstance(pixel_spacing_val, list) and all(
                isinstance(
                    v, (int, float, str, pydicom.valuerep.DSfloat, pydicom.valuerep.IS)
                )
                for v in pixel_spacing_val
            ):
                processed_pixel_spacing = [float(str(v)) for v in pixel_spacing_val[:2]]
            elif isinstance(
                pixel_spacing_val,
                (pydicom.valuerep.DSfloat, pydicom.valuerep.DSdecimal),
            ):
                processed_pixel_spacing = [
                    float(pixel_spacing_val),
                    float(pixel_spacing_val),
                ]  # <<<< THIS WAS THE FIX
            elif isinstance(pixel_spacing_val, (int, float)):
                processed_pixel_spacing = [
                    float(pixel_spacing_val),
                    float(pixel_spacing_val),
                ]
            else:
                print(
                    f"--- UPLOAD WARNING (ID: {dicom_id}): Unexpected PixelSpacing format '{pixel_spacing_val}' (type: {type(pixel_spacing_val)}). Defaulting."
                )
                processed_pixel_spacing = [1.0, 1.0]
        except (ValueError, TypeError) as e_ps:
            print(
                f"--- UPLOAD WARNING (ID: {dicom_id}): Error parsing PixelSpacing '{pixel_spacing_val}': {e_ps}. Defaulting."
            )
            processed_pixel_spacing = [1.0, 1.0]

        if not processed_pixel_spacing or len(processed_pixel_spacing) == 0:
            processed_pixel_spacing = [1.0, 1.0]
        elif len(processed_pixel_spacing) == 1:
            processed_pixel_spacing.append(processed_pixel_spacing[0])
        processed_pixel_spacing = processed_pixel_spacing[:2]

        rows_val = ds.get("Rows", 0)
        cols_val = ds.get("Columns", 0)
        try:
            parsed_rows = int(rows_val)
            parsed_cols = int(cols_val)
        except (ValueError, TypeError) as e_dims:
            print(
                f"--- UPLOAD WARNING (ID: {dicom_id}): Could not parse Rows/Columns '{rows_val}', '{cols_val}': {e_dims}. Defaulting to 0."
            )
            parsed_rows, parsed_cols = 0, 0
            if parsed_rows <= 0 or parsed_cols <= 0:
                raise DicomParsingError(
                    f"Invalid Rows/Columns dimensions in DICOM: R={rows_val}, C={cols_val}"
                )

        meta = DicomMeta(
            patient_id=str(ds.get("PatientID", "N/A")),
            study_date=str(ds.get("StudyDate", "")),
            modality=str(ds.get("Modality", "N/A")),
            pixel_spacing=processed_pixel_spacing,
            window_center=wc_parsed,
            window_width=ww_parsed,
            rows=parsed_rows,
            columns=parsed_cols,
        )

        payload = ImagePayload(png_data=png_b64, meta=meta)
        _memory_store[dicom_id] = payload
        print(f"--- UPLOAD SUCCESS (ID: {dicom_id}): File parsed and stored.")
        return dicom_id

    except DicomParsingError:
        if dicom_id in _raw_dicom_store:
            del _raw_dicom_store[dicom_id]
        print(
            f"--- UPLOAD HANDLED ERROR (ID: {dicom_id}): DicomParsingError propagated."
        )
        raise
    except Exception as e_generic:
        print(
            f"--- UPLOAD CRITICAL ERROR (ID: {dicom_id}): An unexpected error occurred during DICOM processing: {e_generic}"
        )
        traceback.print_exc()
        if dicom_id in _raw_dicom_store:
            del _raw_dicom_store[dicom_id]
        raise DicomParsingError(
            f"An unexpected server error occurred while processing the DICOM file: {e_generic}"
        ) from e_generic


async def get_image_payload(dicom_id: str) -> Optional[ImagePayload]:
    return _memory_store.get(dicom_id)


async def get_raw_dicom_bytes(dicom_id: str) -> Optional[bytes]:
    return _raw_dicom_store.get(dicom_id)


async def create_modified_dicom_with_meta(
    original_dicom_id: str, metadata_updates: Dict[str, Any]
) -> Optional[bytes]:
    original_bytes = await get_raw_dicom_bytes(original_dicom_id)
    if not original_bytes:
        print(
            f"--- DICOM EXPORT ERROR: Original DICOM bytes not found for ID: {original_dicom_id}"
        )
        return None

    try:
        ds = pydicom.dcmread(io.BytesIO(original_bytes), force=True)
    except Exception as e:
        print(
            f"--- DICOM EXPORT ERROR: Failed to read original DICOM for ID {original_dicom_id}: {e}"
        )
        traceback.print_exc()
        return None

    tag_map = {
        "patient_id": "PatientID",
        "study_date": "StudyDate",
        "modality": "Modality",
        "window_center": "WindowCenter",
        "window_width": "WindowWidth",
    }

    print(
        f"--- DICOM EXPORT INFO (ID: {original_dicom_id}): Metadata updates received: {metadata_updates}"
    )

    for key, value in metadata_updates.items():
        tag_name = tag_map.get(key)
        if not tag_name:
            print(
                f"--- DICOM EXPORT INFO (ID: {original_dicom_id}): Key '{key}' not in tag_map, skipping."
            )
            continue

        print(
            f"--- DICOM EXPORT INFO (ID: {original_dicom_id}): Processing update for '{key}' (Tag: {tag_name}, Value: {repr(value)}, Type: {type(value)})"
        )

        if value is None:
            if hasattr(ds, tag_name) and tag_name in ds:
                print(
                    f"--- DICOM EXPORT INFO (ID: {original_dicom_id}): Deleting tag '{tag_name}'."
                )
                del ds[tag_name]
            else:
                print(
                    f"--- DICOM EXPORT INFO (ID: {original_dicom_id}): Tag '{tag_name}' not present for deletion, skipping."
                )
            continue

        try:
            current_tag = ds.data_element(tag_name)
            vr = current_tag.VR if current_tag else None

            if tag_name == "StudyDate":
                if isinstance(value, str):
                    if not pydicom.valuerep.is_valid_DA(value):
                        print(
                            f"--- DICOM EXPORT WARNING (ID: {original_dicom_id}): Invalid StudyDate format '{value}'. Must be YYYYMMDD. Skipping update for this tag."
                        )
                        continue
                else:
                    print(
                        f"--- DICOM EXPORT WARNING (ID: {original_dicom_id}): StudyDate value '{value}' is not a string. Skipping update."
                    )
                    continue

            if tag_name in ["WindowCenter", "WindowWidth"]:
                if isinstance(value, str) and value.strip() == "":
                    if hasattr(ds, tag_name) and tag_name in ds:
                        print(
                            f"--- DICOM EXPORT INFO (ID: {original_dicom_id}): Deleting tag '{tag_name}' due to empty string value for numeric field."
                        )
                        del ds[tag_name]
                    continue
                try:
                    if isinstance(value, list):
                        parsed_value = [float(v) for v in value]
                    else:
                        parsed_value = float(value)
                    value = parsed_value
                except (ValueError, TypeError) as e_float:
                    print(
                        f"--- DICOM EXPORT WARNING (ID: {original_dicom_id}): Could not convert value '{repr(value)}' to float/list of floats for {tag_name}: {e_float}. Skipping."
                    )
                    continue

            print(
                f"--- DICOM EXPORT INFO (ID: {original_dicom_id}): Attempting to set ds.{tag_name} = {repr(value)}"
            )
            setattr(ds, tag_name, value)

            current_val_after_set = getattr(
                ds, tag_name, "ERROR GETTING VALUE AFTER SET"
            )
            print(
                f"--- DICOM EXPORT INFO (ID: {original_dicom_id}): Successfully set ds.{tag_name}. Current internal value: {repr(current_val_after_set)}"
            )

        except Exception as e_setattr:
            print(
                f"--- DICOM EXPORT ERROR (ID: {original_dicom_id}): Failed to set attribute '{tag_name}' with value '{repr(value)}'. Error: {e_setattr}"
            )
            traceback.print_exc()

    try:
        ds.SOPInstanceUID = pydicom.uid.generate_uid()
        print(
            f"--- DICOM EXPORT INFO (ID: {original_dicom_id}): New SOPInstanceUID generated: {ds.SOPInstanceUID}"
        )
    except Exception as e_uid:
        print(
            f"--- DICOM EXPORT ERROR (ID: {original_dicom_id}): Failed to generate/set SOPInstanceUID: {e_uid}"
        )
        traceback.print_exc()
        return None

    buffer = io.BytesIO()
    try:
        print(
            f"--- DICOM EXPORT INFO (ID: {original_dicom_id}): Attempting pydicom.dcmwrite..."
        )
        pydicom.dcmwrite(buffer, ds, write_like_original=False)
        buffer.seek(0)
        print(
            f"--- DICOM EXPORT INFO (ID: {original_dicom_id}): pydicom.dcmwrite successful."
        )
        return buffer.read()
    except Exception as e_dcmwrite:
        print(
            f"--- DICOM EXPORT ERROR (ID: {original_dicom_id}): pydicom.dcmwrite failed: {e_dcmwrite}"
        )
        problem_tags_details = {}
        for key_update in metadata_updates:
            tag_name_update = tag_map.get(key_update)
            if tag_name_update and tag_name_update in ds:
                try:
                    element = ds[tag_name_update]
                    problem_tags_details[tag_name_update] = {
                        "value": element.value,
                        "VR": element.VR,
                        "VM": element.VM,
                    }
                except Exception as e_tag_detail:
                    problem_tags_details[tag_name_update] = (
                        f"Error accessing tag details: {e_tag_detail}"
                    )
        print(
            f"--- DICOM EXPORT DEBUG (ID: {original_dicom_id}): Details of updated tags before failed dcmwrite: {problem_tags_details}"
        )
        traceback.print_exc()
        return None
