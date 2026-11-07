#!/usr/bin/env node
// Create fixed demo logins and a small amount of demo data on the Elpis staging DB.
// Usage:
//   DEMO_STAFF_PASSWORD='...' DEMO_CLIENT_PASSWORD='...' node scripts/seed_demo_accounts.mjs
// Refuses production and any database other than the Elpis staging database.
import { execFileSync } from 'node:child_process';
import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DATABASE = 'elpis-property-staging-db';
const STAFF_PASSWORD = process.env.DEMO_STAFF_PASSWORD || '';
const CLIENT_PASSWORD = process.env.DEMO_CLIENT_PASSWORD || '';

if (process.argv.some(arg => /production|prod/i.test(arg))) {
  console.error('Refusing to run against production.');
  process.exit(1);
}
if (STAFF_PASSWORD.length < 10 || CLIENT_PASSWORD.length < 10) {
  console.error('Set DEMO_STAFF_PASSWORD and DEMO_CLIENT_PASSWORD (minimum 10 characters).');
  process.exit(1);
}

function hashPassword(password) {
  const salt = randomBytes(16);
  const dk = pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  return `pbkdf2$100000$${salt.toString('base64')}$${dk.toString('base64')}`;
}
function q(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

const staff = [
  { key: 'superadmin', role: 'Super Admin', name: 'Elpis Demo Super Admin', branch: 'Head Office', manager: null, commission: 0 },
  { key: 'md', role: 'Managing Director', name: 'Elpis Demo Managing Director', branch: 'Head Office', manager: null, commission: 1 },
  { key: 'bm', role: 'Branch Manager', name: 'Elpis Demo Branch Manager', branch: 'Branch 1', manager: 'md', commission: 1 },
  { key: 'tl', role: 'Team Lead', name: 'Elpis Demo Team Lead', branch: 'Branch 1', manager: 'bm', commission: 1 },
  { key: 'marketer', role: 'Marketer', name: 'Elpis Demo Marketer', branch: 'Branch 1', manager: 'tl', commission: 1 },
  { key: 'finance', role: 'Finance Officer', name: 'Elpis Demo Finance Officer', branch: 'Head Office', manager: 'md', commission: 1 },
  { key: 'headaccountant', role: 'Head Accountant', name: 'Elpis Demo Head Accountant', branch: 'Head Office', manager: 'md', commission: 1 },
  { key: 'care', role: 'Customer Care', name: 'Elpis Demo Customer Care', branch: 'Branch 1', manager: 'md', commission: 0, careScope: 'national' },
  { key: 'pm', role: 'Project Manager', name: 'Elpis Demo Project Manager', branch: 'Head Office', manager: 'md', commission: 0 }
];

const staffHash = hashPassword(STAFF_PASSWORD);
const clientHash = hashPassword(CLIENT_PASSWORD);
const emailFor = key => `demo.${key}@elpisproperty.org`;
const idFor = key => `(SELECT id FROM users WHERE email=${q(emailFor(key))})`;

const statements = [];
statements.push('PRAGMA foreign_keys = ON');

for (const account of staff) {
  const managerSql = account.manager ? idFor(account.manager) : 'NULL';
  statements.push(`
INSERT INTO users (email, password_hash, full_name, role_id, branch_id, is_active, is_test,
  test_expires_at, access_valid_until, manager_id, commission_access, care_scope, reactivated_at)
VALUES (${q(emailFor(account.key))}, ${q(staffHash)}, ${q(account.name)},
  (SELECT id FROM roles WHERE name=${q(account.role)}),
  (SELECT id FROM branches WHERE name=${q(account.branch)}),
  1, 1, datetime('now','+90 days'), date('now','+1 year'), ${managerSql},
  ${account.commission}, ${q(account.careScope || null)}, datetime('now'))
ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash,
  full_name=excluded.full_name, role_id=excluded.role_id, branch_id=excluded.branch_id,
  is_active=1, is_test=1, test_expires_at=excluded.test_expires_at,
  access_valid_until=excluded.access_valid_until, manager_id=excluded.manager_id,
  commission_access=excluded.commission_access, care_scope=excluded.care_scope,
  deactivated_at=NULL, reactivated_at=datetime('now')`);
}

// Client portal login.
statements.push(`
INSERT INTO users (email, password_hash, full_name, role_id, branch_id, is_active, is_test,
  test_expires_at, access_valid_until, reactivated_at)
VALUES (${q(emailFor('client'))}, ${q(clientHash)}, 'Elpis Demo Client',
  (SELECT id FROM roles WHERE name='Client'), (SELECT id FROM branches WHERE name='Branch 1'),
  1, 1, datetime('now','+90 days'), date('now','+1 year'), datetime('now'))
ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash,
  full_name=excluded.full_name, role_id=excluded.role_id, branch_id=excluded.branch_id,
  is_active=1, is_test=1, test_expires_at=excluded.test_expires_at,
  access_valid_until=excluded.access_valid_until, deactivated_at=NULL, reactivated_at=datetime('now')`);

// Branch 1 demo team.
statements.push(`
INSERT INTO teams (name, branch_id, team_lead_user_id, is_active)
SELECT 'Elpis Demo Team', (SELECT id FROM branches WHERE name='Branch 1'), ${idFor('tl')}, 1
WHERE NOT EXISTS (SELECT 1 FROM teams WHERE name='Elpis Demo Team')`);
statements.push(`
INSERT OR IGNORE INTO team_members (team_id, user_id)
SELECT t.id, u.id FROM teams t, users u
WHERE t.name='Elpis Demo Team'
  AND u.email IN (${q(emailFor('tl'))}, ${q(emailFor('marketer'))})`);

// Demo properties.
const properties = [
  { reference: 'ELP-DEMO-RES-001', title: 'Elpis Garden Residences', category: 'Residential', type: 'Terrace', city: 'Lekki', state: 'Lagos', address: 'Demonstration address, Lekki', price: 25000000, bedrooms: 4, bathrooms: 4, land: '450 sqm' },
  { reference: 'ELP-DEMO-LAND-001', title: 'Elpis Prime Land Estate', category: 'Land', type: 'Residential Land', city: 'Ibeju-Lekki', state: 'Lagos', address: 'Demonstration address, Ibeju-Lekki', price: 12000000, bedrooms: 0, bathrooms: 0, land: '600 sqm' }
];
for (const property of properties) {
  statements.push(`
INSERT INTO properties (reference, title, description, category_id, property_type, sale_price,
  currency, state, city, address, branch_id, land_size, bedrooms, bathrooms, features, status,
  is_featured, is_published, created_by, updated_by)
VALUES (${q(property.reference)}, ${q(property.title)},
  'Demonstration listing for the Elpis staging environment. Not a real property offer.',
  (SELECT id FROM property_categories WHERE name=${q(property.category)}), ${q(property.type)},
  ${property.price}, 'NGN', ${q(property.state)}, ${q(property.city)}, ${q(property.address)},
  (SELECT id FROM branches WHERE name='Branch 1'), ${q(property.land)}, ${property.bedrooms},
  ${property.bathrooms}, '["Verified title","Flexible payment plan","Inspection available"]',
  'Available', 1, 1, ${idFor('md')}, ${idFor('md')})
ON CONFLICT(reference) DO UPDATE SET title=excluded.title, description=excluded.description,
  category_id=excluded.category_id, property_type=excluded.property_type,
  sale_price=excluded.sale_price, state=excluded.state, city=excluded.city,
  address=excluded.address, branch_id=excluded.branch_id, land_size=excluded.land_size,
  bedrooms=excluded.bedrooms, bathrooms=excluded.bathrooms, status='Available',
  is_featured=excluded.is_featured, is_published=1, updated_by=excluded.updated_by,
  updated_at=datetime('now')`);
}

// Demo client + allocation + finances. Rebuild transactional demo rows on each run.
statements.push(`
INSERT INTO clients (client_reference, full_name, phone_number, email_address, residential_address,
  state, city, next_of_kin, status, assigned_branch_id, created_by, original_marketer_id, team_lead_id,
  agreed_purchase_price, interested_property_id, user_id, sale_type, verification_status)
VALUES ('ELP-DEMO-CLIENT', 'Elpis Demo Client', '08030000001', ${q(emailFor('client'))},
  'Demo residential address', 'Lagos', 'Lekki', 'Demo Next of Kin (08030000002)', 'Active Buyer',
  (SELECT id FROM branches WHERE name='Branch 1'), ${idFor('md')}, ${idFor('marketer')}, ${idFor('tl')},
  25000000, (SELECT id FROM properties WHERE reference='ELP-DEMO-RES-001'), ${idFor('client')},
  'New Sale', 'Verified')
ON CONFLICT(client_reference) DO UPDATE SET full_name=excluded.full_name,
  phone_number=excluded.phone_number, email_address=excluded.email_address,
  residential_address=excluded.residential_address, state=excluded.state, city=excluded.city,
  next_of_kin=excluded.next_of_kin, status='Active Buyer', assigned_branch_id=excluded.assigned_branch_id,
  original_marketer_id=excluded.original_marketer_id, team_lead_id=excluded.team_lead_id,
  agreed_purchase_price=excluded.agreed_purchase_price,
  interested_property_id=excluded.interested_property_id, user_id=excluded.user_id,
  is_deleted=0, updated_at=datetime('now')`);

const clientId = `(SELECT id FROM clients WHERE client_reference='ELP-DEMO-CLIENT')`;
statements.push(`DELETE FROM receipts WHERE client_id=${clientId}`);
statements.push(`DELETE FROM payments WHERE client_id=${clientId}`);
statements.push(`DELETE FROM payment_schedule_history WHERE schedule_id IN (SELECT id FROM payment_schedules WHERE client_id=${clientId})`);
statements.push(`DELETE FROM payment_schedules WHERE client_id=${clientId}`);
statements.push(`DELETE FROM notifications WHERE client_id=${clientId}`);
statements.push(`DELETE FROM client_properties WHERE client_id=${clientId}`);
statements.push(`DELETE FROM leads WHERE lead_reference LIKE 'ELP-DEMO-LEAD-%'`);

statements.push(`
INSERT INTO client_properties (client_id, property_id, agreed_purchase_price, status)
VALUES (${clientId}, (SELECT id FROM properties WHERE reference='ELP-DEMO-RES-001'), 25000000, 'Active')`);

// Verified payment + receipt.
statements.push(`
INSERT INTO payments (client_id, property_id, transaction_ref, amount, currency, method, status,
  amount_kobo, is_demo, verified_at, verified_by, created_at)
VALUES (${clientId}, (SELECT id FROM properties WHERE reference='ELP-DEMO-RES-001'),
  'ELP-DEMO-TX-001', 5000000, 'NGN', 'Bank Transfer', 'verified', 500000000, 0,
  datetime('now','-2 days'), ${idFor('finance')}, datetime('now','-2 days'))`);
statements.push(`
INSERT INTO receipts (payment_id, client_id, receipt_ref, amount, currency, amount_kobo,
  remaining_balance_kobo, is_demo, created_at)
VALUES ((SELECT id FROM payments WHERE transaction_ref='ELP-DEMO-TX-001'), ${clientId},
  'RCP-DEMO-0001', 5000000, 'NGN', 500000000, 2000000000, 0, datetime('now','-2 days'))`);

// Pending payment awaiting reconciliation.
statements.push(`
INSERT INTO payments (client_id, property_id, transaction_ref, amount, currency, method, status,
  amount_kobo, is_demo, created_at)
VALUES (${clientId}, (SELECT id FROM properties WHERE reference='ELP-DEMO-RES-001'),
  'ELP-DEMO-TX-002', 1500000, 'NGN', 'Bank Transfer', 'pending', 150000000, 0, datetime('now','-3 hours'))`);

// Monthly instalment plan.
statements.push(`
INSERT INTO payment_schedules (client_id, property_id, total_amount, total_kobo, deposit_amount,
  deposit_kobo, installment_amount, installment_kobo, frequency_days, next_due_date, status,
  notes, created_by, created_at, updated_at)
VALUES (${clientId}, (SELECT id FROM properties WHERE reference='ELP-DEMO-RES-001'),
  25000000, 2500000000, 5000000, 500000000, 2000000, 200000000, 30, date('now','+15 days'),
  'active', 'Demo payment plan for staging', ${idFor('finance')}, datetime('now'), datetime('now'))`);

statements.push(`
INSERT INTO notifications (client_id, user_id, type, title, message, is_read, created_at)
VALUES (${clientId}, ${idFor('client')}, 'payment.verified', 'Official Receipt Issued',
  'Your payment of NGN 5,000,000 has been verified. Official Receipt RCP-DEMO-0001 is ready.',
  0, datetime('now','-2 days'))`);
statements.push(`
INSERT INTO notifications (client_id, user_id, type, title, message, is_read, created_at)
VALUES (${clientId}, ${idFor('client')}, 'payment.pending', 'Payment Awaiting Verification',
  'We received your payment notice for NGN 1,500,000 (Ref: ELP-DEMO-TX-002). Finance is reconciling it.',
  0, datetime('now','-3 hours'))`);

// Demo leads for the staff pipeline.
const leads = [
  ['ELP-DEMO-LEAD-001', 'Demo Hot Lead', 'Hot', 'Contacted', 25000000],
  ['ELP-DEMO-LEAD-002', 'Demo Warm Lead', 'Warm', 'Interested', 12000000],
  ['ELP-DEMO-LEAD-003', 'Demo Cold Lead', 'Cold', 'New Lead', 18000000]
];
for (const [reference, name, temperature, status, value] of leads) {
  statements.push(`
INSERT INTO leads (lead_reference, full_name, phone_number, email_address, source, status,
  property_id, assigned_marketer_id, team_lead_id, branch_id, estimated_value_kobo,
  lead_temperature, temperature_updated_at, next_follow_up_date, created_by, is_demo)
VALUES (${q(reference)}, ${q(name)}, '08039000${reference.slice(-3)}', ${q(reference.toLowerCase() + '@example.com')},
  'Demo seed', ${q(status)}, (SELECT id FROM properties WHERE reference='ELP-DEMO-RES-001'),
  ${idFor('marketer')}, ${idFor('tl')}, (SELECT id FROM branches WHERE name='Branch 1'),
  ${value * 100}, ${q(temperature)}, datetime('now'), date('now','+3 days'), ${idFor('marketer')}, 0)`);
}

const sql = statements.join(';\n') + ';\n';
const file = join(tmpdir(), `elpis-demo-seed-${Date.now()}.sql`);
writeFileSync(file, sql);
try {
  execFileSync('npx', ['wrangler', 'd1', 'execute', DATABASE, '--remote', '--file', file], {
    stdio: ['ignore', 'inherit', 'inherit']
  });
} finally {
  unlinkSync(file);
}

console.log('\nDEMO LOGINS CREATED\n');
console.log('Portal'.padEnd(18), 'Email'.padEnd(42), 'Password');
console.log('-'.repeat(100));
console.log('Staff / Admin'.padEnd(18), emailFor('md').padEnd(42), STAFF_PASSWORD);
for (const account of staff) {
  console.log(account.role.padEnd(18), emailFor(account.key).padEnd(42), STAFF_PASSWORD);
}
console.log('Client Portal'.padEnd(18), emailFor('client').padEnd(42), CLIENT_PASSWORD);
console.log('\nStaff login:  /login.html');
console.log('Client login: /client-login.html');
