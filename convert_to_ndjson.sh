#!/bin/bash

mkdir -p ndjson
for file in $(cat cache/.cache.json | jq -s '.[][1]' --raw-output); do
  fn=$(basename $file)
  base_name="${fn%.*}"
  ndjson_name="ndjson/${base_name}.ndjson" 

  if ! [ -f "ndjson/${base_name}.ndjson" ]; then
    jq --stream -c 'fromstream(1|truncate_stream(inputs))' "cache/$file" > "$ndjson_name"
    # Check the exit status of jq command
    if [ $? -ne 0 ]; then
        echo "An error occurred while processing file: $file" >&2
        rm "$ndjson_name"
    fi
    continue;
  fi

done
