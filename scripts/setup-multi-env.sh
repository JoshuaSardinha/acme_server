#!/bin/bash

# Multi-Environment Deployment Setup Script
# This script helps set up the multi-environment deployment configuration

set -e

echo "🚀 National Niner Multi-Environment Deployment Setup"
echo "=================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "Jenkinsfile" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_info "Starting multi-environment deployment setup..."

# 1. Validate configuration files
print_info "Validating configuration files..."

required_files=(
    "config/deployment-config.json"
    "config/environments/dev.env"
    "config/environments/prod.env"
    "Jenkinsfile"
    "docker-compose.yml"
    "DEPLOYMENT.md"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        print_error "Required file missing: $file"
        exit 1
    fi
done

print_success "All configuration files present"

# 2. Check for placeholder values that need updating
print_info "Checking for placeholder values..."

placeholders_found=false

# Check Jenkinsfile for PROD_SERVER_IP_PLACEHOLDER
if grep -q "PROD_SERVER_IP_PLACEHOLDER" Jenkinsfile; then
    print_warning "Please update PROD_SERVER in Jenkinsfile with your production server IP"
    placeholders_found=true
fi

# Check deployment config for placeholder IPs
if grep -q "PROD_SERVER_IP_HERE" config/deployment-config.json; then
    print_warning "Please update production server IP in config/deployment-config.json"
    placeholders_found=true
fi

# Check environment files for placeholder values
if grep -q "_here" config/environments/dev.env; then
    print_warning "Please update placeholder values in config/environments/dev.env"
    placeholders_found=true
fi

if grep -q "_here" config/environments/prod.env; then
    print_warning "Please update placeholder values in config/environments/prod.env"
    placeholders_found=true
fi

if [ "$placeholders_found" = true ]; then
    echo ""
    print_warning "Configuration placeholders found. Please update the following:"
    echo "  1. Production server IP address"
    echo "  2. Auth0 configuration values"
    echo "  3. API keys and external service IDs"
    echo ""
    read -p "Continue anyway? (y/N): " continue_setup
    if [[ ! $continue_setup =~ ^[Yy]$ ]]; then
        print_info "Setup cancelled. Please update placeholder values and run again."
        exit 0
    fi
fi

# 3. Docker setup validation
print_info "Validating Docker setup..."

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

print_success "Docker and Docker Compose are available"

# 4. Test Docker Compose configuration
print_info "Testing Docker Compose configuration..."

if docker-compose config > /dev/null 2>&1; then
    print_success "Docker Compose configuration is valid"
else
    print_error "Docker Compose configuration has errors. Please check docker-compose.yml"
    exit 1
fi

# 5. Create necessary directories
print_info "Creating necessary directories..."

mkdir -p logs
mkdir -p backups
mkdir -p deployments

print_success "Directory structure created"

# 6. Test environment file loading
print_info "Testing environment file loading..."

for env in dev prod; do
    if [ -f "config/environments/${env}.env" ]; then
        # Count non-empty, non-comment lines
        config_count=$(grep -c '^[^#]*=' "config/environments/${env}.env" || true)
        print_success "${env}.env has ${config_count} configuration entries"
    fi
done

# 7. Jenkins credentials checklist
echo ""
print_info "Jenkins Credentials Setup Checklist:"
echo "======================================"

credentials=(
    "DEV_SSH_KEY (SSH private key for DEV server)"
    "DEV_DB_USER (Development database username)"
    "DEV_DB_PASSWORD (Development database password)"
    "DEV_DB_NAME (Development database name)"
    "DEV_AUTH0_CLIENT_SECRET (Auth0 client secret for DEV)"
    "DEV_AUTH0_MANAGEMENT_CLIENT_SECRET (Auth0 management secret for DEV)"
    ""
    "PROD_SSH_KEY (SSH private key for PROD server)"
    "PROD_DB_USER (Production database username)"
    "PROD_DB_PASSWORD (Production database password)"
    "PROD_DB_NAME (Production database name)"
    "PROD_AUTH0_CLIENT_SECRET (Auth0 client secret for PROD)"
    "PROD_AUTH0_MANAGEMENT_CLIENT_SECRET (Auth0 management secret for PROD)"
    ""
    "SLACK_WEBHOOK (Optional: Slack webhook for notifications)"
)

for cred in "${credentials[@]}"; do
    if [ -n "$cred" ]; then
        echo "  ☐ $cred"
    else
        echo ""
    fi
done

# 8. Deployment flow summary
echo ""
print_info "Deployment Flow Summary:"
echo "========================"
echo "  Feature Branch → DEV (auto)"
echo "  Main Branch   → DEV (auto) → PROD (manual approval)"
echo "  Hotfix Branch → DEV (auto) → PROD (manual approval, fast-track)"

# 9. Next steps
echo ""
print_info "Next Steps:"
echo "==========="
echo "  1. Update placeholder values in configuration files"
echo "  2. Set up Jenkins credentials (see checklist above)"
echo "  3. Configure production server (see DEPLOYMENT.md)"
echo "  4. Test deployment with a feature branch"
echo "  5. Review and customize environment-specific settings"

# 10. Useful commands
echo ""
print_info "Useful Commands:"
echo "================"
echo "  # Test DEV environment locally:"
echo "  docker-compose --env-file config/environments/dev.env --profile dev up"
echo ""
echo "  # Test PROD environment locally:"  
echo "  docker-compose --env-file config/environments/prod.env --profile prod up"
echo ""
echo "  # Check deployment status:"
echo "  curl -f http://server-ip/health"
echo ""
echo "  # View deployment logs:"
echo "  docker-compose --profile prod logs -f"

echo ""
print_success "Multi-environment deployment setup completed!"
print_info "For detailed documentation, see DEPLOYMENT.md"

# Optional: Generate a sample credentials template
read -p "Generate a Jenkins credentials template file? (y/N): " generate_template
if [[ $generate_template =~ ^[Yy]$ ]]; then
    cat > jenkins-credentials-template.md << 'EOF'
# Jenkins Credentials Setup Template

Use this template to set up credentials in Jenkins (Manage Jenkins > Credentials).

## DEV Environment Credentials

| Credential ID | Type | Description | Example Value |
|---------------|------|-------------|---------------|
| DEV_SSH_KEY | SSH Username with private key | SSH access to DEV server | Username: deploy, Private Key: [SSH key content] |
| DEV_DB_USER | Secret text | Database username for DEV | national_niner_dev_user |
| DEV_DB_PASSWORD | Secret text | Database password for DEV | [secure password] |
| DEV_DB_NAME | Secret text | Database name for DEV | national_niner_dev |
| DEV_AUTH0_CLIENT_SECRET | Secret text | Auth0 client secret for DEV | [Auth0 DEV secret] |
| DEV_AUTH0_MANAGEMENT_CLIENT_SECRET | Secret text | Auth0 management secret for DEV | [Auth0 DEV mgmt secret] |

## PROD Environment Credentials

| Credential ID | Type | Description | Example Value |
|---------------|------|-------------|---------------|
| PROD_SSH_KEY | SSH Username with private key | SSH access to PROD server | Username: deploy, Private Key: [SSH key content] |
| PROD_DB_USER | Secret text | Database username for PROD | national_niner_prod_user |
| PROD_DB_PASSWORD | Secret text | Database password for PROD | [secure password] |
| PROD_DB_NAME | Secret text | Database name for PROD | national_niner_prod |
| PROD_AUTH0_CLIENT_SECRET | Secret text | Auth0 client secret for PROD | [Auth0 PROD secret] |
| PROD_AUTH0_MANAGEMENT_CLIENT_SECRET | Secret text | Auth0 management secret for PROD | [Auth0 PROD mgmt secret] |

## Optional Credentials

| Credential ID | Type | Description | Example Value |
|---------------|------|-------------|---------------|
| SLACK_WEBHOOK | Secret text | Slack webhook for notifications | https://hooks.slack.com/services/... |

## Setup Instructions

1. Go to Jenkins Dashboard
2. Navigate to "Manage Jenkins" > "Credentials"
3. Select appropriate domain (usually "Global")
4. Click "Add Credentials" for each entry above
5. Fill in the credential ID exactly as shown
6. Add the actual values (replace examples)
7. Test the pipeline with a feature branch

## Security Notes

- Use strong, unique passwords for production
- Rotate credentials regularly (quarterly recommended)
- Limit access to production credentials
- Monitor credential usage through Jenkins audit logs
EOF

    print_success "Jenkins credentials template created: jenkins-credentials-template.md"
fi

echo ""
print_success "Setup complete! 🎉"