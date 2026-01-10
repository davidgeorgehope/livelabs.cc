from dotenv import load_dotenv
load_dotenv()  # Load .env file before other imports that use env vars

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base, SessionLocal
from .routes import auth, tracks, steps, enrollments, execute, organizations
from . import models
from .auth import get_password_hash

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="LiveLabs API",
    description="Guided learning platform for real SaaS products",
    version="1.0.0"
)

# CORS - Allow production and development origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3004",
        "http://127.0.0.1:3004",
        "https://livelabs.cc",
        "https://www.livelabs.cc",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers under /api prefix
app.include_router(auth.router, prefix="/api")
app.include_router(organizations.router, prefix="/api")
app.include_router(tracks.router, prefix="/api")
app.include_router(steps.router, prefix="/api")
app.include_router(enrollments.router, prefix="/api")
app.include_router(execute.router, prefix="/api")


@app.get("/")
def root():
    return {"message": "LiveLabs API", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "healthy"}


def seed_database():
    """Seed database with demo data if empty"""
    db = SessionLocal()
    try:
        # Check if already seeded
        if db.query(models.Organization).first():
            return

        # Create demo organization
        org = models.Organization(
            slug="demo",
            name="Demo Organization"
        )
        db.add(org)
        db.flush()

        # Create demo author user
        author = models.User(
            email="author@livelabs.cc",
            hashed_password=get_password_hash("demo123"),
            name="Demo Author",
            is_author=True,
            org_id=org.id
        )
        db.add(author)
        db.flush()

        # Create sample track
        track = models.Track(
            slug="elastic-observability-101",
            title="Elastic Observability 101",
            description="Learn the fundamentals of Elastic Observability. Connect to your Elastic Cloud cluster, ingest logs, and query your data.",
            docker_image="livelabs-runner:latest",
            is_published=True,
            author_id=author.id,
            org_id=org.id,
            env_template=[
                {"name": "ES_URL", "description": "Elasticsearch cluster URL (e.g., https://my-cluster.es.us-east-1.aws.found.io:9243)", "required": True},
                {"name": "ES_API_KEY", "description": "Elasticsearch API key for authentication", "required": True}
            ]
        )
        db.add(track)
        db.flush()

        # Create steps
        steps_data = [
            {
                "order": 1,
                "title": "Verify Connection",
                "instructions_md": """# Verify Connection

Before we begin, let's make sure you can connect to your Elasticsearch cluster.

## What we'll do
1. Run a health check against your cluster
2. Verify the cluster is responding

## Prerequisites
Make sure you have:
- Your Elasticsearch cluster URL
- A valid API key with read/write permissions

Click **Validate** to check your connection.""",
                "setup_script": "",
                "validation_script": """#!/bin/bash
set -e

echo "Checking connection to Elasticsearch..."
echo "URL: $ES_URL"

# Test cluster health
response=$(curl -s -H "Authorization: ApiKey $ES_API_KEY" "$ES_URL/_cluster/health")

echo "Response: $response"

# Check if we got a valid response
echo "$response" | jq -e '.status == "green" or .status == "yellow"' > /dev/null

echo "Connection successful! Cluster status: $(echo $response | jq -r '.status')"
""",
                "hints": ["Make sure your ES_URL includes the port (usually 9243)", "API keys should be base64 encoded"]
            },
            {
                "order": 2,
                "title": "Ingest Sample Logs",
                "instructions_md": """# Ingest Sample Logs

Now let's ingest some sample log data into your cluster.

## What we'll do
1. Create a logs index
2. Insert 100 sample log entries
3. Verify the data was indexed

Click **Run Setup** to ingest the sample data, then **Validate** to verify it worked.""",
                "setup_script": """#!/bin/bash
set -e

echo "Creating logs index and ingesting sample data..."

# Create index with mapping
curl -s -X PUT -H "Authorization: ApiKey $ES_API_KEY" -H "Content-Type: application/json" \
  "$ES_URL/logs" -d '{
  "mappings": {
    "properties": {
      "@timestamp": { "type": "date" },
      "message": { "type": "text" },
      "level": { "type": "keyword" },
      "service": { "type": "keyword" }
    }
  }
}' || true

# Ingest sample logs
for i in $(seq 1 100); do
  level=$([ $((i % 10)) -eq 0 ] && echo "error" || echo "info")
  service=$([ $((i % 2)) -eq 0 ] && echo "api" || echo "web")

  curl -s -X POST -H "Authorization: ApiKey $ES_API_KEY" -H "Content-Type: application/json" \
    "$ES_URL/logs/_doc" -d "{
      \"@timestamp\": \"$(date -Iseconds)\",
      \"message\": \"Sample log message $i\",
      \"level\": \"$level\",
      \"service\": \"$service\"
    }" > /dev/null
done

echo "Ingested 100 log entries!"

# Refresh index
curl -s -X POST -H "Authorization: ApiKey $ES_API_KEY" "$ES_URL/logs/_refresh"
echo "Index refreshed."
""",
                "validation_script": """#!/bin/bash
set -e

echo "Checking log count..."

response=$(curl -s -H "Authorization: ApiKey $ES_API_KEY" "$ES_URL/logs/_count")
count=$(echo $response | jq -r '.count')

echo "Found $count documents in logs index"

if [ "$count" -ge 100 ]; then
  echo "Success! You have at least 100 log entries."
  exit 0
else
  echo "Error: Expected at least 100 logs, found $count"
  exit 1
fi
""",
                "hints": ["If setup fails, check your API key has write permissions", "The index might already exist - that's okay"]
            },
            {
                "order": 3,
                "title": "Query Your Data",
                "instructions_md": """# Query Your Data

Let's run some queries against your log data.

## What we'll do
1. Search for error logs
2. Aggregate logs by service
3. Verify you can query effectively

Click **Run Setup** to run sample queries, then **Validate** to complete the track.""",
                "setup_script": """#!/bin/bash
set -e

echo "Running sample queries..."
echo ""
echo "=== Error Logs ==="
curl -s -H "Authorization: ApiKey $ES_API_KEY" -H "Content-Type: application/json" \
  "$ES_URL/logs/_search" -d '{
  "query": { "match": { "level": "error" } },
  "size": 3
}' | jq '.hits.hits[]._source'

echo ""
echo "=== Logs by Service ==="
curl -s -H "Authorization: ApiKey $ES_API_KEY" -H "Content-Type: application/json" \
  "$ES_URL/logs/_search" -d '{
  "size": 0,
  "aggs": {
    "by_service": {
      "terms": { "field": "service" }
    }
  }
}' | jq '.aggregations.by_service.buckets'

echo ""
echo "Queries complete!"
""",
                "validation_script": """#!/bin/bash
set -e

echo "Validating query capabilities..."

# Search for error logs
response=$(curl -s -H "Authorization: ApiKey $ES_API_KEY" -H "Content-Type: application/json" \
  "$ES_URL/logs/_search" -d '{
  "query": { "match": { "level": "error" } }
}')

error_count=$(echo $response | jq '.hits.total.value')
echo "Found $error_count error logs"

# Run aggregation
agg_response=$(curl -s -H "Authorization: ApiKey $ES_API_KEY" -H "Content-Type: application/json" \
  "$ES_URL/logs/_search" -d '{
  "size": 0,
  "aggs": {
    "by_service": {
      "terms": { "field": "service" }
    }
  }
}')

bucket_count=$(echo $agg_response | jq '.aggregations.by_service.buckets | length')
echo "Aggregation returned $bucket_count service buckets"

if [ "$bucket_count" -ge 1 ]; then
  echo ""
  echo "Congratulations! You've completed Elastic Observability 101!"
  exit 0
else
  echo "Error: Aggregation did not return expected results"
  exit 1
fi
""",
                "hints": ["Error logs should be about 10% of total", "There should be 2 services: api and web"]
            }
        ]

        for step_data in steps_data:
            step = models.Step(
                track_id=track.id,
                **step_data
            )
            db.add(step)

        db.commit()
        print("Database seeded successfully!")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()


# Seed on startup
@app.on_event("startup")
def startup_event():
    seed_database()
