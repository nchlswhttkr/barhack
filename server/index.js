const Hapi = require("@hapi/hapi");
const { FileSystem } = require("@microsoft/node-core-library");
const uuidv4 = require("uuid/v4");
const fetch = require("node-fetch");

require("dotenv").config();

const PORT = process.env.PORT;
if (!PORT) {
  throw new Error("PORT not defined");
}

const FILE_ROOT = "/home/barhack/files";

const server = Hapi.server({
  port: PORT,
  host: "127.0.0.1"
});

server.route({
  method: "POST",
  path: "/lint",
  handler: async (request, h) => {
    // Save the given file, might conflict or not work concurrently but oh well
    const id = uuidv4();
    FileSystem.ensureFolder(`${FILE_ROOT}/${id}`);
    FileSystem.writeFile(`${FILE_ROOT}/${id}/pipeline.yml`, request.payload);
    FileSystem.changePosixModeBits(`${FILE_ROOT}/${id}/pipeline.yml`, "666");
    FileSystem.writeFile(`${FILE_ROOT}/${id}/status.txt`, "PENDING");
    FileSystem.changePosixModeBits(`${FILE_ROOT}/${id}/status.txt`, "666");

    // Trigger a pipeline to lint it
    await fetch(
      `https://api.buildkite.com/v2/organizations/${process.env.BARHACK_ORG}/pipelines/${process.env.BARHACK_PIPELINE}/builds`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.BARHACK_BUILDKITE_TOKEN}`
        },
        body: JSON.stringify({
          commit: "HEAD",
          branch: "master",
          env: {
            BARHACK_LINT_ID: id
          }
        })
      }
    );

    return h
      .response({
        id,
        status_url: `https://barhack.nchlswhttkr.com/lint/${id}`
      })
      .code(201);
  }
});

server.route({
  method: "GET",
  path: "/lint/{id}",
  handler: async (request, h) => {
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
