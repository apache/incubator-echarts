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

import SeriesModel from '../../model/Series';
import createDimensions from '../../data/helper/createDimensions';
import {getDimensionTypeByAxis} from '../../data/helper/dimensionHelper';
import List from '../../data/List';
import * as zrUtil from 'zrender/src/core/util';
import {groupData, SINGLE_REFERRING} from '../../util/model';
import LegendVisualProvider from '../../visual/LegendVisualProvider';
import {
    SeriesOption,
    SeriesOnSingleOptionMixin,
    OptionDataValueDate,
    OptionDataValueNumeric,
    ItemStyleOption,
    BoxLayoutOptionMixin,
    ZRColor,
    Dictionary,
    SeriesLabelOption,
    ColorByMixin
} from '../../util/types';
import SingleAxis from '../../coord/single/SingleAxis';
import GlobalModel from '../../model/Global';
import Single from '../../coord/single/Single';
import { createTooltipMarkup } from '../../component/tooltip/tooltipMarkup';

const DATA_NAME_INDEX = 2;

interface ThemeRiverSeriesLabelOption extends SeriesLabelOption {
    margin?: number
}

type ThemerRiverDataItem = [OptionDataValueDate, OptionDataValueNumeric, string];

export interface ThemeRiverStateOption {
    label?: ThemeRiverSeriesLabelOption
    itemStyle?: ItemStyleOption
}

export interface ThemeRiverSeriesOption extends SeriesOption<ThemeRiverStateOption>, ThemeRiverStateOption,
    ColorByMixin,
    SeriesOnSingleOptionMixin, BoxLayoutOptionMixin {
    type?: 'themeRiver'

    color?: ZRColor[]

    coordinateSystem?: 'singleAxis'

    /**
     * gap in axis's orthogonal orientation
     */
    boundaryGap?: (string | number)[]
    /**
     * [date, value, name]
     */
    data?: ThemerRiverDataItem[]
}

class ThemeRiverSeriesModel extends SeriesModel<ThemeRiverSeriesOption> {
    static readonly type = 'series.themeRiver';
    readonly type = ThemeRiverSeriesModel.type;

    static readonly dependencies = ['singleAxis'];

    nameMap: zrUtil.HashMap<number, string>;

    coordinateSystem: Single;

    /**
     * @override
     */
    init(option: ThemeRiverSeriesOption) {
        // eslint-disable-next-line
        super.init.apply(this, arguments as any);

        // Put this function here is for the sake of consistency of code style.
        // Enable legend selection for each data item
        // Use a function instead of direct access because data reference may changed
        this.legendVisualProvider = new LegendVisualProvider(
            zrUtil.bind(this.getData, this), zrUtil.bind(this.getRawData, this)
        );
    }

    /**
     * If there is no value of a certain point in the time for some event,set it value to 0.
     *
     * @param {Array} data  initial data in the option
     * @return {Array}
     */
    fixData(data: ThemeRiverSeriesOption['data']) {
        let rawDataLength = data.length;
        /**
         * Make sure every layer data get the same keys.
         * The value index tells which layer has visited.
         * {
         *  2014/01/01: -1
         * }
         */
        const timeValueKeys: Dictionary<number> = {};

        // grouped data by name
        const groupResult = groupData(data, (item: ThemerRiverDataItem) => {
            if (!timeValueKeys.hasOwnProperty(item[0] + '')) {
                timeValueKeys[item[0] + ''] = -1;
            }
            return item[2];
        });
        const layerData: {name: string, dataList: ThemerRiverDataItem[]}[] = [];
        groupResult.buckets.each(function (items, key) {
            layerData.push({
                name: key, dataList: items
            });
        });
        const layerNum = layerData.length;

        for (let k = 0; k < layerNum; ++k) {
            const name = layerData[k].name;
            for (let j = 0; j < layerData[k].dataList.length; ++j) {
                const timeValue = layerData[k].dataList[j][0] + '';
                timeValueKeys[timeValue] = k;
            }

            for (const timeValue in timeValueKeys) {
                if (timeValueKeys.hasOwnProperty(timeValue) && timeValueKeys[timeValue] !== k) {
                    timeValueKeys[timeValue] = k;
                    data[rawDataLength] = [timeValue, 0, name];
                    rawDataLength++;
                }
            }

        }
        return data;
    }

    /**
     * @override
     * @param  option  the initial option that user gived
     * @param  ecModel  the model object for themeRiver option
     */
    getInitialData(option: ThemeRiverSeriesOption, ecModel: GlobalModel): List {

        const singleAxisModel = this.getReferringComponents('singleAxis', SINGLE_REFERRING).models[0];

        const axisType = singleAxisModel.get('type');

        // filter the data item with the value of label is undefined
        const filterData = zrUtil.filter(option.data, function (dataItem) {
            return dataItem[2] !== undefined;
        });

        // ??? TODO design a stage to transfer data for themeRiver and lines?
        const data = this.fixData(filterData || []);
        const nameList = [];
        const nameMap = this.nameMap = zrUtil.createHashMap();
        let count = 0;

        for (let i = 0; i < data.length; ++i) {
            nameList.push(data[i][DATA_NAME_INDEX]);
            if (!nameMap.get(data[i][DATA_NAME_INDEX] as string)) {
                nameMap.set(data[i][DATA_NAME_INDEX] as string, count);
                count++;
            }
        }

        const dimensionsInfo = createDimensions(data, {
            coordDimensions: ['single'],
            dimensionsDefine: [
                {
                    name: 'time',
                    type: getDimensionTypeByAxis(axisType)
                },
                {
                    name: 'value',
                    type: 'float'
                },
                {
                    name: 'name',
                    type: 'ordinal'
                }
            ],
            encodeDefine: {
                single: 0,
                value: 1,
                itemName: 2
            }
        });

        const list = new List(dimensionsInfo, this);
        list.initData(data);

        return list;
    }

    /**
     * The raw data is divided into multiple layers and each layer
     *     has same name.
     */
    getLayerSeries() {
        const data = this.getData();
        const lenCount = data.count();
        const indexArr = [];

        for (let i = 0; i < lenCount; ++i) {
            indexArr[i] = i;
        }

        const timeDim = data.mapDimension('single');

        // data group by name
        const groupResult = groupData(indexArr, function (index) {
            return data.get('name', index) as string;
        });
        const layerSeries: {
            name: string
            indices: number[]
        }[] = [];
        groupResult.buckets.each(function (items: number[], key: string) {
            items.sort(function (index1: number, index2: number) {
                return data.get(timeDim, index1) as number - (data.get(timeDim, index2) as number);
            });
            layerSeries.push({
                name: key,
                indices: items
            });
        });

        return layerSeries;
    }

    /**
     * Get data indices for show tooltip content
     */
    getAxisTooltipData(dim: string | string[], value: number, baseAxis: SingleAxis) {
        if (!zrUtil.isArray(dim)) {
            dim = dim ? [dim] : [];
        }

        const data = this.getData();
        const layerSeries = this.getLayerSeries();
        const indices = [];
        const layerNum = layerSeries.length;
        let nestestValue;

        for (let i = 0; i < layerNum; ++i) {
            let minDist = Number.MAX_VALUE;
            let nearestIdx = -1;
            const pointNum = layerSeries[i].indices.length;
            for (let j = 0; j < pointNum; ++j) {
                const theValue = data.get(dim[0], layerSeries[i].indices[j]) as number;
                const dist = Math.abs(theValue - value);
                if (dist <= minDist) {
                    nestestValue = theValue;
                    minDist = dist;
                    nearestIdx = layerSeries[i].indices[j];
                }
            }
            indices.push(nearestIdx);
        }

        return {dataIndices: indices, nestestValue: nestestValue};
    }

    formatTooltip(
        dataIndex: number,
        multipleSeries: boolean,
        dataType: string
    ) {
        const data = this.getData();
        const name = data.getName(dataIndex);
        const value = data.get(data.mapDimension('value'), dataIndex);

        return createTooltipMarkup('nameValue', { name: name, value: value });
    }

    static defaultOption: ThemeRiverSeriesOption = {
        zlevel: 0,
        z: 2,

        colorBy: 'data',
        coordinateSystem: 'singleAxis',

        // gap in axis's orthogonal orientation
        boundaryGap: ['10%', '10%'],

        // legendHoverLink: true,

        singleAxisIndex: 0,

        animationEasing: 'linear',

        label: {
            margin: 4,
            show: true,
            position: 'left',
            fontSize: 11
        },

        emphasis: {

            label: {
                show: true
            }
        }
    };
}

export default ThemeRiverSeriesModel;