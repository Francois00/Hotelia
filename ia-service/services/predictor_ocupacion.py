"""
Prophet-based occupancy forecasting.
Caches trained model to /tmp/prophet_model.pkl (24-hour TTL).
Falls back to synthetic seed data when real history < 30 data points.
"""
from __future__ import annotations

import logging
import os
import pickle
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

MODEL_PKL  = Path("/tmp/prophet_model.pkl")
META_PKL   = Path("/tmp/prophet_metadata.pkl")
CACHE_TTL  = 86_400  # seconds (24 h)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _easter_date(year: int) -> date:
    """Compute Easter Sunday (Gregorian) for a given year."""
    try:
        from dateutil.easter import easter
        return easter(year)
    except Exception:
        # Fallback: Anonymous Gregorian algorithm
        a = year % 19
        b, c = divmod(year, 100)
        d, e = divmod(b, 4)
        f = (b + 8) // 25
        g = (b - f + 1) // 3
        h = (19 * a + b - d - g + 15) % 30
        i, k = divmod(c, 4)
        l = (32 + 2 * e + 2 * i - h - k) % 7
        m = (a + 11 * h + 22 * l) // 451
        month = (h + l - 7 * m + 114) // 31
        day   = ((h + l - 7 * m + 114) % 31) + 1
        return date(year, month, day)


def _apply_regressors(df: pd.DataFrame) -> pd.DataFrame:
    """Adds feria_arequipa and semana_santa columns to a DataFrame with 'ds' column."""

    def _feria(dt: pd.Timestamp) -> float:
        return 1.0 if (dt.month == 8 and 4 <= dt.day <= 16) else 0.0

    def _semana_santa(dt: pd.Timestamp) -> float:
        easter = _easter_date(dt.year)
        diff = abs((dt.date() - easter).days)
        return 1.0 if diff <= 3 else 0.0

    df = df.copy()
    df["feria_arequipa"] = df["ds"].apply(_feria)
    df["semana_santa"]   = df["ds"].apply(_semana_santa)
    return df


def _generate_synthetic(total_hab: int) -> pd.DataFrame:
    """18 months of synthetic occupancy when real history is sparse."""
    rng   = np.random.default_rng(42)
    start = date.today() - timedelta(days=548)
    rows  = []
    for i in range(548):
        d   = start + timedelta(days=i)
        occ = 65.0
        if d.weekday() >= 5:          # weekend
            occ += 15
        if d.month in (12, 1, 2, 3):  # Peruvian summer
            occ += 20
        occ += rng.normal(0, 8)
        occ  = float(np.clip(occ, 0, 100))
        rows.append({"ds": pd.Timestamp(d), "y": occ})
    return pd.DataFrame(rows)


# ─── Model cache helpers ──────────────────────────────────────────────────────

def _load_cache() -> tuple[Any, dict] | tuple[None, None]:
    if not MODEL_PKL.exists() or not META_PKL.exists():
        return None, None
    meta = pickle.loads(META_PKL.read_bytes())
    trained_at: datetime = meta.get("trained_at", datetime.min)
    age = (datetime.now(timezone.utc) - trained_at.replace(tzinfo=timezone.utc)
           if trained_at.tzinfo is None
           else datetime.now(timezone.utc) - trained_at)
    if age.total_seconds() > CACHE_TTL:
        return None, None
    model = pickle.loads(MODEL_PKL.read_bytes())
    return model, meta


def _save_cache(model: Any, meta: dict) -> None:
    MODEL_PKL.write_bytes(pickle.dumps(model))
    META_PKL.write_bytes(pickle.dumps(meta))


def clear_cache() -> None:
    MODEL_PKL.unlink(missing_ok=True)
    META_PKL.unlink(missing_ok=True)


def get_cache_status() -> dict:
    if not META_PKL.exists():
        return {"cached": False}
    meta = pickle.loads(META_PKL.read_bytes())
    return {
        "cached":        True,
        "trained_at":    meta.get("trained_at"),
        "num_rows":      meta.get("num_rows", 0),
        "model_version": "prophet-1.1.5",
    }


# ─── Main function ────────────────────────────────────────────────────────────

def entrenar_y_predecir(dias: int = 90, db: Session | None = None) -> list[dict]:
    # Try cache first
    cached_model, meta = _load_cache()
    if cached_model is not None:
        logger.info("Using cached Prophet model (trained_at=%s)", meta.get("trained_at"))
        return _predict(cached_model, meta.get("total_habitaciones", 10), dias)

    # ── Step 1: Pull real historical data ─────────────────────────────────────
    total_hab  = 10  # default
    real_rows: list[dict] = []

    if db is not None:
        try:
            count_row = db.execute(text("SELECT COUNT(*) FROM habitaciones")).scalar()
            total_hab = int(count_row or 10) or 10

            res = db.execute(text("""
                SELECT fecha_entrada::date, fecha_salida::date
                FROM reservas
                WHERE estado::text NOT IN ('CANCELADA', 'NO_SHOW')
                  AND fecha_entrada >= NOW() - INTERVAL '2 years'
            """))
            occ_days: list[date] = []
            for row in res:
                entrada = row[0]
                salida  = row[1]
                if entrada and salida:
                    d = entrada
                    while d < salida:
                        occ_days.append(d)
                        d += timedelta(days=1)

            counter = Counter(occ_days)
            for d, cnt in counter.items():
                real_rows.append({
                    "ds": pd.Timestamp(d),
                    "y":  min(100.0, cnt / total_hab * 100),
                })
        except Exception as exc:
            logger.warning("Error pulling historical data: %s", exc)

    # ── Step 2: Synthetic seed if insufficient history ─────────────────────────
    real_df = pd.DataFrame(real_rows) if real_rows else pd.DataFrame(columns=["ds", "y"])

    if len(real_df) < 30:
        logger.info("Insufficient history (%d rows). Using synthetic seed.", len(real_df))
        synth_df = _generate_synthetic(total_hab)
        if not real_df.empty:
            real_dates = set(real_df["ds"].dt.date)
            synth_df = synth_df[~synth_df["ds"].dt.date.isin(real_dates)]
        df = pd.concat([synth_df, real_df], ignore_index=True).sort_values("ds").reset_index(drop=True)
    else:
        df = real_df.sort_values("ds").reset_index(drop=True)

    num_rows = len(df)
    df = _apply_regressors(df)

    # ── Step 3: Train Prophet ─────────────────────────────────────────────────
    logger.info("Training Prophet on %d rows …", num_rows)
    from prophet import Prophet  # lazy import — heavy

    m = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False,
        seasonality_mode="multiplicative",
        interval_width=0.80,
    )
    try:
        m.add_country_holidays(country_name="PE")
    except Exception:
        logger.warning("Could not add PE holidays; continuing without.")

    m.add_regressor("feria_arequipa")
    m.add_regressor("semana_santa")

    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        m.fit(df)

    meta = {
        "trained_at":        datetime.now(timezone.utc),
        "num_rows":          num_rows,
        "total_habitaciones": total_hab,
    }
    _save_cache(m, meta)
    logger.info("Prophet trained and cached.")

    return _predict(m, total_hab, dias)


def _predict(m: Any, total_hab: int, dias: int) -> list[dict]:
    future = m.make_future_dataframe(periods=dias, freq="D")
    future = _apply_regressors(future)

    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        forecast = m.predict(future)

    tail = forecast.tail(dias)[["ds", "yhat", "yhat_lower", "yhat_upper"]]

    result = []
    for _, row in tail.iterrows():
        pred   = float(np.clip(row["yhat"],       0, 100))
        lower  = float(np.clip(row["yhat_lower"], 0, 100))
        upper  = float(np.clip(row["yhat_upper"], 0, 100))
        alerta = None
        if pred < 40:
            alerta = "baja_ocupacion"
        elif pred > 85:
            alerta = "alta_demanda"
        result.append({
            "fecha":               row["ds"].strftime("%Y-%m-%d"),
            "ocupacion_predicha":  round(pred,  2),
            "intervalo_inferior":  round(lower, 2),
            "intervalo_superior":  round(upper, 2),
            "alerta":              alerta,
        })
    return result
