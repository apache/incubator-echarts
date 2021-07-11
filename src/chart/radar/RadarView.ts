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

import * as graphic from '../../util/graphic';
import { setStatesStylesFromModel, enableHoverEmphasis } from '../../util/states';
import * as zrUtil from 'zrender/src/core/util';
import * as symbolUtil from '../../util/symbol';
import ChartView from '../../view/Chart';
import RadarSeriesModel, { RadarSeriesDataItemOption } from './RadarSeries';
import ExtensionAPI from '../../core/ExtensionAPI';
import List from '../../data/List';
import { ColorString } from '../../util/types';
import GlobalModel from '../../model/Global';
import { VectorArray } from 'zrender/src/core/vector';
import { setLabelStyle, getLabelStatesModels } from '../../label/labelStyle';
import ZRImage from 'zrender/src/graphic/Image';
import { saveOldStyle } from '../../animation/basicTrasition';

type RadarSymbol = ReturnType<typeof symbolUtil.createSymbol> & {
    __dimIdx: number
};

class RadarView extends ChartView {
    static type = 'radar';
    type = RadarView.type;

    private _data: List<RadarSeriesModel>;

    render(seriesModel: RadarSeriesModel, ecModel: GlobalModel, api: ExtensionAPI) {
        const polar = seriesModel.coordinateSystem;
        const group = this.group;

        const data = seriesModel.getData();
        const oldData = this._data;

        function createSymbol(data: List<RadarSeriesModel>, idx: number) {
            const symbolType = data.getItemVisual(idx, 'symbol') as string || 'circle';
            if (symbolType === 'none') {
                return;
            }
            const symbolSize = symbolUtil.normalizeSymbolSize(
                data.getItemVisual(idx, 'symbolSize')
            );
            const symbolPath = symbolUtil.createSymbol(
                symbolType, -1, -1, 2, 2
            );
            const symbolRotate = data.getItemVisual(idx, 'symbolRotate') || 0;
            symbolPath.attr({
                style: {
                    strokeNoScale: true
                },
                z2: 100,
                scaleX: symbolSize[0] / 2,
                scaleY: symbolSize[1] / 2,
                rotation: symbolRotate * Math.PI / 180 || 0
            });
            return symbolPath as RadarSymbol;
        }

        function updateSymbols(
            oldPoints: VectorArray[],
            newPoints: VectorArray[],
            symbolGroup: graphic.Group,
            data: List<RadarSeriesModel>,
            idx: number,
            isInit?: boolean
        ) {
            // Simply rerender all
            symbolGroup.removeAll();
            for (let i = 0; i < newPoints.length - 1; i++) {
                const symbolPath = createSymbol(data, idx);
                if (symbolPath) {
                    symbolPath.__dimIdx = i;
                    if (oldPoints[i]) {
                        symbolPath.setPosition(oldPoints[i]);
                        graphic[isInit ? 'initProps' : 'updateProps'](
                            symbolPath, {
                                x: newPoints[i][0],
                                y: newPoints[i][1]
                            }, seriesModel, idx
                        );
                    }
                    else {
                        symbolPath.setPosition(newPoints[i]);
                    }
                    symbolGroup.add(symbolPath);
                }
            }
        }

        function getInitialPoints(points: number[][]) {
            return zrUtil.map(points, function (pt) {
                return [polar.cx, polar.cy];
            });
        }
        data.diff(oldData)
            .add(function (idx) {
                const points = data.getItemLayout(idx);
                if (!points) {
                    return;
                }
                const polygon = new graphic.Polygon();
                const polyline = new graphic.Polyline();
                const target = {
                    shape: {
                        points: points
                    }
                };

                polygon.shape.points = getInitialPoints(points);
                polyline.shape.points = getInitialPoints(points);
                graphic.initProps(polygon, target, seriesModel, idx);
                graphic.initProps(polyline, target, seriesModel, idx);

                const itemGroup = new graphic.Group();
                const symbolGroup = new graphic.Group();
                itemGroup.add(polyline);
                itemGroup.add(polygon);
                itemGroup.add(symbolGroup);

                updateSymbols(
                    polyline.shape.points, points, symbolGroup, data, idx, true
                );

                data.setItemGraphicEl(idx, itemGroup);
            })
            .update(function (newIdx, oldIdx) {
                const itemGroup = oldData.getItemGraphicEl(oldIdx) as graphic.Group;

                const polyline = itemGroup.childAt(0) as graphic.Polyline;
                const polygon = itemGroup.childAt(1) as graphic.Polygon;
                const symbolGroup = itemGroup.childAt(2) as graphic.Group;
                const target = {
                    shape: {
                        points: data.getItemLayout(newIdx)
                    }
                };

                if (!target.shape.points) {
                    return;
                }
                updateSymbols(
                    polyline.shape.points,
                    target.shape.points,
                    symbolGroup,
                    data,
                    newIdx,
                    false
                );

                saveOldStyle(polygon);
                saveOldStyle(polyline);

                graphic.updateProps(polyline, target, seriesModel);
                graphic.updateProps(polygon, target, seriesModel);

                data.setItemGraphicEl(newIdx, itemGroup);
            })
            .remove(function (idx) {
                group.remove(oldData.getItemGraphicEl(idx));
            })
            .execute();

        data.eachItemGraphicEl(function (itemGroup: graphic.Group, idx) {
            const itemModel = data.getItemModel<RadarSeriesDataItemOption>(idx);
            const polyline = itemGroup.childAt(0) as graphic.Polyline;
            const polygon = itemGroup.childAt(1) as graphic.Polygon;
            const symbolGroup = itemGroup.childAt(2) as graphic.Group;
            // Radar uses the visual encoded from itemStyle.
            const itemStyle = data.getItemVisual(idx, 'style');
            const color = itemStyle.fill;

            group.add(itemGroup);

            polyline.useStyle(
                zrUtil.defaults(
                    itemModel.getModel('lineStyle').getLineStyle(),
                    {
                        fill: 'none',
                        stroke: color
                    }
                )
            );

            setStatesStylesFromModel(polyline, itemModel, 'lineStyle');
            setStatesStylesFromModel(polygon, itemModel, 'areaStyle');

            const areaStyleModel = itemModel.getModel('areaStyle');
            const polygonIgnore = areaStyleModel.isEmpty() && areaStyleModel.parentModel.isEmpty();

            polygon.ignore = polygonIgnore;

            zrUtil.each(['emphasis', 'select', 'blur'] as const, function (stateName) {
                const stateModel = itemModel.getModel([stateName, 'areaStyle']);
                const stateIgnore = stateModel.isEmpty() && stateModel.parentModel.isEmpty();
                // Won't be ignore if normal state is not ignore.
                polygon.ensureState(stateName).ignore = stateIgnore && polygonIgnore;
            });

            polygon.useStyle(
                zrUtil.defaults(
                    areaStyleModel.getAreaStyle(),
                    {
                        fill: color,
                        opacity: 0.7,
                        decal: itemStyle.decal
                    }
                )
            );
            const emphasisModel = itemModel.getModel('emphasis');
            const itemHoverStyle = emphasisModel.getModel('itemStyle').getItemStyle();
            symbolGroup.eachChild(function (symbolPath: RadarSymbol) {
                if (symbolPath instanceof ZRImage) {
                    const pathStyle = symbolPath.style;
                    symbolPath.useStyle(zrUtil.extend({
                        // TODO other properties like x, y ?
                        image: pathStyle.image,
                        x: pathStyle.x, y: pathStyle.y,
                        width: pathStyle.width, height: pathStyle.height
                    }, itemStyle));
                }
                else {
                    symbolPath.useStyle(itemStyle);
                    symbolPath.setColor(color);
                    // fix display of empty symbol is not normal
                    symbolPath.__isEmptyBrush && (delete symbolPath.style.lineWidth);
                }

                const pathEmphasisState = symbolPath.ensureState('emphasis');
                pathEmphasisState.style = zrUtil.clone(itemHoverStyle);
                let defaultText = data.get(data.dimensions[symbolPath.__dimIdx], idx);
                (defaultText == null || isNaN(defaultText as number)) && (defaultText = '');

                setLabelStyle(
                    symbolPath, getLabelStatesModels(itemModel),
                    {
                        labelFetcher: data.hostModel,
                        labelDataIndex: idx,
                        labelDimIndex: symbolPath.__dimIdx,
                        defaultText: defaultText as string,
                        inheritColor: color as ColorString,
                        defaultOpacity: itemStyle.opacity
                    }
                );
            });

            enableHoverEmphasis(itemGroup, emphasisModel.get('focus'), emphasisModel.get('blurScope'));
        });

        this._data = data;
    }

    remove() {
        this.group.removeAll();
        this._data = null;
    }
}

export default RadarView;
