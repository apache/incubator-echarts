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

import {isFunction} from 'zrender/src/core/util';
import {
    StageHandler,
    SeriesOption,
    SymbolOptionMixin,
    SymbolSizeCallback,
    SymbolCallback,
    CallbackDataParams,
    SymbolRotateCallback,
    SymbolClipCallback,
    SymbolClip
} from '../util/types';
import List from '../data/List';
import SeriesModel from '../model/Series';
import GlobalModel from '../model/Global';

// Encoding visual for all series include which is filtered for legend drawing
const seriesSymbolTask: StageHandler = {

    createOnAllSeries: true,

    // For legend.
    performRawSeries: true,

    reset: function (
        seriesModel: SeriesModel<SeriesOption & SymbolOptionMixin<CallbackDataParams>>,
        ecModel: GlobalModel
    ) {
        const data = seriesModel.getData();

        if (seriesModel.legendSymbol) {
            data.setVisual('legendSymbol', seriesModel.legendSymbol);
        }

        if (!seriesModel.hasSymbolVisual) {
            return;
        }

        const symbolType = seriesModel.get('symbol');
        const symbolSize = seriesModel.get('symbolSize');
        const keepAspect = seriesModel.get('symbolKeepAspect');
        const symbolRotate = seriesModel.get('symbolRotate');
        const symbolClip = seriesModel.get('symbolClip');

        const hasSymbolTypeCallback = isFunction(symbolType);
        const hasSymbolSizeCallback = isFunction(symbolSize);
        const hasSymbolRotateCallback = isFunction(symbolRotate);
        const hasSymbolClipCallback = isFunction(symbolClip);
        const hasCallback = hasSymbolTypeCallback || hasSymbolSizeCallback || hasSymbolRotateCallback || hasSymbolClipCallback;
        const seriesSymbol = (!hasSymbolTypeCallback && symbolType) ? symbolType : seriesModel.defaultSymbol;
        const seriesSymbolSize = !hasSymbolSizeCallback ? symbolSize : null;
        const seriesSymbolRotate = !hasSymbolRotateCallback ? symbolRotate : null;
        const seriesSymbolClip = !hasSymbolClipCallback ? symbolClip : null;

        data.setVisual({
            legendSymbol: seriesModel.legendSymbol || seriesSymbol as string,
            // If seting callback functions on `symbol` or `symbolSize`, for simplicity and avoiding
            // to bring trouble, we do not pick a reuslt from one of its calling on data item here,
            // but just use the default value. Callback on `symbol` or `symbolSize` is convenient in
            // some cases but generally it is not recommanded.
            symbol: seriesSymbol as string,
            symbolSize: seriesSymbolSize as number | number[],
            symbolKeepAspect: keepAspect,
            symbolRotate: seriesSymbolRotate as number,
            symbolClip: seriesSymbolClip as SymbolClip
        });

        // Only visible series has each data be visual encoded
        if (ecModel.isSeriesFiltered(seriesModel)) {
            return;
        }

        function dataEach(data: List, idx: number) {
            const rawValue = seriesModel.getRawValue(idx);
            const params = seriesModel.getDataParams(idx);
            hasSymbolTypeCallback && data.setItemVisual(
                idx, 'symbol', (symbolType as SymbolCallback<CallbackDataParams>)(rawValue, params)
            );
            hasSymbolSizeCallback && data.setItemVisual(
                idx, 'symbolSize', (symbolSize as SymbolSizeCallback<CallbackDataParams>)(rawValue, params)
            );
            hasSymbolRotateCallback && data.setItemVisual(
                idx, 'symbolRotate', (symbolRotate as SymbolRotateCallback<CallbackDataParams>)(rawValue, params)
            );
            hasSymbolClipCallback && data.setItemVisual(
                idx, 'symbolClip', (symbolClip as SymbolClipCallback<CallbackDataParams>)(rawValue, params)
            );
        }

        return { dataEach: hasCallback ? dataEach : null };
    }
};

const dataSymbolTask: StageHandler = {

    createOnAllSeries: true,

    // For legend.
    performRawSeries: true,

    reset: function (
        seriesModel: SeriesModel<SeriesOption & SymbolOptionMixin<CallbackDataParams>>,
        ecModel: GlobalModel
    ) {
        if (!seriesModel.hasSymbolVisual) {
            return;
        }
        // Only visible series has each data be visual encoded
        if (ecModel.isSeriesFiltered(seriesModel)) {
            return;
        }

        const data = seriesModel.getData();

        function dataEach(data: List, idx: number) {
            const itemModel = data.getItemModel<SymbolOptionMixin>(idx);
            const itemSymbolType = itemModel.getShallow('symbol', true);
            const itemSymbolSize = itemModel.getShallow('symbolSize', true);
            const itemSymbolRotate = itemModel.getShallow('symbolRotate', true);
            const itemSymbolKeepAspect = itemModel.getShallow('symbolKeepAspect', true);
            const itemSymbolClip = itemModel.getShallow('symbolClip', true);

            // If has item symbol
            if (itemSymbolType != null) {
                data.setItemVisual(idx, 'symbol', itemSymbolType);
            }
            if (itemSymbolSize != null) {
                // PENDING Transform symbolSize ?
                data.setItemVisual(idx, 'symbolSize', itemSymbolSize);
            }
            if (itemSymbolRotate != null) {
                data.setItemVisual(idx, 'symbolRotate', itemSymbolRotate);
            }
            if (itemSymbolKeepAspect != null) {
                data.setItemVisual(idx, 'symbolKeepAspect', itemSymbolKeepAspect);
            }
            if (itemSymbolClip != null) {
                data.setItemVisual(idx, 'symbolClip', itemSymbolClip);
            }
        }

        return { dataEach: data.hasItemOption ? dataEach : null };
    }
};

export {seriesSymbolTask, dataSymbolTask};
