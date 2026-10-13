pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '10'))
  }

  // Fires when the GitHub webhook hits http://<jenkins>:8080/github-webhook/
  triggers { githubPush() }

  parameters {
    choice(name: 'DEPLOY_ENV', choices: ['production', 'local'],
           description: 'Ansible inventory to deploy to')
    booleanParam(name: 'SKIP_DEPLOY', defaultValue: false,
                 description: 'Build and push only, do not deploy')
  }

  environment {
    // >>> CHANGE THIS to your Docker Hub username <<<
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

    stage('Install & Test') {
      steps {
        sh 'node --version && npm --version'
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
      when { expression { env.GIT_BRANCH ==~ /(origin\/)?main/ } }
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds',
                                          usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
          sh '''
            echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin
            docker push $IMAGE_NAME:$IMAGE_TAG
            docker push $IMAGE_NAME:latest
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
          withCredentials([string(credentialsId: 'eventhive-jwt-secret', variable: 'JWT_SECRET')]) {
            script {
              if (params.DEPLOY_ENV == 'production') {
                // SSH key used to reach the production server
                sshagent(credentials: ['ansible-ssh-key']) {
                  sh 'ansible-playbook -i inventory/production.ini playbook.yml'
                }
              } else {
                sh 'ansible-playbook -i inventory/local.ini playbook.yml'
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
      sh 'docker image prune -f || true'
    }
    success { echo "Deployed ${env.IMAGE_NAME}:${env.IMAGE_TAG}" }
    failure { echo 'Pipeline failed - check the stage logs above.' }
  }
}
