const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('node:readline');
const User = require('../src/models/User.model');

const askConfirmation = (question) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
};

const run = async () => {
  const argv = process.argv.slice(2);
  const isReset = argv.includes('--reset');
  const [email, password, name] = argv.filter((a) => !a.startsWith('--'));

  if (!email || !password) {
    console.error('Usage: node scripts/createAdmin.js <email> <password> [name] [--reset]');
    console.error('  --reset  Deletes ALL existing admin accounts first (password-recovery path).');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  // SECURITY CHECK: Prevent multiple admins if limit is reached
  const adminCount = await User.countDocuments();
  if (adminCount >= 1 && !isReset) {
    console.error(
      `An admin account already exists (${adminCount} found). This script only allows exactly one admin.\n` +
        'If you are recovering a lost password, re-run with --reset to DELETE the existing admin\n' +
        'account(s) and create a fresh one:\n' +
        `  node scripts/createAdmin.js ${email} <new-password> [name] --reset`
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  if (adminCount >= 1 && isReset) {
    const answer = await askConfirmation(
      `WARNING: This will PERMANENTLY DELETE ${adminCount} existing admin account(s) and create ` +
        `a new one with email "${email}". This cannot be undone. Type "yes" to continue: `
    );
    if (answer !== 'yes') {
      console.log('Aborted. No changes made.');
      await mongoose.disconnect();
      process.exit(0);
    }
    await User.deleteMany({});
    console.log(`Deleted ${adminCount} existing admin account(s).`);
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    console.error(`An admin with email ${email} already exists.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const admin = await User.create({
    name: name || 'Store Admin',
    email,
    password,
  });

  console.log(`Admin account created successfully: ${admin.email} (id: ${admin._id})`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('Failed to create admin:', err.message);
  process.exit(1);
});