from typing import Any, Dict, Optional

from pydantic import BaseModel


class DicomMetadataUpdatePayload(BaseModel):
    updates: Dict[str, Any]
