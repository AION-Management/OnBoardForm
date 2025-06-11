#!/bin/bash

# Create processed directory if it doesn't exist
mkdir -p processed

# Find all submission.json files in the results directory
find results -name "submission.json" | while read -r json_file; do
    # Get the parent directory name
    parent_dir=$(basename "$(dirname "$json_file")")
    
    echo "Processing $json_file..."
    
    # Create the processed subdirectory if it doesn't exist
    mkdir -p "processed/${parent_dir}"
    
    # Copy the submission.json content to input.json
    cp "$json_file" input.json
    
    # Run the conversion script
    python3 jsontocsv.py
    
    # Copy the output to a file named after the parent directory
    cp output.csv "processed/${parent_dir}/submission.csv"
    
    # Copy all other files from the results directory to processed
    cp -r "results/${parent_dir}"/* "processed/${parent_dir}/" 2>/dev/null || true

    # Remove the JSON file from processed directory
    rm "processed/${parent_dir}/submission.json"

    # Remove the processed directory from results
    rm -rf "results/${parent_dir}"
    
done

echo "All submissions processed!" 