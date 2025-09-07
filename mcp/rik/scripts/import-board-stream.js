#!/usr/bin/env node
import Database from 'better-sqlite3';
import { createReadStream } from 'fs';
import JSONStream from 'JSONStream';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../.rik-data');
const DB_PATH = path.join(DATA_DIR, 'rik_data.db');

console.log('📥 Streaming import of board members...\n');

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

let totalMembers = 0;
let batch = [];
let dominanceFound = false;

const stream = createReadStream(jsonPath)
  .pipe(JSONStream.parse('*'));

stream.on('data', (company) => {
  if (company.ariregistri_kood === 14664821) {
    console.log('Processing Dominance OÜ...');
    console.log('Board members:', company.kaardile_kantud_isikud?.length || 0);
    dominanceFound = true;
  }
  
  if (company.kaardile_kantud_isikud && Array.isArray(company.kaardile_kantud_isikud)) {
    for (const member of company.kaardile_kantud_isikud) {
      batch.push([
        String(company.ariregistri_kood),
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
      totalMembers++;
      
      if (batch.length >= 1000) {
        insertMany(batch);
        batch = [];
        if (totalMembers % 10000 === 0) {
          process.stdout.write(`\r  Imported ${totalMembers} board members...`);
        }
      }
    }
  }
});

stream.on('end', () => {
  // Insert remaining batch
  if (batch.length > 0) {
    insertMany(batch);
  }
  
  console.log(`\n✅ Imported ${totalMembers} board members`);
  console.log(`Dominance OÜ found: ${dominanceFound}`);
  
  // Verify Dominance
  const dominanceMembers = db.prepare(`
    SELECT * FROM board_members WHERE registry_code = '14664821'
  `).all();
  
  console.log(`\nDominance OÜ board members in database: ${dominanceMembers.length}`);
  if (dominanceMembers.length > 0) {
    const member = dominanceMembers[0];
    console.log(`Board member: ${member.first_name} ${member.last_name} (${member.role_text})`);
    console.log(`Start date: ${member.start_date}`);
  }
  
  // Total count
  const totalCount = db.prepare('SELECT COUNT(*) as count FROM board_members').get();
  console.log(`\nTotal board members in database: ${totalCount.count}`);
  
  db.close();
  process.exit(0);
});

stream.on('error', (error) => {
  console.error('Stream error:', error);
  db.close();
  process.exit(1);
});