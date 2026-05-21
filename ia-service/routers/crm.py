from __future__ import annotations

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from db.connection import SessionLocal, get_db
from services.ltv_calculator import calcular_ltv, segmentar_todos
from services.segmentacion_crm import obtener_segmento_stats

logger = logging.getLogger(__name__)
router = APIRouter()

_executor = ThreadPoolExecutor(max_workers=2)


def _run_segmentacion():
    db = SessionLocal()
    try:
        result = segmentar_todos(db)
        logger.info("segmentar_todos completed: %s", result)
    except Exception as exc:
        logger.error("segmentar_todos background error: %s", exc)
    finally:
        db.close()


@router.get("/crm/stats")
def crm_stats(db: Session = Depends(get_db)):
    try:
        return obtener_segmento_stats(db)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/crm/huespedes/{huesped_id}/ltv")
def ltv(
    huesped_id: str = Path(...),
    db: Session = Depends(get_db),
):
    try:
        return calcular_ltv(huesped_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/crm/segmentar-todos", status_code=202)
def segmentar_todos_endpoint(background_tasks: BackgroundTasks):
    background_tasks.add_task(_run_segmentacion)
    return {
        "mensaje": "Segmentación iniciada en segundo plano",
        "estado":  "PROCESANDO",
    }
