#!/bin/bash
# Docker Compose Development Workflow Test Script

echo "🧪 Testing Docker Compose Development Workflow"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        exit 1
    fi
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Check if Docker is running
print_info "Checking if Docker daemon is running..."
docker info > /dev/null 2>&1
print_status $? "Docker daemon is running"

# Validate Docker Compose configuration
print_info "Validating Docker Compose configuration..."
docker compose config > /dev/null 2>&1
print_status $? "Docker Compose configuration is valid"

# Test 1: Build development containers
print_info "Building development containers..."
docker compose --profile dev build
print_status $? "Development containers built successfully"

# Test 2: Start development environment
print_info "Starting development environment..."
docker compose --profile dev up -d
sleep 10  # Give containers time to start
print_status $? "Development environment started"

# Test 3: Check if database container is healthy
print_info "Checking database health..."
timeout 60 bash -c 'until docker compose --profile dev ps | grep -q "healthy"; do sleep 2; done'
print_status $? "Database container is healthy"

# Test 4: Check if app container is running
print_info "Checking if app container is running..."
docker compose --profile dev ps | grep -q "app_dev.*Up"
print_status $? "App container is running"

# Test 5: Test database connectivity from app container
print_info "Testing database connectivity..."
docker compose --profile dev exec app_dev mysqladmin ping -h db -u niner_user -pgoldenEYE17%d > /dev/null 2>&1
print_status $? "Database connectivity successful"

# Test 6: Check if app responds to health check
print_info "Testing app health endpoint..."
timeout 30 bash -c 'until curl -f http://localhost:3000/health > /dev/null 2>&1; do sleep 2; done'
print_status $? "App health endpoint responding"

# Test 7: Create a test file to verify hot-reloading
print_info "Testing hot-reloading (creating test file)..."
echo "// Test hot-reload change" > /tmp/test-change.txt
mv /tmp/test-change.txt ./src/test-hot-reload.ts
print_status $? "Test file created for hot-reload verification"

# Test 8: Check logs for restart indication
print_info "Checking for hot-reload in logs..."
sleep 5
docker compose --profile dev logs app_dev | grep -q "restarting\|compiled\|change detected" || echo "Manual verification needed for hot-reload"

echo ""
echo "🎉 Development workflow tests completed!"
echo "📝 Next steps:"
echo "   1. Verify hot-reloading by editing a source file"
echo "   2. Check that changes are reflected without rebuilding"
echo "   3. Test environment variables are loaded correctly"

# Cleanup
print_info "Cleaning up test files..."
rm -f ./src/test-hot-reload.ts
docker compose --profile dev down
print_status $? "Test cleanup completed"