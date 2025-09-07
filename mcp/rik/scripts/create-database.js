#!/usr/bin/env node
import Database from 'better-sqlite3';
import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse';
import { createReadStream } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../.rik-data');
const DB_PATH = path.join(DATA_DIR, 'rik_data.db');

console.log('🏗️  Creating RIK SQLite Database...\n');

// Create database
const db = new Database(DB_PATH);

// Enable foreign keys and optimize for speed
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

console.log('📊 Creating database schema...');

// Create tables
db.exec(`
  -- Companies table (from CSV)
  CREATE TABLE IF NOT EXISTS companies (
    registry_code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT,
    status_text TEXT,
    legal_form TEXT,
    vat_number TEXT,
    address TEXT,
    location TEXT,
    normalized_address TEXT,
    postal_code TEXT,
    first_registration_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Board members table
  CREATE TABLE IF NOT EXISTS board_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registry_code TEXT NOT NULL,
    person_type TEXT,
    person_role TEXT,
    role_text TEXT,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
    personal_code_hash TEXT,
    start_date TEXT,
    end_date TEXT,
    address_country TEXT,
    address_full TEXT,
    email TEXT,
    FOREIGN KEY (registry_code) REFERENCES companies(registry_code)
  );

  -- Shareholders table
  CREATE TABLE IF NOT EXISTS shareholders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registry_code TEXT NOT NULL,
    shareholder_name TEXT,
    shareholder_type TEXT,
    share_amount REAL,
    share_currency TEXT,
    ownership_percentage REAL,
    start_date TEXT,
    end_date TEXT,
    FOREIGN KEY (registry_code) REFERENCES companies(registry_code)
  );

  -- Beneficial owners table
  CREATE TABLE IF NOT EXISTS beneficial_owners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registry_code TEXT NOT NULL,
    owner_name TEXT,
    owner_type TEXT,
    control_type TEXT,
    control_percentage REAL,
    start_date TEXT,
    end_date TEXT,
    FOREIGN KEY (registry_code) REFERENCES companies(registry_code)
  );

  -- General data table (from yldandmed.json)
  CREATE TABLE IF NOT EXISTS company_general_data (
    registry_code TEXT PRIMARY KEY,
    email TEXT,
    phone TEXT,
    capital REAL,
    activity_area TEXT,
    founded_date TEXT,
    website TEXT,
    employees_count INTEGER,
    main_activity_code TEXT,
    main_activity_text TEXT,
    data_json TEXT,
    FOREIGN KEY (registry_code) REFERENCES companies(registry_code)
  );

  -- Registry cards table (from registrikaardid.json)
  CREATE TABLE IF NOT EXISTS registry_cards (
    registry_code TEXT PRIMARY KEY,
    card_type TEXT,
    card_data TEXT,
    last_updated TEXT,
    FOREIGN KEY (registry_code) REFERENCES companies(registry_code)
  );

  -- Create indexes for fast searching
  CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
  CREATE INDEX IF NOT EXISTS idx_companies_address ON companies(normalized_address);
  CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
  CREATE INDEX IF NOT EXISTS idx_board_members_registry ON board_members(registry_code);
  CREATE INDEX IF NOT EXISTS idx_board_members_name ON board_members(full_name);
  CREATE INDEX IF NOT EXISTS idx_shareholders_registry ON shareholders(registry_code);
  CREATE INDEX IF NOT EXISTS idx_beneficial_owners_registry ON beneficial_owners(registry_code);
  CREATE INDEX IF NOT EXISTS idx_general_data_registry ON company_general_data(registry_code);
  CREATE INDEX IF NOT EXISTS idx_registry_cards_registry ON registry_cards(registry_code);
`);

console.log('✅ Database schema created');

// Function to import CSV data
async function importCompaniesFromCSV() {
  console.log('\n📥 Importing companies from CSV...');
  
  const csvPath = path.join(DATA_DIR, 'ettevotja_rekvisiidid__lihtandmed.csv');
  
  return new Promise((resolve, reject) => {
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO companies (
        registry_code, name, status, status_text, legal_form, 
        vat_number, address, location, normalized_address, 
        postal_code, first_registration_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((companies) => {
      for (const company of companies) {
        insertStmt.run(
          company.ariregistri_kood,
          company.nimi || company[' nimi'], // Handle BOM
          company.ettevotja_staatus,
          company.ettevotja_staatus_tekstina,
          company.ettevotja_oiguslik_vorm,
          company.kmkr_nr,
          company.ettevotja_aadress,
          company.asukoht_ettevotja_aadressis,
          company.ads_normaliseeritud_taisaadress,
          company.indeks_ettevotja_aadressis,
          company.ettevotja_esmakande_kpv
        );
      }
    });
    
    const companies = [];
    let count = 0;
    
    createReadStream(csvPath)
      .pipe(parse({
        columns: true,
        delimiter: ';',
        skip_empty_lines: true,
        bom: true
      }))
      .on('data', (row) => {
        companies.push(row);
        count++;
        
        // Insert in batches of 1000
        if (companies.length >= 1000) {
          insertMany(companies);
          companies.length = 0;
          if (count % 10000 === 0) {
            process.stdout.write(`\r  Imported ${count} companies...`);
          }
        }
      })
      .on('end', () => {
        // Insert remaining companies
        if (companies.length > 0) {
          insertMany(companies);
        }
        console.log(`\n✅ Imported ${count} companies`);
        resolve();
      })
      .on('error', reject);
  });
}

// Function to import board members from JSON
async function importBoardMembers() {
  console.log('\n📥 Importing board members from JSON...');
  
  const jsonPath = path.join(DATA_DIR, 'ettevotja_rekvisiidid__kaardile_kantud_isikud.json');
  
  // Check if file exists
  try {
    await fs.access(jsonPath);
  } catch {
    console.log('⚠️  Board members file not found, skipping...');
    return;
  }
  
  // Dynamic import of stream-json
  let StreamArray;
  try {
    const streamJsonModule = await import('stream-json/streamers/StreamArray.js');
    StreamArray = streamJsonModule.default;
  } catch (error) {
    console.log('⚠️  stream-json not installed, reading file directly...');
    // Fallback to reading chunks of the file
    const content = await fs.readFile(jsonPath, 'utf-8');
    const data = JSON.parse(content);
    await importBoardMembersFromArray(data);
    return;
  }
  
  const pipeline = createReadStream(jsonPath)
    .pipe(StreamArray.withParser());
  
  const insertStmt = db.prepare(`
    INSERT INTO board_members (
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
  
  let count = 0;
  let batch = [];
  
  return new Promise((resolve, reject) => {
    pipeline.on('data', ({ value: company }) => {
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
      resolve();
    });
    
    pipeline.on('error', reject);
  });
}

// Helper function to import board members from array
async function importBoardMembersFromArray(data) {
  const insertStmt = db.prepare(`
    INSERT INTO board_members (
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
  
  let count = 0;
  const batch = [];
  
  for (const company of data) {
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
          batch.length = 0;
          if (count % 10000 === 0) {
            process.stdout.write(`\r  Imported ${count} board members...`);
          }
        }
      }
    }
  }
  
  if (batch.length > 0) {
    insertMany(batch);
  }
  
  console.log(`\n✅ Imported ${count} board members`);
}

// Function to import general data from JSON
async function importGeneralData() {
  console.log('\n📥 Importing general company data from JSON...');
  
  const jsonPath = path.join(DATA_DIR, 'ettevotja_rekvisiidid__yldandmed.json');
  
  // Check if file exists
  try {
    await fs.access(jsonPath);
  } catch {
    console.log('⚠️  General data file not found, skipping...');
    return;
  }
  
  // Try streaming first
  let StreamArray;
  try {
    const streamJsonModule = await import('stream-json/streamers/StreamArray.js');
    StreamArray = streamJsonModule.default;
    
    const pipeline = createReadStream(jsonPath)
      .pipe(StreamArray.withParser());
    
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO company_general_data (
        registry_code, email, phone, capital, activity_area, 
        founded_date, website, employees_count, main_activity_code, 
        main_activity_text, data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((items) => {
      for (const item of items) {
        insertStmt.run(...item);
      }
    });
    
    let count = 0;
    let batch = [];
    
    return new Promise((resolve, reject) => {
      pipeline.on('data', ({ value: company }) => {
        batch.push([
          company.ariregistri_kood,
          company.email,
          company.telefon,
          company.kapital,
          company.tegevusala,
          company.asutamise_kuupaev,
          company.veebiaadress,
          company.tootajate_arv,
          company.pohitegevusala_kood,
          company.pohitegevusala_tekst,
          JSON.stringify(company) // Store full data as JSON
        ]);
        count++;
        
        if (batch.length >= 1000) {
          insertMany(batch);
          batch = [];
          if (count % 10000 === 0) {
            process.stdout.write(`\r  Imported ${count} general data records...`);
          }
        }
      });
      
      pipeline.on('end', () => {
        if (batch.length > 0) {
          insertMany(batch);
        }
        console.log(`\n✅ Imported ${count} general data records`);
        resolve();
      });
      
      pipeline.on('error', reject);
    });
  } catch (error) {
    console.log('⚠️  Error importing general data:', error.message);
  }
}

// Function to import shareholders from JSON
async function importShareholders() {
  console.log('\n📥 Importing shareholders from JSON...');
  
  const jsonPath = path.join(DATA_DIR, 'ettevotja_rekvisiidid__osanikud.json');
  
  // Check if file exists
  try {
    await fs.access(jsonPath);
  } catch {
    console.log('⚠️  Shareholders file not found, skipping...');
    return;
  }
  
  try {
    const streamJsonModule = await import('stream-json/streamers/StreamArray.js');
    const StreamArray = streamJsonModule.default;
    
    const pipeline = createReadStream(jsonPath)
      .pipe(StreamArray.withParser());
    
    const insertStmt = db.prepare(`
      INSERT INTO shareholders (
        registry_code, shareholder_name, shareholder_type,
        share_amount, share_currency, ownership_percentage,
        start_date, end_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((items) => {
      for (const item of items) {
        insertStmt.run(...item);
      }
    });
    
    let count = 0;
    let batch = [];
    
    return new Promise((resolve, reject) => {
      pipeline.on('data', ({ value: company }) => {
        if (company.osanikud && Array.isArray(company.osanikud)) {
          for (const shareholder of company.osanikud) {
            batch.push([
              company.ariregistri_kood,
              shareholder.osaniku_nimi,
              shareholder.osaniku_tyyp,
              shareholder.osa_suurus,
              shareholder.osa_valuuta,
              shareholder.osaluse_protsent,
              shareholder.algus_kpv,
              shareholder.lopp_kpv
            ]);
            count++;
            
            if (batch.length >= 1000) {
              insertMany(batch);
              batch = [];
              if (count % 10000 === 0) {
                process.stdout.write(`\r  Imported ${count} shareholders...`);
              }
            }
          }
        }
      });
      
      pipeline.on('end', () => {
        if (batch.length > 0) {
          insertMany(batch);
        }
        console.log(`\n✅ Imported ${count} shareholders`);
        resolve();
      });
      
      pipeline.on('error', reject);
    });
  } catch (error) {
    console.log('⚠️  Error importing shareholders:', error.message);
  }
}

// Function to import beneficial owners from JSON
async function importBeneficialOwners() {
  console.log('\n📥 Importing beneficial owners from JSON...');
  
  const jsonPath = path.join(DATA_DIR, 'ettevotja_rekvisiidid__kasusaajad.json');
  
  // Check if file exists
  try {
    await fs.access(jsonPath);
  } catch {
    console.log('⚠️  Beneficial owners file not found, skipping...');
    return;
  }
  
  try {
    const streamJsonModule = await import('stream-json/streamers/StreamArray.js');
    const StreamArray = streamJsonModule.default;
    
    const pipeline = createReadStream(jsonPath)
      .pipe(StreamArray.withParser());
    
    const insertStmt = db.prepare(`
      INSERT INTO beneficial_owners (
        registry_code, owner_name, owner_type,
        control_type, control_percentage,
        start_date, end_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((items) => {
      for (const item of items) {
        insertStmt.run(...item);
      }
    });
    
    let count = 0;
    let batch = [];
    
    return new Promise((resolve, reject) => {
      pipeline.on('data', ({ value: company }) => {
        if (company.kasusaajad && Array.isArray(company.kasusaajad)) {
          for (const owner of company.kasusaajad) {
            batch.push([
              company.ariregistri_kood,
              owner.kasusaaja_nimi,
              owner.kasusaaja_tyyp,
              owner.kontrolli_tyyp,
              owner.kontrolli_protsent,
              owner.algus_kpv,
              owner.lopp_kpv
            ]);
            count++;
            
            if (batch.length >= 1000) {
              insertMany(batch);
              batch = [];
              if (count % 10000 === 0) {
                process.stdout.write(`\r  Imported ${count} beneficial owners...`);
              }
            }
          }
        }
      });
      
      pipeline.on('end', () => {
        if (batch.length > 0) {
          insertMany(batch);
        }
        console.log(`\n✅ Imported ${count} beneficial owners`);
        resolve();
      });
      
      pipeline.on('error', reject);
    });
  } catch (error) {
    console.log('⚠️  Error importing beneficial owners:', error.message);
  }
}

// Function to import registry cards from JSON
async function importRegistryCards() {
  console.log('\n📥 Importing registry cards from JSON...');
  
  const jsonPath = path.join(DATA_DIR, 'ettevotja_rekvisiidid__registrikaardid.json');
  
  // Check if file exists
  try {
    await fs.access(jsonPath);
  } catch {
    console.log('⚠️  Registry cards file not found, skipping...');
    return;
  }
  
  try {
    const streamJsonModule = await import('stream-json/streamers/StreamArray.js');
    const StreamArray = streamJsonModule.default;
    
    const pipeline = createReadStream(jsonPath)
      .pipe(StreamArray.withParser());
    
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO registry_cards (
        registry_code, card_type, card_data, last_updated
      ) VALUES (?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((items) => {
      for (const item of items) {
        insertStmt.run(...item);
      }
    });
    
    let count = 0;
    let batch = [];
    
    return new Promise((resolve, reject) => {
      pipeline.on('data', ({ value: card }) => {
        batch.push([
          card.ariregistri_kood,
          card.kaardi_tyyp || 'standard',
          JSON.stringify(card),
          card.viimati_muudetud || new Date().toISOString()
        ]);
        count++;
        
        if (batch.length >= 1000) {
          insertMany(batch);
          batch = [];
          if (count % 10000 === 0) {
            process.stdout.write(`\r  Imported ${count} registry cards...`);
          }
        }
      });
      
      pipeline.on('end', () => {
        if (batch.length > 0) {
          insertMany(batch);
        }
        console.log(`\n✅ Imported ${count} registry cards`);
        resolve();
      });
      
      pipeline.on('error', reject);
    });
  } catch (error) {
    console.log('⚠️  Error importing registry cards:', error.message);
  }
}

// Main import function
async function main() {
  try {
    // Import companies
    await importCompaniesFromCSV();
    
    // Import board members
    await importBoardMembers();
    
    // Import general data
    await importGeneralData();
    
    // Import shareholders
    await importShareholders();
    
    // Import beneficial owners
    await importBeneficialOwners();
    
    // Import registry cards
    await importRegistryCards();
    
    // Get statistics
    const stats = db.prepare('SELECT COUNT(*) as count FROM companies').get();
    const boardStats = db.prepare('SELECT COUNT(*) as count FROM board_members').get();
    const generalStats = db.prepare('SELECT COUNT(*) as count FROM company_general_data').get();
    const shareholderStats = db.prepare('SELECT COUNT(*) as count FROM shareholders').get();
    const beneficialStats = db.prepare('SELECT COUNT(*) as count FROM beneficial_owners').get();
    const cardStats = db.prepare('SELECT COUNT(*) as count FROM registry_cards').get();
    
    console.log('\n📊 Database Statistics:');
    console.log(`  - Companies: ${stats.count}`);
    console.log(`  - Board members: ${boardStats.count}`);
    console.log(`  - General data: ${generalStats.count}`);
    console.log(`  - Shareholders: ${shareholderStats.count}`);
    console.log(`  - Beneficial owners: ${beneficialStats.count}`);
    console.log(`  - Registry cards: ${cardStats.count}`);
    
    // Test query for Dominance
    console.log('\n🔍 Testing query for Dominance OÜ:');
    const dominance = db.prepare(`
      SELECT c.*, bm.first_name, bm.last_name, bm.role_text, bm.start_date
      FROM companies c
      LEFT JOIN board_members bm ON c.registry_code = bm.registry_code
      WHERE c.name LIKE '%Dominance%'
    `).all();
    
    console.log(`  Found: ${dominance.length} results`);
    if (dominance.length > 0) {
      console.log(`  Company: ${dominance[0].name}`);
      console.log(`  Board member: ${dominance[0].first_name} ${dominance[0].last_name} (${dominance[0].role_text})`);
    }
    
    console.log('\n✅ Database created successfully!');
    console.log(`📁 Location: ${DB_PATH}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();