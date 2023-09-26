import fs, { readFileSync } from "fs";
import path from "path";

const CACHE_DIR = "cache";
const MAX_CONCURRENT_URLS = 10;

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR);
}

async function fetchUrl(url, outputFilePath) {
  try {
    console.log("get", url, outputFilePath);
    const response = await fetch(url);
    const fileStream = fs.createWriteStream(outputFilePath);
    const stream = new WritableStream({
      write(chunk) {
        return new Promise((resolve, reject) => fileStream.write(chunk, (err) => err ? reject(err) : resolve()));
      },
      close() {
        return new Promise((resolve, reject) => fileStream.close((err) => err ? reject(err) : resolve()));
      },
    });

    if (response.headers.get("content-type").startsWith("text/html")){
        console.error("Wrong content type", url, response.headers);
        return false;
    }
    let r = await response.body
      .pipeThrough(
        new TextDecoderStream("utf-8", { fatal: false, ignoreBOM: true })
      )
      .pipeTo(stream);
    console.log("  got", outputFilePath, r, response.headers.get("content-type"));
    return true;
  } catch (error) {
    console.error(`Failed to fetch ${url}: ${error.message}`, error);
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
        .toLowerCase()}.json`;
      const cacheFilePath = path.join(CACHE_DIR, cacheFileName);
      if (await fetchUrl(url, cacheFilePath)) {
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
  const content = fs.readFileSync(filePath, "utf-8");
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
      value.map((url) => ({ url, tag: key.slice(0, -5) }))
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
