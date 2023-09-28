# CMS PUF --> Plan Network Files

Dependencies: `libreoffice`, `csvkit`, `unzip`, `node`

Build a cache of all content (requires ~3GB disk space):

```sh
node cache.mjs
```

# Example Analysis
Count the number of providers per plan.

In duckdb...

```sql
create table provider as (SELECT * from read_ndjson("cache/provider_*",  columns={"npi": "VARCHAR", "type": "VARCHAR", "plans": "STRUCT(plan_id_type VARCHAR, plan_id VARCHAR, network_tier VARCHAR, years BIGINT[])[]", "name": "STRUCT(prefix VARCHAR, first VARCHAR, middle VARCHAR, last VARCHAR, suffix VARCHAR)", "addresses": "STRUCT(address VARCHAR, address_2 VARCHAR, city VARCHAR, state VARCHAR, zip VARCHAR, phone VARCHAR)[]", "specialty": "VARCHAR[]", "accepting": "VARCHAR", "languages": "VARCHAR[]", "gender": "VARCHAR", "last_updated_on": "VARCHAR", "facility_name": "VARCHAR", "facility_type": "VARCHAR[]", "group_name": "VARCHAR"}));


create table plan as (SELECT * from read_ndjson("cache/plan_*",  columns={"plan_id_type": "VARCHAR", "plan_id": "VARCHAR", "marketing_name": "VARCHAR", "summary_url": "VARCHAR", "marketing_url": "VARCHAR", "formulary_url": "VARCHAR", "plan_contact": "VARCHAR", "network": "STRUCT(network_tier VARCHAR)[]", "formulary": "STRUCT(drug_tier VARCHAR, mail_order BOOLEAN, cost_sharing STRUCT(pharmacy_type VARCHAR, copay_amount DOUBLE, copay_opt VARCHAR, coinsurance_rate DOUBLE, coinsurance_opt VARCHAR)[])[]", "benefits": "STRUCT(telemedicine BOOLEAN)[]", "last_updated_on": "VARCHAR", "years": "BIGINT[]"})) ;

create table formulary as (SELECT * from read_ndjson("cache/formulary_*",  columns={"rxnorm_id": "VARCHAR", "drug_name": "VARCHAR", "plans": "STRUCT(plan_id_type VARCHAR, plan_id VARCHAR, drug_tier VARCHAR, prior_authorization BOOLEAN, step_therapy BOOLEAN, quantity_limit BOOLEAN, years BIGINT[])[]"}))
```

