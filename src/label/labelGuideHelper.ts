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

import {
    Text as ZRText,
    Point,
    Path
} from '../util/graphic';
import PathProxy from 'zrender/src/core/PathProxy';
import { RectLike } from 'zrender/src/core/BoundingRect';
import { normalizeRadian } from 'zrender/src/contain/util';
import { cubicProjectPoint, quadraticProjectPoint } from 'zrender/src/core/curve';
import Element from 'zrender/src/Element';

const PI2 = Math.PI * 2;
const CMD = PathProxy.CMD;

const DEFAULT_SEARCH_SPACE = ['top', 'right', 'bottom', 'left'] as const;

type CandidatePosition = typeof DEFAULT_SEARCH_SPACE[number];

function getCandidateAnchor(
    pos: CandidatePosition,
    distance: number,
    rect: RectLike,
    outPt: Point,
    outDir: Point
) {
    const width = rect.width;
    const height = rect.height;
    switch (pos) {
        case 'top':
            outPt.set(
                rect.x + width / 2,
                rect.y - distance
            );
            outDir.set(0, -1);
            break;
        case 'bottom':
            outPt.set(
                rect.x + width / 2,
                rect.y + height + distance
            );
            outDir.set(0, 1);
            break;
        case 'left':
            outPt.set(
                rect.x - distance,
                rect.y + height / 2
            );
            outDir.set(-1, 0);
            break;
        case 'right':
            outPt.set(
                rect.x + width + distance,
                rect.y + height / 2
            );
            outDir.set(1, 0);
            break;
    }
}


function projectPointToArc(
    cx: number, cy: number, r: number, startAngle: number, endAngle: number, anticlockwise: boolean,
    x: number, y: number, out: number[]
): number {
    x -= cx;
    y -= cy;
    const d = Math.sqrt(x * x + y * y);
    x /= d;
    y /= d;

    // Intersect point.
    const ox = x * r + cx;
    const oy = y * r + cy;

    if (Math.abs(startAngle - endAngle) % PI2 < 1e-4) {
        // Is a circle
        out[0] = ox;
        out[1] = oy;
        return d - r;
    }

    if (anticlockwise) {
        const tmp = startAngle;
        startAngle = normalizeRadian(endAngle);
        endAngle = normalizeRadian(tmp);
    }
    else {
        startAngle = normalizeRadian(startAngle);
        endAngle = normalizeRadian(endAngle);
    }
    if (startAngle > endAngle) {
        endAngle += PI2;
    }

    let angle = Math.atan2(y, x);
    if (angle < 0) {
        angle += PI2;
    }
    if ((angle >= startAngle && angle <= endAngle)
        || (angle + PI2 >= startAngle && angle + PI2 <= endAngle)) {
        // Project point is on the arc.
        out[0] = ox;
        out[1] = oy;
        return d - r;
    }

    const x1 = r * Math.cos(startAngle) + cx;
    const y1 = r * Math.sin(startAngle) + cy;

    const x2 = r * Math.cos(endAngle) + cx;
    const y2 = r * Math.sin(endAngle) + cy;

    const d1 = (x1 - x) * (x1 - x) + (y1 - y) * (y1 - y);
    const d2 = (x2 - x) * (x2 - x) + (y2 - y) * (y2 - y);

    if (d1 < d2) {
        out[0] = x1;
        out[1] = y1;
        return Math.sqrt(d1);
    }
    else {
        out[0] = x2;
        out[1] = y2;
        return Math.sqrt(d2);
    }
}

function projectPointToLine(x1: number, y1: number, x2: number, y2: number, x: number, y: number, out: number[]) {
    const dx = x - x1;
    const dy = y - y1;

    let dx1 = x2 - x1;
    let dy1 = y2 - y1;

    const lineLen = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    dx1 /= lineLen;
    dy1 /= lineLen;

    // dot product
    const projectedLen = dx * dx1 + dy * dy1;
    const t = Math.min(Math.max(projectedLen / lineLen, 0), 1);
    const ox = out[0] = x1 + t * dx1;
    const oy = out[1] = y1 + t * dy1;

    return Math.sqrt((ox - x) * (ox - x) + (oy - y) * (oy - y));
}

function projectPointToRect(
    x1: number, y1: number, width: number, height: number, x: number, y: number, out: number[]
): number {
    if (width < 0) {
        x1 = x1 + width;
        width = -width;
    }
    if (height < 0) {
        y1 = y1 + height;
        height = -height;
    }
    const x2 = x1 + width;
    const y2 = y1 + height;

    const ox = out[0] = Math.min(Math.max(x, x1), x2);
    const oy = out[1] = Math.min(Math.max(y, y1), y2);

    return Math.sqrt((ox - x) * (ox - x) + (oy - y) * (oy - y));
}

const tmpPt: number[] = [];

function nearestPointOnRect(pt: Point, rect: RectLike, out: Point) {
    const dist = projectPointToRect(
        rect.x, rect.y, rect.width, rect.height,
        pt.x, pt.y, tmpPt
    );
    out.set(tmpPt[0], tmpPt[1]);
    return dist;
}
/**
 * Calculate min distance corresponding point.
 * This method won't evaluate if point is in the path.
 */
function nearestPointOnPath(pt: Point, path: PathProxy, out: Point) {
    let xi = 0;
    let yi = 0;
    let x0 = 0;
    let y0 = 0;
    let x1;
    let y1;

    let minDist = Infinity;

    const data = path.data;
    const x = pt.x;
    const y = pt.y;

    for (let i = 0; i < data.length;) {
        const cmd = data[i++];

        if (i === 1) {
            xi = data[i];
            yi = data[i + 1];
            x0 = xi;
            y0 = yi;
        }

        let d = minDist;

        switch (cmd) {
            case CMD.M:
                // moveTo 命令重新创建一个新的 subpath, 并且更新新的起点
                // 在 closePath 的时候使用
                x0 = data[i++];
                y0 = data[i++];
                xi = x0;
                yi = y0;
                break;
            case CMD.L:
                d = projectPointToLine(xi, yi, data[i], data[i + 1], x, y, tmpPt);
                xi = data[i++];
                yi = data[i++];
                break;
            case CMD.C:
                d = cubicProjectPoint(
                    xi, yi,
                    data[i++], data[i++], data[i++], data[i++], data[i], data[i + 1],
                    x, y, tmpPt
                );

                xi = data[i++];
                yi = data[i++];
                break;
            case CMD.Q:
                d = quadraticProjectPoint(
                    xi, yi,
                    data[i++], data[i++], data[i], data[i + 1],
                    x, y, tmpPt
                );
                xi = data[i++];
                yi = data[i++];
                break;
            case CMD.A:
                // TODO Arc 判断的开销比较大
                const cx = data[i++];
                const cy = data[i++];
                const rx = data[i++];
                const ry = data[i++];
                const theta = data[i++];
                const dTheta = data[i++];
                // TODO Arc 旋转
                i += 1;
                const anticlockwise = !!(1 - data[i++]);
                x1 = Math.cos(theta) * rx + cx;
                y1 = Math.sin(theta) * ry + cy;
                // 不是直接使用 arc 命令
                if (i <= 1) {
                    // 第一个命令起点还未定义
                    x0 = x1;
                    y0 = y1;
                }
                // zr 使用scale来模拟椭圆, 这里也对x做一定的缩放
                const _x = (x - cx) * ry / rx + cx;
                d = projectPointToArc(
                    cx, cy, ry, theta, theta + dTheta, anticlockwise,
                    _x, y, tmpPt
                );
                xi = Math.cos(theta + dTheta) * rx + cx;
                yi = Math.sin(theta + dTheta) * ry + cy;
                break;
            case CMD.R:
                x0 = xi = data[i++];
                y0 = yi = data[i++];
                const width = data[i++];
                const height = data[i++];
                d = projectPointToRect(x0, y0, width, height, x, y, tmpPt);
                break;
            case CMD.Z:
                d = projectPointToLine(xi, yi, x0, y0, x, y, tmpPt);

                xi = x0;
                yi = y0;
                break;
        }

        if (d < minDist) {
            minDist = d;
            out.set(tmpPt[0], tmpPt[1]);
        }
    }

    return minDist;
}

const pt0 = new Point();
const pt1 = new Point();
const pt2 = new Point();
const dir = new Point();
export function updateLabelGuideLine(
    label: ZRText,
    labelRect: RectLike,
    target: Element,
    targetRect: RectLike
) {
    if (!target) {
        return;
    }

    const labelLine = target.getTextGuideLine();
    // Needs to create text guide in each charts.
    if (!labelLine) {
        return;
    }

    const labelGuideConfig = target.textGuideLineConfig || {};
    if (!labelGuideConfig.autoCalculate) {
        return;
    }

    const points = [[0, 0], [0, 0], [0, 0]];

    const searchSpace = labelGuideConfig.candidates || DEFAULT_SEARCH_SPACE;

    let minDist = Infinity;
    const anchorPoint = labelGuideConfig && labelGuideConfig.anchor;
    if (anchorPoint) {
        pt2.copy(anchorPoint);
    }
    for (let i = 0; i < searchSpace.length; i++) {
        const candidate = searchSpace[i];
        getCandidateAnchor(candidate, 0, labelRect, pt0, dir);
        Point.scaleAndAdd(pt1, pt0, dir, labelGuideConfig.len == null ? 15 : labelGuideConfig.len);

        const dist = anchorPoint ? anchorPoint.distance(pt1)
            : (target instanceof Path
                ? nearestPointOnPath(pt1, target.path, pt2)
                : nearestPointOnRect(pt1, targetRect, pt2));

        // TODO pt2 is in the path
        if (dist < minDist) {
            minDist = dist;
            pt0.toArray(points[0]);
            pt1.toArray(points[1]);
            pt2.toArray(points[2]);
        }
    }

    labelLine.setShape({ points });
}