# Stage 1: Builder - Installs dependencies into a virtual environment
# This stage is named 'builder'
FROM python:3.10-slim-buster AS builder

WORKDIR /app_builder

# Copy only the requirements file first to leverage Docker layer caching
COPY requirements.txt .

# Create and activate a virtual environment
RUN python -m venv /opt/venv

# Install Python dependencies into the virtual environment using the venv's pip
RUN /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# Stage 2: Runtime - Sets up the final image with the application code and venv
FROM python:3.10-slim-buster AS runtime

# Install system dependencies needed by OpenCV (imported by inference_sdk)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the virtual environment from the stage named 'builder'
COPY --from=builder /opt/venv /opt/venv

# Add the virtual environment to the PATH for the runtime stage
ENV PATH="/opt/venv/bin:$PATH"

# Copy your application code.
COPY ./backend/app ./app

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:10000/api/v1/healthz || exit 1

CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "app.main:app", "-w", "2", "--bind", "0.0.0.0:10000"]
