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


import * as clazzUtil from '../util/clazz';
import { Dictionary } from 'zrender/src/core/types';
import List from '../data/List';
import {
    DimensionName,
    ScaleDataValue,
    OptionDataValue,
    DimensionLoose,
    ScaleTick
} from '../util/types';
import { ScaleRawExtentInfo } from '../coord/scaleRawExtentInfo';


abstract class Scale<SETTING extends Dictionary<unknown> = Dictionary<unknown>> {

    type: string;

    private _setting: SETTING;

    protected _extent: [number, number];

    private _isBlank: boolean;

    // Inject
    readonly rawExtentInfo: ScaleRawExtentInfo;

    constructor(setting?: SETTING) {
        this._setting = setting || {} as SETTING;
        this._extent = [Infinity, -Infinity];
    }

    getSetting<KEY extends keyof SETTING>(name: KEY): SETTING[KEY] {
        return this._setting[name];
    }

    /**
     * Parse input val to valid inner number.
     * Notice: This would be a trap here, If the implementation
     * of this method depends on extent, and this method is used
     * before extent set (like in dataZoom), it would be wrong.
     * Nevertheless, parse does not depend on extent generally.
     */
    abstract parse(val: OptionDataValue): number;

    /**
     * Whether contain the given value.
     */
    abstract contain(val: ScaleDataValue): boolean;

    /**
     * Normalize value to linear [0, 1], return 0.5 if extent span is 0.
     */
    abstract normalize(val: ScaleDataValue): number;

    /**
     * Scale normalized value to extent.
     */
    abstract scale(val: number): number;

    /**
     * Set extent from data
     */
    unionExtent(other: [number, number]): void {
        const extent = this._extent;
        other[0] < extent[0] && (extent[0] = other[0]);
        other[1] > extent[1] && (extent[1] = other[1]);
        // not setExtent because in log axis it may transformed to power
        // this.setExtent(extent[0], extent[1]);
    }

    /**
     * Set extent from data
     */
    unionExtentFromData(data: List, dim: DimensionName | DimensionLoose): void {
        this.unionExtent(data.getApproximateExtent(dim));
    }

    /**
     * Get extent
     *
     * Extent is always in increase order.
     */
    getExtent(): [number, number] {
        return this._extent.slice() as [number, number];
    }

    /**
     * Set extent
     */
    setExtent(start: number, end: number): void {
        const thisExtent = this._extent;
        if (!isNaN(start)) {
            thisExtent[0] = start;
        }
        if (!isNaN(end)) {
            thisExtent[1] = end;
        }
    }

    /**
     * If value is in extent range
     */
    isInExtentRange(value: number): boolean {
        return this._extent[0] <= value && this._extent[1] >= value;
    }

    /**
     * When axis extent depends on data and no data exists,
     * axis ticks should not be drawn, which is named 'blank'.
     */
    isBlank(): boolean {
        return this._isBlank;
    }

    /**
     * When axis extent depends on data and no data exists,
     * axis ticks should not be drawn, which is named 'blank'.
     */
    setBlank(isBlank: boolean) {
        this._isBlank = isBlank;
    }

    /**
     * Update interval and extent of intervals for nice ticks
     *
     * @param splitNumber Approximated tick numbers. Optional.
     *        The implementation of `niceTicks` should decide tick numbers
     *        whether `splitNumber` is given.
     * @param minInterval Optional.
     * @param maxInterval Optional.
     */
    abstract niceTicks(
        // FIXME:TS make them in a "opt", the same with `niceExtent`?
        splitNumber?: number,
        minInterval?: number,
        maxInterval?: number
    ): void;

    abstract niceExtent(
        opt?: {
            splitNumber?: number,
            fixMin?: boolean,
            fixMax?: boolean,
            minInterval?: number,
            maxInterval?: number,
            interval?: number
        }
    ): void;

    /**
     * @return label of the tick.
     */
    abstract getLabel(tick: ScaleTick): string;

    abstract getTicks(expandToNicedExtent?: boolean): ScaleTick[];

    abstract getMinorTicks(splitNumber: number): number[][];

    static registerClass: clazzUtil.ClassManager['registerClass'];

    static getClass: clazzUtil.ClassManager['getClass'];
}

type ScaleConstructor = typeof Scale & clazzUtil.ClassManager;
clazzUtil.enableClassManagement(Scale as ScaleConstructor);

export default Scale;