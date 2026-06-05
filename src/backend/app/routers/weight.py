from datetime import date, datetime

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from sklearn.linear_model import LinearRegression

from app.auth import get_current_user
from app.config import supabase
from app.models.weight import (
    WeightCutRequest,
    WeightCutResponse,
    WeightTrendRequest,
    WeightTrendResponse,
)

router = APIRouter()


@router.post("/weight-cut", response_model=WeightCutResponse)
def predict_weight_cut(
    body: WeightCutRequest,
    user: dict = Depends(get_current_user),
):
    lbs_to_cut = body.current_weight - body.target_weight_class
    daily_cut_rate = lbs_to_cut / body.days_until_weigh_in
    is_safe = daily_cut_rate < (body.current_weight * 0.015)

    if not is_safe:
        recommendation = f"Cutting {daily_cut_rate:.1f} lbs/day is aggressive. Consider moving up a weight class."
    elif lbs_to_cut <= 0:
        recommendation = "You're already at or below your weight class."
    else:
        recommendation = f"Cut {daily_cut_rate:.1f} lbs/day. You're on track."

    return WeightCutResponse(
        lbs_to_cut=round(lbs_to_cut, 1),
        daily_cut_rate=round(daily_cut_rate, 2),
        is_safe=is_safe,
        recommendation=recommendation,
    )


@router.post("/weight-trend", response_model=WeightTrendResponse)
def predict_weight_trend(
    body: WeightTrendRequest,
    user: dict = Depends(get_current_user),
):
    response = (
        supabase.table("weight_logs")
        .select("weight, logged_at")
        .eq("wrestler_id", user["sub"])
        .order("logged_at")
        .execute()
    )
    logs = response.data

    if len(logs) < 2:
        current = logs[-1]["weight"] if logs else 0.0
        return WeightTrendResponse(predicted_weight=round(current, 1), confidence="low")

    def parse_date(s: str) -> date:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).date()

    first_date = parse_date(logs[0]["logged_at"])
    try:
        target = date.fromisoformat(body.target_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid target_date — expected ISO format (YYYY-MM-DD)")

    xs = np.array(
        [(parse_date(log["logged_at"]) - first_date).days for log in logs]
    ).reshape(-1, 1)
    ys = np.array([log["weight"] for log in logs])

    model = LinearRegression()
    model.fit(xs, ys)

    predicted = float(model.predict([[( target - first_date).days]])[0])

    n = len(logs)
    confidence = "high" if n >= 20 else "medium" if n >= 7 else "low"

    return WeightTrendResponse(predicted_weight=round(predicted, 1), confidence=confidence)
