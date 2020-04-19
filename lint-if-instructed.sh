#!/bin/bash

# Lints a given file by calling the Buildkite API, and dooming this job to be
# either failed or canceled.

# Arguments are provided through environment variables, which should be
# specified in the API call to trigger this job.
#   $BARHACK_LINT_ID - An ID that tells where to read/write files for this job

# A $BARHACK_BUILDKITE_TOKEN should be set with an 'environment' hook before
# this job runs, which should have the 'write_builds' scope.
# https://buildkite.com/docs/pipelines/secrets#storing-secrets-in-environment-hooks

set -e

if [ -n "$BARHACK_LINT_ID" ]; then
    # Attempt to upload a pipeline file, invalid files will fail
    buildkite-agent pipeline upload $BARHACK_FILE_ROOT/$BARHACK_LINT_ID/pipeline.yml
    printf PASSED > $BARHACK_FILE_ROOT/$BARHACK_LINT_ID/status.txt

    curl --fail -X PUT "https://api.buildkite.com/v2/organizations/$BUILDKITE_ORGANIZATION_SLUG/pipelines/$BUILDKITE_PIPELINE_SLUG/builds/$BUILDKITE_BUILD_NUMBER/cancel" \
        -H "Authorization: Bearer $BARHACK_BUILDKITE_TOKEN"
fi
