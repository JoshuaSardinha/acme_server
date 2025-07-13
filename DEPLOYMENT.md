# Multi-Environment Deployment Guide

## Overview

This project uses a multi-environment Jenkins pipeline with proper DEV and PROD server separation, following CI/CD best practices.

## Deployment Flow

```
Feature Branch → DEV (auto)
Main Branch   → DEV (auto) → PROD (manual approval)
Hotfix Branch → DEV (auto) → PROD (manual approval)
```

## Environment Configuration

### DEV Server

- **IP**: `147.93.46.157` (current)
- **Purpose**: Development testing, automatic deployment
- **Access**: All developers

### PROD Server

- **IP**: `147.93.119.33` (update in Jenkinsfile line 30)
- **Purpose**: Production environment
- **Access**: Manual approval required

## Jenkins Credentials Setup

You need to configure the following credentials in Jenkins:

### DEV Environment Credentials

- `DEV_SSH_KEY` - SSH private key for DEV server access
- `DEV_DB_USER` - Development database user
- `DEV_DB_PASSWORD` - Development database password
- `DEV_DB_NAME` - Development database name
- `DEV_AUTH0_CLIENT_SECRET` - Development Auth0 client secret
- `DEV_AUTH0_MANAGEMENT_CLIENT_SECRET` - Development Auth0 management secret
- `DEV_NODE_ENV` - Development node environment (usually 'development')

### PROD Environment Credentials

- `PROD_SSH_KEY` - SSH private key for PROD server access
- `PROD_DB_USER` - Production database user
- `PROD_DB_PASSWORD` - Production database password
- `PROD_DB_NAME` - Production database name
- `PROD_AUTH0_CLIENT_SECRET` - Production Auth0 client secret
- `PROD_AUTH0_MANAGEMENT_CLIENT_SECRET` - Production Auth0 management secret
- `PROD_NODE_ENV` - Production node environment ('production')

## Server Prerequisites

Both DEV and PROD servers need:

1. **Docker and Docker Compose** installed
2. **Deploy user** with Docker access:
   ```bash
   sudo usermod -aG docker deploy
   ```
3. **Directory structure**:
   ```bash
   sudo mkdir -p /opt/national-niner
   sudo chown deploy:deploy /opt/national-niner
   ```
4. **SSH key authentication** configured for the deploy user

## Pipeline Features

### Automatic DEV Deployment

- **Triggers**: Every push to any branch
- **Process**: Build → Test → Deploy to DEV
- **Zero manual intervention**

### Production Approval

- **Triggers**: Only main branch and hotfix branches
- **Process**: Build → Test → DEV → **Manual Approval** → PROD
- **Timeout**: 60 minutes for approval
- **Requires**: Deployment reason and approver

### Blue-Green Deployment

- **Zero downtime** on both DEV and PROD
- **Automatic rollback** on health check failure
- **Traffic switching** via nginx
- **Container cleanup** after successful deployment

### Health Checks

- **Application health**: `http://server/health`
- **Timeout**: 5 minutes with 10-second intervals
- **Automatic recovery**: Rollback on failure

## Usage

### Deploying to DEV

Just push to any branch:

```bash
git push origin feature/new-feature
```

### Deploying to Production

1. Push to main branch:
   ```bash
   git push origin main
   ```
2. Wait for DEV deployment to complete
3. Approve production deployment in Jenkins UI
4. Provide deployment reason

### Emergency Rollback

Use the existing blue-green infrastructure:

1. Check current active container
2. Start the inactive container
3. Switch nginx traffic
4. Stop the problematic container

## Monitoring

### Health Endpoints

- `http://dev-server/health` - DEV health
- `http://prod-server/health` - PROD health

### Container Status

```bash
# Check running containers
docker ps | grep national_niner

# Check logs
docker logs national_niner_server-app_green
docker logs national_niner_server-app_blue
```

### Nginx Status

```bash
# Check nginx config
docker exec national_niner_server-nginx cat /etc/nginx/conf.d/default.conf

# Check nginx logs
docker logs national_niner_server-nginx
```

## Troubleshooting

### Common Issues

1. **SSH Connection Failed**

   - Check SSH key configuration in Jenkins
   - Verify server IP and user access

2. **Environment Variables Missing**

   - Verify all credentials are configured in Jenkins
   - Check credential ID naming convention

3. **Health Check Failed**

   - Check application logs
   - Verify database connectivity
   - Check Auth0 configuration

4. **Traffic Switch Failed**
   - Check nginx container status
   - Verify nginx configuration syntax

### Emergency Procedures

1. **Manual Rollback**:

   ```bash
   ssh deploy@server-ip
   cd /opt/national-niner
   docker-compose --profile prod up -d app_green  # or app_blue
   # Update nginx config manually
   # Reload nginx
   ```

2. **Database Recovery**:
   ```bash
   # Access container
   docker exec -it national_niner_server-app_green bash
   # Run specific migration rollback
   npx sequelize-cli db:migrate:undo
   ```

## Configuration Updates

### Adding New Environment Variables

1. Add to docker-compose.yml environment section
2. Add credential to Jenkins
3. Update Jenkinsfile environment file creation
4. Update this documentation

### Changing Server IPs

1. Update `DEV_SERVER` or `PROD_SERVER` in Jenkinsfile
2. Update SSH keys in Jenkins if needed
3. Test connection manually

### Modifying Approval Process

1. Update `timeout` in Production Approval stage
2. Modify approval parameters as needed
3. Add/remove approver restrictions

## Security Notes

- All credentials are stored securely in Jenkins
- SSH keys use private key authentication
- Environment files are temporary and cleaned up
- Production requires manual approval with audit trail

---

For questions or issues, check Jenkins build logs or contact the DevOps team.
