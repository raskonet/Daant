import os
import sys

# Add the 'backend' directory to Python's search path.
# __file__ is <project_root>/api/index.py
# os.path.dirname(__file__) is <project_root>/api
# os.path.join(os.path.dirname(__file__), "..", "backend") is <project_root>/backend
backend_dir_path = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "backend")
)
sys.path.insert(0, backend_dir_path)

# Now, `import app.main` should resolve to `<project_root>/backend/app/main.py`
# because `backend_dir_path` (which is `<project_root>/backend`) is in sys.path,
# and Python will look for an `app` package (directory with __init__.py) inside it.

try:
    # Import the FastAPI app instance created in backend/app/main.py
    from app.main import app as fastapi_app_instance
except ImportError as e:
    print(
        f"CRITICAL: Could not import 'app.main.app' from 'backend/app/main.py'. Error: {e}"
    )
    print(f"Current sys.path: {sys.path}")
    print(f"Attempted to import from base path: {backend_dir_path}")
    # Provide a minimal FastAPI app for Vercel to not fail completely during deployment
    from fastapi import FastAPI

    fastapi_app_instance = FastAPI(title="Error API - Backend Load Failed")

    @fastapi_app_instance.get("/")
    def error_root():
        return {
            "message": "Error: Backend application could not be loaded.",
            "detail": str(e),
        }

    @fastapi_app_instance.get(
        "/api/v1/healthz"
    )  # Add common health check for basic Vercel check
    def error_healthz():
        return {
            "status": "unhealthy",
            "message": "Backend application could not be loaded.",
            "detail": str(e),
        }


# Mangum adapter for Vercel. This makes your FastAPI app compatible with AWS Lambda (which Vercel uses).
from mangum import Mangum

handler = Mangum(fastapi_app_instance, lifespan="off")

# Optional: For local testing of this specific file (e.g., running `python api/index.py`)
# This helps ensure the imports work as expected in a simplified environment.
if __name__ == "__main__":
    import uvicorn

    print("Running api/index.py locally for testing...")
    print(f"FastAPI app title: {fastapi_app_instance.title}")
    # The app itself is defined in backend/app/main.py with /api/v1 prefixes
    # So to access healthz: http://localhost:8001/api/v1/healthz
    # Ensure this port (8001) matches the one in next.config.js for dev proxying.
    uvicorn.run(fastapi_app_instance, host="0.0.0.0", port=8001)
