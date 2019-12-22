#!/bin/bash

# Lints a given file by calling the Buildkite API, and dooming this job to be
# either failed or canceled.

# Arguments are provided through environment variables, which should be
# specified in the API call to trigger this job.
#   $BARHACK_LINT               - 'true' if this job should try to lint
#   $BARHACK_PIPELINE_FILE      - filepath of the pipeline to be linted
#   $BARHACK_CREDENTIALS_FILE   - a script that loads credentials

# The $BUILDHACK_CREDENTIALS_FILE should set a $BARHACK_TOKEN that can be used
# to make authenticated calls to the Buildkite API.

set -e

if [[ $BARHACK_LINT == 'true' ]]; then
    source $BARHACK_CREDENTIALS_FILE
    
    # Temporary check to make sure the access token is valid
    curl -H "Authorization: Bearer $BARHACK_TOKEN" https://api.buildkite.com/v2/access-token

    # Attempt to upload a pipeline file, invalid files will fail
    buildkite-agent pipeline upload $BARHACK_PIPELINE_TO_LINT
    echo "PASSED" > /home/barhack/builds/$BUILDKITE_BUILD_NUMBER.status
    curl \
        -H "Authorization: Bearer $BARHACK_TOKEN" \
        -X PUT "https://api.buildkite.com/v2/organizations/$BUILDKITE_ORGANIZATION_SLUG/pipelines/$BUILDKITE_PIPELINE_SLUG/builds/$BUILDKITE_BUILD_NUMBER/cancel"
fi
