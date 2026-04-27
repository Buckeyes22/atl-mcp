---
description: "LSTM/GRU patterns: sequence windows, leakage prevention, reproducibility, and inference alignment"
globs: ["src/**/*.py", "models/**/*.py", "training/**/*.py", "notebooks/**/*.ipynb"]
alwaysApply: false
---

# LSTM / GRU — ML Module

**Targets:** Recurrent neural sequence models
**Appended to base CLAUDE.md when recurrent sequence modeling is in use.**

---

## Sequence Modeling Rules

1. Define sequence windows, horizon, and padding/masking behavior explicitly.
2. Keep training, evaluation, and serving sequence construction aligned. A model is not production-ready if inference windows differ silently from training windows.
3. Prevent temporal leakage rigorously.

## Training and Evaluation

4. Capture normalization, windowing, and label-generation logic as reproducible code, not notebook-only steps.
5. Use validation that matches the forecasting or sequence prediction setting.
6. Compare against strong baselines before accepting model complexity.

## Serving

7. Inference code must validate sequence length, missing data handling, and fallback behavior.
8. Keep model artifacts, scalers, and feature-order assumptions versioned together.
