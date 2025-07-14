/* groovylint-disable CatchException, CompileStatic, DuplicateStringLiteral, InvertedIfElse, LineLength, MethodReturnTypeRequired, MethodSize, NestedBlockDepth, NglParseError, NoDef, UnnecessaryGetter, VariableTypeRequired */
pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'joshuasardinha/acme-api'
        DOCKER_TAG = 'latest'

        // Service Names
        GREEN_SERVICE = 'app_green'
        BLUE_SERVICE = 'app_blue'
        NGINX_SERVICE = 'nginx'

        // Container Names
        GREEN_CONTAINER = 'acme_server-app_green'
        BLUE_CONTAINER  = 'acme_server-app_blue'
        NGINX_CONTAINER = 'acme_server-nginx'

        // Deployment Configuration
        COMPOSE_PROJECT_NAME = 'acme_server'
        HEALTH_CHECK_TIMEOUT = '120'
        NGINX_CONFIG_PATH = '/opt/nginx/conf.d/default.conf'

        // Environment Detection
        DEPLOY_TO_DEV = 'true'  // Always deploy to DEV first
    // DEPLOY_TO_PROD will be set dynamically in Initialize stage

        // Server Configuration
        DEV_SERVER = '147.93.46.157'
        PROD_SERVER = '147.93.119.33'  // Update with actual PROD server IP

        // Docker Compose Profile
        COMPOSE_PROFILE = 'prod'  // Always use prod profile for blue-green deployment
    }

    stages {
        stage('Checkout') {
      steps {
        script {
          // Capture SCM information during checkout
          def scmVars = checkout scm
          // Store the branch name for later use
          env.SCM_BRANCH = scmVars.GIT_BRANCH ?: ''
        }
      }
        }

        stage('Initialize') {
      steps {
        script {
          echo '🚀 Starting multi-environment deployment pipeline'

          // Debug: Print all environment variables
          echo '--- Environment Variables ---'
          sh 'printenv | grep -E "(GIT|BRANCH|JOB)" | sort || true'
          echo '-----------------------------'

          // Debug: Print current directory and nginx config paths
          echo '--- Path Debugging ---'
          sh 'echo "Current directory: $(pwd)"'
          sh 'echo "Nginx config file exists on host: $(ls -la /opt/nginx/conf.d/default.conf 2>/dev/null || echo "NOT FOUND")"'
          echo '-----------------------------'

          // Extract clean branch name from SCM_BRANCH (removes origin/ prefix)
          def branchName = env.SCM_BRANCH ? env.SCM_BRANCH.split('/').last() : ''

          // Fallback to GIT_BRANCH if SCM_BRANCH is not set
          if (!branchName && env.GIT_BRANCH) {
            branchName = env.GIT_BRANCH.split('/').last()
          }

          echo "Branch detected: ${branchName}"

          // Set DEPLOY_TO_PROD dynamically based on branch name
          if (branchName) {
            env.DEPLOY_TO_PROD = (branchName == 'main' || branchName.startsWith('hotfix/')).toString()
          } else {
            error('Could not determine branch name. Stopping build.')
          }

          echo "Deploy to DEV: ${env.DEPLOY_TO_DEV}"
          echo "Deploy to PROD: ${env.DEPLOY_TO_PROD}"

          // Initialize Docker environment
          def dockerHome = tool 'myDocker'
          env.PATH = "${dockerHome}/bin:${env.PATH}"

          echo "Docker Compose Profile: ${env.COMPOSE_PROFILE}"
        }
      }
        }

        stage('Build & Test') {
      parallel {
        stage('Build') {
          steps {
            script {
              echo "🔨 Building Docker image: ${DOCKER_IMAGE}:${DOCKER_TAG}"
              sh "docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} ."
              echo '✅ Docker image built successfully'
            }
          }
        }

        stage('Test') {
          steps {
            script {
              echo '🧪 Running tests...'
              try {
                sh "docker run --rm ${DOCKER_IMAGE}:${DOCKER_TAG} npm test"
                echo '✅ Tests passed'
              } catch (Exception e) {
                echo "❌ Tests failed: ${e.getMessage()}"
                error 'Test failure. Stopping deployment.'
              }
            }
          }
        }
      }
        }

        stage('Deploy to DEV') {
      when {
        expression { env.DEPLOY_TO_DEV == 'true' }
      }
      steps {
        script {
          echo "🔄 Deploying to DEV server: ${env.DEV_SERVER}"
          deployToEnvironment('DEV', env.DEV_SERVER)
        }
      }
        }

        stage('Production Approval') {
      when {
        expression { env.DEPLOY_TO_PROD == 'true' }
      }
      steps {
        script {
          echo '⏸️ Production deployment requires approval'
          def deploymentReason = input(
            message: 'Deploy to Production?',
            parameters: [
              string(name: 'DEPLOYMENT_REASON', description: 'Reason for production deployment', defaultValue: '')
            ],
            submitterParameter: 'APPROVER'
          )

          env.DEPLOYMENT_REASON = deploymentReason
          env.APPROVED_BY = env.APPROVER

          echo "✅ Production deployment approved by: ${env.APPROVED_BY}"
          echo "📝 Reason: ${env.DEPLOYMENT_REASON}"
        }
      }
      options {
        timeout(time: 60, unit: 'MINUTES')
      }
        }

        stage('Deploy to PROD') {
      when {
        expression { env.DEPLOY_TO_PROD == 'true' && env.APPROVED_BY != null }
      }
      steps {
        script {
          echo "🚀 Deploying to PROD server: ${env.PROD_SERVER}"
          echo "👤 Approved by: ${env.APPROVED_BY}"
          deployToEnvironment('PROD', env.PROD_SERVER)
        }
      }
        }
    }

    post {
        success {
      script {
        def message = "✅ SUCCESS: Deployment completed for ${env.BRANCH_NAME}"
        if (env.DEPLOY_TO_PROD == 'true' && env.APPROVED_BY) {
          message += "\n🏭 PROD deployment approved by: ${env.APPROVED_BY}"
          message += "\n📝 Reason: ${env.DEPLOYMENT_REASON}"
        }
        echo message
      // Optional: Send Slack notification
      // slackSend(message: message)
      }
        }
        failure {
      script {
        def message = "❌ FAILURE: Deployment failed for ${env.BRANCH_NAME}"
        echo message
      // Optional: Send Slack notification
      // slackSend(message: message, color: 'danger')
      }
        }
        cleanup {
      // Cleanup runs in the same agent context as the main pipeline
      echo 'Cleaning up temporary files...'
      sh 'rm -f .env.jenkins deployment_state.txt active_container.txt || true'
        }
    }
}

// Helper function for environment deployment
def deployToEnvironment(String environment, String serverIP) {
  echo "📍 Deploying to ${environment} environment on ${serverIP}"

  // For DEV, we run Docker commands directly since Jenkins is on the same host
  // For PROD, we use SSH to connect to the remote server
  if (environment == 'DEV') {
    deployToDev()
  } else {
    deployToRemote(environment, serverIP)
  }
}

// Deploy to DEV environment (Jenkins and apps are on same host)
def deployToDev() {
  echo '🏠 Running DEV deployment locally (no SSH needed)'

  // Determine current state
  stage('Determine DEV State') {
        script {
      try {
        echo '🔍 Determining current deployment state on DEV...'

        def greenRunning = sh(returnStdout: true, script: "docker ps -q -f name=${GREEN_CONTAINER} || echo ''").trim()
        def blueRunning = sh(returnStdout: true, script: "docker ps -q -f name=${BLUE_CONTAINER} || echo ''").trim()
        def nginxRunning = sh(returnStdout: true, script: "docker ps -q -f name=${NGINX_CONTAINER} || echo ''").trim()

        echo "Green container running: ${greenRunning ? 'Yes' : 'No'}"
        echo "Blue container running: ${blueRunning ? 'Yes' : 'No'}"
        echo "Nginx container running: ${nginxRunning ? 'Yes' : 'No'}"

        def activeService
        def isInitialDeployment = false

        if (!greenRunning && !blueRunning) {
          echo 'No application containers running. Will start with GREEN as initial active service.'
          activeService = GREEN_SERVICE
          isInitialDeployment = true
        } else if (greenRunning && !blueRunning) {
          echo 'GREEN container is currently running'
          activeService = GREEN_SERVICE
        } else if (!greenRunning && blueRunning) {
          echo 'BLUE container is currently running'
          activeService = BLUE_SERVICE
        } else {
          echo 'Both containers running. Checking nginx configuration to determine active...'
          def currentUpstream = sh(returnStdout: true, script: """
            docker exec ${NGINX_CONTAINER} grep -E "set \\\$upstream_host.*:3000" /etc/nginx/conf.d/default.conf | head -1 || echo "app_green"
          """).trim()
          activeService = currentUpstream.contains('blue') ? BLUE_SERVICE : GREEN_SERVICE
        }

        def targetService = (activeService == GREEN_SERVICE) ? BLUE_SERVICE : GREEN_SERVICE

        echo "Current Active Service: ${activeService}"
        echo "Target Deployment Service: ${targetService}"
        echo "Initial Deployment: ${isInitialDeployment}"

        // Store deployment state
        env.DEV_ACTIVE_SERVICE = activeService
        env.DEV_TARGET_SERVICE = targetService
        env.DEV_INITIAL_DEPLOYMENT = isInitialDeployment.toString()

        // Write active service to file for reference
        writeFile file: 'active_container.txt', text: activeService
      } catch (Exception err) {
        echo "❌ Error determining active service: ${err}"
        error 'Failed to determine current deployment state for DEV'
      }
        }
  }

  // Deploy to target container
  stage('Deploy DEV Container') {
        def targetService = env.DEV_TARGET_SERVICE
        def isInitialDeployment = env.DEV_INITIAL_DEPLOYMENT == 'true'

        echo "🚀 Deploying to target container: ${targetService}"
        echo "📍 Initial deployment: ${isInitialDeployment}"

        withCredentials([
      string(credentialsId: 'DB_USER', variable: 'DB_USER'),
      string(credentialsId: 'DB_PASSWORD', variable: 'DB_PASSWORD'),
      string(credentialsId: 'DB_NAME', variable: 'DB_NAME'),
      string(credentialsId: 'AUTH0_CLIENT_SECRET', variable: 'AUTH0_CLIENT_SECRET'),
      string(credentialsId: 'AUTH0_MANAGEMENT_CLIENT_SECRET', variable: 'AUTH0_MANAGEMENT_CLIENT_SECRET'),
      string(credentialsId: 'NODE_ENV', variable: 'NODE_ENV'),
      string(credentialsId: 'AUTH0_ISSUER_BASE_URL', variable: 'AUTH0_ISSUER_BASE_URL'),
      string(credentialsId: 'AUTH0_CLIENT_ID', variable: 'AUTH0_CLIENT_ID'),
      string(credentialsId: 'AUTH0_AUDIENCE', variable: 'AUTH0_AUDIENCE')
    ]) {
      try {
        // Export environment variables and deploy
        sh """
          export DB_HOST=db
          export DB_PORT=3306
          export DB_USER="${DB_USER}"
          export DB_PASSWORD="${DB_PASSWORD}"
          export DB_NAME="${DB_NAME}"
          export AUTH0_CLIENT_SECRET="${AUTH0_CLIENT_SECRET}"
          export AUTH0_MANAGEMENT_CLIENT_SECRET="${AUTH0_MANAGEMENT_CLIENT_SECRET}"
          export NODE_ENV="${NODE_ENV}"
          export AUTH0_ISSUER_BASE_URL="${AUTH0_ISSUER_BASE_URL}"
          export AUTH0_CLIENT_ID="${AUTH0_CLIENT_ID}"
          export AUTH0_AUDIENCE="${AUTH0_AUDIENCE}"

          # Stop target container if running
          docker-compose --profile ${COMPOSE_PROFILE} stop ${targetService} || true
          docker-compose --profile ${COMPOSE_PROFILE} rm -f ${targetService} || true

          # Start target container
          docker-compose --profile ${COMPOSE_PROFILE} up -d --build ${targetService}

          # Ensure nginx is running (avoid container conflicts)
          if [ '${isInitialDeployment}' = 'true' ] || ! docker ps -q -f name=${NGINX_CONTAINER} > /dev/null 2>&1; then
            echo "Starting nginx container..."
            # Clean up any stopped nginx containers to avoid naming conflicts
            docker rm -f ${NGINX_CONTAINER} 2>/dev/null || true
            docker-compose --profile ${COMPOSE_PROFILE} up -d ${NGINX_SERVICE}
          else
            echo "Nginx container already running, skipping restart"
          fi
        """

        echo '✅ Target container deployment completed successfully'
      } catch (Exception err) {
        echo "❌ Error deploying target container: ${err}"
        error 'Target container deployment failed for DEV'
      }
    }
  }

  // Database Migration
  stage('DEV Migration') {
        def targetService = env.DEV_TARGET_SERVICE

        echo "🗃️ Executing database migrations on: ${targetService}"

        try {
      sh """
        # Wait for container to be ready
        sleep 10

        # Run migrations
        docker-compose exec -T ${targetService} npx sequelize-cli db:migrate
      """

      echo '✅ Database migrations completed successfully'
    } catch (Exception err) {
      echo "❌ Database migration failed: ${err}"
      error 'Database migration failure for DEV. Stopping deployment.'
        }
  }

  // Switch NGINX Traffic
  stage('Switch DEV Traffic') {
        def activeService = env.DEV_ACTIVE_SERVICE
        def targetService = env.DEV_TARGET_SERVICE
        def isInitialDeployment = env.DEV_INITIAL_DEPLOYMENT == 'true'

        if (!isInitialDeployment) {
      echo "🔄 Switching traffic from ${activeService} to ${targetService}"

      // Wait for the target container to be fully ready before switching
      echo "⏳ Waiting for ${targetService} to be ready..."

      // First check if container is running
      sh """
        echo "🔍 Checking container status..."
        docker ps -a | grep ${targetService == 'app_blue' ? BLUE_CONTAINER : GREEN_CONTAINER} || true

        echo "📋 Container logs (last 50 lines):"
        docker logs --tail 50 ${targetService == 'app_blue' ? BLUE_CONTAINER : GREEN_CONTAINER} || echo "Failed to get logs"

        echo "🩺 Testing health endpoint directly (using wget since curl is not available):"
        docker exec ${targetService == 'app_blue' ? BLUE_CONTAINER : GREEN_CONTAINER} wget -O- -q --timeout=5 http://localhost:3000/health && echo "Health check passed!" || echo "Health check failed with exit code: \$?"

        echo "🔍 Checking available HTTP tools in container:"
        docker exec ${targetService == 'app_blue' ? BLUE_CONTAINER : GREEN_CONTAINER} sh -c "which curl || which wget || echo 'No HTTP tools found'"
      """

      sh """
        for i in \$(seq 1 30); do
          # Try the health check using wget (Alpine has wget by default)
          if docker exec ${targetService == 'app_blue' ? BLUE_CONTAINER : GREEN_CONTAINER} wget -q --spider --timeout=5 http://localhost:3000/health 2>/dev/null; then
            echo "✅ ${targetService} is ready"
            break
          fi

          # On specific iterations, show more debug info
          if [ \$i -eq 10 ] || [ \$i -eq 20 ]; then
            echo "🔍 Container still not ready, checking status..."
            docker ps -a | grep ${targetService == 'app_blue' ? BLUE_CONTAINER : GREEN_CONTAINER} || true
            echo "📋 Recent logs:"
            docker logs --tail 20 ${targetService == 'app_blue' ? BLUE_CONTAINER : GREEN_CONTAINER} 2>&1 || echo "Failed to get logs"
          fi

          if [ \$i -eq 30 ]; then
            echo "❌ ${targetService} failed to become ready after 5 minutes"
            echo "🔍 Final container status:"
            docker ps -a | grep ${targetService == 'app_blue' ? BLUE_CONTAINER : GREEN_CONTAINER} || true
            echo "📋 Final logs (last 100 lines):"
            docker logs --tail 100 ${targetService == 'app_blue' ? BLUE_CONTAINER : GREEN_CONTAINER} || echo "Failed to get logs"
            exit 1
          fi
          echo "⏳ Waiting for ${targetService} to be ready... (\$i/30)"
          sleep 10
        done
      """

      // For nginx config update, we need to use SSH since the config file is owned by root
      withCredentials([sshUserPrivateKey(credentialsId: 'vps_ssh_key', keyFileVariable: 'SSHKEY', usernameVariable: 'SSHUSER')]) {
        try {
          sh """
            # Update nginx configuration (on host path)
            # Use container names instead of service names for better DNS resolution
            echo "🔄 Updating nginx configuration from ${activeService} to ${targetService}..."

            # Map service names to container names for nginx config
            OLD_CONTAINER_NAME=\$([ "${activeService}" = "app_blue" ] && echo "acme_server-app_blue" || echo "acme_server-app_green")
            NEW_CONTAINER_NAME=\$([ "${targetService}" = "app_blue" ] && echo "acme_server-app_blue" || echo "acme_server-app_green")

            echo "  - Old container name: \$OLD_CONTAINER_NAME"
            echo "  - New container name: \$NEW_CONTAINER_NAME"

            ssh -o StrictHostKeyChecking=no -i \$SSHKEY \$SSHUSER@${DEV_SERVER} "sed -i 's/set \\\$upstream_host ${activeService}:3000;/set \\\$upstream_host ${targetService}:3000;/' ${NGINX_CONFIG_PATH}"

            # Verify the configuration change
            echo "🔍 Verifying nginx configuration change..."
            ssh -o StrictHostKeyChecking=no -i \$SSHKEY \$SSHUSER@${DEV_SERVER} "grep 'upstream_host' ${NGINX_CONFIG_PATH}"

            # Test nginx configuration before reloading
            echo "🔍 Testing nginx configuration syntax..."
            ssh -o StrictHostKeyChecking=no -i \$SSHKEY \$SSHUSER@${DEV_SERVER} "docker exec ${NGINX_CONTAINER} nginx -t"

            # Reload nginx configuration (zero downtime)
            echo "🔄 Reloading nginx configuration..."
            ssh -o StrictHostKeyChecking=no -i \$SSHKEY \$SSHUSER@${DEV_SERVER} "docker exec ${NGINX_CONTAINER} nginx -s reload"

            # Give nginx a moment to pick up the changes
            sleep 5
          """

          echo '✅ Traffic switch completed successfully'
        } catch (Exception err) {
          echo "❌ Error switching traffic: ${err}"
          error 'Traffic switch failed for DEV'
        }
      }
    } else {
      echo '🎯 Initial deployment - no traffic switch needed'
        }
  }

  // Health Check and Cleanup
  stage('DEV Health Check') {
        def targetService = env.DEV_TARGET_SERVICE
        def activeService = env.DEV_ACTIVE_SERVICE

        echo '🔍 Variable check at start of Health Check stage:'
        echo "  - DEV_ACTIVE_SERVICE (old container): ${activeService}"
        echo "  - DEV_TARGET_SERVICE (new container): ${targetService}"
        echo "🩺 Performing health check on ${targetService}"

        try {
      sh """
        # Wait for health check through nginx (test the actual traffic flow)
        for i in \$(seq 1 30); do
          # Test through the actual nginx proxy to verify traffic switching worked
          if curl -f http://${DEV_SERVER}/health > /dev/null 2>&1; then
            echo "✅ Health check passed - nginx is proxying traffic correctly"

            # Test a few more times to ensure stability
            echo "🔄 Running additional stability checks..."
            for j in \$(seq 1 3); do
              if curl -f http://${DEV_SERVER}/health > /dev/null 2>&1; then
                echo "✅ Stability check \$j/3 passed"
              else
                echo "❌ Stability check \$j/3 failed"
                exit 1
              fi
              sleep 2
            done
            echo "✅ All stability checks passed"
            break
          fi
          if [ \$i -eq 30 ]; then
            echo "❌ Health check failed after 5 minutes"
            echo "🔍 Debug info - testing direct container access:"
            docker exec ${targetService == 'app_blue' ? BLUE_CONTAINER : GREEN_CONTAINER} curl -f http://localhost:3000/health || echo "Direct container access failed"
            echo "🔍 Debug info - nginx config:"
            docker exec ${NGINX_CONTAINER} cat /etc/nginx/conf.d/default.conf | grep upstream_host || echo "Failed to get nginx config"
            exit 1
          fi
          echo "⏳ Waiting for application to be ready through nginx... (\$i/30)"
          sleep 10
        done
      """

      // Clean up old container after successful health check - Project-agnostic cleanup
      def oldActiveService = env.DEV_ACTIVE_SERVICE  // This is the OLD container that should be removed
      def newTargetService = env.DEV_TARGET_SERVICE  // This is the NEW container that should stay
      def isInitialDeployment = env.DEV_INITIAL_DEPLOYMENT == 'true'

      echo '🔍 Cleanup variables:'
      echo "  - Old Active Service (to remove): ${oldActiveService}"
      echo "  - New Target Service (to keep): ${newTargetService}"
      echo "  - Initial Deployment: ${isInitialDeployment}"

      if (!isInitialDeployment) {
        // oldActiveService is the OLD container that needs to be cleaned up
        echo "🧹 Cleaning up old container: ${oldActiveService} (project-agnostic)"

        sh """
          # Find any container whose name contains the old active service name
          # This works regardless of Docker Compose project name
          OLD_CONTAINER_ID=\$(docker ps -q --filter "name=${oldActiveService}" 2>/dev/null || echo "")

          if [ -n "\$OLD_CONTAINER_ID" ]; then
            echo "📍 Found old container: \$(docker ps --filter id=\$OLD_CONTAINER_ID --format '{{.Names}} ({{.Status}})')"
            echo "🧹 Stopping and removing old container..."
            sleep 10  # Allow connections to drain
            docker stop \$OLD_CONTAINER_ID || true
            docker rm \$OLD_CONTAINER_ID || true
            echo "✅ Old container cleanup completed"
          else
            echo "ℹ️ No old container found for service ${oldActiveService}"
          fi

          echo "🔍 Verifying cleanup - remaining app containers:"
          docker ps --filter "name=app_" --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}" || echo "No app containers found"
        """
      }

      echo '✅ DEV deployment completed successfully'
    } catch (Exception err) {
      echo "❌ Health check failed: ${err}"
      error 'Health check failed for DEV'
        }
  }
}

// Deploy to remote environment (PROD)
def deployToRemote(String environment, String serverIP) {
  echo "🌐 Running ${environment} deployment via SSH to ${serverIP}"

  // This function maintains the SSH approach for PROD deployments
  // Implementation would be similar to the original but with proper credential handling

  stage("Determine ${environment} State") {
        script {
      def sshCredId = "${environment}_SSH_KEY"
      echo "🔍 Attempting to use SSH credential with ID: '${sshCredId}'"

      try {
        withCredentials([sshUserPrivateKey(credentialsId: sshCredId, keyFileVariable: 'SSHKEY', usernameVariable: 'SSHUSER')]) {
          echo "✅ Successfully accessed credential '${sshCredId}'"
          echo "🔍 Determining current deployment state on ${environment}..."

          // SSH-based implementation for remote servers
          // def sshCmd = "ssh -o StrictHostKeyChecking=no -i \$SSHKEY \$SSHUSER@${serverIP} 'docker ps -q -f name=${GREEN_CONTAINER}' || echo ''"
          // def greenRunning = sh(returnStdout: true, script: sshCmd).trim()

        // ... rest of the SSH-based implementation
        }
      } catch (Exception err) {
        echo '❌ Failed to access credential or execute commands'
        echo "Error details: ${err.getMessage()}"
        error "Failed to determine current deployment state for ${environment}: ${err.getMessage()}"
      }
        }
  }

// Additional stages for remote deployment would follow...
}
