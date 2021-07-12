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


import {each, bind} from 'zrender/src/core/util';
import SeriesModel from '../../model/Series';
import createListFromArray from '../helper/createListFromArray';
import {
    SeriesOption,
    SeriesEncodeOptionMixin,
    LineStyleOption,
    SeriesLabelOption,
    SeriesTooltipOption,
    DimensionName,
    OptionDataValue,
    StatesOptionMixin,
    OptionEncodeValue,
    Dictionary,
    OptionEncode,
    ColorByMixin
 } from '../../util/types';
import GlobalModel from '../../model/Global';
import List from '../../data/List';
import { ParallelActiveState, ParallelAxisOption } from '../../coord/parallel/AxisModel';
import Parallel from '../../coord/parallel/Parallel';
import ParallelModel from '../../coord/parallel/ParallelModel';

type ParallelSeriesDataValue = OptionDataValue[];

export interface ParallelStateOption {
    lineStyle?: LineStyleOption
    label?: SeriesLabelOption
}

export interface ParallelSeriesDataItemOption extends ParallelStateOption, StatesOptionMixin<ParallelStateOption> {
    value?: ParallelSeriesDataValue[]
}

export interface ParallelSeriesOption extends
    SeriesOption<ParallelStateOption>, ParallelStateOption,
    ColorByMixin,
    SeriesEncodeOptionMixin {

    type?: 'parallel';

    coordinateSystem?: string;
    parallelIndex?: number;
    parallelId?: string;

    inactiveOpacity?: number;
    activeOpacity?: number;

    smooth?: boolean | number;
    realtime?: boolean;
    tooltip?: SeriesTooltipOption;

    parallelAxisDefault?: ParallelAxisOption;

    emphasis?: {
        label?: SeriesLabelOption;
        lineStyle?: LineStyleOption;
    }

    data?: (ParallelSeriesDataValue | ParallelSeriesDataItemOption)[]
}

class ParallelSeriesModel extends SeriesModel<ParallelSeriesOption> {

    static type = 'series.parallel';
    readonly type = ParallelSeriesModel.type;

    static dependencies = ['parallel'];

    visualStyleAccessPath = 'lineStyle';
    visualDrawType = 'stroke' as const;

    coordinateSystem: Parallel;


    getInitialData(this: ParallelSeriesModel, option: ParallelSeriesOption, ecModel: GlobalModel): List {
        return createListFromArray(this.getSource(), this, {
            useEncodeDefaulter: bind(makeDefaultEncode, null, this)
        });
    }

    /**
     * User can get data raw indices on 'axisAreaSelected' event received.
     *
     * @return Raw indices
     */
    getRawIndicesByActiveState(activeState: ParallelActiveState): number[] {
        const coordSys = this.coordinateSystem;
        const data = this.getData();
        const indices = [] as number[];

        coordSys.eachActiveState(data, function (theActiveState, dataIndex) {
            if (activeState === theActiveState) {
                indices.push(data.getRawIndex(dataIndex));
            }
        });

        return indices;
    }

    static defaultOption: ParallelSeriesOption = {
        zlevel: 0,
        z: 2,

        coordinateSystem: 'parallel',
        parallelIndex: 0,

        label: {
            show: false
        },

        inactiveOpacity: 0.05,
        activeOpacity: 1,

        lineStyle: {
            width: 1,
            opacity: 0.45,
            type: 'solid'
        },
        emphasis: {
            label: {
                show: false
            }
        },

        progressive: 500,
        smooth: false, // true | false | number

        animationEasing: 'linear'
    };

}

function makeDefaultEncode(seriesModel: ParallelSeriesModel): OptionEncode {
    // The mapping of parallelAxis dimension to data dimension can
    // be specified in parallelAxis.option.dim. For example, if
    // parallelAxis.option.dim is 'dim3', it mapping to the third
    // dimension of data. But `data.encode` has higher priority.
    // Moreover, parallelModel.dimension should not be regarded as data
    // dimensions. Consider dimensions = ['dim4', 'dim2', 'dim6'];

    const parallelModel = seriesModel.ecModel.getComponent(
        'parallel', seriesModel.get('parallelIndex')
    ) as ParallelModel;
    if (!parallelModel) {
        return;
    }

    const encodeDefine: Dictionary<OptionEncodeValue> = {};
    each(parallelModel.dimensions, function (axisDim) {
        const dataDimIndex = convertDimNameToNumber(axisDim);
        encodeDefine[axisDim] = dataDimIndex;
    });

    return encodeDefine;
}

function convertDimNameToNumber(dimName: DimensionName): number {
    return +dimName.replace('dim', '');
}

export default ParallelSeriesModel;
