from datetime import datetime, timedelta, timezone

import numpy as np
from fastapi import APIRouter, Depends
from sklearn.linear_model import LogisticRegression

from app.auth import get_current_user
from app.config import supabase
from app.models.performance import (
    MatchPredictionRequest,
    MatchPredictionResponse,
    PerformanceTrendResponse,
)

router = APIRouter()


@router.get("/performance-trend", response_model=PerformanceTrendResponse)
def get_performance_trend(user: dict = Depends(get_current_user)):
    response = (
        supabase.table("matches")
        .select("result, match_date")
        .eq("wrestler_id", user["sub"])
        .order("match_date")
        .execute()
    )
    matches = response.data

    if not matches:
        return PerformanceTrendResponse(
            win_rate=0.0,
            recent_win_rate=0.0,
            trend="stable",
            insight="Log some matches to start seeing trends.",
        )

    total = len(matches)
    wins = sum(1 for m in matches if m["result"] == "win")
    win_rate = wins / total

    recent = matches[-10:]
    recent_wins = sum(1 for m in recent if m["result"] == "win")
    recent_win_rate = recent_wins / len(recent)

    if recent_win_rate > win_rate + 0.10:
        trend = "improving"
    elif recent_win_rate < win_rate - 0.10:
        trend = "declining"
    else:
        trend = "stable"

    direction = "up" if trend == "improving" else "down" if trend == "declining" else "steady"
    insight = f"You win {win_rate:.0%} of your matches overall, and you're trending {direction} recently."

    return PerformanceTrendResponse(
        win_rate=round(win_rate, 4),
        recent_win_rate=round(recent_win_rate, 4),
        trend=trend,
        insight=insight,
    )


@router.post("/match-outcome", response_model=MatchPredictionResponse)
def predict_match_outcome(
    body: MatchPredictionRequest,
    user: dict = Depends(get_current_user),
):
    matches_resp = (
        supabase.table("matches")
        .select("result, match_date, win_type")
        .eq("wrestler_id", user["sub"])
        .order("match_date")
        .execute()
    )
    matches = matches_resp.data

    if len(matches) < 10:
        return MatchPredictionResponse(
            win_probability=0.5,
            confidence="low",
            factors=["Not enough match history yet — log more matches to improve this prediction"],
        )

    # Query average weight over the last 7 days for factor context
    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    weight_resp = (
        supabase.table("weight_logs")
        .select("weight")
        .eq("wrestler_id", user["sub"])
        .gte("logged_at", since)
        .execute()
    )
    recent_weights = [r["weight"] for r in weight_resp.data]
    avg_recent_weight = sum(recent_weights) / len(recent_weights) if recent_weights else None

    # Build per-match training features: rolling win rate + rolling pin rate
    X, y = [], []
    for i, match in enumerate(matches):
        prior = matches[max(0, i - 5):i]
        prior_wins = sum(1 for m in prior if m["result"] == "win")
        rolling_wr = prior_wins / len(prior) if prior else 0.5

        wins_before = [m for m in matches[:i] if m["result"] == "win"]
        pins_before = sum(1 for m in wins_before if m.get("win_type") == "pin")
        rolling_pr = pins_before / len(wins_before) if wins_before else 0.0

        X.append([rolling_wr, rolling_pr])
        y.append(1 if match["result"] == "win" else 0)

    X, y = np.array(X), np.array(y)

    if len(set(y.tolist())) < 2:
        win_prob = float(np.mean(y))
        return MatchPredictionResponse(
            win_probability=round(win_prob, 4),
            confidence="medium",
            factors=["Win/loss record is too one-sided to model — keep logging matches"],
        )

    model = LogisticRegression()
    model.fit(X, y)

    last_5 = matches[-5:]
    recent_win_rate = sum(1 for m in last_5 if m["result"] == "win") / len(last_5)

    all_wins = [m for m in matches if m["result"] == "win"]
    pins = sum(1 for m in all_wins if m.get("win_type") == "pin")
    pin_rate = pins / len(all_wins) if all_wins else 0.0

    win_prob = float(model.predict_proba(np.array([[recent_win_rate, pin_rate]]))[0][1])

    # Apply lbs_from_class adjustment: each lb over class reduces win probability by 1%
    lbs_from_class = body.your_weight_on_day - body.target_weight_class
    if lbs_from_class > 0:
        win_prob = max(0.01, win_prob - lbs_from_class * 0.01)
    win_prob = min(win_prob, 0.99)

    confidence = "high" if len(matches) >= 30 else "medium"

    # Build readable factors
    factors = []
    if lbs_from_class > 0:
        factors.append(f"You're {lbs_from_class:.1f} lbs over your weight class")
    elif lbs_from_class < 0:
        factors.append(f"You're {abs(lbs_from_class):.1f} lbs under your weight class — solid cut")
    else:
        factors.append("You're right at your weight class")

    recent_wins_n = sum(1 for m in last_5 if m["result"] == "win")
    if recent_wins_n >= 4:
        factors.append(f"Strong recent form — {recent_wins_n} wins in last 5 matches")
    elif recent_wins_n <= 1:
        factors.append(f"Struggling recently — only {recent_wins_n} win(s) in last 5 matches")
    else:
        factors.append(f"{recent_wins_n} wins in your last 5 matches")

    if pin_rate >= 0.5:
        factors.append(f"High pin rate ({pin_rate:.0%}) shows finishing strength")
    elif avg_recent_weight is not None:
        factors.append(f"Your average weight this week is {avg_recent_weight:.1f} lbs")

    return MatchPredictionResponse(
        win_probability=round(win_prob, 4),
        confidence=confidence,
        factors=factors[:3],
    )
