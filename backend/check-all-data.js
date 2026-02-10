import mongoose from 'mongoose';
import User from './models/User.js';
import BotFlow from './models/BotFlow.js';
import Widget from './models/Widget.js';
import Option from './models/Option.js';

mongoose.connect('mongodb://127.0.0.1:27017/bots')
  .then(async () => {
    console.log('=== Database Check ===\n');
    
    // Check users
    const users = await User.find({});
    console.log('Total users:', users.length);
    users.forEach(user => {
      console.log(`  User: ${user.email}, ID: ${user._id}`);
    });
    
    // Check bot flows
    const flows = await BotFlow.find({});
    console.log('\nTotal BotFlows:', flows.length);
    flows.forEach(flow => {
      console.log(`  Flow: ${flow.name}, ID: ${flow._id}, user_id: ${flow.user_id}, is_default: ${flow.is_default}`);
    });
    
    // Check widgets (all)
    const widgets = await Widget.find({});
    console.log('\nTotal Widgets:', widgets.length);
    const flowIds = [...new Set(widgets.map(w => w.flow_id))];
    console.log('Unique flow_ids in widgets:', flowIds);
    
    // Group by type
    const byType = {};
    widgets.forEach(w => {
      byType[w.type] = (byType[w.type] || 0) + 1;
    });
    console.log('\nWidgets by type:', byType);
    
    // Show automatic_responses specifically
    const autoWidgets = await Widget.find({ type: 'automatic_responses' });
    console.log('\n=== Automatic Response Widgets ===');
    autoWidgets.forEach(w => {
      console.log(`Widget ID: ${w.id}, flow_id: ${w.flow_id}`);
    });
    
    // Check Options
    const options = await Option.find({});
    console.log('\nTotal Options:', options.length);
    
    process.exit();
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
