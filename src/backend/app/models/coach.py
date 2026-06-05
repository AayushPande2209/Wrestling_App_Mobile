from typing import Any, Optional
from pydantic import BaseModel


class CoachChatRequest(BaseModel):
    message: str
    # Non-null on the first submission after onboarding. The dict keys
    # match the onboarding question slugs: weight_class, cut_start,
    # same_day_cut, cut_method, school_lunch, notes.
    onboarding: Optional[dict[str, Any]] = None


class CoachChatResponse(BaseModel):
    response: str
