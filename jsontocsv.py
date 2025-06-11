import json
import csv
"""
# Copyright (c) 2023 Aquafortis
# https://github.com/Aquafortis/json-csv-converter
# $ python3 jsontocsv.py
"""
class JsonCsv(object):

    def json_to_csv(self):
        jsonfile = open("input.json", "r")
        data = json.load(jsonfile)
        jsonfile.close()
        
        # Flatten the nested structure
        flattened_data = []
        form_data = data["formData"]
        files = data["files"]
        
        # Create a row with form data and first file (if any)
        row = form_data.copy()
        if files:
            row.update(files[0])
        flattened_data.append(row)
        
        csvfile = open("output.csv", "w", newline='')
        poetize = csv.writer(csvfile)
        poetize.writerow(flattened_data[0].keys())
        for row in flattened_data:
            poetize.writerow(row.values())
        csvfile.close()

JsonCsv().json_to_csv()
