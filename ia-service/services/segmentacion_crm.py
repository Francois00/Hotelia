"""
CRM aggregate stats: segment distribution, top VIP guests, inactivity counts.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def obtener_segmento_stats(db: Session) -> dict[str, Any]:
    # Segment distribution
    dist_rows = db.execute(text("""
        SELECT
            COALESCE(segmento::text, 'SIN_SEGMENTO') AS seg,
            COUNT(*)                                  AS cnt,
            COALESCE(AVG(ltv), 0)                     AS avg_ltv,
            COALESCE(SUM(ltv), 0)                     AS total_ltv
        FROM huespedes
        WHERE activo = TRUE
        GROUP BY segmento
        ORDER BY total_ltv DESC
    """)).fetchall()

    distribucion = [
        {
            "segmento":  row[0],
            "cantidad":  int(row[1]),
            "ltv_medio": round(float(row[2]), 2),
            "ltv_total": round(float(row[3]), 2),
        }
        for row in dist_rows
    ]

    total_activos = sum(d["cantidad"] for d in distribucion)

    # Top 10 VIP guests by LTV
    vip_rows = db.execute(text("""
        SELECT
            h.id,
            h.nombre,
            h.apellido,
            h.email,
            COALESCE(h.ltv, 0)      AS ltv,
            h.segmento::text        AS segmento,
            COUNT(r.id) FILTER (
                WHERE r.estado::text = 'CHECKOUT_REALIZADO'
            )                       AS estancias,
            MAX(r.fecha_salida)     AS ultima_visita
        FROM huespedes h
        LEFT JOIN reservas r ON r.huesped_id = h.id
        WHERE h.activo = TRUE
          AND (h.segmento::text = 'VIP' OR h.ltv >= 1000)
        GROUP BY h.id, h.nombre, h.apellido, h.email, h.ltv, h.segmento
        ORDER BY ltv DESC
        LIMIT 10
    """)).fetchall()

    top_vip = [
        {
            "huesped_id":   str(row[0]),
            "nombre":       f"{row[1]} {row[2]}",
            "email":        row[3],
            "ltv":          round(float(row[4]), 2),
            "segmento":     row[5],
            "estancias":    int(row[6] or 0),
            "ultima_visita": row[7].isoformat() if row[7] else None,
        }
        for row in vip_rows
    ]

    # Inactive guests: no stay in last 180 days
    cutoff = date.today() - timedelta(days=180)
    inactivos = db.execute(text("""
        SELECT COUNT(DISTINCT h.id)
        FROM huespedes h
        WHERE h.activo = TRUE
          AND NOT EXISTS (
              SELECT 1 FROM reservas r
              WHERE r.huesped_id = h.id
                AND r.fecha_salida >= :cutoff
                AND r.estado::text NOT IN ('CANCELADA', 'NO_SHOW')
          )
    """), {"cutoff": cutoff}).scalar() or 0

    # Average nights per stay
    avg_row = db.execute(text("""
        SELECT AVG(
            (EXTRACT(EPOCH FROM fecha_salida) - EXTRACT(EPOCH FROM fecha_entrada))
            / 86400.0
        )
        FROM reservas
        WHERE estado::text = 'CHECKOUT_REALIZADO'
    """)).scalar()
    avg_noches = round(float(avg_row), 2) if avg_row else 0.0

    # Reservas in next 30 days (upcoming)
    proximas = db.execute(text("""
        SELECT COUNT(*) FROM reservas
        WHERE estado::text IN ('CONFIRMADA', 'CHECKIN_REALIZADO')
          AND fecha_entrada BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
    """)).scalar() or 0

    return {
        "total_huespedes_activos": total_activos,
        "distribucion_segmentos":  distribucion,
        "top_vip":                 top_vip,
        "huespedes_inactivos_180d": int(inactivos),
        "avg_noches_por_estancia":  avg_noches,
        "reservas_proximos_30d":    int(proximas),
    }
