import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Widget from './models/Widget.js';
import Option from './models/Option.js';
import BotFlow from './models/BotFlow.js';
import User from './models/User.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bots';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    console.log('📊 Database:', mongoose.connection.name);
    console.log('🌐 Host:', mongoose.connection.host);
    console.log('\n=== Data Summary ===\n');
    
    // Check users
    const users = await User.find({});
    console.log(`👤 Users: ${users.length}`);
    users.forEach(u => console.log(`   - ${u.email} (token: ${u.tokens?.[0] || 'none'})`));
    
    // Check bot flows
    const flows = await BotFlow.find({});
    console.log(`\n🤖 Bot Flows: ${flows.length}`);
    flows.forEach(f => console.log(`   - ${f.name} (ID: ${f._id}, is_default: ${f.is_default})`));
    
    // Check widgets
    const widgets = await Widget.find({});
    console.log(`\n📦 Widgets: ${widgets.length}`);
    
    const byType = {};
    widgets.forEach(w => {
      byType[w.type] = (byType[w.type] || 0) + 1;
    });
    
    console.log('\n📊 Widgets by type:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}`);
    });
    
    // Check automatic_responses specifically
    const autoWidgets = await Widget.find({ type: 'automatic_responses' });
    console.log(`\n⚡ Automatic Response Widgets: ${autoWidgets.length}`);
    
    for (const widget of autoWidgets) {
      console.log(`\n   Widget ID: ${widget.id}`);
      console.log(`   Flow ID: ${widget.flow_id}`);
      console.log(`   Value: ${widget.value}`);
      
      const options = await Option.find({ widget_id: widget.id });
      console.log(`   Options (${options.length}):`);
      options.forEach((opt, i) => {
        console.log(`      ${i}: "${opt.value}" (operator: ${opt.operator}, next: ${opt.next})`);
      });
    }
    
    // Check options
    const allOptions = await Option.find({});
    console.log(`\n🔘 Total Options: ${allOptions.length}`);
    
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
