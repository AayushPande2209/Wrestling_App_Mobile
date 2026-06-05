import hashlib
import time

_store: dict = {}  # key -> (data, expires_at)


def get_cached(key: str):
    """Return cached data if present and not expired, else None."""
    entry = _store.get(key)
    if entry is None:
        return None
    data, expires_at = entry
    if time.time() > expires_at:
        del _store[key]
        return None
    return data


def set_cached(key: str, data, ttl: int = 3600) -> None:
    """Store data under key with a TTL in seconds."""
    _store[key] = (data, time.time() + ttl)


def make_nutrition_key(calories: float, protein: float, carbs: float, fat: float) -> str:
    """
    Cache key for nutrition targets.
    Values are rounded to the nearest 50 before hashing to increase hit rate
    across requests with nearly identical macros.
    """
    def r(v):
        return round(v / 50) * 50

    raw = f"{r(calories)}-{r(protein)}-{r(carbs)}-{r(fat)}"
    return hashlib.md5(raw.encode()).hexdigest()
