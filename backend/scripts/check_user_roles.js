require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/user.model");

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const users = await User.find({ role: { $ne: 'user' } });
        console.log("Admins/Other Roles found:");
        users.forEach(u => {
            console.log(`- Email: ${u.email}, Role: '${u.role}'`);
        });
        await mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
}
check();
