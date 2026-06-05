from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from app.auth import get_current_user
from app.models.weight import WeightCutRequest
from app.services.food import get_meals

router = APIRouter()


# ─────────────────────────────────────────────────────────────
# POST /predict/meal-plan
# ─────────────────────────────────────────────────────────────

@router.post("/meal-plan")
def predict_meal_plan(
    body: WeightCutRequest,
    user: dict = Depends(get_current_user),
):
    base_calories = body.current_weight * 15
    lbs_to_cut = body.current_weight - body.target_weight_class
    daily_deficit = (lbs_to_cut / body.days_until_weigh_in) * 3500
    target_calories = max(1200.0, base_calories - daily_deficit)

    protein = body.current_weight * 1.0                    # g — preserve muscle
    fat = (target_calories * 0.25) / 9                     # g
    carbs = (target_calories - protein * 4 - fat * 9) / 4  # g — remaining calories

    meals = get_meals(target_calories, protein, carbs, fat)

    total_sodium = sum(m.get("sodium", 0) for m in meals)
    sodium_target = 1500

    return {
        "daily_calories": round(target_calories),
        "daily_macros": {
            "protein": round(protein),
            "carbs": round(max(0, carbs)),
            "fat": round(fat),
            "sodium": total_sodium,
        },
        "sodium_target": sodium_target,
        "sodium_warning": total_sodium > sodium_target,
        "meals": meals,
    }


# ─────────────────────────────────────────────────────────────
# POST /predict/recovery-protocol
# ─────────────────────────────────────────────────────────────

class RecoveryRequest(BaseModel):
    weight_before_cut: float
    weight_after_cut: float
    hours_until_match: int = Field(gt=0)


@router.post("/recovery-protocol")
def predict_recovery_protocol(
    body: RecoveryRequest,
    user: dict = Depends(get_current_user),
):
    lbs_cut = body.weight_before_cut - body.weight_after_cut
    fluids_oz = lbs_cut * 16  # 1 lb ≈ 16 oz fluid

    # Recovery-appropriate macros: high carb, moderate protein, low fat
    recovery_calories = 600.0
    recovery_protein = 30.0
    recovery_carbs = 90.0
    recovery_fat = 8.0
    meals = get_meals(recovery_calories, recovery_protein, recovery_carbs, recovery_fat)

    if body.hours_until_match >= 3:
        timeline = [
            {
                "hours_before_match": body.hours_until_match,
                "action": "Drink 16oz water with electrolytes immediately — aim for a drink containing at least 300mg sodium",
            },
            {
                "hours_before_match": 2,
                "action": "Eat recovery meal — high carb, moderate protein, low fat",
            },
            {
                "hours_before_match": 0.5,
                "action": "Light snack (banana, crackers). Stop drinking large amounts.",
            },
        ]
    else:
        timeline = [
            {
                "hours_before_match": body.hours_until_match,
                "action": "Sip fluids slowly. Eat only light, easily digestible foods — no heavy meals.",
            },
        ]

    return {
        "fluids_oz": round(fluids_oz, 1),
        "sodium_target_mg": 1500,
        "meals": meals,
        "timeline": timeline,
    }
