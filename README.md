# barhack

Validate your Buildkite `pipeline.yml` files with a web service.

Pipeline files can either be checked by schema validation, or by attempting to upload them during a running build.

## Usage

You can send your pipeline file to be validated against Buildkite's [JSON schema](https://github.com/buildkite/pipeline-schema).

```sh
curl "https://barhack.nchlswhttkr.com/lint" \
    -H "Content-Type: text/plain" \
    -d '
steps:
  - commands: echo "Hello World"
  - command: echo "https://youtu.be/O_d-Nc_roLY"
'
# {"status": "PASSED"}
```

Pipeline files can also be validated by uploading them during a running build. To see this in action, you can set up the server and Buildkite agent on your local machine.

Here's how it looks using my server! Access is restricted to authenticated requests only.

```sh
# Post the contents of your pipeline.yml file
curl "https://barhack.nchlswhttkr.com/lint-with-build" \
    -H "Authorization: Basic <your-auth-details>" \
    -H "Content-Type: text/plain" \
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

### Validating pipeline files against a schema

By default, a local server will only offer schema validation.

```sh
cd server
npm ci
npm start

curl "http://localhost:8080/lint" \
    -H "Content-Type: text/plain" \
    -d '
steps:
  - commands: echo "Hello World"
  - command: echo "https://youtu.be/O_d-Nc_roLY"
'
```

### Validating pipeline files with a running build

If you would like to also validate files within a live build, you can should set up a Buildkite agent on your machine to run under your user. Make sure the agent is [tagged appropriately](https://buildkite.com/docs/agent/v3/cli-start#setting-tags) (`barhack=true`).

Your local agent will also need an API token with permission to `write_builds`. You can provide it through the [environment hook](https://buildkite.com/docs/pipelines/secrets#storing-secrets-in-environment-hooks).

```sh
#!/bin/bash

# The `environment` hook will run before all other commands, and can be used
# to set up secrets, data, etc. Anything exported in hooks will be available
# to the build script.
#
# For example:
#
# export SECRET_VAR=token

set -eu

if [[ "$BUILDKITE_PIPELINE_SLUG" == "barhack" ]]; then
  export BARHACK_BUILDKITE_TOKEN="abc123"
fi
```

From the Buildkite dashboard, create a new pipeline with one step. This step will run the `lint-if-instructed.sh` script to validate a pipeline file, and targets agents with the `barhack=true` tag.

![Configuration in Buildkite, the command is "lint-if-instructed.sh" and the agent targeting rule is "barhack=true"](https://nchlswhttkr.com/blog/validating-buildkite-pipelines/pipeline-steps.png)

Finally, you can specify the necessary configuration for the server with a `server/.env` file.

```
BARHACK_BUILDKITE_TOKEN=abc123    # Your Buildkite API token
BARHACK_ORG=nchlswhttkr           # Your organisation name in Buildkite
BARHACK_PIPELINE=barhack          # The Buildkite pipeline to run linting jobs
```

Restart your server, and run a validation job.

```sh
curl "https://barhack.nchlswhttkr.com/lint-with-build" \
    -H "Content-Type: text/plain" \
    -d '
steps:
    - command: echo "Hello world!"
'
```

### Hosting your validation server

You can repeat this setup in your own servers. I opted to use a reverse proxy with Nginx (see [barhack.nchlswhttkr.com.nginx](./barhack.nchlswhttkr.com.nginx)), but you can choose your own approach.

If your server is going to be web-facing, you can specify its URL using the `BASE_URL` environment variable.

I recommend running your Buildkite agent and server as systemd unit under a single user, since both need shared access to local files. If you don't target your agent correctly, jobs might run on an agent that does not have access to pipeline file it's meant to validate.

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
