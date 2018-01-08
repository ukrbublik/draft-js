/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getSafeBodyFromHTML
 * @format
 * @flow
 */

'use strict';

var UserAgent = require('UserAgent');

const invariant = require('invariant');

var isOldIE = UserAgent.isBrowser('IE <= 9');

// Provides a dom node that will not execute scripts
// https://developer.mozilla.org/en-US/docs/Web/API/DOMImplementation.createHTMLDocument
// https://developer.mozilla.org/en-US/Add-ons/Code_snippets/HTML_to_DOM

function getSafeBodyFromHTML(html: string): ?{body: Element, meta: Object} {
  var doc;
  // Provides a safe context
  if (
    !isOldIE &&
    document.implementation &&
    document.implementation.createHTMLDocument
  ) {
    doc = document.implementation.createHTMLDocument('foo');
    invariant(doc.documentElement, 'Missing doc.documentElement');
    doc.documentElement.innerHTML = html;
    var body = doc.getElementsByTagName('body')[0];
    var rawMeta = doc.getElementsByTagName('meta');
    var meta = {};
    for (var i = 0 ; i < rawMeta.length ; i++) {
      var metaItem = rawMeta[i];
      var charset = metaItem.getAttribute("charset");
      var property = metaItem.getAttribute("property");
      var name = metaItem.getAttribute("name");
      var content = metaItem.getAttribute("content");
      if (charset)
        meta['charset'] = charset;
      else if (property)
        meta[property] = content;
      else if (name)
        meta[name] = content;
    }
    return {body, meta};
  }
  return null;
}

module.exports = getSafeBodyFromHTML;
