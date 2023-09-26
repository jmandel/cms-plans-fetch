#!/bin/bash

mkdir -p ndjson
for file in $(cat cache/.cache.json | jq -s '.[][1]' --raw-output); do
    fn=$(basename $file)
    base_name="${fn%.*}"
  if [ ! -f "ndjson/${base_name}.ndjson" ]; then
    jq -c '.[]' "cache/$file" > "ndjson/${base_name}.ndjson"
  fi

  # Check the exit status of jq command
  if [ $? -ne 0 ]; then
    echo "An error occurred while processing file: $file" >&2
  fi
done
