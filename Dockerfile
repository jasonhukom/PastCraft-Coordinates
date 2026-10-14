# Use official lightweight Python image
FROM python:3.11-slim

# Set working directory inside container
WORKDIR /app

# Prevent Python from writing .pyc files and enable unbuffered console output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install dependencies first (leverages Docker layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all application files (backend, frontend, database)
COPY . .

# Expose the Flask web application port
EXPOSE 5000

# Initialize the database if not present, then launch the Flask server
CMD ["sh", "-c", "python database/init_db.py && python backend/app.py"]
