from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from db.connection import get_db
from services.predictor_fallos import analizar_habitacion, analizar_hotel_completo

router = APIRouter()


@router.get("/mantenimiento/habitacion/{habitacion_id}")
def mantenimiento_habitacion(
    habitacion_id: str = Path(...),
    db: Session = Depends(get_db),
):
    try:
        return analizar_habitacion(habitacion_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/mantenimiento/hotel")
def mantenimiento_hotel(db: Session = Depends(get_db)):
    try:
        return analizar_hotel_completo(db)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
