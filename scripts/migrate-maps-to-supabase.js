#!/usr/bin/env node

/**
 * One-time migration script: uploads area map images from the
 * vergeside-maps repo to Supabase Storage (area-maps bucket).
 *
 * Usage:
 *   node scripts/migrate-maps-to-supabase.js
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_KEY in .env
 * (or set as environment variables).
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const MAPS_DIR = path.resolve(__dirname, '../../vergeside-maps');
const BUCKET = 'area-maps';

async function main() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceKey) {
        console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment.');
        process.exit(1);
    }

    if (!fs.existsSync(MAPS_DIR)) {
        console.error(`Maps directory not found: ${MAPS_DIR}`);
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all PNG files (skip subdirectories like "original/")
    const files = fs.readdirSync(MAPS_DIR)
        .filter(f => f.endsWith('.png') && fs.statSync(path.join(MAPS_DIR, f)).isFile());

    console.log(`Found ${files.length} PNG files in ${MAPS_DIR}`);

    let uploaded = 0;
    let failed = 0;
    const failures = [];

    for (const file of files) {
        const filePath = path.join(MAPS_DIR, file);
        const fileBuffer = fs.readFileSync(filePath);

        const { error } = await supabase.storage
            .from(BUCKET)
            .upload(file, fileBuffer, {
                contentType: 'image/png',
                upsert: true
            });

        if (error) {
            console.error(`  FAIL: ${file} — ${error.message}`);
            failed++;
            failures.push(file);
        } else {
            uploaded++;
            if (uploaded % 20 === 0) {
                console.log(`  Uploaded ${uploaded}/${files.length}...`);
            }
        }
    }

    console.log('\n--- Migration Complete ---');
    console.log(`Uploaded: ${uploaded}`);
    console.log(`Failed:   ${failed}`);
    if (failures.length > 0) {
        console.log('Failed files:', failures.join(', '));
    }
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
