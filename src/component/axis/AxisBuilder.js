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

import {retrieve, defaults, extend, each} from 'zrender/src/core/util';
import * as formatUtil from '../../util/format';
import * as graphic from '../../util/graphic';
import Model from '../../model/Model';
import {isRadianAroundZero, remRadian} from '../../util/number';
import {createSymbol} from '../../util/symbol';
import * as matrixUtil from 'zrender/src/core/matrix';
import {applyTransform as v2ApplyTransform} from 'zrender/src/core/vector';
import {shouldShowAllLabels, estimateLabelUnionRect} from '../../coord/axisHelper';


var PI = Math.PI;

/**
 * A final axis is translated and rotated from a "standard axis".
 * So opt.position and opt.rotation is required.
 *
 * A standard axis is and axis from [0, 0] to [0, axisExtent[1]],
 * for example: (0, 0) ------------> (0, 50)
 *
 * nameDirection or tickDirection or labelDirection is 1 means tick
 * or label is below the standard axis, whereas is -1 means above
 * the standard axis. labelOffset means offset between label and axis,
 * which is useful when 'onZero', where axisLabel is in the grid and
 * label in outside grid.
 *
 * Tips: like always,
 * positive rotation represents anticlockwise, and negative rotation
 * represents clockwise.
 * The direction of position coordinate is the same as the direction
 * of screen coordinate.
 *
 * Do not need to consider axis 'inverse', which is auto processed by
 * axis extent.
 *
 * @param {module:zrender/container/Group} group
 * @param {Object} axisModel
 * @param {Object} opt Standard axis parameters.
 * @param {Array.<number>} opt.position [x, y]
 * @param {number} opt.rotation by radian
 * @param {number} [opt.nameDirection=1] 1 or -1 Used when nameLocation is 'middle' or 'center'.
 * @param {number} [opt.tickDirection=1] 1 or -1
 * @param {number} [opt.labelDirection=1] 1 or -1
 * @param {number} [opt.labelOffset=0] Usefull when onZero.
 * @param {string} [opt.axisLabelShow] default get from axisModel.
 * @param {string} [opt.axisName] default get from axisModel.
 * @param {number} [opt.axisNameAvailableWidth]
 * @param {number} [opt.labelRotate] by degree, default get from axisModel.
 * @param {number} [opt.strokeContainThreshold] Default label interval when label
 * @param {number} [opt.nameTruncateMaxWidth]
 */
var AxisBuilder = function (axisModel, opt) {

    /**
     * @readOnly
     */
    this.opt = opt;

    /**
     * @readOnly
     */
    this.axisModel = axisModel;

    // Default value
    defaults(
        opt,
        {
            labelOffset: 0,
            nameDirection: 1,
            tickDirection: 1,
            labelDirection: 1,
            silent: true
        }
    );

    /**
     * @readOnly
     */
    this.group = new graphic.Group();

    // FIXME Not use a seperate text group?
    var dumbGroup = new graphic.Group({
        position: opt.position.slice(),
        rotation: opt.rotation
    });

    // this.group.add(dumbGroup);
    // this._dumbGroup = dumbGroup;

    dumbGroup.updateTransform();
    this._transform = dumbGroup.transform;

    this._dumbGroup = dumbGroup;
};

AxisBuilder.prototype = {

    constructor: AxisBuilder,

    hasBuilder: function (name) {
        return !!builders[name];
    },

    add: function (name) {
        builders[name].call(this);
    },

    getGroup: function () {
        return this.group;
    }

};

var builders = {

    /**
     * @private
     */
    axisLine: function () {
        var opt = this.opt;
        var axisModel = this.axisModel;

        if (!axisModel.get('axisLine.show')) {
            return;
        }

        var extent = this.axisModel.axis.getExtent();

        var matrix = this._transform;
        var pt1 = [extent[0], 0];
        var pt2 = [extent[1], 0];
        if (matrix) {
            v2ApplyTransform(pt1, pt1, matrix);
            v2ApplyTransform(pt2, pt2, matrix);
        }

        var lineStyle = extend(
            {
                lineCap: 'round'
            },
            axisModel.getModel('axisLine.lineStyle').getLineStyle()
        );

        this.group.add(new graphic.Line({
            // Id for animation
            anid: 'line',
            subPixelOptimize: true,
            shape: {
                x1: pt1[0],
                y1: pt1[1],
                x2: pt2[0],
                y2: pt2[1]
            },
            style: lineStyle,
            strokeContainThreshold: opt.strokeContainThreshold || 5,
            silent: true,
            z2: 1
        }));

        var arrows = axisModel.get('axisLine.symbol');
        var arrowSize = axisModel.get('axisLine.symbolSize');

        var arrowOffset = axisModel.get('axisLine.symbolOffset') || 0;
        if (typeof arrowOffset === 'number') {
            arrowOffset = [arrowOffset, arrowOffset];
        }

        if (arrows != null) {
            if (typeof arrows === 'string') {
                // Use the same arrow for start and end point
                arrows = [arrows, arrows];
            }
            if (typeof arrowSize === 'string'
                || typeof arrowSize === 'number'
            ) {
                // Use the same size for width and height
                arrowSize = [arrowSize, arrowSize];
            }

            var symbolWidth = arrowSize[0];
            var symbolHeight = arrowSize[1];

            each([{
                rotate: opt.rotation + Math.PI / 2,
                offset: arrowOffset[0],
                r: 0
            }, {
                rotate: opt.rotation - Math.PI / 2,
                offset: arrowOffset[1],
                r: Math.sqrt((pt1[0] - pt2[0]) * (pt1[0] - pt2[0])
                    + (pt1[1] - pt2[1]) * (pt1[1] - pt2[1]))
            }], function (point, index) {
                if (arrows[index] !== 'none' && arrows[index] != null) {
                    var symbol = createSymbol(
                        arrows[index],
                        -symbolWidth / 2,
                        -symbolHeight / 2,
                        symbolWidth,
                        symbolHeight,
                        lineStyle.stroke,
                        true
                    );

                    // Calculate arrow position with offset
                    var r = point.r + point.offset;
                    var pos = [
                        pt1[0] + r * Math.cos(opt.rotation),
                        pt1[1] - r * Math.sin(opt.rotation)
                    ];

                    symbol.attr({
                        rotation: point.rotate,
                        position: pos,
                        silent: true,
                        z2: 11
                    });
                    this.group.add(symbol);
                }
            }, this);
        }
    },

    /**
     * @private
     */
    axisTickLabel: function () {
        var axisModel = this.axisModel;
        var opt = this.opt;

        var ticksEls = buildAxisMajorTicks(this, axisModel, opt);
        var labelEls = buildAxisLabel(this, axisModel, opt);

        fixMinMaxLabelShow(axisModel, labelEls, ticksEls);

        buildAxisMinorTicks(this, axisModel, opt);
    },

    /**
     * @private
     */
    axisName: function () {
        var opt = this.opt;
        var axisModel = this.axisModel;
        var name = retrieve(opt.axisName, axisModel.get('name'));

        if (!name) {
            return;
        }

        var nameLocation = axisModel.get('nameLocation');
        var nameDirection = opt.nameDirection;
        var textStyleModel = axisModel.getModel('nameTextStyle');
        // label + gap
        var distanceToAxis = calcDistanceToAxis();
        function calcDistanceToAxis() {
          var axis = axisModel.axis;
          if (axis.grid.model.get('containLabel') && !axis.model.get('axisLabel.inside')) {
            var labelUnionRect = estimateLabelUnionRect(axis);
            if (!labelUnionRect) {
              return 0;
            }
            var dim = axis.isHorizontal() ? 'height' : 'width';
            var margin = axisModel.get('axisLabel.margin');
            return labelUnionRect[dim] + margin;
          }
          return 0;
        }
        var gap = (axisModel.get('nameGap') || 0) + distanceToAxis;

        var extent = this.axisModel.axis.getExtent();
        var gapSignal = extent[0] > extent[1] ? -1 : 1;
        var pos = [
            nameLocation === 'start'
                ? extent[0] - gapSignal * gap
                : nameLocation === 'end'
                ? extent[1] + gapSignal * gap
                : (extent[0] + extent[1]) / 2, // 'middle'
            // Reuse labelOffset.
            isNameLocationCenter(nameLocation) ? opt.labelOffset + nameDirection * gap : 0
        ];

        var labelLayout;

        var nameRotation = axisModel.get('nameRotate');
        if (nameRotation != null) {
            nameRotation = nameRotation * PI / 180; // To radian.
        }

        var axisNameAvailableWidth;

        if (isNameLocationCenter(nameLocation)) {
            labelLayout = innerTextLayout(
                opt.rotation,
                nameRotation != null ? nameRotation : opt.rotation, // Adapt to axis.
                nameDirection
            );
        }
        else {
            labelLayout = endTextLayout(
                opt, nameLocation, nameRotation || 0, extent
            );

            axisNameAvailableWidth = opt.axisNameAvailableWidth;
            if (axisNameAvailableWidth != null) {
                axisNameAvailableWidth = Math.abs(
                    axisNameAvailableWidth / Math.sin(labelLayout.rotation)
                );
                !isFinite(axisNameAvailableWidth) && (axisNameAvailableWidth = null);
            }
        }

        var textFont = textStyleModel.getFont();

        var truncateOpt = axisModel.get('nameTruncate', true) || {};
        var ellipsis = truncateOpt.ellipsis;
        var maxWidth = retrieve(
            opt.nameTruncateMaxWidth, truncateOpt.maxWidth, axisNameAvailableWidth
        );
        // FIXME
        // truncate rich text? (consider performance)
        var truncatedText = (ellipsis != null && maxWidth != null)
            ? formatUtil.truncateText(
                name, maxWidth, textFont, ellipsis,
                {minChar: 2, placeholder: truncateOpt.placeholder}
            )
            : name;

        var tooltipOpt = axisModel.get('tooltip', true);

        var mainType = axisModel.mainType;
        var formatterParams = {
            componentType: mainType,
            name: name,
            $vars: ['name']
        };
        formatterParams[mainType + 'Index'] = axisModel.componentIndex;

        var textEl = new graphic.Text({
            // Id for animation
            anid: 'name',

            __fullText: name,
            __truncatedText: truncatedText,

            position: pos,
            rotation: labelLayout.rotation,
            silent: isLabelSilent(axisModel),
            z2: 1,
            tooltip: (tooltipOpt && tooltipOpt.show)
                ? extend({
                    content: name,
                    formatter: function () {
                        return name;
                    },
                    formatterParams: formatterParams
                }, tooltipOpt)
                : null
        });

        graphic.setTextStyle(textEl.style, textStyleModel, {
            text: truncatedText,
            textFont: textFont,
            textFill: textStyleModel.getTextColor()
                || axisModel.get('axisLine.lineStyle.color'),
            textAlign: textStyleModel.get('align')
                || labelLayout.textAlign,
            textVerticalAlign: textStyleModel.get('verticalAlign')
                || labelLayout.textVerticalAlign
        });

        if (axisModel.get('triggerEvent')) {
            textEl.eventData = makeAxisEventDataBase(axisModel);
            textEl.eventData.targetType = 'axisName';
            textEl.eventData.name = name;
        }

        // FIXME
        this._dumbGroup.add(textEl);
        textEl.updateTransform();

        this.group.add(textEl);

        textEl.decomposeTransform();
    }

};

var makeAxisEventDataBase = AxisBuilder.makeAxisEventDataBase = function (axisModel) {
    var eventData = {
        componentType: axisModel.mainType,
        componentIndex: axisModel.componentIndex
    };
    eventData[axisModel.mainType + 'Index'] = axisModel.componentIndex;
    return eventData;
};

/**
 * @public
 * @static
 * @param {Object} opt
 * @param {number} axisRotation in radian
 * @param {number} textRotation in radian
 * @param {number} direction
 * @return {Object} {
 *  rotation, // according to axis
 *  textAlign,
 *  textVerticalAlign
 * }
 */
var innerTextLayout = AxisBuilder.innerTextLayout = function (axisRotation, textRotation, direction) {
    var rotationDiff = remRadian(textRotation - axisRotation);
    var textAlign;
    var textVerticalAlign;

    if (isRadianAroundZero(rotationDiff)) { // Label is parallel with axis line.
        textVerticalAlign = direction > 0 ? 'top' : 'bottom';
        textAlign = 'center';
    }
    else if (isRadianAroundZero(rotationDiff - PI)) { // Label is inverse parallel with axis line.
        textVerticalAlign = direction > 0 ? 'bottom' : 'top';
        textAlign = 'center';
    }
    else {
        textVerticalAlign = 'middle';

        if (rotationDiff > 0 && rotationDiff < PI) {
            textAlign = direction > 0 ? 'right' : 'left';
        }
        else {
            textAlign = direction > 0 ? 'left' : 'right';
        }
    }

    return {
        rotation: rotationDiff,
        textAlign: textAlign,
        textVerticalAlign: textVerticalAlign
    };
};

function endTextLayout(opt, textPosition, textRotate, extent) {
    var rotationDiff = remRadian(textRotate - opt.rotation);
    var textAlign;
    var textVerticalAlign;
    var inverse = extent[0] > extent[1];
    var onLeft = (textPosition === 'start' && !inverse)
        || (textPosition !== 'start' && inverse);

    if (isRadianAroundZero(rotationDiff - PI / 2)) {
        textVerticalAlign = onLeft ? 'bottom' : 'top';
        textAlign = 'center';
    }
    else if (isRadianAroundZero(rotationDiff - PI * 1.5)) {
        textVerticalAlign = onLeft ? 'top' : 'bottom';
        textAlign = 'center';
    }
    else {
        textVerticalAlign = 'middle';
        if (rotationDiff < PI * 1.5 && rotationDiff > PI / 2) {
            textAlign = onLeft ? 'left' : 'right';
        }
        else {
            textAlign = onLeft ? 'right' : 'left';
        }
    }

    return {
        rotation: rotationDiff,
        textAlign: textAlign,
        textVerticalAlign: textVerticalAlign
    };
}

var isLabelSilent = AxisBuilder.isLabelSilent = function (axisModel) {
    var tooltipOpt = axisModel.get('tooltip');
    return axisModel.get('silent')
        // Consider mouse cursor, add these restrictions.
        || !(
            axisModel.get('triggerEvent') || (tooltipOpt && tooltipOpt.show)
        );
};

function fixMinMaxLabelShow(axisModel, labelEls, tickEls) {
    if (shouldShowAllLabels(axisModel.axis)) {
        return;
    }

    // If min or max are user set, we need to check
    // If the tick on min(max) are overlap on their neighbour tick
    // If they are overlapped, we need to hide the min(max) tick label
    var showMinLabel = axisModel.get('axisLabel.showMinLabel');
    var showMaxLabel = axisModel.get('axisLabel.showMaxLabel');

    // FIXME
    // Have not consider onBand yet, where tick els is more than label els.

    labelEls = labelEls || [];
    tickEls = tickEls || [];

    var firstLabel = labelEls[0];
    var nextLabel = labelEls[1];
    var lastLabel = labelEls[labelEls.length - 1];
    var prevLabel = labelEls[labelEls.length - 2];

    var firstTick = tickEls[0];
    var nextTick = tickEls[1];
    var lastTick = tickEls[tickEls.length - 1];
    var prevTick = tickEls[tickEls.length - 2];

    if (showMinLabel === false) {
        ignoreEl(firstLabel);
        ignoreEl(firstTick);
    }
    else if (isTwoLabelOverlapped(firstLabel, nextLabel)) {
        if (showMinLabel) {
            ignoreEl(nextLabel);
            ignoreEl(nextTick);
        }
        else {
            ignoreEl(firstLabel);
            ignoreEl(firstTick);
        }
    }

    if (showMaxLabel === false) {
        ignoreEl(lastLabel);
        ignoreEl(lastTick);
    }
    else if (isTwoLabelOverlapped(prevLabel, lastLabel)) {
        if (showMaxLabel) {
            ignoreEl(prevLabel);
            ignoreEl(prevTick);
        }
        else {
            ignoreEl(lastLabel);
            ignoreEl(lastTick);
        }
    }
}

function ignoreEl(el) {
    el && (el.ignore = true);
}

function isTwoLabelOverlapped(current, next, labelLayout) {
    // current and next has the same rotation.
    var firstRect = current && current.getBoundingRect().clone();
    var nextRect = next && next.getBoundingRect().clone();

    if (!firstRect || !nextRect) {
        return;
    }

    // When checking intersect of two rotated labels, we use mRotationBack
    // to avoid that boundingRect is enlarge when using `boundingRect.applyTransform`.
    var mRotationBack = matrixUtil.identity([]);
    matrixUtil.rotate(mRotationBack, mRotationBack, -current.rotation);

    firstRect.applyTransform(matrixUtil.mul([], mRotationBack, current.getLocalTransform()));
    nextRect.applyTransform(matrixUtil.mul([], mRotationBack, next.getLocalTransform()));

    return firstRect.intersect(nextRect);
}

function isNameLocationCenter(nameLocation) {
    return nameLocation === 'middle' || nameLocation === 'center';
}


function createTicks(ticksCoords, tickTransform, tickEndCoord, tickLineStyle, aniid) {
    var tickEls = [];
    var pt1 = [];
    var pt2 = [];
    for (var i = 0; i < ticksCoords.length; i++) {
        var tickCoord = ticksCoords[i].coord;

        pt1[0] = tickCoord;
        pt1[1] = 0;
        pt2[0] = tickCoord;
        pt2[1] = tickEndCoord;

        if (tickTransform) {
            v2ApplyTransform(pt1, pt1, tickTransform);
            v2ApplyTransform(pt2, pt2, tickTransform);
        }
        // Tick line, Not use group transform to have better line draw
        var tickEl = new graphic.Line({
            // Id for animation
            anid: aniid + '_' + ticksCoords[i].tickValue,
            subPixelOptimize: true,
            shape: {
                x1: pt1[0],
                y1: pt1[1],
                x2: pt2[0],
                y2: pt2[1]
            },
            style: tickLineStyle,
            z2: 2,
            silent: true
        });
        tickEls.push(tickEl);
    }
    return tickEls;
}

function buildAxisMajorTicks(axisBuilder, axisModel, opt) {
    var axis = axisModel.axis;

    var tickModel = axisModel.getModel('axisTick');

    if (!tickModel.get('show') || axis.scale.isBlank()) {
        return;
    }

    var lineStyleModel = tickModel.getModel('lineStyle');
    var tickEndCoord = opt.tickDirection * tickModel.get('length');

    var ticksCoords = axis.getTicksCoords();

    var ticksEls = createTicks(ticksCoords, axisBuilder._transform, tickEndCoord, defaults(
        lineStyleModel.getLineStyle(),
        {
            stroke: axisModel.get('axisLine.lineStyle.color')
        }
    ), 'ticks');

    for (var i = 0; i < ticksEls.length; i++) {
        axisBuilder.group.add(ticksEls[i]);
    }

    return ticksEls;
}

function buildAxisMinorTicks(axisBuilder, axisModel, opt) {
    var axis = axisModel.axis;

    var minorTickModel = axisModel.getModel('minorTick');

    if (!minorTickModel.get('show') || axis.scale.isBlank()) {
        return;
    }

    var minorTicksCoords = axis.getMinorTicksCoords();
    if (!minorTicksCoords.length) {
        return;
    }

    var lineStyleModel = minorTickModel.getModel('lineStyle');
    var tickEndCoord = opt.tickDirection * minorTickModel.get('length');

    var minorTickLineStyle = defaults(
        lineStyleModel.getLineStyle(),
        defaults(
            axisModel.getModel('axisTick').getLineStyle(),
            {
                stroke: axisModel.get('axisLine.lineStyle.color')
            }
        )
    );

    for (var i = 0; i < minorTicksCoords.length; i++) {
        var minorTicksEls = createTicks(
            minorTicksCoords[i], axisBuilder._transform, tickEndCoord, minorTickLineStyle, 'minorticks_' + i
        );
        for (var k = 0; k < minorTicksEls.length; k++) {
            axisBuilder.group.add(minorTicksEls[k]);
        }
    }
}

function buildAxisLabel(axisBuilder, axisModel, opt) {
    var axis = axisModel.axis;
    var show = retrieve(opt.axisLabelShow, axisModel.get('axisLabel.show'));

    if (!show || axis.scale.isBlank()) {
        return;
    }

    var labelModel = axisModel.getModel('axisLabel');
    var labelMargin = labelModel.get('margin');
    var labels = axis.getViewLabels();

    // Special label rotate.
    var labelRotation = (
        retrieve(opt.labelRotate, labelModel.get('rotate')) || 0
    ) * PI / 180;

    var labelLayout = innerTextLayout(opt.rotation, labelRotation, opt.labelDirection);
    var rawCategoryData = axisModel.getCategories && axisModel.getCategories(true);

    var labelEls = [];
    var silent = isLabelSilent(axisModel);
    var triggerEvent = axisModel.get('triggerEvent');

    each(labels, function (labelItem, index) {
        var tickValue = labelItem.tickValue;
        var formattedLabel = labelItem.formattedLabel;
        var rawLabel = labelItem.rawLabel;

        var itemLabelModel = labelModel;
        if (rawCategoryData && rawCategoryData[tickValue] && rawCategoryData[tickValue].textStyle) {
            itemLabelModel = new Model(
                rawCategoryData[tickValue].textStyle, labelModel, axisModel.ecModel
            );
        }

        var textColor = itemLabelModel.getTextColor()
            || axisModel.get('axisLine.lineStyle.color');

        var tickCoord = axis.dataToCoord(tickValue);
        var pos = [
            tickCoord,
            opt.labelOffset + opt.labelDirection * labelMargin
        ];

        var textEl = new graphic.Text({
            // Id for animation
            anid: 'label_' + tickValue,
            position: pos,
            rotation: labelLayout.rotation,
            silent: silent,
            z2: 10
        });

        graphic.setTextStyle(textEl.style, itemLabelModel, {
            text: formattedLabel,
            textAlign: itemLabelModel.getShallow('align', true)
                || labelLayout.textAlign,
            textVerticalAlign: itemLabelModel.getShallow('verticalAlign', true)
                || itemLabelModel.getShallow('baseline', true)
                || labelLayout.textVerticalAlign,
            textFill: typeof textColor === 'function'
                ? textColor(
                    // (1) In category axis with data zoom, tick is not the original
                    // index of axis.data. So tick should not be exposed to user
                    // in category axis.
                    // (2) Compatible with previous version, which always use formatted label as
                    // input. But in interval scale the formatted label is like '223,445', which
                    // maked user repalce ','. So we modify it to return original val but remain
                    // it as 'string' to avoid error in replacing.
                    axis.type === 'category'
                        ? rawLabel
                        : axis.type === 'value'
                        ? tickValue + ''
                        : tickValue,
                    index
                )
                : textColor
        });

        // Pack data for mouse event
        if (triggerEvent) {
            textEl.eventData = makeAxisEventDataBase(axisModel);
            textEl.eventData.targetType = 'axisLabel';
            textEl.eventData.value = rawLabel;
        }

        // FIXME
        axisBuilder._dumbGroup.add(textEl);
        textEl.updateTransform();

        labelEls.push(textEl);
        axisBuilder.group.add(textEl);

        textEl.decomposeTransform();

    });

    return labelEls;
}


export default AxisBuilder;