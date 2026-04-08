const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
const dotenv = require('dotenv');

// Load env from the same path as server.js
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });
const User = require('./backend/models/user.model');

async function check() {
  try {
    console.log('Connecting to:', process.env.MONGO_URI.replace(/:([^:@]+)@/, ':****@'));
    await mongoose.connect(process.env.MONGO_URI);
    
    const email = 'karanyadav.hack.dev@gmail.com';
    const password = 'Karan@1234';
    
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      console.error('ERROR: User not found in DB');
      process.exit(1);
    }
    
    console.log('User found. Role:', user.role);
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password Match Result:', isMatch);
    
    if (isMatch) {
      console.log('SUCCESS: Credentials are valid in the current database.');
    } else {
      console.error('FAILURE: Stored hash does NOT match "Karan@1234"');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('CRITICAL ERROR:', err);
    process.exit(1);
  }
}

check();
