"""
Reviews NLP: multilingual sentiment analysis + aspect extraction.
Primary: cardiffnlp/twitter-xlm-roberta-base-sentiment (loaded lazily).
Fallback: lexicon-based scoring when transformers/torch unavailable.
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import threading
from datetime import date, timedelta
from typing import Any

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

BACKEND_URL   = os.getenv("BACKEND_INTERNAL_URL", "http://backend:3000")
BACKEND_TOKEN = os.getenv("BACKEND_SERVICE_TOKEN", "")

# ─── Aspect keyword map ───────────────────────────────────────────────────────

ASPECTOS: dict[str, list[str]] = {
    "limpieza":     ["sucio","sucia","limpio","limpia","mugre","polvo","olor","mancha","desaseado","clean","dirty","smell","stain"],
    "ruido":        ["ruido","ruidoso","ruidosa","molesto","molesta","cañería","tubería","noise","loud","noisy","disturb"],
    "cama":         ["cama","colchon","colchón","almohada","sábana","sabana","incómodo","incómoda","bed","mattress","pillow","sheet"],
    "baño":         ["baño","ducha","agua caliente","presión","bathroom","shower","hot water","plumbing"],
    "atención":     ["amable","amabilidad","grosero","grosera","recepción","recepcion","personal","atención","atencion","staff","rude","friendly","service"],
    "desayuno":     ["desayuno","comida","buffet","café","cafe","breakfast","food","meal"],
    "wifi":         ["wifi","internet","conexión","conexion","lento","slow","connection","network"],
    "ubicación":    ["ubicación","ubicacion","céntrico","centrico","lejos","ruido calle","location","central","distance"],
    "precio_valor": ["caro","cara","precio","vale","value","expensive","worth","dinero","money"],
}

# ─── Lexicon fallback ─────────────────────────────────────────────────────────

_NEGATIVE = {
    "malo","mala","horrible","terrible","pésimo","pesimo","peor","fatal","desastre",
    "asqueroso","asquerosa","decepcionante","inaceptable","ruido","ruidoso","ruidosa",
    "sucio","sucia","mugre","grosero","grosera","problema","falla","roto","rota",
    "frio","frío","calor","molesto","molesta","horrible","terrible",
    "noise","loud","noisy","dirty","broken","problem","unacceptable","terrible",
    "awful","bad","worst","disgusting","disappointing","uncomfortable",
}
_POSITIVE = {
    "excelente","bueno","buena","perfecto","perfecta","genial","fantástico","fantastico",
    "limpio","limpia","cómodo","comodo","cómoda","amable","recomendable","encantador",
    "maravilloso","maravillosa","impecable","estupendo","increíble","increible",
    "excellent","good","great","perfect","clean","comfortable","friendly","amazing",
    "wonderful","superb","fantastic","loved","recommend",
}


def _lexicon_score(texto: str) -> float:
    words = re.findall(r'\w+', texto.lower())
    neg = sum(1 for w in words if w in _NEGATIVE)
    pos = sum(1 for w in words if w in _POSITIVE)
    total = neg + pos
    if total == 0:
        return 0.5
    raw = pos / total
    # Map to [0.05, 0.95]
    return round(0.05 + raw * 0.90, 3)


# ─── Model loading (lazy, cached) ─────────────────────────────────────────────

_model_lock = threading.Lock()
_pipeline: Any | None = None
_model_failed = False


def _get_pipeline() -> Any | None:
    global _pipeline, _model_failed
    if _model_failed:
        return None
    if _pipeline is not None:
        return _pipeline
    with _model_lock:
        if _pipeline is not None:
            return _pipeline
        try:
            from transformers import pipeline as hf_pipeline
            logger.info("Loading XLM-RoBERTa sentiment model …")
            _pipeline = hf_pipeline(
                "text-classification",
                model="cardiffnlp/twitter-xlm-roberta-base-sentiment",
                tokenizer="cardiffnlp/twitter-xlm-roberta-base-sentiment",
                top_k=1,
                truncation=True,
                max_length=512,
            )
            logger.info("Sentiment model loaded.")
        except Exception as exc:
            logger.warning("Could not load transformer model: %s — using lexicon fallback.", exc)
            _model_failed = True
    return _pipeline


def _classify_text(texto: str) -> tuple[float, str]:
    """Returns (score 0-1, label)."""
    pipe = _get_pipeline()
    if pipe is None:
        score = _lexicon_score(texto)
        if score >= 0.6:
            return score, "positivo"
        if score >= 0.4:
            return score, "neutro"
        return score, "negativo"

    try:
        # XLM-RoBERTa labels: Negative, Neutral, Positive
        result = pipe(texto[:512])[0]
        label_raw = result["label"].lower()
        conf = float(result["score"])
        if "positive" in label_raw or "positiv" in label_raw:
            score = round(0.6 + conf * 0.4, 3)
            return score, "positivo"
        if "negative" in label_raw or "negativ" in label_raw:
            score = round((1 - conf) * 0.4, 3)
            return score, "negativo"
        return 0.5, "neutro"
    except Exception as exc:
        logger.warning("Model inference error: %s", exc)
        score = _lexicon_score(texto)
        if score >= 0.6:
            return score, "positivo"
        if score >= 0.4:
            return score, "neutro"
        return score, "negativo"


def _detect_language(texto: str) -> str:
    try:
        from langdetect import detect
        return detect(texto)
    except Exception:
        return "es"


# ─── Core analysis functions ──────────────────────────────────────────────────

def analizar_review(
    texto: str,
    fuente: str,
    habitacion_id: str | None = None,
    huesped_id: str | None = None,
    db: Session | None = None,
) -> dict[str, Any]:

    # Step 1 — language
    idioma = _detect_language(texto)

    # Step 2 — overall sentiment
    score_general, sentimiento_label = _classify_text(texto)

    # Step 3 — aspect extraction
    texto_lower = texto.lower()
    aspectos_encontrados: list[dict] = []
    for aspecto, keywords in ASPECTOS.items():
        frases_con_kw: list[str] = []
        for kw in keywords:
            if kw in texto_lower:
                # Extract surrounding sentence
                idx = texto_lower.find(kw)
                start = max(0, idx - 60)
                end   = min(len(texto), idx + 80)
                frases_con_kw.append(texto[start:end].strip())

        if not frases_con_kw:
            continue

        # Score on concatenated surrounding text
        aspecto_text = " ".join(set(frases_con_kw))
        aspecto_score, _ = _classify_text(aspecto_text)
        aspectos_encontrados.append({
            "nombre":          aspecto,
            "score":           aspecto_score,
            "menciones_texto": frases_con_kw[:3],
        })

    alertas = [a["nombre"] for a in aspectos_encontrados if a["score"] < 0.35]

    # Step 4 — save to DB
    review_id: str | None = None
    if db is not None:
        try:
            row = db.execute(text("""
                INSERT INTO reviews_nlp
                  (huesped_id, habitacion_id, fuente, texto_original,
                   idioma, score_general, aspectos, procesado, fecha_review)
                VALUES
                  (:hid, :hab_id, :fuente, :texto,
                   :idioma, :score, CAST(:aspectos AS jsonb), true, NOW())
                RETURNING id
            """), {
                "hid":      huesped_id,
                "hab_id":   habitacion_id,
                "fuente":   fuente[:30],
                "texto":    texto,
                "idioma":   idioma[:10],
                "score":    score_general,
                "aspectos": __import__('json').dumps(aspectos_encontrados),
            }).fetchone()
            db.commit()
            if row:
                review_id = str(row[0])
        except Exception as exc:
            logger.warning("Could not save review to DB: %s", exc)
            db.rollback()

    # Step 5 — check recurring problem
    problema_recurrente = False
    if habitacion_id and db is not None:
        try:
            problemas = detectar_problema_recurrente(habitacion_id, db=db)
            problema_recurrente = len(problemas) > 0
        except Exception as exc:
            logger.warning("detectar_problema_recurrente error: %s", exc)

    return {
        "review_id":                      review_id,
        "idioma":                         idioma,
        "score_general":                  score_general,
        "sentimiento_label":              sentimiento_label,
        "aspectos":                       aspectos_encontrados,
        "problema_recurrente_detectado":  problema_recurrente,
        "alertas":                        alertas,
    }


def detectar_problema_recurrente(
    habitacion_id: str,
    ventana_dias: int = 30,
    db: Session | None = None,
) -> list[dict]:
    if db is None:
        return []

    cutoff = date.today() - timedelta(days=ventana_dias)
    rows = db.execute(text("""
        SELECT aspectos FROM reviews_nlp
        WHERE habitacion_id = :hab_id
          AND fecha_review >= :cutoff
          AND procesado = TRUE
    """), {"hab_id": habitacion_id, "cutoff": cutoff}).fetchall()

    if not rows:
        return []

    from collections import Counter
    conteo: Counter[str] = Counter()
    for (aspectos_json,) in rows:
        if not aspectos_json:
            continue
        aspectos = aspectos_json if isinstance(aspectos_json, list) else []
        for a in aspectos:
            if isinstance(a, dict) and a.get("score", 1.0) < 0.40:
                conteo[a["nombre"]] += 1

    problemas_detectados: list[dict] = []
    for aspecto, count in conteo.items():
        if count < 3:
            continue
        nivel = "alta" if count >= 5 else "media"
        descripcion = aspecto

        try:
            db.execute(text("""
                INSERT INTO alertas_mantenimiento
                  (habitacion_id, tipo, descripcion, frecuencia, nivel_alerta, activa)
                VALUES
                  (:hab_id, 'REVIEW_RECURRENTE', :desc, :freq, :nivel, TRUE)
                ON CONFLICT (habitacion_id, tipo, descripcion)
                  WHERE activa = TRUE
                DO UPDATE SET
                  frecuencia = alertas_mantenimiento.frecuencia + :freq,
                  nivel_alerta = :nivel,
                  updated_at = NOW()
            """), {
                "hab_id": habitacion_id,
                "desc":   descripcion,
                "freq":   count,
                "nivel":  nivel,
            })
            db.commit()
        except Exception as exc:
            logger.warning("Could not upsert alerta: %s", exc)
            db.rollback()

        # Notify Node.js backend (fire and forget)
        payload = {
            "habitacion_id": habitacion_id,
            "tipo":          "REVIEW_RECURRENTE",
            "descripcion":   descripcion,
            "nivel_alerta":  nivel,
            "frecuencia":    count,
        }
        _notify_backend_async(payload)

        problemas_detectados.append({"aspecto": aspecto, "count": count, "nivel": nivel})

    return problemas_detectados


def _notify_backend_async(payload: dict) -> None:
    def _send():
        try:
            with httpx.Client(timeout=5.0) as client:
                client.post(
                    f"{BACKEND_URL}/api/v1/internal/alertas",
                    json=payload,
                    headers={"X-Service-Token": BACKEND_TOKEN},
                )
        except Exception as exc:
            logger.warning("notify_backend error: %s", exc)
    threading.Thread(target=_send, daemon=True).start()


def procesar_reviews_pendientes(db: Session) -> dict[str, Any]:
    rows = db.execute(text(
        "SELECT id, texto_original, fuente, habitacion_id, huesped_id "
        "FROM reviews_nlp WHERE procesado = FALSE"
    )).fetchall()

    procesados = 0
    alertas_gen = 0
    for row in rows:
        rid, texto, fuente, hab_id, hues_id = (
            str(row[0]), row[1], row[2],
            str(row[3]) if row[3] else None,
            str(row[4]) if row[4] else None,
        )
        try:
            result = analizar_review(texto, fuente, hab_id, hues_id, db)
            db.execute(text(
                "UPDATE reviews_nlp SET procesado = TRUE WHERE id = :id"
            ), {"id": rid})
            db.commit()
            procesados += 1
            if result.get("problema_recurrente_detectado"):
                alertas_gen += 1
        except Exception as exc:
            logger.warning("Error processing review %s: %s", rid, exc)

    return {"procesados": procesados, "alertas_generadas": alertas_gen}
