import fs from 'fs';
import path from 'path';
import simplify from '@turf/simplify';
import { SOVEREIGN_CONFIGS } from '../services/countriesData';

const COUNTRIES_GEOJSON_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
const PROVINCES_GEOJSON_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson';

const HUGE_COUNTRY_ISOS = new Set(['USA', 'RUS', 'CHN', 'IND', 'AUS', 'CAN', 'BRA', 'IDN', 'ZAF']);

async function main() {
  console.log('--- STRATEGY GAME MAP GENERATOR & OPTIMIZER ---');
  console.log('Fetching countries 50m GeoJSON...');
  
  try {
    const resCountries = await fetch(COUNTRIES_GEOJSON_URL);
    if (!resCountries.ok) {
      throw new Error(`Failed to fetch countries: ${resCountries.status} ${resCountries.statusText}`);
    }
    const countriesData = await resCountries.json() as any;
    console.log(`Successfully fetched ${countriesData.features?.length || 0} countries.`);

    console.log('Fetching state/province 50m GeoJSON...');
    const resProvinces = await fetch(PROVINCES_GEOJSON_URL);
    if (!resProvinces.ok) {
      throw new Error(`Failed to fetch provinces: ${resProvinces.status} ${resProvinces.statusText}`);
    }
    const provincesData = await resProvinces.json() as any;
    console.log(`Successfully fetched ${provincesData.features?.length || 0} provinces.`);

    // Map parent countries populations for distribution
    const countryPopulations: Record<string, number> = {};
    const countryNamesAr: Record<string, string> = {};
    const countryNamesEn: Record<string, string> = {};

    countriesData.features.forEach((feat: any) => {
      const props = feat.properties || {};
      const iso3 = (props.ISO_A3 || props.ADM0_A3 || '').toUpperCase();
      if (!iso3) return;

      countryPopulations[iso3] = props.POP_EST || 5000000;
      countryNamesAr[iso3] = props.NAME_AR || props.NAME || 'Unknown';
      countryNamesEn[iso3] = props.NAME_EN || props.NAME_LONG || props.NAME || 'Unknown';
    });

    const combinedFeatures: any[] = [];

    // Process smaller countries (keep as-is)
    countriesData.features.forEach((feat: any) => {
      const props = feat.properties || {};
      const iso3 = (props.ISO_A3 || props.ADM0_A3 || '').toUpperCase();
      
      if (!iso3 || iso3 === 'ATA') return; // Filter Antarctica
      if (HUGE_COUNTRY_ISOS.has(iso3)) return; // Skip huge countries (will subdivision instead)

      // Arabic name fallback
      const arabicName = props.NAME_AR || SOVEREIGN_CONFIGS[iso3]?.name || props.NAME || 'مجهول';
      const englishName = props.NAME_EN || props.NAME_LONG || props.NAME || 'Unknown';

      const pop = props.POP_EST || Math.floor(1000000 + Math.random() * 10000000);

      combinedFeatures.push({
        type: 'Feature',
        properties: {
          id: iso3,
          name: arabicName,
          name_en: englishName,
          countryIso: iso3,
          countryName: arabicName,
          country: arabicName, // meeting exact prompt requirement
          population: pop,
          resources: {
            gold: Math.floor(100 + Math.random() * 200),
            oil: Math.floor(50 + Math.random() * 250),
            iron: Math.floor(80 + Math.random() * 200),
            food: Math.floor(100 + Math.random() * 300),
            electricity: Math.floor(30 + Math.random() * 100)
          }
        },
        geometry: feat.geometry
      });
    });

    console.log(`Added ${combinedFeatures.length} country boundaries.`);

    // Group state/province features by huge countries
    const provincesByCountry: Record<string, any[]> = {};
    provincesData.features.forEach((feat: any) => {
      const props = feat.properties || {};
      const iso3 = (props.adm0_a3 || '').toUpperCase();
      if (HUGE_COUNTRY_ISOS.has(iso3)) {
        if (!provincesByCountry[iso3]) {
          provincesByCountry[iso3] = [];
        }
        provincesByCountry[iso3].push(feat);
      }
    });

    // Add subdivisions for huge countries
    HUGE_COUNTRY_ISOS.forEach((iso3) => {
      const provinces = provincesByCountry[iso3] || [];
      if (provinces.length === 0) {
        console.warn(`Warning: No provinces division found for ${iso3}. Keeping country unified.`);
        // Fallback: search country feature and add it
        const countryFeat = countriesData.features.find((f: any) => (f.properties.ISO_A3 || f.properties.ADM0_A3) === iso3);
        if (countryFeat) {
          const props = countryFeat.properties || {};
          const arabicName = props.NAME_AR || SOVEREIGN_CONFIGS[iso3]?.name || props.NAME || 'مجهول';
          const englishName = props.NAME_EN || props.NAME_LONG || props.NAME || 'Unknown';
          combinedFeatures.push({
            type: 'Feature',
            properties: {
              id: iso3,
              name: arabicName,
              name_en: englishName,
              countryIso: iso3,
              countryName: arabicName,
              country: arabicName,
              population: props.POP_EST || 10000000,
              resources: {
                gold: 150, oil: 150, iron: 150, food: 150, electricity: 100
              }
            },
            geometry: countryFeat.geometry
          });
        }
        return;
      }

      console.log(`Adding ${provinces.length} provinces for ${iso3}...`);
      const parentPop = countryPopulations[iso3] || 50000000;
      const avgProvPop = Math.floor(parentPop / provinces.length);

      const parentNameAr = SOVEREIGN_CONFIGS[iso3]?.name || countryNamesAr[iso3] || 'دولة كبرى';

      provinces.forEach((prov: any, idx: number) => {
        const pProps = prov.properties || {};
        
        // Use standard ID or construct a clean unique one
        const provId = pProps.iso_3166_2 || pProps.adm1_code || `${iso3}_PROV_${idx}`;
        
        // Localized province name
        let provNameAr = pProps.name_ar || pProps.name || `مقاطعة ${idx + 1}`;
        const provNameEn = pProps.name_en || pProps.name || `Province ${idx + 1}`;

        // Ensure we handle Arabic translations nicely if missing
        if (!pProps.name_ar && SOVEREIGN_CONFIGS[iso3]) {
          provNameAr = provNameEn; // Fallback to subdivision name if Arabic is missing
        }

        const isOndividualPop = Math.floor(avgProvPop * (0.6 + Math.random() * 0.8));

        combinedFeatures.push({
          type: 'Feature',
          properties: {
            id: provId,
            name: `${parentNameAr} - ${provNameAr}`, // nice display template "السعودية - الرياض"
            name_en: provNameEn,
            countryIso: iso3,
            countryName: parentNameAr,
            country: parentNameAr,
            population: isOndividualPop,
            resources: {
              gold: Math.floor(60 + Math.random() * 180),
              oil: Math.floor(30 + Math.random() * 200),
              iron: Math.floor(60 + Math.random() * 180),
              food: Math.floor(80 + Math.random() * 250),
              electricity: Math.floor(20 + Math.random() * 80)
            }
          },
          geometry: prov.geometry
        });
      });
    });

    const outputCollection = {
      type: 'FeatureCollection',
      features: combinedFeatures
    };

    console.log('Simplifying spatial geometry to optimize for Leaflet browser loading...');
    // turf/simplify can take tolerance.
    const simplifiedCollection = simplify(outputCollection as any, { tolerance: 0.025, highQuality: false });

    const finalJSONString = JSON.stringify(simplifiedCollection);
    
    // Save to all requested paths
    const publicMapsDir = path.join(process.cwd(), 'public', 'assets', 'maps');
    const assetsMapsDir = path.join(process.cwd(), 'assets', 'maps');

    fs.mkdirSync(publicMapsDir, { recursive: true });
    fs.mkdirSync(assetsMapsDir, { recursive: true });

    const outputPath = path.join(assetsMapsDir, 'world.geojson');
    const outputPathBackup = path.join(assetsMapsDir, 'countries-50m.json');
    const outputPathRoot = path.join(process.cwd(), 'countries-50m.json');
    const outputPathPublicWorld = path.join(publicMapsDir, 'world.geojson');
    const outputPathPublic50m = path.join(publicMapsDir, 'countries-50m.json');

    fs.writeFileSync(outputPath, finalJSONString);
    fs.writeFileSync(outputPathBackup, finalJSONString);
    fs.writeFileSync(outputPathRoot, finalJSONString);
    fs.writeFileSync(outputPathPublicWorld, finalJSONString);
    fs.writeFileSync(outputPathPublic50m, finalJSONString);

    console.log(`Success! Saved ${combinedFeatures.length} optimized features representing the entire world.`);
    console.log(`Final file size: ${(finalJSONString.length / 1024 / 1024).toFixed(2)} MB.`);
  } catch (error) {
    console.error('Failed to generate optimized world geojson:', error);
    process.exit(1);
  }
}

main();
