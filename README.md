# barhack

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
