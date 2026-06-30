import fs from 'fs';
import https from 'https';
import path from 'path';

const url = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson';
const targetPath = path.join(process.cwd(), 'public', 'assets', 'maps', 'provinces-50m.geojson');

console.log('Downloading provinces data...');

https.get(url, (res) => {
  if (res.statusCode !== 200) {
    console.error(`Failed to download. Status Code: ${res.statusCode}`);
    res.resume();
    return;
  }
  
  const file = fs.createWriteStream(targetPath);
  res.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Download completed successfully.');
  });
}).on('error', (err) => {
  console.error('Error downloading:', err.message);
});
