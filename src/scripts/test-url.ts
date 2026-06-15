import fs from 'fs';
import path from 'path';
import simplify from '@turf/simplify';

async function main() {
  const url = 'https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/10m/cultural/ne_10m_admin_1_states_provinces.json';
  console.log('Downloading map...');
  const res = await fetch(url);
  const data = await res.json() as any;
  
  const simplified = simplify(data, { tolerance: 0.1, highQuality: true });
  
  const cleanFeatures = simplified.features.map((f: any) => {
    return {
      type: "Feature",
      properties: {
        id: f.properties.iso_3166_2 || f.properties.adm1_code || f.properties.name,
        iso_a3: f.properties.adm0_a3,
        name: f.properties.name,
        countryName: f.properties.admin
      },
      geometry: f.geometry
    };
  });
  simplified.features = cleanFeatures;

  const outStr = JSON.stringify(simplified);
  console.log('0.1 HQ size MB:', (outStr.length / 1024 / 1024).toFixed(2));
}

main();
