/*
* Licensed to the Apache Software Foundation (ASF) under one
* or more contributor license agreements.  See the NOTICE file
* distributed with this work for additional information
* regarding copyright ownership.  The ASF licenses this file
* to you under the Apache License, Version 2.0 (the
* "License"); you may not use this file except in compliance
* with the License.  You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing,
* software distributed under the License is distributed on an
* "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
* KIND, either express or implied.  See the License for the
* specific language governing permissions and limitations
* under the License.
*/

// Layout helpers for each component positioning

import * as zrUtil from 'zrender/src/core/util';
import BoundingRect from 'zrender/src/core/BoundingRect';
import {parsePercent} from './number';
import * as formatUtil from './format';

var each = zrUtil.each;

/**
 * @public
 */
export var LOCATION_PARAMS = [
    'left', 'right', 'top', 'bottom', 'width', 'height'
];

/**
 * @public
 */
export var HV_NAMES = [
    ['width', 'left', 'right'],
    ['height', 'top', 'bottom']
];

function boxLayout(orient, group, gap, maxWidth, maxHeight) {
    var x = 0;
    var y = 0;
    // 每一页的起始位置
    var originx = 0;
    var originy = 0;
    var page = 0;

    if (maxWidth == null) {
        maxWidth = Infinity;
    }
    if (maxHeight == null) {
        maxHeight = Infinity;
    }
    var currentLineMaxSize = 0;

    group.eachChild(function (child, idx) {
        var position = child.position;
        var rect = child.getBoundingRect();
        var nextChild = group.childAt(idx + 1);
        var nextChildRect = nextChild && nextChild.getBoundingRect();
        var nextX;
        var nextY;

        if (orient === 'horizontal') {
            var moveX = rect.width + (nextChildRect ? (-nextChildRect.x + rect.x) : 0);
            nextX = x + moveX;
            nextY = y + currentLineMaxSize + gap;
            // 每一页的起始位置
            if (nextY >= maxHeight && nextX > maxWidth * (page + 1)) {
                page++;
                y = 0;
                originx = x;
            }
            // Wrap when width exceeds maxWidth or meet a `newline` group
            // FIXME compare before adding gap?
            // 如果下一个item的x坐标超出了
            if ((nextX > (maxWidth * (page + 1)) && nextY < maxHeight) || child.newline) {
                // 判断高度够不够换行
                x = originx;
                nextX = originx + moveX;
                y += currentLineMaxSize + gap;
                currentLineMaxSize = rect.height;
            }
            else {
                // 记录这一行的最高的高度
                // FIXME: consider rect.y is not `0`?
                currentLineMaxSize = Math.max(currentLineMaxSize, rect.height);
            }
        }
        else {
            var moveY = rect.height + (nextChildRect ? (-nextChildRect.y + rect.y) : 0);
            nextY = y + moveY;
            nextX = x + currentLineMaxSize + gap;
            if (nextX >= maxWidth && nextY > maxHeight * (page + 1)) {
                page++;
                x = 0;
                originy = y;
            }
            // Wrap when height exceeds maxHeight or meet a `newline` group
            if ((nextY > (maxHeight * (page + 1)) && nextX < maxWidth) || child.newline) {
                y = originy;
                nextY = originy + moveY;
                x += currentLineMaxSize + gap;
                currentLineMaxSize = rect.width;
            }
            else {
                currentLineMaxSize = Math.max(currentLineMaxSize, rect.width);
            }
        }

        if (child.newline) {
            return;
        }

        position[0] = x;
        position[1] = y;

        orient === 'horizontal'
            ? (x = nextX + gap)
            : (y = nextY + gap);
    });
}

/**
 * VBox or HBox layouting
 * @param {string} orient
 * @param {module:zrender/container/Group} group
 * @param {number} gap
 * @param {number} [width=Infinity]
 * @param {number} [height=Infinity]
 */
export var box = boxLayout;

/**
 * VBox layouting
 * @param {module:zrender/container/Group} group
 * @param {number} gap
 * @param {number} [width=Infinity]
 * @param {number} [height=Infinity]
 */
export var vbox = zrUtil.curry(boxLayout, 'vertical');

/**
 * HBox layouting
 * @param {module:zrender/container/Group} group
 * @param {number} gap
 * @param {number} [width=Infinity]
 * @param {number} [height=Infinity]
 */
export var hbox = zrUtil.curry(boxLayout, 'horizontal');

/**
 * If x or x2 is not specified or 'center' 'left' 'right',
 * the width would be as long as possible.
 * If y or y2 is not specified or 'middle' 'top' 'bottom',
 * the height would be as long as possible.
 *
 * @param {Object} positionInfo
 * @param {number|string} [positionInfo.x]
 * @param {number|string} [positionInfo.y]
 * @param {number|string} [positionInfo.x2]
 * @param {number|string} [positionInfo.y2]
 * @param {Object} containerRect {width, height}
 * @param {string|number} margin
 * @return {Object} {width, height}
 */
export function getAvailableSize(positionInfo, containerRect, margin) {
    var containerWidth = containerRect.width;
    var containerHeight = containerRect.height;

    var x = parsePercent(positionInfo.x, containerWidth);
    var y = parsePercent(positionInfo.y, containerHeight);
    var x2 = parsePercent(positionInfo.x2, containerWidth);
    var y2 = parsePercent(positionInfo.y2, containerHeight);

    (isNaN(x) || isNaN(parseFloat(positionInfo.x))) && (x = 0);
    (isNaN(x2) || isNaN(parseFloat(positionInfo.x2))) && (x2 = containerWidth);
    (isNaN(y) || isNaN(parseFloat(positionInfo.y))) && (y = 0);
    (isNaN(y2) || isNaN(parseFloat(positionInfo.y2))) && (y2 = containerHeight);

    margin = formatUtil.normalizeCssArray(margin || 0);

    return {
        width: Math.max(x2 - x - margin[1] - margin[3], 0),
        height: Math.max(y2 - y - margin[0] - margin[2], 0)
    };
}

/**
 * Parse position info.
 *
 * @param {Object} positionInfo
 * @param {number|string} [positionInfo.left]
 * @param {number|string} [positionInfo.top]
 * @param {number|string} [positionInfo.right]
 * @param {number|string} [positionInfo.bottom]
 * @param {number|string} [positionInfo.width]
 * @param {number|string} [positionInfo.height]
 * @param {number|string} [positionInfo.aspect] Aspect is width / height
 * @param {Object} containerRect
 * @param {string|number} [margin]
 *
 * @return {module:zrender/core/BoundingRect}
 */
export function getLayoutRect(
    positionInfo, containerRect, margin
) {
    margin = formatUtil.normalizeCssArray(margin || 0);

    var containerWidth = containerRect.width;
    var containerHeight = containerRect.height;

    var left = parsePercent(positionInfo.left, containerWidth);
    var top = parsePercent(positionInfo.top, containerHeight);
    var right = parsePercent(positionInfo.right, containerWidth);
    var bottom = parsePercent(positionInfo.bottom, containerHeight);
    var width = parsePercent(positionInfo.width, containerWidth);
    var height = parsePercent(positionInfo.height, containerHeight);

    var verticalMargin = margin[2] + margin[0];
    var horizontalMargin = margin[1] + margin[3];
    var aspect = positionInfo.aspect;

    // If width is not specified, calculate width from left and right
    if (isNaN(width)) {
        width = containerWidth - right - horizontalMargin - left;
    }
    if (isNaN(height)) {
        height = containerHeight - bottom - verticalMargin - top;
    }

    if (aspect != null) {
        // If width and height are not given
        // 1. Graph should not exceeds the container
        // 2. Aspect must be keeped
        // 3. Graph should take the space as more as possible
        // FIXME
        // Margin is not considered, because there is no case that both
        // using margin and aspect so far.
        if (isNaN(width) && isNaN(height)) {
            if (aspect > containerWidth / containerHeight) {
                width = containerWidth * 0.8;
            }
            else {
                height = containerHeight * 0.8;
            }
        }

        // Calculate width or height with given aspect
        if (isNaN(width)) {
            width = aspect * height;
        }
        if (isNaN(height)) {
            height = width / aspect;
        }
    }

    // If left is not specified, calculate left from right and width
    if (isNaN(left)) {
        left = containerWidth - right - width - horizontalMargin;
    }
    if (isNaN(top)) {
        top = containerHeight - bottom - height - verticalMargin;
    }

    // Align left and top
    switch (positionInfo.left || positionInfo.right) {
        case 'center':
            left = containerWidth / 2 - width / 2 - margin[3];
            break;
        case 'right':
            left = containerWidth - width - horizontalMargin;
            break;
    }
    switch (positionInfo.top || positionInfo.bottom) {
        case 'middle':
        case 'center':
            top = containerHeight / 2 - height / 2 - margin[0];
            break;
        case 'bottom':
            top = containerHeight - height - verticalMargin;
            break;
    }
    // If something is wrong and left, top, width, height are calculated as NaN
    left = left || 0;
    top = top || 0;
    if (isNaN(width)) {
        // Width may be NaN if only one value is given except width
        width = containerWidth - horizontalMargin - left - (right || 0);
    }
    if (isNaN(height)) {
        // Height may be NaN if only one value is given except height
        height = containerHeight - verticalMargin - top - (bottom || 0);
    }

    var rect = new BoundingRect(left + margin[3], top + margin[0], width, height);
    rect.margin = margin;
    return rect;
}


/**
 * Position a zr element in viewport
 *  Group position is specified by either
 *  {left, top}, {right, bottom}
 *  If all properties exists, right and bottom will be igonred.
 *
 * Logic:
 *     1. Scale (against origin point in parent coord)
 *     2. Rotate (against origin point in parent coord)
 *     3. Traslate (with el.position by this method)
 * So this method only fixes the last step 'Traslate', which does not affect
 * scaling and rotating.
 *
 * If be called repeatly with the same input el, the same result will be gotten.
 *
 * @param {module:zrender/Element} el Should have `getBoundingRect` method.
 * @param {Object} positionInfo
 * @param {number|string} [positionInfo.left]
 * @param {number|string} [positionInfo.top]
 * @param {number|string} [positionInfo.right]
 * @param {number|string} [positionInfo.bottom]
 * @param {number|string} [positionInfo.width] Only for opt.boundingModel: 'raw'
 * @param {number|string} [positionInfo.height] Only for opt.boundingModel: 'raw'
 * @param {Object} containerRect
 * @param {string|number} margin
 * @param {Object} [opt]
 * @param {Array.<number>} [opt.hv=[1,1]] Only horizontal or only vertical.
 * @param {Array.<number>} [opt.boundingMode='all']
 *        Specify how to calculate boundingRect when locating.
 *        'all': Position the boundingRect that is transformed and uioned
 *               both itself and its descendants.
 *               This mode simplies confine the elements in the bounding
 *               of their container (e.g., using 'right: 0').
 *        'raw': Position the boundingRect that is not transformed and only itself.
 *               This mode is useful when you want a element can overflow its
 *               container. (Consider a rotated circle needs to be located in a corner.)
 *               In this mode positionInfo.width/height can only be number.
 */
export function positionElement(el, positionInfo, containerRect, margin, opt) {
    var h = !opt || !opt.hv || opt.hv[0];
    var v = !opt || !opt.hv || opt.hv[1];
    var boundingMode = opt && opt.boundingMode || 'all';

    if (!h && !v) {
        return;
    }

    var rect;
    if (boundingMode === 'raw') {
        rect = el.type === 'group'
            ? new BoundingRect(0, 0, +positionInfo.width || 0, +positionInfo.height || 0)
            : el.getBoundingRect();
    }
    else {
        rect = el.getBoundingRect();
        if (el.needLocalTransform()) {
            var transform = el.getLocalTransform();
            // Notice: raw rect may be inner object of el,
            // which should not be modified.
            rect = rect.clone();
            rect.applyTransform(transform);
        }
    }

    // The real width and height can not be specified but calculated by the given el.
    positionInfo = getLayoutRect(
        zrUtil.defaults(
            {width: rect.width, height: rect.height},
            positionInfo
        ),
        containerRect,
        margin
    );

    // Because 'tranlate' is the last step in transform
    // (see zrender/core/Transformable#getLocalTransform),
    // we can just only modify el.position to get final result.
    var elPos = el.position;
    var dx = h ? positionInfo.x - rect.x : 0;
    var dy = v ? positionInfo.y - rect.y : 0;

    el.attr('position', boundingMode === 'raw' ? [dx, dy] : [elPos[0] + dx, elPos[1] + dy]);
}

/**
 * @param {Object} option Contains some of the properties in HV_NAMES.
 * @param {number} hvIdx 0: horizontal; 1: vertical.
 */
export function sizeCalculable(option, hvIdx) {
    return option[HV_NAMES[hvIdx][0]] != null
        || (option[HV_NAMES[hvIdx][1]] != null && option[HV_NAMES[hvIdx][2]] != null);
}

/**
 * Consider Case:
 * When defulat option has {left: 0, width: 100}, and we set {right: 0}
 * through setOption or media query, using normal zrUtil.merge will cause
 * {right: 0} does not take effect.
 *
 * @example
 * ComponentModel.extend({
 *     init: function () {
 *         ...
 *         var inputPositionParams = layout.getLayoutParams(option);
 *         this.mergeOption(inputPositionParams);
 *     },
 *     mergeOption: function (newOption) {
 *         newOption && zrUtil.merge(thisOption, newOption, true);
 *         layout.mergeLayoutParam(thisOption, newOption);
 *     }
 * });
 *
 * @param {Object} targetOption
 * @param {Object} newOption
 * @param {Object|string} [opt]
 * @param {boolean|Array.<boolean>} [opt.ignoreSize=false] Used for the components
 *  that width (or height) should not be calculated by left and right (or top and bottom).
 */
export function mergeLayoutParam(targetOption, newOption, opt) {
    !zrUtil.isObject(opt) && (opt = {});

    var ignoreSize = opt.ignoreSize;
    !zrUtil.isArray(ignoreSize) && (ignoreSize = [ignoreSize, ignoreSize]);

    var hResult = merge(HV_NAMES[0], 0);
    var vResult = merge(HV_NAMES[1], 1);

    copy(HV_NAMES[0], targetOption, hResult);
    copy(HV_NAMES[1], targetOption, vResult);

    function merge(names, hvIdx) {
        var newParams = {};
        var newValueCount = 0;
        var merged = {};
        var mergedValueCount = 0;
        var enoughParamNumber = 2;

        each(names, function (name) {
            merged[name] = targetOption[name];
        });
        each(names, function (name) {
            // Consider case: newOption.width is null, which is
            // set by user for removing width setting.
            hasProp(newOption, name) && (newParams[name] = merged[name] = newOption[name]);
            hasValue(newParams, name) && newValueCount++;
            hasValue(merged, name) && mergedValueCount++;
        });

        if (ignoreSize[hvIdx]) {
            // Only one of left/right is premitted to exist.
            if (hasValue(newOption, names[1])) {
                merged[names[2]] = null;
            }
            else if (hasValue(newOption, names[2])) {
                merged[names[1]] = null;
            }
            return merged;
        }

        // Case: newOption: {width: ..., right: ...},
        // or targetOption: {right: ...} and newOption: {width: ...},
        // There is no conflict when merged only has params count
        // little than enoughParamNumber.
        if (mergedValueCount === enoughParamNumber || !newValueCount) {
            return merged;
        }
        // Case: newOption: {width: ..., right: ...},
        // Than we can make sure user only want those two, and ignore
        // all origin params in targetOption.
        else if (newValueCount >= enoughParamNumber) {
            return newParams;
        }
        else {
            // Chose another param from targetOption by priority.
            for (var i = 0; i < names.length; i++) {
                var name = names[i];
                if (!hasProp(newParams, name) && hasProp(targetOption, name)) {
                    newParams[name] = targetOption[name];
                    break;
                }
            }
            return newParams;
        }
    }

    function hasProp(obj, name) {
        return obj.hasOwnProperty(name);
    }

    function hasValue(obj, name) {
        return obj[name] != null && obj[name] !== 'auto';
    }

    function copy(names, target, source) {
        each(names, function (name) {
            target[name] = source[name];
        });
    }
}

/**
 * Retrieve 'left', 'right', 'top', 'bottom', 'width', 'height' from object.
 * @param {Object} source
 * @return {Object} Result contains those props.
 */
export function getLayoutParams(source) {
    return copyLayoutParams({}, source);
}

/**
 * Retrieve 'left', 'right', 'top', 'bottom', 'width', 'height' from object.
 * @param {Object} source
 * @return {Object} Result contains those props.
 */
export function copyLayoutParams(target, source) {
    source && target && each(LOCATION_PARAMS, function (name) {
        source.hasOwnProperty(name) && (target[name] = source[name]);
    });
    return target;
}
