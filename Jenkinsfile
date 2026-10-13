
Jenkinsfile
pipeline {
  agent any
  options {
    timestamps()
    disableConcurrentBuilds()
  }
  environment {
    IMAGE_NAME = 'eventhive'
    ANSIBLE_HOST_KEY_CHECKING = 'False'   // first SSH connection to the server won't prompt/hang
    ANSIBLE_FORCE_COLOR = 'true'
  }
  stages {
    stage('Checkout') {
      steps { checkout scm }
    }
    stage('Install and test') {
      steps {
        sh 'node --version && docker --version && ansible-playbook --version | head -1'
        sh 'npm install'
        sh 'npm test'
      }
    }
    stage('Build Docker image') {
      steps {
        sh 'docker build -t ${IMAGE_NAME}:${BUILD_NUMBER} .'
      }
    }
    stage('Login and push to Docker Hub') {
      when { expression { env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' || env.GIT_BRANCH == 'main' } }
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-credentials',
          usernameVariable: 'DOCKERHUB_USERNAME', passwordVariable: 'DOCKERHUB_TOKEN')]) {
          sh '''
            echo "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USERNAME" --password-stdin
            docker tag eventhive:${BUILD_NUMBER} "$DOCKERHUB_USERNAME/eventhive:${BUILD_NUMBER}"
            docker tag eventhive:${BUILD_NUMBER} "$DOCKERHUB_USERNAME/eventhive:latest"
            docker push "$DOCKERHUB_USERNAME/eventhive:${BUILD_NUMBER}"
            docker push "$DOCKERHUB_USERNAME/eventhive:latest"
            docker logout
          '''
        }
      }
    }
    stage('Deploy with Ansible') {
      // Skipped automatically until DEPLOY_HOST is set in Jenkins (and the SSH credential exists)
      when { expression { (env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' || env.GIT_BRANCH == 'main') && env.DEPLOY_HOST?.trim() } }
      steps {
        withCredentials([
          usernamePassword(credentialsId: 'dockerhub-credentials',
            usernameVariable: 'DOCKERHUB_USERNAME', passwordVariable: 'DOCKERHUB_TOKEN'),
          sshUserPrivateKey(credentialsId: 'eventhive-deploy-ssh',
            keyFileVariable: 'DEPLOY_KEY', usernameVariable: 'DEPLOY_USER'),
          string(credentialsId: 'eventhive-jwt-secret', variable: 'EVENTHIVE_JWT_SECRET')
        ]) {
          sh '''
            test -n "$DEPLOY_HOST" || (echo "Set DEPLOY_HOST: Manage Jenkins > System > Global properties > Environment variables" && exit 1)
            ansible-playbook -i "$DEPLOY_HOST," ansible/deploy.yml \\
              --user "$DEPLOY_USER" --private-key "$DEPLOY_KEY" \\
              -e "dockerhub_username=$DOCKERHUB_USERNAME image_tag=$BUILD_NUMBER"
          '''
        }
      }
    }
  }
  post {
    success { echo env.DEPLOY_HOST?.trim() ? "Deployed build ${BUILD_NUMBER}. Check http://${env.DEPLOY_HOST}:3000/health" : "Pushed build ${BUILD_NUMBER} to Docker Hub (deploy skipped: DEPLOY_HOST not set)." }
    always  { sh 'docker image rm eventhive:${BUILD_NUMBER} 2>/dev/null || true' }
  }
}
 
Claude finished the response
