const Hapi = require("@hapi/hapi");
const { FileSystem } = require("@microsoft/node-core-library");
const uuidv4 = require("uuid/v4");
const fetch = require("node-fetch");
const yaml = require("js-yaml");
const Boom = require("@hapi/boom");

require("dotenv").config(); // sets all the BARHACK_XXX variables, see README
const FILE_ROOT = process.env.BARHACK_FILE_ROOT;

const Ajv = require("ajv");
const ajv = new Ajv({ allErrors: true });
ajv.addMetaSchema(require("ajv/lib/refs/json-schema-draft-06.json"));
const validate = ajv.compile(require("./pipeline-schema/schema.json"));

const PORT = process.env.PORT;
if (!PORT) {
  throw new Error("PORT not defined");
}

const server = Hapi.server({
  port: PORT,
  host: "127.0.0.1"
});

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
  }
});

/**
 * Intended to be an extended check, that actually attempts to run the pipeline
 * by uploading it within a build.
 */
server.route({
  method: "POST",
  path: "/lint-with-build",
  handler: async (request, h) => {
    // Save the given file, might conflict or not work concurrently but oh well
    const id = uuidv4();
    FileSystem.ensureFolder(`${FILE_ROOT}/${id}`);
    FileSystem.writeFile(`${FILE_ROOT}/${id}/pipeline.yml`, request.payload);
    FileSystem.changePosixModeBits(`${FILE_ROOT}/${id}/pipeline.yml`, "666");
    FileSystem.writeFile(`${FILE_ROOT}/${id}/status.txt`, "PENDING");
    FileSystem.changePosixModeBits(`${FILE_ROOT}/${id}/status.txt`, "666");

    // Trigger a pipeline to lint it
    const response = await fetch(
      `https://api.buildkite.com/v2/organizations/${process.env.BARHACK_ORG}/pipelines/${process.env.BARHACK_PIPELINE}/builds`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.BARHACK_BUILDKITE_TOKEN}`
        },
        body: JSON.stringify({
          commit: "HEAD",
          branch: "lint",
          env: {
            BARHACK_LINT_ID: id
          }
        })
      }
    );

    if (!response.ok) {
      FileSystem.deleteFile(`${FILE_ROOT}/${id}/status.txt`);
      throw Boom.internal(`Received ${response.status} from Buildkite API`);
    }

    return h
      .response({
        id,
        status_url: `${process.env.BASE_URL}/lint-with-build/${id}`
      })
      .code(201);
  }
});

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
  }
});

async function start() {
  await server.start();
  console.log(`Server running on ${server.info.uri}`);
}

async function stop() {
  console.log("Stopping stopping...");
  await server.stop();
}

start();

process.on("unhandledRejection", e => {
  console.error(e);
  process.exit(1);
});

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
