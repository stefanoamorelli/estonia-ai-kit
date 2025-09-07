#!/usr/bin/env bun
import axios from 'axios';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const BASE_URL = 'https://avaandmed.ariregister.rik.ee';
const DATA_DIR = path.join(process.cwd(), '.rik-data');

const DATASETS = [
  {
    name: 'basic_data',
    file: 'ettevotja_rekvisiidid__lihtandmed.csv.zip',
    description: 'Basic company data (CSV)',
  },
  {
    name: 'general_data',
    file: 'ettevotja_rekvisiidid__yldandmed.json.zip',
    description: 'General company information (JSON)',
  },
  {
    name: 'board_members',
    file: 'ettevotja_rekvisiidid__kaardile_kantud_isikud.json.zip',
    description: 'Board members and representatives (JSON)',
  },
  {
    name: 'shareholders',
    file: 'ettevotja_rekvisiidid__osanikud.json.zip',
    description: 'Company shareholders (JSON)',
  },
  {
    name: 'beneficial_owners',
    file: 'ettevotja_rekvisiidid__kasusaajad.json.zip',
    description: 'Beneficial owners (JSON)',
  },
  {
    name: 'annual_reports',
    file: 'ettevotja_rekvisiidid__majandusaasta_aruanded.json.zip',
    description: 'Annual reports (JSON)',
  },
];

async function ensureDataDirectory() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log(`✅ Data directory created: ${DATA_DIR}`);
  } catch (error) {
    console.error('❌ Failed to create data directory:', error);
    process.exit(1);
  }
}

async function downloadFile(dataset) {
  const url = `${BASE_URL}/sites/default/files/avaandmed/${dataset.file}`;
  const zipPath = path.join(DATA_DIR, dataset.file);

  console.log(`\n📥 Downloading ${dataset.name}...`);
  console.log(`   URL: ${url}`);

  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 60000,
      headers: {
        'User-Agent': 'Estonia-AI-Kit/1.0',
      },
    });

    const totalSize = parseInt(response.headers['content-length'], 10);
    let downloadedSize = 0;

    response.data.on('data', (chunk) => {
      downloadedSize += chunk.length;
      const progress = ((downloadedSize / totalSize) * 100).toFixed(1);
      process.stdout.write(
        `\r   Progress: ${progress}% (${(downloadedSize / 1024 / 1024).toFixed(1)} MB)`
      );
    });

    const writer = createWriteStream(zipPath);
    await pipeline(response.data, writer);

    console.log(`\n   ✅ Downloaded: ${dataset.file}`);

    // Extract the zip file
    console.log(`   📦 Extracting...`);
    await execAsync(`unzip -o "${zipPath}" -d "${DATA_DIR}"`);
    console.log(`   ✅ Extracted successfully`);

    // Remove the zip file to save space
    await fs.unlink(zipPath);

    return true;
  } catch (error) {
    console.error(`\n   ❌ Failed to download ${dataset.name}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🇪🇪 Estonian Business Register Data Downloader');
  console.log('='.repeat(50));
  console.log('This script downloads open data files from RIK.');
  console.log('Data is updated daily at the source.\n');

  await ensureDataDirectory();

  const results = {
    success: [],
    failed: [],
  };

  for (const dataset of DATASETS) {
    const success = await downloadFile(dataset);
    if (success) {
      results.success.push(dataset.name);
    } else {
      results.failed.push(dataset.name);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Download Summary:');
  console.log(`   ✅ Successful: ${results.success.length}/${DATASETS.length}`);
  if (results.success.length > 0) {
    console.log(`      ${results.success.join(', ')}`);
  }
  if (results.failed.length > 0) {
    console.log(`   ❌ Failed: ${results.failed.length}`);
    console.log(`      ${results.failed.join(', ')}`);
  }

  console.log('\n💡 Data files are stored in:', DATA_DIR);
  console.log('📝 Add .rik-data to your .gitignore to avoid committing these files');

  // Create/update .gitignore if needed
  try {
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    let gitignoreContent = '';
    try {
      gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
    } catch {
      // File doesn't exist
    }

    if (!gitignoreContent.includes('.rik-data')) {
      gitignoreContent += '\n# RIK data files (downloaded via script)\n.rik-data/\n';
      await fs.writeFile(gitignorePath, gitignoreContent);
      console.log('✅ Added .rik-data to .gitignore');
    }
  } catch (error) {
    console.log('⚠️  Please add .rik-data/ to your .gitignore manually');
  }
}

main().catch(console.error);
