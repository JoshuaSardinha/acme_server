#!/bin/bash

# Blue-Green Deployment Monitoring Script
# Usage: ./scripts/monitor.sh [options]

set -e

PROJECT_NAME="national_niner_server"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WATCH_MODE=false
INTERVAL=10
ENVIRONMENT="prod"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -w|--watch)
            WATCH_MODE=true
            shift
            ;;
        -i|--interval)
            INTERVAL="$2"
            shift 2
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -h|--help)
            echo "Blue-Green Deployment Monitor"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  -w, --watch          Watch mode (continuous monitoring)"
            echo "  -i, --interval N     Update interval in seconds (default: 10)"
            echo "  -e, --env ENV        Environment to monitor (dev|prod, default: prod)"
            echo "  -h, --help           Show this help"
            echo ""
            echo "Examples:"
            echo "  $0                   Show current status"
            echo "  $0 --watch           Continuous monitoring"
            echo "  $0 -w -i 5           Watch with 5-second intervals"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Get container status
get_container_status() {
    local container_name="$1"
    if docker ps -q -f name="$container_name" -f status=running | grep -q .; then
        local health=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo 'no-health-check')
        if [[ "$health" == "healthy" ]]; then
            echo "healthy"
        elif [[ "$health" == "unhealthy" ]]; then
            echo "unhealthy"
        elif [[ "$health" == "starting" ]]; then
            echo "starting"
        else
            echo "running"
        fi
    else
        echo "stopped"
    fi
}

# Get active service from nginx
get_active_service() {
    local nginx_container="${PROJECT_NAME}-nginx"
    if docker ps -q -f name="$nginx_container" -f status=running | grep -q .; then
        local upstream=$(docker exec "$nginx_container" grep -E 'server.*:3000' /etc/nginx/conf.d/default.conf 2>/dev/null | head -1 || echo 'app_green')
        if [[ "$upstream" == *"blue"* ]]; then
            echo "app_blue"
        else
            echo "app_green"
        fi
    else
        echo "unknown"
    fi
}

# Check application endpoint
check_endpoint() {
    local url="$1"
    local name="$2"
    
    if timeout 5 curl -f -s "$url" > /dev/null 2>&1; then
        log_success "$name endpoint responding"
        return 0
    else
        log_error "$name endpoint not responding"
        return 1
    fi
}

# Show status header
show_header() {
    clear
    echo "=================================================="
    echo "  Blue-Green Deployment Monitor"
    echo "  Environment: $ENVIRONMENT"
    echo "  Time: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "=================================================="
    echo
}

# Show container status
show_container_status() {
    echo "Container Status:"
    echo "----------------"
    
    if [[ "$ENVIRONMENT" == "dev" ]]; then
        local dev_status=$(get_container_status "${PROJECT_NAME}-app_dev")
        printf "%-20s %s\n" "app_dev:" "$dev_status"
        
        local db_status=$(get_container_status "${PROJECT_NAME}-db_dev")
        printf "%-20s %s\n" "database:" "$db_status"
    else
        local blue_status=$(get_container_status "${PROJECT_NAME}-app_blue")
        local green_status=$(get_container_status "${PROJECT_NAME}-app_green")
        local nginx_status=$(get_container_status "${PROJECT_NAME}-nginx")
        local db_status=$(get_container_status "${PROJECT_NAME}-db_dev")
        
        local active_service=$(get_active_service)
        
        printf "%-20s %s" "app_blue:" "$blue_status"
        if [[ "$active_service" == "app_blue" ]]; then
            echo " (ACTIVE)"
        else
            echo " (idle)"
        fi
        
        printf "%-20s %s" "app_green:" "$green_status"
        if [[ "$active_service" == "app_green" ]]; then
            echo " (ACTIVE)"
        else
            echo " (idle)"
        fi
        
        printf "%-20s %s\n" "nginx:" "$nginx_status"
        printf "%-20s %s\n" "database:" "$db_status"
    fi
    echo
}

# Show service endpoints
show_endpoints() {
    echo "Endpoint Health:"
    echo "---------------"
    
    if [[ "$ENVIRONMENT" == "dev" ]]; then
        check_endpoint "http://localhost:3000/health" "Development API"
    else
        check_endpoint "http://localhost/health" "Production API (via nginx)"
        check_endpoint "http://localhost:80" "HTTP (should redirect to HTTPS)"
        
        # Check individual containers if they're accessible
        if docker ps -q -f name="${PROJECT_NAME}-app_blue" -f status=running | grep -q .; then
            if timeout 5 curl -f -s "http://localhost:3000/health" > /dev/null 2>&1; then
                log_success "Blue container direct access"
            fi
        fi
        
        if docker ps -q -f name="${PROJECT_NAME}-app_green" -f status=running | grep -q .; then
            if timeout 5 curl -f -s "http://localhost:3000/health" > /dev/null 2>&1; then
                log_success "Green container direct access"
            fi
        fi
    fi
    echo
}

# Show resource usage
show_resource_usage() {
    echo "Resource Usage:"
    echo "--------------"
    
    if [[ "$ENVIRONMENT" == "dev" ]]; then
        local containers=("${PROJECT_NAME}-app_dev" "${PROJECT_NAME}-db_dev")
    else
        local containers=("${PROJECT_NAME}-app_blue" "${PROJECT_NAME}-app_green" "${PROJECT_NAME}-nginx" "${PROJECT_NAME}-db_dev")
    fi
    
    for container in "${containers[@]}"; do
        if docker ps -q -f name="$container" -f status=running | grep -q .; then
            local stats=$(docker stats --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}" "$container" 2>/dev/null | tail -n 1)
            printf "%-20s %s\n" "${container##*-}:" "$stats"
        fi
    done
    echo
}

# Show recent logs
show_recent_logs() {
    echo "Recent Logs:"
    echo "-----------"
    
    if [[ "$ENVIRONMENT" == "dev" ]]; then
        echo "Development logs (last 5 lines):"
        docker logs "${PROJECT_NAME}-app_dev" --tail 5 2>/dev/null || echo "No logs available"
    else
        local active_service=$(get_active_service)
        if [[ "$active_service" != "unknown" ]]; then
            echo "$active_service logs (last 5 lines):"
            docker logs "${PROJECT_NAME}-${active_service}" --tail 5 2>/dev/null || echo "No logs available"
        fi
        
        echo
        echo "Nginx logs (last 3 lines):"
        docker logs "${PROJECT_NAME}-nginx" --tail 3 2>/dev/null || echo "No logs available"
    fi
    echo
}

# Show nginx configuration
show_nginx_config() {
    if [[ "$ENVIRONMENT" == "prod" ]]; then
        echo "Nginx Configuration:"
        echo "------------------"
        
        if docker ps -q -f name="${PROJECT_NAME}-nginx" -f status=running | grep -q .; then
            echo "Current upstream configuration:"
            docker exec "${PROJECT_NAME}-nginx" grep -A 5 "upstream app" /etc/nginx/conf.d/default.conf 2>/dev/null || echo "Unable to read nginx config"
        else
            echo "Nginx container not running"
        fi
        echo
    fi
}

# Main monitoring function
show_status() {
    if [[ "$WATCH_MODE" == true ]]; then
        show_header
    fi
    
    show_container_status
    show_endpoints
    
    if [[ "$ENVIRONMENT" == "prod" ]]; then
        show_nginx_config
    fi
    
    show_resource_usage
    show_recent_logs
    
    if [[ "$WATCH_MODE" == true ]]; then
        echo "Press Ctrl+C to exit"
        echo "Next update in $INTERVAL seconds..."
    fi
}

# Cleanup function
cleanup() {
    echo
    log_info "Monitoring stopped"
    exit 0
}

# Main execution
main() {
    # Set up signal handlers
    trap cleanup SIGINT SIGTERM
    
    if [[ "$WATCH_MODE" == true ]]; then
        while true; do
            show_status
            sleep "$INTERVAL"
        done
    else
        show_status
    fi
}

# Run main function
main