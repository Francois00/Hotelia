from __future__ import annotations

import logging
import os
from datetime import date

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from db.connection import get_db
from services.optimizador_rutas import generar_plan_limpieza

logger = logging.getLogger(__name__)
router = APIRouter()

BACKEND_URL   = os.getenv("BACKEND_INTERNAL_URL", "http://backend:3000")
BACKEND_TOKEN = os.getenv("BACKEND_SERVICE_TOKEN", "")


@router.get("/housekeeping/plan")
def plan_limpieza(
    fecha: str = Query(default=None),
    db: Session = Depends(get_db),
):
    try:
        target = date.fromisoformat(fecha) if fecha else date.today()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Fecha inválida: {exc}") from exc

    try:
        return generar_plan_limpieza(target, db)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/housekeeping/habitaciones/{habitacion_id}/limpieza-completada")
async def limpieza_completada(
    habitacion_id: str,
    db: Session = Depends(get_db),
):
    """
    Marks a room as clean locally then notifies the Node.js backend
    so it can update estado_limpieza = LIMPIA via its own service.
    """
    url = f"{BACKEND_URL}/api/habitaciones/{habitacion_id}/limpieza-completada"
    headers = {"Authorization": f"Bearer {BACKEND_TOKEN}"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, headers=headers)
            resp.raise_for_status()
            backend_data = resp.json()
    except httpx.HTTPStatusError as exc:
        logger.error(
            "Backend returned %s for limpieza-completada on %s",
            exc.response.status_code, habitacion_id,
        )
        raise HTTPException(
            status_code=502,
            detail=f"Backend error: {exc.response.status_code}",
        ) from exc
    except httpx.RequestError as exc:
        logger.error("Could not reach backend for limpieza-completada: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Backend no disponible",
        ) from exc

    return {
        "habitacion_id": habitacion_id,
        "estado":        "LIMPIA",
        "backend":       backend_data,
    }
