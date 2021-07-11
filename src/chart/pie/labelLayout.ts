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

// FIXME emphasis label position is not same with normal label position
import {parsePercent} from '../../util/number';
import PieSeriesModel, { PieSeriesOption, PieDataItemOption } from './PieSeries';
import { VectorArray } from 'zrender/src/core/vector';
import { HorizontalAlign, ZRTextAlign } from '../../util/types';
import { Sector, Polyline, Point } from '../../util/graphic';
import ZRText from 'zrender/src/graphic/Text';
import BoundingRect, {RectLike} from 'zrender/src/core/BoundingRect';
import { each } from 'zrender/src/core/util';
import { limitTurnAngle, limitSurfaceAngle } from '../../label/labelGuideHelper';
import { shiftLayoutOnY } from '../../label/labelLayoutHelper';

const RADIAN = Math.PI / 180;

interface LabelLayout {
    label: ZRText
    labelLine: Polyline
    position: PieSeriesOption['label']['position']
    len: number
    len2: number
    minTurnAngle: number
    maxSurfaceAngle: number
    surfaceNormal: Point
    linePoints: VectorArray[]
    textAlign: HorizontalAlign
    labelDistance: number
    labelAlignTo: PieSeriesOption['label']['alignTo']
    edgeDistance: number
    bleedMargin: PieSeriesOption['label']['bleedMargin']
    rect: BoundingRect
}

function adjustSingleSide(
    list: LabelLayout[],
    cx: number,
    cy: number,
    r: number,
    dir: -1 | 1,
    viewWidth: number,
    viewHeight: number,
    viewLeft: number,
    viewTop: number,
    farthestX: number
) {
    if (list.length < 2) {
        return;
    }

    interface SemiInfo {
        list: LabelLayout[]
        rB: number
        maxY: number
    };

    function recalculateXOnSemiToAlignOnEllipseCurve(semi: SemiInfo) {
        const rB = semi.rB;
        const rB2 = rB * rB;
        for (let i = 0; i < semi.list.length; i++) {
            const item = semi.list[i];
            const dy = Math.abs(item.label.y - cy);
            // horizontal r is always same with original r because x is not changed.
            const rA = r + item.len;
            const rA2 = rA * rA;
            // Use ellipse implicit function to calculate x
            const dx = Math.sqrt((1 - Math.abs(dy * dy / rB2)) * rA2);
            item.label.x = cx + (dx + item.len2) * dir;
        }
    }

    // Adjust X based on the shifted y. Make tight labels aligned on an ellipse curve.
    function recalculateX(items: LabelLayout[]) {
        // Extremes of
        const topSemi = { list: [], maxY: 0} as SemiInfo;
        const bottomSemi = { list: [], maxY: 0 } as SemiInfo;

        for (let i = 0; i < items.length; i++) {
            if (items[i].labelAlignTo !== 'none') {
                continue;
            }
            const item = items[i];
            const semi = item.label.y > cy ? bottomSemi : topSemi;
            const dy = Math.abs(item.label.y - cy);
            if (dy > semi.maxY) {
                const dx = item.label.x - cx - item.len2 * dir;
                // horizontal r is always same with original r because x is not changed.
                const rA = r + item.len;
                // Canculate rB based on the topest / bottemest label.
                const rB = Math.abs(dx) < rA
                    ? Math.sqrt(dy * dy / (1 - dx * dx / rA / rA))
                    : rA;
                semi.rB = rB;
                semi.maxY = dy;
            }
            semi.list.push(item);
        }

        recalculateXOnSemiToAlignOnEllipseCurve(topSemi);
        recalculateXOnSemiToAlignOnEllipseCurve(bottomSemi);
    }

    const len = list.length;
    for (let i = 0; i < len; i++) {
        if (list[i].position === 'outer' && list[i].labelAlignTo === 'labelLine') {
            const dx = list[i].label.x - farthestX;
            list[i].linePoints[1][0] += dx;
            list[i].label.x = farthestX;
        }
    }

    if (shiftLayoutOnY(list, viewTop, viewTop + viewHeight)) {
        recalculateX(list);
    }
}

function avoidOverlap(
    labelLayoutList: LabelLayout[],
    cx: number,
    cy: number,
    r: number,
    viewWidth: number,
    viewHeight: number,
    viewLeft: number,
    viewTop: number
) {
    const leftList = [];
    const rightList = [];
    let leftmostX = Number.MAX_VALUE;
    let rightmostX = -Number.MAX_VALUE;
    for (let i = 0; i < labelLayoutList.length; i++) {
        const label = labelLayoutList[i].label;
        if (isPositionCenter(labelLayoutList[i])) {
            continue;
        }
        if (label.x < cx) {
            leftmostX = Math.min(leftmostX, label.x);
            leftList.push(labelLayoutList[i]);
        }
        else {
            rightmostX = Math.max(rightmostX, label.x);
            rightList.push(labelLayoutList[i]);
        }
    }

    adjustSingleSide(rightList, cx, cy, r, 1, viewWidth, viewHeight, viewLeft, viewTop, rightmostX);
    adjustSingleSide(leftList, cx, cy, r, -1, viewWidth, viewHeight, viewLeft, viewTop, leftmostX);

    for (let i = 0; i < labelLayoutList.length; i++) {
        const layout = labelLayoutList[i];
        const label = layout.label;
        if (isPositionCenter(layout)) {
            continue;
        }

        const linePoints = layout.linePoints;
        if (linePoints) {
            const isAlignToEdge = layout.labelAlignTo === 'edge';

            let realTextWidth = layout.rect.width;
            let targetTextWidth;
            if (isAlignToEdge) {
                if (label.x < cx) {
                    targetTextWidth = linePoints[2][0] - layout.labelDistance
                            - viewLeft - layout.edgeDistance;
                }
                else {
                    targetTextWidth = viewLeft + viewWidth - layout.edgeDistance
                            - linePoints[2][0] - layout.labelDistance;
                }
            }
            else {
                if (label.x < cx) {
                    targetTextWidth = label.x - viewLeft - layout.bleedMargin;
                }
                else {
                    targetTextWidth = viewLeft + viewWidth - label.x - layout.bleedMargin;
                }
            }
            if (targetTextWidth < layout.rect.width) {
                // TODOTODO
                // layout.text = textContain.truncateText(layout.text, targetTextWidth, layout.font);
                layout.label.style.width = targetTextWidth;
                if (layout.labelAlignTo === 'edge') {
                    realTextWidth = targetTextWidth;
                    // realTextWidth = textContain.getWidth(layout.text, layout.font);
                }
            }

            const dist = linePoints[1][0] - linePoints[2][0];
            if (isAlignToEdge) {
                if (label.x < cx) {
                    linePoints[2][0] = viewLeft + layout.edgeDistance + realTextWidth + layout.labelDistance;
                }
                else {
                    linePoints[2][0] = viewLeft + viewWidth - layout.edgeDistance
                            - realTextWidth - layout.labelDistance;
                }
            }
            else {
                if (label.x < cx) {
                    linePoints[2][0] = label.x + layout.labelDistance;
                }
                else {
                    linePoints[2][0] = label.x - layout.labelDistance;
                }
                linePoints[1][0] = linePoints[2][0] + dist;
            }
            linePoints[1][1] = linePoints[2][1] = label.y;
        }
    }
}

function isPositionCenter(sectorShape: LabelLayout) {
    // Not change x for center label
    return sectorShape.position === 'center';
}

export default function pieLabelLayout(
    seriesModel: PieSeriesModel
) {
    const data = seriesModel.getData();
    const labelLayoutList: LabelLayout[] = [];
    let cx;
    let cy;
    let hasLabelRotate = false;
    const minShowLabelRadian = (seriesModel.get('minShowLabelAngle') || 0) * RADIAN;

    const viewRect = data.getLayout('viewRect') as RectLike;
    const r = data.getLayout('r') as number;
    const viewWidth = viewRect.width;
    const viewLeft = viewRect.x;
    const viewTop = viewRect.y;
    const viewHeight = viewRect.height;

    function setNotShow(el: {ignore: boolean}) {
        el.ignore = true;
    }

    function isLabelShown(label: ZRText) {
        if (!label.ignore) {
            return true;
        }
        for (const key in label.states) {
            if (label.states[key].ignore === false) {
                return true;
            }
        }
        return false;
    }

    data.each(function (idx) {
        const sector = data.getItemGraphicEl(idx) as Sector;
        const sectorShape = sector.shape;
        const label = sector.getTextContent();
        const labelLine = sector.getTextGuideLine();

        const itemModel = data.getItemModel<PieDataItemOption>(idx);
        const labelModel = itemModel.getModel('label');
        // Use position in normal or emphasis
        const labelPosition = labelModel.get('position') || itemModel.get(['emphasis', 'label', 'position']);
        const labelDistance = labelModel.get('distanceToLabelLine');
        const labelAlignTo = labelModel.get('alignTo');
        const edgeDistance = parsePercent(labelModel.get('edgeDistance'), viewWidth);
        const bleedMargin = labelModel.get('bleedMargin');

        const labelLineModel = itemModel.getModel('labelLine');
        let labelLineLen = labelLineModel.get('length');
        labelLineLen = parsePercent(labelLineLen, viewWidth);
        let labelLineLen2 = labelLineModel.get('length2');
        labelLineLen2 = parsePercent(labelLineLen2, viewWidth);

        if (Math.abs(sectorShape.endAngle - sectorShape.startAngle) < minShowLabelRadian) {
            each(label.states, setNotShow);
            label.ignore = true;
            return;
        }

        if (!isLabelShown(label)) {
            return;
        }

        const midAngle = (sectorShape.startAngle + sectorShape.endAngle) / 2;
        const nx = Math.cos(midAngle);
        const ny = Math.sin(midAngle);

        let textX;
        let textY;
        let linePoints;
        let textAlign: ZRTextAlign;

        cx = sectorShape.cx;
        cy = sectorShape.cy;


        const isLabelInside = labelPosition === 'inside' || labelPosition === 'inner';
        if (labelPosition === 'center') {
            textX = sectorShape.cx;
            textY = sectorShape.cy;
            textAlign = 'center';
        }
        else {
            const x1 = (isLabelInside ? (sectorShape.r + sectorShape.r0) / 2 * nx : sectorShape.r * nx) + cx;
            const y1 = (isLabelInside ? (sectorShape.r + sectorShape.r0) / 2 * ny : sectorShape.r * ny) + cy;

            textX = x1 + nx * 3;
            textY = y1 + ny * 3;

            if (!isLabelInside) {
                // For roseType
                const x2 = x1 + nx * (labelLineLen + r - sectorShape.r);
                const y2 = y1 + ny * (labelLineLen + r - sectorShape.r);
                const x3 = x2 + ((nx < 0 ? -1 : 1) * labelLineLen2);
                const y3 = y2;

                if (labelAlignTo === 'edge') {
                    // Adjust textX because text align of edge is opposite
                    textX = nx < 0
                        ? viewLeft + edgeDistance
                        : viewLeft + viewWidth - edgeDistance;
                }
                else {
                    textX = x3 + (nx < 0 ? -labelDistance : labelDistance);
                }
                textY = y3;
                linePoints = [[x1, y1], [x2, y2], [x3, y3]];
            }

            textAlign = isLabelInside
                ? 'center'
                : (labelAlignTo === 'edge'
                    ? (nx > 0 ? 'right' : 'left')
                    : (nx > 0 ? 'left' : 'right'));
        }

        let labelRotate;
        const rotate = labelModel.get('rotate');
        if (typeof rotate === 'number') {
            labelRotate = rotate * (Math.PI / 180);
        }
        else if (labelPosition === 'center') {
            labelRotate = 0;
        }
        else {
            const radialAngle = nx < 0 ? -midAngle + Math.PI : -midAngle;
            if (rotate === 'radial' || rotate === true) {
                labelRotate = radialAngle;
            }
            else if (rotate === 'tangential'
                && labelPosition !== 'outside'
                && labelPosition !== 'outer'
            ) {
                labelRotate = radialAngle + Math.PI / 2;
                if (labelRotate > Math.PI / 2) {
                    labelRotate -= Math.PI;
                }
            }
            else {
                labelRotate = 0;
            }
        }

        hasLabelRotate = !!labelRotate;

        label.x = textX;
        label.y = textY;
        label.rotation = labelRotate;

        // Not sectorShape the inside label
        if (!isLabelInside) {
            const textRect = label.getBoundingRect().clone();
            textRect.applyTransform(label.getComputedTransform());
            // Text has a default 1px stroke. Exclude this.
            const margin = (label.style.margin || 0) + 2.1;
            textRect.y -= margin / 2;
            textRect.height += margin;

            labelLayoutList.push({
                label,
                labelLine,
                position: labelPosition,
                len: labelLineLen,
                len2: labelLineLen2,
                minTurnAngle: labelLineModel.get('minTurnAngle'),
                maxSurfaceAngle: labelLineModel.get('maxSurfaceAngle'),
                surfaceNormal: new Point(nx, ny),
                linePoints: linePoints,
                textAlign: textAlign,
                labelDistance: labelDistance,
                labelAlignTo: labelAlignTo,
                edgeDistance: edgeDistance,
                bleedMargin: bleedMargin,
                rect: textRect
            });
        }
        else {
            label.setStyle({
                align: textAlign
            });
            const selectState = label.states.select;
            if (selectState) {
                selectState.x += label.x;
                selectState.y += label.y;
            }
        }
        sector.setTextConfig({
            inside: isLabelInside
        });
    });

    if (!hasLabelRotate && seriesModel.get('avoidLabelOverlap')) {
        avoidOverlap(labelLayoutList, cx, cy, r, viewWidth, viewHeight, viewLeft, viewTop);
    }

    for (let i = 0; i < labelLayoutList.length; i++) {
        const layout = labelLayoutList[i];
        const label = layout.label;
        const labelLine = layout.labelLine;
        const notShowLabel = isNaN(label.x) || isNaN(label.y);
        if (label) {
            label.setStyle({
                align: layout.textAlign
            });
            if (notShowLabel) {
                each(label.states, setNotShow);
                label.ignore = true;
            }
            const selectState = label.states.select;
            if (selectState) {
                selectState.x += label.x;
                selectState.y += label.y;
            }
        }
        if (labelLine) {
            const linePoints = layout.linePoints;
            if (notShowLabel || !linePoints) {
                each(labelLine.states, setNotShow);
                labelLine.ignore = true;
            }
            else {
                limitTurnAngle(linePoints, layout.minTurnAngle);
                limitSurfaceAngle(linePoints, layout.surfaceNormal, layout.maxSurfaceAngle);

                labelLine.setShape({ points: linePoints });

                // Set the anchor to the midpoint of sector
                label.__hostTarget.textGuideLineConfig = {
                    anchor: new Point(linePoints[0][0], linePoints[0][1])
                };
            }
        }
    }
}
