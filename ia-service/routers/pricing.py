from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.connection import get_db
from services.pricing_engine import CHANNEL_FACTORS, calcular_tarifa

router = APIRouter()


class BatchItem(BaseModel):
    habitacion_id: str
    fecha_entrada: str
    fecha_salida:  str
    canal:         str = "DIRECTO"


@router.get("/pricing/tarifa")
def tarifa(
    habitacion_id: str = Query(...),
    fecha_entrada: str = Query(...),
    fecha_salida:  str = Query(...),
    canal:         str = Query(default="DIRECTO"),
    db: Session = Depends(get_db),
):
    try:
        return calcular_tarifa(
            habitacion_id=habitacion_id,
            fecha_entrada=fecha_entrada,
            fecha_salida=fecha_salida,
            canal=canal,
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/pricing/batch")
def batch_pricing(
    items: List[BatchItem],
    db: Session = Depends(get_db),
):
    if len(items) > 50:
        raise HTTPException(status_code=400, detail="Max 50 items per batch")

    results = []
    for item in items:
        try:
            result = calcular_tarifa(
                habitacion_id=item.habitacion_id,
                fecha_entrada=item.fecha_entrada,
                fecha_salida=item.fecha_salida,
                canal=item.canal,
                db=db,
            )
            results.append({"ok": True, **result})
        except Exception as exc:
            results.append({
                "ok":            False,
                "habitacion_id": item.habitacion_id,
                "error":         str(exc),
            })

    return {
        "total":      len(items),
        "exitosos":   sum(1 for r in results if r["ok"]),
        "fallidos":   sum(1 for r in results if not r["ok"]),
        "resultados": results,
    }


@router.get("/pricing/canales")
def canales_disponibles():
    return {"canales": list(CHANNEL_FACTORS.keys())}
