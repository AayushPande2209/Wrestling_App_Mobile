import os
import httpx
from app.cache import get_cached, set_cached, make_nutrition_key

USDA_API_KEY = os.environ.get("USDA_API_KEY", "")
USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search"
USDA_FOOD_URL = "https://api.nal.usda.gov/fdc/v1/food/{fdc_id}"

# USDA nutrient IDs (stable across datasets)
_NID = {
    "calories": 1008,
    "protein":  1003,
    "fat":      1004,
    "carbs":    1005,
    "sodium":   1093,
}

# Fixed queries for the three meal slots — chosen for cut-friendliness.
# MVP trade-off: the macro targets only affect the cache key; the actual foods
# returned are always these three. A future improvement could vary the queries
# based on the macro profile (e.g. higher-carb options for recovery vs. cut).
_MEAL_QUERIES = [
    ("breakfast", "oatmeal cooked plain"),
    ("lunch",     "grilled chicken breast"),
    ("dinner",    "baked salmon fillet"),
]

FALLBACK_MEALS = [
    {"meal_type": "breakfast", "name": "Oatmeal with eggs",          "calories": 400, "protein": 25, "carbs": 45, "fat": 10, "sodium": 300},
    {"meal_type": "lunch",     "name": "Grilled chicken and rice",   "calories": 500, "protein": 40, "carbs": 50, "fat":  8, "sodium": 500},
    {"meal_type": "dinner",    "name": "Salmon with sweet potato",   "calories": 450, "protein": 35, "carbs": 40, "fat": 12, "sodium": 400},
]


def _extract_nutrients(food_detail: dict) -> dict:
    """
    Pull macro values from a USDA food detail object.
    USDA returns amounts per 100 g — scale by servingSize / 100.
    Falls back to 100 g if servingSize is absent or non-gram.
    """
    serving_g = food_detail.get("servingSize", 100.0)
    serving_unit = (food_detail.get("servingSizeUnit") or "g").lower()
    if serving_unit != "g":
        serving_g = 100.0  # can't convert non-gram units safely; use 100g

    scale = serving_g / 100.0

    nutrient_map: dict[int, float] = {}
    for fn in food_detail.get("foodNutrients", []):
        nid = fn.get("nutrient", {}).get("id")
        amt = fn.get("amount", 0.0) or 0.0
        if nid:
            nutrient_map[nid] = amt

    def get(nid):
        return round((nutrient_map.get(nid, 0.0)) * scale)

    return {
        "calories": get(_NID["calories"]),
        "protein":  get(_NID["protein"]),
        "carbs":    get(_NID["carbs"]),
        "fat":      get(_NID["fat"]),
        "sodium":   get(_NID["sodium"]),
    }


def _fetch_one(meal_type: str, query: str, fallback: dict, client: httpx.Client) -> dict:
    """
    Two-step USDA lookup:
      1. Search for query → grab first fdcId
      2. Fetch full food detail → extract nutrients
    Returns a meal dict; on any failure returns the fallback.
    """
    try:
        search_resp = client.get(
            USDA_SEARCH_URL,
            params={
                "query":    query,
                "dataType": "Foundation,SR Legacy",
                "pageSize": 1,
                "api_key":  USDA_API_KEY,
            },
            timeout=8.0,
        )
        search_resp.raise_for_status()
        foods = search_resp.json().get("foods", [])
        if not foods:
            return fallback

        fdc_id = foods[0]["fdcId"]

        detail_resp = client.get(
            USDA_FOOD_URL.format(fdc_id=fdc_id),
            params={"api_key": USDA_API_KEY},
            timeout=8.0,
        )
        detail_resp.raise_for_status()
        food_detail = detail_resp.json()

        nutrients = _extract_nutrients(food_detail)
        description = food_detail.get("description", query).title()

        return {"meal_type": meal_type, "name": description, **nutrients}

    except Exception:
        return fallback


def get_meals(calories: float, protein: float, carbs: float, fat: float) -> list[dict]:
    """
    Return a list of three meal suggestions.
    Checks the in-memory cache first. On any API failure (or missing key),
    returns FALLBACK_MEALS so the endpoint never crashes.
    """
    cache_key = make_nutrition_key(calories, protein, carbs, fat)
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    if not USDA_API_KEY:
        return FALLBACK_MEALS

    meals = []
    try:
        with httpx.Client() as client:
            for i, (meal_type, query) in enumerate(_MEAL_QUERIES):
                meal = _fetch_one(meal_type, query, FALLBACK_MEALS[i], client)
                meals.append(meal)
    except Exception:
        return FALLBACK_MEALS

    set_cached(cache_key, meals)
    return meals
