import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { get } from "node:https";

const url =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";
const target = resolve("public/models/face_landmarker.task");

mkdirSync(dirname(target), { recursive: true });

await new Promise((resolveRequest, rejectRequest) => {
  get(url, async (response) => {
    if (response.statusCode !== 200) {
      rejectRequest(new Error(`Download failed with ${response.statusCode}`));
      response.resume();
      return;
    }

    try {
      await pipeline(response, createWriteStream(target));
      resolveRequest();
    } catch (error) {
      rejectRequest(error);
    }
  }).on("error", rejectRequest);
});

console.log(`Saved ${target}`);
