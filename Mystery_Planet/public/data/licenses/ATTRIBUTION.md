# Administrative boundary attribution

Natural Earth Admin 1 (first-level divisions), maintained 1:10m source: public domain.
https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/
https://www.naturalearthdata.com/about/terms-of-use/

Second-level source: geoBoundaries gbOpen, William & Mary geoLab. Credit geoBoundaries and the original providers listed below. API metadata and exact pinned source URLs, checksums and transformations are in ../provenance.json.
https://www.geoboundaries.org/api.html
Runfola et al. (2020), geoBoundaries: A global database of political administrative boundaries, PLOS ONE 15(4): e0231866.

- IND-adm2.geojson: source represents 2021. Providers: Pathways Data Pvt. Ltd.; lgdirectory.gov.in. Source license: Open Data Commons Open Database License 1.0.
- RUS-adm2.geojson: source represents 2017. Providers: OpenStreetMap, Wambacher. Source license: Open Data Commons Open Database License 1.0. Attribution: © OpenStreetMap contributors (https://www.openstreetmap.org/copyright).
- USA-adm2.geojson: source represents 2018. Provider: United States Census Bureau MAF/TIGER Database. Public domain.

The adapted IND and RUS second-level datasets, including added parent links and retained source attributes, are provided under ODbL 1.0. See ODbL-1.0.txt and https://opendatacommons.org/licenses/odbl/1-0/ . This attribution does not change the license of unrelated original game code, the public-domain Natural Earth data, or the differently licensed historical atlas data.

Transformations: simplified source geometry with the existing atlas ring simplifier; five decimal places; representative-point spatial parent assignment; unmatched records withheld instead of nearest-neighbour assignment; disputed Ukraine/Russia assignments excluded from an unqualified Russian-region list. This is not an assertion that any dataset is a certified current administrative register.
