// Test script for TIME_ROUTING save/load
// Run with: node test-time-routing.js

const testTimeRoutingNode = {
  id: 'test-time-routing-1',
  type: 'action_time_routing',
  position: { x: 100, y: 100 },
  data: {
    timeRanges: [
      { fromHour: 8, toHour: 16 },
      { fromHour: 16, toHour: 20 }
    ]
  }
};

const testEdges = [
  { source: 'test-time-routing-1', sourceHandle: 'option-0', target: 'next-node-1' },
  { source: 'test-time-routing-1', sourceHandle: 'option-1', target: 'next-node-2' },
  { source: 'test-time-routing-1', sourceHandle: 'option-default', target: 'next-node-3' }
];

console.log('Test Node:', JSON.stringify(testTimeRoutingNode, null, 2));
console.log('\nTest Edges:', JSON.stringify(testEdges, null, 2));

// Expected Options to be saved:
const expectedOptions = [
  { widget_id: 'test-time-routing-1', value: '8-16', operator: 'time_range', next: 'next-node-1' },
  { widget_id: 'test-time-routing-1', value: '16-20', operator: 'time_range', next: 'next-node-2' },
  { widget_id: 'test-time-routing-1', value: 'default', operator: 'default', next: 'next-node-3' }
];

console.log('\nExpected Options in DB:', JSON.stringify(expectedOptions, null, 2));

// When loading back:
const loadedTimeRanges = expectedOptions
  .filter(o => o.operator === 'time_range')
  .map(o => {
    const [fromHour, toHour] = o.value.split('-').map(Number);
    return { fromHour, toHour };
  });

console.log('\nLoaded timeRanges:', JSON.stringify(loadedTimeRanges, null, 2));

// Reconstructed edges:
const reconstructedEdges = [];
let timeRangeIndex = 0;
expectedOptions.forEach(o => {
  if (o.next) {
    const sourceHandle = o.operator === 'default' ? 'option-default' : `option-${timeRangeIndex}`;
    reconstructedEdges.push({ source: o.widget_id, sourceHandle, target: o.next });
    if (o.operator === 'time_range') timeRangeIndex++;
  } else if (o.operator === 'time_range') {
    timeRangeIndex++;
  }
});

console.log('\nReconstructed Edges:', JSON.stringify(reconstructedEdges, null, 2));

console.log('\n✅ Test completed - verify edges match original!');
