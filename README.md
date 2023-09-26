# CMS PUF --> Plan Network Files

Dependencies: `libreoffice`, `csvkit`, `unzip`, `jq`, `node`, `findutils`

Build the cache (requires ~100GB disk space):

```sh
node cache.mjs
```

Create ndjson from cache (requires ~100GB disk space):
```sh
./convert_to_ndjson.sh
```
