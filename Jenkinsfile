pipeline {
  agent any
  options {
    timestamps()
    disableConcurrentBuilds()
  }
  environment {
    IMAGE_NAME = 'eventhive'
  }
  stages {
    stage('Checkout') {
      steps { checkout scm }
    }
    stage('Install and test') {
      steps {
        sh 'node --version'
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
      when { expression { env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' || env.GIT_BRANCH == 'main' } }
      steps {
        withCredentials([
          usernamePassword(credentialsId: 'dockerhub-credentials',
            usernameVariable: 'DOCKERHUB_USERNAME', passwordVariable: 'DOCKERHUB_TOKEN'),
          sshUserPrivateKey(credentialsId: 'eventhive-deploy-ssh',
            keyFileVariable: 'DEPLOY_KEY', usernameVariable: 'DEPLOY_USER'),
          string(credentialsId: 'eventhive-jwt-secret', variable: 'EVENTHIVE_JWT_SECRET')
        ]) {
          sh '''
            test -n "$DEPLOY_HOST" || (echo "Set DEPLOY_HOST in Jenkins environment" && exit 1)
            ansible-playbook -i "$DEPLOY_HOST," ansible/deploy.yml \\
              --user "$DEPLOY_USER" --private-key "$DEPLOY_KEY" \\
              -e "dockerhub_username=$DOCKERHUB_USERNAME image_tag=$BUILD_NUMBER"
          '''
        }
      }
    }
  }
  post {
    always { sh 'docker image rm eventhive:${BUILD_NUMBER} 2>/dev/null || true' }
  }
}
