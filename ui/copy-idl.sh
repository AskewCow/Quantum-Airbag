#!/bin/bash

# Copy IDL from program build to all consumers
IDL_SOURCE="../program/target/idl/quantum_airbag.json"

if [ ! -f "$IDL_SOURCE" ]; then
    echo "Error: IDL file not found at $IDL_SOURCE"
    echo "Please run 'anchor build' in the project root first"
    exit 1
fi

cp "$IDL_SOURCE" "./src/idl/quantum_airbag.json"
echo "IDL copied to ui/src/idl/"
