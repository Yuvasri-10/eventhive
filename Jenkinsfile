
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
        DOCKER = 'C:\\Users\\yuvas\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm

                script {
                    def gitCommit = bat(
                        returnStdout: true,
                        script: '@git rev-parse --short HEAD'
                    ).trim()

                    env.IMAGE_TAG = "${env.BUILD_NUMBER}-${gitCommit}"
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
                    (env.GIT_BRANCH ?: env.BRANCH_NAME ?: '')
                        .replace('origin/', '') == 'main'
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

                        if ([string]::IsNullOrWhiteSpace($env:DH_USER) -or
                            [string]::IsNullOrEmpty($env:DH_PASS)) {
                            throw "Docker Hub credentials are empty."
                        }

                        $password = $env:DH_PASS.Trim()

                        # TEMPORARY DIAGNOSTIC: never print the token itself.
                        $sha = [Security.Cryptography.SHA256]::Create()
                        try {
                            $bytes = [Text.Encoding]::UTF8.GetBytes($password)
                            $hash = [BitConverter]::ToString(
                                $sha.ComputeHash($bytes)
                            ).Replace('-', '')

                            Write-Output "Docker Hub username: $($env:DH_USER)"
                            Write-Output "Token length: $($password.Length)"
                            Write-Output "Token fingerprint: $hash"
                        }
                        finally {
                            $sha.Dispose()
                        }

                        $psi = New-Object System.Diagnostics.ProcessStartInfo
                        $psi.FileName = $env:DOCKER
                        $psi.Arguments = "login --username `"$env:DH_USER`" --password-stdin"
                        $psi.UseShellExecute = $false
                        $psi.CreateNoWindow = $true
                        $psi.RedirectStandardInput = $true
                        $psi.RedirectStandardOutput = $true
                        $psi.RedirectStandardError = $true

                        $proc = New-Object System.Diagnostics.Process
                        $proc.StartInfo = $psi
                        [void]$proc.Start()

                        $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
                        $stderrTask = $proc.StandardError.ReadToEndAsync()

                        $proc.StandardInput.WriteLine($password)
                        $proc.StandardInput.Close()
                        $proc.WaitForExit()

                        $stdout = $stdoutTask.Result
                        $stderr = $stderrTask.Result

                        if ($stdout) {
                            Write-Output $stdout
                        }

                        if ($stderr) {
                            Write-Output $stderr
                        }

                        if ($proc.ExitCode -ne 0) {
                            throw "Docker Hub login failed. Check the credential fingerprint and Docker Hub token."
                        }

                        Write-Output "Docker Hub login succeeded."

                        & $env:DOCKER push "$env:IMAGE_NAME`:$env:IMAGE_TAG"
                        if ($LASTEXITCODE -ne 0) {
                            throw "Failed to push the build-tagged image."
                        }

                        & $env:DOCKER push "$env:IMAGE_NAME`:latest"
                        if ($LASTEXITCODE -ne 0) {
                            throw "Failed to push the latest image."
                        }
                    '''
                }
            }
        }

        stage('Deploy with Ansible') {
            when {
                allOf {
                    expression {
                        (env.GIT_BRANCH ?: env.BRANCH_NAME ?: '')
                            .replace('origin/', '') == 'main'
                    }

                    expression {
                        !params.SKIP_DEPLOY
                    }
                }
            }

            steps {
                echo 'Ansible deployment is not configured for this Windows Jenkins controller.'
                error('Deployment requires a configured Linux or WSL agent.')
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
            echo 'Pipeline failed. Check the stage logs above for the exact error.'
        }
    }
}
