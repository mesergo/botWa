import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Widget from './models/Widget.js';
import Option from './models/Option.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bots';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('=== Checking "לילה" Flow ===\n');
    
    // Find the automatic_responses widget
    const autoWidget = await Widget.findOne({ id: 'auto-responses-1770287195002' });
    console.log('Automatic Responses Widget:');
    console.log('  ID:', autoWidget.id);
    console.log('  Flow ID:', autoWidget.flow_id);
    
    const options = await Option.find({ widget_id: autoWidget.id });
    const lilaOption = options.find(opt => opt.value === 'לילה');
    
    if (lilaOption) {
      console.log('\n"לילה" Option:');
      console.log('  Value:', lilaOption.value);
      console.log('  Next:', lilaOption.next);
      
      // Follow the chain
      if (lilaOption.next) {
        let currentId = lilaOption.next;
        let depth = 0;
        const maxDepth = 10;
        
        console.log('\n📍 Flow Chain:');
        
        while (currentId && depth < maxDepth) {
          const widget = await Widget.findOne({ id: currentId });
          if (!widget) {
            console.log(`  ${depth + 1}. ❌ Widget not found: ${currentId}`);
            break;
          }
          
          console.log(`  ${depth + 1}. [${widget.type}] ID: ${widget.id}`);
          console.log(`      Value: ${widget.value || '(none)'}`);
          if (widget.image_file) {
            console.log(`      Content: ${widget.image_file.content || '(none)'}`);
            console.log(`      Label: ${widget.image_file.label || '(none)'}`);
          }
          console.log(`      Next: ${widget.next || '(none)'}`);
          
          currentId = widget.next;
          depth++;
        }
      }
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
