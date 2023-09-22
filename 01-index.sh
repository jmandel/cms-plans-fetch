#!/bin/bash

process_url() {
    # Read variables from arguments
    state="$1"
    issuer_id="$2"
    url="$3"

    # Fetch the URL and save the content, log errors
    curl -s "$url" -o "index/${state}_$(printf '%.0f' $issuer_id).json" 2>>index/errors.ndjson
}

export -f process_url
mkdir -p index || true
jq -r '.[] | "\(.State) \(.["Issuer ID"]) \(.["URL Submitted"])"' Machine_Readable_PUF.json |
xargs -I {} -P 10 bash -c 'process_url $@' _ {}

