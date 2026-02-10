import mongoose from 'mongoose';
import Option from './models/Option.js';

async function updateOption() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/bots');
    console.log('✅ Connected to MongoDB');

    // Find the option with value "יום"
    const oldOption = await Option.findOne({ value: 'יום' });
    
    if (!oldOption) {
      console.log('❌ Option with value "יום" not found');
      const allOptions = await Option.find({});
      console.log('All options:', allOptions.map(o => ({ id: o._id.toString(), value: o.value, widget_id: o.widget_id })));
      return;
    }

    console.log('Found option:', {
      id: oldOption._id.toString(),
      value: oldOption.value,
      operator: oldOption.operator,
      widget_id: oldOption.widget_id,
      next: oldOption.next
    });

    // Update to "לילה"
    oldOption.value = 'לילה';
    await oldOption.save();
    
    console.log('✅ Updated option value from "יום" to "לילה"');
    
    // Verify update
    const updated = await Option.findById(oldOption._id);
    console.log('Updated option:', {
      value: updated.value,
      operator: updated.operator
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

updateOption();
