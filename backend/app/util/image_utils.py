import io

import numpy as np
import pydicom
from PIL import Image


def _to_png(arr: np.ndarray, ds: pydicom.Dataset) -> bytes:
    """
    Converts a DICOM pixel array to PNG bytes.

    Args:
        arr (np.ndarray): Pixel array from pydicom.Dataset.pixel_array.
                          It's assumed that RescaleSlope and RescaleIntercept
                          have already been applied by pydicom.
        ds (pydicom.Dataset): The DICOM dataset object.

    Returns:
        bytes: PNG image data as bytes.
    """

    # 1. Convert pixel array to float32 for calculations
    # This prevents overflow/underflow issues with integer arithmetic and ensures
    # that intermediate results (like subtractions leading to negatives) are handled correctly.
    pixel_data_float = arr.astype(np.float32)

    # 2. Determine and apply windowing or auto-contrast
    wc_val = getattr(ds, "WindowCenter", None)
    ww_val = getattr(ds, "WindowWidth", None)

    window_center = None
    window_width = None
    apply_windowing = False

    if wc_val is not None and ww_val is not None:
        # Handle MultiValue for WindowCenter
        if isinstance(wc_val, pydicom.multival.MultiValue):
            if len(wc_val) > 0:
                window_center = float(wc_val[0])
        elif isinstance(wc_val, (int, float, str)):  # str in case it's read as string
            try:
                window_center = float(wc_val)
            except ValueError:
                window_center = None

        # Handle MultiValue for WindowWidth
        if isinstance(ww_val, pydicom.multival.MultiValue):
            if len(ww_val) > 0:
                window_width = float(ww_val[0])
        elif isinstance(ww_val, (int, float, str)):
            try:
                window_width = float(ww_val)
            except ValueError:
                window_width = None

        # Check if extracted WC/WW are valid for windowing
        if window_center is not None and window_width is not None and window_width > 0:
            apply_windowing = True

    if apply_windowing:
        # Apply windowing transformation
        # Formula: Output = ((Input - (WC - WW/2)) / WW) * 255
        lower_bound = window_center - (window_width / 2.0)
        # upper_bound = window_center + (window_width / 2.0) # For context

        # Scale pixel data to 0-255 range based on window
        img_array_scaled = (pixel_data_float - lower_bound) / window_width * 255.0

        # Clip values to the 0-255 range and convert to uint8
        img_array_processed = np.clip(img_array_scaled, 0, 255).astype(np.uint8)
    else:
        # Fallback to auto-contrast (min-max normalization)
        min_val = pixel_data_float.min()
        max_val = pixel_data_float.max()

        if max_val > min_val:
            # Normalize to 0-1 range, then scale to 0-255
            img_array_normalized = (pixel_data_float - min_val) / (max_val - min_val)
            img_array_processed = (img_array_normalized * 255.0).astype(np.uint8)
        else:
            # Flat image (all pixels have the same value)
            # Display as mid-gray (128) if positive, or black (0) if zero/negative.
            # ds.pixel_array usually returns non-negative values for image intensity.
            gray_value = 128 if min_val > 0 else 0
            img_array_processed = np.full(arr.shape, gray_value, dtype=np.uint8)

    # 3. Handle Photometric Interpretation
    photometric_interpretation = getattr(
        ds, "PhotometricInterpretation", "MONOCHROME2"
    )  # Default to MONOCHROME2 if not present
    if photometric_interpretation == "MONOCHROME1":
        # Invert pixels: 0 becomes 255, 255 becomes 0.
        img_array_processed = 255 - img_array_processed

    # 4. Create PIL Image and convert to PNG bytes
    try:
        # Ensure the array is 2D (grayscale).
        # If it came from a multi-frame DICOM and pixel_array returned one frame, it might be 3D with a single slice.
        if img_array_processed.ndim == 3 and img_array_processed.shape[2] == 1:
            img_array_processed = img_array_processed.squeeze(axis=2)

        if img_array_processed.ndim != 2:
            # This case should ideally not be hit for standard grayscale DICOMs.
            # If it's color, this function would need significant changes.
            raise ValueError(
                f"Processed pixel array is not 2D (shape: {img_array_processed.shape}). "
                "This function expects grayscale images."
            )

        pil_image = Image.fromarray(
            img_array_processed, mode="L"
        )  # 'L' for 8-bit grayscale

        buffer = io.BytesIO()
        pil_image.save(buffer, format="PNG")
        png_bytes = buffer.getvalue()
        return png_bytes

    except Exception as e:
        print(f"Error creating PNG from pixel array: {e}")
        print(
            f"Details: shape={img_array_processed.shape}, dtype={img_array_processed.dtype}, min={img_array_processed.min()}, max={img_array_processed.max()}"
        )
        # Depending on desired behavior, you could return a placeholder error image
        # or re-raise the exception. Re-raising makes the problem visible upstream.
        raise
