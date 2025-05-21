from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.dicom import router as dicom_router
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

    @app.on_event("startup")
    async def on_startup():
        print("Application startup complete.")
        print(f"Allowing CORS from: {settings.CORS_ORIGINS}")

    @app.on_event("shutdown")
    async def on_shutdown():
        print("Application shutdown complete.")

    return app


app = create_app()
