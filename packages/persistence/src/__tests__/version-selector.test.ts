import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveVersionSelection, type SavedVersionItem } from '../utils/version-selector.js';

describe('HELIOS Phase 10: Semantic Diff Version Selector State Management', () => {
  const versions: SavedVersionItem[] = [
    { id: 'ver-1-0-0', version: 'v1.0.0', apiName: 'Store API', projectName: 'ECommerce' },
    { id: 'ver-1-1-0', version: 'v1.1.0', apiName: 'Store API', projectName: 'ECommerce' },
    { id: 'ver-1-2-0', version: 'v1.2.0', apiName: 'Store API', projectName: 'ECommerce' },
  ];

  it('1. Initial Load: should default Base to v1.0.0 and Target to v1.1.0', () => {
    const state = resolveVersionSelection(versions);
    assert.equal(state.baseVersionId, 'ver-1-0-0', 'Base should default to first version (v1.0.0)');
    assert.equal(state.targetVersionId, 'ver-1-1-0', 'Target should default to second version (v1.1.0)');
    assert.equal(state.canCompare, true, 'Comparison should be enabled');
  });

  it('2. Target Selection: selecting newest v1.2.0 must remain selected after state update/re-render', () => {
    // Initial state
    const initial = resolveVersionSelection(versions);
    assert.equal(initial.targetVersionId, 'ver-1-1-0');

    // User selects v1.2.0 as Target
    const userSelectedTarget = 'ver-1-2-0';
    const userSelectedBase = initial.baseVersionId; // 'ver-1-0-0'

    // Component re-renders / re-evaluates with previous state
    const afterRerender = resolveVersionSelection(versions, userSelectedBase, userSelectedTarget);
    assert.equal(
      afterRerender.targetVersionId,
      'ver-1-2-0',
      'Target selection must remain v1.2.0 and NOT revert to older version'
    );
    assert.equal(afterRerender.baseVersionId, 'ver-1-0-0');
    assert.equal(afterRerender.canCompare, true);

    // Simulate multiple re-renders
    const subsequentRender = resolveVersionSelection(
      versions,
      afterRerender.baseVersionId,
      afterRerender.targetVersionId
    );
    assert.equal(subsequentRender.targetVersionId, 'ver-1-2-0');
    assert.equal(subsequentRender.baseVersionId, 'ver-1-0-0');
    assert.equal(subsequentRender.canCompare, true);
  });

  it('3. Specific Transitions: v1.0.0 -> v1.2.0 and v1.1.0 -> v1.2.0', () => {
    // Pair: v1.0.0 -> v1.2.0
    const pair1 = resolveVersionSelection(versions, 'ver-1-0-0', 'ver-1-2-0');
    assert.equal(pair1.baseVersionId, 'ver-1-0-0');
    assert.equal(pair1.targetVersionId, 'ver-1-2-0');
    assert.equal(pair1.canCompare, true);

    // Pair: v1.1.0 -> v1.2.0
    const pair2 = resolveVersionSelection(versions, 'ver-1-1-0', 'ver-1-2-0');
    assert.equal(pair2.baseVersionId, 'ver-1-1-0');
    assert.equal(pair2.targetVersionId, 'ver-1-2-0');
    assert.equal(pair2.canCompare, true);
  });

  it('4. All Pairwise Comparisons: any two different persisted versions must be selectable', () => {
    const validPairs = [
      { base: 'ver-1-0-0', target: 'ver-1-1-0', label: 'v1.0.0 -> v1.1.0' },
      { base: 'ver-1-0-0', target: 'ver-1-2-0', label: 'v1.0.0 -> v1.2.0' },
      { base: 'ver-1-1-0', target: 'ver-1-2-0', label: 'v1.1.0 -> v1.2.0' },
      { base: 'ver-1-2-0', target: 'ver-1-1-0', label: 'v1.2.0 -> v1.1.0 (reverse)' },
      { base: 'ver-1-2-0', target: 'ver-1-0-0', label: 'v1.2.0 -> v1.0.0 (reverse)' },
    ];

    for (const pair of validPairs) {
      const result = resolveVersionSelection(versions, pair.base, pair.target);
      assert.equal(result.baseVersionId, pair.base, `Base mismatch for ${pair.label}`);
      assert.equal(result.targetVersionId, pair.target, `Target mismatch for ${pair.label}`);
      assert.equal(result.canCompare, true, `Should be able to compare for ${pair.label}`);
    }
  });

  it('5. Identical Version Guard: selecting identical Base and Target prevents comparison', () => {
    const sameVersion = resolveVersionSelection(versions, 'ver-1-2-0', 'ver-1-2-0');
    assert.equal(sameVersion.baseVersionId, 'ver-1-2-0');
    assert.equal(sameVersion.targetVersionId, 'ver-1-2-0');
    assert.equal(sameVersion.canCompare, false, 'canCompare must be false when base === target');
  });

  it('6. Fallback Behavior: resets cleanly when selected version no longer exists', () => {
    // When selected target is deleted/non-existent
    const missingTarget = resolveVersionSelection(versions, 'ver-1-0-0', 'deleted-target-id');
    assert.equal(missingTarget.baseVersionId, 'ver-1-0-0', 'Existing base should be preserved');
    assert.equal(missingTarget.targetVersionId, 'ver-1-1-0', 'Missing target falls back to default target');
    assert.equal(missingTarget.canCompare, true);

    // When selected base is deleted/non-existent
    const missingBase = resolveVersionSelection(versions, 'deleted-base-id', 'ver-1-2-0');
    assert.equal(missingBase.baseVersionId, 'ver-1-0-0', 'Missing base falls back to default base');
    assert.equal(missingBase.targetVersionId, 'ver-1-2-0', 'Existing target should be preserved');
    assert.equal(missingBase.canCompare, true);
  });

  it('7. Edge Cases: empty and single version lists', () => {
    const emptyResult = resolveVersionSelection([]);
    assert.equal(emptyResult.baseVersionId, '');
    assert.equal(emptyResult.targetVersionId, '');
    assert.equal(emptyResult.canCompare, false);

    const singleVersion: SavedVersionItem[] = [
      { id: 'ver-1-0-0', version: 'v1.0.0' },
    ];
    const singleResult = resolveVersionSelection(singleVersion);
    assert.equal(singleResult.baseVersionId, 'ver-1-0-0');
    assert.equal(singleResult.targetVersionId, 'ver-1-0-0');
    assert.equal(singleResult.canCompare, false, 'Cannot compare with only 1 version');
  });

  it('8. Lifecycle Simulation: simulates React component state changes across user clicks and re-renders', () => {
    // Mount: initial state
    let state = resolveVersionSelection(versions);
    assert.equal(state.baseVersionId, 'ver-1-0-0');
    assert.equal(state.targetVersionId, 'ver-1-1-0');

    // Action: User changes Target to v1.2.0 in the select dropdown
    const userTargetInput = 'ver-1-2-0';
    state = resolveVersionSelection(versions, state.baseVersionId, userTargetInput);
    assert.equal(state.baseVersionId, 'ver-1-0-0');
    assert.equal(state.targetVersionId, 'ver-1-2-0');

    // Event: Parent component re-renders and passes fresh savedVersions array
    const freshVersionsArray = [...versions];
    state = resolveVersionSelection(freshVersionsArray, state.baseVersionId, state.targetVersionId);
    assert.equal(state.baseVersionId, 'ver-1-0-0');
    assert.equal(state.targetVersionId, 'ver-1-2-0', 'Target must not reset on parent re-render');

    // Action: User changes Base to v1.1.0
    const userBaseInput = 'ver-1-1-0';
    state = resolveVersionSelection(freshVersionsArray, userBaseInput, state.targetVersionId);
    assert.equal(state.baseVersionId, 'ver-1-1-0');
    assert.equal(state.targetVersionId, 'ver-1-2-0');

    // Action: User performs reverse comparison (Base = v1.2.0, Target = v1.0.0)
    state = resolveVersionSelection(freshVersionsArray, 'ver-1-2-0', 'ver-1-0-0');
    assert.equal(state.baseVersionId, 'ver-1-2-0');
    assert.equal(state.targetVersionId, 'ver-1-0-0');
    assert.equal(state.canCompare, true);
  });
});
