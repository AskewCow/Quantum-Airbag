#!/bin/bash

# Copy IDL from program build to UI
IDL_SOURCE="../target/idl/quantum_airbag.json"
IDL_DEST="./src/idl/quantum_airbag.json"

if [ -f "$IDL_SOURCE" ]; then
    cp "$IDL_SOURCE" "$IDL_DEST"
    echo "IDL copied successfully"
else
    echo "Error: IDL file not found at $IDL_SOURCE"
    echo "Please run 'anchor build' in the project root first"
    exit 1
fi
