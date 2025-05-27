import os
import sys
import traceback  # For more detailed error logging

# --- Vercel Runtime Log Check Point #0 ---
print(f"--- [api/index.py] SCRIPT START ---")
print(f"--- [api/index.py] Original sys.path: {sys.path}")
print(f"--- [api/index.py] Current working directory: {os.getcwd()}")
print(f"--- [api/index.py] __file__: {__file__}")


# Add the 'backend' directory to Python's search path.
# __file__ is <project_root>/api/index.py
# os.path.dirname(__file__) is <project_root>/api
# os.path.join(os.path.dirname(__file__), "..") is <project_root>
# os.path.join(os.path.dirname(__file__), "..", "backend") is <project_root>/backend
# This path should point to where the 'app' package can be found as a subdirectory.
#
# Let's adjust slightly: we want the directory *containing* 'app' (which is 'backend')
# to be in sys.path if we are doing 'from app...'.
# No, your original logic was: add 'backend' to sys.path, then 'app' is found within it. This is okay.

backend_parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
# If your app package is backend/app, then backend_parent_dir should be in sys.path
# so you can do `from backend.app.main import app`

# Your current sys.path manipulation:
backend_dir_path_to_add = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "backend")
)
# This adds <project_root>/backend to sys.path.
# So, `from app.main import app` will look for `app` inside `<project_root>/backend`,
# i.e., `<project_root>/backend/app/main.py`. This requires `backend/app/__init__.py`.

sys.path.insert(0, backend_dir_path_to_add)

# --- Vercel Runtime Log Check Point #1 ---
print(f"--- [api/index.py] Top Level Execution ---")
print(f"--- [api/index.py] Path added to sys.path: {backend_dir_path_to_add}")
print(f"--- [api/index.py] sys.path after insert: {sys.path}")

try:
    # This will look for <backend_dir_path_to_add>/app/main.py
    from app.main import app as fastapi_app_instance

    print(
        f"--- [api/index.py] Successfully imported 'app.main.app'. App title: {fastapi_app_instance.title}"
    )
    # for route in fastapi_app_instance.routes:
    #     print(f"--- [api/index.py] Route: {route.path}, Methods: {getattr(route, 'methods', 'N/A')}")


except ImportError as e:
    print(f"--- CRITICAL [api/index.py]: Could not import 'app.main.app'. Error: {e}")
    print(f"--- [api/index.py] Traceback for ImportError: --------")
    traceback.print_exc()
    print(f"--- [api/index.py] End Traceback --------------------")

    from fastapi import FastAPI

    fastapi_app_instance = FastAPI(
        title="Error API - Backend Load Failed (Import Error)"
    )

    @fastapi_app_instance.get("/")
    def error_root_import():
        return {"message": "Error: Backend app import failed.", "detail": str(e)}

    @fastapi_app_instance.get("/api/v1/healthz")
    def error_healthz_import():
        return {
            "status": "unhealthy",
            "message": "Backend app import failed.",
            "detail": str(e),
        }

    print(f"--- [api/index.py] Fallback FastAPI app created due to import error.")
except Exception as e_generic:  # Catch any other exception during import/setup
    print(
        f"--- CRITICAL [api/index.py]: Generic Exception during app import/setup. Error: {e_generic}"
    )
    print(f"--- [api/index.py] Traceback for Generic Exception: --------")
    traceback.print_exc()
    print(f"--- [api/index.py] End Traceback --------------------")

    from fastapi import FastAPI

    fastapi_app_instance = FastAPI(
        title="Error API - Backend Load Failed (Generic Error)"
    )

    @fastapi_app_instance.get("/")
    def error_root_generic():
        return {
            "message": "Error: Backend app generic load failure.",
            "detail": str(e_generic),
        }

    @fastapi_app_instance.get("/api/v1/healthz")
    def error_healthz_generic():
        return {
            "status": "unhealthy",
            "message": "Backend app generic load failure.",
            "detail": str(e_generic),
        }

    print(f"--- [api/index.py] Fallback FastAPI app created due to generic error.")


from mangum import Mangum

print(
    f"--- [api/index.py] About to initialize Mangum with app: {fastapi_app_instance.title if fastapi_app_instance else 'None'}"
)
handler = Mangum(fastapi_app_instance, lifespan="off")
print(f"--- [api/index.py] Mangum handler created. Ready for requests. ---")

# This block is NOT executed on Vercel
if __name__ == "__main__":
    # This local Uvicorn setup needs 'uvicorn' and 'app.main' to be importable as configured above
    try:
        import uvicorn

        print(
            f"--- [api/index.py] Running locally with Uvicorn (__name__ == '__main__') ---"
        )
        print(
            f"--- [api/index.py] FastAPI app to run: {fastapi_app_instance.title if fastapi_app_instance else 'None'}"
        )
        if (
            fastapi_app_instance
            and fastapi_app_instance.title
            != "Error API - Backend Load Failed (Import Error)"
            and fastapi_app_instance.title
            != "Error API - Backend Load Failed (Generic Error)"
        ):
            print(
                f"--- [api/index.py] Attempting to run main backend application locally. ---"
            )
        else:
            print(
                f"--- [api/index.py] Running FALLBACK backend application locally due to previous errors. ---"
            )
        uvicorn.run(
            fastapi_app_instance, host="0.0.0.0", port=8001
        )  # Ensure this port matches your next.config.js dev proxy
    except ImportError:
        print(
            "--- [api/index.py] Uvicorn not found. Cannot run locally. Please install uvicorn. ---"
        )
    except Exception as e_uvicorn:
        print(f"--- [api/index.py] Error running Uvicorn locally: {e_uvicorn} ---")
