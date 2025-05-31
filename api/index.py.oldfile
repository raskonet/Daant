import os
import sys
import traceback  # For more detailed error logging

# --- Vercel Runtime Log Check Point #0 ---
print(f"--- [api/index.py] SCRIPT START ---")
print(f"--- [api/index.py] Python version: {sys.version}")
print(f"--- [api/index.py] Original sys.path: {sys.path}")
print(f"--- [api/index.py] Current working directory: {os.getcwd()}")
print(
    f"--- [api/index.py] Listing /var/task (root of lambda): {os.listdir('/var/task') if os.path.exists('/var/task') else 'N/A'}"
)
print(f"--- [api/index.py] __file__: {__file__}")


backend_dir_path_to_add = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "backend")
)
sys.path.insert(0, backend_dir_path_to_add)

print(f"--- [api/index.py] Path added to sys.path: {backend_dir_path_to_add}")
print(
    f"--- [api/index.py] Does backend_dir_path_to_add exist? {os.path.exists(backend_dir_path_to_add)}"
)
if os.path.exists(backend_dir_path_to_add):
    print(
        f"--- [api/index.py] Contents of backend_dir_path_to_add: {os.listdir(backend_dir_path_to_add)}"
    )
    app_path = os.path.join(backend_dir_path_to_add, "app")
    print(f"--- [api/index.py] Full path to 'app' package should be: {app_path}")
    print(
        f"--- [api/index.py] Does 'app' package path exist? {os.path.exists(app_path)}"
    )
    if os.path.exists(app_path):
        print(
            f"--- [api/index.py] Contents of 'app' package path: {os.listdir(app_path)}"
        )
        init_path = os.path.join(app_path, "__init__.py")
        print(
            f"--- [api/index.py] Does 'app/__init__.py' exist? {os.path.exists(init_path)}"
        )


print(f"--- [api/index.py] sys.path after insert: {sys.path}")
fastapi_app_instance = None  # Initialize to None

try:
    from app.main import app as fastapi_app_instance_imported

    fastapi_app_instance = fastapi_app_instance_imported
    print(
        f"--- [api/index.py] Successfully imported 'app.main.app'. App title: {fastapi_app_instance.title if fastapi_app_instance else 'None'}"
    )
    # Log routes for detailed debugging
    # if fastapi_app_instance:
    #     print(f"--- [api/index.py] ROUTES LOADED (Total: {len(fastapi_app_instance.routes)}) ---")
    #     for route_idx, route in enumerate(fastapi_app_instance.routes):
    #         print(f"--- [api/index.py] Route #{route_idx+1}: Path='{route.path}', Name='{route.name}', Methods={getattr(route, 'methods', 'N/A')}")
    #     print(f"--- [api/index.py] END ROUTES ---")


except ImportError as e_import:
    print(
        f"--- CRITICAL [api/index.py]: Could not import 'app.main.app'. Error: {e_import}"
    )
    print(f"--- [api/index.py] Traceback for ImportError: --------")
    traceback.print_exc()
    print(f"--- [api/index.py] End Traceback --------------------")
except Exception as e_generic_import:
    print(
        f"--- CRITICAL [api/index.py]: Generic Exception during 'app.main' import. Error: {e_generic_import}"
    )
    print(f"--- [api/index.py] Traceback for Generic Import Exception: --------")
    traceback.print_exc()
    print(f"--- [api/index.py] End Traceback --------------------")

if fastapi_app_instance is None or fastapi_app_instance.title != os.getenv(
    "EXPECTED_APP_TITLE", "Dental X-ray DICOM Viewer"
):  # Compare against expected title from settings
    print(
        f"--- [api/index.py] Main FastAPI app instance NOT loaded correctly or is the fallback. Creating/Using Fallback Error API. ---"
    )
    # (It might have been set to None or failed a check, so re-ensure fallback if necessary)
    if "FastAPI" not in globals():
        from fastapi import (
            FastAPI,
        )  # Ensure FastAPI is imported if previous try failed early
    _fastapi_app_instance_fallback = FastAPI(
        title="Error API - Backend Load Failed"
    )  # Use different var name to avoid confusion

    @_fastapi_app_instance_fallback.get("/")
    def error_root_fallback():
        return {"message": "Error: Backend application could not be loaded (fallback)."}

    @_fastapi_app_instance_fallback.get("/api/v1/healthz")
    def error_healthz_fallback():
        return {
            "status": "unhealthy",
            "message": "Backend application could not be loaded (fallback).",
        }

    fastapi_app_instance = (
        _fastapi_app_instance_fallback  # Assign to the main variable Mangum will use
    )
    print(
        f"--- [api/index.py] Fallback FastAPI app is now active: {fastapi_app_instance.title}"
    )


from mangum import Mangum

print(
    f"--- [api/index.py] About to initialize Mangum with app titled: '{fastapi_app_instance.title if fastapi_app_instance else 'None'}' ---"
)
handler = Mangum(fastapi_app_instance, lifespan="off")
print(f"--- [api/index.py] Mangum handler created. API ready. ---")


if __name__ == "__main__":
    try:
        import uvicorn

        print(
            f"--- [api/index.py] Running locally with Uvicorn (__name__ == '__main__') ---"
        )
        if fastapi_app_instance:
            print(
                f"--- [api/index.py] FastAPI app to run: {fastapi_app_instance.title}"
            )
            if "Error API" not in fastapi_app_instance.title:
                print(
                    f"--- [api/index.py] Attempting to run MAIN backend application locally. ---"
                )
            else:
                print(
                    f"--- [api/index.py] Running FALLBACK backend application locally due to previous errors. ---"
                )
            uvicorn.run(fastapi_app_instance, host="0.0.0.0", port=8001)
        else:
            print(
                "--- [api/index.py] fastapi_app_instance is None, cannot run Uvicorn. ---"
            )
    except ImportError:
        print(
            "--- [api/index.py] Uvicorn not found for local run. Please install uvicorn. ---"
        )
    except Exception as e_uvicorn:
        print(f"--- [api/index.py] Error running Uvicorn locally: {e_uvicorn} ---")
        traceback.print_exc()
