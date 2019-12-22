# barhack

Cobbling a little thing together during my Sunday bar shift.

## Linting a Buildkite `pipeline.yml` file

**Option 1** - Parser by some grammar/syntax validator

Can probably draw on prior art from tools like eslint, but relies on me having to maintain the tool (and to keep parity with Buildkite developments).

**Option 2** - Run as a pipeline, actually upload via the Buildkite API

Create a build and upload the given `pipeline.yml` file as a job. If it succeeds, stop the build and give a successful response to the end user. Otherwise the job (and subsequently the build) will fail, then return a bad response to the end user.

Negates the need to keep parity with Buildkite, their service handles validation.

There might be some concerns with handling and presenting a response from their API, but I'm putting that aside for now because only I'll be seeing this.

* [x] Can cancel a build if the pipeline upload command succeeds (`pipeline.yml` passed linting)
* [x] Build fails if the `pipeline.yml` does not uploda (invalid file)
* [] Can view the status of a pipeline file as it is checked