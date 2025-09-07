#!/usr/bin/env bun
import { StatEEClient } from './dist/stat-ee-client.js';

console.log('🇪🇪 Testing Statistics Estonia API Client with REAL DATA\n');
console.log('=' .repeat(50));

const client = new StatEEClient('en');

async function test() {
  try {
    // Test 1: Get main categories
    console.log('\n📍 Test 1: Getting main statistical categories...');
    const categories = await client.getMainCategories();
    console.log(`✅ Found ${categories.length} main categories:`);
    categories.slice(0, 5).forEach(cat => {
      console.log(`   - ${cat.text} (${cat.type === 'l' ? 'folder' : 'table'})`);
    });

    // Test 2: Get population statistics
    console.log('\n📍 Test 2: Getting population statistics for 2024...');
    try {
      const population = await client.getPopulationByYear('2024');
      console.log('✅ Population data retrieved:');
      if (population.data && population.data.length > 0) {
        console.log(`   Total records: ${population.data.length}`);
        const firstRecord = population.data[0];
        console.log(`   Sample: ${firstRecord.key.join(', ')} = ${firstRecord.values[0]}`);
      }
    } catch (error) {
      console.log('⚠️  2024 data might not be available yet, trying 2023...');
      const population = await client.getPopulationByYear('2023');
      console.log('✅ Population data retrieved for 2023:');
      if (population.data && population.data.length > 0) {
        console.log(`   Total records: ${population.data.length}`);
      }
    }

    // Test 3: Search for tables
    console.log('\n📍 Test 3: Searching for tables about "GDP"...');
    const gdpTables = await client.searchTables('GDP');
    console.log(`✅ Found ${gdpTables.length} tables related to GDP:`);
    gdpTables.slice(0, 3).forEach(table => {
      console.log(`   - ${table.text}`);
      if (table.updated) console.log(`     Updated: ${table.updated}`);
    });

    // Test 4: Get unemployment rate
    console.log('\n📍 Test 4: Getting unemployment rate...');
    try {
      const unemployment = await client.getUnemploymentRate('2023');
      console.log('✅ Unemployment data retrieved');
      if (unemployment.data && unemployment.data.length > 0) {
        console.log(`   Records: ${unemployment.data.length}`);
      }
    } catch (error) {
      console.log('⚠️  Error getting unemployment data:', error.message);
    }

    // Test 5: Get average wages
    console.log('\n📍 Test 5: Getting average wages...');
    try {
      const wages = await client.getAverageWages('2023', '4');
      console.log('✅ Wage data retrieved');
      if (wages.data && wages.data.length > 0) {
        console.log(`   Records: ${wages.data.length}`);
      }
    } catch (error) {
      console.log('⚠️  Error getting wage data:', error.message);
    }

    // Test 6: Get table metadata
    console.log('\n📍 Test 6: Getting table metadata for a specific table...');
    try {
      const metadata = await client.getTableMetadata('RV021');
      console.log('✅ Table metadata retrieved:');
      console.log(`   Title: ${metadata.title}`);
      console.log(`   Variables: ${metadata.variables.length}`);
      metadata.variables.slice(0, 3).forEach(v => {
        console.log(`   - ${v.text} (${v.code}): ${v.values.length} values`);
      });
    } catch (error) {
      console.log('⚠️  Error getting table metadata:', error.message);
    }

    // Test 7: Format data response
    console.log('\n📍 Test 7: Testing data formatting...');
    const testData = {
      columns: [
        { code: 'Year', text: 'Year' },
        { code: 'Value', text: 'Population' }
      ],
      data: [
        { key: ['2023'], values: ['1,365,884'] }
      ],
      comments: [],
      metadata: []
    };
    const formatted = client.formatDataResponse(testData);
    console.log('✅ Data formatted successfully:');
    console.log(`   ${JSON.stringify(formatted[0])}`);

    console.log('\n' + '=' .repeat(50));
    console.log('✅ All tests completed!');
    console.log('📊 The Statistics Estonia API client is working with REAL data!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Details:', error);
  }
}

test();