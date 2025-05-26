from fastapi import FastAPI
from mangum import Mangum

app = FastAPI()


@app.get("/")
def read_root():
    return {"message": "Backend API is running"}


@app.get("/api/v1/test")
def test_endpoint():
    return {"message": "Test endpoint working"}


# Export handler for Vercel
handler = Mangum(app, lifespan="off")
