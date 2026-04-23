const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });
const User = require('./backend/models/user.model');

async function checkAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const admin = await User.findOne({ role: 'admin' });
    if (admin) {
      console.log('Admin found:');
      console.log({
        email: admin.email,
        role: admin.role,
        isAdmin: admin.isAdmin,
        emailVerified: admin.emailVerified
      });
    } else {
      console.log('No user with role "admin" found.');
      const allUsers = await User.find({}, 'email role isAdmin');
      console.log('All users:', allUsers);
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkAdmin();
