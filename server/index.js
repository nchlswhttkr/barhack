const Hapi = require("@hapi/hapi");
const { FileSystem } = require("@microsoft/node-core-library");
const uuidv4 = require("uuid/v4");
const fetch = require("node-fetch");
const yaml = require("js-yaml");
const Boom = require("@hapi/boom");

require("dotenv").config();
const FILE_ROOT = `${process.cwd()}/files`;
const PORT = process.env.PORT || 8080;

const Ajv = require("ajv");
const ajv = new Ajv({ allErrors: true });
ajv.addMetaSchema(require("ajv/lib/refs/json-schema-draft-06.json"));
const validate = ajv.compile(require("./pipeline-schema/schema.json"));

const server = Hapi.server({
  port: PORT,
  host: "127.0.0.1",
});
const BASE_URL = process.env.BASE_URL || server.info.uri;

/**
 * Intended to be a "fast lint" option that satisfies Buildkite's JSON schema.
 * See https://github.com/buildkite/pipeline-schema
 */
server.route({
  method: "POST",
  path: "/lint",
  handler: async (request, h) => {
    let parsedYamlToJson;
    try {
      parsedYamlToJson = yaml.safeLoad(request.payload);
    } catch (_) {
      return Boom.badRequest("Could not parse YAML");
    }
    const valid = validate(parsedYamlToJson);

    let response = { status: valid ? "PASSED" : "FAILED" };
    if (!valid) {
      response.errors = validate.errors;
      response.pipeline = parsedYamlToJson;
    }

    return response;
  },
});

/**
 * Intended to be an extended check, that actually attempts to run the pipeline
 * by uploading it within a build.
 *
 * Will not be added if the required environment variables are not set.
 */
const CAN_RUN_BUILDKITE_BUILDS =
  process.env.BUILDKITE_TOKEN &&
  process.env.BUILDKITE_ORG &&
  process.env.BUILDKITE_PIPELINE;
if (CAN_RUN_BUILDKITE_BUILDS) {
  server.route({
    method: "POST",
    path: "/lint-with-build",
    handler: async (request, h) => {
      // Save the given file, might conflict or not work concurrently but oh well
      const id = uuidv4();
      FileSystem.ensureFolder(`${FILE_ROOT}/${id}`);
      FileSystem.writeFile(`${FILE_ROOT}/${id}/pipeline.yml`, request.payload);
      FileSystem.writeFile(`${FILE_ROOT}/${id}/status.txt`, "PENDING");

      // Trigger a pipeline to lint it
      const response = await fetch(
        `https://api.buildkite.com/v2/organizations/${process.env.BUILDKITE_ORG}/pipelines/${process.env.BUILDKITE_PIPELINE}/builds`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.BUILDKITE_TOKEN}`,
          },
          body: JSON.stringify({
            commit: "HEAD",
            branch: "refactor", // TODO change back to master
            env: {
              BARHACK_LINT_ID: id,
              BARHACK_FILE_ROOT: id,
            },
          }),
        }
      );

      if (!response.ok) {
        FileSystem.deleteFile(`${FILE_ROOT}/${id}/status.txt`);
        throw Boom.internal(`Received ${response.status} from Buildkite API`);
      }

      return h
        .response({
          id,
          status_url: `${BASE_URL}/lint-with-build/${id}`,
        })
        .code(201);
    },
  });
} else {
  console.warn("Skipping /lint-with-build, no Buildkite config provided");
}

server.route({
  method: "GET",
  path: "/lint-with-build/{id}",
  handler: async (request, h) => {
    if (!FileSystem.exists(`${FILE_ROOT}/${request.params.id}/status.txt`)) {
      throw Boom.notFound();
    }

    const status = FileSystem.readFile(
      `${FILE_ROOT}/${request.params.id}/status.txt`
    );
    return { status };
  },
});

server.route({
  method: "GET",
  path: "/robots.txt",
  handler: (request, h) => {
    return h
      .response(
        `
User-agent: *
Disallow: /`
      )
      .type("text/plain");
  },
});

server.route({
  method: "*",
  path: "/{any*}",
  handler: (request, h) => {
    return h.redirect("https://github.com/nchlswhttkr/barhack/");
  },
});

async function start() {
  await server.start();
  console.log(`Server running on ${BASE_URL}`);
}

async function stop() {
  console.log("Stopping stopping...");
  await server.stop();
}

start();

process.on("unhandledRejection", (e) => {
  console.error(e);
  process.exit(1);
});

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
