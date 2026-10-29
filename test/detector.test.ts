import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SilenceDetector, thresholdSeconds } from '../src/detector'

import { FakeClock } from './helpers'

function setup () {
    const clock = new FakeClock()
    let notifications = 0
    const detector = new SilenceDetector(() => notifications++, 5, true, clock)
    return { clock, detector, count: () => notifications }
}

test('first output starts timer; no notification before activity', () => {
    const { clock, detector, count } = setup()
    clock.tick(10000); assert.equal(count(), 0)
    detector.activity(); clock.tick(4999); assert.equal(count(), 0)
    clock.tick(1); assert.equal(count(), 1)
})
test('subsequent output resets timer; continuous silence notifies once; output rearms', () => {
    const { clock, detector, count } = setup()
    detector.activity(); clock.tick(4000); detector.activity()
    clock.tick(4999); assert.equal(count(), 0)
    clock.tick(1); assert.equal(count(), 1)
    clock.tick(100000); assert.equal(count(), 1)
    detector.activity(); clock.tick(5000); assert.equal(count(), 2)
})
test('multiple sessions are independent', () => {
    const a = setup(); const b = new SilenceDetector(() => hits++, 5, true, a.clock)
    let hits = 0
    a.detector.activity(); a.clock.tick(3000); b.activity()
    a.clock.tick(2000); assert.equal(a.count(), 1); assert.equal(hits, 0)
    a.clock.tick(3000); assert.equal(hits, 1)
})
test('disable cancels; enable waits for new output', () => {
    const { clock, detector, count } = setup()
    detector.activity(); detector.setEnabled(false)
    assert.equal(clock.tasks.size, 0)
    detector.activity(); clock.tick(5000); assert.equal(count(), 0)
    detector.setEnabled(true); clock.tick(5000); assert.equal(count(), 0)
    detector.activity(); clock.tick(5000); assert.equal(count(), 1)
})
test('dispose releases timer and prevents future notifications', () => {
    const { clock, detector, count } = setup()
    detector.activity(); detector.dispose(); detector.dispose(); detector.activity()
    assert.equal(clock.tasks.size, 0); clock.tick(5000); assert.equal(count(), 0)
})
test('threshold validation and updates', () => {
    assert.deepEqual([undefined, NaN, Infinity, '2', 0, 4000].map(thresholdSeconds), [5,5,5,5,1,3600])
    const { clock, detector, count } = setup()
    detector.setThreshold(1); clock.tick(2000); assert.equal(count(), 0)
    detector.activity(); clock.tick(1000); assert.equal(count(), 1)
    detector.setThreshold(2); clock.tick(5000); assert.equal(count(), 1)
})
