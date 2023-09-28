import { createGzip, gunzipSync } from 'zlib'

import fs, { readFileSync } from "fs";
import stream from "stream";
import path from "path";

const CACHE_DIR = "cache";
const MAX_CONCURRENT_URLS = 10;

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR);
}

class JsonTransformStream {
  constructor() {
    this.buffer = "";
    this.bracketCount = -1;
    this.braceCount = 0;
    this.inString = false;
    this.escaping = false;
  }

  transform(chunk, controller) {
    this.buffer += chunk;

    for (
      let i = this.buffer.length - chunk.length;
      i < this.buffer.length;
      i++
    ) {
      const char = this.buffer[i];

      if (this.escaping) {
        this.escaping = false;
        continue;
      }

      if (char === "\\") {
        this.escaping = true;
      } else if (char === '"') {
        this.inString = !this.inString;
      } else if (!this.inString) {
        if (char === "[") {
          this.bracketCount++;
          if (!this.startedArray) {
            this.startedArray = true;
            this.buffer = this.buffer.slice(i + 1);
            i = -1;
            continue;
          }
        } else if (char === "{") {
          this.braceCount++;
        } else if (char === "]") {
          this.bracketCount--;
        } else if (char === "}") {
          this.braceCount--;
        }
      }

      if (
        (this.braceCount === 0 && this.bracketCount === 0 && char === ",") ||
        (this.braceCount === 0 && this.bracketCount === 0 && char === "]")
      ) {
        let objStr = this.buffer.slice(0, i);
        this.buffer = this.buffer.slice(i + 1);
        i = -1;
        objStr = objStr.trim();
        if (objStr) {
          try {
            this.lines = this.lines || 0;
            const jsonl = new TextEncoder().encode(
              JSON.stringify(JSON.parse(objStr)) + "\n"
            );
            controller.enqueue(JSON.parse(objStr));
          } catch (e) {
            console.error(objStr);
            controller.error(e);
            return;
          }
        }
      }
    }
  }
}

async function fetchUrl(url, outputFilePath, ndjson = false) {
    console.log("get", url, outputFilePath);
    const gzStream = createGzip()
    const fstream = fs.createWriteStream(outputFilePath)
    gzStream.pipe(fstream)
    const wstream = stream.Writable.toWeb(gzStream);

  try {
    const response = await fetch(url);

    if (response.headers.get("content-type").startsWith("text/html")) {
      throw new Error(`Wrong content type: url ${url}, header ${response.headers.get("content-type")}`)
    }

    let r = await response.body.pipeThrough(
      new TextDecoderStream("utf-8", { fatal: false, ignoreBOM: true })
    );

    if (ndjson) {
      const jsonStream = new TransformStream(new JsonTransformStream());
      const ndjsonStream = new TransformStream({
        transform(chunk, controller) {
          if (chunk.formulary && !Array.isArray(chunk.formulary)) {
            chunk.formulary = [chunk.formulary];
          }
          if (chunk?.plans?.[0]?.years && !Array.isArray(chunk?.plans?.[0]?.years)) {
            chunk.plans.forEach(p => p.years = [p.years])
          }
          controller.enqueue(JSON.stringify(chunk) + "\n");
        },
      });

      r = r.pipeThrough(jsonStream).pipeThrough(ndjsonStream);
    }
    r = r.pipeTo(wstream);
    await r;
    console.log("  got", outputFilePath, response.headers.get("content-type"));
    return true;
  } catch (error) {
    console.error(`Failed to fetch ${url}: ${error.message}`);
    if (fs.existsSync(outputFilePath)) {
      fstream.destroy()
      fs.rmSync(outputFilePath);
      // console.log("Removed", outputFilePath, gzStream, fstream, wstream)
    }
    return false;
  }
}

const cacheFile = path.join(CACHE_DIR, ".cache.json");
let cache;
try {
  const cacheEntries = fs
    .readFileSync(path.join(CACHE_DIR, ".cache.json"))
    .toString()
    .split("\n")
    .filter((l) => l.startsWith("["))
    .map((l) => JSON.parse(l));
  cache = Object.fromEntries(cacheEntries);
} catch (e) {
  cache = {};
}

const cacheResult = (url, filename) => {
  fs.appendFileSync(cacheFile, JSON.stringify([url, filename]) + `\n`);
  cache[url] = filename;
};

async function fetchUrls(targets) {
  let currentIndex = 0;

  const worker = async (i) => {
    while (currentIndex < targets.length) {
      const index = currentIndex++;
      const url = targets[index].url;
      if (cache[url]) {
        continue;
      }

      const tag = targets[index].tag;
      const cacheFileName = `${tag}_${url
        .replace(/[^a-z0-9]/gi, "")
        .toLowerCase()}.${targets[index].ndjson ? "nd" : ""}json.gz`;
      const cacheFilePath = path.join(CACHE_DIR, cacheFileName);
      if (await fetchUrl(url, cacheFilePath, targets[index].ndjson)) {
        cacheResult(url, cacheFileName);
      }
    }
  };

  const workers = Array.from({ length: MAX_CONCURRENT_URLS }).map((_, i) =>
    worker(i)
  );
  await Promise.all(workers);
}

function processFile(file) {
  const filePath = path.join(CACHE_DIR, file);
  const content = gunzipSync(fs.readFileSync(filePath));
  let jsonData;
  try {
    jsonData = JSON.parse(content);
  } catch (e) {
    console.error("Failed to parse file ", filePath, e);
    return [];
  }

  return Object.entries(jsonData)
    .filter(([key, value]) => key.endsWith("urls") && Array.isArray(value))
    .flatMap(([key, value]) =>
      value.map((url) => ({ url, tag: key.slice(0, -5), ndjson: true }))
    );
}

async function main() {
  console.log("Cache", Object.values(cache).length);
  const repo = JSON.parse(fs.readFileSync("Machine_Readable_PUF.json"));
  const indexes = new Set(repo.map((i) => i["URL Submitted"]));

  await fetchUrls(Array.from(indexes).map((url) => ({ url, tag: "index" })));

  const subFiles = Object.values(cache)
    .filter((f) => f.startsWith("index_"))
    .flatMap(processFile);

  await fetchUrls(subFiles);
  return;
}

await main();
