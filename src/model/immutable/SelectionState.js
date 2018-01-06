/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SelectionState
 * @format
 * @flow
 */

'use strict';

type Position = {key: string, offset: number};
import type {BlockMap} from 'BlockMap';
var SelectionsCompareResultKeys = {
  OVERLAP: true,
  HOLDS: true,
  INSIDE: true,
  OUTSIDE: true,
  LEFT: true,
  RIGHT: true,
  EQUALS: true,
  UNKNOWN: true,
};
type SelectionsCompareResult = $Keys<typeof SelectionsCompareResultKeys>;

var Immutable = require('immutable');

var {Record} = Immutable;

var defaultRecord: {
  anchorKey: string,
  anchorOffset: number,
  focusKey: string,
  focusOffset: number,
  isBackward: boolean,
  hasFocus: boolean,
} = {
  anchorKey: '',
  anchorOffset: 0,
  focusKey: '',
  focusOffset: 0,
  isBackward: false,
  hasFocus: false,
};

var SelectionStateRecord = Record(defaultRecord);

class SelectionState extends SelectionStateRecord {
  serialize(): string {
    return (
      'Anchor: ' +
      this.getAnchorKey() +
      ':' +
      this.getAnchorOffset() +
      ', ' +
      'Focus: ' +
      this.getFocusKey() +
      ':' +
      this.getFocusOffset() +
      ', ' +
      'Is Backward: ' +
      String(this.getIsBackward()) +
      ', ' +
      'Has Focus: ' +
      String(this.getHasFocus())
    );
  }

  getAnchorKey(): string {
    return this.get('anchorKey');
  }

  getAnchorOffset(): number {
    return this.get('anchorOffset');
  }

  getFocusKey(): string {
    return this.get('focusKey');
  }

  getFocusOffset(): number {
    return this.get('focusOffset');
  }

  getIsBackward(): boolean {
    return this.get('isBackward');
  }

  getHasFocus(): boolean {
    return this.get('hasFocus');
  }

  /**
   * Return whether the specified range overlaps with an edge of the
   * SelectionState.
   */
  hasEdgeWithin(blockKey: string, start: number, end: number): boolean {
    var anchorKey = this.getAnchorKey();
    var focusKey = this.getFocusKey();

    if (anchorKey === focusKey && anchorKey === blockKey) {
      var selectionStart = this.getStartOffset();
      var selectionEnd = this.getEndOffset();
      return start <= selectionEnd && selectionStart <= end;
    }

    if (blockKey !== anchorKey && blockKey !== focusKey) {
      return false;
    }

    var offsetToCheck =
      blockKey === anchorKey ? this.getAnchorOffset() : this.getFocusOffset();

    return start <= offsetToCheck && end >= offsetToCheck;
  }

  isCollapsed(): boolean {
    return (
      this.getAnchorKey() === this.getFocusKey() &&
      this.getAnchorOffset() === this.getFocusOffset()
    );
  }

  getStartKey(): string {
    return this.getIsBackward() ? this.getFocusKey() : this.getAnchorKey();
  }

  getStartOffset(): number {
    return this.getIsBackward()
      ? this.getFocusOffset()
      : this.getAnchorOffset();
  }

  getEndKey(): string {
    return this.getIsBackward() ? this.getAnchorKey() : this.getFocusKey();
  }

  getEndOffset(): number {
    return this.getIsBackward()
      ? this.getAnchorOffset()
      : this.getFocusOffset();
  }

  static createEmpty(key: string): SelectionState {
    return new SelectionState({
      anchorKey: key,
      anchorOffset: 0,
      focusKey: key,
      focusOffset: 0,
      isBackward: false,
      hasFocus: false,
    });
  }

  //comparison relatively to current selection ('left' means sel2 is to the left of current selection)
  compareWithSelection(
    sel2: SelectionState,
    blockMap: BlockMap,
  ): SelectionsCompareResult {
    let sel1 = this;
    let s1Start = {key: sel1.getStartKey(), offset: sel1.getStartOffset()};
    let s1End = {key: sel1.getEndKey(), offset: sel1.getEndOffset()};
    let s2Start = {key: sel2.getStartKey(), offset: sel2.getStartOffset()};
    let s2End = {key: sel2.getEndKey(), offset: sel2.getEndOffset()};
    //let isSel1Collapsed = s1Start.key == s1End.key && s1Start.offset == s1End.offset;
    //let isSel2Collapsed = s2Start.key == s2End.key && s2Start.offset == s2End.offset;

    let isOkDir =
      cmpPositions(s1Start, s1End, blockMap) <= 0 &&
      cmpPositions(s2Start, s2End, blockMap) <= 0;
    let areEq =
      s1Start.key == s2Start.key &&
      s1Start.offset == s2Start.offset &&
      s1End.key == s2End.key &&
      s1End.offset == s2End.offset;

    let s2Sta_to_s1Sta = cmpPositions(s2Start, s1Start, blockMap);
    let s2Sta_to_s1End = cmpPositions(s2Start, s1End, blockMap);
    let s2End_to_s1Sta = cmpPositions(s2End, s1Start, blockMap);
    let s2End_to_s1End = cmpPositions(s2End, s1End, blockMap);

    let isOverlap =
      (s2Sta_to_s1Sta < 0 && s2End_to_s1Sta > 0 && s2End_to_s1End < 0) ||
      (s2Sta_to_s1Sta > 0 && s2Sta_to_s1End < 0 && s2End_to_s1End > 0);
    let isS2Inside = s2Sta_to_s1Sta >= 0 && s2End_to_s1End <= 0;
    let isS2HoldsS1 = s2Sta_to_s1Sta == 0 && s2End_to_s1End == 0;
    let isS2Outside = s2Sta_to_s1Sta <= 0 && s2End_to_s1End >= 0;
    let isS2ToLeft = s2End_to_s1Sta <= 0;
    let isS2ToRight = s2Sta_to_s1End >= 0;
    //if (isSel2Collapsed && isS2Inside) {
    //    isS2Inside = false;
    //}

    let rel = !isOkDir
      ? 'UNKNOWN'
      : areEq
        ? 'EQUALS'
        : isOverlap
          ? 'OVERLAP'
          : isS2HoldsS1
            ? 'HOLDS'
            : isS2Inside
              ? 'INSIDE'
              : isS2Outside
                ? 'OUTSIDE'
                : isS2ToLeft ? 'LEFT' : isS2ToRight ? 'RIGHT' : 'UNKNOWN';

    return rel;
  }

  updateOnDeletingSelection(
    selDel: SelectionState,
    blockMap: BlockMap,
  ): SelectionState {
    let startKey = this.getStartKey();
    let startOffset = this.getStartOffset();
    let endKey = this.getEndKey();
    let endOffset = this.getEndOffset();

    let newStartPos = fixPosOnDeletingSelection(
      {key: startKey, offset: startOffset},
      selDel,
      blockMap,
    );
    startKey = newStartPos.key;
    startOffset = newStartPos.offset;
    let newEndPos = fixPosOnDeletingSelection(
      {key: endKey, offset: endOffset},
      selDel,
      blockMap,
    );
    endKey = newEndPos.key;
    endOffset = newEndPos.offset;

    let selection = SelectionState.createEmpty(startKey).merge({
      anchorKey: startKey,
      anchorOffset: startOffset,
      focusKey: endKey,
      focusOffset: endOffset,
    });
    return selection;
  }
}

function fixPosOnDeletingSelection(
  pos: Position,
  selDel: SelectionState,
  blockMap: BlockMap,
): Position {
  pos = Object.assign({}, pos);
  let isSelDelOn1Block = selDel.getStartKey() == selDel.getEndKey();
  let cmp = compareSelectionWithPosition(selDel, pos, blockMap);
  if (cmp == 'INSIDE') {
    pos.key = selDel.getStartKey();
    pos.offset = selDel.getStartOffset();
  } else if (cmp == 'LEFT') {
    //safe
  } else if (cmp == 'RIGHT') {
    if (isSelDelOn1Block) {
      if (pos.key == selDel.getEndKey()) {
        pos.offset -= selDel.getEndOffset() - selDel.getStartOffset();
      }
    } else if (pos.key == selDel.getEndKey()) {
      pos.key = selDel.getStartKey();
      pos.offset = selDel.getStartOffset() + pos.offset - selDel.getEndOffset();
    }
  }

  return pos;
}

function compareSelectionWithPosition(
  sel1: SelectionState,
  pos2: Position,
  blockMap: BlockMap,
): SelectionsCompareResult {
  let sel2 = SelectionState.createEmpty(pos2.key).merge({
    anchorKey: pos2.key,
    anchorOffset: pos2.offset,
    focusKey: pos2.key,
    focusOffset: pos2.offset,
  });
  return sel1.compareWithSelection(sel2, blockMap);
}

function cmpPositions(
  pos1: Position,
  pos2: Position,
  blockMap: BlockMap,
): number {
  let ind1 = blockMap.keySeq().findIndex(k => k == pos1.key);
  let ind2 = blockMap.keySeq().findIndex(k => k == pos2.key);
  return ind1 == ind2 ? pos1.offset - pos2.offset : ind1 - ind2;
}

module.exports = SelectionState;
