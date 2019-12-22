#!/bin/sh

set -e

if [[ `head -n 1 /home/barhack/builds/$BUILDKITE_BUILD_NUMBER.status` == 'PENDING' ]]; then
    echo 'FAILED' > /home/barhack/builds/$BUILDKITE_BUILD_NUMBER.status
fi
