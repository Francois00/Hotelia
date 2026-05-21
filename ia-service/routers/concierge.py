from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.connection import get_db
from services.concierge import responder_huesped

router = APIRouter()


class HistorialTurn(BaseModel):
    role:    str
    content: str


class MensajeInput(BaseModel):
    mensaje:    str
    huesped_id: str
    reserva_id: Optional[str] = None
    historial:  Optional[List[HistorialTurn]] = None


@router.post("/concierge/mensaje")
def mensaje_endpoint(body: MensajeInput, db: Session = Depends(get_db)):
    historial = [h.model_dump() for h in body.historial] if body.historial else []
    try:
        return responder_huesped(
            mensaje=body.mensaje,
            huesped_id=body.huesped_id,
            reserva_id=body.reserva_id,
            historial=historial,
            db=db,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/concierge/historial/{huesped_id}")
def historial_endpoint(
    huesped_id: str = Path(...),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    rows = db.execute(text("""
        SELECT id, reserva_id, mensaje_huesped, respuesta_aria,
               intent_detectado, escalado, escalado_motivo, created_at
        FROM concierge_mensajes
        WHERE huesped_id = :hid
        ORDER BY created_at DESC
        LIMIT :lim
    """), {"hid": huesped_id, "lim": limit}).fetchall()

    return {
        "huesped_id": huesped_id,
        "total":      len(rows),
        "mensajes": [
            {
                "id":               str(r[0]),
                "reserva_id":       str(r[1]) if r[1] else None,
                "mensaje_huesped":  r[2],
                "respuesta_aria":   r[3],
                "intent_detectado": r[4],
                "escalado":         r[5],
                "escalado_motivo":  r[6],
                "created_at":       r[7].isoformat() if r[7] else None,
            }
            for r in rows
        ],
    }


@router.get("/concierge/escalados")
def escalados_endpoint(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    rows = db.execute(text("""
        SELECT cm.id, cm.huesped_id, h.nombre || ' ' || h.apellido AS nombre,
               cm.mensaje_huesped, cm.intent_detectado,
               cm.escalado_motivo, cm.created_at
        FROM concierge_mensajes cm
        JOIN huespedes h ON h.id = cm.huesped_id
        WHERE cm.escalado = TRUE
        ORDER BY cm.created_at DESC
        LIMIT :lim
    """), {"lim": limit}).fetchall()

    return {
        "total": len(rows),
        "escalados": [
            {
                "id":               str(r[0]),
                "huesped_id":       str(r[1]),
                "huesped_nombre":   r[2],
                "mensaje_huesped":  r[3],
                "intent_detectado": r[4],
                "escalado_motivo":  r[5],
                "created_at":       r[6].isoformat() if r[6] else None,
            }
            for r in rows
        ],
    }
