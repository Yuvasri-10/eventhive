
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
      defaultValue: true,
      description: 'Skip Ansible deployment on the Windows Jenkins controller'
    )
  }

  environment {
    IMAGE_NAME = 'yuvana10/eventhive'
    ANSIBLE_FORCE_COLOR = 'true'
    DOCKER = 'C:\\Users\\yuvas\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe'
}

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.IMAGE_TAG = "${env.BUILD_NUMBER}-${bat(returnStdout: true, script: '@git rev-parse --short HEAD').trim()}"
        }
        echo "Building ${env.IMAGE_NAME}:${env.IMAGE_TAG}"
      }
    }

    stage('Install and Test') {
      steps {
        bat 'node --version'
        bat 'npm --version'
        bat 'npm install'
        bat 'npm test'
      }
    }

    stage('Build Docker Image') {
    steps {
        bat '"%DOCKER%" build -t %IMAGE_NAME%:%IMAGE_TAG% -t %IMAGE_NAME%:latest .'
    }
}

    stage('Push to Docker Hub') {
      when {
        expression {
          (env.GIT_BRANCH ?: env.BRANCH_NAME ?: '').replace('origin/', '') == 'main'
        }
      }
      steps {
        withCredentials([
          usernamePassword(
            credentialsId: 'dockerhub-creds',
            usernameVariable: 'DH_USER',
            passwordVariable: 'DH_PASS'
          )
        ]) {
          powershell '''
    $ErrorActionPreference = 'Stop'
    $docker = $env:DOCKER

    $env:DH_PASS | & $docker login --username $env:DH_USER --password-stdin
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    & $docker push "$env:IMAGE_NAME`:$env:IMAGE_TAG"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    & $docker push "$env:IMAGE_NAME`:latest"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
          '''
        }
      }
    }

    stage('Deploy with Ansible') {
      when {
        allOf {
          expression {
            (env.GIT_BRANCH ?: env.BRANCH_NAME ?: '').replace('origin/', '') == 'main'
          }
          expression { !params.SKIP_DEPLOY }
        }
      }
      steps {
        echo 'Ansible deployment requires a configured Linux agent or WSL environment. Configure that environment before enabling this stage.'
        error('Deployment not configured for the Windows Jenkins controller.')
      }
    }
  }

  post {
    always {
      bat '"%DOCKER%" logout || exit /b 0'
    }
    success {
      echo "Pipeline completed for ${env.IMAGE_NAME}:${env.IMAGE_TAG}"
    }
    failure {
      echo 'Pipeline failed - check the stage logs.'
    }
  }
}
