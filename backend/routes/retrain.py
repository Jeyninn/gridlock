from fastapi import APIRouter, UploadFile, File
import os
from services.pipeline import run_training_pipeline

router = APIRouter()

@router.post("/retrain")
async def retrain(file: UploadFile = File(...)):
    os.makedirs("outputs", exist_ok=True)

    temp_path = f"outputs/{file.filename}"

    with open(temp_path, "wb") as buffer:
        buffer.write(await file.read())

    result = run_training_pipeline(temp_path)

    return result