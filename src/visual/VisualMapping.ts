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
import * as zrColor from 'zrender/src/tool/color';
import {linearMap} from '../util/number';
import { AllPropTypes, Dictionary } from 'zrender/src/core/types';
import {
    ColorString,
    BuiltinVisualProperty,
    VisualOptionPiecewise,
    VisualOptionCategory,
    VisualOptionLinear,
    VisualOptionUnit,
    ParsedValue
} from '../util/types';

const each = zrUtil.each;
const isObject = zrUtil.isObject;

const CATEGORY_DEFAULT_VISUAL_INDEX = -1;

// Type of raw value
type RawValue = ParsedValue;
// Type of mapping visual value
type VisualValue = AllPropTypes<VisualOptionUnit>;
// Type of value after normalized. 0 - 1
type NormalizedValue = number;

type MappingMethod = 'linear' | 'piecewise' | 'category' | 'fixed';

// May include liftZ. wich is not provided to developers.

interface Normalizer {
    (this: VisualMapping, value?: RawValue): NormalizedValue
}
interface ColorMapper {
    (this: VisualMapping, value: RawValue | NormalizedValue, isNormalized?: boolean, out?: number[])
        : ColorString | number[]
}
interface DoMap {
    (this: VisualMapping, normalzied?: NormalizedValue, value?: RawValue): VisualValue
}
interface VisualValueGetter {
    (key: string): VisualValue
}
interface VisualValueSetter {
    (key: string, value: VisualValue): void
}
interface VisualHandler {
    applyVisual(
        this: VisualMapping,
        value: RawValue,
        getter: VisualValueGetter,
        setter: VisualValueSetter
    ): void

    _normalizedToVisual: {
        linear(this: VisualMapping, normalized: NormalizedValue): VisualValue
        category(this: VisualMapping, normalized: NormalizedValue): VisualValue
        piecewise(this: VisualMapping, normalzied: NormalizedValue, value: RawValue): VisualValue
        fixed(this: VisualMapping): VisualValue
    }
    /**
     * Get color mapping for the outside usage.
     * Currently only used in `color` visual.
     *
     * The last parameter out is cached color array.
     */
    getColorMapper?: (this: VisualMapping) => ColorMapper
}

interface VisualMappingPiece {
    index?: number

    value?: number | string
    interval?: [number, number]
    close?: [0 | 1, 0 | 1]

    text?: string

    visual?: VisualOptionPiecewise
}

export interface VisualMappingOption {
    type?: BuiltinVisualProperty

    mappingMethod?: MappingMethod

    /**
     * required when mappingMethod is 'linear'
     */
    dataExtent?: [number, number]
    /**
     *  required when mappingMethod is 'piecewise'.
     *  Visual for only each piece can be specified
     * [
     *   {value: someValue},
     *   {interval: [min1, max1], visual: {...}},
     *   {interval: [min2, max2]}
     *  ],.
     */
    pieceList?: VisualMappingPiece[]
    /**
     * required when mappingMethod is 'category'. If no option.categories, categories is set as [0, 1, 2, ...].
     */
    categories?: (string | number)[]
    /**
     * Whether loop mapping when mappingMethod is 'category'.
     * @default false
     */
    loop?: boolean
    /**
     * Visual data
     * when mappingMethod is 'category', visual data can be array or object
     * (like: {cate1: '#222', none: '#fff'})
     * or primary types (which represents default category visual), otherwise visual
     * can be array or primary (which will be normalized to array).
     */
    visual?: VisualValue[] | Dictionary<VisualValue> | VisualValue
}

interface VisualMappingInnerPiece extends VisualMappingPiece {
    originIndex: number
}
interface VisualMappingInnerOption extends VisualMappingOption {
    hasSpecialVisual: boolean
    pieceList: VisualMappingInnerPiece[]
    /**
     * Map to get category index
     */
    categoryMap: Dictionary<number>
    /**
     * Cached parsed rgba array from string to avoid parse every time.
     */
    parsedVisual: number[][]

    // Have converted primary value to array.
    visual?: VisualValue[] | Dictionary<VisualValue>
}

class VisualMapping<VisualOption
    extends VisualOptionPiecewise | VisualOptionCategory | VisualOptionUnit | VisualOptionLinear = {}
> {

    option: VisualMappingInnerOption;

    type: BuiltinVisualProperty;

    mappingMethod: MappingMethod;

    applyVisual: VisualHandler['applyVisual'];

    getColorMapper: VisualHandler['getColorMapper'];

    _normalizeData: Normalizer;

    _normalizedToVisual: DoMap;

    constructor(option: VisualMappingOption) {
        const mappingMethod = option.mappingMethod;
        const visualType = option.type;

        const thisOption: VisualMappingInnerOption = this.option = zrUtil.clone(option) as VisualMappingInnerOption;

        this.type = visualType;
        this.mappingMethod = mappingMethod;

        this._normalizeData = normalizers[mappingMethod];
        const visualHandler = VisualMapping.visualHandlers[visualType];

        this.applyVisual = visualHandler.applyVisual;

        this.getColorMapper = visualHandler.getColorMapper;

        this._normalizedToVisual = visualHandler._normalizedToVisual[mappingMethod];

        if (mappingMethod === 'piecewise') {
            normalizeVisualRange(thisOption);
            preprocessForPiecewise(thisOption);
        }
        else if (mappingMethod === 'category') {
            thisOption.categories
                ? preprocessForSpecifiedCategory(thisOption)
                // categories is ordinal when thisOption.categories not specified,
                // which need no more preprocess except normalize visual.
                : normalizeVisualRange(thisOption, true);
        }
        else { // mappingMethod === 'linear' or 'fixed'
            zrUtil.assert(mappingMethod !== 'linear' || thisOption.dataExtent);
            normalizeVisualRange(thisOption);
        }
    }

    mapValueToVisual(value: RawValue): VisualValue {
        const normalized = this._normalizeData(value);
        return this._normalizedToVisual(normalized, value);
    }

    getNormalizer() {
        return zrUtil.bind(this._normalizeData, this);
    }

    static visualHandlers: {[key in BuiltinVisualProperty]: VisualHandler} = {
        color: {
            applyVisual: makeApplyVisual('color'),
            getColorMapper: function () {
                const thisOption = this.option;

                return zrUtil.bind(
                    thisOption.mappingMethod === 'category'
                        ? function (
                            this: VisualMapping,
                            value: NormalizedValue | RawValue,
                            isNormalized?: boolean
                        ): ColorString {
                            !isNormalized && (value = this._normalizeData(value));
                            return doMapCategory.call(this, value) as ColorString;
                        }
                        : function (
                            this: VisualMapping,
                            value: NormalizedValue | RawValue,
                            isNormalized?: boolean,
                            out?: number[]
                        ): number[] | string {
                            // If output rgb array
                            // which will be much faster and useful in pixel manipulation
                            const returnRGBArray = !!out;
                            !isNormalized && (value = this._normalizeData(value));
                            out = zrColor.fastLerp(value as NormalizedValue, thisOption.parsedVisual, out);
                            return returnRGBArray ? out : zrColor.stringify(out, 'rgba');
                        },
                    this
                );
            },

            _normalizedToVisual: {
                linear: function (normalized) {
                    return zrColor.stringify(
                        zrColor.fastLerp(normalized, this.option.parsedVisual),
                        'rgba'
                    );
                },
                category: doMapCategory,
                piecewise: function (normalized, value) {
                    let result = getSpecifiedVisual.call(this, value);
                    if (result == null) {
                        result = zrColor.stringify(
                            zrColor.fastLerp(normalized, this.option.parsedVisual),
                            'rgba'
                        );
                    }
                    return result;
                },
                fixed: doMapFixed
            }
        },

        colorHue: makePartialColorVisualHandler(function (color: ColorString, value: number) {
            return zrColor.modifyHSL(color, value);
        }),

        colorSaturation: makePartialColorVisualHandler(function (color: ColorString, value: number) {
            return zrColor.modifyHSL(color, null, value);
        }),

        colorLightness: makePartialColorVisualHandler(function (color: ColorString, value: number) {
            return zrColor.modifyHSL(color, null, null, value);
        }),

        colorAlpha: makePartialColorVisualHandler(function (color: ColorString, value: number) {
            return zrColor.modifyAlpha(color, value);
        }),

        decal: {
            applyVisual: makeApplyVisual('decal'),
            _normalizedToVisual: {
                linear: null,
                category: doMapCategory,
                piecewise: null,
                fixed: null
            }
        },

        opacity: {
            applyVisual: makeApplyVisual('opacity'),
            _normalizedToVisual: createNormalizedToNumericVisual([0, 1])
        },

        liftZ: {
            applyVisual: makeApplyVisual('liftZ'),
            _normalizedToVisual: {
                linear: doMapFixed,
                category: doMapFixed,
                piecewise: doMapFixed,
                fixed: doMapFixed
            }
        },

        symbol: {
            applyVisual: function (value, getter, setter) {
                const symbolCfg = this.mapValueToVisual(value);
                setter('symbol', symbolCfg as string);
            },
            _normalizedToVisual: {
                linear: doMapToArray,
                category: doMapCategory,
                piecewise: function (normalized, value) {
                    let result = getSpecifiedVisual.call(this, value);
                    if (result == null) {
                        result = doMapToArray.call(this, normalized);
                    }
                    return result;
                },
                fixed: doMapFixed
            }
        },

        symbolSize: {
            applyVisual: makeApplyVisual('symbolSize'),
            _normalizedToVisual: createNormalizedToNumericVisual([0, 1])
        },

        cursor: {
            applyVisual: function (value, getter, setter) {
                const symbolCfg = this.mapValueToVisual(value);
                setter('symbol', symbolCfg as string);
            },
            _normalizedToVisual: {
                linear: doMapToArray,
                category: doMapCategory,
                piecewise: function (normalized, value) {
                    let result = getSpecifiedVisual.call(this, value);
                    if (result == null) {
                        result = doMapToArray.call(this, normalized);
                    }
                    return result;
                },
                fixed: doMapFixed
            }
        }
    };


    /**
     * List available visual types.
     *
     * @public
     * @return {Array.<string>}
     */
    static listVisualTypes() {
        return zrUtil.keys(VisualMapping.visualHandlers);
    }

    // /**
    //  * @public
    //  */
    // static addVisualHandler(name, handler) {
    //     visualHandlers[name] = handler;
    // }

    /**
     * @public
     */
    static isValidType(visualType: string): boolean {
        return VisualMapping.visualHandlers.hasOwnProperty(visualType);
    }

    /**
     * Convinent method.
     * Visual can be Object or Array or primary type.
     */
    static eachVisual<Ctx, T>(
        visual: T | T[] | Dictionary<T>,
        callback: (visual: T, key?: string | number) => void,
        context?: Ctx
    ) {
        if (zrUtil.isObject(visual)) {
            zrUtil.each(visual as Dictionary<T>, callback, context);
        }
        else {
            callback.call(context, visual);
        }
    }

    static mapVisual<Ctx, T>(visual: T, callback: (visual: T, key?: string | number) => T, context?: Ctx): T
    static mapVisual<Ctx, T>(visual: T[], callback: (visual: T, key?: string | number) => T[], context?: Ctx): T[]
    static mapVisual<Ctx, T>(
        visual: Dictionary<T>,
        callback: (visual: T, key?: string | number) => Dictionary<T>,
        context?: Ctx
    ): Dictionary<T>
    static mapVisual<Ctx, T>(
        visual: T | T[] | Dictionary<T>,
        callback: (visual: T, key?: string | number) => T | T[] | Dictionary<T>,
        context?: Ctx
    ) {
        let isPrimary: boolean;
        let newVisual: T | T[] | Dictionary<T> = zrUtil.isArray(visual)
            ? []
            : zrUtil.isObject(visual)
            ? {}
            : (isPrimary = true, null);

        VisualMapping.eachVisual(visual, function (v, key) {
            const newVal = callback.call(context, v, key);
            isPrimary ? (newVisual = newVal) : ((newVisual as Dictionary<T>)[key as string] = newVal as T);
        });
        return newVisual;
    }

    /**
     * Retrieve visual properties from given object.
     */
    static retrieveVisuals(obj: Dictionary<any>): VisualOptionPiecewise {
        const ret: VisualOptionPiecewise = {};
        let hasVisual: boolean;

        obj && each(VisualMapping.visualHandlers, function (h, visualType: BuiltinVisualProperty) {
            if (obj.hasOwnProperty(visualType)) {
                (ret as any)[visualType] = obj[visualType];
                hasVisual = true;
            }
        });

        return hasVisual ? ret : null;
    }

    /**
     * Give order to visual types, considering colorSaturation, colorAlpha depends on color.
     *
     * @public
     * @param {(Object|Array)} visualTypes If Object, like: {color: ..., colorSaturation: ...}
     *                                     IF Array, like: ['color', 'symbol', 'colorSaturation']
     * @return {Array.<string>} Sorted visual types.
     */
    static prepareVisualTypes(
        visualTypes: {[key in BuiltinVisualProperty]?: any} | BuiltinVisualProperty[]
    ) {
        if (zrUtil.isArray(visualTypes)) {
            visualTypes = visualTypes.slice();
        }
        else if (isObject(visualTypes)) {
            const types: BuiltinVisualProperty[] = [];
            each(visualTypes, function (item: unknown, type: BuiltinVisualProperty) {
                types.push(type);
            });
            visualTypes = types;
        }
        else {
            return [];
        }

        visualTypes.sort(function (type1: BuiltinVisualProperty, type2: BuiltinVisualProperty) {
            // color should be front of colorSaturation, colorAlpha, ...
            // symbol and symbolSize do not matter.
            return (type2 === 'color' && type1 !== 'color' && type1.indexOf('color') === 0)
                ? 1 : -1;
        });

        return visualTypes;
    }

    /**
     * 'color', 'colorSaturation', 'colorAlpha', ... are depends on 'color'.
     * Other visuals are only depends on themself.
     */
    static dependsOn(visualType1: BuiltinVisualProperty, visualType2: BuiltinVisualProperty) {
        return visualType2 === 'color'
            ? !!(visualType1 && visualType1.indexOf(visualType2) === 0)
            : visualType1 === visualType2;
    }

    /**
     * @param value
     * @param pieceList [{value: ..., interval: [min, max]}, ...]
     *                         Always from small to big.
     * @param findClosestWhenOutside Default to be false
     * @return index
     */
    static findPieceIndex(value: number, pieceList: VisualMappingPiece[], findClosestWhenOutside?: boolean): number {
        let possibleI: number;
        let abs = Infinity;

        // value has the higher priority.
        for (let i = 0, len = pieceList.length; i < len; i++) {
            const pieceValue = pieceList[i].value;
            if (pieceValue != null) {
                if (pieceValue === value
                    // FIXME
                    // It is supposed to compare value according to value type of dimension,
                    // but currently value type can exactly be string or number.
                    // Compromise for numeric-like string (like '12'), especially
                    // in the case that visualMap.categories is ['22', '33'].
                    || (typeof pieceValue === 'string' && pieceValue === value + '')
                ) {
                    return i;
                }
                findClosestWhenOutside && updatePossible(pieceValue as number, i);
            }
        }

        for (let i = 0, len = pieceList.length; i < len; i++) {
            const piece = pieceList[i];
            const interval = piece.interval;
            const close = piece.close;

            if (interval) {
                if (interval[0] === -Infinity) {
                    if (littleThan(close[1], value, interval[1])) {
                        return i;
                    }
                }
                else if (interval[1] === Infinity) {
                    if (littleThan(close[0], interval[0], value)) {
                        return i;
                    }
                }
                else if (
                    littleThan(close[0], interval[0], value)
                    && littleThan(close[1], value, interval[1])
                ) {
                    return i;
                }
                findClosestWhenOutside && updatePossible(interval[0], i);
                findClosestWhenOutside && updatePossible(interval[1], i);
            }
        }

        if (findClosestWhenOutside) {
            return value === Infinity
                ? pieceList.length - 1
                : value === -Infinity
                ? 0
                : possibleI;
        }

        function updatePossible(val: number, index: number) {
            const newAbs = Math.abs(val - value);
            if (newAbs < abs) {
                abs = newAbs;
                possibleI = index;
            }
        }

    }
}

function preprocessForPiecewise(thisOption: VisualMappingInnerOption) {
    const pieceList = thisOption.pieceList;
    thisOption.hasSpecialVisual = false;

    zrUtil.each(pieceList, function (piece, index) {
        piece.originIndex = index;
        // piece.visual is "result visual value" but not
        // a visual range, so it does not need to be normalized.
        if (piece.visual != null) {
            thisOption.hasSpecialVisual = true;
        }
    });
}

function preprocessForSpecifiedCategory(thisOption: VisualMappingInnerOption) {
    // Hash categories.
    const categories = thisOption.categories;
    const categoryMap: VisualMappingInnerOption['categoryMap'] = thisOption.categoryMap = {};

    let visual = thisOption.visual;
    each(categories, function (cate, index) {
        categoryMap[cate] = index;
    });

    // Process visual map input.
    if (!zrUtil.isArray(visual)) {
        const visualArr: VisualValue[] = [];

        if (zrUtil.isObject(visual)) {
            each(visual, function (v, cate) {
                const index = categoryMap[cate];
                visualArr[index != null ? index : CATEGORY_DEFAULT_VISUAL_INDEX] = v;
            });
        }
        else { // Is primary type, represents default visual.
            visualArr[CATEGORY_DEFAULT_VISUAL_INDEX] = visual;
        }

        visual = setVisualToOption(thisOption, visualArr);
    }

    // Remove categories that has no visual,
    // then we can mapping them to CATEGORY_DEFAULT_VISUAL_INDEX.
    for (let i = categories.length - 1; i >= 0; i--) {
        if (visual[i] == null) {
            delete categoryMap[categories[i]];
            categories.pop();
        }
    }
}

function normalizeVisualRange(thisOption: VisualMappingInnerOption, isCategory?: boolean) {
    const visual = thisOption.visual;
    const visualArr: VisualValue[] = [];

    if (zrUtil.isObject(visual)) {
        each(visual, function (v) {
            visualArr.push(v);
        });
    }
    else if (visual != null) {
        visualArr.push(visual);
    }

    const doNotNeedPair = {color: 1, symbol: 1};

    if (!isCategory
        && visualArr.length === 1
        && !doNotNeedPair.hasOwnProperty(thisOption.type)
    ) {
        // Do not care visualArr.length === 0, which is illegal.
        visualArr[1] = visualArr[0];
    }

    setVisualToOption(thisOption, visualArr);
}

function makePartialColorVisualHandler(
    applyValue: (prop: VisualValue, value: NormalizedValue) => VisualValue
): VisualHandler {
    return {
        applyVisual: function (value, getter, setter) {
            // Only used in HSL
            const colorChannel = this.mapValueToVisual(value);
            // Must not be array value
            setter('color', applyValue(getter('color'), colorChannel as number));
        },
        _normalizedToVisual: createNormalizedToNumericVisual([0, 1])
    };
}

function doMapToArray(this: VisualMapping<VisualOptionLinear>, normalized: NormalizedValue): VisualValue {
    const visual = this.option.visual as VisualValue[];
    return visual[
        Math.round(linearMap(normalized, [0, 1], [0, visual.length - 1], true))
    ] || {} as any;    // TODO {}?
}

function makeApplyVisual(visualType: string): VisualHandler['applyVisual'] {
    return function (value, getter, setter) {
        setter(visualType, this.mapValueToVisual(value));
    };
}

function doMapCategory(this: VisualMapping<VisualOptionCategory>, normalized: NormalizedValue): VisualValue {
    const visual = this.option.visual as Dictionary<any>;
    return visual[
        (this.option.loop && normalized !== CATEGORY_DEFAULT_VISUAL_INDEX)
            ? normalized % visual.length
            : normalized
    ];
}

function doMapFixed(this: VisualMapping): VisualValue {
    // visual will be convert to array.
    return (this.option.visual as VisualValue[])[0];
}

/**
 * Create mapped to numeric visual
 */
function createNormalizedToNumericVisual(sourceExtent: [number, number]): VisualHandler['_normalizedToVisual'] {
    return {
        linear: function (normalized) {
            return linearMap(normalized, sourceExtent, this.option.visual as [number, number], true);
        },
        category: doMapCategory,
        piecewise: function (normalized, value) {
            let result = getSpecifiedVisual.call(this, value);
            if (result == null) {
                result = linearMap(normalized, sourceExtent, this.option.visual as [number, number], true);
            }
            return result;
        },
        fixed: doMapFixed
    };
}

function getSpecifiedVisual(this: VisualMapping, value: number) {
    const thisOption = this.option;
    const pieceList = thisOption.pieceList;
    if (thisOption.hasSpecialVisual) {
        const pieceIndex = VisualMapping.findPieceIndex(value, pieceList);
        const piece = pieceList[pieceIndex];
        if (piece && piece.visual) {
            return piece.visual[this.type];
        }
    }
}

function setVisualToOption(thisOption: VisualMappingInnerOption, visualArr: VisualValue[]) {
    thisOption.visual = visualArr;
    if (thisOption.type === 'color') {
        thisOption.parsedVisual = zrUtil.map(visualArr, function (item: string) {
            return zrColor.parse(item);
        });
    }
    return visualArr;
}


/**
 * Normalizers by mapping methods.
 */
const normalizers: { [key in MappingMethod]: Normalizer } = {
    linear: function (value: RawValue): NormalizedValue {
        return linearMap(value as number, this.option.dataExtent, [0, 1], true);
    },

    piecewise: function (value: RawValue): NormalizedValue {
        const pieceList = this.option.pieceList;
        const pieceIndex = VisualMapping.findPieceIndex(value as number, pieceList, true);
        if (pieceIndex != null) {
            return linearMap(pieceIndex, [0, pieceList.length - 1], [0, 1], true);
        }
    },

    category: function (value: RawValue): NormalizedValue {
        const index: number = this.option.categories
            ? this.option.categoryMap[value]
            : value as number; // ordinal value
        return index == null ? CATEGORY_DEFAULT_VISUAL_INDEX : index;
    },

    fixed: zrUtil.noop as Normalizer
};


function littleThan(close: boolean | 0 | 1, a: number, b: number): boolean {
    return close ? a <= b : a < b;
}

export default VisualMapping;
