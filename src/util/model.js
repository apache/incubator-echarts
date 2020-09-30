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
import env from 'zrender/src/core/env';

var each = zrUtil.each;
var isObject = zrUtil.isObject;
var isArray = zrUtil.isArray;

/**
 * Make the name displayable. But we should
 * make sure it is not duplicated with user
 * specified name, so use '\0';
 */
var DUMMY_COMPONENT_NAME_PREFIX = 'series\0';

/**
 * If value is not array, then translate it to array.
 * @param  {*} value
 * @return {Array} [value] or value
 */
export function normalizeToArray(value) {
    return value instanceof Array
        ? value
        : value == null
        ? []
        : [value];
}

/**
 * Sync default option between normal and emphasis like `position` and `show`
 * In case some one will write code like
 *     label: {
 *          show: false,
 *          position: 'outside',
 *          fontSize: 18
 *     },
 *     emphasis: {
 *          label: { show: true }
 *     }
 * @param {Object} opt
 * @param {string} key
 * @param {Array.<string>} subOpts
 */
export function defaultEmphasis(opt, key, subOpts) {
    // Caution: performance sensitive.
    if (opt) {
        opt[key] = opt[key] || {};
        opt.emphasis = opt.emphasis || {};
        opt.emphasis[key] = opt.emphasis[key] || {};

        // Default emphasis option from normal
        for (var i = 0, len = subOpts.length; i < len; i++) {
            var subOptName = subOpts[i];
            if (!opt.emphasis[key].hasOwnProperty(subOptName)
                && opt[key].hasOwnProperty(subOptName)
            ) {
                opt.emphasis[key][subOptName] = opt[key][subOptName];
            }
        }
    }
}

export var TEXT_STYLE_OPTIONS = [
    'fontStyle', 'fontWeight', 'fontSize', 'fontFamily',
    'rich', 'tag', 'color', 'textBorderColor', 'textBorderWidth',
    'width', 'height', 'lineHeight', 'align', 'verticalAlign', 'baseline',
    'shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY',
    'textShadowColor', 'textShadowBlur', 'textShadowOffsetX', 'textShadowOffsetY',
    'backgroundColor', 'borderColor', 'borderWidth', 'borderRadius', 'padding'
];

// modelUtil.LABEL_OPTIONS = modelUtil.TEXT_STYLE_OPTIONS.concat([
//     'position', 'offset', 'rotate', 'origin', 'show', 'distance', 'formatter',
//     'fontStyle', 'fontWeight', 'fontSize', 'fontFamily',
//     // FIXME: deprecated, check and remove it.
//     'textStyle'
// ]);

/**
 * The method do not ensure performance.
 * data could be [12, 2323, {value: 223}, [1221, 23], {value: [2, 23]}]
 * This helper method retieves value from data.
 * @param {string|number|Date|Array|Object} dataItem
 * @return {number|string|Date|Array.<number|string|Date>}
 */
export function getDataItemValue(dataItem) {
    return (isObject(dataItem) && !isArray(dataItem) && !(dataItem instanceof Date))
        ? dataItem.value : dataItem;
}

/**
 * data could be [12, 2323, {value: 223}, [1221, 23], {value: [2, 23]}]
 * This helper method determine if dataItem has extra option besides value
 * @param {string|number|Date|Array|Object} dataItem
 */
export function isDataItemOption(dataItem) {
    return isObject(dataItem)
        && !(dataItem instanceof Array);
        // // markLine data can be array
        // && !(dataItem[0] && isObject(dataItem[0]) && !(dataItem[0] instanceof Array));
}

/**
 * Mapping to exists for merge.
 *
 * @public
 * @param {Array.<Object>|Array.<module:echarts/model/Component>} exists
 * @param {Object|Array.<Object>} newCptOptions
 * @return {Array.<Object>} Result, like [{exist: ..., option: ...}, {}],
 *                          index of which is the same as exists.
 */
export function mappingToExists(exists, newCptOptions) {
    // Mapping by the order by original option (but not order of
    // new option) in merge mode. Because we should ensure
    // some specified index (like xAxisIndex) is consistent with
    // original option, which is easy to understand, espatially in
    // media query. And in most case, merge option is used to
    // update partial option but not be expected to change order.
    newCptOptions = (newCptOptions || []).slice();

    var result = zrUtil.map(exists || [], function (obj, index) {
        return {exist: obj};
    });

    // Mapping by id or name if specified.
    each(newCptOptions, function (cptOption, index) {
        if (!isObject(cptOption)) {
            return;
        }

        // id has highest priority.
        for (var i = 0; i < result.length; i++) {
            if (!result[i].option // Consider name: two map to one.
                && cptOption.id != null
                && result[i].exist.id === cptOption.id + ''
            ) {
                result[i].option = cptOption;
                newCptOptions[index] = null;
                return;
            }
        }

        for (var i = 0; i < result.length; i++) {
            var exist = result[i].exist;
            if (!result[i].option // Consider name: two map to one.
                // Can not match when both ids exist but different.
                && ((exist && exist.id == null) || (cpOption && cptOption.id == null))
                && (cptOption && cptOption.name != null)
                && !isIdInner(cptOption)
                && !isIdInner(exist)
                && exist && cptOption
                &&  exist.name === cptOption.name + ''
            ) {
                result[i].option = cptOption;
                newCptOptions[index] = null;
                return;
            }
        }
    });

    // Otherwise mapping by index.
    each(newCptOptions, function (cptOption, index) {
        if (!isObject(cptOption)) {
            return;
        }

        var i = 0;
        for (; i < result.length; i++) {
            var exist = result[i].exist;
            if (!result[i].option
                // Existing model that already has id should be able to
                // mapped to (because after mapping performed model may
                // be assigned with a id, whish should not affect next
                // mapping), except those has inner id.
                && !isIdInner(exist)
                // Caution:
                // Do not overwrite id. But name can be overwritten,
                // because axis use name as 'show label text'.
                // 'exist' always has id and name and we dont
                // need to check it.
                && cptOption.id == null
            ) {
                result[i].option = cptOption;
                break;
            }
        }

        if (i >= result.length) {
            result.push({option: cptOption});
        }
    });

    return result;
}

/**
 * Make id and name for mapping result (result of mappingToExists)
 * into `keyInfo` field.
 *
 * @public
 * @param {Array.<Object>} Result, like [{exist: ..., option: ...}, {}],
 *                          which order is the same as exists.
 * @return {Array.<Object>} The input.
 */
export function makeIdAndName(mapResult) {
    // We use this id to hash component models and view instances
    // in echarts. id can be specified by user, or auto generated.

    // The id generation rule ensures new view instance are able
    // to mapped to old instance when setOption are called in
    // no-merge mode. So we generate model id by name and plus
    // type in view id.

    // name can be duplicated among components, which is convenient
    // to specify multi components (like series) by one name.

    // Ensure that each id is distinct.
    var idMap = zrUtil.createHashMap();

    each(mapResult, function (item, index) {
        var existCpt = item.exist;
        existCpt && idMap.set(existCpt.id, item);
    });

    each(mapResult, function (item, index) {
        var opt = item.option;

        zrUtil.assert(
            !opt || opt.id == null || !idMap.get(opt.id) || idMap.get(opt.id) === item,
            'id duplicates: ' + (opt && opt.id)
        );

        opt && opt.id != null && idMap.set(opt.id, item);
        !item.keyInfo && (item.keyInfo = {});
    });

    // Make name and id.
    each(mapResult, function (item, index) {
        var existCpt = item.exist;
        var opt = item.option;
        var keyInfo = item.keyInfo;

        if (!isObject(opt)) {
            return;
        }

        // name can be overwitten. Consider case: axis.name = '20km'.
        // But id generated by name will not be changed, which affect
        // only in that case: setOption with 'not merge mode' and view
        // instance will be recreated, which can be accepted.
        keyInfo.name = opt.name != null
            ? opt.name + ''
            : existCpt
            ? existCpt.name
            // Avoid diffferent series has the same name,
            // because name may be used like in color pallet.
            : DUMMY_COMPONENT_NAME_PREFIX + index;

        if (existCpt) {
            keyInfo.id = existCpt.id;
        }
        else if (opt.id != null) {
            keyInfo.id = opt.id + '';
        }
        else {
            // Consider this situatoin:
            //  optionA: [{name: 'a'}, {name: 'a'}, {..}]
            //  optionB [{..}, {name: 'a'}, {name: 'a'}]
            // Series with the same name between optionA and optionB
            // should be mapped.
            var idNum = 0;
            do {
                keyInfo.id = '\0' + keyInfo.name + '\0' + idNum++;
            }
            while (idMap.get(keyInfo.id));
        }

        idMap.set(keyInfo.id, item);
    });
}

export function isNameSpecified(componentModel) {
    var name = componentModel.name;
    // Is specified when `indexOf` get -1 or > 0.
    return !!(name && name.indexOf(DUMMY_COMPONENT_NAME_PREFIX));
}

/**
 * @public
 * @param {Object} cptOption
 * @return {boolean}
 */
export function isIdInner(cptOption) {
    return isObject(cptOption)
        && cptOption.id
        && (cptOption.id + '').indexOf('\0_ec_\0') === 0;
}

/**
 * A helper for removing duplicate items between batchA and batchB,
 * and in themselves, and categorize by series.
 *
 * @param {Array.<Object>} batchA Like: [{seriesId: 2, dataIndex: [32, 4, 5]}, ...]
 * @param {Array.<Object>} batchB Like: [{seriesId: 2, dataIndex: [32, 4, 5]}, ...]
 * @return {Array.<Array.<Object>, Array.<Object>>} result: [resultBatchA, resultBatchB]
 */
export function compressBatches(batchA, batchB) {
    var mapA = {};
    var mapB = {};

    makeMap(batchA || [], mapA);
    makeMap(batchB || [], mapB, mapA);

    return [mapToArray(mapA), mapToArray(mapB)];

    function makeMap(sourceBatch, map, otherMap) {
        for (var i = 0, len = sourceBatch.length; i < len; i++) {
            var seriesId = sourceBatch[i].seriesId;
            var dataIndices = normalizeToArray(sourceBatch[i].dataIndex);
            var otherDataIndices = otherMap && otherMap[seriesId];

            for (var j = 0, lenj = dataIndices.length; j < lenj; j++) {
                var dataIndex = dataIndices[j];

                if (otherDataIndices && otherDataIndices[dataIndex]) {
                    otherDataIndices[dataIndex] = null;
                }
                else {
                    (map[seriesId] || (map[seriesId] = {}))[dataIndex] = 1;
                }
            }
        }
    }

    function mapToArray(map, isData) {
        var result = [];
        for (var i in map) {
            if (map.hasOwnProperty(i) && map[i] != null) {
                if (isData) {
                    result.push(+i);
                }
                else {
                    var dataIndices = mapToArray(map[i], true);
                    dataIndices.length && result.push({seriesId: i, dataIndex: dataIndices});
                }
            }
        }
        return result;
    }
}

/**
 * @param {module:echarts/data/List} data
 * @param {Object} payload Contains dataIndex (means rawIndex) / dataIndexInside / name
 *                         each of which can be Array or primary type.
 * @return {number|Array.<number>} dataIndex If not found, return undefined/null.
 */
export function queryDataIndex(data, payload) {
    if (payload.dataIndexInside != null) {
        return payload.dataIndexInside;
    }
    else if (payload.dataIndex != null) {
        return zrUtil.isArray(payload.dataIndex)
            ? zrUtil.map(payload.dataIndex, function (value) {
                return data.indexOfRawIndex(value);
            })
            : data.indexOfRawIndex(payload.dataIndex);
    }
    else if (payload.name != null) {
        return zrUtil.isArray(payload.name)
            ? zrUtil.map(payload.name, function (value) {
                return data.indexOfName(value);
            })
            : data.indexOfName(payload.name);
    }
}

/**
 * Enable property storage to any host object.
 * Notice: Serialization is not supported.
 *
 * For example:
 * var inner = zrUitl.makeInner();
 *
 * function some1(hostObj) {
 *      inner(hostObj).someProperty = 1212;
 *      ...
 * }
 * function some2() {
 *      var fields = inner(this);
 *      fields.someProperty1 = 1212;
 *      fields.someProperty2 = 'xx';
 *      ...
 * }
 *
 * @return {Function}
 */
export function makeInner() {
    // Consider different scope by es module import.
    var key = '__\0ec_inner_' + innerUniqueIndex++ + '_' + Math.random().toFixed(5);
    return function (hostObj) {
        return hostObj[key] || (hostObj[key] = {});
    };
}
var innerUniqueIndex = 0;

/**
 * @param {module:echarts/model/Global} ecModel
 * @param {string|Object} finder
 *        If string, e.g., 'geo', means {geoIndex: 0}.
 *        If Object, could contain some of these properties below:
 *        {
 *            seriesIndex, seriesId, seriesName,
 *            geoIndex, geoId, geoName,
 *            bmapIndex, bmapId, bmapName,
 *            xAxisIndex, xAxisId, xAxisName,
 *            yAxisIndex, yAxisId, yAxisName,
 *            gridIndex, gridId, gridName,
 *            ... (can be extended)
 *        }
 *        Each properties can be number|string|Array.<number>|Array.<string>
 *        For example, a finder could be
 *        {
 *            seriesIndex: 3,
 *            geoId: ['aa', 'cc'],
 *            gridName: ['xx', 'rr']
 *        }
 *        xxxIndex can be set as 'all' (means all xxx) or 'none' (means not specify)
 *        If nothing or null/undefined specified, return nothing.
 * @param {Object} [opt]
 * @param {string} [opt.defaultMainType]
 * @param {Array.<string>} [opt.includeMainTypes]
 * @return {Object} result like:
 *        {
 *            seriesModels: [seriesModel1, seriesModel2],
 *            seriesModel: seriesModel1, // The first model
 *            geoModels: [geoModel1, geoModel2],
 *            geoModel: geoModel1, // The first model
 *            ...
 *        }
 */
export function parseFinder(ecModel, finder, opt) {
    if (zrUtil.isString(finder)) {
        var obj = {};
        obj[finder + 'Index'] = 0;
        finder = obj;
    }

    var defaultMainType = opt && opt.defaultMainType;
    if (defaultMainType
        && !has(finder, defaultMainType + 'Index')
        && !has(finder, defaultMainType + 'Id')
        && !has(finder, defaultMainType + 'Name')
    ) {
        finder[defaultMainType + 'Index'] = 0;
    }

    var result = {};

    each(finder, function (value, key) {
        var value = finder[key];

        // Exclude 'dataIndex' and other illgal keys.
        if (key === 'dataIndex' || key === 'dataIndexInside') {
            result[key] = value;
            return;
        }

        var parsedKey = key.match(/^(\w+)(Index|Id|Name)$/) || [];
        var mainType = parsedKey[1];
        var queryType = (parsedKey[2] || '').toLowerCase();

        if (!mainType
            || !queryType
            || value == null
            || (queryType === 'index' && value === 'none')
            || (opt && opt.includeMainTypes && zrUtil.indexOf(opt.includeMainTypes, mainType) < 0)
        ) {
            return;
        }

        var queryParam = {mainType: mainType};
        if (queryType !== 'index' || value !== 'all') {
            queryParam[queryType] = value;
        }

        var models = ecModel.queryComponents(queryParam);
        result[mainType + 'Models'] = models;
        result[mainType + 'Model'] = models[0];
    });

    return result;
}

function has(obj, prop) {
    return obj && obj.hasOwnProperty(prop);
}

export function setAttribute(dom, key, value) {
    dom.setAttribute
        ? dom.setAttribute(key, value)
        : (dom[key] = value);
}

export function getAttribute(dom, key) {
    return dom.getAttribute
        ? dom.getAttribute(key)
        : dom[key];
}

export function getTooltipRenderMode(renderModeOption) {
    if (renderModeOption === 'auto') {
        // Using html when `document` exists, use richText otherwise
        return env.domSupported ? 'html' : 'richText';
    }
    else {
        return renderModeOption || 'html';
    }
}

/**
 * Group a list by key.
 *
 * @param {Array} array
 * @param {Function} getKey
 *        param {*} Array item
 *        return {string} key
 * @return {Object} Result
 *        {Array}: keys,
 *        {module:zrender/core/util/HashMap} buckets: {key -> Array}
 */
export function groupData(array, getKey) {
    var buckets = zrUtil.createHashMap();
    var keys = [];

    zrUtil.each(array, function (item) {
        var key = getKey(item);
        (buckets.get(key)
            || (keys.push(key), buckets.set(key, []))
        ).push(item);
    });

    return {keys: keys, buckets: buckets};
}
