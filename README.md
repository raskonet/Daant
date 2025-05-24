# Dental DICOM Editor

A web-based application for viewing, editing, and analyzing dental DICOM images, featuring AI-powered tools for detection, segmentation, and classification.

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Running the Application](#running-the-application)
  - [Backend](#backend)
  - [Frontend](#frontend)
- [API Endpoints](#api-endpoints)
- [AI Models](#ai-models)
- [Deployment](#deployment)
- [Future Enhancements](#future-enhancements)
- [Contributing](#contributing)
- [License](#license)

## Project Overview

This project aims to provide dentists and dental professionals with a modern, browser-based tool for interacting with DICOM (Digital Imaging and Communications in Medicine) files. It supports standard DICOM viewing functionalities along with advanced image manipulation tools and integrated AI assistance for tasks like caries detection and tooth segmentation.

The application is built with a Python FastAPI backend and a Next.js (React) frontend, offering a responsive and interactive user experience.

## Features

- **DICOM Upload & Parsing:** Securely upload and parse `.dcm` files.
- **Image Rendering:** Display DICOM images as high-quality PNGs in the browser.
- **Image Manipulation Tools:**
  - Zoom, Pan, Rotate, Flip
  - Brightness & Contrast Adjustment
  - Color Inversion
  - Image Cropping (selection and application)
- **Annotation Tools:**
  - Freehand Drawing
  - Text Annotations
  - Measurement Tool (pixel spacing aware)
  - Highlighting
- **Undo Functionality:** Revert recent image modifications and annotation actions.
- **AI-Powered Analysis:**
  - **Caries Detection:** Identifies potential caries using a pre-trained model (`best.pt`).
  - **Tooth Segmentation:** Outlines tooth structures using a U-Net model (`dental_xray_seg.h5`).
  - **Calculus/Caries Classification:** Classifies regions based on a pre-trained model (`classification.h5`).
  - Toggle visibility of AI-generated findings.
- **Windowing Presets:** Quick adjustments for common viewing scenarios (e.g., "Bone", "Soft Tissue" - simulated).
- **PHI (Protected Health Information) Toggle:** Option to mask patient-identifiable information on display.
- **FMX Mode (UI Placeholder):** UI elements for navigating Full Mouth X-ray series (core FMX logic pending).
- **Image Export:** Download the current view (with annotations and modifications) as a PNG file.

## Tech Stack

- **Backend:**
  - Python 3.11+
  - FastAPI (for RESTful APIs)
  - Uvicorn (ASGI server)
  - Pydicom (for DICOM file parsing)
  - Pillow (PIL) (for image processing)
  - NumPy (for numerical operations)
  - OpenCV (for AI image preprocessing)
  - TensorFlow/Keras (for `.h5` AI models)
  - Ultralytics YOLO (for `.pt` AI models)
  - Hugging Face Hub (for optional model download)
- **Frontend:**
  - Node.js (v18+)
  - Next.js (React framework)
  - TypeScript
  - Zustand (for state management)
  - Konva.js (for 2D canvas rendering and interactivity)
  - Tailwind CSS (for styling)
  - Axios (for API requests)
  - Lucide React (for icons)
- **Database:** (Not currently implemented, DICOMs stored in-memory for session)
- **Development Tools:**
  - Git & GitHub
  - Docker (optional, for backend containerization)

## Getting Started

### Prerequisites

- Python 3.11 or higher
- Node.js v18 or higher (with npm or yarn)
- Git
- (Optional) Docker Desktop if you plan to use Docker for the backend.
- (Optional for Git LFS models) Git LFS: [https://git-lfs.github.com/](https://git-lfs.github.com/)

### Backend Setup

1.  **Navigate to the backend directory:**

    ```bash
    cd backend
    ```

2.  **Create and activate a Python virtual environment:**

    ```bash
    python -m venv myenv
    source myenv/bin/activate  # On Windows: myenv\Scripts\activate
    ```

3.  **Install Python dependencies:**

    ```bash
    pip install -r requirements.txt
    ```

4.  **Place AI Models:**
    Ensure your pre-trained AI model files (`best.pt`, `classification.h5`, `dental_xray_seg.h5`) are placed in the `backend/models/` directory.
    If these models are managed by Git LFS, ensure you have pulled them:

    ```bash
    git lfs pull
    ```

5.  **Environment Variables (Optional for local):**
    The backend uses default settings but can be configured via a `.env` file in the `backend/` directory if needed (see `backend/app/core/config.py`).

### Frontend Setup

1.  **Navigate to the frontend directory:**

    ```bash
    cd frontend
    ```

2.  **Install Node.js dependencies:**

    ```bash
    npm install
    # or
    # yarn install
    ```

3.  **Environment Variables:**
    Create a `.env.local` file in the `frontend/` directory with the following content:
    ```env
    NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
    ```
    This points the frontend to your local backend API.

## Running the Application

You need to run both the backend and frontend servers simultaneously.

### Backend

1.  **Navigate to the `backend/` directory.**
2.  **Ensure your virtual environment is activated.**
3.  **Start the FastAPI server with Uvicorn:**
    ```bash
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
    ```
    The backend API will be available at `http://localhost:8000`. The OpenAPI documentation (Swagger UI) will be at `http://localhost:8000/api/v1/docs`.

### Frontend

1.  **Navigate to the `frontend/` directory.**
2.  **Start the Next.js development server:**
    ```bash
    npm run dev
    # or
    # yarn dev
    ```
    The frontend application will be available at `http://localhost:3000` (or another port if 3000 is busy).

Open `http://localhost:3000` in your browser to use the application.

## API Endpoints

The backend exposes the following main API V1 endpoints (prefixed with `/api/v1`):

- `POST /upload`: Uploads a DICOM (`.dcm`) file. Returns a unique `dicom_id`.
- `GET /dicom/{dicom_id}`: Fetches the processed DICOM data, including a base64 encoded PNG image and metadata.
- `POST /dicom/{dicom_id}/ai/{model_type}`: Runs AI analysis on the specified DICOM image.
  - `model_type` can be `detection`, `segmentation`, or `classification`.
  - Returns structured AI results (bounding boxes, contours, class predictions).
- `GET /healthz`: Health check endpoint.

Refer to the Swagger UI at `/api/v1/docs` on the running backend for detailed API specifications.

## AI Models

The application utilizes the following pre-trained models, expected in the `backend/models/` directory:

- **`best.pt`**: YOLOv8 model for caries detection.
- **`classification.h5`**: Keras model for classifying regions as calculus or caries.
- **`dental_xray_seg.h5`**: Keras U-Net model for segmenting teeth in panoramic X-rays (adapted for general dental X-ray segmentation).

If local segmentation model loading fails, the system attempts to fall back to a pre-trained model from Hugging Face Hub (`SerdarHelli/Segmentation-of-Teeth-in-Panoramic-X-ray-Image-Using-U-Net`).

## Deployment

This application can be deployed to platforms like Vercel (for the Next.js frontend and Python serverless functions for the backend) or using Docker for the backend on a container hosting service.

- **Vercel:** A `vercel.json` configuration file can be used to deploy the monorepo. The Python backend (including AI models and dependencies) must fit within Vercel's serverless function size limits. Git LFS is recommended for managing large model files with Vercel.
- **Docker:** A `Dockerfile` is provided in the `backend/` directory to containerize the FastAPI application. This container can then be deployed to services like AWS ECS, Google Cloud Run, Azure Container Instances, Fly.io, or Render.

(Detailed deployment instructions for a specific platform can be added here or in a separate `DEPLOYMENT.md` file.)

## Future Enhancements

- Persistent storage for uploaded DICOMs and user data (e.g., PostgreSQL, MongoDB).
- User authentication and authorization.
- Support for DICOM series and multi-frame DICOMs (full FMX support).
- More advanced AI model integration and result visualization.
- Real-time collaboration features.
- Report generation.
- Advanced DICOM tag editing.
- Redo functionality for image edits.
- Direct WC/WW (Window Center/Window Width) manipulation on the frontend.

## Contributing

Contributions are welcome! Please follow these steps:

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/YourFeatureName`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'Add some feature'`).
5.  Push to the branch (`git push origin feature/YourFeatureName`).
6.  Open a Pull Request.

Please ensure your code adheres to existing styling and that any new dependencies are documented.

## License

This project is licensed under the [MIT License](LICENSE.md) (or choose another license if you prefer, and add a LICENSE.md file).
