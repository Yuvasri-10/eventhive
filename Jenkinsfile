pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '10'))
  }

  triggers {
    githubPush()
  }

  parameters {
    choice(
      name: 'DEPLOY_ENV',
      choices: ['production', 'local'],
      description: 'Environment for Ansible deployment'
    )
    booleanParam(
      name: 'SKIP_DEPLOY',
      defaultValue: false,
      description: 'Build and push only; skip deployment'
    )
  }

  environment {
    IMAGE_NAME = 'yuvana10/eventhive'
    ANSIBLE_FORCE_COLOR = 'true'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.IMAGE_TAG = "${env.BUILD_NUMBER}-${sh(returnStdout: true, script: 'git rev-parse --short HEAD').trim()}"
        }
        echo "Building ${env.IMAGE_NAME}:${env.IMAGE_TAG}"
      }
    }

    stage('Install and Test') {
      steps {
        sh 'node --version'
        sh 'npm --version'
        sh 'npm install'
        sh 'npm test'
      }
    }

    stage('Build Docker Image') {
      steps {
        sh 'docker build -t $IMAGE_NAME:$IMAGE_TAG -t $IMAGE_NAME:latest .'
      }
    }

    stage('Push to Docker Hub') {
      when {
        expression { env.GIT_BRANCH ==~ /(origin\/)?main/ }
      }
      steps {
        withCredentials([
          usernamePassword(
            credentialsId: 'dockerhub-creds',
            usernameVariable: 'DH_USER',
            passwordVariable: 'DH_PASS'
          )
        ]) {
          sh '''
            echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin
            docker push "$IMAGE_NAME:$IMAGE_TAG"
            docker push "$IMAGE_NAME:latest"
          '''
        }
      }
    }

    stage('Deploy with Ansible') {
      when {
        allOf {
          expression { env.GIT_BRANCH ==~ /(origin\/)?main/ }
          expression { !params.SKIP_DEPLOY }
        }
      }
      steps {
        dir('ansible') {
          withCredentials([
            string(
              credentialsId: 'eventhive-jwt-secret',
              variable: 'JWT_SECRET'
            )
          ]) {
            script {
              if (params.DEPLOY_ENV == 'production') {
                sshagent(credentials: ['ansible-ssh-key']) {
                  sh '''
                    ansible-playbook -i inventory/production.ini playbook.yml \
                      -e "jwt_secret=$JWT_SECRET"
                  '''
                }
              } else {
                sh '''
                  ansible-playbook -i inventory/local.ini playbook.yml \
                    -e "jwt_secret=$JWT_SECRET"
                '''
              }
            }
          }
        }
      }
    }
  }

  post {
    always {
      sh 'docker logout || true'
    }
    success {
      echo "Pipeline completed for ${env.IMAGE_NAME}:${env.IMAGE_TAG}"
    }
    failure {
      echo 'Pipeline failed - check the stage logs.'
    }
  }
}