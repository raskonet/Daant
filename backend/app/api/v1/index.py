# This file makes your FastAPI app Vercel-compatible.
# It should be at the root of what Vercel considers your backend project,
# typically inside an 'api' directory.
# e.g., if your Vercel project points to the 'backend' folder,
# this file would be 'backend/api/index.py'.

from app.main import app  # Import your FastAPI app instance

# Vercel will look for an 'app' or 'handler' variable.
# We are using the 'app' variable which is our FastAPI instance.
# FastAPI is ASGI compatible, and Vercel's Python runtime can handle ASGI apps.

# If you needed to do something specific for Vercel, you could wrap it:
# handler = app
