import os
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

# Add backend to Python path so we can import from it
backend_path = os.path.join(os.path.dirname(__file__), "..", "backend")
sys.path.insert(0, backend_path)

# Create FastAPI app
app = FastAPI(title="Your API", description="API for your application", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Try to import your existing routes from backend
try:
    # Adjust these imports based on your actual backend structure
    # Example imports - you'll need to modify these:
    # from app.api.v1.routes import router as v1_router
    # app.include_router(v1_router, prefix="/api/v1")

    # For now, let's add some basic routes
    @app.get("/")
    def root():
        return {"message": "API is running successfully!"}

    @app.get("/api/v1/health")
    def health_check():
        return {"status": "healthy", "message": "API is working"}

    @app.get("/api/v1/test")
    def test_endpoint():
        return {"message": "Test endpoint working", "version": "1.0.0"}

    # Add your existing endpoints here or import them from backend

except ImportError as e:
    print(f"Could not import from backend: {e}")

    # Fallback routes if import fails
    @app.get("/")
    def root():
        return {"message": "API is running (fallback mode)"}


# Create the handler for Vercel
handler = Mangum(app, lifespan="off")
