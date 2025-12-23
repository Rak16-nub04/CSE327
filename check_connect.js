const mongoose = require('mongoose');
require('dotenv').config();

console.log("Testing MongoDB connection...");

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ SUCCESS: Connection established!');
    console.log('Your IP is whitelisted and the database is accessible.');
    process.exit(0);
  })
  .catch((err) => {
    console.log('❌ ERROR: Connection failed.');
    console.log('Reason:', err.message);
    if (err.message.includes('SSL') || err.message.includes('buffering timed out')) {
        console.log('--> This usually means your IP is still NOT whitelisted.');
    }
    process.exit(1);
  });
