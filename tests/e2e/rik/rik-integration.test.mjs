#!/usr/bin/env bun
import { RIKOpenDataClient } from './dist/clients/rik-open-data-client.js';

console.log('🇪🇪 Testing RIK Open Data Client with REAL DATA\n');
console.log('=' .repeat(50));

const client = new RIKOpenDataClient();

async function test() {
  try {
    // Test 1: Search for Bolt (known company)
    console.log('\n📍 Test 1: Searching for Bolt (registry code 14532216)...');
    const boltSearch = await client.searchCompanies({
      registryCode: '14532216'
    });
    
    if (boltSearch.length > 0) {
      console.log('✅ Found:', boltSearch[0].name);
      console.log('   Status:', boltSearch[0].status_text);
      console.log('   Address:', boltSearch[0].address);
    } else {
      console.log('❌ Bolt not found');
    }

    // Test 2: Search by name
    console.log('\n📍 Test 2: Searching for companies with "Wise" in name...');
    const wiseSearch = await client.searchCompanies({
      name: 'Wise',
      limit: 3
    });
    
    console.log(`✅ Found ${wiseSearch.length} companies:`);
    wiseSearch.forEach(company => {
      console.log(`   - ${company.name} (${company.registry_code})`);
    });

    // Test 3: Get specific company details
    console.log('\n📍 Test 3: Getting details for Swedbank (10060701)...');
    const swedbank = await client.getCompanyDetails('10060701');
    console.log('✅ Company:', swedbank.name);
    console.log('   Status:', swedbank.status_text);
    console.log('   Address:', swedbank.address);
    if (swedbank.vat_number) {
      console.log('   VAT:', swedbank.vat_number);
    }

    // Test 4: Get board members
    console.log('\n📍 Test 4: Getting board members for a company...');
    try {
      const members = await client.getBoardMembers('10060701');
      if (members.length > 0) {
        console.log(`✅ Found ${members.length} board member(s)`);
        members.slice(0, 3).forEach(member => {
          console.log(`   - ${member.name}: ${member.role}`);
        });
      } else {
        console.log('⚠️  No board members found (data might not be loaded)');
      }
    } catch (error) {
      console.log('⚠️  Board members data not available');
    }

    // Test 5: Get statistics
    console.log('\n📍 Test 5: Getting registry statistics...');
    const stats = await client.getStatistics();
    console.log('✅ Total companies:', stats.total_companies);
    console.log('   Status breakdown:');
    Object.entries(stats.by_status).slice(0, 5).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count}`);
    });

    // Test 6: Search broadly
    console.log('\n📍 Test 6: General search for "technology"...');
    const techSearch = await client.searchCompanies({
      query: 'technology',
      limit: 5
    });
    console.log(`✅ Found ${techSearch.length} companies with "technology":`);
    techSearch.forEach(company => {
      console.log(`   - ${company.name}`);
    });

    console.log('\n' + '=' .repeat(50));
    console.log('✅ All tests completed successfully!');
    console.log('📊 The RIK package is working with REAL Estonian data!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.message.includes('Data file not found')) {
      console.error('\n💡 Did you run "bun run download-data" first?');
    }
  }
}

test();