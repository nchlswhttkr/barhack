# barhack

Validate your Buildkite `pipeline.yml` files with a web service.

Pipeline files can either be checked by schema validation, or by attempting to upload them during a running build.

## Usage

You can send your pipeline file to be validated against Buildkite's [JSON schema](https://github.com/buildkite/pipeline-schema).

> :exclamation: Be careful not to use tab characters if you're using a request editor like Postman.

```sh
curl -H "Content-Type: text/plain" -X POST "https://barhack.nchlswhttkr.com/lint" \
    -d '
steps:
  - commands: echo "Hello World"
  - command: echo "https://youtu.be/O_d-Nc_roLY"
'
# {"status": "PASSED"}
```

A more confident way to check is to have an agent attempt to upload the pipeline file while running a build. Authentication is required at the moment.

```sh
# Post the contents of your pipeline.yml file
curl -H "Authorization: Basic <your-auth-details>" \
    -H "Content-Type: text/plain" \
    -X POST "https://barhack.nchlswhttkr.com/lint-with-build" \
    -d '
steps:
    - command: echo "Hello world!"
'
# {"id": "<job-id>", "status_url": "https://barhack.nchlswhttkr.com/lint-with-build/<job-id>"}

# Initially, the linting job will be pending
curl -H "Authorization: Basic <your-auth-details>" "https://barhack.nchlswhttkr.com/lint-with-build/<job-id>"
# {"status": "PENDING"}

# Later, it will be either passed or failed
curl -H "Authorization: Basic <your-auth-details>" "https://barhack.nchlswhttkr.com/lint-with-build/<job-id>"
# {"status": "PASSED"}
```

## Setup

The hapi server requires some configuration to be set by an `.env` file.

```
BARHACK_BUILDKITE_TOKEN=abc123 # Your Buildkite API token
BARHACK_ORG=nchlswhttkr
BARHACK_PIPELINE=barhack
BARHACK_FILE_ROOT=/home/barhack/files
BASE_URL=https://barhack.nchlswhttkr.com
```

### Extension: Validate using a live build

> :exclamation: You only need to do the below steps if you want to validate your files using a live build rather than just JSON validation.

You need to make the Buildkite token available for the agent that will run your validation jobs using the [environment hook](https://buildkite.com/docs/pipelines/secrets#storing-secrets-in-environment-hooks).

```sh
#!/bin/bash

# The `environment` hook will run before all other commands, and can be used
# to set up secrets, data, etc. Anything exported in hooks will be available
# to the build script.
#
# For example:
#
# export SECRET_VAR=token

set -euo pipefail

if [[ "$BUILDKITE_PIPELINE_SLUG" == "barhack" ]]; then
  export BARHACK_BUILDKITE_TOKEN="abc123"
fi
```

Make sure your agent is tagged appropriately so you can target it, and then supply the command step to validate files.

![Configuration in Buildkite, the command is "lint-if-instructed.sh" and the agent targeting rule is "barhack=true"](https://nchlswhttkr.com/blog/validating-buildkite-pipelines/pipeline-steps.png)

---

## DRAFTING NOTES

Cobbling a little thing together during my Sunday bar shift.

## Linting a Buildkite `pipeline.yml` file

From what I understand, it's not possible to lint a `pipeline.yml` file for Buildkite without actually running a build. I'm trying to make a service which does this. It should hopefully be somewhat like the [CI lint](https://gitlab.com/ci/lint) capability that GitLab provides.

**Option 1** - Parser by some grammar/syntax validator

Can probably draw on prior art from tools like eslint, but relies on me having to maintain the tool (and to keep parity with Buildkite developments).

**Option 2** - Run as a pipeline, actually upload via the Buildkite API

Create a build and upload the given `pipeline.yml` file as a job. If it succeeds, stop the build and give a successful response to the end user. Otherwise the job (and subsequently the build) will fail, then return a bad response to the end user.

Negates the need to keep parity with Buildkite, their service handles validation.

Technically this is still running a build, but that isn't the concern of a user.

There might be some concerns with handling and presenting a response from their API, but I'm putting that aside for now because only I'll be seeing this.

- [x] Can cancel a build if the pipeline upload command succeeds (`pipeline.yml` passed linting)
- [x] Build fails if the `pipeline.yml` does not uploda (invalid file)
- [x] Can view the status of a pipeline file as it is checked via the web \* \* Passing files briefly show failed because the `post-command` hook runs on all jobs, even the first job to setup the pipeline for linting. Can be fixed by going from hooks to a single script that sets the appropriate status when running the linting.
- [ ] Can upload/provide a `pipeline.yml` file, returning an ID that corresponds to a linting check. This is somewhat like an end user might expect.

You can check that status of build that linted a file at https://barhack.nchlswhttkr.com/builds/10.status, but for now this isn't too useful since only I can see which build number corresponds to which commit which corresponds to a given `pipeline-to-lint.yml`.
