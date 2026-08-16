// Test script for the compound (AND/OR) TIME_ROUTING save/load + matching logic.
// Run with: node test-time-routing.js
import assert from 'assert';
import {
  serializeBranchConditions,
  reconstructTimeRoutingBranches,
  findMatchedBranchIndex
} from './utils/timeRouting.js';

// --- Scenario ---
// Branch 0: weekday Sun(0)-Thu(4) AND time 09:00-17:00
// Branch 1: weekday Fri(5)-Fri(5) AND time 09:00-12:00
// Default: everything else
const branch0Conditions = [
  { kind: 'weekday', fromDay: 0, toDay: 4 },
  { kind: 'time', fromHour: 9, fromMinute: 0, toHour: 17, toMinute: 0 }
];
const branch1Conditions = [
  { kind: 'weekday', fromDay: 5, toDay: 5 },
  { kind: 'time', fromHour: 9, fromMinute: 0, toHour: 12, toMinute: 0 }
];

const testNode = {
  id: 'test-time-routing-1',
  type: 'action_time_routing',
  position: { x: 100, y: 100 },
  data: {
    timeRoutingBranches: [
      { conditions: branch0Conditions },
      { conditions: branch1Conditions }
    ]
  }
};

const testEdges = [
  { source: testNode.id, sourceHandle: 'option-0', target: 'next-node-1' },
  { source: testNode.id, sourceHandle: 'option-1', target: 'next-node-2' },
  { source: testNode.id, sourceHandle: 'option-default', target: 'next-node-3' }
];

console.log('Test Node:', JSON.stringify(testNode, null, 2));
console.log('\nTest Edges:', JSON.stringify(testEdges, null, 2));

// --- 1. Save: each branch -> one Option row, operator 'compound_range' ---
const savedOptions = testNode.data.timeRoutingBranches.map((branch, i) => ({
  widget_id: testNode.id,
  value: serializeBranchConditions(branch.conditions),
  operator: 'compound_range',
  next: testEdges.find(e => e.sourceHandle === `option-${i}`)?.target || null
}));
savedOptions.push({
  widget_id: testNode.id,
  value: 'default',
  operator: 'default',
  next: testEdges.find(e => e.sourceHandle === 'option-default')?.target || null
});

console.log('\nSaved Options (DB rows):', JSON.stringify(savedOptions, null, 2));

// --- 2. Load: reconstruct timeRoutingBranches from the Option rows ---
const { timeRoutingBranches } = reconstructTimeRoutingBranches(savedOptions);
assert.deepStrictEqual(timeRoutingBranches, [
  { conditions: branch0Conditions },
  { conditions: branch1Conditions }
]);
console.log('\n✅ Round-trip save/load reconstructs identical branches');

// --- 3. Legacy compatibility: old time_range/date_range/weekday_range Option rows ---
const legacyOptions = [
  { widget_id: 'legacy-1', value: '8:0-16:0', operator: 'time_range', next: 'a' },
  { widget_id: 'legacy-1', value: '2026-01-01|2026-01-31', operator: 'date_range', next: 'b' },
  { widget_id: 'legacy-1', value: '0-4', operator: 'weekday_range', next: 'c' },
  { widget_id: 'legacy-1', value: 'default', operator: 'default', next: 'd' }
];
const legacyReconstructed = reconstructTimeRoutingBranches(legacyOptions);
assert.deepStrictEqual(legacyReconstructed.timeRoutingBranches, [
  { conditions: [{ kind: 'time', fromHour: 8, fromMinute: 0, toHour: 16, toMinute: 0 }] },
  { conditions: [{ kind: 'date', fromDate: '2026-01-01', toDate: '2026-01-31' }] },
  { conditions: [{ kind: 'weekday', fromDay: 0, toDay: 4 }] }
]);
console.log('✅ Legacy time_range/date_range/weekday_range rows parsed correctly');

// --- 4. Matching: findMatchedBranchIndex against a few simulated Israel-local times ---
const mkIsraelTime = (year, month, day, hour, minute) => new Date(year, month - 1, day, hour, minute);

// Tuesday 2026-01-06 at 10:00 -> should match branch 0 (Sun-Thu, 9-17)
assert.strictEqual(
  findMatchedBranchIndex(timeRoutingBranches, mkIsraelTime(2026, 1, 6, 10, 0)),
  0
);
// Friday 2026-01-09 at 10:00 -> should match branch 1 (Fri, 9-12)
assert.strictEqual(
  findMatchedBranchIndex(timeRoutingBranches, mkIsraelTime(2026, 1, 9, 10, 0)),
  1
);
// Friday 2026-01-09 at 14:00 -> weekday matches branch 1 but time doesn't (AND fails) -> falls to default
assert.strictEqual(
  findMatchedBranchIndex(timeRoutingBranches, mkIsraelTime(2026, 1, 9, 14, 0)),
  -1
);
// Saturday 2026-01-10 at 10:00 -> no branch's weekday matches -> falls to default
assert.strictEqual(
  findMatchedBranchIndex(timeRoutingBranches, mkIsraelTime(2026, 1, 10, 10, 0)),
  -1
);

console.log('✅ findMatchedBranchIndex: AND within a branch, OR across branches, all as expected');

console.log('\n✅ All time-routing tests passed');

