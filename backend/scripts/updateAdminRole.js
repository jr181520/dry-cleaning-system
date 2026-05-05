const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/dry_cleaning').then(async () => {
  const result = await mongoose.connection.db.collection('users').updateOne(
    {phone: '13900000001'},
    {$set: {roles: ['admin']}}
  );
  console.log('Updated:', result.modifiedCount);
  await mongoose.disconnect();
}).catch(console.error);
