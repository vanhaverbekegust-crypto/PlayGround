import test from 'node:test'
import assert from 'node:assert/strict'
import {
  angleDelta,
  circlesOverlap,
  circleVsCircleResolve,
  clamp,
  formatTime,
  normalizeAngle,
  placeSuffix,
  ranking,
  resolveCircleAABB,
  steerToward,
} from '../src/logic.js'

const close = (actual, expected, epsilon = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} !== ${expected}`)
}

test('clamp keeps values inside bounds', () => {
  assert.equal(clamp(5, 0, 10), 5)
  assert.equal(clamp(-2, 0, 10), 0)
  assert.equal(clamp(12, 0, 10), 10)
})

test('normalizeAngle wraps into (-PI, PI]', () => {
  close(normalizeAngle(0), 0)
  close(normalizeAngle(Math.PI * 2), 0)
  close(normalizeAngle(Math.PI * 2.5), Math.PI * 0.5)
  close(normalizeAngle(-Math.PI * 2.5), -Math.PI * 0.5)
})

test('angleDelta takes the shortest route across the wrap point', () => {
  close(angleDelta(3.0, -3.0), Math.PI * 2 - 6.0)
  close(angleDelta(-3.0, 3.0), -(Math.PI * 2 - 6.0))
  close(angleDelta(0.2, 0.5), 0.3)
})

test('steerToward clamps rotation and snaps when close', () => {
  close(steerToward(0, 1, 0.25), 0.25)
  close(steerToward(0, -1, 0.25), -0.25)
  close(steerToward(0.1, 0.2, 0.5), 0.2)
  close(steerToward(3.0, -3.0, 0.1), 3.1)
})

test('ranking sorts by kills, deaths, damage then id', () => {
  const entries = [
    { id: 3, kills: 2, deaths: 1, damage: 30 },
    { id: 1, kills: 2, deaths: 1, damage: 30 },
    { id: 2, kills: 2, deaths: 0, damage: 10 },
    { id: 4, kills: 5, deaths: 9, damage: 10 },
    { id: 5, kills: 2, deaths: 1, damage: 35 },
  ]
  assert.deepEqual(ranking(entries).map((entry) => entry.id), [4, 2, 5, 1, 3])
  assert.deepEqual(entries.map((entry) => entry.id), [3, 1, 2, 4, 5])
})

test('circlesOverlap handles touching and separated circles', () => {
  assert.equal(circlesOverlap(0, 0, 2, 3, 0, 1), true)
  assert.equal(circlesOverlap(0, 0, 2, 3.01, 0, 1), false)
})

test('resolveCircleAABB ignores distant circles', () => {
  assert.equal(resolveCircleAABB(0, 0, 1, 5, 8, 5, 8), null)
})

test('resolveCircleAABB pushes out of a face', () => {
  const hit = resolveCircleAABB(1.5, 0, 1, 2, 4, -2, 2)
  assert.ok(hit)
  assert.equal(hit.x, -1)
  assert.equal(hit.z, 0)
  close(hit.depth, 0.5)
})

test('resolveCircleAABB picks the nearest face when fully inside', () => {
  const hit = resolveCircleAABB(0.5, 0, 0.5, 0, 10, -1, 1)
  assert.ok(hit)
  assert.equal(hit.x, -1)
  assert.equal(hit.z, 0)
  close(hit.depth, 0.5 + 0.5)
})

test('circleVsCircleResolve separates overlapping circles', () => {
  const hit = circleVsCircleResolve(0, 0, 1, 1.5, 0, 1)
  assert.ok(hit)
  assert.equal(hit.x, -1)
  assert.equal(hit.z, 0)
  close(hit.depth, 0.5)
  assert.equal(circleVsCircleResolve(0, 0, 1, 3, 0, 1), null)
})

test('formatTime renders match clock', () => {
  assert.equal(formatTime(150), '2:30')
  assert.equal(formatTime(59.2), '1:00')
  assert.equal(formatTime(9), '0:09')
  assert.equal(formatTime(-4), '0:00')
})

test('placeSuffix handles teens and last digits', () => {
  assert.equal(placeSuffix(1), 'ST')
  assert.equal(placeSuffix(2), 'ND')
  assert.equal(placeSuffix(3), 'RD')
  assert.equal(placeSuffix(4), 'TH')
  assert.equal(placeSuffix(11), 'TH')
  assert.equal(placeSuffix(12), 'TH')
  assert.equal(placeSuffix(13), 'TH')
  assert.equal(placeSuffix(21), 'ST')
  assert.equal(placeSuffix(22), 'ND')
  assert.equal(placeSuffix(101), 'ST')
})
