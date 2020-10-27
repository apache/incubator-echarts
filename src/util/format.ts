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

import * as zrUtil from 'zrender/src/core/util';
import { parseDate, isNumeric, numericToNumber } from './number';
import { TooltipRenderMode, ColorString, ZRColor, DimensionType } from './types';
import { Dictionary } from 'zrender/src/core/types';
import { GradientObject } from 'zrender/src/graphic/Gradient';
import { format as timeFormat, pad } from './time';
import { deprecateReplaceLog } from './log';

/**
 * Add a comma each three digit.
 */
export function addCommas(x: string | number): string {
    if (!isNumeric(x)) {
        return zrUtil.isString(x) ? x : '-';
    }
    const parts = (x + '').split('.');
    return parts[0].replace(/(\d{1,3})(?=(?:\d{3})+(?!\d))/g, '$1,')
            + (parts.length > 1 ? ('.' + parts[1]) : '');
}

export function toCamelCase(str: string, upperCaseFirst?: boolean): string {
    str = (str || '').toLowerCase().replace(/-(.)/g, function (match, group1) {
        return group1.toUpperCase();
    });

    if (upperCaseFirst && str) {
        str = str.charAt(0).toUpperCase() + str.slice(1);
    }

    return str;
}

export const normalizeCssArray = zrUtil.normalizeCssArray;


const replaceReg = /([&<>"'])/g;
const replaceMap: Dictionary<string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#39;'
};

export function encodeHTML(source: string): string {
    return source == null
        ? ''
        : (source + '').replace(replaceReg, function (str, c) {
            return replaceMap[c];
        });
}


/**
 * Make value user readable for tooltip and label.
 * "User readable":
 *     Try to not print programmer-specific text like NaN, Infinity, null, undefined.
 *     Avoid to display an empty string, which users can not recognize there is
 *     a value and it might look like a bug.
 */
export function makeValueReadable(
    value: unknown,
    valueType?: DimensionType
): string {
    const USER_READABLE_DEFUALT_TIME_PATTERN = 'yyyy-MM-dd hh:mm:ss';

    function stringToUserReadable(str: string): string {
        return (str && zrUtil.trim(str)) ? str : '-';
    }
    function isNumberUserReadable(num: number): boolean {
        return !!(num != null && !isNaN(num) && isFinite(num));
    }

    const isTypeTime = valueType === 'time';
    const isValueDate = value instanceof Date;
    if (isTypeTime || isValueDate) {
        const date = isTypeTime ? parseDate(value) : value;
        if (!isNaN(+date)) {
            // PENDING: add param `useUTC`?
            return timeFormat(date, USER_READABLE_DEFUALT_TIME_PATTERN);
        }
        else if (isValueDate) {
            return '-';
        }
        // In other cases, continue to try to display the value in the following code.
    }

    if (valueType === 'ordinal') {
        return zrUtil.isStringSafe(value)
            ? stringToUserReadable(value)
            : zrUtil.isNumber(value)
            ? (isNumberUserReadable(value) ? value + '' : '-')
            : '-';
    }
    // By default.
    const numericResult = numericToNumber(value);
    return isNumberUserReadable(numericResult)
        ? addCommas(numericResult)
        : zrUtil.isStringSafe(value)
        ? stringToUserReadable(value)
        : '-';
}


const TPL_VAR_ALIAS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

const wrapVar = function (varName: string, seriesIdx?: number): string {
    return '{' + varName + (seriesIdx == null ? '' : seriesIdx) + '}';
};

export interface TplFormatterParam extends Dictionary<any> {
    // Param name list for mapping `a`, `b`, `c`, `d`, `e`
    $vars: string[];
}
/**
 * Template formatter
 * @param {Array.<Object>|Object} paramsList
 */
export function formatTpl(
    tpl: string,
    paramsList: TplFormatterParam | TplFormatterParam[],
    encode?: boolean
): string {
    if (!zrUtil.isArray(paramsList)) {
        paramsList = [paramsList];
    }
    const seriesLen = paramsList.length;
    if (!seriesLen) {
        return '';
    }

    const isTimeAxis = paramsList[0].axisType && paramsList[0].axisType.indexOf('time') >= 0;
    if (isTimeAxis) {
        const axisValue = paramsList[0].data[paramsList[0].axisIndex];
        const date = parseDate(axisValue);
        return timeFormat(date, tpl);
    }
    else {
        const $vars = paramsList[0].$vars || [];
        for (let i = 0; i < $vars.length; i++) {
            const alias = TPL_VAR_ALIAS[i];
            tpl = tpl.replace(wrapVar(alias), wrapVar(alias, 0));
        }
        for (let seriesIdx = 0; seriesIdx < seriesLen; seriesIdx++) {
            for (let k = 0; k < $vars.length; k++) {
                const val = paramsList[seriesIdx][$vars[k]];
                tpl = tpl.replace(
                    wrapVar(TPL_VAR_ALIAS[k], seriesIdx),
                    encode ? encodeHTML(val) : val
                );
            }
        }
    }
    return tpl;
}

/**
 * simple Template formatter
 */
export function formatTplSimple(tpl: string, param: Dictionary<any>, encode?: boolean) {
    zrUtil.each(param, function (value, key) {
        tpl = tpl.replace(
            '{' + key + '}',
            encode ? encodeHTML(value) : value
        );
    });
    return tpl;
}

interface RichTextTooltipMarker {
    renderMode: TooltipRenderMode;
    content: string;
    style: Dictionary<unknown>;
}
export type TooltipMarker = string | RichTextTooltipMarker;
export type TooltipMarkerType = 'item' | 'subItem';
interface GetTooltipMarkerOpt {
    color?: ColorString;
    extraCssText?: string;
    // By default: 'item'
    type?: TooltipMarkerType;
    renderMode?: TooltipRenderMode;
    // id name for marker. If only one marker is in a rich text, this can be omitted.
    // By default: 'markerX'
    markerId?: string;
    size?: string;
}
// Only support color string
export function getTooltipMarker(color: ColorString, size?: string, extraCssText?: string): TooltipMarker;
export function getTooltipMarker(opt: GetTooltipMarkerOpt): TooltipMarker;
export function getTooltipMarker(inOpt: ColorString | GetTooltipMarkerOpt, extraCssText?: string): TooltipMarker {
    const opt = zrUtil.isString(inOpt) ? {
        color: inOpt,
        extraCssText: extraCssText,
        size: inOpt
    } : (inOpt || {}) as GetTooltipMarkerOpt;
    const color = opt.color;
    const type = opt.type;
    extraCssText = opt.extraCssText;
    const renderMode = opt.renderMode || 'html';
    let size = opt.size;

    if (!size) {
        size = '10px';
    }

    if (!color) {
        return '';
    }

    if (renderMode === 'html') {
        return type === 'subItem'
        ? '<span style="display:inline-block;vertical-align:middle;margin-right:8px;margin-left:3px;'
            + 'border-radius:4px;width:4px;height:4px;background-color:'
            // Only support string
            + encodeHTML(color) + ';' + (extraCssText || '') + '"></span>'
        : '<span style="display:inline-block;margin-right:4px;'
            + 'border-radius:' + size + ';width:' + size + ';height:' + size + ';background-color:'
            + encodeHTML(color) + ';' + (extraCssText || '') + '"></span>';
    }
    else {
        // Should better not to auto generate style name by auto-increment number here.
        // Because this util is usually called in tooltip formatter, which is probably
        // called repeatly when mouse move and the auto-increment number increases fast.
        // Users can make their own style name by theirselves, make it unique and readable.
        const markerId = opt.markerId || 'markerX';
        return {
            renderMode: renderMode,
            content: '{' + markerId + '|}  ',
            style: type === 'subItem'
                ? {
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: color
                }
                : {
                    width: size,
                    height: size,
                    borderRadius: 5,
                    backgroundColor: color
                }
        };
    }
}


/**
 * @deprecated Use `time/format` instead.
 * ISO Date format
 * @param {string} tpl
 * @param {number} value
 * @param {boolean} [isUTC=false] Default in local time.
 *           see `module:echarts/scale/Time`
 *           and `module:echarts/util/number#parseDate`.
 * @inner
 */
export function formatTime(tpl: string, value: unknown, isUTC?: boolean) {
    if (__DEV__) {
        deprecateReplaceLog('echarts.format.formatTime', 'echarts.time.format');
    }

    if (tpl === 'week'
        || tpl === 'month'
        || tpl === 'quarter'
        || tpl === 'half-year'
        || tpl === 'year'
    ) {
        tpl = 'MM-dd\nyyyy';
    }

    const date = parseDate(value);
    const utc = isUTC ? 'UTC' : '';
    const y = (date as any)['get' + utc + 'FullYear']();
    const M = (date as any)['get' + utc + 'Month']() + 1;
    const d = (date as any)['get' + utc + 'Date']();
    const h = (date as any)['get' + utc + 'Hours']();
    const m = (date as any)['get' + utc + 'Minutes']();
    const s = (date as any)['get' + utc + 'Seconds']();
    const S = (date as any)['get' + utc + 'Milliseconds']();

    tpl = tpl.replace('MM', pad(M, 2))
        .replace('M', M)
        .replace('yyyy', y)
        .replace('yy', y % 100 + '')
        .replace('dd', pad(d, 2))
        .replace('d', d)
        .replace('hh', pad(h, 2))
        .replace('h', h)
        .replace('mm', pad(m, 2))
        .replace('m', m)
        .replace('ss', pad(s, 2))
        .replace('s', s)
        .replace('SSS', pad(S, 3));

    return tpl;
}

/**
 * Capital first
 * @param {string} str
 * @return {string}
 */
export function capitalFirst(str: string): string {
    return str ? str.charAt(0).toUpperCase() + str.substr(1) : str;
}

/**
 * @return Never be null/undefined.
 */
export function convertToColorString(color: ZRColor, defaultColor?: ColorString): ColorString {
    defaultColor = defaultColor || 'transparent';
    return zrUtil.isString(color)
        ? color
        : zrUtil.isObject(color)
        ? (
            (color as GradientObject).colorStops
            && ((color as GradientObject).colorStops[0] || {}).color
            || defaultColor
        )
        : defaultColor;
}

export {truncateText} from 'zrender/src/graphic/helper/parseText';

/**
 * open new tab
 * @param link url
 * @param target blank or self
 */
export function windowOpen(link: string, target: string): void {
    if (target === '_blank' || target === 'blank') {
        const blank = window.open();
        blank.opener = null;
        blank.location.href = link;
    }
    else {
        window.open(link, target);
    }
}


export {getTextRect} from '../legacy/getTextRect';
