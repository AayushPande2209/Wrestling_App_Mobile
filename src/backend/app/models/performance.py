from pydantic import BaseModel


class PerformanceTrendResponse(BaseModel):
    win_rate: float
    recent_win_rate: float   # last 10 matches
    trend: str               # "improving" | "declining" | "stable"
    insight: str             # e.g. "You win 80% when within 2 lbs of weight class"


class MatchPredictionRequest(BaseModel):
    your_weight_on_day: float
    target_weight_class: int


class MatchPredictionResponse(BaseModel):
    win_probability: float
    confidence: str          # "low" | "medium" | "high"
    factors: list[str]       # readable factors that drove the prediction
