import fs from 'fs';
import path from 'path';

const INDEX_DIR = 'index';
const CACHE_DIR = 'cache';
const MAX_CONCURRENT_URLS = 5;

// Ensure the cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR);
}

async function fetchUrl(url, outputFilePath) {
    try {
        const response = await fetch(url);
        const fileStream = fs.createWriteStream(outputFilePath);
        const stream = new WritableStream({
            write(chunk) {
                fileStream.write(chunk);
            },
        });

        response.body.pipeTo(stream);

        // Ensure the stream finishes writing before returning
        await new Promise((resolve, reject) => {
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
        });
    } catch (error) {
        console.error(`Failed to fetch ${url}: ${error.message}`);
    }
}

async function processUrlsWithPool(urls, filename, key) {
    let currentIndex = 0;

    const worker = async () => {
        while (currentIndex < urls.length) {
            const index = currentIndex++;
            const url = urls[index];
            const cacheFileName = `${filename}_${key}_${index}.json`;
            const cacheFilePath = path.join(CACHE_DIR, cacheFileName);
            await fetchUrl(url, cacheFilePath);
        }
    };

    const workers = Array.from({ length: MAX_CONCURRENT_URLS }).map(worker);
    await Promise.all(workers);
}

async function processFile(file) {
    const filePath = path.join(INDEX_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    let jsonData;
    try {
      jsonData = JSON.parse(content);
    } catch (e) {
      console.error("Failed on", filePath, e);
      return;
    }

    // Iterate through the properties of the JSON data
    for (const [key, value] of Object.entries(jsonData)) {
        // Check if property ends with "urls" and its value is an array
        if (key.endsWith('urls') && Array.isArray(value)) {
            await processUrlsWithPool(value, file, key);
        }
    }
}

async function main() {
    const files = fs.readdirSync(INDEX_DIR);

    // Process 10 files concurrently
    for (let i = 0; i < files.length; i += 10) {
        const fileChunk = files.slice(i, i + 10);
        await Promise.all(fileChunk.map(file => processFile(file)));
    }
}

main();
