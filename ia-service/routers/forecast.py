from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from db.connection import get_db
from services.predictor_ocupacion import (
    clear_cache,
    entrenar_y_predecir,
    get_cache_status,
)

router = APIRouter()


@router.get("/forecast")
def forecast(
    dias: int = Query(default=90, ge=1, le=365),
    db: Session = Depends(get_db),
):
    try:
        predictions = entrenar_y_predecir(dias=dias, db=db)
        return {
            "dias":        dias,
            "predicciones": predictions,
            "total":       len(predictions),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/forecast/status")
def forecast_status():
    return get_cache_status()


@router.post("/forecast/retrain", status_code=202)
def forecast_retrain(
    dias: int = Query(default=90, ge=1, le=365),
    db: Session = Depends(get_db),
):
    clear_cache()
    try:
        predictions = entrenar_y_predecir(dias=dias, db=db)
        return {
            "mensaje":      "Modelo re-entrenado exitosamente",
            "dias":         dias,
            "total":        len(predictions),
            "predicciones": predictions,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
