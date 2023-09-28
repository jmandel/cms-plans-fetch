from typing import Any, Dict

# Mapping of JSON schema types to DuckDB types
type_mapping = {
    "string": "VARCHAR",
    "integer": "BIGINT",
    "number": "DOUBLE",
    "boolean": "BOOLEAN",
    "timestamp": "TIMESTAMP",
    "null": "NULL",
    "array": "ARRAY"
}

def merge_dicts(d1: Dict[str, Any], d2: Dict[str, Any]) -> Dict[str, Any]:
    """
    Merge two dictionaries, taking the union of their keys. If keys overlap and both values are dictionaries,
    recursively merge them.

    Parameters:
    - d1, d2 (Dict): The dictionaries to merge.

    Returns:
    - Dict: The merged dictionary.
    """
    merged = d1.copy()
    for key, value in d2.items():
        if key in merged:
            if isinstance(merged[key], dict) and isinstance(value, dict):
                merged[key] = merge_dicts(merged[key], value)
        else:
            merged[key] = value
    return merged

def generate_duckdb_schema(json_schema, definitions, level=0):
    """
    Recursively generate DuckDB schema from JSON schema.

    Parameters:
    - json_schema (Dict): The JSON schema to convert.
    - definitions (Dict): The "definitions" section of the JSON schema for resolving $ref.
    - level (int): The nesting level, used for indentation.

    Returns:
    - Dict: The corresponding DuckDB schema.
    """
    # Initialize the DuckDB schema
    duckdb_schema = {}

    # If the schema contains a $ref, resolve it
    if '$ref' in json_schema:
        ref_key = json_schema['$ref'].split('/')[-1]
        json_schema = definitions.get(ref_key, {})

    # Handle if/then/else branches
    if 'if' in json_schema and ('then' in json_schema or 'else' in json_schema):
        then_schema = json_schema.get('then', {})
        else_schema = json_schema.get('else', {})

        # Generate DuckDB schemas for 'then' and 'else' branches and merge them
        then_duckdb_schema = generate_duckdb_schema(then_schema, definitions, level=level+1)
        else_duckdb_schema = generate_duckdb_schema(else_schema, definitions, level=level+1)
        duckdb_schema = merge_dicts(then_duckdb_schema, else_duckdb_schema)

    # Check if the schema describes an object
    elif json_schema.get('type') == 'object' and 'properties' in json_schema:
        for key, value in json_schema['properties'].items():
            # If value contains a $ref, resolve it
            if '$ref' in value:
                ref_key = value['$ref'].split('/')[-1]
                value = definitions.get(ref_key, {})

            if value.get('type') == 'object':
                # Nested object, recurse
                duckdb_schema[key] = generate_duckdb_schema(value, definitions, level=level+1)
            elif value.get('type') == 'array' and 'items' in value:
                # Array type, recurse into its items
                items_schema = value['items']
                if '$ref' in items_schema:
                    items_ref = items_schema['$ref'].split('/')[-1]
                    items_schema = definitions.get(items_ref, {})
                duckdb_schema[key] = [generate_duckdb_schema(items_schema, definitions, level=level+1)]
            else:
                # Handle cases where 'type' is a list
                json_type = value.get('type')
                if isinstance(json_type, list):
                    duckdb_type = [type_mapping.get(t, 'UNKNOWN') for t in json_type]
                else:
                    # Primitive type, map directly
                    duckdb_type = type_mapping.get(json_type, 'UNKNOWN')
                duckdb_schema[key] = duckdb_type

    # Handle primitive types outside of 'properties' (useful for array items)
    else:
        duckdb_type = type_mapping.get(json_schema.get('type'), 'UNKNOWN')
        return duckdb_type

    return duckdb_schema

import json
import sys

def toduck(s):
    def helper(s):
        t = type(s).__name__
        if t == "dict":
            parts = {k: helper(v) for (k,v) in s.items()}
            items = ", ".join(f'{k} {v}' for (k,v) in parts.items())
            return f"STRUCT({items})"
        elif t=="list":
            items = helper(s[0])
            if len(s) == 1:
                return f"{items}[]"
            return f"{items}"
        else:
            return s
    parts = {k: helper(v) for (k,v) in s.items()}
    return "{" + ", ".join(f'"{k}": "{v}"' for (k,v) in parts.items()) + "}"


for schema in ["drugs_schema.json",  "plans_schema.json",  "providers_schema.json"]:

    with open('cms/'+schema, 'r') as f:
        json_schema = json.load(f)

    # Starting with the root of the schema, which is often defined under "definitions"
    # In this case, the root is under 'definitions' -> 'provider'
    root_schema = json_schema['definitions'][json_schema['items']['$ref'].split("/")[-1]]
    definitions = json_schema['definitions']

    # Generate the DuckDB schema
    duckdb_schema = generate_duckdb_schema(root_schema, definitions)
    with open("duckdb/"+schema, "w") as fout:
        print(toduck(duckdb_schema), file=fout)
