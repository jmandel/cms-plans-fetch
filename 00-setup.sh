#!/bin/bash

wget https://download.cms.gov/marketplace-puf/2023/machine-readable-url-puf.zip
unzip machine-readable-url-puf.zip
libreoffice --headless --convert-to csv Machine_Readable_PUF.xlsx
csvjson  Machine_Readable_PUF.csv  > Machine_Readable_PUF.json
