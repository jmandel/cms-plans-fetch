# CMS PUF --> Plan Network Files

Dependencies: `libreoffice`, `csvkit`, `unzip`, `jq`, `node`, `findutils`

Build a cache of all content (requires ~100GB disk space):

```sh
node cache.mjs
```

Create ndjson files from cache (requires ~100GB disk space):
```sh
./convert_to_ndjson.sh
```

# Example Analysis
Count the number of providers per plan.

    COPY (SELECT * from read_ndjson("ndjson/provider_*",  columns={"npi": "VARCHAR", "type": "VARCHAR", "plans": "STRUCT(plan_id_type VARCHAR, plan_id VARCHAR, network_tier VARCHAR, years BIGINT[])[]", "name": "STRUCT(prefix VARCHAR, first VARCHAR, middle VARCHAR, last VARCHAR, suffix VARCHAR)", "addresses": "STRUCT(address VARCHAR, address_2 VARCHAR, city VARCHAR, state VARCHAR, zip VARCHAR, phone VARCHAR)[]", "specialty": "VARCHAR[]", "accepting": "VARCHAR", "languages": "VARCHAR[]", "gender": "VARCHAR", "last_updated_on": "VARCHAR", "facility_name": "VARCHAR", "facility_type": "VARCHAR[]", "group_name": "VARCHAR"})) to 'providers.parquet' (FORMAT PARQUET);

