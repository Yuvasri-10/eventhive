pipeline {
    agent any

    environment {
        DOCKER = 'C:\\Users\\yuvas\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe'
        DOCKER_HOST = 'npipe:////./pipe/dockerDesktopLinuxEngine'
        DOCKER_CONFIG = 'C:\\Users\\yuvas\\.docker'
        IMAGE_NAME = 'yuvana10/eventhive'
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main',
                    url: 'https://github.com/Yuvasri-10/eventhive.git'
            }
        }

        stage('Install Dependencies') {
            steps {
                bat 'npm install'
            }
        }

        stage('Test Application') {
            steps {
                bat 'node --check server.js'
            }
        }

        stage('Build Docker Image') {
            steps {
                bat '''
                    "%DOCKER%" --host "%DOCKER_HOST%" build -t "%IMAGE_NAME%:latest" .
                '''
            }
        }

        stage('Login and Push to Docker Hub') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-creds-new',
                    usernameVariable: 'DH_USER',
                    passwordVariable: 'DH_PASS'
                )]) {
                    powershell '''
                        $ErrorActionPreference = 'Stop'

                        $docker = $env:DOCKER
                        $hostArg = $env:DOCKER_HOST
                        $image = $env:IMAGE_NAME

                        $psi = New-Object System.Diagnostics.ProcessStartInfo
                        $psi.FileName = $docker
                        $psi.Arguments = '--host "' + $hostArg +
                            '" login --username "' + $env:DH_USER +
                            '" --password-stdin'
                        $psi.UseShellExecute = $false
                        $psi.RedirectStandardInput = $true
                        $psi.RedirectStandardOutput = $true
                        $psi.RedirectStandardError = $true
                        $psi.CreateNoWindow = $true

                        $p = New-Object System.Diagnostics.Process
                        $p.StartInfo = $psi
                        [void]$p.Start()

                        $p.StandardInput.WriteLine($env:DH_PASS)
                        $p.StandardInput.Close()

                        $outTask = $p.StandardOutput.ReadToEndAsync()
                        $errTask = $p.StandardError.ReadToEndAsync()
                        $p.WaitForExit()

                        $out = $outTask.Result
                        $err = $errTask.Result

                        if ($out) { Write-Output $out.Trim() }
                        if ($err) { Write-Output $err.Trim() }

                        if ($p.ExitCode -ne 0) {
                            throw 'Docker Hub login failed. Push was not attempted.'
                        }

                        $p.Dispose()

                        & $docker --host $hostArg push "${image}:latest"

                        if ($LASTEXITCODE -ne 0) {
                            throw 'Docker image push failed.'
                        }

                        Write-Output 'SUCCESS: Docker image pushed to Docker Hub.'
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'EventHive pipeline completed successfully.'
        }
        failure {
            echo 'Pipeline failed. Check the first failing stage in Console Output.'
        }
    }
}