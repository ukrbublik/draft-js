/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule DraftEditorDragHandler
 * @format
 * @flow
 */

'use strict';

import type DraftEditor from 'DraftEditor.react';
import type SelectionState from 'SelectionState';

const DataTransfer = require('DataTransfer');
const DraftModifier = require('DraftModifier');
const EditorState = require('EditorState');

const findAncestorOffsetKey = require('findAncestorOffsetKey');
const getTextContentFromFiles = require('getTextContentFromFiles');
const getUpdatedSelectionState = require('getUpdatedSelectionState');
const isEventHandled = require('isEventHandled');
const nullthrows = require('nullthrows');
const ReactDOM = require('ReactDOM');

/**
 * Get a SelectionState for the supplied mouse event.
 */
function getSelectionForEvent(
  event: Object,
  editorState: EditorState,
): ?SelectionState {
  let node: ?Node = null;
  let offset: ?number = null;

  if (typeof document.caretRangeFromPoint === 'function') {
    var dropRange = document.caretRangeFromPoint(event.x, event.y);
    node = dropRange.startContainer;
    offset = dropRange.startOffset;
  } else if (event.rangeParent) {
    node = event.rangeParent;
    offset = event.rangeOffset;
  } else {
    return null;
  }

  node = nullthrows(node);
  offset = nullthrows(offset);
  const offsetKey = nullthrows(findAncestorOffsetKey(node));

  return getUpdatedSelectionState(
    editorState,
    offsetKey,
    offset,
    offsetKey,
    offset,
  );
}

var DraftEditorDragHandler = {
  /**
   * Drag originating from input terminated.
   */
  onDragEnd: function(editor: DraftEditor): void {
    editor.exitCurrentMode();
    endDrag(editor);
  },

  /**
   * Handle data being dropped.
   */
  onDrop: function(editor: DraftEditor, e: Object): void {
    const data = new DataTransfer(e.nativeEvent.dataTransfer);

    const editorState: EditorState = editor._latestEditorState;
    const dropSelection: ?SelectionState = getSelectionForEvent(
      e.nativeEvent,
      editorState,
    );

    e.preventDefault();
    editor.exitCurrentMode();

    if (dropSelection == null) {
      return;
    }

    const files = data.getFiles();
    if (files.length > 0) {
      if (
        editor.props.handleDroppedFiles &&
        isEventHandled(editor.props.handleDroppedFiles(dropSelection, files))
      ) {
        return;
      }

      getTextContentFromFiles(files, fileText => {
        fileText &&
          editor.update(
            insertTextAtSelection(editorState, dropSelection, fileText),
          );
      });
      return;
    }

    const dragType = editor._internalDrag ? 'internal' : 'external';
    if (
      editor.props.handleDrop &&
      isEventHandled(editor.props.handleDrop(dropSelection, data, dragType))
    ) {
      //handled
    } else if (editor._internalDrag) {
      editor.update(moveText(editorState, dropSelection));
    } else {
      editor.update(
        insertTextAtSelection(editorState, dropSelection, data.getText()),
      );
    }
    endDrag(editor);
  },
};

function endDrag(editor) {
  //Fix issue #1454
  editor._internalDrag = false; //flush

  //Fix issue #1383
  // React's onSelect event breaks after an onDrop event
  // has fired in a node: https://github.com/facebook/react/issues/11379.
  // Until this is fixed in React, we dispatch a mouseup event on that
  // DOM node, since that will make it go back to normal.
  const editorNode = ReactDOM.findDOMNode(editor);
  if (editorNode) {
    const mouseUpEvent = new MouseEvent('mouseup', {
      view: window,
      bubbles: true,
      cancelable: true,
    });
    editorNode.dispatchEvent(mouseUpEvent);
  }
}

function moveText(
  editorState: EditorState,
  targetSelection: SelectionState,
): EditorState {
  const newContentState = DraftModifier.moveText(
    editorState.getCurrentContent(),
    editorState.getSelection(),
    targetSelection,
  );
  return EditorState.push(editorState, newContentState, 'insert-fragment');
}

/**
 * Insert text at a specified selection.
 */
function insertTextAtSelection(
  editorState: EditorState,
  selection: SelectionState,
  text: string,
): EditorState {
  const newContentState = DraftModifier.insertText(
    editorState.getCurrentContent(),
    selection,
    text,
    editorState.getCurrentInlineStyle(),
  );
  return EditorState.push(editorState, newContentState, 'insert-fragment');
}

module.exports = DraftEditorDragHandler;
