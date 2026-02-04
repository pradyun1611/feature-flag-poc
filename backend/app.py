from __future__ import annotations

import os
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# OpenFeature Python SDK
from openfeature import api as openfeature
from openfeature.evaluation_context import EvaluationContext

# flagd provider (installed as openfeature-provider-flagd)
from openfeature.contrib.provider.flagd import FlagdProvider

# --------------------------------------------------------------------------------------
# Backend config
# --------------------------------------------------------------------------------------
FLAGD_HOST = os.getenv("FLAGD_HOST", "localhost")
FLAGD_PORT = int(os.getenv("FLAGD_PORT", "8013"))
FLAGD_TLS = os.getenv("FLAGD_TLS", "false").lower() in {"1", "true", "yes"}
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")

# --------------------------------------------------------------------------------------
# OpenFeature + flagd wiring (provider mode ONLY)
# --------------------------------------------------------------------------------------
provider = FlagdProvider(host=FLAGD_HOST, port=FLAGD_PORT, tls=FLAGD_TLS)
openfeature.set_provider(provider)

# NOTE: pass the name positionally; keyword 'name' is not supported in your SDK version
client = openfeature.get_client("backend")

# --------------------------------------------------------------------------------------
# FastAPI app
# --------------------------------------------------------------------------------------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------
def build_context(user_id: Optional[str]) -> EvaluationContext:
    uid = user_id or "anonymous"
    return EvaluationContext(
        targeting_key=uid,
        attributes={"userId": uid},
    )

# --------------------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------------------
@app.get("/api/healthz")
def healthz() -> dict:
    return {"status": "ok", "mode": "openfeature+flagd-provider"}

@app.get("/api/flags")
def get_flags(userId: str = "anonymous") -> dict:
    ctx = build_context(userId)
    new_badge = client.get_boolean_value("new-badge", False, ctx)
    cta_color = client.get_string_value("cta-color", "blue", ctx)
    api_enabled = client.get_boolean_value("api-new-endpoint-enabled", False, ctx)
    return {
        "newBadge": new_badge,
        "ctaColor": cta_color,
        "apiNewEndpointEnabled": api_enabled,
    }

@app.get("/api/hello")
def hello(userId: str = "anonymous") -> dict:
    ctx = build_context(userId)
    on = client.get_boolean_value("new-badge", False, ctx)
    return {"message": "New feature is ON 🎉 (from backend)"} if on else {"message": "New feature is OFF (from backend)"}

@app.get("/api/secret")
def secret(userId: str = "anonymous") -> dict:
    ctx = build_context(userId)
    allowed = client.get_boolean_value("api-new-endpoint-enabled", False, ctx)
    if not allowed:
        raise HTTPException(status_code=403, detail="Feature disabled by flag")
    return {"secret": "🍪 super secret data"}