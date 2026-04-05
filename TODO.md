# Pursuit Wrestling App — Todo List
 
## How this works
- **Planner** finds issues and adds them here
- **Builder** picks the next unchecked item and implements it
- **Reviewer** checks the work, writes tests, then marks it done
- One item at a time. Builder does not move on until Reviewer marks it complete.
 
---
 
## Nutrition Features

- [x] Migration: add USDA_API_KEY to Fly.io secrets and .env.example 
      (originally Nutritionix — swapped to USDA FoodData Central).

- [x] Backend: create app/cache.py — simple in-memory dict cache with 
      TTL support. Functions: get_cached(key) returns data if exists 
      and not expired, None otherwise. set_cached(key, data, ttl=3600) 
      stores data with expiry timestamp. Cache key is MD5 hash of 
      macro targets (calories, protein, carbs, fat) rounded to nearest 
      50 to increase cache hit rate.

- [x] Backend: create app/services/food.py — USDA FoodData Central API 
      wrapper (originally nutritionix.py, swapped). Function 
      get_meals(calories, protein, carbs, fat) checks cache first, 
      calls USDA if miss, stores result in cache. Two calls per food: 
      search → fdcId, then food/{fdcId} → nutrients. Scales per-100g 
      data by servingSize. On API failure returns hardcoded fallback 
      list so the endpoint never crashes.

- [x] Backend: implement POST /predict/meal-plan in 
      app/routers/nutrition.py. Auth required. Registered in main.py.

- [x] Backend: implement POST /predict/recovery-protocol in 
      app/routers/nutrition.py. Auth required.

- [x] Frontend: build /nutrition page with two sections (cut meal 
      planner + recovery protocol). Added to Layout.jsx nav and 
      App.jsx routes. React Query with staleTime: 300000. Silent 
      failure: "Meal suggestions unavailable right now."

- [x] Swap Nutritionix API for USDA FoodData Central API in 
      app/services/nutritionix.py (rename file to food.py). 
      USDA is free, unrestricted, caching explicitly allowed. 
      API key at api.nal.usda.gov. Note: USDA returns per-100g 
      data so serving size math needed — multiply by serving_size/100. 
      Two calls per food item: search endpoint to get fdcId, 
      then nutrients endpoint for full macro data. Everything 
      else (cache, endpoints, frontend) stays the same.
_Last updated by: Reviewer — 2026-04-05 (nutrition feature approved, 125 tests across 16 files)_
 