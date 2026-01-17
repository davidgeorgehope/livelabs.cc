from dotenv import load_dotenv
load_dotenv()  # Load .env file before other imports that use env vars

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from .database import engine, Base
from .routes import auth, tracks, steps, enrollments, execute, organizations, achievements, ai, github, analytics, admin, infrastructure, terminal, app_container, proxy

# Rate limiting
limiter = Limiter(key_func=get_remote_address)

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="LiveLabs API",
    description="Guided learning platform for real SaaS products",
    version="1.0.0"
)

# Configure rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS - Allow production and development origins with explicit methods/headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3004",
        "http://127.0.0.1:3004",
        "https://livelabs.cc",
        "https://www.livelabs.cc",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Include routers under /api prefix
app.include_router(auth.router, prefix="/api")
app.include_router(organizations.router, prefix="/api")
app.include_router(tracks.router, prefix="/api")
app.include_router(steps.router, prefix="/api")
app.include_router(enrollments.router, prefix="/api")
app.include_router(execute.router, prefix="/api")
app.include_router(achievements.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(github.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(infrastructure.router, prefix="/api")
app.include_router(terminal.router, prefix="/api")
app.include_router(app_container.router, prefix="/api")
app.include_router(proxy.router, prefix="/api")


@app.get("/")
def root():
    return {"message": "LiveLabs API", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "healthy"}
