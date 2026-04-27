---
description: "XGBoost/LightGBM patterns: feature pipelines, leakage prevention, model evaluation, and inference contracts"
globs: ["src/**/*.py", "notebooks/**/*.ipynb", "models/**/*.py", "training/**/*.py"]
alwaysApply: false
---

# XGBoost / LightGBM — ML Module

**Targets:** XGBoost, LightGBM, tabular ML workflows
**Appended to base CLAUDE.md when gradient-boosted tree models are in use.**

---

## Modeling Discipline

1. Separate feature engineering, training, evaluation, and serving contracts.
2. Feature leakage is a correctness bug, not a tuning detail.
3. Keep feature definitions versioned and reproducible across training and inference.

## Evaluation Rules

4. Use time-aware or domain-appropriate validation splits. Do not rely on random splits when the business problem is temporal or grouped.
5. Track the metric that maps to the actual product objective, not just the easiest library default.
6. Compare against simple baselines before claiming model value.

## Serving and Inference

7. Keep inference input validation explicit.
8. Never let training-only columns or post-outcome labels leak into online feature construction.
9. Persist the preprocessing contract with the model artifact or equivalent serving layer.
