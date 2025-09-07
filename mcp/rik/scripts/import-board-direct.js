#!/usr/bin/env node
import Database from 'better-sqlite3';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../.rik-data');
const DB_PATH = path.join(DATA_DIR, 'rik_data.db');

console.log('📥 Direct import of board members...\n');

async function importBoardMembers() {
  const db = new Database(DB_PATH);
  
  // Enable optimizations
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  
  const jsonPath = path.join(DATA_DIR, 'ettevotja_rekvisiidid__kaardile_kantud_isikud.json');
  
  console.log('Reading JSON file (this may take a moment for 976MB)...');
  const content = await fs.readFile(jsonPath, 'utf-8');
  
  console.log('Parsing JSON...');
  const data = JSON.parse(content);
  
  console.log(`Found ${data.length} companies with board member data`);
  
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
  
  let totalMembers = 0;
  const batch = [];
  
  // Find Dominance first
  const dominance = data.find(c => c.ariregistri_kood === 14664821);
  if (dominance) {
    console.log('\nFound Dominance OÜ:');
    console.log('- Name:', dominance.nimi);
    console.log('- Board members:', dominance.kaardile_kantud_isikud?.length || 0);
    if (dominance.kaardile_kantud_isikud?.length > 0) {
      console.log('- First member:', dominance.kaardile_kantud_isikud[0].eesnimi, dominance.kaardile_kantud_isikud[0].nimi_arinimi);
    }
  }
  
  console.log('\nImporting board members...');
  
  for (const company of data) {
    if (company.kaardile_kantud_isikud && Array.isArray(company.kaardile_kantud_isikud)) {
      for (const member of company.kaardile_kantud_isikud) {
        batch.push([
          String(company.ariregistri_kood), // Ensure it's a string
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
          batch.length = 0;
          if (totalMembers % 10000 === 0) {
            process.stdout.write(`\r  Imported ${totalMembers} board members...`);
          }
        }
      }
    }
  }
  
  // Insert remaining
  if (batch.length > 0) {
    insertMany(batch);
  }
  
  console.log(`\n✅ Imported ${totalMembers} board members`);
  
  // Verify Dominance
  const dominanceMembers = db.prepare(`
    SELECT * FROM board_members WHERE registry_code = '14664821'
  `).all();
  
  console.log(`\nDominance OÜ board members in database: ${dominanceMembers.length}`);
  if (dominanceMembers.length > 0) {
    console.log('Board member:', dominanceMembers[0].full_name || `${dominanceMembers[0].first_name} ${dominanceMembers[0].last_name}`);
  }
  
  db.close();
}

importBoardMembers().catch(console.error);