import io

import numpy as np
from PIL import Image, ImageOps


def _to_png(arr: np.ndarray, ds) -> bytes:
    if hasattr(ds, "WindowCenter"):
        wc, ww = float(ds.WindowCenter[0]), float(ds.WindowWidth[0])
        arr = np.clip((arr - (wc - ww / 2)) / ww * 255, 0, 255).astype("uint8")
    else:
        arr = ImageOps.autocontrast(arr).astype("uint8")
    img = Image.fromarray(arr)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
