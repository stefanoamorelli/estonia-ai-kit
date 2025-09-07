#!/usr/bin/env node
import Database from 'better-sqlite3';
import { createReadStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import StreamArray from 'stream-json/streamers/StreamArray.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../.rik-data');
const DB_PATH = path.join(DATA_DIR, 'rik_data.db');

console.log('📥 Importing board members into database...\n');

const db = new Database(DB_PATH);

// Enable optimizations
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO board_members (
    registry_code, person_type, person_role, role_text,
    first_name, last_name, personal_code_hash,
    start_date, end_date, address_country, address_full, email
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMany = db.transaction((members) => {
  for (const member of members) {
    insertStmt.run(...member);
  }
});

const jsonPath = path.join(DATA_DIR, 'ettevotja_rekvisiidid__kaardile_kantud_isikud.json');
const pipeline = createReadStream(jsonPath)
  .pipe(StreamArray.withParser());

let count = 0;
let batch = [];
let dominanceProcessed = false;

pipeline.on('data', ({ value: company }) => {
  if (company.ariregistri_kood === 14664821) {
    console.log('Processing Dominance OÜ board members...');
    dominanceProcessed = true;
  }
  
  if (company.kaardile_kantud_isikud && Array.isArray(company.kaardile_kantud_isikud)) {
    for (const member of company.kaardile_kantud_isikud) {
      batch.push([
        company.ariregistri_kood,
        member.isiku_tyyp,
        member.isiku_roll,
        member.isiku_roll_tekstina,
        member.eesnimi,
        member.nimi_arinimi,
        member.isikukood_hash,
        member.algus_kpv,
        member.lopp_kpv,
        member.aadress_riik_tekstina,
        member.aadress_ads__ads_normaliseeritud_taisaadress,
        member.email
      ]);
      count++;
      
      if (batch.length >= 1000) {
        insertMany(batch);
        batch = [];
        if (count % 10000 === 0) {
          process.stdout.write(`\r  Imported ${count} board members...`);
        }
      }
    }
  }
});

pipeline.on('end', () => {
  if (batch.length > 0) {
    insertMany(batch);
  }
  
  console.log(`\n✅ Imported ${count} board members`);
  console.log(`Dominance OÜ processed: ${dominanceProcessed}`);
  
  // Check Dominance board members
  const dominanceMembers = db.prepare(`
    SELECT * FROM board_members WHERE registry_code = '14664821'
  `).all();
  
  console.log(`\nDominance OÜ board members in database: ${dominanceMembers.length}`);
  if (dominanceMembers.length > 0) {
    console.log('Board member:', dominanceMembers[0].full_name || `${dominanceMembers[0].first_name} ${dominanceMembers[0].last_name}`);
  }
  
  db.close();
});

pipeline.on('error', (error) => {
  console.error('Error:', error);
  db.close();
  process.exit(1);
});