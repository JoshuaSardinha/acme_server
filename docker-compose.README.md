# Docker Compose Usage Guide

This project uses Docker Compose profiles to separate development, testing, and production-like environments.

## Available Profiles

### Development Profile (`dev`)
- **Services**: `db` (development database), `app_dev` (hot-reloading app)
- **Features**: Hot-reloading, source code volume mounting, port 3000 exposed
- **Environment**: Uses `.env.development`

```bash
# Start development environment with hot-reloading
docker-compose --profile dev up --build

# Access the app at http://localhost:3000
```

### Test Profile (`test`)
- **Services**: `test_db` (isolated test database), `app_test` (test runner)
- **Features**: Isolated test database, runs test suite and exits
- **Environment**: Uses `.env.test`

```bash
# Run test suite in Docker
docker-compose --profile test up --build --abort-on-container-exit

# The exit code reflects test success/failure
```

### Production Profile (`prod`)
- **Services**: `db`, `app_blue`, `app_green` (blue/green deployment)
- **Features**: Production-like blue/green deployment setup
- **Environment**: Uses environment variables directly

```bash
# Start production-like environment
docker-compose --profile prod up --build
```

## Quick Commands

```bash
# Development with hot-reloading
docker-compose --profile dev up --build

# Run tests
docker-compose --profile test up --build --abort-on-container-exit

# Production setup
docker-compose --profile prod up --build

# Stop all services
docker-compose down

# Remove volumes (clean slate)
docker-compose down -v
```

## Database Services

- **Development DB**: `db` service using `db-data-dev` volume
- **Test DB**: `test_db` service using `db-data-test` volume (isolated)
- **Production DB**: Same `db` service for blue/green apps

## Environment Files

- `.env.development` - Development configuration
- `.env.test` - Test configuration
- Environment variables for production profile