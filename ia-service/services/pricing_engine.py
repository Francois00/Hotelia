"""
Dynamic pricing engine.
Multiplies tarifa_base by occupancy, lead-time, DOW, seasonality and channel factors.
Clamps to [70%, 250%] of base rate and rounds to nearest 5 PEN.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


# ─── Factor tables ────────────────────────────────────────────────────────────

OCC_BRACKETS = [
    (0.90, 1.35),
    (0.75, 1.20),
    (0.60, 1.10),
    (0.40, 1.00),
    (0.20, 0.90),
    (0.00, 0.80),
]

LEAD_BRACKETS = [
    (1,  1.25),
    (3,  1.15),
    (7,  1.05),
    (14, 1.00),
    (30, 0.95),
]
LEAD_FAR = 0.88  # >30 days

DOW_FACTORS = {4: 1.20, 5: 1.20, 6: 0.90, 0: 0.85}  # Fri, Sat, Sun, Mon
DOW_DEFAULT = 1.00

CHANNEL_FACTORS = {
    "DIRECTO":     1.00,
    "BOOKING_COM": 1.18,
    "EXPEDIA":     1.20,
    "AIRBNB":      1.15,
    "WHATSAPP":    0.95,
}


def _occ_factor(pct: float) -> float:
    for threshold, factor in OCC_BRACKETS:
        if pct >= threshold:
            return factor
    return 0.80


def _lead_factor(days_ahead: int) -> float:
    for threshold, factor in LEAD_BRACKETS:
        if days_ahead <= threshold:
            return factor
    return LEAD_FAR


def _dow_factor(entrada: date, salida: date) -> float:
    noches = (salida - entrada).days
    if noches == 0:
        return DOW_DEFAULT
    total = sum(
        DOW_FACTORS.get((entrada + timedelta(days=i)).weekday(), DOW_DEFAULT)
        for i in range(noches)
    )
    return total / noches


def _easter(year: int) -> date:
    try:
        from dateutil.easter import easter
        return easter(year)
    except Exception:
        a = year % 19
        b, c = divmod(year, 100)
        d, e = divmod(b, 4)
        f = (b + 8) // 25
        g = (b - f + 1) // 3
        h = (19 * a + b - d - g + 15) % 30
        i, k = divmod(c, 4)
        l = (32 + 2 * e + 2 * i - h - k) % 7
        m = (a + 11 * h + 22 * l) // 451
        mo = (h + l - 7 * m + 114) // 31
        day = ((h + l - 7 * m + 114) % 31) + 1
        return date(year, mo, day)


def _season_factor(entrada: date, salida: date) -> float:
    noches = max(1, (salida - entrada).days)
    total  = 0.0
    for i in range(noches):
        d = entrada + timedelta(days=i)
        f = 1.0
        # Peruvian summer Dec 15 – Jan 15
        if (d.month == 12 and d.day >= 15) or (d.month == 1 and d.day <= 15):
            f = 1.25
        # Semana Santa ±5 days
        easter = _easter(d.year)
        if abs((d - easter).days) <= 5:
            f = max(f, 1.30)
        # Feria Arequipa Aug 4-16
        if d.month == 8 and 4 <= d.day <= 16:
            f = max(f, 1.35)
        # Fiestas Patrias Jul 26-29
        if d.month == 7 and 26 <= d.day <= 29:
            f = max(f, 1.20)
        total += f
    return total / noches


def _round5(x: float) -> float:
    return round(x / 5) * 5


# ─── Public API ───────────────────────────────────────────────────────────────

def calcular_tarifa(
    habitacion_id: str,
    fecha_entrada: str,
    fecha_salida: str,
    canal: str = "DIRECTO",
    db: Session | None = None,
) -> dict[str, Any]:

    entrada = date.fromisoformat(fecha_entrada)
    salida  = date.fromisoformat(fecha_salida)
    noches  = max(1, (salida - entrada).days)
    hoy     = date.today()

    # ── Base rate from DB ──────────────────────────────────────────────────
    tarifa_base = 100.0  # fallback
    if db is not None:
        row = db.execute(
            text("SELECT tarifa_base FROM habitaciones WHERE id = :id"),
            {"id": habitacion_id},
        ).fetchone()
        if row:
            tarifa_base = float(row[0])

    # ── Current occupancy ──────────────────────────────────────────────────
    ocupacion_pct = 0.0
    if db is not None:
        total = db.execute(text("SELECT COUNT(*) FROM habitaciones")).scalar() or 1
        occupied = db.execute(text("""
            SELECT COUNT(*) FROM reservas
            WHERE estado::text = 'CHECKIN_REALIZADO'
              AND fecha_entrada <= CURRENT_DATE
              AND fecha_salida   > CURRENT_DATE
        """)).scalar() or 0
        ocupacion_pct = occupied / total

    # ── Lead time ──────────────────────────────────────────────────────────
    days_ahead = max(0, (entrada - hoy).days)

    # ── All factors ───────────────────────────────────────────────────────
    occ_f    = _occ_factor(ocupacion_pct)
    lead_f   = _lead_factor(days_ahead)
    dow_f    = _dow_factor(entrada, salida)
    season_f = _season_factor(entrada, salida)
    canal_f  = CHANNEL_FACTORS.get(canal.upper(), 1.00)

    multiplicador = occ_f * lead_f * dow_f * season_f * canal_f

    tarifa_minima    = tarifa_base * 0.70
    tarifa_maxima    = tarifa_base * 2.50
    tarifa_raw       = tarifa_base * multiplicador
    tarifa_final     = _round5(max(tarifa_minima, min(tarifa_maxima, tarifa_raw)))

    return {
        "habitacion_id":      habitacion_id,
        "fecha_entrada":      fecha_entrada,
        "fecha_salida":       fecha_salida,
        "num_noches":         noches,
        "canal":              canal,
        "tarifa_base":        tarifa_base,
        "tarifa_recomendada": tarifa_final,
        "tarifa_total":       tarifa_final * noches,
        "tarifa_minima":      round(tarifa_minima, 2),
        "tarifa_maxima":      round(tarifa_maxima, 2),
        "factores": {
            "ocupacion_actual_pct": round(ocupacion_pct * 100, 2),
            "ocupacion_factor":     occ_f,
            "lead_time_dias":       days_ahead,
            "lead_time_factor":     lead_f,
            "dow_factor":           round(dow_f, 4),
            "seasonality_factor":   round(season_f, 4),
            "canal_factor":         canal_f,
            "multiplicador_total":  round(multiplicador, 4),
        },
    }
