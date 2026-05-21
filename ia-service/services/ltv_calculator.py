"""
Customer LTV calculator and segmentation.
Segments: VIP (LTV>=3000 or stays>=10), FRECUENTE (LTV>=1000 or stays>=4),
OCASIONAL (stays>=1), NUEVO (no completed stays).
"""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# ─── Segmentation thresholds ─────────────────────────────────────────────────

def _asignar_segmento(ltv: float, num_estancias: int) -> str:
    if ltv >= 3000 or num_estancias >= 10:
        return "VIP"
    if ltv >= 1000 or num_estancias >= 4:
        return "FRECUENTE"
    if num_estancias >= 1:
        return "OCASIONAL"
    return "NUEVO"


def calcular_ltv(huesped_id: str, db: Session) -> dict[str, Any]:
    row = db.execute(text("""
        SELECT
            h.id,
            h.nombre,
            h.apellido,
            h.email,
            COUNT(r.id)                              AS num_reservas,
            COUNT(r.id) FILTER (
                WHERE r.estado::text = 'CHECKOUT_REALIZADO'
            )                                        AS num_estancias,
            COALESCE(SUM(r.tarifa_acordada) FILTER (
                WHERE r.estado::text = 'CHECKOUT_REALIZADO'
            ), 0)                                    AS ingresos_totales,
            MIN(r.fecha_entrada) FILTER (
                WHERE r.estado::text = 'CHECKOUT_REALIZADO'
            )                                        AS primera_estancia,
            MAX(r.fecha_salida) FILTER (
                WHERE r.estado::text = 'CHECKOUT_REALIZADO'
            )                                        AS ultima_estancia,
            COUNT(r.id) FILTER (
                WHERE r.estado::text IN ('CANCELADA', 'NO_SHOW')
            )                                        AS num_cancelaciones
        FROM huespedes h
        LEFT JOIN reservas r ON r.huesped_id = h.id
        WHERE h.id = :hid
        GROUP BY h.id, h.nombre, h.apellido, h.email
    """), {"hid": huesped_id}).fetchone()

    if not row:
        raise ValueError(f"Huesped {huesped_id} not found")

    num_estancias   = int(row[5] or 0)
    ingresos        = float(row[6] or 0)
    num_cancelaciones = int(row[9] or 0)
    num_reservas    = int(row[4] or 0)

    # LTV = ingresos históricos + projected future value (simplified)
    # Avg ticket * frequency boost based on recency (not zero-padded)
    avg_ticket      = ingresos / num_estancias if num_estancias > 0 else 0
    # Simple LTV: historical revenue + 1-year projection using trailing frequency
    primera         = row[7]
    ultima          = row[8]
    if primera and ultima and primera != ultima:
        span_days   = max(1, (ultima - primera).days)
        freq_per_yr = (num_estancias / span_days) * 365
    else:
        freq_per_yr = num_estancias  # ≤1 stay: treat as that many per year

    ltv = ingresos + avg_ticket * freq_per_yr  # historical + 1-yr forward

    segmento = _asignar_segmento(ltv, num_estancias)

    # Write-back to huespedes table (ltv + segmento columns)
    try:
        db.execute(text("""
            UPDATE huespedes
               SET ltv      = :ltv,
                   segmento = :seg,
                   updated_at = NOW()
             WHERE id = :hid
        """), {"ltv": round(ltv, 2), "seg": segmento, "hid": huesped_id})
        db.commit()
    except Exception as exc:
        logger.warning("ltv write-back failed for %s: %s", huesped_id, exc)
        db.rollback()

    return {
        "huesped_id":        huesped_id,
        "nombre":            f"{row[1]} {row[2]}",
        "email":             row[3],
        "num_reservas":      num_reservas,
        "num_estancias":     num_estancias,
        "num_cancelaciones": num_cancelaciones,
        "ingresos_totales":  round(ingresos, 2),
        "avg_ticket":        round(avg_ticket, 2),
        "ltv":               round(ltv, 2),
        "segmento":          segmento,
        "primera_estancia":  row[7].isoformat() if row[7] else None,
        "ultima_estancia":   row[8].isoformat() if row[8] else None,
    }


def segmentar_todos(db: Session) -> dict[str, Any]:
    """Recalculate LTV for all active huespedes in batches of 50."""
    ids_row = db.execute(text(
        "SELECT id FROM huespedes WHERE activo = TRUE ORDER BY id"
    )).fetchall()
    ids = [str(r[0]) for r in ids_row]

    total    = len(ids)
    updated  = 0
    errors   = 0
    segmentos: dict[str, int] = {"VIP": 0, "FRECUENTE": 0, "OCASIONAL": 0, "NUEVO": 0}

    BATCH = 50
    for start in range(0, total, BATCH):
        batch = ids[start:start + BATCH]
        for hid in batch:
            try:
                result = calcular_ltv(hid, db)
                seg = result["segmento"]
                segmentos[seg] = segmentos.get(seg, 0) + 1
                updated += 1
            except Exception as exc:
                logger.warning("segmentar_todos: error on %s: %s", hid, exc)
                errors += 1

    return {
        "total_huespedes": total,
        "actualizados":    updated,
        "errores":         errors,
        "distribucion":    segmentos,
    }
