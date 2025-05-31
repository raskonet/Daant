from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.ai import router as ai_router  # ADDED
from app.api.v1.dicom import router as dicom_router
from app.api.v1.report import router as report_router
from app.api.v1.upload import router as upload_router
from app.core.config import settings


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.API_VERSION,
        openapi_url=f"{settings.API_STR}/openapi.json",
        docs_url=f"{settings.API_STR}/docs",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get(f"{settings.API_STR}/healthz", tags=["Health"])
    async def health_check():
        return {"status": "ok"}

    app.include_router(upload_router, prefix=settings.API_STR, tags=["Upload"])
    app.include_router(dicom_router, prefix=settings.API_STR, tags=["DICOM"])
    app.include_router(ai_router, prefix=settings.API_STR, tags=["AI Analysis"])
    app.include_router(
        report_router, prefix=settings.API_STR, tags=["Diagnostic Report"]
    )

    @app.on_event("startup")
    async def on_startup():
        print("Application startup complete.")
        print(f"Allowing CORS from: {settings.CORS_ORIGINS}")
        # Optionally pre-load AI models here to avoid delay on first request
        # from app.services.ai_service import get_model
        # try:
        #     print("Pre-loading AI models...")
        #     get_model("detection")
        #     get_model("segmentation")
        #     get_model("classification")
        #     print("AI models pre-loaded.")
        # except Exception as e:
        #     print(f"Error pre-loading AI models: {e}")

    @app.on_event("shutdown")
    async def on_shutdown():
        print("Application shutdown complete.")

    return app


app = create_app()
