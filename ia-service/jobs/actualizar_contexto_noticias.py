"""
Job semanal: actualiza `contexto_mercado` con feriados/eventos que puedan
afectar el pronóstico de ocupación (factor_temporada y recomendación en
GET /api/v1/empresa/pronostico-ocupacion, backend Node).

Feriados nacionales: se calculan con la librería `holidays` (dato real).
Eventos de turismo/ferias locales: NO hay fuente conectada todavía — se deja
un mock claramente marcado, listo para reemplazar por una API real de
noticias/turismo/eventos cuando se defina cuál usar.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta

import holidays
from sqlalchemy import text

from db.connection import SessionLocal

logger = logging.getLogger(__name__)

# ─── TODO: reemplazar por una fuente real de eventos de turismo/ferias ────────
# Mock temporal — no conectado a ninguna API. Sirve para demostrar el flujo
# hasta que se defina la fuente (ej. API de una municipalidad, agenda de
# turismo del MINCETUR, scraping de una fuente pública específica, etc).
EVENTOS_TURISMO_MOCK: list[dict[str, str]] = [
    {
        "tipo_evento": "feria",
        "descripcion": "Feria de Arequipa (mock — reemplazar con fuente real)",
        "mes": "8",
        "dia": "15",
        "impacto_estimado": "alto",
    },
]


def _limpiar_futuros(db) -> None:
    db.execute(text("""
        DELETE FROM contexto_mercado
        WHERE fecha_evento >= CURRENT_DATE
          AND fuente LIKE 'auto:%'
    """))


def _insertar(db, empresa_id: str, ciudad: str | None, tipo_evento: str,
              descripcion: str, fecha_evento: date, impacto: str, fuente: str) -> None:
    db.execute(text("""
        INSERT INTO contexto_mercado
            (id, empresa_id, ciudad, tipo_evento, descripcion, fecha_evento, impacto_estimado, fuente)
        VALUES
            (gen_random_uuid(), :empresa_id, :ciudad, :tipo_evento, :descripcion, :fecha_evento, :impacto, :fuente)
    """), {
        "empresa_id": empresa_id, "ciudad": ciudad, "tipo_evento": tipo_evento,
        "descripcion": descripcion, "fecha_evento": fecha_evento,
        "impacto": impacto, "fuente": fuente,
    })


def actualizar_contexto_mercado() -> None:
    db = SessionLocal()
    try:
        empresas = db.execute(text("""
            SELECT e.id, l.ciudad
            FROM empresas e
            LEFT JOIN LATERAL (
                SELECT ciudad FROM locales WHERE empresa_id = e.id AND ciudad IS NOT NULL LIMIT 1
            ) l ON true
            WHERE e.estado = 'activa'
        """)).fetchall()

        if not empresas:
            logger.info("[contexto_mercado] Sin empresas activas, nada que actualizar")
            return

        _limpiar_futuros(db)

        hoy = date.today()
        pe_feriados = holidays.Peru(years=[hoy.year, hoy.year + 1])

        for empresa_id, ciudad in empresas:
            # Feriados nacionales próximos (dato real, vía librería `holidays`)
            for fecha, nombre in sorted(pe_feriados.items()):
                if hoy <= fecha <= hoy + timedelta(days=90):
                    _insertar(
                        db, empresa_id, ciudad, "feriado", nombre, fecha,
                        "medio", "auto:holidays-pe",
                    )

            # Eventos de turismo/ferias — mock, ver EVENTOS_TURISMO_MOCK arriba
            for ev in EVENTOS_TURISMO_MOCK:
                anio = hoy.year if date(hoy.year, int(ev["mes"]), int(ev["dia"])) >= hoy else hoy.year + 1
                fecha_evento = date(anio, int(ev["mes"]), int(ev["dia"]))
                if fecha_evento <= hoy + timedelta(days=90):
                    _insertar(
                        db, empresa_id, ciudad, ev["tipo_evento"], ev["descripcion"],
                        fecha_evento, ev["impacto_estimado"], "auto:mock-turismo",
                    )

        db.commit()
        logger.info("[contexto_mercado] Actualizado para %d empresa(s)", len(empresas))
    except Exception:
        db.rollback()
        logger.exception("[contexto_mercado] Error actualizando contexto de mercado")
    finally:
        db.close()
