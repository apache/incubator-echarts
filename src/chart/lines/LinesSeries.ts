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

/* global Uint32Array, Float64Array, Float32Array */

import SeriesModel from '../../model/Series';
import List from '../../data/List';
import { concatArray, mergeAll, map } from 'zrender/src/core/util';
import CoordinateSystem from '../../core/CoordinateSystem';
import {
    SeriesOption,
    SeriesOnCartesianOptionMixin,
    SeriesOnGeoOptionMixin,
    SeriesOnPolarOptionMixin,
    SeriesOnCalendarOptionMixin,
    SeriesLargeOptionMixin,
    LineStyleOption,
    OptionDataValue,
    StatesOptionMixin,
    SeriesLineLabelOption,
    ColorByMixin
} from '../../util/types';
import GlobalModel from '../../model/Global';
import type { LineDrawModelOption } from '../helper/LineDraw';
import { createTooltipMarkup } from '../../component/tooltip/tooltipMarkup';

const Uint32Arr = typeof Uint32Array === 'undefined' ? Array : Uint32Array;
const Float64Arr = typeof Float64Array === 'undefined' ? Array : Float64Array;

function compatEc2(seriesOpt: LinesSeriesOption) {
    const data = seriesOpt.data;
    if (data && data[0] && (data as LegacyDataItemOption[][])[0][0] && (data as LegacyDataItemOption[][])[0][0].coord) {
        if (__DEV__) {
            console.warn('Lines data configuration has been changed to'
                + ' { coords:[[1,2],[2,3]] }');
        }
        seriesOpt.data = map(data as LegacyDataItemOption[][], function (itemOpt) {
            const coords = [
                itemOpt[0].coord, itemOpt[1].coord
            ];
            const target: LinesDataItemOption = {
                coords: coords
            };
            if (itemOpt[0].name) {
                target.fromName = itemOpt[0].name;
            }
            if (itemOpt[1].name) {
                target.toName = itemOpt[1].name;
            }
            return mergeAll([target, itemOpt[0], itemOpt[1]]);
        });
    }
}

type LinesCoords = number[][];

type LinesValue = OptionDataValue | OptionDataValue[];

interface LinesLineStyleOption extends LineStyleOption {
    curveness?: number
}

// @deprecated
interface LegacyDataItemOption {
    coord: number[]
    name: string
}

export interface LinesStateOption {
    lineStyle?: LinesLineStyleOption
    label?: SeriesLineLabelOption
}

export interface LinesDataItemOption extends LinesStateOption, StatesOptionMixin<LinesStateOption> {
    name?: string

    fromName?: string
    toName?: string

    symbol?: string[] | string
    symbolSize?: number[] | number

    coords?: LinesCoords

    value?: LinesValue
}

export interface LinesSeriesOption extends SeriesOption<LinesStateOption>, LinesStateOption,
    ColorByMixin,
    SeriesOnCartesianOptionMixin, SeriesOnGeoOptionMixin, SeriesOnPolarOptionMixin,
    SeriesOnCalendarOptionMixin, SeriesLargeOptionMixin {

    type?: 'lines'

    coordinateSystem?: string

    symbol?: string[] | string
    symbolSize?: number[] | number

    effect?: LineDrawModelOption['effect']

    /**
     * If lines are polyline
     * polyline not support curveness, label, animation
     */
    polyline?: boolean
    /**
     * If clip the overflow.
     * Available when coordinateSystem is cartesian or polar.
     */
    clip?: boolean

    data?: LinesDataItemOption[]
        // Stored as a flat array. In format
        // Points Count(2) | x | y | x | y | Points Count(3) | x |  y | x | y | x | y |
        | ArrayLike<number>
}

class LinesSeriesModel extends SeriesModel<LinesSeriesOption> {

    static readonly type = 'series.lines';
    readonly type = LinesSeriesModel.type;

    static readonly dependencies = ['grid', 'polar', 'geo', 'calendar'];

    visualStyleAccessPath = 'lineStyle';
    visualDrawType = 'stroke' as const;

    private _flatCoords: ArrayLike<number>;
    private _flatCoordsOffset: ArrayLike<number>;

    init(option: LinesSeriesOption) {
        // The input data may be null/undefined.
        option.data = option.data || [];

        // Not using preprocessor because mergeOption may not have series.type
        compatEc2(option);

        const result = this._processFlatCoordsArray(option.data);
        this._flatCoords = result.flatCoords;
        this._flatCoordsOffset = result.flatCoordsOffset;
        if (result.flatCoords) {
            option.data = new Float32Array(result.count);
        }

        super.init.apply(this, arguments as any);
    }

    mergeOption(option: LinesSeriesOption) {
        compatEc2(option);

        if (option.data) {
            // Only update when have option data to merge.
            const result = this._processFlatCoordsArray(option.data);
            this._flatCoords = result.flatCoords;
            this._flatCoordsOffset = result.flatCoordsOffset;
            if (result.flatCoords) {
                option.data = new Float32Array(result.count);
            }
        }

        super.mergeOption.apply(this, arguments as any);
    }

    appendData(params: Pick<LinesSeriesOption, 'data'>) {
        const result = this._processFlatCoordsArray(params.data);
        if (result.flatCoords) {
            if (!this._flatCoords) {
                this._flatCoords = result.flatCoords;
                this._flatCoordsOffset = result.flatCoordsOffset;
            }
            else {
                this._flatCoords = concatArray(this._flatCoords, result.flatCoords);
                this._flatCoordsOffset = concatArray(this._flatCoordsOffset, result.flatCoordsOffset);
            }
            params.data = new Float32Array(result.count);
        }

        this.getRawData().appendData(params.data);
    }

    _getCoordsFromItemModel(idx: number) {
        const itemModel = this.getData().getItemModel<LinesDataItemOption>(idx);
        const coords = (itemModel.option instanceof Array)
            ? itemModel.option : itemModel.getShallow('coords');

        if (__DEV__) {
            if (!(coords instanceof Array && coords.length > 0 && coords[0] instanceof Array)) {
                throw new Error(
                    'Invalid coords ' + JSON.stringify(coords) + '. Lines must have 2d coords array in data item.'
                );
            }
        }
        return coords;
    }

    getLineCoordsCount(idx: number) {
        if (this._flatCoordsOffset) {
            return this._flatCoordsOffset[idx * 2 + 1];
        }
        else {
            return this._getCoordsFromItemModel(idx).length;
        }
    }

    getLineCoords(idx: number, out: number[][]) {
        if (this._flatCoordsOffset) {
            const offset = this._flatCoordsOffset[idx * 2];
            const len = this._flatCoordsOffset[idx * 2 + 1];
            for (let i = 0; i < len; i++) {
                out[i] = out[i] || [];
                out[i][0] = this._flatCoords[offset + i * 2];
                out[i][1] = this._flatCoords[offset + i * 2 + 1];
            }
            return len;
        }
        else {
            const coords = this._getCoordsFromItemModel(idx);
            for (let i = 0; i < coords.length; i++) {
                out[i] = out[i] || [];
                out[i][0] = coords[i][0];
                out[i][1] = coords[i][1];
            }
            return coords.length;
        }
    }

    _processFlatCoordsArray(data: LinesSeriesOption['data']) {
        let startOffset = 0;
        if (this._flatCoords) {
            startOffset = this._flatCoords.length;
        }
        // Stored as a typed array. In format
        // Points Count(2) | x | y | x | y | Points Count(3) | x |  y | x | y | x | y |
        if (typeof data[0] === 'number') {
            const len = data.length;
            // Store offset and len of each segment
            const coordsOffsetAndLenStorage = new Uint32Arr(len) as Uint32Array;
            const coordsStorage = new Float64Arr(len) as Float64Array;
            let coordsCursor = 0;
            let offsetCursor = 0;
            let dataCount = 0;
            for (let i = 0; i < len;) {
                dataCount++;
                const count = data[i++] as number;
                // Offset
                coordsOffsetAndLenStorage[offsetCursor++] = coordsCursor + startOffset;
                // Len
                coordsOffsetAndLenStorage[offsetCursor++] = count;
                for (let k = 0; k < count; k++) {
                    const x = data[i++] as number;
                    const y = data[i++] as number;
                    coordsStorage[coordsCursor++] = x;
                    coordsStorage[coordsCursor++] = y;

                    if (i > len) {
                        if (__DEV__) {
                            throw new Error('Invalid data format.');
                        }
                    }
                }
            }

            return {
                flatCoordsOffset: new Uint32Array(coordsOffsetAndLenStorage.buffer, 0, offsetCursor),
                flatCoords: coordsStorage,
                count: dataCount
            };
        }

        return {
            flatCoordsOffset: null,
            flatCoords: null,
            count: data.length
        };
    }

    getInitialData(option: LinesSeriesOption, ecModel: GlobalModel) {
        if (__DEV__) {
            const CoordSys = CoordinateSystem.get(option.coordinateSystem);
            if (!CoordSys) {
                throw new Error('Unkown coordinate system ' + option.coordinateSystem);
            }
        }

        const lineData = new List(['value'], this);
        lineData.hasItemOption = false;

        lineData.initData(option.data, [], function (dataItem, dimName, dataIndex, dimIndex) {
            // dataItem is simply coords
            if (dataItem instanceof Array) {
                return NaN;
            }
            else {
                lineData.hasItemOption = true;
                const value = dataItem.value;
                if (value != null) {
                    return value instanceof Array ? value[dimIndex] : value;
                }
            }
        });

        return lineData;
    }

    formatTooltip(
        dataIndex: number,
        multipleSeries: boolean,
        dataType: string
    ) {
        const data = this.getData();
        const itemModel = data.getItemModel<LinesDataItemOption>(dataIndex);
        const name = itemModel.get('name');
        if (name) {
            return name;
        }
        const fromName = itemModel.get('fromName');
        const toName = itemModel.get('toName');
        const nameArr = [];
        fromName != null && nameArr.push(fromName);
        toName != null && nameArr.push(toName);

        return createTooltipMarkup('nameValue', {
            name: nameArr.join(' > ')
        });
    }

    preventIncremental() {
        return !!this.get(['effect', 'show']);
    }

    getProgressive() {
        const progressive = this.option.progressive;
        if (progressive == null) {
            return this.option.large ? 1e4 : this.get('progressive');
        }
        return progressive;
    }

    getProgressiveThreshold() {
        const progressiveThreshold = this.option.progressiveThreshold;
        if (progressiveThreshold == null) {
            return this.option.large ? 2e4 : this.get('progressiveThreshold');
        }
        return progressiveThreshold;
    }

    static defaultOption: LinesSeriesOption = {
        coordinateSystem: 'geo',
        zlevel: 0,
        z: 2,
        legendHoverLink: true,

        // Cartesian coordinate system
        xAxisIndex: 0,
        yAxisIndex: 0,

        symbol: ['none', 'none'],
        symbolSize: [10, 10],
        // Geo coordinate system
        geoIndex: 0,

        effect: {
            show: false,
            period: 4,
            constantSpeed: 0,
            symbol: 'circle',
            symbolSize: 3,
            loop: true,
            trailLength: 0.2
        },

        large: false,
        // Available when large is true
        largeThreshold: 2000,

        polyline: false,

        clip: true,

        label: {
            show: false,
            position: 'end'
            // distance: 5,
            // formatter: 标签文本格式器，同Tooltip.formatter，不支持异步回调
        },

        lineStyle: {
            opacity: 0.5
        }
    };
}

export default LinesSeriesModel;
