const axios = require('axios');

async function test() {
    try {
        const res = await axios.get('http://localhost:8001/api/auth/admin-exists');
        console.log("Admin Exists Status:", res.status);
        console.log("Response Data:", res.data);
    } catch (err) {
        console.error("Test Failed:");
        console.error("Status:", err.response?.status);
        console.error("Data:", err.response?.data);
    }
}

test();
