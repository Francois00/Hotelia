"""
Housekeeping route optimizer.
Priority score = urgency_weight + checkout_bonus + dirty_weight + floor_penalty.
Round-robin assignment across available staff.
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def _priority_score(
    estado: str,
    tiene_checkout: bool,
    tiene_checkin: bool,
    piso: int,
) -> float:
    """Higher score = clean first."""
    score = 0.0

    # Rooms with pending check-in today are highest priority
    if tiene_checkin:
        score += 100

    # Checkout rooms need immediate cleaning
    if tiene_checkout:
        score += 80

    # EstadoHabitacion: DISPONIBLE, OCUPADA, MANTENIMIENTO, LIMPIEZA, FUERA_DE_SERVICIO, RESERVADA
    if estado in ("FUERA_DE_SERVICIO", "MANTENIMIENTO"):
        score += 50
    elif estado == "LIMPIEZA":
        score += 30

    # Light penalty for higher floors (elevator time)
    score -= piso * 0.5

    return score


def generar_plan_limpieza(fecha: date, db: Session) -> dict[str, Any]:
    hoy = fecha

    # Rooms with their current state
    hab_rows = db.execute(text("""
        SELECT
            h.id,
            h.numero,
            h.piso,
            h.tipo::text    AS tipo,
            h.estado::text  AS estado,
            EXISTS (
                SELECT 1 FROM reservas r
                WHERE r.habitacion_id = h.id
                  AND r.estado::text = 'CHECKIN_REALIZADO'
                  AND r.fecha_salida::date = :hoy
            )               AS tiene_checkout,
            EXISTS (
                SELECT 1 FROM reservas r
                WHERE r.habitacion_id = h.id
                  AND r.estado::text = 'CONFIRMADA'
                  AND r.fecha_entrada::date = :hoy
            )               AS tiene_checkin,
            (
                SELECT g.nombre || ' ' || g.apellido
                FROM reservas r
                JOIN huespedes g ON g.id = r.huesped_id
                WHERE r.habitacion_id = h.id
                  AND r.estado::text = 'CHECKIN_REALIZADO'
                LIMIT 1
            )               AS huesped_actual
        FROM habitaciones h
        ORDER BY h.piso, h.numero
    """), {"hoy": hoy}).fetchall()

    # Staff available today
    staff_rows = db.execute(text("""
        SELECT id, nombre, apellido
        FROM personal
        WHERE activo = TRUE
          AND rol::text = 'HOUSEKEEPING'
        ORDER BY nombre
    """)).fetchall()

    staff = [
        {"id": str(r[0]), "nombre": f"{r[1]} {r[2]}", "asignaciones": []}
        for r in staff_rows
    ]

    if not staff:
        # No staff: still return prioritized list without assignments
        staff = [{"id": "sin_personal", "nombre": "Sin personal asignado", "asignaciones": []}]

    # Score and sort rooms
    tareas = []
    for row in hab_rows:
        (hab_id, numero, piso, tipo, estado,
         tiene_checkout, tiene_checkin, huesped_actual) = (
            str(row[0]), row[1], int(row[2]), row[3], row[4],
            bool(row[5]), bool(row[6]), row[7],
        )

        # Skip rooms already available with no activity today
        if estado == "DISPONIBLE" and not tiene_checkout and not tiene_checkin:
            continue

        score = _priority_score(estado, tiene_checkout, tiene_checkin, piso)
        tareas.append({
            "habitacion_id":  hab_id,
            "numero":         numero,
            "piso":           piso,
            "tipo":           tipo,
            "estado":         estado,
            "tiene_checkout": tiene_checkout,
            "tiene_checkin":  tiene_checkin,
            "huesped_actual": huesped_actual,
            "prioridad":      round(score, 1),
        })

    tareas.sort(key=lambda t: -t["prioridad"])

    # Round-robin assignment
    for i, tarea in enumerate(tareas):
        idx = i % len(staff)
        personal = staff[idx]
        tarea["personal_id"]     = personal["id"]
        tarea["personal_nombre"] = personal["nombre"]
        personal["asignaciones"].append(tarea["numero"])

    return {
        "fecha":        hoy.isoformat(),
        "total_tareas": len(tareas),
        "staff":        [
            {
                "personal_id":    s["id"],
                "nombre":         s["nombre"],
                "num_asignaciones": len(s["asignaciones"]),
                "habitaciones":   s["asignaciones"],
            }
            for s in staff
        ],
        "tareas": tareas,
    }
