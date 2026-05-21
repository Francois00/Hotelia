"""
Predictive maintenance: rule-based risk scoring per room.
No ML needed — insufficient historical data for probabilistic models.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def analizar_habitacion(habitacion_id: str, db: Session) -> dict[str, Any]:
    # Basic room info
    hab_row = db.execute(text("""
        SELECT numero, tipo::text, piso FROM habitaciones WHERE id = :id
    """), {"id": habitacion_id}).fetchone()

    if not hab_row:
        raise ValueError(f"Habitacion {habitacion_id} not found")

    numero, tipo, piso = hab_row[0], hab_row[1], int(hab_row[2])

    # Total checkins (proxy for wear)
    total_checkins = db.execute(text("""
        SELECT COUNT(*) FROM reservas
        WHERE habitacion_id = :id
          AND estado::text IN ('CHECKIN_REALIZADO', 'CHECKOUT_REALIZADO')
    """), {"id": habitacion_id}).scalar() or 0
    total_checkins = int(total_checkins)

    # Days since last maintenance event
    last_maint = db.execute(text("""
        SELECT MAX(updated_at) FROM alertas_mantenimiento
        WHERE habitacion_id = :id
          AND activa = FALSE
    """), {"id": habitacion_id}).scalar()

    if last_maint:
        days_since = (date.today() - last_maint.date()).days
    else:
        days_since = 9999  # never maintained

    # Active alerts
    alert_rows = db.execute(text("""
        SELECT nivel_alerta, descripcion, frecuencia
        FROM alertas_mantenimiento
        WHERE habitacion_id = :id AND activa = TRUE
        ORDER BY created_at DESC
    """), {"id": habitacion_id}).fetchall()

    alta_count  = sum(1 for r in alert_rows if r[0] == "alta")
    media_count = sum(1 for r in alert_rows if r[0] == "media")

    # Recurring issues last 60 days
    cutoff60 = date.today() - timedelta(days=60)
    recurrentes = db.execute(text("""
        SELECT tipo, descripcion, COUNT(*) AS cnt
        FROM alertas_mantenimiento
        WHERE habitacion_id = :id
          AND created_at >= :cutoff
        GROUP BY tipo, descripcion
        HAVING COUNT(*) > 1
    """), {"id": habitacion_id, "cutoff": cutoff60}).fetchall()
    recurrentes_count = len(recurrentes)

    # ── Risk score calculation ──
    risk = 0.0
    if total_checkins > 100:
        risk += 0.15
    if total_checkins > 300:
        risk += 0.20
    if days_since > 30:
        risk += 0.15
    if days_since > 90:
        risk += 0.20
    risk += min(alta_count  * 0.25, 0.50)
    risk += min(media_count * 0.15, 0.30)
    if recurrentes_count > 0:
        risk += 0.10

    risk = round(min(1.0, risk), 3)

    if risk >= 0.70:
        risk_label = "critico"
        proxima = date.today() + timedelta(days=1)
    elif risk >= 0.45:
        risk_label = "alto"
        proxima = date.today() + timedelta(days=7)
    elif risk >= 0.25:
        risk_label = "medio"
        proxima = date.today() + timedelta(days=30)
    else:
        risk_label = "bajo"
        proxima = date.today() + timedelta(days=90)

    acciones: list[str] = []
    for row in alert_rows:
        desc = row[1]
        if desc:
            acciones.append(f"Revisar: {desc}")
    for row in recurrentes:
        acciones.append(f"Problema recurrente — {row[1]}: {int(row[2])} ocurrencias")

    return {
        "habitacion_id":                habitacion_id,
        "numero":                       numero,
        "tipo":                         tipo,
        "piso":                         piso,
        "risk_score":                   risk,
        "risk_label":                   risk_label,
        "proxima_revision_recomendada": proxima.isoformat(),
        "factores": {
            "total_checkins":             total_checkins,
            "days_since_last_maintenance": days_since if days_since < 9999 else None,
            "alertas_activas_alta":        alta_count,
            "alertas_activas_media":       media_count,
            "problemas_recurrentes":       recurrentes_count,
        },
        "acciones_recomendadas": list(dict.fromkeys(acciones)),  # deduplicate
    }


def analizar_hotel_completo(db: Session) -> dict[str, Any]:
    from datetime import datetime, timezone

    hab_ids = db.execute(text(
        "SELECT id FROM habitaciones ORDER BY piso, numero"
    )).fetchall()

    resultados: list[dict] = []
    for (hab_id,) in hab_ids:
        try:
            r = analizar_habitacion(str(hab_id), db)
            resultados.append(r)
        except Exception as exc:
            logger.warning("analizar_habitacion error for %s: %s", hab_id, exc)

    criticos     = [r for r in resultados if r["risk_label"] == "critico"]
    altos        = [r for r in resultados if r["risk_label"] == "alto"]
    medios       = [r for r in resultados if r["risk_label"] == "medio"]
    bajos        = [r for r in resultados if r["risk_label"] == "bajo"]

    # Next 7 days schedule
    hoy = date.today()
    en_7_dias = hoy + timedelta(days=7)
    proximas = sorted(
        [r for r in resultados
         if r["proxima_revision_recomendada"] and
            date.fromisoformat(r["proxima_revision_recomendada"]) <= en_7_dias],
        key=lambda r: r["proxima_revision_recomendada"],
    )

    return {
        "generado_en":              datetime.now(timezone.utc).isoformat(),
        "habitaciones_criticas":    criticos,
        "habitaciones_alto_riesgo": altos,
        "resumen": {
            "critico": len(criticos),
            "alto":    len(altos),
            "medio":   len(medios),
            "bajo":    len(bajos),
        },
        "proximas_revisiones": proximas[:20],
    }
