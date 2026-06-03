pipeline {
    agent any

    stages {
        stage('Test') {
            steps {
                // Inject RSA key files stored as Jenkins secret-file credentials.
                // auth.ts reads private.pem / public.pem from the working directory.
                withCredentials([
                    file(credentialsId: 'backend-private-key', variable: 'PRIVATE_KEY_FILE'),
                    file(credentialsId: 'backend-public-key',  variable: 'PUBLIC_KEY_FILE'),
                ]) {
                    sh '''
                        cp "$PRIVATE_KEY_FILE" private.pem
                        cp "$PUBLIC_KEY_FILE"  public.pem

                        docker run --rm \
                            -v "${WORKSPACE}:/app" \
                            -v "${JENKINS_HOME}/.npm:/root/.npm" \
                            -w /app \
                            node:22-alpine \
                            sh -c "npm ci && npm test"
                    '''
                }
            }

            post {
                always {
                    // Never leave key material in the workspace.
                    sh 'rm -f private.pem public.pem'
                }
            }
        }
    }
}
