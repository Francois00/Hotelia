"""
Concierge chatbot powered by Anthropic Claude Haiku.
Falls back to template responses when API key is absent.
"""
from __future__ import annotations

import logging
import os
import threading
import time
from typing import Any

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
HOTEL_NAME        = os.getenv("HOTEL_NAME", "Hotel")
BACKEND_URL       = os.getenv("BACKEND_INTERNAL_URL", "http://backend:3000")
BACKEND_TOKEN     = os.getenv("BACKEND_SERVICE_TOKEN", "")

# ─── Intent classification ────────────────────────────────────────────────────

INTENTS: dict[str, list[str]] = {
    "solicitud_servicio":  ["toalla","almohada","limpieza","amenities","jabón","jabon","ameniti"],
    "problema_habitacion": ["no funciona","roto","rota","falla","problema","ruido","frio","frío","calor","no enciende","no abre"],
    "informacion_hotel":   ["horario","desayuno","piscina","gym","spa","wifi","parking","aparcamiento","servicio"],
    "checkout_extension":  ["extender","renovar","quedarme","tarde","late checkout","una noche más","noche mas"],
    "queja_formal":        ["queja","molesto","inaceptable","horrible","reembolso","compensación","compensacion","exijo","denunciar"],
    "consulta_reserva":    ["reserva","confirmación","confirmacion","cambio","cancelar","cancelacion"],
}

_TEMPLATE_RESPONSES: dict[str, str] = {
    "solicitud_servicio":  "Con gusto atenderemos tu solicitud. En breve un miembro del equipo se acercará a tu habitación.",
    "problema_habitacion": "Lamentamos los inconvenientes. Hemos escalado el problema a mantenimiento, quien lo atenderá a la brevedad.",
    "informacion_hotel":   "Para información detallada sobre nuestros servicios, no dudes en comunicarte con recepción o visitar nuestra área de información en el lobby.",
    "checkout_extension":  "Para solicitar un late checkout, por favor comunícate directamente con recepción donde con gusto verificaremos disponibilidad.",
    "queja_formal":        "Lamentamos profundamente la experiencia. Tu caso ha sido escalado a un supervisor quien se pondrá en contacto contigo personalmente.",
    "consulta_reserva":    "Para consultas sobre tu reserva, nuestro equipo de recepción está disponible las 24 horas para ayudarte.",
    "general":             "Gracias por contactarnos. Un miembro de nuestro equipo estará encantado de asistirte. Por favor, también puedes llamarnos a recepción.",
}


def _clasificar_intent(mensaje: str) -> str:
    m = mensaje.lower()
    for intent, keywords in INTENTS.items():
        if any(kw in m for kw in keywords):
            return intent
    return "general"


# ─── Main function ────────────────────────────────────────────────────────────

def responder_huesped(
    mensaje: str,
    huesped_id: str,
    reserva_id: str | None,
    historial: list[dict] | None = None,
    db: Session | None = None,
) -> dict[str, Any]:

    t0 = time.monotonic()

    # Step 1 — guest context
    nombre        = "Estimado huésped"
    idioma        = "es"
    segmento      = ""
    preferencias  = ""
    hab_numero    = "—"
    fecha_entrada = "—"
    fecha_salida  = "—"

    if db is not None:
        try:
            h = db.execute(text("""
                SELECT nombre, apellido, idioma_preferido::text, segmento::text, preferencias
                FROM huespedes WHERE id = :hid
            """), {"hid": huesped_id}).fetchone()
            if h:
                nombre       = f"{h[0]} {h[1]}"
                idioma       = str(h[2]).lower() if h[2] else "es"
                segmento     = h[3] or ""
                preferencias = str(h[4]) if h[4] else ""

            if reserva_id:
                r = db.execute(text("""
                    SELECT ha.numero,
                           re.fecha_entrada::text,
                           re.fecha_salida::text
                    FROM reservas re
                    JOIN habitaciones ha ON ha.id = re.habitacion_id
                    WHERE re.id = :rid
                """), {"rid": reserva_id}).fetchone()
                if r:
                    hab_numero    = r[0]
                    fecha_entrada = r[1]
                    fecha_salida  = r[2]
        except Exception as exc:
            logger.warning("concierge: error pulling context: %s", exc)

    # Step 2 — intent
    detected_intent = _clasificar_intent(mensaje)

    # Step 3 — LLM response
    escalado        = detected_intent == "queja_formal"
    escalado_motivo = "Queja formal — requiere atención de supervisor" if escalado else None

    respuesta = _template_response(detected_intent, nombre, idioma)

    if ANTHROPIC_API_KEY:
        respuesta = _call_anthropic(
            mensaje, nombre, idioma, segmento, preferencias,
            hab_numero, fecha_entrada, fecha_salida,
            detected_intent, historial or [],
        ) or respuesta

    # Step 4 — post-processing side effects
    if detected_intent == "problema_habitacion" and hab_numero != "—" and db is not None:
        # Async: analyse the complaint as a review
        hab_id = _get_habitacion_id_by_numero(hab_numero, db)
        if hab_id:
            _async_analizar_review(mensaje, hab_id)

    if detected_intent == "queja_formal":
        _notify_backend_async({
            "tipo":        "QUEJA_FORMAL",
            "huesped_id":  huesped_id,
            "reserva_id":  reserva_id,
            "descripcion": mensaje[:200],
            "nivel_alerta": "alta",
            "frecuencia":  1,
        })

    if detected_intent == "checkout_extension":
        respuesta += " Para gestionar tu solicitud, por favor comunícate con recepción o marca la extensión 0."

    # Step 5 — save to DB
    if db is not None:
        try:
            db.execute(text("""
                INSERT INTO concierge_mensajes
                  (huesped_id, reserva_id, mensaje_huesped, respuesta_aria,
                   intent_detectado, escalado, escalado_motivo)
                VALUES (:hid, :rid, :msg, :resp, :intent, :esc, :esc_mot)
            """), {
                "hid":     huesped_id,
                "rid":     reserva_id,
                "msg":     mensaje,
                "resp":    respuesta,
                "intent":  detected_intent,
                "esc":     escalado,
                "esc_mot": escalado_motivo,
            })
            db.commit()
        except Exception as exc:
            logger.warning("concierge: save message error: %s", exc)
            db.rollback()

    elapsed_ms = int((time.monotonic() - t0) * 1000)

    return {
        "respuesta":         respuesta,
        "intent_detectado":  detected_intent,
        "escalado":          escalado,
        "escalado_motivo":   escalado_motivo,
        "tiempo_respuesta_ms": elapsed_ms,
    }


def _template_response(intent: str, nombre: str, idioma: str) -> str:
    base = _TEMPLATE_RESPONSES.get(intent, _TEMPLATE_RESPONSES["general"])
    # If idioma is English, use English template
    if idioma in ("en", "eng"):
        en_templates = {
            "solicitud_servicio":  "We will gladly assist you. A team member will be at your room shortly.",
            "problema_habitacion": "We apologize for the inconvenience. Maintenance has been notified and will attend to it promptly.",
            "queja_formal":        "We sincerely apologize for your experience. A supervisor will contact you personally.",
            "general":             "Thank you for reaching out. Our team is available 24/7 at reception to assist you.",
        }
        return en_templates.get(intent, en_templates["general"])
    return base


def _call_anthropic(
    mensaje: str,
    nombre: str, idioma: str, segmento: str, preferencias: str,
    hab_numero: str, fecha_entrada: str, fecha_salida: str,
    detected_intent: str,
    historial: list[dict],
) -> str | None:
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

        system_prompt = (
            f"Eres el asistente virtual del {HOTEL_NAME}. Tu nombre es Aria.\n"
            f"Responde SIEMPRE en el idioma del huésped (detectado: {idioma}).\n"
            "Sé cálido, profesional y conciso (máximo 3 oraciones).\n\n"
            f"Contexto del huésped:\n"
            f"- Nombre: {nombre}\n"
            f"- Habitación: {hab_numero}\n"
            f"- Check-in: {fecha_entrada}, Check-out: {fecha_salida}\n"
            f"- Segmento: {segmento}\n"
            f"- Preferencias: {preferencias}\n\n"
            f"Intención detectada: {detected_intent}\n\n"
            "Para solicitudes de servicio: confirma que lo gestionarás y da un tiempo estimado.\n"
            "Para problemas: muestra empatía, pide disculpas, indica que lo escalas a mantenimiento.\n"
            "Para información: responde con datos del hotel si los conoces.\n"
            "Para quejas formales: escala siempre a un humano.\n"
            "Nunca menciones precios ni hagas promesas de compensación."
        )

        messages = []
        for turn in historial[-10:]:
            if turn.get("role") in ("user", "assistant") and turn.get("content"):
                messages.append({"role": turn["role"], "content": turn["content"]})
        messages.append({"role": "user", "content": mensaje})

        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            system=system_prompt,
            messages=messages,
        )
        return response.content[0].text if response.content else None
    except Exception as exc:
        logger.warning("Anthropic API error: %s", exc)
        return None


def _get_habitacion_id_by_numero(numero: str, db: Session) -> str | None:
    row = db.execute(text(
        "SELECT id FROM habitaciones WHERE numero = :n"
    ), {"n": numero}).fetchone()
    return str(row[0]) if row else None


def _async_analizar_review(mensaje: str, hab_id: str) -> None:
    def _run():
        from db.connection import SessionLocal
        from services.reviews_nlp import analizar_review
        db2 = SessionLocal()
        try:
            analizar_review(mensaje, "WHATSAPP", hab_id, db=db2)
        except Exception as exc:
            logger.warning("async analizar_review error: %s", exc)
        finally:
            db2.close()
    threading.Thread(target=_run, daemon=True).start()


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
            logger.warning("concierge notify_backend error: %s", exc)
    threading.Thread(target=_send, daemon=True).start()
