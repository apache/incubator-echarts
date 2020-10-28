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

import ComponentModel from '../../model/Component';
import {
    ComponentOption,
    ScaleDataValue,
    CommonAxisPointerOption
} from '../../util/types';

interface MapperParamAxisInfo {
    axisIndex: number
    axisName: string
    axisId: string
    axisDim: string
}

interface AxisPointerLink {
    xAxisIndex?: number[] | 'all'
    yAxisIndex?: number[] | 'all'
    xAxisId?: string[]
    yAxisId?: string[]
    xAxisName?: string[] | string
    yAxisName?: string[] | string

    radiusAxisIndex?: number[] | 'all'
    angleAxisIndex?: number[] | 'all'
    radiusAxisId?: string[]
    angleAxisId?: string[]
    radiusAxisName?: string[] | string
    angleAxisName?: string[] | string

    singleAxisIndex?: number[] | 'all'
    singleAxisId?: string[]
    singleAxisName?: string[] | string

    mapper?(
        sourceVal: ScaleDataValue,
        sourceAxisInfo: MapperParamAxisInfo,
        targetAxisInfo: MapperParamAxisInfo
    ): CommonAxisPointerOption['value']   // TODO: TYPE Should return numeric value or category value?
}

// TODO: TYPE AxisPointerOption for each axis
export interface AxisPointerOption extends ComponentOption, Omit<CommonAxisPointerOption, 'type'> {
    type?: 'line' | 'shadow' | 'cross' | 'none'

    link?: AxisPointerLink[]
}


class AxisPointerModel extends ComponentModel<AxisPointerOption> {

    static type = 'axisPointer' as const;
    type = AxisPointerModel.type;

    // Will be injected and read in modelHelper and axisTrigger
    // No need to care about it.
    coordSysAxesInfo: unknown;

    static defaultOption: AxisPointerOption = {
        // 'auto' means that show when triggered by tooltip or handle.
        show: 'auto',

        zlevel: 0,
        z: 2,

        type: 'line', // 'line' 'shadow' 'cross' 'none'.
        // axispointer triggered by tootip determine snap automatically,
        // see `modelHelper`.
        snap: false,
        triggerTooltip: true,

        value: null,
        status: null, // Init value depends on whether handle is used.

        link: [],

        // Do not set 'auto' here, otherwise global animation: false
        // will not effect at this axispointer.
        animation: null,
        animationDurationUpdate: 200,

        lineStyle: {
            color: '#B9BEC9',
            width: 1,
            type: 'dashed'
        },

        shadowStyle: {
            color: 'rgba(210,219,238,0.2)'
        },

        label: {
            show: true,
            formatter: null, // string | Function
            precision: 'auto', // Or a number like 0, 1, 2 ...
            margin: 3,
            color: '#fff',
            padding: [5, 7, 5, 7],
            backgroundColor: 'auto', // default: axis line color
            borderColor: null,
            borderWidth: 0,
            borderRadius: 3
        },

        handle: {
            show: false,
            // eslint-disable-next-line
            icon: 'M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4h1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7v-1.2h6.6z M13.3,22H6.7v-1.2h6.6z M13.3,19.6H6.7v-1.2h6.6z', // jshint ignore:line
            size: 45,
            // handle margin is from symbol center to axis, which is stable when circular move.
            margin: 50,
            // color: '#1b8bbd'
            // color: '#2f4554'
            color: '#333',
            shadowBlur: 3,
            shadowColor: '#aaa',
            shadowOffsetX: 0,
            shadowOffsetY: 2,

            // For mobile performance
            throttle: 40
        }
    };
}

export default AxisPointerModel;
