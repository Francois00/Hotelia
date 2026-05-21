FROM python:3.11-slim

# Build deps for Prophet / cmdstanpy / psycopg2
RUN apt-get update && apt-get install -y \
    gcc g++ make libpq-dev wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --timeout 600 -r requirements.txt

# Prophet 1.1.5 bundles cmdstan-2.33.1 but cmdstanpy>=1.3.0 requires a makefile
# in the cmdstan path that the bundled distribution omits. Creating it allows
# cmdstanpy's validate_cmdstan_path() to pass so the pre-compiled prophet_model.bin is used.
RUN python -c "import prophet, os; open(os.path.join(os.path.dirname(prophet.__file__), 'stan_model', 'cmdstan-2.33.1', 'makefile'), 'w').close()"

COPY . .

EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
