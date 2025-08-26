FROM python:3.11-slim
RUN apt-get update && apt-get install -y gcc g++ make libpq-dev && rm -rf /var/lib/apt/lists/*
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN useradd -m -u 1000 appuser
WORKDIR /app
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt
COPY app.py .
USER appuser
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "app:application"]