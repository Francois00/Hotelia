from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.connection import get_db
from services.reviews_nlp import (
    analizar_review,
    detectar_problema_recurrente,
    procesar_reviews_pendientes,
)

router = APIRouter()


class ReviewInput(BaseModel):
    texto:         str
    fuente:        str
    habitacion_id: Optional[str] = None
    huesped_id:    Optional[str] = None


class BatchReviewInput(BaseModel):
    reviews: List[ReviewInput]


@router.post("/reviews/analizar")
def analizar_endpoint(body: ReviewInput, db: Session = Depends(get_db)):
    try:
        return analizar_review(
            texto=body.texto,
            fuente=body.fuente,
            habitacion_id=body.habitacion_id,
            huesped_id=body.huesped_id,
            db=db,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/reviews/batch")
def batch_endpoint(body: BatchReviewInput, db: Session = Depends(get_db)):
    if len(body.reviews) > 100:
        raise HTTPException(status_code=400, detail="Máximo 100 reviews por llamada")

    results = []
    for item in body.reviews:
        try:
            r = analizar_review(
                texto=item.texto,
                fuente=item.fuente,
                habitacion_id=item.habitacion_id,
                huesped_id=item.huesped_id,
                db=db,
            )
            results.append({"ok": True, **r})
        except Exception as exc:
            results.append({"ok": False, "error": str(exc)})

    return {
        "total":      len(body.reviews),
        "exitosos":   sum(1 for r in results if r.get("ok")),
        "resultados": results,
    }


@router.get("/reviews/habitacion/{habitacion_id}")
def reviews_habitacion(
    habitacion_id: str = Path(...),
    ventana_dias: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    rows = db.execute(text("""
        SELECT id, fuente, idioma, score_general, aspectos, fecha_review, texto_original
        FROM reviews_nlp
        WHERE habitacion_id = :hab_id
          AND fecha_review >= NOW() - INTERVAL '1 day' * :dias
        ORDER BY fecha_review DESC
        LIMIT 50
    """), {"hab_id": habitacion_id, "dias": ventana_dias}).fetchall()

    reviews = [
        {
            "id":              str(r[0]),
            "fuente":          r[1],
            "idioma":          r[2],
            "score_general":   float(r[3]) if r[3] else None,
            "aspectos":        r[4] if isinstance(r[4], list) else [],
            "fecha_review":    r[5].isoformat() if r[5] else None,
            "texto_original":  r[6],
        }
        for r in rows
    ]

    try:
        problemas = detectar_problema_recurrente(habitacion_id, ventana_dias, db)
    except Exception:
        problemas = []

    return {
        "habitacion_id":        habitacion_id,
        "ventana_dias":         ventana_dias,
        "total_reviews":        len(reviews),
        "reviews":              reviews,
        "problemas_recurrentes": problemas,
    }


@router.get("/reviews/stats")
def stats(db: Session = Depends(get_db)):
    total = db.execute(text("SELECT COUNT(*) FROM reviews_nlp")).scalar() or 0

    por_fuente_rows = db.execute(text("""
        SELECT fuente, COUNT(*) FROM reviews_nlp GROUP BY fuente ORDER BY COUNT(*) DESC
    """)).fetchall()
    por_fuente = {r[0]: int(r[1]) for r in por_fuente_rows}

    avg_score = db.execute(text(
        "SELECT AVG(score_general) FROM reviews_nlp WHERE score_general IS NOT NULL"
    )).scalar()

    # Aspects with lowest average score
    neg_rows = db.execute(text("""
        SELECT asp->>'nombre' AS aspecto,
               AVG((asp->>'score')::float) AS avg_score,
               COUNT(*) AS menciones
        FROM reviews_nlp,
             jsonb_array_elements(aspectos) AS asp
        WHERE score_general IS NOT NULL
        GROUP BY asp->>'nombre'
        ORDER BY avg_score ASC
        LIMIT 5
    """)).fetchall()
    aspectos_negativos = [
        {"aspecto": r[0], "avg_score": round(float(r[1]), 3), "menciones": int(r[2])}
        for r in neg_rows
    ]

    hab_alertas = db.execute(text("""
        SELECT COUNT(DISTINCT habitacion_id) FROM alertas_mantenimiento WHERE activa = TRUE
    """)).scalar() or 0

    return {
        "total":                          int(total),
        "por_fuente":                     por_fuente,
        "score_promedio_hotel":           round(float(avg_score), 3) if avg_score else None,
        "aspectos_mas_negativos":         aspectos_negativos,
        "habitaciones_con_alertas_activas": int(hab_alertas),
    }
