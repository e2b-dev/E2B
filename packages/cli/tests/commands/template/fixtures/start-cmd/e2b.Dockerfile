FROM python:3.11
WORKDIR /app
RUN pip install --upgrade pip
RUN pip install -r requirements.txt
ENV PYTHONUNBUFFERED=1
CMD ["python", "app.py"]