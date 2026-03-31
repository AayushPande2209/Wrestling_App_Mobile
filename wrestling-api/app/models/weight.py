from pydantic import BaseModel


class WeightCutRequest(BaseModel):
    current_weight: float
    target_weight_class: int
    days_until_weigh_in: int


class WeightCutResponse(BaseModel):
    lbs_to_cut: float
    daily_cut_rate: float
    is_safe: bool
    recommendation: str


class WeightTrendRequest(BaseModel):
    target_date: str  # ISO date string e.g. "2026-04-15"


class WeightTrendResponse(BaseModel):
    predicted_weight: float
    confidence: str  # "low" | "medium" | "high"
