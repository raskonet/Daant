# Stage 1: Builder - Installs dependencies
FROM python:3.10-slim-buster AS builder

WORKDIR /install
COPY requirements.txt .

# Install OS dependencies if any of your Python packages need them (e.g., for Pillow, libjpeg-dev might be needed)
# RUN apt-get update && apt-get install -y --no-install-recommends \
#     libjpeg-dev zlib1g-dev gcc \
#  && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.10-slim-buster AS runtime

WORKDIR /app

COPY --from=builder /opt/venv /opt/venv

ENV PATH="/opt/venv/bin:$PATH"

COPY ./app ./app

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:10000/api/v1/healthz || exit 1

CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "app.main:app", "-w", "2", "--bind", "0.0.0.0:10000"]
