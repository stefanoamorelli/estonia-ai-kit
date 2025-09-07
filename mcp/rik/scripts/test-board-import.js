#!/usr/bin/env node
import { createReadStream } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonPath = path.join(__dirname, '../.rik-data/ettevotja_rekvisiidid__kaardile_kantud_isikud.json');

console.log('Testing board members JSON import...\n');

// Try to import stream-json
import('stream-json/streamers/StreamArray.js').then(async (module) => {
  const StreamArray = module.default;
  
  const pipeline = createReadStream(jsonPath)
    .pipe(StreamArray.withParser());
  
  let count = 0;
  let dominanceFound = false;
  
  pipeline.on('data', ({ value: company }) => {
    count++;
    
    // Look for Dominance OÜ
    if (company.ariregistri_kood === 14664821 || company.ariregistri_kood === '14664821') {
      console.log('Found Dominance OÜ!');
      console.log('Registry code:', company.ariregistri_kood);
      console.log('Name:', company.nimi);
      console.log('Board members:', company.kaardile_kantud_isikud);
      dominanceFound = true;
    }
    
    if (count === 1) {
      console.log('First company structure:');
      console.log('Registry code:', company.ariregistri_kood);
      console.log('Name:', company.nimi);
      console.log('Has board members:', !!company.kaardile_kantud_isikud);
      if (company.kaardile_kantud_isikud && company.kaardile_kantud_isikud.length > 0) {
        console.log('First board member:', company.kaardile_kantud_isikud[0]);
      }
    }
    
    if (count % 10000 === 0) {
      process.stdout.write(`\rProcessed ${count} companies...`);
    }
  });
  
  pipeline.on('end', () => {
    console.log(`\n\nTotal companies processed: ${count}`);
    console.log(`Dominance OÜ found: ${dominanceFound}`);
  });
  
  pipeline.on('error', (error) => {
    console.error('Error:', error);
  });
}).catch(error => {
  console.error('Failed to import stream-json:', error);
});