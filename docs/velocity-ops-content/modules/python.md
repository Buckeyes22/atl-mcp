---
description: "Python stack: ruff linting/formatting, mypy strict typing, pytest testing, FastAPI patterns, SQLAlchemy/Alembic conventions"
globs: ["**/*.py", "pyproject.toml", "setup.cfg", "mypy.ini", ".pre-commit-config.yaml"]
alwaysApply: false
---

# Python Stack — Stack Module

**Targets:** Python 3.11+, FastAPI, SQLAlchemy, ruff, mypy
**Appended to base CLAUDE.md when Python is the primary language.**

---

## 0. Setup

### Prerequisites

- Python 3.11+
- `uv` (recommended) or `pip` + `venv`

### Project config

All tool configuration lives in `pyproject.toml` (PEP 621). Do not use separate `setup.cfg`, `mypy.ini`, or `ruff.toml` files unless the project already has them — consolidate into `pyproject.toml`.

```toml
[project]
name = "my-project"
requires-python = ">=3.11"
```

### Virtual environment

```bash
# With uv (recommended)
uv venv
source .venv/bin/activate
uv pip install -e ".[dev]"

# With standard venv
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### Verify

```bash
python --version   # Must be 3.11+
mypy --version     # Type checker installed
ruff --version     # Linter installed
pytest --version   # Test runner installed
```

---

## 1. Type Checking (mypy)

1. All Python projects must use mypy in strict mode. Add to `pyproject.toml`:

```toml
[tool.mypy]
python_version = "3.11"
strict = true
warn_unreachable = true
disallow_untyped_defs = true
disallow_any_generics = true
warn_redundant_casts = true
warn_unused_ignores = true
no_implicit_reexport = true
```

2. `strict = true` enables: `disallow_untyped_defs`, `disallow_incomplete_defs`, `check_untyped_defs`, `disallow_untyped_decorators`, `no_implicit_optional`, `warn_return_any`, `disallow_any_generics`. Never disable individual sub-flags to work around type errors — fix the types.

3. No bare `Any`. Use `object` for values of unknown type — it requires explicit narrowing. If `Any` is unavoidable (third-party untyped library), add a `# type: ignore[import-untyped]` with the specific error code.

4. Never use `# type: ignore` without a specific error code. Always write `# type: ignore[specific-error]` with a comment explaining why.

5. Use `from __future__ import annotations` at the top of every module for modern annotation syntax (PEP 604 unions `X | Y`, PEP 585 generics `list[str]`).

---

## 2. Linting & Formatting (ruff)

6. Use ruff as the single tool for both linting and formatting. Configure in `pyproject.toml`:

```toml
[tool.ruff]
target-version = "py311"
line-length = 88

[tool.ruff.lint]
select = [
    "E",    # pycodestyle errors
    "F",    # pyflakes
    "W",    # pycodestyle warnings
    "S",    # flake8-bandit (security)
    "B",    # flake8-bugbear
    "DTZ",  # flake8-datetimez
    "UP",   # pyupgrade
    "I",    # isort
    "SIM",  # flake8-simplify
    "TCH",  # flake8-type-checking
    "RUF",  # ruff-specific rules
]

[tool.ruff.lint.per-file-ignores]
"tests/**/*.py" = ["S101"]  # Allow assert in tests
```

7. `ruff format` replaces Black. Do not install both. If the project already uses Black, migrate to `ruff format` — the output is identical.

8. Run linting and formatting as separate commands:

```bash
ruff check .            # Lint (with auto-fix: ruff check --fix .)
ruff format .           # Format
ruff check --diff .     # Preview lint changes
ruff format --diff .    # Preview format changes
```

---

## 3. Testing (pytest)

9. Use pytest as the test runner. Configure in `pyproject.toml`:

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
addopts = "-ra -q --strict-markers --strict-config"
markers = [
    "slow: marks tests as slow",
    "integration: marks integration tests",
]
```

10. Coverage with pytest-cov:

```toml
[tool.coverage.run]
source = ["src"]
branch = true

[tool.coverage.report]
fail_under = 70
show_missing = true
exclude_lines = [
    "pragma: no cover",
    "if TYPE_CHECKING:",
    "if __name__",
]
```

```bash
pytest --cov --cov-report=term-missing    # Run with coverage
pytest --cov --cov-fail-under=70          # Fail if below threshold
pytest -m "not slow"                       # Skip slow tests
pytest -m integration                      # Integration tests only
```

11. Use `conftest.py` for shared fixtures. Use `factory_boy` or `polyfactory` for test factories — never build complex test objects by hand.

12. Mock boundaries — same as base CLAUDE.md:
- **CAN mock:** external HTTP APIs, system clock, filesystem I/O, environment variables
- **MUST NOT mock:** the function under test, internal modules, database layer in integration tests, Pydantic validation

---

## 4. FastAPI Conventions

13. Pydantic models are the source of truth for data validation (equivalent of Zod in TypeScript). TypeScript types are inferred from Pydantic — never the reverse:

```python
from pydantic import BaseModel, Field

class CreateUserRequest(BaseModel):
    email: str = Field(..., description="User email", examples=["user@example.com"])
    name: str = Field(..., min_length=1, max_length=200)

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    model_config = {"from_attributes": True}  # Enable ORM mode
```

14. Use dependency injection via `Depends()` for shared logic (auth, database sessions, rate limiting). Never instantiate services directly in route handlers.

15. One router per domain. Register routers in the main app with a prefix:

```python
# app/main.py
from fastapi import FastAPI
from app.routers import users, posts, auth

app = FastAPI()
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(posts.router, prefix="/posts", tags=["posts"])
```

16. Return typed error responses. Never raise bare `HTTPException` without a detail body. Use a consistent error response model:

```python
from fastapi import HTTPException, status

class AppError(HTTPException):
    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(status_code=status_code, detail={"code": code, "message": message})

# Usage
raise AppError(code="USER_NOT_FOUND", message="No user with that ID", status_code=404)
```

---

## 5. SQLAlchemy / Alembic

17. Use SQLAlchemy 2.0+ with mapped classes and type annotations:

```python
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from datetime import datetime

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(unique=True, index=True)
    name: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
```

18. Alembic for migrations. Generate with `alembic revision --autogenerate -m "description"`. Never modify migration files after they have been merged to the main branch.

19. Session management — use async sessions with proper cleanup:

```python
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

engine = create_async_engine(DATABASE_URL)
async_session = async_sessionmaker(engine, expire_on_commit=False)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session
```

---

## 6. Pre-commit Hooks

20. Use the `pre-commit` framework instead of Husky. Configure `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.13.0
    hooks:
      - id: mypy
        additional_dependencies: []  # Add stubs as needed
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.5.0
    hooks:
      - id: detect-secrets
```

```bash
pre-commit install          # Install hooks
pre-commit run --all-files  # Run on all files
pre-commit autoupdate       # Update hook versions
```

---

## 7. Anti-patterns

These are the Python equivalents of the base CLAUDE.md anti-stub rules:

21. No bare `except:` — always specify the exception type. `except Exception:` is the minimum acceptable specificity:

```python
# Wrong — catches KeyboardInterrupt, SystemExit, GeneratorExit
try:
    result = do_work()
except:
    pass

# Correct
try:
    result = do_work()
except ValueError as e:
    logger.error("Invalid value: %s", e)
    raise
```

22. No `# type: ignore` without a specific error code. Always `# type: ignore[specific-error]`.

23. No `pass` as a function body where logic belongs — this is a stub. If a function cannot be implemented yet, raise `NotImplementedError` with a specific reason and mark with `# BLOCKED:`.

24. No mutable default arguments:

```python
# Wrong — shared mutable default
def process(items: list[str] = []) -> None: ...

# Correct
def process(items: list[str] | None = None) -> None:
    items = items or []
```

25. No wildcard imports (`from module import *`). Always use explicit named imports.

26. No relative imports beyond one parent. Use absolute imports from the package root:

```python
# Wrong
from ...utils.helpers import format_date

# Correct
from app.utils.helpers import format_date
```

---

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `error: Incompatible types in assignment` | mypy strict catches type mismatches | Fix the type annotation or add proper type narrowing |
| `error: Function is missing a return type annotation` | `disallow_untyped_defs` requires all annotations | Add `-> ReturnType` to function signature |
| `S101 Use of assert detected` | Bandit flags assert in non-test code | Move assert to tests or use proper validation |
| `DTZ003 Use of datetime.utcnow()` | Timezone-naive datetime is error-prone | Use `datetime.now(UTC)` instead |
| `B006 Mutable default argument` | Bugbear catches `def f(x=[])` | Use `None` default with conditional init |
