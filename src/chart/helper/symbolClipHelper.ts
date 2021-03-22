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

import { isString, isArray, map, normalizeCssArray } from 'zrender/src/core/util';
import { parsePercent } from '../../util/number';
import { SymbolClip } from '../../util/types';
import * as graphic from '../../util/graphic';

const REG_CSS_CLIP_SHAPE = /^([a-z]+).*\((.*)\)/;

type SymbolClipPath = graphic.Path;

type ParsedCSSClip = {
    type: 'inset' | 'rect' | 'circle' | 'ellipse' | 'polygon' | 'path'
    center?: number | string | (number | string)[]
    radius?: number | string | (number | string)[]
    points?: (number | string)[] | (number | string)[][],
    path?: string
};

/**
 * To make a symbol clip path
 * @param clip the clip expression following the CSS `clip-path` rule
 * @param symbolSize the size of symbol
 * @return the symbol clip path
 */
export function makeSymbolClipPath(
    clip: SymbolClip,
    symbolSize: number[]
): SymbolClipPath {

    if (!clip) {
        return;
    }

    if (clip instanceof graphic.Path) {
        return clip;
    }

    if (isString(clip)) {
        const parsedClip = parseCSSClipExp(clip);
        return parsedClip && createSymbolClipPath(parsedClip, symbolSize);
    }

}

function createSymbolClipPath(
    clip: ParsedCSSClip,
    symbolSize: number[]
): SymbolClipPath {

    let clipPath: SymbolClipPath;

    const clipType = clip.type;
    if (clipType === 'circle' || clipType === 'ellipse') {
        let {radius, center} = clip;
        let cx;
        let cy;
        if (!center || (center as (string | number)[]).length === 0) {
            cx = 0;
            cy = 0;
        }
        else {
            if (!isArray(center)) {
                center = [center, center];
            }
            center = [
                parsePercent(center[0], symbolSize[0]) || 0,
                parsePercent(center[1] == null ? center[0] : center[1], symbolSize[1]) || 0
            ];
            cx = -symbolSize[0] / 2 + (center as number[])[0];
            cy = -symbolSize[1] / 2 + (center as number[])[1];
        }
        if (clipType === 'circle') {
            // consider circle radius in percentage
            isArray(radius) && (radius = radius[0]);
            radius = parsePercent(radius, symbolSize[0]) || 0;
            const maxRadius = symbolSize[0] / 2;
            // restrict the max radius
            if (radius > maxRadius) {
                radius = maxRadius;
            }
            if (!(radius > 0)) {
                return;
            }
            clipPath = new graphic.Circle({
                shape: {
                    cx: cx,
                    cy: cy,
                    r: radius
                }
            });
        }
        else {
            if (!isArray(radius)) {
                radius = [radius, radius];
            }
            const rx = parsePercent(radius[0], symbolSize[0]) || 0;
            const ry = parsePercent(radius[1] == null ? radius[0] : radius[1], symbolSize[1]) || 0;
            clipPath = new graphic.Ellipse({
                shape: {
                    cx: cx,
                    cy: cy,
                    rx: rx,
                    ry: ry
                }
            });
        }
    }
    else if (clipType === 'rect') {
        const {radius, points} = clip;
        const shapeArgs = normalizeArray(
            map(points as (string | number)[], (point, idx) => {
                return parsePercent(point, symbolSize[idx % 2 ? 0 : 1]);
            })
        );
        const r = normalizeArray(
            map(radius as (string | number)[], (r, idx) => {
                return parsePercent(r, symbolSize[idx % 2 ? 0 : 1]);
            })
        );
        const width = symbolSize[0] - shapeArgs[1] - shapeArgs[3];
        const height = symbolSize[1] - shapeArgs[0] - shapeArgs[2];
        if (!(width > 0 && height > 0 && (width < symbolSize[0] || height < symbolSize[1]))) {
            return;
        }
        clipPath = new graphic.Rect({
            shape: {
                x: -symbolSize[0] / 2 + shapeArgs[3],
                y: -symbolSize[1] / 2 + shapeArgs[0],
                width: width,
                height: height,
                r: r
            }
        });
    }
    else if (clipType === 'polygon') {
        const points = clip.points;
        if (points && points.length > 0) {
            const normalizedPoints = map(points as (number | string)[][], point => {
                return map(point, (val, dim) => {
                   return parsePercent(val, symbolSize[dim]) - symbolSize[dim] / 2;
                });
            });
            clipPath = new graphic.Polygon({
                shape: {
                    points: normalizedPoints
                }
            });
        }
    }
    else if (clipType === 'path') {
        if (clip.path) {
            clipPath = graphic.makePath(clip.path, {}, {
                x: -symbolSize[0] / 2,
                y: -symbolSize[1] / 2,
                width: symbolSize[0],
                height: symbolSize[1]
            }, 'center');
        }
    }

    return clipPath;
}

/**
 * To parse clip expression value defined in CSS.
 *
 * Supported forms of value are as follows:
 *  `inset(22% 12% 10px 35px)`
 *  `rect(22% 12% 10px 35px)`
 *  `circle(20px at 50% 25%)`
 *  `ellipse(115px 55px at 50% 40%)`
 *  `polygon(50% 20%, 90% 80%, 10% 80%)`
 *  `path('M0.5,1 C0.5,1,0,0.7,0,0.3 A0.25,0.25,1,1,1,0.5,0.3 A0.25,0.25,1,1,1,1,0.3 C1,0.7,0.5,1,0.5,1 Z')`
 *
 * Note that only `px` and `%` are supported. `rem` and other units will be ignored.
 *
 * @param clipExp the raw clip expression in CSS
 */
function parseCSSClipExp(clipExp: string): ParsedCSSClip {
    const match = clipExp && clipExp.trim().match(REG_CSS_CLIP_SHAPE);
    if (!match) {
        return;
    }

    const type = match[1] as any;
    const value = match[2] && match[2].trim().replace(/(p(x|t))|(r?em)|(v(h|w))|(ch)/ig, '');
    if (!type || !value) {
        return;
    }

    const parsedClip: ParsedCSSClip = {type: type};

    if (type === 'inset' || type === 'rect') {
        parsedClip.type = 'rect';
        const vals = value.split('round');
        parsedClip.points = vals[0].trim().split(' ');
        parsedClip.radius = vals[1] && vals[1].trim().split(' ');
    }
    else if (type === 'circle' || type === 'ellipse') {
        const vals = value.split('at');
        parsedClip.radius = vals[0].trim().split(' ');
        parsedClip.center = vals[1] && vals[1].trim().split(' ');
    }
    else if (type === 'polygon') {
        parsedClip.points = map(value.split(','), p => {
            return p.trim().split(' ');
        });
    }
    else if (type === 'path') {
        parsedClip.path = value.replace(/[\'"]/g, '');
    }

    return parsedClip;
}

function normalizeArray(val: Parameters<typeof normalizeCssArray>[0]) {
    const normalizedArr = normalizeCssArray(val);
    if (normalizedArr.length === 1) {
        normalizedArr[1] = normalizedArr[2] = normalizedArr[3] = normalizedArr[0];
    }
    return normalizedArr;
}
