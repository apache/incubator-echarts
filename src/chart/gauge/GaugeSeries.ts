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

import createListSimply from '../helper/createListSimply';
import SeriesModel from '../../model/Series';
import {
    SeriesOption,
    CircleLayoutOptionMixin,
    LineStyleOption,
    ColorString,
    LabelOption,
    ItemStyleOption,
    OptionDataValueNumeric,
    StatesOptionMixin,
    SeriesEncodeOptionMixin,
    ColorByMixin
} from '../../util/types';
import GlobalModel from '../../model/Global';
import List from '../../data/List';

// [percent, color]
type GaugeColorStop = [number, ColorString];

interface LabelFormatter {
    (value: number): string
}

interface PointerOption {
    icon?: string
    show?: boolean
    keepAspect?: boolean
    itemStyle?: ItemStyleOption
    /**
     * Can be percent
     */
    offsetCenter?: (number | string)[]
    length?: number | string
    width?: number
}

interface AnchorOption {
    show?: boolean
    showAbove?: boolean
    size?: number
    icon?: string
    offsetCenter?: (number | string)[]
    keepAspect?: boolean
    itemStyle?: ItemStyleOption
}

interface ProgressOption {
    show?: boolean
    overlap?: boolean
    width?: number
    roundCap?: boolean
    clip?: boolean
    itemStyle?: ItemStyleOption
}

interface TitleOption extends LabelOption {
    /**
     * [x, y] offset
     */
    offsetCenter?: (number | string)[]
    formatter?: LabelFormatter | string

    /**
     * If do value animtion.
     */
    valueAnimation?: boolean
}

interface DetailOption extends LabelOption {
    /**
     * [x, y] offset
     */
    offsetCenter?: (number | string)[]
    formatter?: LabelFormatter | string

    /**
     * If do value animtion.
     */
    valueAnimation?: boolean
}

export interface GaugeStateOption {
    itemStyle?: ItemStyleOption
}

export interface GaugeDataItemOption extends GaugeStateOption, StatesOptionMixin<GaugeStateOption> {
    name?: string
    value?: OptionDataValueNumeric
    pointer?: PointerOption
    progress?: ProgressOption
    title?: TitleOption
    detail?: DetailOption
}
export interface GaugeSeriesOption extends SeriesOption<GaugeStateOption>, GaugeStateOption,
    ColorByMixin,
    CircleLayoutOptionMixin, SeriesEncodeOptionMixin {
    type?: 'gauge'

    // override radius
    radius?: number | string

    startAngle?: number
    endAngle?: number
    clockwise?: boolean

    min?: number
    max?: number

    splitNumber?: number

    itemStyle?: ItemStyleOption

    axisLine?: {
        show?: boolean
        roundCap?: boolean
        lineStyle?: Omit<LineStyleOption, 'color'> & {
            color?: GaugeColorStop[]
        }
    },

    progress?: ProgressOption

    splitLine?: {
        show?: boolean
        /**
         * Can be percent
         */
        length?: number
        distance?: number
        lineStyle?: LineStyleOption
    }

    axisTick?: {
        show?: boolean
        splitNumber?: number
        /**
         * Can be percent
         */
        length?: number | string
        distance?: number
        lineStyle?: LineStyleOption
    }

    axisLabel?: LabelOption & {
        formatter?: LabelFormatter | string
    }

    pointer?: PointerOption
    anchor?: AnchorOption

    title?: TitleOption
    detail?: DetailOption

    data?: (OptionDataValueNumeric | GaugeDataItemOption)[]
}

class GaugeSeriesModel extends SeriesModel<GaugeSeriesOption> {

    static type = 'series.gauge' as const;
    type = GaugeSeriesModel.type;

    visualStyleAccessPath = 'itemStyle';

    getInitialData(option: GaugeSeriesOption, ecModel: GlobalModel): List {
        return createListSimply(this, ['value']);
    }

    static defaultOption: GaugeSeriesOption = {
        zlevel: 0,
        z: 2,
        colorBy: 'data',
        // 默认全局居中
        center: ['50%', '50%'],
        legendHoverLink: true,
        radius: '75%',
        startAngle: 225,
        endAngle: -45,
        clockwise: true,
        // 最小值
        min: 0,
        // 最大值
        max: 100,
        // 分割段数，默认为10
        splitNumber: 10,
        // 坐标轴线
        axisLine: {
            // 默认显示，属性show控制显示与否
            show: true,
            roundCap: false,
            lineStyle: {       // 属性lineStyle控制线条样式
                color: [[1, '#E6EBF8']],
                width: 10
            }
        },
        // 坐标轴线
        progress: {
            // 默认显示，属性show控制显示与否
            show: false,
            overlap: true,
            width: 10,
            roundCap: false,
            clip: true
        },
        // 分隔线
        splitLine: {
            // 默认显示，属性show控制显示与否
            show: true,
            // 属性length控制线长
            length: 10,
            distance: 10,
            // 属性lineStyle（详见lineStyle）控制线条样式
            lineStyle: {
                color: '#63677A',
                width: 3,
                type: 'solid'
            }
        },
        // 坐标轴小标记
        axisTick: {
            // 属性show控制显示与否，默认不显示
            show: true,
            // 每份split细分多少段
            splitNumber: 5,
            // 属性length控制线长
            length: 6,
            distance: 10,
            // 属性lineStyle控制线条样式
            lineStyle: {
                color: '#63677A',
                width: 1,
                type: 'solid'
            }
        },
        axisLabel: {
            show: true,
            distance: 15,
            // formatter: null,
            color: '#464646',
            fontSize: 12
        },
        pointer: {
            icon: null,
            offsetCenter: [0, 0],
            show: true,
            length: '60%',
            width: 6,
            keepAspect: false
        },
        anchor: {
            show: false,
            showAbove: false,
            size: 6,
            icon: 'circle',
            offsetCenter: [0, 0],
            keepAspect: false,
            itemStyle: {
                color: '#fff',
                borderWidth: 0,
                borderColor: '#5470c6'
            }
        },

        title: {
            show: true,
            // x, y，单位px
            offsetCenter: [0, '20%'],
            // 其余属性默认使用全局文本样式，详见TEXTSTYLE
            color: '#464646',
            fontSize: 16,
            valueAnimation: false
        },
        detail: {
            show: true,
            backgroundColor: 'rgba(0,0,0,0)',
            borderWidth: 0,
            borderColor: '#ccc',
            width: 100,
            height: null, // self-adaption
            padding: [5, 10],
            // x, y，单位px
            offsetCenter: [0, '40%'],
            // formatter: null,
            // 其余属性默认使用全局文本样式，详见TEXTSTYLE
            color: '#464646',
            fontSize: 30,
            fontWeight: 'bold',
            lineHeight: 30,
            valueAnimation: false
        }
    };
}


export default GaugeSeriesModel;