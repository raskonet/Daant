# Stage 2: Runtime - Sets up the final image with the application code and venv
FROM python:3.10-slim-buster AS runtime

# Install libGL.so.1 and other common OpenCV dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    # Add other potential dependencies if errors persist for other .so files
    # For example, sometimes libsm6, libxext6, libxrender-dev are needed
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the virtual environment from the builder stage
COPY --from=builder /opt/venv /opt/venv

# Add the virtual environment to the PATH
ENV PATH="/opt/venv/bin:$PATH"

# Copy your application code.
COPY ./backend/app ./app

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:10000/api/v1/healthz || exit 1

CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "app.main:app", "-w", "2", "--bind", "0.0.0.0:10000"]
