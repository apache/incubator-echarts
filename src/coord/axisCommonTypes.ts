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
    TextCommonOption, LineStyleOption, OrdinalRawValue, ZRColor,
    AreaStyleOption, ComponentOption, ColorString,
    AnimationOptionMixin, Dictionary, ScaleDataValue
} from '../util/types';


export const AXIS_TYPES = {value: 1, category: 1, time: 1, log: 1} as const;
export type OptionAxisType = keyof typeof AXIS_TYPES;


export interface AxisBaseOption extends ComponentOption,
    AnimationOptionMixin {  // Support transition animation
    type?: OptionAxisType;
    show?: boolean;
    // Inverse the axis.
    inverse?: boolean;
    // Axis name displayed.
    name?: string;
    nameLocation?: 'start' | 'middle' | 'end';
    // By degree.
    nameRotate?: number;
    nameTruncate?: {
        maxWidth?: number;
        ellipsis?: string;
        placeholder?: string;
    };
    nameTextStyle?: AxisNameTextStyleOption;
    // The gap between axisName and axisLine.
    nameGap?: number;

    silent?: boolean;
    triggerEvent?: boolean;

    tooltip?: {
        show?: boolean;
    };

    axisPointer?: any; // FIXME:TS axisPointerOption type?
    axisLine?: AxisLineOption;
    axisTick?: AxisTickOption;
    axisLabel?: AxisLabelOption;
    minorTick?: MinorTickOption;
    splitLine?: SplitLineOption;
    minorSplitLine?: MinorSplitLineOption;
    splitArea?: SplitAreaOption;

    // The gap at both ends of the axis.
    // For category axis: boolean.
    // For value axis: [GAP, GAP], where
    // `GAP` can be an absolute pixel number (like `35`), or percent (like `'30%'`)
    boundaryGap?: boolean | [number | string, number | string];

    // Min value of the axis. can be:
    // + ScaleDataValue
    // + 'dataMin': use the min value in data.
    // + null/undefined: auto decide min value (consider pretty look and boundaryGap).
    min?: ScaleDataValue | 'dataMin' | ((extent: {min: number, max: number}) => ScaleDataValue);
    // Max value of the axis. can be:
    // + ScaleDataValue
    // + 'dataMax': use the max value in data.
    // + null/undefined: auto decide max value (consider pretty look and boundaryGap).
    max?: ScaleDataValue | 'dataMax' | ((extent: {min: number, max: number}) => ScaleDataValue);
    // Optional value can be:
    // + `false`: always include value 0.
    // + `true`: the extent do not consider value 0.
    scale?: boolean;


    // --------------------------------------------
    // [Properties below only for 'category' axis]:

    // Set false to faster category collection.
    // Only usefull in the case like: category is
    // ['2012-01-01', '2012-01-02', ...], where the input
    // data has been ensured not duplicate and is large data.
    // null means "auto":
    // if axis.data provided, do not deduplication,
    // else do deduplication.
    deduplication?: boolean;
    data?: (OrdinalRawValue | {
        value: OrdinalRawValue;
        textStyle?: TextCommonOption;
    })[];


    // ------------------------------------------------------
    // [Properties below only for 'value'/'log'/'time' axes]:

    // AxisTick and axisLabel and splitLine are caculated based on splitNumber.
    splitNumber?: number;
    // Interval specifies the span of the ticks is mandatorily.
    interval?: number;
    // Specify min interval when auto calculate tick interval.
    minInterval?: number;
    // Specify max interval when auto calculate tick interval.
    maxInterval?: number;


    // ---------------------------------------
    // [Properties below only for 'log' axis]:

    logBase?: number;
}

interface AxisNameTextStyleOption extends TextCommonOption {
    rich?: Dictionary<TextCommonOption>
}

interface AxisLineOption {
    show?: boolean | 'auto',
    onZero?: boolean,
    onZeroAxisIndex?: number,
    // The arrow at both ends the the axis.
    symbol?: string | [string, string],
    symbolSize?: number[],
    symbolOffset?: string | number | (string | number)[],
    lineStyle?: LineStyleOption,
}

interface AxisTickOption {
    show?: boolean | 'auto',
    // Whether axisTick is inside the grid or outside the grid.
    inside?: boolean,
    // The length of axisTick.
    length?: number,
    lineStyle?: LineStyleOption
    customValues?: (number | string | Date)[],

    // --------------------------------------------
    // [Properties below only for 'category' axis]:

    // If tick is align with label when boundaryGap is true
    alignWithLabel?: boolean,
    interval?: 'auto' | number | ((index: number, value: string) => boolean)
}

export type AxisLabelFormatterOption = string | ((value: OrdinalRawValue | number, index: number) => string);

type TimeAxisLabelUnitFormatter = AxisLabelFormatterOption | string[];

export type TimeAxisLabelFormatterOption = string
    | ((value: number, index: number, extra: {level: number}) => string)
    | {
        year?: TimeAxisLabelUnitFormatter,
        month?: TimeAxisLabelUnitFormatter,
        week?: TimeAxisLabelUnitFormatter,
        day?: TimeAxisLabelUnitFormatter,
        hour?: TimeAxisLabelUnitFormatter,
        minute?: TimeAxisLabelUnitFormatter,
        second?: TimeAxisLabelUnitFormatter,
        millisecond?: TimeAxisLabelUnitFormatter,
        inherit?: boolean
    };

interface AxisLabelOption extends Omit<TextCommonOption, 'color'> {
    show?: boolean,
    // Whether axisLabel is inside the grid or outside the grid.
    inside?: boolean,
    rotate?: number,
    // true | false | null/undefined (auto)
    showMinLabel?: boolean,
    // true | false | null/undefined (auto)
    showMaxLabel?: boolean,
    margin?: number,
    // value is supposed to be OptionDataPrimitive but for time axis, it is time stamp.
    formatter?: AxisLabelFormatterOption | TimeAxisLabelFormatterOption,
    customValues?: (number | string | Date)[],

    // --------------------------------------------
    // [Properties below only for 'category' axis]:

    interval?: 'auto' | number | ((index: number, value: string) => boolean)

    // Color can be callback
    color?: ColorString | ((value?: string | number, index?: number) => ColorString)

    rich?: Dictionary<TextCommonOption>
}

interface MinorTickOption {
    show?: boolean,
    splitNumber?: number,
    length?: number,
    lineStyle?: LineStyleOption
}

interface SplitLineOption {
    show?: boolean,
    interval?: 'auto' | number | ((index:number, value: string) => boolean)
    // colors will display in turn
    lineStyle?: LineStyleOption<ZRColor | ZRColor[]>
}

interface MinorSplitLineOption {
    show?: boolean,
    lineStyle?: LineStyleOption
}

interface SplitAreaOption {
    show?: boolean,
    interval?: 'auto' | number | ((index:number, value: string) => boolean)
    // colors will display in turn
    areaStyle?: AreaStyleOption<ZRColor[]>
}
