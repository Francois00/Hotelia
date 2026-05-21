import os
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from routers import forecast, pricing, crm, housekeeping, reviews, mantenimiento, concierge

# ─── API Key middleware ───────────────────────────────────────────────────────

EXEMPT_PATHS = {"/", "/ia/v1/health", "/docs", "/openapi.json", "/redoc"}

class APIKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in EXEMPT_PATHS:
            return await call_next(request)

        expected = os.getenv("IA_SECRET_KEY", "")
        received = request.headers.get("X-IA-Key", "")

        if not expected or received != expected:
            return JSONResponse(
                status_code=401,
                content={"detail": "X-IA-Key inválida o ausente"},
            )
        return await call_next(request)

# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Hotel IA Service",
    description="Motor de IA: forecast (Prophet), pricing dinámico, CRM, housekeeping.",
    version="1.0.0",
)

# CORS
origins = os.getenv("IA_ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(APIKeyMiddleware)

# ─── Routers ──────────────────────────────────────────────────────────────────

app.include_router(forecast.router,      prefix="/ia/v1")
app.include_router(pricing.router,       prefix="/ia/v1")
app.include_router(crm.router,           prefix="/ia/v1")
app.include_router(housekeeping.router,  prefix="/ia/v1")
app.include_router(reviews.router,       prefix="/ia/v1")
app.include_router(mantenimiento.router, prefix="/ia/v1")
app.include_router(concierge.router,     prefix="/ia/v1")

# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/ia/v1/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
