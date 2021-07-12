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
import ExtensionAPI from '../core/ExtensionAPI';
import {retrieveRawValue} from '../data/helper/dataProvider';
import GlobalModel from '../model/Global';
import Model from '../model/Model';
import SeriesModel from '../model/Series';
import {makeInner} from '../util/model';
import {Dictionary, DecalObject, InnerDecalObject, AriaOption, SeriesOption, ColorByMixin} from '../util/types';
import {LocaleOption} from '../core/locale';
import { getDecalFromPalette } from '../model/mixin/palette';
import type {TitleOption} from '../component/title/install';

const DEFAULT_OPTION: AriaOption = {
    label: {
        enabled: true
    },
    decal: {
        show: false
    }
};

const inner = makeInner<{scope: object}, SeriesModel>();

const decalPaletteScope: Dictionary<DecalObject> = {};

type SeriesTypes = keyof LocaleOption['series']['typeNames'];

export default function ariaVisual(ecModel: GlobalModel, api: ExtensionAPI) {
    const ariaModel: Model<AriaOption> = ecModel.getModel('aria');

    // See "area enabled" detection code in `GlobalModel.ts`.
    if (!ariaModel.get('enabled')) {
        return;
    }

    const defaultOption = zrUtil.clone(DEFAULT_OPTION);
    zrUtil.merge(defaultOption.label, ecModel.getLocaleModel().get('aria'), false);
    zrUtil.merge(ariaModel.option, defaultOption, false);

    setDecal();
    setLabel();

    function setDecal() {
        const decalModel = ariaModel.getModel('decal');

        const useDecal = decalModel.get('show');
        if (useDecal) {
            // Each type of series use one scope.
            // Pie and funnel are using diferrent scopes
            const paletteScopeGroupByType = zrUtil.createHashMap<object>();
            ecModel.eachSeries((seriesModel: SeriesModel<SeriesOption & ColorByMixin>) => {
                const colorBy = seriesModel.getColorBy();
                if (colorBy === 'series') {
                    return;
                }
                let decalScope = paletteScopeGroupByType.get(seriesModel.type);
                if (!decalScope) {
                    decalScope = {};
                    paletteScopeGroupByType.set(seriesModel.type, decalScope);
                }
                inner(seriesModel).scope = decalScope;
            });

            ecModel.eachRawSeries((seriesModel: SeriesModel<SeriesOption & ColorByMixin>) => {
                if (ecModel.isSeriesFiltered(seriesModel)) {
                    return;
                }
                if (typeof seriesModel.enableAriaDecal === 'function') {
                    // Let series define how to use decal palette on data
                    seriesModel.enableAriaDecal();
                    return;
                }

                const data = seriesModel.getData();

                const colorBy = seriesModel.getColorBy();
                if (colorBy === 'data') {
                    const dataAll = seriesModel.getRawData();
                    const idxMap: Dictionary<number> = {};
                    const decalScope = inner(seriesModel).scope;

                    data.each(function (idx) {
                        const rawIdx = data.getRawIndex(idx);
                        idxMap[rawIdx] = idx;
                    });

                    const dataCount = dataAll.count();
                    dataAll.each(rawIdx => {
                        const idx = idxMap[rawIdx];
                        const name = dataAll.getName(rawIdx) || (rawIdx + '');
                        const paletteDecal = getDecalFromPalette(
                            seriesModel.ecModel,
                            name,
                            decalScope,
                            dataCount
                        );
                        const specifiedDecal = data.getItemVisual(idx, 'decal');
                        data.setItemVisual(idx, 'decal', mergeDecal(specifiedDecal, paletteDecal));
                    });
                }
                else {
                    const paletteDecal = getDecalFromPalette(
                        seriesModel.ecModel,
                        seriesModel.name,
                        decalPaletteScope,
                        ecModel.getSeriesCount()
                    );
                    const specifiedDecal = data.getVisual('decal');
                    data.setVisual('decal', mergeDecal(specifiedDecal, paletteDecal));
                }

                function mergeDecal(specifiedDecal: DecalObject, paletteDecal: DecalObject): DecalObject {
                    // Merge decal from palette to decal from itemStyle.
                    // User do not need to specify all of the decal props.
                    const resultDecal = specifiedDecal
                        ? zrUtil.extend(zrUtil.extend({}, paletteDecal), specifiedDecal)
                        : paletteDecal;
                    (resultDecal as InnerDecalObject).dirty = true;
                    return resultDecal;
                }
            });
        }
    }

    function setLabel() {
        const labelLocale = ecModel.getLocaleModel().get('aria');
        const labelModel = ariaModel.getModel('label');
        labelModel.option = zrUtil.defaults(labelModel.option, labelLocale);

        if (!labelModel.get('enabled')) {
            return;
        }

        const dom = api.getZr().dom;
        if (labelModel.get('description')) {
            dom.setAttribute('aria-label', labelModel.get('description'));
            return;
        }

        const seriesCnt = ecModel.getSeriesCount();
        const maxDataCnt = labelModel.get(['data', 'maxCount']) || 10;
        const maxSeriesCnt = labelModel.get(['series', 'maxCount']) || 10;
        const displaySeriesCnt = Math.min(seriesCnt, maxSeriesCnt);

        let ariaLabel;
        if (seriesCnt < 1) {
            // No series, no aria label
            return;
        }
        else {
            const title = getTitle();
            if (title) {
                const withTitle = labelModel.get(['general', 'withTitle']);
                ariaLabel = replace(withTitle, {
                    title: title
                });
            }
            else {
                ariaLabel = labelModel.get(['general', 'withoutTitle']);
            }

            const seriesLabels: string[] = [];
            const prefix = seriesCnt > 1
                ? labelModel.get(['series', 'multiple', 'prefix'])
                : labelModel.get(['series', 'single', 'prefix']);
            ariaLabel += replace(prefix, { seriesCount: seriesCnt });

            ecModel.eachSeries(function (seriesModel, idx) {
                if (idx < displaySeriesCnt) {
                    let seriesLabel;

                    const seriesName = seriesModel.get('name');
                    const withName = seriesName ? 'withName' : 'withoutName';
                    seriesLabel = seriesCnt > 1
                        ? labelModel.get(['series', 'multiple', withName])
                        : labelModel.get(['series', 'single', withName]);

                    seriesLabel = replace(seriesLabel, {
                        seriesId: seriesModel.seriesIndex,
                        seriesName: seriesModel.get('name'),
                        seriesType: getSeriesTypeName(seriesModel.subType as SeriesTypes)
                    });

                    const data = seriesModel.getData();
                    if (data.count() > maxDataCnt) {
                        // Show part of data
                        const partialLabel = labelModel.get(['data', 'partialData']);
                        seriesLabel += replace(partialLabel, {
                            displayCnt: maxDataCnt
                        });
                    }
                    else {
                        seriesLabel += labelModel.get(['data', 'allData']);
                    }

                    const dataLabels = [];
                    for (let i = 0; i < data.count(); i++) {
                        if (i < maxDataCnt) {
                            const name = data.getName(i);
                            const value = retrieveRawValue(data, i);
                            const dataLabel = labelModel.get(['data', name ? 'withName' : 'withoutName']);
                            dataLabels.push(
                                replace(dataLabel, {
                                    name: name,
                                    value: value
                                })
                            );
                        }
                    }
                    const middleSeparator = labelModel.get(['data', 'separator', 'middle']);
                    const endSeparator = labelModel.get(['data', 'separator', 'end']);
                    seriesLabel += dataLabels.join(middleSeparator) + endSeparator;

                    seriesLabels.push(seriesLabel);
                }
            });

            const separatorModel = labelModel.getModel(['series', 'multiple', 'separator']);
            const middleSeparator = separatorModel.get('middle');
            const endSeparator = separatorModel.get('end');
            ariaLabel += seriesLabels.join(middleSeparator) + endSeparator;

            dom.setAttribute('aria-label', ariaLabel);
        }
    }

    function replace(str: string, keyValues: object) {
        if (typeof str !== 'string') {
            return str;
        }

        let result = str;
        zrUtil.each(keyValues, function (value: string, key: string) {
            result = result.replace(
                new RegExp('\\{\\s*' + key + '\\s*\\}', 'g'),
                value
            );
        });
        return result;
    }

    function getTitle() {
        let title = ecModel.get('title') as TitleOption | TitleOption[];
        if (title && (title as TitleOption[]).length) {
            title = (title as TitleOption[])[0];
        }
        return title && (title as TitleOption).text;
    }

    function getSeriesTypeName(type: SeriesTypes) {
        return ecModel.getLocaleModel().get(['series', 'typeNames'])[type] || '自定义图';
    }
}
