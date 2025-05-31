# Stage 1: Builder - Installs dependencies into a virtual environment
FROM python:3.10-slim-buster AS builder

WORKDIR /app_builder

# Copy only the requirements file first to leverage Docker layer caching
COPY requirements.txt .

# Create and activate a virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies into the virtual environment
# Add --no-cache-dir to reduce image size slightly
# Consider adding OS dependencies here if needed (e.g., for Pillow: libjpeg-dev, zlib1g-dev)
# RUN apt-get update && apt-get install -y --no-install-recommends libjpeg-dev zlib1g-dev && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2: Runtime - Sets up the final image with the application code and venv
FROM python:3.10-slim-buster AS runtime

WORKDIR /app

# Copy the virtual environment from the builder stage
COPY --from=builder /opt/venv /opt/venv

# Add the virtual environment to the PATH
ENV PATH="/opt/venv/bin:$PATH"

# Copy your application code.
# This assumes your Python app's root package is 'app' located in 'backend/app/' in your repo.
# It will create /app/app/... inside the container.
COPY ./backend/app ./app

# Expose the port Gunicorn will listen on inside the container
EXPOSE 10000

# Healthcheck (ensure this endpoint exists and works in your FastAPI app)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:10000/api/v1/healthz || exit 1

# Command to run the application using Gunicorn
# Gunicorn will be run from /app (the WORKDIR).
# It will look for the 'app' variable in 'main.py' inside the 'app' package (/app/app/main.py).
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "app.main:app", "-w", "2", "--bind", "0.0.0.0:10000"]
