import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Widget from './models/Widget.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bots';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('=== Checking Image Widgets ===\n');
    
    const imageWidgets = await Widget.find({ type: 'output_image' });
    
    console.log(`Found ${imageWidgets.length} image widgets:\n`);
    
    imageWidgets.forEach(w => {
      console.log(`Widget ID: ${w.id}`);
      console.log(`Flow ID: ${w.flow_id}`);
      console.log(`Value: ${w.value}`);
      console.log(`Image URL (first 200 chars): ${(w.image_file?.url || '').substring(0, 200)}`);
      console.log('');
    });
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
